-- =====================================================
-- Simple Trigger: Award Points on Score Update
-- Date: 2025-01-31
-- =====================================================
-- Quando inserisci il punteggio (score), assegna i punti
-- =====================================================

-- Funzione semplificata
CREATE OR REPLACE FUNCTION public.award_pro_master_points_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_exists BOOLEAN;
  loser_exists BOOLEAN;
BEGIN
  -- Solo se il match non è schedulato e non è una challenge in pending
  IF NEW.is_scheduled = TRUE OR NEW.challenge_status IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Solo se c'è un vincitore e un perdente
  IF NEW.winner_id IS NULL OR NEW.loser_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se è un UPDATE, verifica che i punti non siano già stati assegnati
  -- Controlliamo se OLD.score era già un risultato valido (non NULL e non 'da giocare')
  IF TG_OP = 'UPDATE' THEN
    IF OLD.score IS NOT NULL AND OLD.score != 'da giocare' THEN
      -- Punti già assegnati in precedenza, non riassegnare
      RETURN NEW;
    END IF;
  END IF;

  -- Verifica che i giocatori esistano
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.winner_id) INTO winner_exists;
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.loser_id) INTO loser_exists;

  IF NOT winner_exists OR NOT loser_exists THEN
    RAISE WARNING 'Player not found for match %', NEW.id;
    RETURN NEW;
  END IF;

  -- Assegna 3 punti al vincitore
  UPDATE public.players
  SET
    pro_master_points = pro_master_points + 3,
    updated_at = now()
  WHERE user_id = NEW.winner_id
    AND championship_id = NEW.championship_id;

  -- Assegna 1 punto al perdente
  UPDATE public.players
  SET
    pro_master_points = pro_master_points + 1,
    updated_at = now()
  WHERE user_id = NEW.loser_id
    AND championship_id = NEW.championship_id;

  RAISE NOTICE 'Pro Master points: Winner +3, Loser +1 for match %', NEW.id;

  RETURN NEW;
END;
$$;

-- Drop TUTTI i vecchi trigger
DROP TRIGGER IF EXISTS award_pro_master_points_on_match ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_match_update ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_score_update ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_insert ON public.matches;

-- Trigger UPDATE: si attiva quando lo score viene aggiornato
-- La logica di controllo è nella funzione
CREATE TRIGGER award_pro_master_points_on_score_update
  AFTER UPDATE OF score ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Trigger INSERT: per i match creati direttamente con risultato (admin)
CREATE TRIGGER award_pro_master_points_on_insert
  AFTER INSERT ON public.matches
  FOR EACH ROW
  WHEN (NEW.score IS NOT NULL AND NEW.score != 'da giocare')
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Abilita trigger
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_score_update;
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_insert;

COMMENT ON FUNCTION public.award_pro_master_points_for_match IS
'Assegna punti Pro Master: Vincitore +3, Perdente +1';

COMMENT ON TRIGGER award_pro_master_points_on_score_update ON public.matches IS
'Assegna punti quando lo score viene inserito (da giocare → risultato)';

COMMENT ON TRIGGER award_pro_master_points_on_insert ON public.matches IS
'Assegna punti quando un match viene creato già con un risultato';
