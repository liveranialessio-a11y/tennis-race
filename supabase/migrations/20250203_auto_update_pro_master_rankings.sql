-- =====================================================
-- AUTO UPDATE PRO MASTER RANKINGS
-- Date: 2025-02-03
-- =====================================================
-- Aggiorna automaticamente le posizioni pro_master_rank_position
-- ogni volta che cambiano i punti pro_master_points
-- =====================================================

-- Funzione per ricalcolare tutte le posizioni Pro Master
CREATE OR REPLACE FUNCTION public.auto_update_pro_master_rankings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  current_position INTEGER := 1;
  affected_championship_id UUID;
BEGIN
  -- Determina quale championship è stato modificato
  IF TG_OP = 'UPDATE' THEN
    affected_championship_id := NEW.championship_id;
  ELSIF TG_OP = 'INSERT' THEN
    affected_championship_id := NEW.championship_id;
  ELSIF TG_OP = 'DELETE' THEN
    affected_championship_id := OLD.championship_id;
  END IF;

  -- Ricalcola tutte le posizioni per questo championship
  -- Ordina per punti DESC, poi per display_name ASC (come nella funzione update_pro_master_rankings)
  FOR player_record IN
    SELECT id, display_name, pro_master_points
    FROM public.players
    WHERE championship_id = affected_championship_id
    ORDER BY pro_master_points DESC, display_name ASC
  LOOP
    -- Aggiorna la posizione per questo giocatore
    UPDATE public.players
    SET pro_master_rank_position = current_position
    WHERE id = player_record.id;

    current_position := current_position + 1;
  END LOOP;

  RAISE NOTICE 'Pro Master rankings updated for championship %', affected_championship_id;

  -- Ritorna il record appropriato in base all'operazione
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- Drop vecchio trigger se esiste
DROP TRIGGER IF EXISTS trigger_auto_update_pro_master_rankings ON public.players;

-- Crea trigger che si attiva quando cambiano i punti Pro Master
CREATE TRIGGER trigger_auto_update_pro_master_rankings
  AFTER INSERT OR UPDATE OF pro_master_points OR DELETE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_update_pro_master_rankings();

COMMENT ON FUNCTION public.auto_update_pro_master_rankings IS
'Ricalcola automaticamente tutte le posizioni pro_master_rank_position
quando i punti pro_master_points di un giocatore cambiano.
Ordina per pro_master_points DESC, display_name ASC.';

COMMENT ON TRIGGER trigger_auto_update_pro_master_rankings ON public.players IS
'Aggiorna automaticamente le classifiche Pro Master quando i punti cambiano.';
