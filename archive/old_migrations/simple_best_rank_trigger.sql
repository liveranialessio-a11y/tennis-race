-- =====================================================
-- SIMPLE BEST RANK TRIGGER
-- =====================================================
-- Aggiorna best_pro_master_rank quando pro_master_rank_position migliora
-- =====================================================

-- Trigger function che aggiorna ENTRAMBI i best ranks
CREATE OR REPLACE FUNCTION public.update_best_ranks()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_live_rank se la posizione è migliore (più bassa) o se è NULL
  IF NEW.live_rank_position IS NOT NULL THEN
    IF NEW.best_live_rank IS NULL OR NEW.live_rank_position < NEW.best_live_rank THEN
      NEW.best_live_rank := NEW.live_rank_position;
    END IF;
  END IF;

  -- Update best_pro_master_rank se la posizione è migliore (più bassa) o se è NULL
  IF NEW.pro_master_rank_position IS NOT NULL THEN
    IF NEW.best_pro_master_rank IS NULL OR NEW.pro_master_rank_position < NEW.best_pro_master_rank THEN
      NEW.best_pro_master_rank := NEW.pro_master_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Drop old triggers se esistono
DROP TRIGGER IF EXISTS trigger_update_best_live_rank ON public.players;
DROP TRIGGER IF EXISTS trigger_update_best_pro_master_rank ON public.players;
DROP TRIGGER IF EXISTS trigger_update_best_ranks ON public.players;

-- Crea un singolo trigger che gestisce entrambi
CREATE TRIGGER trigger_update_best_ranks
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_best_ranks();

-- =====================================================
-- Inizializza i valori best_pro_master_rank per tutti i player esistenti
-- =====================================================
UPDATE public.players
SET best_pro_master_rank = pro_master_rank_position
WHERE pro_master_rank_position IS NOT NULL
  AND (best_pro_master_rank IS NULL OR pro_master_rank_position < best_pro_master_rank);

UPDATE public.players
SET best_live_rank = live_rank_position
WHERE live_rank_position IS NOT NULL
  AND (best_live_rank IS NULL OR live_rank_position < best_live_rank);
