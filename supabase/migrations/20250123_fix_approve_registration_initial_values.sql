-- Fix approve_registration_request to initialize best_live_rank, best_pro_master_rank, pro_master_rank_position, and best_category

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

  -- Get the last Pro Master rank position (global ranking across all players)
  -- Pro Master ranking is sorted by points DESC (more points = better position = lower number)
  -- A new player with 0 points should be placed at the end
  SELECT COALESCE(MAX(pro_master_rank_position), 0) INTO last_pro_master_position
  FROM public.players
  WHERE championship_id = request_record.championship_id;

  -- New player with 0 points gets last position
  new_pro_master_position := last_pro_master_position + 1;

  -- Create the player record with properly initialized fields
  INSERT INTO public.players (
    user_id,
    championship_id,
    display_name,
    phone,
    live_rank_position,
    live_rank_category,
    best_live_rank,           -- Initialize to current position
    best_category,            -- Initialize to assigned category
    pro_master_points,
    pro_master_rank_position, -- Initialize to last position (0 points)
    best_pro_master_rank,     -- Initialize to current pro master position
    matches_this_month,
    is_admin
  ) VALUES (
    request_record.user_id,
    request_record.championship_id,
    request_record.display_name,
    request_record.phone,
    new_position,
    target_category,
    new_position,             -- best_live_rank = current position
    target_category,          -- best_category = assigned category
    0,
    new_pro_master_position,  -- pro_master_rank_position = last position
    new_pro_master_position,  -- best_pro_master_rank = current pro master position
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
