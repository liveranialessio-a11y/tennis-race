-- =====================================================
-- ADD: best_pro_master_rank automatic update trigger
-- =====================================================
-- Similar to best_live_rank logic:
-- When pro_master_rank_position changes, update best_pro_master_rank
-- if the new position is better (lower number = better position)
-- =====================================================

-- Create trigger function
CREATE OR REPLACE FUNCTION public.update_best_pro_master_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_pro_master_rank if current position is better (lower number = better)
  -- or if best_pro_master_rank is NULL
  IF NEW.pro_master_rank_position IS NOT NULL THEN
    IF OLD.best_pro_master_rank IS NULL OR NEW.pro_master_rank_position < OLD.best_pro_master_rank THEN
      NEW.best_pro_master_rank := NEW.pro_master_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on players table
DROP TRIGGER IF EXISTS trigger_update_best_pro_master_rank ON public.players;

CREATE TRIGGER trigger_update_best_pro_master_rank
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION update_best_pro_master_rank();

COMMENT ON FUNCTION public.update_best_pro_master_rank IS 'Automatically updates best_pro_master_rank when pro_master_rank_position improves (gets lower)';
