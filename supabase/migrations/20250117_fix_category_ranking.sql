-- =====================================================
-- FIX: Category Rankings - Each category has independent ranking (1-N)
-- =====================================================
-- Gold: positions 1, 2, 3, ..., 10
-- Silver: positions 1, 2, 3, ..., 10
-- Bronze: positions 1, 2, 3, ..., 10
-- =====================================================

-- Drop and recreate the approve_registration_request function
DROP FUNCTION IF EXISTS public.approve_registration_request(UUID, TEXT);

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
BEGIN
  -- Get the request details
  SELECT * INTO request_record
  FROM public.registration_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or already processed'
    );
  END IF;

  -- Verify caller is admin (check both championship admin_id AND players.is_admin)
  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  -- Check if caller is championship admin OR has is_admin = true
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

  -- Verify category is valid
  IF target_category NOT IN ('gold', 'silver', 'bronze') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid category. Must be gold, silver, or bronze'
    );
  END IF;

  -- Check if player already exists (shouldn't happen but safety check)
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

  -- Get the last position IN THE TARGET CATEGORY ONLY
  -- Each category has independent ranking: 1, 2, 3, ..., N
  SELECT COALESCE(MAX(live_rank_position), 0) INTO last_position
  FROM public.players
  WHERE championship_id = request_record.championship_id
  AND live_rank_category = target_category;

  -- Calculate new position (last + 1 within the category)
  new_position := last_position + 1;

  -- Create the player record
  INSERT INTO public.players (
    user_id,
    championship_id,
    display_name,
    phone,
    live_rank_position,
    live_rank_category,
    wins,
    losses,
    matches_played,
    pro_master_points,
    matches_this_month,
    sets_won,
    sets_lost,
    is_admin
  ) VALUES (
    request_record.user_id,
    request_record.championship_id,
    request_record.display_name,
    request_record.phone,
    new_position,
    target_category,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    false
  );

  -- Update the request status
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
    'player_category', target_category
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error approving request: ' || SQLERRM
    );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.approve_registration_request TO authenticated;

-- =====================================================
-- OPTIONAL: Fix existing rankings to follow new system
-- =====================================================
-- Uncomment and run this if you want to renumber existing players

/*
-- Reset Gold category (positions 1-N)
WITH ranked_gold AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY live_rank_position) as new_position
  FROM public.players
  WHERE championship_id = '05a1963f-7b43-4a11-83b9-1ada19d72e00'
  AND live_rank_category = 'gold'
)
UPDATE public.players p
SET live_rank_position = rg.new_position
FROM ranked_gold rg
WHERE p.id = rg.id;

-- Reset Silver category (positions 1-N)
WITH ranked_silver AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY live_rank_position) as new_position
  FROM public.players
  WHERE championship_id = '05a1963f-7b43-4a11-83b9-1ada19d72e00'
  AND live_rank_category = 'silver'
)
UPDATE public.players p
SET live_rank_position = rg.new_position
FROM ranked_silver rg
WHERE p.id = rg.id;

-- Reset Bronze category (positions 1-N)
WITH ranked_bronze AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY live_rank_position) as new_position
  FROM public.players
  WHERE championship_id = '05a1963f-7b43-4a11-83b9-1ada19d72e00'
  AND live_rank_category = 'bronze'
)
UPDATE public.players p
SET live_rank_position = rg.new_position
FROM ranked_bronze rg
WHERE p.id = rg.id;
*/

-- =====================================================
-- COMMENT
-- =====================================================
COMMENT ON FUNCTION public.approve_registration_request IS 'Admin function to approve a registration request. Each category has independent ranking (1-N)';
