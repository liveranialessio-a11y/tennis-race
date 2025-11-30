-- =====================================================
-- Fix handle_match_completion to not swap positions for challenges
-- =====================================================
-- The trigger was swapping positions immediately when a challenge
-- was launched (status = 'lanciata'). This fix ensures positions
-- are only swapped when the match is actually completed
-- (challenge_status IS NULL).
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
  winner_old_position INTEGER;
  loser_old_position INTEGER;
BEGIN
  -- Skip if match is scheduled (not yet played)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- Skip if match is a draw
  IF NEW.is_draw = true THEN
    RETURN NEW;
  END IF;

  -- ⭐ NEW: Skip if challenge is not yet completed
  -- Only swap positions when challenge_status IS NULL
  -- (meaning the challenge has been completed and finalized)
  IF NEW.challenge_status IS NOT NULL THEN
    RAISE NOTICE 'Skipping position swap: challenge still in status "%"', NEW.challenge_status;
    RETURN NEW;
  END IF;

  -- Get winner player info
  SELECT id, live_rank_position
  INTO winner_player_id, winner_old_position
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  -- Get loser player info
  SELECT id, live_rank_position
  INTO loser_player_id, loser_old_position
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  -- Validation: both players must exist
  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Winner player id: %, position: %', winner_player_id, winner_old_position;
  RAISE NOTICE 'Loser player id: %, position: %', loser_player_id, loser_old_position;

  -- Validation: winner and loser must be different players
  IF winner_player_id = loser_player_id THEN
    RAISE NOTICE 'ERROR: Winner and loser are the same player!';
    RETURN NEW;
  END IF;

  -- Swap positions if winner had a lower rank (higher position number)
  IF winner_old_position > loser_old_position THEN
    RAISE NOTICE 'Swapping positions: winner % -> %, loser % -> %',
      winner_old_position, loser_old_position, loser_old_position, winner_old_position;

    -- Update winner to loser's position
    UPDATE public.players
    SET
      live_rank_position = loser_old_position,
      live_rank_category = get_category_by_position(loser_old_position),
      updated_at = now()
    WHERE id = winner_player_id;

    -- Update loser to winner's position
    UPDATE public.players
    SET
      live_rank_position = winner_old_position,
      live_rank_category = get_category_by_position(winner_old_position),
      updated_at = now()
    WHERE id = loser_player_id;

    RAISE NOTICE 'Position swap completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_match_completion IS 'Handles position swapping after match completion. Only swaps positions when challenge_status IS NULL (completed). Statistics (wins, losses, sets, draws) are calculated dynamically from matches table using get_filtered_player_stats function.';

-- =====================================================
-- Fix increment_matches_this_month to not count challenges
-- =====================================================
-- The trigger was incrementing match count immediately when a challenge
-- was launched. This fix ensures matches are only counted when
-- the challenge is actually completed (challenge_status IS NULL).
-- =====================================================

CREATE OR REPLACE FUNCTION public.increment_matches_this_month()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
BEGIN
  -- Skip if match is scheduled (not yet played)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- ⭐ NEW: Skip if challenge is not yet completed
  -- Only count matches when challenge_status IS NULL
  -- (meaning the challenge has been completed and finalized)
  IF NEW.challenge_status IS NOT NULL THEN
    RAISE NOTICE 'Skipping match count increment: challenge still in status "%"', NEW.challenge_status;
    RETURN NEW;
  END IF;

  -- Get winner player ID
  SELECT id INTO winner_player_id
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  -- Get loser player ID
  SELECT id INTO loser_player_id
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  -- Validation: both players must exist
  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  -- Increment matches_this_month for winner
  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = winner_player_id;

  -- Increment matches_this_month for loser
  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = loser_player_id;

  RAISE NOTICE 'Incremented matches_this_month for players: % and %', winner_player_id, loser_player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.increment_matches_this_month IS 'Automatically increments matches_this_month counter for both players when a match is completed (challenge_status IS NULL)';

-- =====================================================
-- Fix get_filtered_player_stats to not count scheduled matches or challenges
-- =====================================================
-- The function was counting scheduled matches and uncompleted challenges
-- in player statistics. This fix ensures only completed matches are counted.
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_filtered_player_stats(
  player_uuid uuid,
  filter_type text,
  filter_year integer DEFAULT NULL,
  filter_month integer DEFAULT NULL
)
RETURNS TABLE(
  wins integer,
  losses integer,
  matches_played integer,
  sets_won integer,
  sets_lost integer,
  win_percentage integer,
  sets_win_percentage integer,
  draws integer,
  games_won integer,
  games_lost integer,
  games_win_percentage integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_uuid uuid;
  total_wins integer := 0;
  total_losses integer := 0;
  total_draws integer := 0;
  total_sets_won integer := 0;
  total_sets_lost integer := 0;
  total_games_won integer := 0;
  total_games_lost integer := 0;
  loss_count integer;
  sets_won_in_losses integer;
  sets_lost_in_losses integer;
  games_won_in_losses integer;
  games_lost_in_losses integer;
BEGIN
  SELECT p.user_id INTO user_uuid
  FROM public.players p
  WHERE p.id = player_uuid;

  IF user_uuid IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Count wins (only completed matches)
  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer,
    COALESCE(SUM(games.winner_games), 0)::integer,
    COALESCE(SUM(games.loser_games), 0)::integer
  INTO total_wins, total_sets_won, total_sets_lost, total_games_won, total_games_lost
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  CROSS JOIN LATERAL calculate_games_from_score(m.score) AS games
  WHERE m.winner_id = user_uuid
    AND m.score IS NOT NULL
    AND m.score != ''  -- ⭐ NEW: Exclude empty scores (challenges)
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)  -- ⭐ NEW: Exclude scheduled matches
    AND m.challenge_status IS NULL  -- ⭐ NEW: Exclude uncompleted challenges
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Count losses (only completed matches)
  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer,
    COALESCE(SUM(games.loser_games), 0)::integer,
    COALESCE(SUM(games.winner_games), 0)::integer
  INTO loss_count, sets_won_in_losses, sets_lost_in_losses, games_won_in_losses, games_lost_in_losses
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  CROSS JOIN LATERAL calculate_games_from_score(m.score) AS games
  WHERE m.loser_id = user_uuid
    AND m.score IS NOT NULL
    AND m.score != ''  -- ⭐ NEW: Exclude empty scores (challenges)
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)  -- ⭐ NEW: Exclude scheduled matches
    AND m.challenge_status IS NULL  -- ⭐ NEW: Exclude uncompleted challenges
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Count draws (only completed matches)
  SELECT COALESCE(COUNT(*), 0)::integer
  INTO total_draws
  FROM public.matches m
  WHERE (m.winner_id = user_uuid OR m.loser_id = user_uuid)
    AND m.is_draw = true
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)  -- ⭐ NEW: Exclude scheduled matches
    AND m.challenge_status IS NULL  -- ⭐ NEW: Exclude uncompleted challenges
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  total_losses := loss_count;
  total_sets_won := total_sets_won + sets_won_in_losses;
  total_sets_lost := total_sets_lost + sets_lost_in_losses;
  total_games_won := total_games_won + games_won_in_losses;
  total_games_lost := total_games_lost + games_lost_in_losses;

  RETURN QUERY SELECT
    total_wins,
    total_losses,
    total_wins + total_losses + total_draws,
    total_sets_won,
    total_sets_lost,
    CASE
      WHEN (total_wins + total_losses) > 0
      THEN ((total_wins::numeric / (total_wins + total_losses)) * 100)::integer
      ELSE 0
    END,
    CASE
      WHEN (total_sets_won + total_sets_lost) > 0
      THEN ((total_sets_won::numeric / (total_sets_won + total_sets_lost)) * 100)::integer
      ELSE 0
    END,
    total_draws,
    total_games_won,
    total_games_lost,
    CASE
      WHEN (total_games_won + total_games_lost) > 0
      THEN ((total_games_won::numeric / (total_games_won + total_games_lost)) * 100)::integer
      ELSE 0
    END;
END;
$$;

COMMENT ON FUNCTION public.get_filtered_player_stats IS 'Returns filtered player statistics including matches, sets, games, and percentages. Only counts completed matches (is_scheduled = false, challenge_status IS NULL, score not empty). Supports filters: all, monthly (year+month), annual (year).';
