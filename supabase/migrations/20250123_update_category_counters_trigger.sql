-- =====================================================
-- TRIGGER: Update category counters when player added
-- =====================================================
-- Automatically increment the appropriate category counter
-- when a new player is added to a championship
-- =====================================================

CREATE OR REPLACE FUNCTION update_category_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment counter for new player's category
  IF NEW.live_rank_category = 'gold' THEN
    UPDATE public.championships
    SET gold_players_count = gold_players_count + 1
    WHERE id = NEW.championship_id;
  ELSIF NEW.live_rank_category = 'silver' THEN
    UPDATE public.championships
    SET silver_players_count = silver_players_count + 1
    WHERE id = NEW.championship_id;
  ELSIF NEW.live_rank_category = 'bronze' THEN
    UPDATE public.championships
    SET bronze_players_count = bronze_players_count + 1
    WHERE id = NEW.championship_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_category_counters ON public.players;

CREATE TRIGGER trigger_update_category_counters
  AFTER INSERT ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION update_category_counters();

COMMENT ON FUNCTION update_category_counters IS 'Automatically updates championship category counters when a player is added';
