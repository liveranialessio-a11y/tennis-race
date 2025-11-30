-- Prima elimina il trigger e la funzione esistenti
DROP TRIGGER IF EXISTS on_match_completion ON public.matches;
DROP FUNCTION IF EXISTS handle_match_completion();

-- Ricrea la funzione con logica corretta per lo swap
CREATE OR REPLACE FUNCTION handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
  winner_old_position INTEGER;
  loser_old_position INTEGER;
  parsed_score TEXT[];
  set1_winner INTEGER;
  set1_loser INTEGER;
  set2_winner INTEGER;
  set2_loser INTEGER;
BEGIN
  -- Solo per partite completate (non scheduled)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- Recupera l'ID e la posizione del vincitore
  SELECT id, live_rank_position
  INTO winner_player_id, winner_old_position
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  -- Recupera l'ID e la posizione del perdente
  SELECT id, live_rank_position
  INTO loser_player_id, loser_old_position
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  -- Se non troviamo entrambi i giocatori, esci
  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  -- Debug: stampa gli ID per verificare
  RAISE NOTICE 'Winner player id: %, position: %', winner_player_id, winner_old_position;
  RAISE NOTICE 'Loser player id: %, position: %', loser_player_id, loser_old_position;

  -- Verifica che siano giocatori diversi
  IF winner_player_id = loser_player_id THEN
    RAISE NOTICE 'ERROR: Winner and loser are the same player!';
    RETURN NEW;
  END IF;

  -- Parse del punteggio (formato: "6-4 6-3")
  parsed_score := string_to_array(NEW.score, ' ');

  IF array_length(parsed_score, 1) >= 2 THEN
    set1_winner := split_part(parsed_score[1], '-', 1)::INTEGER;
    set1_loser := split_part(parsed_score[1], '-', 2)::INTEGER;
    set2_winner := split_part(parsed_score[2], '-', 1)::INTEGER;
    set2_loser := split_part(parsed_score[2], '-', 2)::INTEGER;
  ELSE
    set1_winner := 0;
    set1_loser := 0;
    set2_winner := 0;
    set2_loser := 0;
  END IF;

  -- Se è un pareggio
  IF NEW.is_draw = true THEN
    -- Aggiorna solo i draws per entrambi
    UPDATE public.players
    SET
      draws = COALESCE(draws, 0) + 1,
      sets_won = COALESCE(sets_won, 0) + set1_winner + set2_winner,
      sets_lost = COALESCE(sets_lost, 0) + set1_loser + set2_loser,
      updated_at = now()
    WHERE id = winner_player_id;

    UPDATE public.players
    SET
      draws = COALESCE(draws, 0) + 1,
      sets_won = COALESCE(sets_won, 0) + set1_loser + set2_loser,
      sets_lost = COALESCE(sets_lost, 0) + set1_winner + set2_winner,
      updated_at = now()
    WHERE id = loser_player_id;

  ELSE
    -- Partita con vincitore
    -- Aggiorna statistiche vincitore
    UPDATE public.players
    SET
      wins = COALESCE(wins, 0) + 1,
      sets_won = COALESCE(sets_won, 0) + set1_winner + set2_winner,
      sets_lost = COALESCE(sets_lost, 0) + set1_loser + set2_loser,
      updated_at = now()
    WHERE id = winner_player_id;

    -- Aggiorna statistiche perdente
    UPDATE public.players
    SET
      losses = COALESCE(losses, 0) + 1,
      sets_won = COALESCE(sets_won, 0) + set1_loser + set2_loser,
      sets_lost = COALESCE(sets_lost, 0) + set1_winner + set2_winner,
      updated_at = now()
    WHERE id = loser_player_id;

    -- Swap delle posizioni se necessario
    -- Il vincitore prende la posizione del perdente SOLO se il perdente era più in alto
    IF winner_old_position > loser_old_position THEN
      RAISE NOTICE 'Swapping positions: winner % -> %, loser % -> %',
        winner_old_position, loser_old_position, loser_old_position, winner_old_position;

      -- Aggiorna il vincitore alla posizione del perdente
      UPDATE public.players
      SET
        live_rank_position = loser_old_position,
        live_rank_category = get_category_by_position(loser_old_position),
        updated_at = now()
      WHERE id = winner_player_id;

      -- Aggiorna il perdente alla vecchia posizione del vincitore
      UPDATE public.players
      SET
        live_rank_position = winner_old_position,
        live_rank_category = get_category_by_position(winner_old_position),
        updated_at = now()
      WHERE id = loser_player_id;

      RAISE NOTICE 'Position swap completed';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger
CREATE TRIGGER on_match_completion
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_completion();
