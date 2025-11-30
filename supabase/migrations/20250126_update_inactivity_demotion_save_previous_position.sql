-- =====================================================
-- Migration: Update inactivity demotion to save previous positions
-- Date: 2025-01-26
-- =====================================================
-- Modifica calculate_inactivity_demotion per salvare la posizione
-- precedente prima di applicare i cambiamenti (per le frecce)
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

  -- ⭐ SALVA LE POSIZIONI PRECEDENTI PRIMA DI INIZIARE
  UPDATE public.players
  SET previous_live_rank_position = live_rank_position
  WHERE championship_id = target_championship_id;

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
    DROP TABLE IF EXISTS temp_actives;

    -- Crea tabella temporanea con tutti i giocatori
    CREATE TEMP TABLE temp_players AS
    SELECT
      p.id,
      p.user_id,
      p.display_name,
      p.live_rank_position as old_position,
      p.matches_this_month,
      CASE WHEN p.matches_this_month < min_matches_required THEN true ELSE false END as is_inactive,
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC) as relative_position,
      0::INTEGER as new_relative_position  -- Verrà calcolato dopo
    FROM public.players p
    WHERE p.championship_id = target_championship_id
      AND p.live_rank_category = category_record.live_rank_category;

    -- ✅ STEP 1: Retrocedi tutti gli inattivi di 1 posizione
    UPDATE temp_players
    SET new_relative_position = relative_position + 1
    WHERE is_inactive = true;

    -- ✅ STEP 2: Crea lista degli attivi in ordine di posizione
    CREATE TEMP TABLE temp_actives AS
    SELECT
      id,
      display_name,
      relative_position as original_position,
      ROW_NUMBER() OVER (ORDER BY relative_position ASC) as active_order
    FROM temp_players
    WHERE is_inactive = false
    ORDER BY relative_position ASC;

    -- ✅ STEP 3: Riempi i buchi dall'alto con gli attivi
    -- Gli attivi occupano le prime N posizioni disponibili (buchi lasciati dagli inattivi retrocessi)
    DECLARE
      active_rec RECORD;
      next_available_pos INTEGER := 1;
    BEGIN
      FOR active_rec IN
        SELECT id, display_name, original_position
        FROM temp_actives
        ORDER BY original_position ASC
      LOOP
        -- Cerca la prima posizione disponibile (non occupata da un inattivo)
        WHILE EXISTS (
          SELECT 1 FROM temp_players
          WHERE is_inactive = true
            AND new_relative_position = next_available_pos
        ) LOOP
          next_available_pos := next_available_pos + 1;
        END LOOP;

        -- Assegna la posizione all'attivo
        UPDATE temp_players
        SET new_relative_position = next_available_pos
        WHERE id = active_rec.id;

        next_available_pos := next_available_pos + 1;
      END LOOP;
    END;

    -- ✅ STEP 4: Ricompatta eventuali buchi rimasti
    -- Trova il numero totale di giocatori nella categoria
    DECLARE
      total_players INTEGER;
      current_pos INTEGER := 1;
      player_at_pos RECORD;
    BEGIN
      SELECT COUNT(*) INTO total_players FROM temp_players;

      -- Crea una sequenza compatta da 1 a total_players
      DROP TABLE IF EXISTS temp_final_positions;
      CREATE TEMP TABLE temp_final_positions (
        player_id UUID,
        final_position INTEGER
      );

      -- Ordina tutti i giocatori per new_relative_position e assegna posizioni compatte
      FOR player_at_pos IN
        SELECT id
        FROM temp_players
        ORDER BY new_relative_position ASC
      LOOP
        INSERT INTO temp_final_positions (player_id, final_position)
        VALUES (player_at_pos.id, current_pos);

        current_pos := current_pos + 1;
      END LOOP;

      -- Aggiorna temp_players con le posizioni finali compattate
      UPDATE temp_players tp
      SET new_relative_position = tfp.final_position
      FROM temp_final_positions tfp
      WHERE tp.id = tfp.player_id;

      DROP TABLE IF EXISTS temp_final_positions;
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
    -- NOTA: previous_live_rank_position è già stata salvata all'inizio della funzione
    FOR player_record IN SELECT * FROM temp_players LOOP
      UPDATE public.players
      SET
        live_rank_position = player_record.new_relative_position,
        updated_at = now()
      WHERE id = player_record.id;
    END LOOP;

    DROP TABLE IF EXISTS temp_players;
    DROP TABLE IF EXISTS temp_actives;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Inactivity demotion completed - inactive players demoted by 1 position, active players fill gaps from top',
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

COMMENT ON FUNCTION public.calculate_inactivity_demotion IS 'Retrocede giocatori inattivi (< min_matches_required partite). Algoritmo: 1) Salva posizioni precedenti, 2) Retrocedi tutti gli inattivi di 1 posizione, 3) Crea lista degli attivi in ordine, 4) Riempi i buchi dall''alto con gli attivi, 5) Ricompatta eventuali buchi rimasti. I range di posizioni sono calcolati dinamicamente in base a gold_players_count, silver_players_count, bronze_players_count.';
