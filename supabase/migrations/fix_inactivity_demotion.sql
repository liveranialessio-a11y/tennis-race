-- =====================================================
-- FIX: calculate_inactivity_demotion function
-- =====================================================
-- PROBLEMA: La funzione usava range HARDCODED (1-10, 11-20, 21-30)
-- invece di calcolare dinamicamente i range in base al numero
-- reale di giocatori per categoria.
--
-- CONSEGUENZA: Con 12 giocatori Gold, i giocatori Silver venivano
-- assegnati a posizioni già occupate, causando posizioni negative
-- quando convertite con get_category_position().
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
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC) as original_order,
      0 as new_relative_position,
      p.live_rank_position::INTEGER as new_position
    FROM public.players p
    WHERE p.championship_id = target_championship_id
      AND p.live_rank_category = category_record.live_rank_category;

    -- ✅ ALGORITMO CORRETTO: Prima gli attivi, poi gli inattivi
    -- STEP 1: Assegna posizioni relative agli ATTIVI (mantengono ordine originale)
    DECLARE
      active_counter INTEGER := 1;
      active_rec RECORD;
    BEGIN
      FOR active_rec IN
        SELECT id
        FROM temp_players
        WHERE is_inactive = false
        ORDER BY original_order ASC
      LOOP
        UPDATE temp_players
        SET new_relative_position = active_counter
        WHERE id = active_rec.id;

        active_counter := active_counter + 1;
      END LOOP;
    END;

    -- STEP 2: Assegna posizioni relative agli INATTIVI (dopo gli attivi, mantengono ordine originale)
    DECLARE
      inactive_counter INTEGER;
      inactive_rec RECORD;
      active_count INTEGER;
    BEGIN
      -- Conta quanti attivi ci sono
      SELECT COUNT(*) INTO active_count
      FROM temp_players
      WHERE is_inactive = false;

      -- Gli inattivi partono da (active_count + 1)
      inactive_counter := active_count + 1;

      FOR inactive_rec IN
        SELECT id
        FROM temp_players
        WHERE is_inactive = true
        ORDER BY original_order ASC
      LOOP
        UPDATE temp_players
        SET new_relative_position = inactive_counter
        WHERE id = inactive_rec.id;

        inactive_counter := inactive_counter + 1;
      END LOOP;
    END;

    -- ✅ Converti le posizioni relative in posizioni globali usando i range dinamici
    UPDATE temp_players
    SET new_position = category_min_pos + new_relative_position - 1
    WHERE TRUE;

    -- Log dei movimenti
    FOR player_record IN SELECT * FROM temp_players ORDER BY old_position LOOP
      all_players_array := all_players_array || json_build_object(
        'name', player_record.display_name,
        'category', category_record.live_rank_category,
        'old_position', player_record.old_position,
        'new_position', player_record.new_position,
        'matches_this_month', player_record.matches_this_month,
        'is_inactive', player_record.is_inactive
      );

      IF player_record.old_position != player_record.new_position THEN
        movements_array := movements_array || json_build_object(
          'player', player_record.display_name,
          'category', category_record.live_rank_category,
          'from', player_record.old_position,
          'to', player_record.new_position,
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
        live_rank_position = player_record.new_position,
        updated_at = now()
      WHERE id = player_record.id;
    END LOOP;

    DROP TABLE IF EXISTS temp_players;
    DROP TABLE IF EXISTS temp_active_players;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Inactivity demotion completed - inactive players swapped with active players below them',
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

COMMENT ON FUNCTION public.calculate_inactivity_demotion IS 'Retrocede di 1 posizione chi ha giocato meno di min_matches_required partite (default 2). Usa matches_this_month. Retrocessione solo all''interno della categoria. I range di posizioni sono calcolati dinamicamente in base a gold_players_count, silver_players_count, bronze_players_count.';
