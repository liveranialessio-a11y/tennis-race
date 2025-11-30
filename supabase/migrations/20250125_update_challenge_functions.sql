-- =====================================================
-- Update can_user_create_challenge to include launched challenges
-- and add functions for challenge management
-- =====================================================

-- Drop and recreate the can_user_create_challenge function
DROP FUNCTION IF EXISTS public.can_user_create_challenge(UUID, UUID) CASCADE;

CREATE OR REPLACE FUNCTION public.can_user_create_challenge(
  p_user_id UUID,
  p_championship_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_future_challenges INTEGER;
  v_has_matches_to_register INTEGER;
  v_has_launched_challenges INTEGER;
BEGIN
  -- Check for future scheduled challenges (programmata status)
  SELECT COUNT(*)
  INTO v_has_future_challenges
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at > NOW();

  -- Check for past matches that need to be registered
  SELECT COUNT(*)
  INTO v_has_matches_to_register
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at <= NOW();

  -- Check for launched or accepted challenges (lanciata or accettata status)
  SELECT COUNT(*)
  INTO v_has_launched_challenges
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND challenge_status IN ('lanciata', 'accettata');

  -- User can create challenge only if all counts are zero
  RETURN (v_has_future_challenges = 0 AND v_has_matches_to_register = 0 AND v_has_launched_challenges = 0);
END;
$$;

COMMENT ON FUNCTION public.can_user_create_challenge(UUID, UUID) IS
'Checks if a user can create a new challenge. Returns false if user has pending scheduled challenges, matches to register, or launched/accepted challenges.';

-- =====================================================
-- Function to accept a challenge
-- =====================================================
CREATE OR REPLACE FUNCTION public.accept_challenge(
  p_challenge_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
  v_result JSON;
BEGIN
  -- Get the challenge
  SELECT * INTO v_challenge
  FROM public.matches
  WHERE id = p_challenge_id
    AND challenge_status = 'lanciata';

  -- Check if challenge exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sfida non trovata o già accettata'
    );
  END IF;

  -- Check if user is the opponent (not the launcher)
  IF v_challenge.challenge_launcher_id = p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non puoi accettare la tua stessa sfida'
    );
  END IF;

  -- Check if user is involved in the challenge
  IF v_challenge.winner_id != p_user_id AND v_challenge.loser_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non sei coinvolto in questa sfida'
    );
  END IF;

  -- Update challenge status to 'accettata'
  UPDATE public.matches
  SET challenge_status = 'accettata',
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Sfida accettata con successo'
  );
END;
$$;

COMMENT ON FUNCTION public.accept_challenge(UUID, UUID) IS
'Accepts a launched challenge. Only the opponent (not the launcher) can accept.';

-- =====================================================
-- Function to reject/decline a challenge
-- =====================================================
CREATE OR REPLACE FUNCTION public.reject_challenge(
  p_challenge_id UUID,
  p_user_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  -- Get the challenge
  SELECT * INTO v_challenge
  FROM public.matches
  WHERE id = p_challenge_id
    AND challenge_status = 'lanciata';

  -- Check if challenge exists
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sfida non trovata o già accettata'
    );
  END IF;

  -- Check if user is the opponent (not the launcher)
  IF v_challenge.challenge_launcher_id = p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non puoi rifiutare la tua stessa sfida (usa elimina)'
    );
  END IF;

  -- Check if user is involved in the challenge
  IF v_challenge.winner_id != p_user_id AND v_challenge.loser_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non sei coinvolto in questa sfida'
    );
  END IF;

  -- Delete the challenge
  DELETE FROM public.matches
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Sfida rifiutata con successo'
  );
END;
$$;

COMMENT ON FUNCTION public.reject_challenge(UUID, UUID) IS
'Rejects/declines a launched challenge. Only the opponent (not the launcher) can reject. Deletes the challenge record.';

-- =====================================================
-- Function to set date/time for an accepted challenge
-- =====================================================
CREATE OR REPLACE FUNCTION public.set_challenge_datetime(
  p_challenge_id UUID,
  p_user_id UUID,
  p_datetime TIMESTAMP WITH TIME ZONE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  -- Get the challenge
  SELECT * INTO v_challenge
  FROM public.matches
  WHERE id = p_challenge_id
    AND challenge_status = 'accettata';

  -- Check if challenge exists and is in accepted status
  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Sfida non trovata o non ancora accettata'
    );
  END IF;

  -- Check if user is involved in the challenge
  IF v_challenge.winner_id != p_user_id AND v_challenge.loser_id != p_user_id THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non sei coinvolto in questa sfida'
    );
  END IF;

  -- Check if datetime is in the future
  IF p_datetime <= NOW() THEN
    RETURN json_build_object(
      'success', false,
      'error', 'La data deve essere futura'
    );
  END IF;

  -- Update challenge to scheduled status
  UPDATE public.matches
  SET challenge_status = NULL,
      is_scheduled = true,
      played_at = p_datetime,
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Data e ora impostate con successo'
  );
END;
$$;

COMMENT ON FUNCTION public.set_challenge_datetime(UUID, UUID, TIMESTAMP WITH TIME ZONE) IS
'Sets the date and time for an accepted challenge. Changes status from accettata to programmata (is_scheduled = true).';

-- =====================================================
-- Function to check if user can delete a challenge
-- =====================================================
CREATE OR REPLACE FUNCTION public.can_delete_challenge(
  p_challenge_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_challenge RECORD;
BEGIN
  -- Get the challenge
  SELECT * INTO v_challenge
  FROM public.matches
  WHERE id = p_challenge_id;

  -- Check if challenge exists
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check if user is involved
  IF v_challenge.winner_id != p_user_id AND v_challenge.loser_id != p_user_id THEN
    RETURN false;
  END IF;

  -- Lanciata: only launcher can delete
  IF v_challenge.challenge_status = 'lanciata' THEN
    RETURN v_challenge.challenge_launcher_id = p_user_id;
  END IF;

  -- Accettata or Programmata (is_scheduled = true): both can delete
  IF v_challenge.challenge_status = 'accettata' OR v_challenge.is_scheduled = true THEN
    RETURN true;
  END IF;

  -- Default: cannot delete
  RETURN false;
END;
$$;

COMMENT ON FUNCTION public.can_delete_challenge(UUID, UUID) IS
'Checks if a user can delete a challenge. Lanciata: only launcher. Accettata/Programmata: both players.';
