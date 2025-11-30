-- =====================================================
-- ADD LIVE_RANK TROPHY TYPE
-- =====================================================
-- This migration adds the 'live_rank' trophy type to the existing trophies table
-- =====================================================

-- Drop the existing check constraint
ALTER TABLE public.trophies
  DROP CONSTRAINT IF EXISTS trophies_trophy_type_check;

-- Add new check constraint with live_rank included
ALTER TABLE public.trophies
  ADD CONSTRAINT trophies_trophy_type_check
  CHECK (trophy_type IN ('pro_master_rank', 'live_rank', 'tournament'));

-- Drop the existing tournament_title constraint
ALTER TABLE public.trophies
  DROP CONSTRAINT IF EXISTS tournament_title_required_for_tournament;

-- Add updated constraint that allows tournament_title for both tournament and live_rank
ALTER TABLE public.trophies
  ADD CONSTRAINT tournament_title_required_for_tournament
  CHECK (
    (trophy_type = 'tournament' AND tournament_title IS NOT NULL) OR
    (trophy_type = 'live_rank' AND tournament_title IS NOT NULL) OR
    (trophy_type = 'pro_master_rank' AND tournament_title IS NULL)
  );

-- Comment
COMMENT ON CONSTRAINT tournament_title_required_for_tournament ON public.trophies
  IS 'Tournament and live_rank trophies require tournament_title, pro_master_rank must have NULL';
