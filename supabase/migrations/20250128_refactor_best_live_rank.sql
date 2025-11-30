-- =====================================================
-- Migration: Refactor best_live_rank system
-- Date: 2025-01-28
-- =====================================================
-- This migration:
-- 1. Adds best_live_rank_category_position column
-- 2. Removes best_live_rank column (replaced by category position)
-- 3. Updates the trigger to use the new logic
-- =====================================================

-- Step 1: Add new column for category-relative position (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'players'
    AND column_name = 'best_live_rank_category_position'
  ) THEN
    ALTER TABLE public.players
    ADD COLUMN best_live_rank_category_position INTEGER;
  END IF;
END $$;

COMMENT ON COLUMN public.players.best_live_rank_category_position IS 'Best position ever achieved within the category (1-N per category). Updated automatically when player improves their position in the same category or moves to a better category.';

-- Step 2: Populate the new column with current data (if best_live_rank exists)
-- Calculate category position from best_live_rank and best_category
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'players'
    AND column_name = 'best_live_rank'
  ) THEN
    UPDATE public.players p
    SET best_live_rank_category_position = (
      SELECT
        CASE
          WHEN p.best_category = 'gold' THEN p.best_live_rank
          WHEN p.best_category = 'silver' THEN p.best_live_rank - c.gold_players_count
          WHEN p.best_category = 'bronze' THEN p.best_live_rank - c.gold_players_count - c.silver_players_count
          ELSE p.best_live_rank
        END
      FROM public.championships c
      WHERE c.id = p.championship_id
    )
    WHERE p.best_live_rank IS NOT NULL;
  END IF;
END $$;

-- Step 3: Drop the old trigger
DROP TRIGGER IF EXISTS trigger_update_best_live_rank ON public.players;

-- Step 4: Drop the old trigger function
DROP FUNCTION IF EXISTS public.update_best_live_rank();

-- Step 5: Create new trigger function with improved logic
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

  -- Get current category-relative position
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

  -- If no best_category yet, initialize
  IF OLD.best_category IS NULL THEN
    NEW.best_category := NEW.live_rank_category;
    NEW.best_live_rank_category_position := current_category_position;
    RETURN NEW;
  END IF;

  -- Get priority of best category
  best_category_priority := CASE OLD.best_category
    WHEN 'gold' THEN 3
    WHEN 'silver' THEN 2
    WHEN 'bronze' THEN 1
    ELSE 0
  END;

  -- Update best rank if:
  -- 1. Category improved (moved to better category), OR
  -- 2. Same category AND position improved (lower number = better)
  IF category_priority > best_category_priority THEN
    -- Category improved (e.g., Silver -> Gold)
    NEW.best_category := NEW.live_rank_category;
    NEW.best_live_rank_category_position := current_category_position;
  ELSIF category_priority = best_category_priority AND
        current_category_position < OLD.best_live_rank_category_position THEN
    -- Same category but better position (e.g., 4° G -> 3° G)
    NEW.best_live_rank_category_position := current_category_position;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.update_best_live_rank_category IS 'Updates best_live_rank_category_position when player improves position. Updates if: (1) category improves (Bronze->Silver->Gold), OR (2) same category but better position (lower number).';

-- Step 6: Drop existing trigger if exists, then create new one
DROP TRIGGER IF EXISTS trigger_update_best_live_rank_category ON public.players;

CREATE TRIGGER trigger_update_best_live_rank_category
  BEFORE UPDATE OF live_rank_position, live_rank_category ON public.players
  FOR EACH ROW
  WHEN (NEW.live_rank_position IS DISTINCT FROM OLD.live_rank_position OR
        NEW.live_rank_category IS DISTINCT FROM OLD.live_rank_category)
  EXECUTE FUNCTION update_best_live_rank_category();

-- Step 7: Remove the old best_live_rank column
ALTER TABLE public.players
DROP COLUMN IF EXISTS best_live_rank;

-- Step 8: Update approve_registration_request function to use new column
CREATE OR REPLACE FUNCTION public.approve_registration_request(
  request_id UUID,
  target_category TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
  last_position INTEGER;
  new_position INTEGER;
  championship_admin UUID;
  player_exists BOOLEAN;
  is_caller_admin BOOLEAN;
  last_pro_master_position INTEGER;
  new_pro_master_position INTEGER;
  category_position INTEGER;
BEGIN
  SELECT * INTO request_record
  FROM public.registration_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or already processed'
    );
  END IF;

  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  SELECT EXISTS(
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND is_admin = true
  ) INTO is_caller_admin;

  IF championship_admin != auth.uid() AND NOT is_caller_admin THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: You are not an admin'
    );
  END IF;

  IF target_category NOT IN ('gold', 'silver', 'bronze') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid category. Must be gold, silver, or bronze'
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.players
    WHERE user_id = request_record.user_id
    AND championship_id = request_record.championship_id
  ) INTO player_exists;

  IF player_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player already exists in this championship'
    );
  END IF;

  SELECT COALESCE(MAX(live_rank_position), 0) INTO last_position
  FROM public.players
  WHERE championship_id = request_record.championship_id
  AND live_rank_category = target_category;

  new_position := last_position + 1;

  -- Calculate category-relative position for initial best rank
  SELECT public.get_category_position(
    new_position,
    target_category,
    request_record.championship_id
  ) INTO category_position;

  SELECT COALESCE(MAX(pro_master_rank_position), 0) INTO last_pro_master_position
  FROM public.players
  WHERE championship_id = request_record.championship_id;

  new_pro_master_position := last_pro_master_position + 1;

  INSERT INTO public.players (
    user_id,
    championship_id,
    display_name,
    phone,
    live_rank_position,
    live_rank_category,
    best_live_rank_category_position,
    best_category,
    pro_master_points,
    pro_master_rank_position,
    best_pro_master_rank,
    matches_this_month,
    is_admin
  ) VALUES (
    request_record.user_id,
    request_record.championship_id,
    request_record.display_name,
    request_record.phone,
    new_position,
    target_category,
    category_position,
    target_category,
    0,
    new_pro_master_position,
    new_pro_master_position,
    0,
    false
  );

  UPDATE public.registration_requests
  SET
    status = 'approved',
    processed_at = now(),
    processed_by = auth.uid(),
    updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration approved successfully',
    'player_position', new_position,
    'player_category', target_category,
    'pro_master_position', new_pro_master_position
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error approving request: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.approve_registration_request IS 'Admin function to approve a registration request. Uses new best_live_rank_category_position instead of best_live_rank.';
