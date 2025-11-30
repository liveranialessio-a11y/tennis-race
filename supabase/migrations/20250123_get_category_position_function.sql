-- =====================================================
-- FUNCTION: Calculate relative position within category
-- =====================================================
-- Converts global position to category-relative position
-- Examples:
--   Gold player at position 5 -> returns 5
--   Silver player at position 15 (with 10 gold players) -> returns 5
--   Bronze player at position 25 (with 10 gold + 10 silver) -> returns 5
-- =====================================================

CREATE OR REPLACE FUNCTION get_category_position(
  p_live_rank_position INTEGER,
  p_live_rank_category TEXT,
  p_championship_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_gold_count INTEGER;
  v_silver_count INTEGER;
BEGIN
  -- Get category counts from championship
  SELECT gold_players_count, silver_players_count
  INTO v_gold_count, v_silver_count
  FROM public.championships
  WHERE id = p_championship_id;

  -- Calculate relative position based on category
  CASE p_live_rank_category
    WHEN 'gold' THEN
      -- Gold players: position stays the same (1-N)
      RETURN p_live_rank_position;

    WHEN 'silver' THEN
      -- Silver players: subtract gold count
      RETURN p_live_rank_position - v_gold_count;

    WHEN 'bronze' THEN
      -- Bronze players: subtract gold + silver counts
      RETURN p_live_rank_position - v_gold_count - v_silver_count;

    ELSE
      -- Unknown category: return original position
      RETURN p_live_rank_position;
  END CASE;
END;
$$;

GRANT EXECUTE ON FUNCTION get_category_position TO authenticated;

COMMENT ON FUNCTION get_category_position IS 'Converts global live_rank_position to category-relative position (1-N per category)';

-- Example usage:
-- SELECT
--   display_name,
--   live_rank_position as global_pos,
--   live_rank_category,
--   get_category_position(live_rank_position, live_rank_category, championship_id) as category_pos
-- FROM players
-- WHERE championship_id = '05a1963f-7b43-4a11-83b9-1ada19d72e00'
-- ORDER BY live_rank_position;
