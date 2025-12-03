-- =====================================================
-- FIX CURRENT PRO MASTER RANKINGS
-- Date: 2025-02-03
-- =====================================================
-- Ricalcola le posizioni pro_master_rank_position esistenti
-- basandosi sui punti pro_master_points attuali
-- =====================================================

DO $$
DECLARE
  player_record RECORD;
  current_position INTEGER := 1;
  champ_id UUID;
BEGIN
  -- Per ogni championship
  FOR champ_id IN
    SELECT id FROM public.championships
  LOOP
    current_position := 1;

    -- Ricalcola le posizioni per questo championship
    -- Ordina per punti DESC, poi per display_name ASC
    FOR player_record IN
      SELECT id, display_name, pro_master_points
      FROM public.players
      WHERE championship_id = champ_id
      ORDER BY pro_master_points DESC, display_name ASC
    LOOP
      -- Aggiorna la posizione per questo giocatore
      UPDATE public.players
      SET pro_master_rank_position = current_position
      WHERE id = player_record.id;

      RAISE NOTICE 'Updated % to position % (% points)',
        player_record.display_name, current_position, player_record.pro_master_points;

      current_position := current_position + 1;
    END LOOP;

    RAISE NOTICE 'Fixed Pro Master rankings for championship %', champ_id;
  END LOOP;
END;
$$;
