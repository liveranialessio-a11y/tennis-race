-- =====================================================
-- REGISTRATION REQUESTS SYSTEM
-- =====================================================
-- Sistema per gestire le richieste di registrazione degli utenti
-- L'admin può approvare (e collocare in una categoria) o rifiutare
-- =====================================================

-- =====================================================
-- STEP 1: Create registration_requests table
-- =====================================================
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  phone TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, championship_id)
);

-- Create index for faster queries
CREATE INDEX idx_registration_requests_status ON public.registration_requests(status);
CREATE INDEX idx_registration_requests_championship ON public.registration_requests(championship_id);
CREATE INDEX idx_registration_requests_user ON public.registration_requests(user_id);

-- Enable RLS
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Users can view their own requests
CREATE POLICY "Users can view their own registration requests"
ON public.registration_requests
FOR SELECT
USING (user_id = auth.uid());

-- Users can insert their own requests
CREATE POLICY "Users can create registration requests"
ON public.registration_requests
FOR INSERT
WITH CHECK (user_id = auth.uid() AND status = 'pending');

-- Admins can view all requests for their championships
CREATE POLICY "Admins can view registration requests for their championships"
ON public.registration_requests
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = registration_requests.championship_id
    AND championships.admin_id = auth.uid()
  )
);

-- Admins can update requests for their championships
CREATE POLICY "Admins can update registration requests for their championships"
ON public.registration_requests
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = registration_requests.championship_id
    AND championships.admin_id = auth.uid()
  )
);

-- Trigger for updated_at
CREATE TRIGGER update_registration_requests_updated_at
  BEFORE UPDATE ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================
-- STEP 2: Function to approve and place user in ranking
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

  -- Verify caller is the championship admin
  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  IF championship_admin != auth.uid() THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: You are not the admin of this championship'
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

  -- Get the last position in the target category
  SELECT COALESCE(MAX(live_rank_position), 0) INTO last_position
  FROM public.players
  WHERE championship_id = request_record.championship_id
  AND live_rank_category = target_category;

  -- Calculate new position (last + 1)
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

-- =====================================================
-- STEP 3: Function to reject registration request
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_registration_request(
  request_id UUID,
  rejection_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
  championship_admin UUID;
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

  -- Verify caller is the championship admin
  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  IF championship_admin != auth.uid() THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: You are not the admin of this championship'
    );
  END IF;

  -- Update the request status
  UPDATE public.registration_requests
  SET
    status = 'rejected',
    processed_at = now(),
    processed_by = auth.uid(),
    rejected_reason = rejection_reason,
    updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration rejected successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error rejecting request: ' || SQLERRM
    );
END;
$$;

-- =====================================================
-- STEP 4: Function to get default championship
-- =====================================================
-- Questa funzione ritorna il primo championship pubblico trovato
-- Puoi modificarla per implementare una logica diversa se necessario
CREATE OR REPLACE FUNCTION public.get_default_championship_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_championship_id UUID;
BEGIN
  -- Get the first public championship (you can modify this logic)
  SELECT id INTO default_championship_id
  FROM public.championships
  WHERE is_public = true
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN default_championship_id;
END;
$$;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION public.approve_registration_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_registration_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_default_championship_id TO authenticated;

-- =====================================================
-- COMMENTS
-- =====================================================
COMMENT ON TABLE public.registration_requests IS 'Stores pending registration requests from new users waiting for admin approval';
COMMENT ON FUNCTION public.approve_registration_request IS 'Admin function to approve a registration request and place the user in a specific category';
COMMENT ON FUNCTION public.reject_registration_request IS 'Admin function to reject a registration request';
COMMENT ON FUNCTION public.get_default_championship_id IS 'Returns the default championship ID for new user registrations';
