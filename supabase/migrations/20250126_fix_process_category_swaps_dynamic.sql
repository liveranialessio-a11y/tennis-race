-- =====================================================
-- Migration: Fix process_category_swaps to use dynamic positions
-- Date: 2025-01-26
-- =====================================================
-- PROBLEMA: La funzione era hardcoded con posizioni fisse (8-10, 18-20)
--           invece di usare i contatori dinamici.
--
-- ESEMPIO:
-- Gold (12 giocatori): ultime 3 posizioni = 10°, 11°, 12°
-- Silver (8 giocatori): prime 3 posizioni = 1°, 2°, 3° (globali: 13°, 14°, 15°)
--
-- DOPO SWAP:
-- Gold ultime 3: 10° (ex 1° silver), 11° (ex 2° silver), 12° (ex 3° silver)
-- Silver prime 3: 1° (ex 10° gold), 2° (ex 11° gold), 3° (ex 12° gold)
-- =====================================================

CREATE OR REPLACE FUNCTION public.process_category_swaps(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;

  -- Posizioni globali delle ultime 3 posizioni Gold
  gold_last_3_start INTEGER;
  gold_last_3_ids UUID[];

  -- Posizioni globali delle prime 3 posizioni Silver
  silver_first_3_start INTEGER;
  silver_first_3_ids UUID[];

  -- Posizioni globali delle ultime 3 posizioni Silver
  silver_last_3_start INTEGER;
  silver_last_3_ids UUID[];

  -- Posizioni globali delle prime 3 posizioni Bronze
  bronze_first_3_start INTEGER;
  bronze_first_3_ids UUID[];

  swaps_performed INTEGER := 0;
  i INTEGER;
BEGIN
  -- Leggi i contatori dal championship
  SELECT gold_players_count, silver_players_count, bronze_players_count
  INTO v_gold_count, v_silver_count, v_bronze_count
  FROM public.championships
  WHERE id = target_championship_id;

  IF v_gold_count IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Championship not found'
    );
  END IF;

  -- =====================================================
  -- SWAP GOLD ↔ SILVER
  -- =====================================================
  -- Ultime 3 posizioni Gold: (gold_count - 2), (gold_count - 1), gold_count
  -- Prime 3 posizioni Silver (globali): (gold_count + 1), (gold_count + 2), (gold_count + 3)

  gold_last_3_start := v_gold_count - 2;
  silver_first_3_start := v_gold_count + 1;

  -- Recupera gli ID delle ultime 3 posizioni Gold
  gold_last_3_ids := ARRAY(
    SELECT id
    FROM public.players
    WHERE championship_id = target_championship_id
      AND live_rank_position >= gold_last_3_start
      AND live_rank_position <= v_gold_count
    ORDER BY live_rank_position ASC
  );

  -- Recupera gli ID delle prime 3 posizioni Silver
  silver_first_3_ids := ARRAY(
    SELECT id
    FROM public.players
    WHERE championship_id = target_championship_id
      AND live_rank_position >= silver_first_3_start
      AND live_rank_position <= silver_first_3_start + 2
    ORDER BY live_rank_position ASC
  );

  -- Esegui gli swap Gold ↔ Silver
  IF array_length(gold_last_3_ids, 1) = 3 AND array_length(silver_first_3_ids, 1) = 3 THEN
    FOR i IN 1..3 LOOP
      -- Silver prende la posizione Gold
      UPDATE public.players
      SET
        live_rank_position = gold_last_3_start + i - 1,
        live_rank_category = 'gold',
        updated_at = now()
      WHERE id = silver_first_3_ids[i];

      -- Gold prende la posizione Silver
      UPDATE public.players
      SET
        live_rank_position = silver_first_3_start + i - 1,
        live_rank_category = 'silver',
        updated_at = now()
      WHERE id = gold_last_3_ids[i];

      swaps_performed := swaps_performed + 2;
    END LOOP;
  END IF;

  -- =====================================================
  -- SWAP SILVER ↔ BRONZE
  -- =====================================================
  -- Ultime 3 posizioni Silver: (gold + silver - 2), (gold + silver - 1), (gold + silver)
  -- Prime 3 posizioni Bronze (globali): (gold + silver + 1), (gold + silver + 2), (gold + silver + 3)

  silver_last_3_start := v_gold_count + v_silver_count - 2;
  bronze_first_3_start := v_gold_count + v_silver_count + 1;

  -- Recupera gli ID delle ultime 3 posizioni Silver
  silver_last_3_ids := ARRAY(
    SELECT id
    FROM public.players
    WHERE championship_id = target_championship_id
      AND live_rank_position >= silver_last_3_start
      AND live_rank_position <= v_gold_count + v_silver_count
    ORDER BY live_rank_position ASC
  );

  -- Recupera gli ID delle prime 3 posizioni Bronze
  bronze_first_3_ids := ARRAY(
    SELECT id
    FROM public.players
    WHERE championship_id = target_championship_id
      AND live_rank_position >= bronze_first_3_start
      AND live_rank_position <= bronze_first_3_start + 2
    ORDER BY live_rank_position ASC
  );

  -- Esegui gli swap Silver ↔ Bronze
  IF array_length(silver_last_3_ids, 1) = 3 AND array_length(bronze_first_3_ids, 1) = 3 THEN
    FOR i IN 1..3 LOOP
      -- Bronze prende la posizione Silver
      UPDATE public.players
      SET
        live_rank_position = silver_last_3_start + i - 1,
        live_rank_category = 'silver',
        updated_at = now()
      WHERE id = bronze_first_3_ids[i];

      -- Silver prende la posizione Bronze
      UPDATE public.players
      SET
        live_rank_position = bronze_first_3_start + i - 1,
        live_rank_category = 'bronze',
        updated_at = now()
      WHERE id = silver_last_3_ids[i];

      swaps_performed := swaps_performed + 2;
    END LOOP;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Category swaps completed successfully',
    'swaps_performed', swaps_performed,
    'details', json_build_object(
      'gold_silver_swaps', CASE WHEN array_length(gold_last_3_ids, 1) = 3 THEN 6 ELSE 0 END,
      'silver_bronze_swaps', CASE WHEN array_length(silver_last_3_ids, 1) = 3 THEN 6 ELSE 0 END,
      'gold_count', v_gold_count,
      'silver_count', v_silver_count,
      'bronze_count', v_bronze_count,
      'gold_last_3_positions', json_build_array(gold_last_3_start, gold_last_3_start + 1, gold_last_3_start + 2),
      'silver_first_3_positions', json_build_array(silver_first_3_start, silver_first_3_start + 1, silver_first_3_start + 2),
      'silver_last_3_positions', json_build_array(silver_last_3_start, silver_last_3_start + 1, silver_last_3_start + 2),
      'bronze_first_3_positions', json_build_array(bronze_first_3_start, bronze_first_3_start + 1, bronze_first_3_start + 2)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error performing category swaps: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.process_category_swaps IS 'Admin function to swap positions between categories. DINAMICO: calcola automaticamente ultime 3 posizioni di ogni categoria e prime 3 della successiva in base a gold_players_count, silver_players_count, bronze_players_count. Esempio: se Gold ha 12 giocatori, scambia pos 10-11-12 (Gold) con pos 13-14-15 (Silver primi 3).';
