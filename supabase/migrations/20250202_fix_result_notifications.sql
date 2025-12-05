-- =====================================================
-- FIX: NOTIFICHE RISULTATI PARTITE
-- =====================================================
-- Crea notifiche dettagliate con vittoria/sconfitta,
-- punteggio e punti master guadagnati
-- =====================================================

CREATE OR REPLACE FUNCTION notify_result_inserted()
RETURNS TRIGGER AS $$
DECLARE
    winner_name TEXT;
    loser_name TEXT;
    winner_points INT;
    loser_points INT;
    match_score TEXT;
BEGIN
    -- Solo se è un nuovo risultato inserito E il match è stato effettivamente giocato
    -- Verifica che:
    -- 1. Ci siano winner_id e loser_id
    -- 2. Non sia una sfida in pending (challenge_status = NULL o diverso da 'lanciata'/'accettata')
    -- 3. Il punteggio non sia 'Da giocare' (significa che è una sfida programmata ma non ancora giocata)
    -- 4. Se è un UPDATE, il winner_id deve essere cambiato da NULL (cioè è la prima volta che viene inserito il risultato)
    IF NEW.winner_id IS NOT NULL AND NEW.loser_id IS NOT NULL
       AND NEW.challenge_status IS NULL
       AND NEW.score IS NOT NULL
       AND NEW.score != 'Da giocare'
       AND (OLD IS NULL OR OLD.winner_id IS NULL OR OLD.score = 'Da giocare') THEN

        -- Ottieni i nomi dei giocatori
        SELECT display_name INTO winner_name
        FROM public.players
        WHERE user_id = NEW.winner_id;

        SELECT display_name INTO loser_name
        FROM public.players
        WHERE user_id = NEW.loser_id;

        -- Ottieni il punteggio
        match_score := COALESCE(NEW.score, 'Non specificato');

        -- Calcola i punti master (assumendo 3 punti per vittoria, 0 per sconfitta)
        -- Puoi modificare questa logica in base al tuo sistema di punteggio
        winner_points := 3;
        loser_points := 0;

        -- NOTIFICA AL VINCITORE
        PERFORM create_notification(
            NEW.winner_id,
            'result_confirmed',
            '🏆 Vittoria!',
            'Hai vinto contro ' || loser_name || ' con il punteggio ' || match_score || '. Hai guadagnato ' || winner_points || ' punti master! 🎾',
            NEW.id,
            'match',
            'trophy'
        );

        -- NOTIFICA AL PERDENTE
        PERFORM create_notification(
            NEW.loser_id,
            'result_confirmed',
            'Partita conclusa',
            'Hai perso contro ' || winner_name || ' con il punteggio ' || match_score || '. Continua ad allenarti! 💪',
            NEW.id,
            'match',
            'alert-circle'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi i vecchi trigger se esistono
DROP TRIGGER IF EXISTS trigger_notify_result_pending ON public.matches;
DROP TRIGGER IF EXISTS trigger_notify_result_inserted ON public.matches;

-- Crea il nuovo trigger
CREATE TRIGGER trigger_notify_result_inserted
    AFTER INSERT OR UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_result_inserted();

COMMENT ON FUNCTION notify_result_inserted IS 'Crea notifiche dettagliate per vincitore e perdente quando viene inserito un risultato';
