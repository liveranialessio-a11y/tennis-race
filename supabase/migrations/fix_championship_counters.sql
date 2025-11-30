-- =====================================================
-- Fix championship counters
-- =====================================================
-- Aggiorna i contatori gold_players_count, silver_players_count,
-- bronze_players_count in base al numero reale di giocatori
-- =====================================================

DO $$
DECLARE
  v_championship_id UUID;
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;
BEGIN
  -- Prendi il championship ID
  SELECT id INTO v_championship_id
  FROM public.championships
  LIMIT 1;

  -- Conta i giocatori reali per categoria
  SELECT
    COUNT(*) FILTER (WHERE live_rank_category = 'gold'),
    COUNT(*) FILTER (WHERE live_rank_category = 'silver'),
    COUNT(*) FILTER (WHERE live_rank_category = 'bronze')
  INTO v_gold_count, v_silver_count, v_bronze_count
  FROM public.players
  WHERE championship_id = v_championship_id;

  RAISE NOTICE 'Current counters in DB:';
  RAISE NOTICE 'Gold: %, Silver: %, Bronze: %', v_gold_count, v_silver_count, v_bronze_count;

  -- Aggiorna i contatori nel championship
  UPDATE public.championships
  SET
    gold_players_count = v_gold_count,
    silver_players_count = v_silver_count,
    bronze_players_count = v_bronze_count
  WHERE id = v_championship_id;

  RAISE NOTICE '✅ Championship counters updated!';
  RAISE NOTICE 'New values - Gold: %, Silver: %, Bronze: %', v_gold_count, v_silver_count, v_bronze_count;
END $$;

-- Verifica finale
SELECT
  gold_players_count,
  silver_players_count,
  bronze_players_count,
  (SELECT COUNT(*) FROM players WHERE live_rank_category = 'gold') as actual_gold,
  (SELECT COUNT(*) FROM players WHERE live_rank_category = 'silver') as actual_silver,
  (SELECT COUNT(*) FROM players WHERE live_rank_category = 'bronze') as actual_bronze
FROM championships
LIMIT 1;
