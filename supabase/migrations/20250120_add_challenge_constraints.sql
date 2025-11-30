-- =====================================================
-- Add constraints to prevent multiple pending challenges
-- =====================================================
-- Prevents users from creating new challenges if they have:
-- 1. An existing scheduled challenge (is_scheduled = true AND played_at > now())
-- 2. A match to register (is_scheduled = true AND played_at <= now())
-- =====================================================

-- Function to check if user can create a new challenge
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
BEGIN
  -- Check for future scheduled challenges
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

  -- User can create challenge only if both counts are zero
  RETURN (v_has_future_challenges = 0 AND v_has_matches_to_register = 0);
END;
$$;

-- Comment on function
COMMENT ON FUNCTION public.can_user_create_challenge(UUID, UUID) IS
'Checks if a user can create a new challenge. Returns false if user has pending scheduled challenges or matches to register.';

-- Drop existing policy if exists (for users creating matches)
DROP POLICY IF EXISTS "Users can create matches they're involved in" ON public.matches;

-- Recreate policy with new constraint for scheduled matches
CREATE POLICY "Users can create matches they're involved in" ON public.matches
  FOR INSERT WITH CHECK (
    (winner_id = auth.uid() OR loser_id = auth.uid()) AND
    (
      -- If it's NOT a scheduled match (is_scheduled = false or NULL), allow it
      (COALESCE(is_scheduled, false) = false) OR
      -- If it IS a scheduled match, check if BOTH users can create challenges
      (is_scheduled = true AND
       public.can_user_create_challenge(auth.uid(), championship_id) AND
       public.can_user_create_challenge(
         CASE
           WHEN winner_id = auth.uid() THEN loser_id
           ELSE winner_id
         END,
         championship_id
       ))
    )
  );

-- Comment on policy
COMMENT ON POLICY "Users can create matches they're involved in" ON public.matches IS
'Users can create completed matches freely, but can only create scheduled challenges if BOTH players (creator and opponent) have no pending challenges or matches to register.';
