-- =====================================================
-- MATCHES THIS MONTH TRACKING SYSTEM
-- =====================================================
-- Automatically tracks monthly match participation for:
-- 1. Inactivity demotion (players with < min matches get demoted)
-- 2. Pro Master points assignment (requires min matches)
-- =====================================================

-- =====================================================
-- STEP 1: Trigger function to increment matches_this_month
-- =====================================================
DROP FUNCTION IF EXISTS increment_matches_this_month() CASCADE;

CREATE OR REPLACE FUNCTION increment_matches_this_month()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
BEGIN
  -- Only process completed matches (not scheduled)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- Get player IDs from the players table
  SELECT id INTO winner_player_id
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  SELECT id INTO loser_player_id
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  -- If we don't find both players, exit
  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  -- Increment matches_this_month for both players (including draws)
  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = winner_player_id;

  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = loser_player_id;

  RAISE NOTICE 'Incremented matches_this_month for players: % and %', winner_player_id, loser_player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger (runs BEFORE the on_match_completion trigger for position swapping)
DROP TRIGGER IF EXISTS increment_monthly_matches ON public.matches;

CREATE TRIGGER increment_monthly_matches
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION increment_matches_this_month();

COMMENT ON FUNCTION increment_matches_this_month IS 'Automatically increments matches_this_month counter for both players when a match is completed';

-- =====================================================
-- STEP 2: Function to reset matches_this_month for all players
-- =====================================================
DROP FUNCTION IF EXISTS reset_monthly_matches(UUID);

CREATE OR REPLACE FUNCTION reset_monthly_matches(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  -- Reset matches_this_month to 0 for all players in the championship
  UPDATE public.players
  SET
    matches_this_month = 0,
    updated_at = now()
  WHERE championship_id = target_championship_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'message', 'Monthly matches counter reset successfully',
    'players_updated', updated_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error resetting monthly matches: ' || SQLERRM
    );
END;
$$;

GRANT EXECUTE ON FUNCTION reset_monthly_matches TO authenticated;

COMMENT ON FUNCTION reset_monthly_matches IS 'Admin function to reset matches_this_month counter for all players at the start of a new month';

-- =====================================================
-- STEP 3: Add helpful query to check current monthly matches
-- =====================================================
-- Use this query to verify the current state:
/*
SELECT
  display_name,
  live_rank_position,
  live_rank_category,
  matches_this_month,
  pro_master_points
FROM public.players
WHERE championship_id = '05a1963f-7b43-4a11-83b9-1ada19d72e00'
ORDER BY live_rank_position ASC;
*/
