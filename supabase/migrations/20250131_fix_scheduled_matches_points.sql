-- =====================================================
-- Fix: Award Points for Scheduled Matches with Results
-- Date: 2025-01-31
-- =====================================================
-- PROBLEMA: is_scheduled = true blocca TUTTE le sfide
-- SOLUZIONE: Blocca solo se NON ha ancora un risultato
-- =====================================================

-- Funzione corretta: non bloccare is_scheduled, ma bloccare solo se score è ancora "da giocare"
CREATE OR REPLACE FUNCTION public.award_pro_master_points_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_exists BOOLEAN;
  loser_exists BOOLEAN;
BEGIN
  -- Blocca solo le sfide in pending (con challenge_status valorizzato)
  IF NEW.challenge_status IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Blocca se NON c'è un vincitore o perdente
  IF NEW.winner_id IS NULL OR NEW.loser_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Blocca se lo score è ancora "da giocare" o NULL
  IF NEW.score IS NULL OR NEW.score = 'da giocare' OR NEW.score = 'Da giocare' THEN
    RETURN NEW;
  END IF;

  -- Se è un UPDATE, verifica che i punti non siano già stati assegnati
  IF TG_OP = 'UPDATE' THEN
    -- Se OLD.score era già un risultato valido, punti già assegnati
    IF OLD.score IS NOT NULL AND OLD.score != 'da giocare' AND OLD.score != 'Da giocare' THEN
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

-- Drop vecchi trigger
DROP TRIGGER IF EXISTS award_pro_master_points_on_match ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_match_update ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_score_update ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_insert ON public.matches;

-- Trigger UPDATE: quando lo score cambia da "da giocare" a un risultato
CREATE TRIGGER award_pro_master_points_on_score_update
  AFTER UPDATE OF score ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Trigger INSERT: per match creati direttamente con risultato
CREATE TRIGGER award_pro_master_points_on_insert
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Abilita trigger
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_score_update;
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_insert;

COMMENT ON FUNCTION public.award_pro_master_points_for_match IS
'Assegna punti Pro Master: Vincitore +3, Perdente +1.
Funziona sia per match schedulati che non schedulati.
Blocca solo se: challenge_status IS NOT NULL, oppure score è ancora "da giocare"/"Da giocare"/NULL';

COMMENT ON TRIGGER award_pro_master_points_on_score_update ON public.matches IS
'Assegna punti quando lo score viene aggiornato da "da giocare" a un risultato';

COMMENT ON TRIGGER award_pro_master_points_on_insert ON public.matches IS
'Assegna punti quando un match viene creato con un risultato';
