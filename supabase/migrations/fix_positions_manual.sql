-- =====================================================
-- FIX MANUALE: Ricompatta posizioni 1-22
-- =====================================================

-- STEP 1: Crea tabella temporanea con nuove posizioni
CREATE TEMP TABLE temp_new_positions AS
SELECT
  p.id,
  p.display_name,
  p.live_rank_category,
  p.live_rank_position as old_position,
  CASE p.live_rank_category
    WHEN 'gold' THEN ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN p.live_rank_category = 'gold' THEN 1 END
      ORDER BY p.live_rank_position
    )
    WHEN 'silver' THEN 12 + ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN p.live_rank_category = 'silver' THEN 1 END
      ORDER BY p.live_rank_position
    )
    WHEN 'bronze' THEN 19 + ROW_NUMBER() OVER (
      PARTITION BY CASE WHEN p.live_rank_category = 'bronze' THEN 1 END
      ORDER BY p.live_rank_position
    )
  END as new_position
FROM players p;

-- STEP 2: Mostra le modifiche che verranno applicate
SELECT
  display_name,
  live_rank_category,
  old_position,
  new_position,
  new_position - old_position as diff
FROM temp_new_positions
ORDER BY new_position;

-- STEP 3: Applica le nuove posizioni
UPDATE players p
SET live_rank_position = t.new_position,
    updated_at = now()
FROM temp_new_positions t
WHERE p.id = t.id;

-- STEP 4: Verifica finale
SELECT
  display_name,
  live_rank_category,
  live_rank_position,
  matches_this_month
FROM players
ORDER BY live_rank_position;

-- Cleanup
DROP TABLE IF EXISTS temp_new_positions;
