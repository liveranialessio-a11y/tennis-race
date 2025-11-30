-- =====================================================
-- Create function to get user email from auth.users
-- =====================================================
-- This function safely retrieves a user's email
-- It's needed because auth.users is not directly accessible from the client
-- =====================================================

CREATE OR REPLACE FUNCTION public.get_user_email(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = p_user_id;

  RETURN v_email;
END;
$$;

COMMENT ON FUNCTION public.get_user_email(UUID) IS
'Returns the email address for a given user_id from auth.users table. Uses SECURITY DEFINER to bypass RLS.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_user_email(UUID) TO authenticated;
