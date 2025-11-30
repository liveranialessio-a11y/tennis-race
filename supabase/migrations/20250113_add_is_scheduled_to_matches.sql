-- =====================================================
-- Add is_scheduled column to matches table
-- Fixes: Challenge creation error in Challenges.tsx
-- =====================================================

-- Add is_scheduled column to matches table
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS is_scheduled BOOLEAN NOT NULL DEFAULT false;

-- Create index for faster queries on scheduled matches
CREATE INDEX IF NOT EXISTS idx_matches_is_scheduled
ON public.matches(is_scheduled);

-- Create index for scheduled matches by championship
CREATE INDEX IF NOT EXISTS idx_matches_scheduled_championship
ON public.matches(championship_id, is_scheduled)
WHERE is_scheduled = true;

COMMENT ON COLUMN public.matches.is_scheduled IS 'Indicates if this is a scheduled future match (true) or a completed match (false)';
