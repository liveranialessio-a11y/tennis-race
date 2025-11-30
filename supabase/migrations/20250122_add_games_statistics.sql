-- =====================================================
-- ADD: Games Statistics Support
-- =====================================================
-- Changes:
-- 1. Create calculate_games_from_score function
-- 2. Update get_filtered_player_stats to include games
-- =====================================================

-- STEP 1: Create function to calculate games from score
DROP FUNCTION IF EXISTS calculate_games_from_score(TEXT) CASCADE;

CREATE OR REPLACE FUNCTION calculate_games_from_score(score_str TEXT)
RETURNS TABLE(winner_games INTEGER, loser_games INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  set_parts text[];
  winner_score integer;
  loser_score integer;
  winner_games_count integer := 0;
  loser_games_count integer := 0;
BEGIN
  -- Se lo score non è valido o è "Da giocare", ritorna 0-0
  IF score_str IS NULL OR score_str = 'Da giocare' OR LENGTH(score_str) < 3 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  -- Split per spazi per ottenere i singoli set
  set_parts := string_to_array(score_str, ' ');

  -- Processa ogni set e conta TUTTI i game (anche set incompleti)
  FOR i IN 1..array_length(set_parts, 1) LOOP
    IF set_parts[i] ~ '^\d+-\d+$' THEN
      -- Estrai i punteggi del set (numero di game)
      winner_score := split_part(set_parts[i], '-', 1)::integer;
      loser_score := split_part(set_parts[i], '-', 2)::integer;

      -- Somma TUTTI i game (completi o incompleti)
      winner_games_count := winner_games_count + winner_score;
      loser_games_count := loser_games_count + loser_score;
    END IF;
  END LOOP;

  RETURN QUERY SELECT winner_games_count, loser_games_count;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION calculate_games_from_score TO authenticated;

-- Comment
COMMENT ON FUNCTION calculate_games_from_score IS
'Calcola il totale dei game vinti dal vincitore e dal perdente in un match. Include set completi e incompleti. Formato score: "6-4 6-2" o "6-4 3-0".';

-- STEP 2: Update get_filtered_player_stats to include games statistics
DROP FUNCTION IF EXISTS get_filtered_player_stats(UUID, TEXT, INTEGER, INTEGER) CASCADE;

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
  -- Get the user_id from the player_id
  SELECT p.user_id INTO user_uuid
  FROM public.players p
  WHERE p.id = player_uuid;

  -- If player not found, return zeros
  IF user_uuid IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  -- Calculate wins, sets, and games from winning matches (excluding draws)
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
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Calculate losses and add sets/games from losing matches (excluding draws)
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
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Calculate draws (count matches where user is involved and is_draw = true)
  SELECT COALESCE(COUNT(*), 0)::integer
  INTO total_draws
  FROM public.matches m
  WHERE (m.winner_id = user_uuid OR m.loser_id = user_uuid)
    AND m.is_draw = true
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  -- Add the sets and games from losing matches to the totals
  total_losses := loss_count;
  total_sets_won := total_sets_won + sets_won_in_losses;
  total_sets_lost := total_sets_lost + sets_lost_in_losses;
  total_games_won := total_games_won + games_won_in_losses;
  total_games_lost := total_games_lost + games_lost_in_losses;

  -- Return calculated statistics (matches_played includes draws)
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION get_filtered_player_stats TO authenticated;

-- Comment
COMMENT ON FUNCTION get_filtered_player_stats IS
'Returns filtered player statistics including matches, sets, games, and percentages. Supports filters: all, monthly (year+month), annual (year).';
