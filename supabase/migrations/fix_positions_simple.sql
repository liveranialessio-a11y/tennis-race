-- =====================================================
-- FIX SEMPLIFICATO: Ricompatta posizioni 1-22
-- =====================================================

-- Gold: posizioni 1-12
WITH gold_ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (ORDER BY live_rank_position ASC) as new_pos
  FROM players
  WHERE live_rank_category = 'gold'
)
UPDATE players p
SET live_rank_position = g.new_pos
FROM gold_ranked g
WHERE p.id = g.id;

-- Silver: posizioni 13-19
WITH silver_ranked AS (
  SELECT
    id,
    13 + ROW_NUMBER() OVER (ORDER BY live_rank_position ASC) - 1 as new_pos
  FROM players
  WHERE live_rank_category = 'silver'
)
UPDATE players p
SET live_rank_position = s.new_pos
FROM silver_ranked s
WHERE p.id = s.id;

-- Bronze: posizioni 20-22
WITH bronze_ranked AS (
  SELECT
    id,
    20 + ROW_NUMBER() OVER (ORDER BY live_rank_position ASC) - 1 as new_pos
  FROM players
  WHERE live_rank_category = 'bronze'
)
UPDATE players p
SET live_rank_position = b.new_pos
FROM bronze_ranked b
WHERE p.id = b.id;

-- Verifica
SELECT
  display_name,
  live_rank_category,
  live_rank_position,
  matches_this_month
FROM players
ORDER BY live_rank_position;
