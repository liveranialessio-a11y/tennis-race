-- =====================================================
-- Function to launch a challenge to another player
-- =====================================================
-- This function creates a new challenge (match with status 'lanciata')
-- and sends an email notification to the challenged player
-- =====================================================

CREATE OR REPLACE FUNCTION public.launch_challenge(
  p_challenger_id UUID,
  p_challenged_id UUID,
  p_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_match_id UUID;
  v_challenger_email TEXT;
  v_challenged_email TEXT;
  v_challenger_name TEXT;
  v_challenged_name TEXT;
BEGIN
  -- Check if challenger can create a challenge
  IF NOT public.can_user_create_challenge(p_challenger_id, p_championship_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Non puoi lanciare una sfida. Hai già sfide in corso, partite programmate o partite da registrare.'
    );
  END IF;

  -- Check if challenged player can be challenged
  IF NOT public.is_player_challengeable(p_challenged_id, p_championship_id) THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Questo giocatore non può essere sfidato al momento. Ha già sfide in corso, partite programmate o partite da registrare.'
    );
  END IF;

  -- Get player names and emails for the email notification
  SELECT display_name INTO v_challenger_name
  FROM public.players
  WHERE user_id = p_challenger_id AND championship_id = p_championship_id;

  SELECT display_name INTO v_challenged_name
  FROM public.players
  WHERE user_id = p_challenged_id AND championship_id = p_championship_id;

  v_challenger_email := public.get_user_email(p_challenger_id);
  v_challenged_email := public.get_user_email(p_challenged_id);

  -- Create the match record with challenge_status = 'lanciata'
  INSERT INTO public.matches (
    championship_id,
    winner_id,
    loser_id,
    score,
    is_scheduled,
    challenge_status,
    challenge_launcher_id,
    played_at,
    created_at,
    updated_at
  )
  VALUES (
    p_championship_id,
    p_challenger_id,
    p_challenged_id,
    '',  -- Empty score for now
    false,  -- Not scheduled yet
    'lanciata',
    p_challenger_id,
    NOW(),  -- Placeholder date
    NOW(),
    NOW()
  )
  RETURNING id INTO v_match_id;

  -- Note: The email will be sent by calling the send-challenge-email edge function
  -- from the frontend after this function returns successfully

  RETURN json_build_object(
    'success', true,
    'message', 'Sfida lanciata con successo',
    'match_id', v_match_id,
    'challenger_name', v_challenger_name,
    'challenged_name', v_challenged_name,
    'challenger_email', v_challenger_email,
    'challenged_email', v_challenged_email
  );
END;
$$;

COMMENT ON FUNCTION public.launch_challenge(UUID, UUID, UUID) IS
'Launches a challenge from one player to another. Creates a match with challenge_status = lanciata.';

-- =====================================================
-- Grant execute permission to authenticated users
-- =====================================================
GRANT EXECUTE ON FUNCTION public.launch_challenge(UUID, UUID, UUID) TO authenticated;
