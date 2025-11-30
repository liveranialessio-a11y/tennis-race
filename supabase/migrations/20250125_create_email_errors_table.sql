-- =====================================================
-- Create table to track email sending errors
-- =====================================================

CREATE TABLE IF NOT EXISTS public.email_errors (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE,
  recipient_email TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  challenge_type TEXT NOT NULL,
  error_message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_email_errors_created_at ON public.email_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_email_errors_match_id ON public.email_errors(match_id);

-- Enable RLS
ALTER TABLE public.email_errors ENABLE ROW LEVEL SECURITY;

-- Policy: Admin can see all errors
CREATE POLICY "Admin can view all email errors"
  ON public.email_errors
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid()
      AND players.is_admin = true
    )
  );

-- Policy: System can insert errors
CREATE POLICY "System can insert email errors"
  ON public.email_errors
  FOR INSERT
  WITH CHECK (true);

-- Policy: Admin can delete old errors
CREATE POLICY "Admin can delete email errors"
  ON public.email_errors
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE players.user_id = auth.uid()
      AND players.is_admin = true
    )
  );

COMMENT ON TABLE public.email_errors IS 'Tracks email sending errors for debugging and monitoring';
