-- =====================================================
-- REMOVE: Unused Statistics Columns from players Table
-- =====================================================
-- Changes:
-- 1. Remove wins, losses, matches_played columns
-- 2. Remove sets_won, sets_lost columns
-- 3. Remove draws column
--
-- These statistics are now calculated dynamically from the matches table
-- using the get_filtered_player_stats function
-- =====================================================

-- Remove unused columns from players table
ALTER TABLE public.players
  DROP COLUMN IF EXISTS wins,
  DROP COLUMN IF EXISTS losses,
  DROP COLUMN IF EXISTS matches_played,
  DROP COLUMN IF EXISTS sets_won,
  DROP COLUMN IF EXISTS sets_lost,
  DROP COLUMN IF EXISTS draws;

-- Add comment to document the change
COMMENT ON TABLE public.players IS
'Player records for championships. Statistics (wins, losses, sets, etc.) are calculated dynamically from the matches table using get_filtered_player_stats function.';
