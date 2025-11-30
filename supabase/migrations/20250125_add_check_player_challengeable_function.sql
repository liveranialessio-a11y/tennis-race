-- =====================================================
-- Function to check if a player is challengeable
-- =====================================================
-- A player is challengeable if they DON'T have:
-- 1. Launched or accepted challenges (challenge_status IN ('lanciata', 'accettata'))
-- 2. Future scheduled matches (is_scheduled = true AND played_at > NOW())
-- 3. Past matches to register (is_scheduled = true AND played_at <= NOW())
-- =====================================================

CREATE OR REPLACE FUNCTION public.is_player_challengeable(
  p_user_id UUID,
  p_championship_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_launched_or_accepted_challenges INTEGER;
  v_has_future_scheduled_matches INTEGER;
  v_has_past_matches_to_register INTEGER;
BEGIN
  -- Check for launched or accepted challenges
  SELECT COUNT(*)
  INTO v_has_launched_or_accepted_challenges
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND challenge_status IN ('lanciata', 'accettata');

  -- Check for future scheduled matches
  SELECT COUNT(*)
  INTO v_has_future_scheduled_matches
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at > NOW();

  -- Check for past matches that need to be registered
  SELECT COUNT(*)
  INTO v_has_past_matches_to_register
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at <= NOW();

  -- Player is challengeable only if all counts are zero
  RETURN (
    v_has_launched_or_accepted_challenges = 0 AND
    v_has_future_scheduled_matches = 0 AND
    v_has_past_matches_to_register = 0
  );
END;
$$;

COMMENT ON FUNCTION public.is_player_challengeable(UUID, UUID) IS
'Checks if a player can be challenged. Returns false if player has pending challenges, scheduled matches, or matches to register.';

-- =====================================================
-- Grant execute permission to authenticated users
-- =====================================================
GRANT EXECUTE ON FUNCTION public.is_player_challengeable(UUID, UUID) TO authenticated;
