-- =====================================================
-- Migration: Fixed Category Ranges System
-- Date: 2025-01-28
-- =====================================================
-- This migration implements a fixed-range category system:
-- Gold:   positions 1-20
-- Silver: positions 21-40
-- Bronze: positions 41-60
--
-- This eliminates the need for dynamic counters and makes
-- the system much simpler and more predictable.
-- =====================================================

-- =====================================================
-- STEP 1: Update get_category_by_position
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_category_by_position(rank_position integer)
RETURNS text
LANGUAGE plpgsql
AS $$
BEGIN
  IF rank_position >= 1 AND rank_position <= 20 THEN
    RETURN 'gold';
  ELSIF rank_position >= 21 AND rank_position <= 40 THEN
    RETURN 'silver';
  ELSIF rank_position >= 41 AND rank_position <= 60 THEN
    RETURN 'bronze';
  ELSE
    RETURN 'unranked';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_category_by_position IS
'Returns category based on fixed ranges: Gold (1-20), Silver (21-40), Bronze (41-60)';

-- =====================================================
-- STEP 2: Update get_category_position
-- =====================================================
CREATE OR REPLACE FUNCTION public.get_category_position(
  p_live_rank_position INTEGER,
  p_live_rank_category TEXT,
  p_championship_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  -- Calculate relative position based on fixed category ranges
  CASE p_live_rank_category
    WHEN 'gold' THEN
      -- Gold: positions 1-20, relative position is same as global
      RETURN p_live_rank_position;

    WHEN 'silver' THEN
      -- Silver: positions 21-40, relative position is global - 20
      RETURN p_live_rank_position - 20;

    WHEN 'bronze' THEN
      -- Bronze: positions 41-60, relative position is global - 40
      RETURN p_live_rank_position - 40;

    ELSE
      -- Unknown category: return original position
      RETURN p_live_rank_position;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_category_position IS
'Returns category-relative position based on fixed ranges. No need for championship counters.';

-- =====================================================
-- STEP 3: Update approve_registration_request
-- =====================================================
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
  category_range_start INTEGER;
  category_range_end INTEGER;
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

  -- Determine category range based on fixed ranges
  CASE target_category
    WHEN 'gold' THEN
      category_range_start := 1;
      category_range_end := 20;
    WHEN 'silver' THEN
      category_range_start := 21;
      category_range_end := 40;
    WHEN 'bronze' THEN
      category_range_start := 41;
      category_range_end := 60;
  END CASE;

  -- Find last position in target category range
  SELECT COALESCE(MAX(live_rank_position), category_range_start - 1) INTO last_position
  FROM public.players
  WHERE championship_id = request_record.championship_id
  AND live_rank_position >= category_range_start
  AND live_rank_position <= category_range_end;

  new_position := last_position + 1;

  -- Check if category is full
  IF new_position > category_range_end THEN
    RETURN json_build_object(
      'success', false,
      'message', format('Category %s is full (max 20 players)', target_category)
    );
  END IF;

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

COMMENT ON FUNCTION public.approve_registration_request IS
'Admin function to approve registration. Uses fixed category ranges (Gold 1-20, Silver 21-40, Bronze 41-60).';

-- =====================================================
-- STEP 4: Update process_category_swaps
-- =====================================================
CREATE OR REPLACE FUNCTION public.process_category_swaps(target_championship_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  gold_count INTEGER;
  silver_count INTEGER;
  bronze_count INTEGER;

  gold_last_3_ids UUID[];
  silver_first_3_ids UUID[];
  silver_last_3_ids UUID[];
  bronze_first_3_ids UUID[];

  gold_last_3_positions INTEGER[];
  silver_first_3_positions INTEGER[];
  silver_last_3_positions INTEGER[];
  bronze_first_3_positions INTEGER[];

  swaps_performed INTEGER := 0;
  i INTEGER;
BEGIN
  -- Get player counts for each category
  SELECT gold_players_count, silver_players_count, bronze_players_count
  INTO gold_count, silver_count, bronze_count
  FROM public.championships
  WHERE id = target_championship_id;

  -- =====================================================
  -- SWAP GOLD ↔ SILVER
  -- =====================================================

  IF gold_count >= 3 AND silver_count >= 3 THEN
    -- Get last 3 Gold players in ASCENDING order (to maintain order)
    SELECT ARRAY_AGG(id ORDER BY live_rank_position ASC),
           ARRAY_AGG(live_rank_position ORDER BY live_rank_position ASC)
    INTO gold_last_3_ids, gold_last_3_positions
    FROM (
      SELECT id, live_rank_position
      FROM public.players
      WHERE championship_id = target_championship_id
        AND live_rank_category = 'gold'
      ORDER BY live_rank_position DESC
      LIMIT 3
    ) subquery;

    -- Get first 3 Silver players in ASCENDING order
    SELECT ARRAY_AGG(id ORDER BY live_rank_position ASC),
           ARRAY_AGG(live_rank_position ORDER BY live_rank_position ASC)
    INTO silver_first_3_ids, silver_first_3_positions
    FROM (
      SELECT id, live_rank_position
      FROM public.players
      WHERE championship_id = target_championship_id
        AND live_rank_category = 'silver'
      ORDER BY live_rank_position ASC
      LIMIT 3
    ) subquery;

    -- Perform swaps
    IF array_length(gold_last_3_ids, 1) = 3 AND array_length(silver_first_3_ids, 1) = 3 THEN
      FOR i IN 1..3 LOOP
        -- Silver player takes Gold position
        UPDATE public.players
        SET
          live_rank_position = gold_last_3_positions[i],
          live_rank_category = 'gold',
          updated_at = now()
        WHERE id = silver_first_3_ids[i];

        -- Gold player takes Silver position
        UPDATE public.players
        SET
          live_rank_position = silver_first_3_positions[i],
          live_rank_category = 'silver',
          updated_at = now()
        WHERE id = gold_last_3_ids[i];

        swaps_performed := swaps_performed + 2;
      END LOOP;
    END IF;
  END IF;

  -- =====================================================
  -- SWAP SILVER ↔ BRONZE
  -- =====================================================

  IF silver_count >= 3 AND bronze_count >= 3 THEN
    -- Get last 3 Silver players in ASCENDING order (to maintain order)
    SELECT ARRAY_AGG(id ORDER BY live_rank_position ASC),
           ARRAY_AGG(live_rank_position ORDER BY live_rank_position ASC)
    INTO silver_last_3_ids, silver_last_3_positions
    FROM (
      SELECT id, live_rank_position
      FROM public.players
      WHERE championship_id = target_championship_id
        AND live_rank_category = 'silver'
      ORDER BY live_rank_position DESC
      LIMIT 3
    ) subquery;

    -- Get first 3 Bronze players in ASCENDING order
    SELECT ARRAY_AGG(id ORDER BY live_rank_position ASC),
           ARRAY_AGG(live_rank_position ORDER BY live_rank_position ASC)
    INTO bronze_first_3_ids, bronze_first_3_positions
    FROM (
      SELECT id, live_rank_position
      FROM public.players
      WHERE championship_id = target_championship_id
        AND live_rank_category = 'bronze'
      ORDER BY live_rank_position ASC
      LIMIT 3
    ) subquery;

    -- Perform swaps
    IF array_length(silver_last_3_ids, 1) = 3 AND array_length(bronze_first_3_ids, 1) = 3 THEN
      FOR i IN 1..3 LOOP
        -- Bronze player takes Silver position
        UPDATE public.players
        SET
          live_rank_position = silver_last_3_positions[i],
          live_rank_category = 'silver',
          updated_at = now()
        WHERE id = bronze_first_3_ids[i];

        -- Silver player takes Bronze position
        UPDATE public.players
        SET
          live_rank_position = bronze_first_3_positions[i],
          live_rank_category = 'bronze',
          updated_at = now()
        WHERE id = silver_last_3_ids[i];

        swaps_performed := swaps_performed + 2;
      END LOOP;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Category swaps completed successfully',
    'swaps_performed', swaps_performed,
    'details', json_build_object(
      'gold_count', gold_count,
      'silver_count', silver_count,
      'bronze_count', bronze_count,
      'gold_silver_swaps', CASE WHEN array_length(gold_last_3_ids, 1) = 3 THEN 6 ELSE 0 END,
      'silver_bronze_swaps', CASE WHEN array_length(silver_last_3_ids, 1) = 3 THEN 6 ELSE 0 END,
      'gold_last_positions', gold_last_3_positions,
      'silver_first_positions', silver_first_3_positions,
      'silver_last_positions', silver_last_3_positions,
      'bronze_first_positions', bronze_first_3_positions
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error performing category swaps: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.process_category_swaps IS
'Swaps last 3 players of each category with first 3 of next category. Maintains player order during swap.';
