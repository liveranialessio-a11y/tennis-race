-- Drop existing function
DROP FUNCTION IF EXISTS get_filtered_player_stats(uuid, text, integer, integer);

-- Create corrected function that uses user_id instead of player_id
CREATE OR REPLACE FUNCTION get_filtered_player_stats(
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
  sets_win_percentage integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_uuid uuid;
  total_wins integer := 0;
  total_losses integer := 0;
  total_sets_won integer := 0;
  total_sets_lost integer := 0;
  loss_count integer;
  sets_won_in_losses integer;
  sets_lost_in_losses integer;
BEGIN
  -- Get the user_id from the player_id
  SELECT p.user_id INTO user_uuid
  FROM public.players p
  WHERE p.id = player_uuid;

  -- If player not found, return zeros
  IF user_uuid IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Calculate wins and sets from winning matches
  -- When we WIN: winner_sets = sets we won, loser_sets = sets we lost
  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer
  INTO total_wins, total_sets_won, total_sets_lost
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  WHERE m.winner_id = user_uuid
    AND m.score IS NOT NULL
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Calculate losses and add sets from losing matches
  -- When we LOSE: loser_sets = sets we won, winner_sets = sets we lost
  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer
  INTO loss_count, sets_won_in_losses, sets_lost_in_losses
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  WHERE m.loser_id = user_uuid
    AND m.score IS NOT NULL
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Add the sets from losing matches to the totals
  total_losses := loss_count;
  total_sets_won := total_sets_won + sets_won_in_losses;
  total_sets_lost := total_sets_lost + sets_lost_in_losses;

  -- Return calculated statistics
  RETURN QUERY SELECT
    total_wins,
    total_losses,
    total_wins + total_losses,
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
    END;
END;
$$;
