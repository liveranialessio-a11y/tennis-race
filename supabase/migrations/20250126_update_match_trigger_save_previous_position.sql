-- =====================================================
-- Migration: Update match completion trigger to save previous positions
-- Date: 2025-01-26
-- =====================================================
-- Modifica il trigger handle_match_completion per salvare
-- la posizione precedente prima di fare lo swap (per le frecce)
-- =====================================================

CREATE OR REPLACE FUNCTION public.handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
  winner_old_position INTEGER;
  loser_old_position INTEGER;
BEGIN
  -- Skip if match is scheduled (not yet played)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- Skip if match is a draw
  IF NEW.is_draw = true THEN
    RETURN NEW;
  END IF;

  -- Skip if challenge is not yet completed
  -- Only swap positions when challenge_status IS NULL
  IF NEW.challenge_status IS NOT NULL THEN
    RAISE NOTICE 'Skipping position swap: challenge still in status "%"', NEW.challenge_status;
    RETURN NEW;
  END IF;

  SELECT id, live_rank_position
  INTO winner_player_id, winner_old_position
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  SELECT id, live_rank_position
  INTO loser_player_id, loser_old_position
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Winner player id: %, position: %', winner_player_id, winner_old_position;
  RAISE NOTICE 'Loser player id: %, position: %', loser_player_id, loser_old_position;

  IF winner_player_id = loser_player_id THEN
    RAISE NOTICE 'ERROR: Winner and loser are the same player!';
    RETURN NEW;
  END IF;

  -- ⭐ SWAP POSITIONS: Solo se il vincitore era dietro al perdente
  IF winner_old_position > loser_old_position THEN
    RAISE NOTICE 'Swapping positions: winner % -> %, loser % -> %',
      winner_old_position, loser_old_position, loser_old_position, winner_old_position;

    -- ⭐ SALVA LE POSIZIONI PRECEDENTI PRIMA DELLO SWAP
    UPDATE public.players
    SET
      previous_live_rank_position = winner_old_position,
      live_rank_position = loser_old_position,
      live_rank_category = get_category_by_position(loser_old_position),
      updated_at = now()
    WHERE id = winner_player_id;

    UPDATE public.players
    SET
      previous_live_rank_position = loser_old_position,
      live_rank_position = winner_old_position,
      live_rank_category = get_category_by_position(winner_old_position),
      updated_at = now()
    WHERE id = loser_player_id;

    RAISE NOTICE 'Position swap completed';
  ELSE
    -- ⭐ NESSUNO SWAP: Il vincitore era già davanti, aggiorna previous_position = current
    -- Questo serve per dire "nessun cambiamento" e non mostrare frecce
    UPDATE public.players
    SET previous_live_rank_position = live_rank_position
    WHERE id IN (winner_player_id, loser_player_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.handle_match_completion IS 'Handles position swapping after match completion. Salva previous_live_rank_position prima dello swap per mostrare le frecce. Only swaps positions when challenge_status IS NULL (completed). Statistics (wins, losses, sets, draws) are calculated dynamically from matches table using get_filtered_player_stats function.';
