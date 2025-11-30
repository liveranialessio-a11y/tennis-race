-- =====================================================
-- Add UPDATE Trigger for Pro Master Points
-- Date: 2025-01-31
-- =====================================================
-- Le sfide vengono prima create e poi aggiornate con il risultato
-- Dobbiamo gestire anche gli UPDATE, non solo gli INSERT
-- =====================================================

-- Modifica la funzione per gestire sia INSERT che UPDATE
CREATE OR REPLACE FUNCTION public.award_pro_master_points_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_exists BOOLEAN;
  loser_exists BOOLEAN;
  points_already_awarded BOOLEAN := false;
BEGIN
  -- Only process completed matches (not scheduled, not challenges)
  IF NEW.is_scheduled = TRUE OR NEW.challenge_status IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only process if there is a winner (not a draw)
  IF NEW.winner_id IS NULL OR NEW.loser_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Se è un UPDATE, controlla se il match era già completato
  -- per evitare di assegnare punti due volte
  -- Un match è considerato completato se lo score NON è 'da giocare'
  IF TG_OP = 'UPDATE' THEN
    IF OLD.score IS NOT NULL AND OLD.score != 'da giocare' THEN
      -- Punti già assegnati, non fare nulla
      RETURN NEW;
    END IF;
  END IF;

  -- Check if both players exist (using user_id)
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.winner_id) INTO winner_exists;
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.loser_id) INTO loser_exists;

  IF NOT winner_exists OR NOT loser_exists THEN
    RAISE WARNING 'One or both players not found for match %', NEW.id;
    RETURN NEW;
  END IF;

  -- Award 3 points to winner (using user_id to find the player)
  UPDATE public.players
  SET
    pro_master_points = pro_master_points + 3,
    updated_at = now()
  WHERE user_id = NEW.winner_id
    AND championship_id = NEW.championship_id;

  -- Award 1 point to loser (using user_id to find the player)
  UPDATE public.players
  SET
    pro_master_points = pro_master_points + 1,
    updated_at = now()
  WHERE user_id = NEW.loser_id
    AND championship_id = NEW.championship_id;

  RAISE NOTICE 'Pro Master points awarded for match %: Winner +3 points, Loser +1 point', NEW.id;

  RETURN NEW;
END;
$$;

-- Drop old triggers
DROP TRIGGER IF EXISTS award_pro_master_points_on_match ON public.matches;
DROP TRIGGER IF EXISTS award_pro_master_points_on_match_update ON public.matches;

-- Create trigger for INSERT
CREATE TRIGGER award_pro_master_points_on_match
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Create trigger for UPDATE
-- Si attiva quando:
-- 1. winner_id o loser_id cambiano (match creato senza vincitore)
-- 2. score cambia da 'da giocare' a un risultato (sfide)
CREATE TRIGGER award_pro_master_points_on_match_update
  AFTER UPDATE ON public.matches
  FOR EACH ROW
  WHEN (
    OLD.winner_id IS DISTINCT FROM NEW.winner_id
    OR OLD.loser_id IS DISTINCT FROM NEW.loser_id
    OR (OLD.score = 'da giocare' AND NEW.score != 'da giocare')
  )
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

-- Enable triggers
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_match;
ALTER TABLE matches ENABLE ALWAYS TRIGGER award_pro_master_points_on_match_update;

COMMENT ON FUNCTION public.award_pro_master_points_for_match IS
'Awards Pro Master points for each completed match:
- Winner: +3 points
- Loser: +1 point
Works on both INSERT and UPDATE.
Prevents duplicate point awards by checking OLD values on UPDATE.';

COMMENT ON TRIGGER award_pro_master_points_on_match ON public.matches IS
'Automatically awards Pro Master points when a match is inserted.';

COMMENT ON TRIGGER award_pro_master_points_on_match_update ON public.matches IS
'Automatically awards Pro Master points when a match is updated with winner/loser.';
