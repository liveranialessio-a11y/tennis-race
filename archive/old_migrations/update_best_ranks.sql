-- =====================================================
-- UPDATE BEST RANKS AUTOMATICALLY
-- =====================================================
-- This script adds triggers to automatically update
-- best_live_rank and best_pro_master_rank when positions change
-- =====================================================

-- Function to update best_live_rank when live_rank_position changes
CREATE OR REPLACE FUNCTION public.update_best_live_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_live_rank if current position is better (lower number = better)
  -- OR if best_live_rank is NULL
  IF NEW.live_rank_position IS NOT NULL THEN
    IF OLD.best_live_rank IS NULL OR NEW.live_rank_position < OLD.best_live_rank THEN
      NEW.best_live_rank := NEW.live_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for best_live_rank
DROP TRIGGER IF EXISTS trigger_update_best_live_rank ON public.players;
CREATE TRIGGER trigger_update_best_live_rank
  BEFORE UPDATE OF live_rank_position ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_best_live_rank();

-- Function to update best_pro_master_rank based on pro_master_rank_position
CREATE OR REPLACE FUNCTION public.update_best_pro_master_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_pro_master_rank if current position is better (lower number = better)
  -- OR if best_pro_master_rank is NULL
  IF NEW.pro_master_rank_position IS NOT NULL THEN
    IF OLD.best_pro_master_rank IS NULL OR NEW.pro_master_rank_position < OLD.best_pro_master_rank THEN
      NEW.best_pro_master_rank := NEW.pro_master_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger for best_pro_master_rank
DROP TRIGGER IF EXISTS trigger_update_best_pro_master_rank ON public.players;
CREATE TRIGGER trigger_update_best_pro_master_rank
  BEFORE UPDATE OF pro_master_rank_position ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_best_pro_master_rank();

-- =====================================================
-- UPDATE PRO MASTER RANK POSITIONS
-- =====================================================
-- Function to calculate and update pro_master_rank_position
-- based on pro_master_points for all players
-- =====================================================

CREATE OR REPLACE FUNCTION public.update_pro_master_rankings(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  current_position INTEGER := 1;
  updated_count INTEGER := 0;
BEGIN
  -- Update pro_master_rank_position based on pro_master_points (descending order)
  FOR player_record IN
    SELECT
      id,
      display_name,
      pro_master_points
    FROM public.players
    WHERE championship_id = target_championship_id
    ORDER BY pro_master_points DESC, live_rank_position ASC
  LOOP
    UPDATE public.players
    SET
      pro_master_rank_position = current_position,
      updated_at = now()
    WHERE id = player_record.id;

    current_position := current_position + 1;
    updated_count := updated_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master rankings updated successfully',
    'updated_players', updated_count
  );
END;
$$;
