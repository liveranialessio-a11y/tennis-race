-- =====================================================
-- TEST per verificare l'algoritmo di inactivity demotion
-- =====================================================

-- =====================================================
-- SCENARIO 1: Tutti inattivi
-- Expected: Nessun cambio di posizione
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 1: Tutti inattivi (Gold)';
  RAISE NOTICE '========================================';

  -- Simula: Tutti i Gold hanno 0 matches
  UPDATE players
  SET matches_this_month = 0
  WHERE live_rank_category = 'gold';

  RAISE NOTICE 'Prima della demolition:';
END $$;

SELECT
  'BEFORE' as momento,
  live_rank_position,
  display_name,
  matches_this_month
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- Esegui demolition
SELECT calculate_inactivity_demotion(
  (SELECT id FROM championships LIMIT 1),
  NULL,
  2
);

SELECT
  'AFTER' as momento,
  live_rank_position,
  display_name,
  matches_this_month
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- =====================================================
-- SCENARIO 2: Mix attivi/inattivi
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 2: Mix attivi/inattivi (Gold)';
  RAISE NOTICE 'Expected: Alessio e Matteo rimangono pos 1-2, gli altri 3-12';
  RAISE NOTICE '========================================';

  -- Ripristina stato iniziale
  UPDATE players
  SET matches_this_month = 0
  WHERE live_rank_category = 'gold';

  -- Simula: Solo Alessio e Matteo attivi
  UPDATE players
  SET matches_this_month = 2
  WHERE display_name IN ('Alessio Liverani', 'Matteo  Liverani')
    AND live_rank_category = 'gold';

  RAISE NOTICE 'Prima della demolition:';
END $$;

SELECT
  'BEFORE' as momento,
  live_rank_position,
  display_name,
  matches_this_month,
  CASE WHEN matches_this_month >= 2 THEN 'ATTIVO' ELSE 'INATTIVO' END as status
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- Esegui demolition
SELECT calculate_inactivity_demotion(
  (SELECT id FROM championships LIMIT 1),
  NULL,
  2
);

SELECT
  'AFTER' as momento,
  live_rank_position,
  display_name,
  matches_this_month,
  CASE WHEN matches_this_month >= 2 THEN 'ATTIVO' ELSE 'INATTIVO' END as status
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- =====================================================
-- SCENARIO 3: Solo ultimi inattivi
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'TEST 3: Solo ultimi inattivi (Gold)';
  RAISE NOTICE 'Expected: Pos 1-9 invariate, Pos 10-12 invariate (già in fondo)';
  RAISE NOTICE '========================================';

  -- Simula: Pos 1-9 attivi, Pos 10-12 inattivi
  UPDATE players
  SET matches_this_month = 2
  WHERE live_rank_category = 'gold'
    AND live_rank_position <= 9;

  UPDATE players
  SET matches_this_month = 0
  WHERE live_rank_category = 'gold'
    AND live_rank_position >= 10;

  RAISE NOTICE 'Prima della demolition:';
END $$;

SELECT
  'BEFORE' as momento,
  live_rank_position,
  display_name,
  matches_this_month,
  CASE WHEN matches_this_month >= 2 THEN 'ATTIVO' ELSE 'INATTIVO' END as status
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- Esegui demolition
SELECT calculate_inactivity_demotion(
  (SELECT id FROM championships LIMIT 1),
  NULL,
  2
);

SELECT
  'AFTER' as momento,
  live_rank_position,
  display_name,
  matches_this_month,
  CASE WHEN matches_this_month >= 2 THEN 'ATTIVO' ELSE 'INATTIVO' END as status
FROM players
WHERE live_rank_category = 'gold'
ORDER BY live_rank_position;

-- =====================================================
-- RIPRISTINO STATO ORIGINALE
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Ripristino stato originale...';
  RAISE NOTICE '========================================';

  -- Ripristina i matches_this_month ai valori reali
  UPDATE players
  SET matches_this_month = CASE display_name
    WHEN 'Alessio Liverani' THEN 1
    WHEN 'Matteo  Liverani' THEN 1
    ELSE 0
  END
  WHERE live_rank_category = 'gold';
END $$;
