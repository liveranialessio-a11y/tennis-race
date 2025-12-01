-- =====================================================
-- SCRIPT per fixare le posizioni corrotte nel database
-- =====================================================
-- Questo script ricompatta tutte le posizioni in base
-- alla categoria corretta di ogni giocatore.
-- =====================================================

DO $$
DECLARE
  v_championship_id UUID;
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;
  v_player RECORD;
  v_new_position INTEGER;
BEGIN
  -- Prendi il championship ID (assumo ci sia solo un championship)
  SELECT id INTO v_championship_id
  FROM public.championships
  LIMIT 1;

  -- Leggi i contatori attuali
  SELECT gold_players_count, silver_players_count, bronze_players_count
  INTO v_gold_count, v_silver_count, v_bronze_count
  FROM public.championships
  WHERE id = v_championship_id;

  RAISE NOTICE 'Championship ID: %', v_championship_id;
  RAISE NOTICE 'Gold players: %, Silver players: %, Bronze players: %',
    v_gold_count, v_silver_count, v_bronze_count;

  -- =====================================================
  -- STEP 1: Riassegna posizioni a Gold (1 a v_gold_count)
  -- =====================================================
  v_new_position := 1;
  FOR v_player IN
    SELECT id, display_name, live_rank_position
    FROM public.players
    WHERE championship_id = v_championship_id
      AND live_rank_category = 'gold'
    ORDER BY live_rank_position ASC
  LOOP
    UPDATE public.players
    SET live_rank_position = v_new_position,
        updated_at = now()
    WHERE id = v_player.id;

    RAISE NOTICE 'Gold: % - old pos: %, new pos: %',
      v_player.display_name, v_player.live_rank_position, v_new_position;

    v_new_position := v_new_position + 1;
  END LOOP;

  -- =====================================================
  -- STEP 2: Riassegna posizioni a Silver (v_gold_count+1 a v_gold_count+v_silver_count)
  -- =====================================================
  v_new_position := v_gold_count + 1;
  FOR v_player IN
    SELECT id, display_name, live_rank_position
    FROM public.players
    WHERE championship_id = v_championship_id
      AND live_rank_category = 'silver'
    ORDER BY live_rank_position ASC
  LOOP
    UPDATE public.players
    SET live_rank_position = v_new_position,
        updated_at = now()
    WHERE id = v_player.id;

    RAISE NOTICE 'Silver: % - old pos: %, new pos: %',
      v_player.display_name, v_player.live_rank_position, v_new_position;

    v_new_position := v_new_position + 1;
  END LOOP;

  -- =====================================================
  -- STEP 3: Riassegna posizioni a Bronze (v_gold_count+v_silver_count+1 a fine)
  -- =====================================================
  v_new_position := v_gold_count + v_silver_count + 1;
  FOR v_player IN
    SELECT id, display_name, live_rank_position
    FROM public.players
    WHERE championship_id = v_championship_id
      AND live_rank_category = 'bronze'
    ORDER BY live_rank_position ASC
  LOOP
    UPDATE public.players
    SET live_rank_position = v_new_position,
        updated_at = now()
    WHERE id = v_player.id;

    RAISE NOTICE 'Bronze: % - old pos: %, new pos: %',
      v_player.display_name, v_player.live_rank_position, v_new_position;

    v_new_position := v_new_position + 1;
  END LOOP;

  RAISE NOTICE '✅ Posizioni ricompattate con successo!';
END $$;

-- =====================================================
-- Query di verifica finale
-- =====================================================
SELECT
  display_name,
  live_rank_category,
  live_rank_position,
  matches_this_month
FROM players
ORDER BY live_rank_position;
