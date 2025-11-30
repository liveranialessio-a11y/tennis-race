-- =====================================================
-- Simple Pro Master Points Per Match
-- Date: 2025-01-31
-- =====================================================
-- Sistema semplificato: ogni match assegna punti Pro Master
-- - Vincitore: +3 punti
-- - Perdente: +1 punto
-- Questo vale per TUTTI i giocatori, indipendentemente dalla categoria
-- =====================================================

-- Function to award Pro Master points when a match is completed
CREATE OR REPLACE FUNCTION public.award_pro_master_points_for_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_exists BOOLEAN;
  loser_exists BOOLEAN;
BEGIN
  -- Only process completed matches (not scheduled, not challenges)
  IF NEW.is_scheduled = TRUE OR NEW.challenge_status IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only process if there is a winner (not a draw)
  IF NEW.winner_id IS NULL OR NEW.loser_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if both players exist
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.winner_id) INTO winner_exists;
  SELECT EXISTS(SELECT 1 FROM public.players WHERE user_id = NEW.loser_id) INTO loser_exists;

  IF NOT winner_exists OR NOT loser_exists THEN
    RAISE WARNING 'One or both players not found for match %', NEW.id;
    RETURN NEW;
  END IF;

  -- Award 3 points to winner
  UPDATE public.players
  SET
    pro_master_points = pro_master_points + 3,
    updated_at = now()
  WHERE user_id = NEW.winner_id
    AND championship_id = NEW.championship_id;

  -- Award 1 point to loser
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

-- Create trigger to award points when a match is inserted
DROP TRIGGER IF EXISTS award_pro_master_points_on_match ON public.matches;

CREATE TRIGGER award_pro_master_points_on_match
  AFTER INSERT ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.award_pro_master_points_for_match();

COMMENT ON FUNCTION public.award_pro_master_points_for_match IS
'Awards Pro Master points for each completed match:
- Winner: +3 points
- Loser: +1 point
This applies to all players regardless of category.';

COMMENT ON TRIGGER award_pro_master_points_on_match ON public.matches IS
'Automatically awards Pro Master points when a match is completed and inserted into the matches table.';
