-- =====================================================
-- Migration: Fix inactivity demotion swap algorithm bug
-- Date: 2025-01-26
-- =====================================================
-- PROBLEMA: La funzione calculate_inactivity_demotion aggiornava
--           relative_position dopo ogni swap, causando swap multipli
--           consecutivi invece di un singolo swap per giocatore inattivo.
--
-- ESEMPIO DEL BUG:
--   Input:  1° Alessio (inattivo), 2° Riccardo (attivo), 3° P13 (inattivo),
--           4° P5 (inattivo), 5° P11 (attivo), 6° P9 (inattivo), 7° Matteo (attivo)
--
--   Output atteso: 1° Riccardo, 2° Alessio, 3° P11, 4° P13, 5° P5, 6° Matteo, 7° P9
--   Output bugato:  1° Riccardo, 2° Alessio, 3° P11, 4° Matteo, 5° P13, 6° P10, 7° P5
--
-- CAUSA: Dopo lo swap Alessio<->Riccardo, il sistema aggiornava relative_position
--        e quindi quando cercava "il primo attivo sotto P13 (pos 3)", guardava
--        le posizioni già modificate invece di quelle originali.
--
-- FIX: NON aggiornare relative_position durante il loop.
--      relative_position = posizione ORIGINALE (non cambia mai)
--      new_relative_position = posizione FINALE (viene calcolata dagli swap)
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
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;
BEGIN
  -- Leggiamo i contatori reali dal championship
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
    -- Calcolo dinamico dei range in base ai contatori reali
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

    -- ✅ ALGORITMO CORRETTO: Ogni inattivo viene sorpassato dal primo attivo sotto di lui
    -- IMPORTANTE: relative_position NON viene mai modificata (rimane sempre la posizione originale)
    --             new_relative_position viene aggiornata durante gli swap
    DECLARE
      inactive_rec RECORD;
      first_active_below_pos INTEGER;
      first_active_below_new_pos INTEGER;
      swap_target_id UUID;
    BEGIN
      -- Per ogni inattivo (ordinato per posizione ORIGINALE)
      FOR inactive_rec IN
        SELECT id, relative_position, new_relative_position, display_name
        FROM temp_players
        WHERE is_inactive = true
        ORDER BY relative_position ASC
      LOOP
        -- Trova il primo attivo sotto questo inattivo usando le posizioni ORIGINALI
        SELECT id, relative_position, new_relative_position
        INTO swap_target_id, first_active_below_pos, first_active_below_new_pos
        FROM temp_players
        WHERE is_inactive = false
          AND relative_position > inactive_rec.relative_position  -- ← Usa sempre relative_position (originale)!
        ORDER BY relative_position ASC
        LIMIT 1;

        -- Se esiste un attivo sotto, scambiali
        IF swap_target_id IS NOT NULL THEN
          -- Swap: attivo prende la posizione CORRENTE dell'inattivo (new_relative_position)
          UPDATE temp_players
          SET new_relative_position = inactive_rec.new_relative_position
          WHERE id = swap_target_id;

          -- Inattivo scende alla posizione CORRENTE dell'attivo (new_relative_position)
          UPDATE temp_players
          SET new_relative_position = first_active_below_new_pos
          WHERE id = inactive_rec.id;

          -- ⭐ NON aggiorniamo relative_position! Rimane sempre la posizione originale
        END IF;
      END LOOP;
    END;

    -- Converti le posizioni relative in posizioni globali usando i range dinamici
    UPDATE temp_players
    SET new_relative_position = category_min_pos + new_relative_position - 1
    WHERE TRUE;

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

COMMENT ON FUNCTION public.calculate_inactivity_demotion IS 'Retrocede giocatori inattivi (< min_matches_required partite). Ogni inattivo viene sorpassato dal primo attivo sotto di lui nella classifica. IMPORTANTE: usa sempre le posizioni ORIGINALI (relative_position) per determinare gli swap, non quelle aggiornate. I range di posizioni sono calcolati dinamicamente in base a gold_players_count, silver_players_count, bronze_players_count.';
