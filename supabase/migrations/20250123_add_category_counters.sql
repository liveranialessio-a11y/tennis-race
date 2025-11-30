-- =====================================================
-- ADD: Category player counters to championships table
-- =====================================================
-- These counters track the number of players in each category
-- Used to calculate relative positions within categories (1-N per category)
-- =====================================================

-- Add columns to championships table
ALTER TABLE public.championships
ADD COLUMN IF NOT EXISTS gold_players_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS silver_players_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS bronze_players_count INTEGER DEFAULT 0;

-- Populate initial values based on current players
UPDATE public.championships c
SET
  gold_players_count = (
    SELECT COUNT(*)
    FROM public.players p
    WHERE p.championship_id = c.id
    AND p.live_rank_category = 'gold'
  ),
  silver_players_count = (
    SELECT COUNT(*)
    FROM public.players p
    WHERE p.championship_id = c.id
    AND p.live_rank_category = 'silver'
  ),
  bronze_players_count = (
    SELECT COUNT(*)
    FROM public.players p
    WHERE p.championship_id = c.id
    AND p.live_rank_category = 'bronze'
  );

COMMENT ON COLUMN public.championships.gold_players_count IS 'Number of players in gold category';
COMMENT ON COLUMN public.championships.silver_players_count IS 'Number of players in silver category';
COMMENT ON COLUMN public.championships.bronze_players_count IS 'Number of players in bronze category';
