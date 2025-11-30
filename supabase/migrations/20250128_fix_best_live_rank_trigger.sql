-- =====================================================
-- Migration: Fix best_live_rank trigger
-- Date: 2025-01-28
-- =====================================================
-- This migration fixes the trigger that was incorrectly
-- modifying live_rank_category instead of just tracking
-- the best rank history.
-- =====================================================

-- Step 1: Drop the buggy trigger (if exists)
DROP TRIGGER IF EXISTS trigger_update_best_live_rank_category ON public.players;

-- Step 2: Drop the old function
DROP FUNCTION IF EXISTS public.update_best_live_rank_category();

-- Step 3: Create CORRECT trigger function
-- This function ONLY updates best_category and best_live_rank_category_position
-- It NEVER modifies live_rank_category (the current category)
CREATE OR REPLACE FUNCTION public.update_best_live_rank_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  current_category_position INTEGER;
  category_priority INTEGER;
  best_category_priority INTEGER;
BEGIN
  -- Only proceed if live_rank_position or live_rank_category changed
  IF NEW.live_rank_position IS NULL OR NEW.live_rank_category IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get current category-relative position using the helper function
  SELECT public.get_category_position(
    NEW.live_rank_position,
    NEW.live_rank_category,
    NEW.championship_id
  ) INTO current_category_position;

  -- Define category priority (higher = better)
  category_priority := CASE NEW.live_rank_category
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 1
    ELSE 0
  END;

  -- If no best_category yet, initialize it
  IF OLD.best_category IS NULL THEN
    NEW.best_category := NEW.live_rank_category;
    NEW.best_live_rank_category_position := current_category_position;
    RETURN NEW;
  END IF;

  -- Get priority of the STORED best category (from OLD record)
  best_category_priority := CASE OLD.best_category
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 1
    ELSE 0
  END;

  -- Update best rank ONLY if player improved:
  -- 1. Moved to a better category (Bronze->Silver->Gold), OR
  -- 2. Same category AND better position (lower number = better)

  IF category_priority > best_category_priority THEN
    -- Category improved (e.g., Bronze -> Silver or Silver -> Gold)
    -- Update the BEST category and position
    NEW.best_category := NEW.live_rank_category;
    NEW.best_live_rank_category_position := current_category_position;

  ELSIF category_priority = best_category_priority AND
        current_category_position < COALESCE(OLD.best_live_rank_category_position, 999999) THEN
    -- Same category but better position (e.g., 4° G -> 3° G)
    -- Only update the position, category stays the same
    NEW.best_live_rank_category_position := current_category_position;
    -- Keep the same best_category (don't change it)
    NEW.best_category := OLD.best_category;

  ELSE
    -- No improvement - keep the old best values
    NEW.best_category := OLD.best_category;
    NEW.best_live_rank_category_position := OLD.best_live_rank_category_position;
  END IF;

  -- IMPORTANT: We NEVER modify NEW.live_rank_category here!
  -- That field is managed by other triggers (match results, category swaps, etc.)

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_best_live_rank_category IS
'Updates best_category and best_live_rank_category_position when player improves.
Updates if: (1) category improves (Bronze->Silver->Gold), OR (2) same category but better position.
IMPORTANT: This function NEVER modifies live_rank_category (current category).';

-- Step 4: Create the trigger
CREATE TRIGGER trigger_update_best_live_rank_category
  BEFORE UPDATE OF live_rank_position, live_rank_category ON public.players
  FOR EACH ROW
  WHEN (NEW.live_rank_position IS DISTINCT FROM OLD.live_rank_position OR
        NEW.live_rank_category IS DISTINCT FROM OLD.live_rank_category)
  EXECUTE FUNCTION update_best_live_rank_category();

COMMENT ON TRIGGER trigger_update_best_live_rank_category ON public.players IS
'Automatically updates best rank history when live_rank_position or live_rank_category changes.';
