-- =====================================================
-- Add challenge_status column to matches table
-- =====================================================
-- This enables the new challenge flow:
-- - 'lanciata': Challenge just created, waiting for opponent acceptance
-- - 'accettata': Opponent accepted, need to set date/time
-- - NULL: Normal match (already played) or scheduled match (is_scheduled = true)
-- =====================================================

-- Add challenge_status column
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS challenge_status TEXT;

-- Add comment
COMMENT ON COLUMN public.matches.challenge_status IS
'Status of challenge: lanciata (launched, waiting acceptance), accettata (accepted, waiting date/time), NULL (normal match or scheduled match with date)';

-- Add check constraint to ensure valid values
ALTER TABLE public.matches
ADD CONSTRAINT check_challenge_status
CHECK (challenge_status IS NULL OR challenge_status IN ('lanciata', 'accettata'));

-- Create index for faster queries on challenge_status
CREATE INDEX IF NOT EXISTS idx_matches_challenge_status
ON public.matches(challenge_status)
WHERE challenge_status IS NOT NULL;

-- Add column for tracking who launched the challenge
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS challenge_launcher_id UUID;

-- Add comment
COMMENT ON COLUMN public.matches.challenge_launcher_id IS
'User ID of the player who launched the challenge';

-- Add foreign key constraint
ALTER TABLE public.matches
ADD CONSTRAINT fk_challenge_launcher
FOREIGN KEY (challenge_launcher_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
