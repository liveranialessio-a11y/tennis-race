-- =====================================================
-- Migration: Fix inactivity demotion algorithm
-- Date: 2025-01-25
-- =====================================================
-- PROBLEMA: La funzione calculate_inactivity_demotion aveva 2 bug:
--
-- BUG 1: Range hardcoded (1-10, 11-20, 21-30) invece di dinamici
--        → Con 12 giocatori Gold, i Silver venivano assegnati a
--          posizioni già occupate, causando posizioni negative.
--
-- BUG 2: Algoritmo sbagliato che metteva tutti gli attivi in cima
--        e tutti gli inattivi in fondo.
--        → Esempio: [1° inattivo, 2° attivo, 3° attivo]
--          diventava [1° attivo, 2° attivo, 3° inattivo] ❌
--
-- FIX: Range dinamici + algoritmo corretto che sorpassa gli inattivi
--      uno alla volta con il primo attivo sotto di loro.
--      → Esempio: [1° inattivo, 2° attivo, 3° attivo]
--        diventa [1° attivo, 2° inattivo, 3° attivo] ✅
-- =====================================================

CREATE OR REPLACE FUNCTION public.calculate_inactivity_demotion(
  target_championship_id UUID,
  target_month DATE DEFAULT NULL,
  min_matches_required INTEGER DEFAULT 2
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  category_record RECORD;
  player_record RECORD;
  movements_array JSON[] := '{}';
  all_players_array JSON[] := '{}';
  total_movements INTEGER := 0;
  category_min_pos INTEGER;
  category_max_pos INTEGER;
  -- ✅ NUOVE VARIABILI per calcolare i range dinamicamente
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;
BEGIN
  -- ✅ Leggiamo i contatori reali dal championship
  SELECT gold_players_count, silver_players_count, bronze_players_count
  INTO v_gold_count, v_silver_count, v_bronze_count
  FROM public.championships
  WHERE id = target_championship_id;

  -- Validazione: se non troviamo il championship, errore
  IF v_gold_count IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Championship not found'
    );
  END IF;

  FOR category_record IN
    SELECT DISTINCT
      live_rank_category,
      CASE live_rank_category
        WHEN 'gold' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'bronze' THEN 3
        ELSE 4
      END as category_order
    FROM public.players
    WHERE championship_id = target_championship_id
    ORDER BY category_order
  LOOP
    -- ✅ CALCOLO DINAMICO dei range in base ai contatori reali
    CASE category_record.live_rank_category
      WHEN 'gold' THEN
        category_min_pos := 1;
        category_max_pos := v_gold_count;
      WHEN 'silver' THEN
        category_min_pos := v_gold_count + 1;
        category_max_pos := v_gold_count + v_silver_count;
      WHEN 'bronze' THEN
        category_min_pos := v_gold_count + v_silver_count + 1;
        category_max_pos := v_gold_count + v_silver_count + v_bronze_count;
      ELSE
        CONTINUE;
    END CASE;

    DROP TABLE IF EXISTS temp_players;
    CREATE TEMP TABLE temp_players AS
    SELECT
      p.id,
      p.user_id,
      p.display_name,
      p.live_rank_position as old_position,
      p.matches_this_month,
      CASE WHEN p.matches_this_month < min_matches_required THEN true ELSE false END as is_inactive,
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC) as relative_position,
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC)::INTEGER as new_relative_position
    FROM public.players p
    WHERE p.championship_id = target_championship_id
      AND p.live_rank_category = category_record.live_rank_category;

    -- 🔍 LOG: Stato iniziale
    RAISE NOTICE '=== CATEGORY: % ===', category_record.live_rank_category;
    RAISE NOTICE 'Range: % - %', category_min_pos, category_max_pos;

    -- Log dei valori iniziali
    DECLARE
      log_rec RECORD;
    BEGIN
      FOR log_rec IN
        SELECT display_name, old_position, relative_position, new_relative_position, is_inactive
        FROM temp_players
        ORDER BY relative_position
      LOOP
        RAISE NOTICE '  BEFORE: % | old_pos=% | rel_pos=% | new_rel_pos=% | inactive=%',
          log_rec.display_name, log_rec.old_position, log_rec.relative_position,
          log_rec.new_relative_position, log_rec.is_inactive;
      END LOOP;
    END;

    -- ✅ ALGORITMO CORRETTO: Ogni inattivo viene sorpassato dal primo attivo sotto di lui
    DECLARE
      inactive_rec RECORD;
      first_active_below_pos INTEGER;
      swap_target_id UUID;
      swap_counter INTEGER := 0;
    BEGIN
      -- Per ogni inattivo, cerca il primo attivo sotto di lui e scambiali
      FOR inactive_rec IN
        SELECT id, relative_position, display_name
        FROM temp_players
        WHERE is_inactive = true
        ORDER BY relative_position ASC
      LOOP
        -- Trova il primo attivo sotto questo inattivo
        SELECT id, relative_position INTO swap_target_id, first_active_below_pos
        FROM temp_players
        WHERE is_inactive = false
          AND relative_position > inactive_rec.relative_position
        ORDER BY relative_position ASC
        LIMIT 1;

        -- Se esiste un attivo sotto, scambiali
        IF swap_target_id IS NOT NULL THEN
          swap_counter := swap_counter + 1;
          RAISE NOTICE '  SWAP #%: Inactive % (rel_pos %) <-> Active at rel_pos %',
            swap_counter, inactive_rec.display_name, inactive_rec.relative_position, first_active_below_pos;

          -- Swap: attivo prende la posizione dell'inattivo
          UPDATE temp_players
          SET new_relative_position = inactive_rec.relative_position
          WHERE id = swap_target_id;

          -- Inattivo scende alla posizione dell'attivo
          UPDATE temp_players
          SET new_relative_position = first_active_below_pos
          WHERE id = inactive_rec.id;

          -- Aggiorna anche relative_position per i prossimi confronti
          UPDATE temp_players
          SET relative_position = new_relative_position
          WHERE id IN (swap_target_id, inactive_rec.id);
        END IF;
      END LOOP;
    END;

    -- 🔍 LOG: Prima della conversione globale
    RAISE NOTICE 'BEFORE global conversion (category_min_pos=%):',  category_min_pos;
    DECLARE
      log_rec RECORD;
    BEGIN
      FOR log_rec IN
        SELECT display_name, new_relative_position
        FROM temp_players
        ORDER BY new_relative_position
      LOOP
        RAISE NOTICE '  %: new_rel_pos=%', log_rec.display_name, log_rec.new_relative_position;
      END LOOP;
    END;

    -- Converti le posizioni relative in posizioni globali usando i range dinamici
    UPDATE temp_players
    SET new_relative_position = category_min_pos + new_relative_position - 1
    WHERE TRUE;

    -- 🔍 LOG: Dopo la conversione globale
    RAISE NOTICE 'AFTER global conversion:';
    DECLARE
      log_rec RECORD;
    BEGIN
      FOR log_rec IN
        SELECT display_name, new_relative_position
        FROM temp_players
        ORDER BY new_relative_position
      LOOP
        RAISE NOTICE '  %: GLOBAL pos=%', log_rec.display_name, log_rec.new_relative_position;
      END LOOP;
    END;

    -- Log dei movimenti
    FOR player_record IN SELECT * FROM temp_players ORDER BY old_position LOOP
      all_players_array := all_players_array || json_build_object(
        'name', player_record.display_name,
        'category', category_record.live_rank_category,
        'old_position', player_record.old_position,
        'new_position', player_record.new_relative_position,
        'matches_this_month', player_record.matches_this_month,
        'is_inactive', player_record.is_inactive
      );

      IF player_record.old_position != player_record.new_relative_position THEN
        movements_array := movements_array || json_build_object(
          'player', player_record.display_name,
          'category', category_record.live_rank_category,
          'from', player_record.old_position,
          'to', player_record.new_relative_position,
          'matches', player_record.matches_this_month,
          'type', CASE WHEN player_record.is_inactive THEN 'demoted' ELSE 'promoted' END
        );
        total_movements := total_movements + 1;
      END IF;
    END LOOP;

    -- Applica le nuove posizioni al database
    FOR player_record IN SELECT * FROM temp_players LOOP
      UPDATE public.players
      SET
        live_rank_position = player_record.new_relative_position,
        updated_at = now()
      WHERE id = player_record.id;
    END LOOP;

    DROP TABLE IF EXISTS temp_players;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Inactivity demotion completed - each inactive player is swapped with the first active player below them',
    'total_movements', total_movements,
    'all_players', all_players_array,
    'movements', movements_array,
    'category_ranges', json_build_object(
      'gold', json_build_object('min', 1, 'max', v_gold_count),
      'silver', json_build_object('min', v_gold_count + 1, 'max', v_gold_count + v_silver_count),
      'bronze', json_build_object('min', v_gold_count + v_silver_count + 1, 'max', v_gold_count + v_silver_count + v_bronze_count)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error in inactivity demotion: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.calculate_inactivity_demotion IS 'Retrocede giocatori inattivi (< min_matches_required partite). Ogni inattivo viene sorpassato dal primo attivo sotto di lui nella classifica. I range di posizioni sono calcolati dinamicamente in base a gold_players_count, silver_players_count, bronze_players_count.';
