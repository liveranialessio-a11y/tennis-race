-- =====================================================
-- NOTIFICA: ORARIO PARTITA MODIFICATO
-- =====================================================
-- Quando viene modificato l'orario di una partita programmata,
-- l'avversario riceve una notifica
-- =====================================================

CREATE OR REPLACE FUNCTION notify_match_time_changed()
RETURNS TRIGGER AS $$
DECLARE
    player1_name TEXT;
    player2_name TEXT;
    new_match_date TEXT;
    current_user_id UUID;
    opponent_id UUID;
BEGIN
    -- Verifica che:
    -- 1. Sia un UPDATE (non INSERT)
    -- 2. L'orario sia cambiato (OLD.played_at diverso da NEW.played_at)
    -- 3. Il punteggio sia ancora "Da giocare" (non ancora giocata)
    -- 4. Non sia una sfida in pending (challenge_status = NULL)
    IF OLD IS NOT NULL
       AND OLD.played_at IS NOT NULL
       AND NEW.played_at IS NOT NULL
       AND OLD.played_at != NEW.played_at
       AND NEW.score = 'Da giocare'
       AND NEW.challenge_status IS NULL THEN

        -- Ottieni i nomi dei giocatori
        SELECT display_name INTO player1_name
        FROM public.players
        WHERE user_id = NEW.winner_id;

        SELECT display_name INTO player2_name
        FROM public.players
        WHERE user_id = NEW.loser_id;

        -- Formatta la nuova data della partita
        new_match_date := TO_CHAR(NEW.played_at, 'DD/MM/YYYY') || ' alle ' || TO_CHAR(NEW.played_at, 'HH24:MI');

        -- Ottieni l'ID dell'utente corrente (chi ha fatto la modifica)
        -- Purtroppo non possiamo sapere chi ha fatto la modifica dal trigger
        -- Quindi notifichiamo entrambi i giocatori

        -- NOTIFICA AL GIOCATORE 1
        PERFORM create_notification(
            NEW.winner_id,
            'match_time_changed',
            '⏰ Orario partita modificato',
            'L''orario della partita contro ' || player2_name || ' è stato spostato al ' || new_match_date || '. Controlla il tuo calendario! 📅',
            NEW.id,
            'match',
            'alert-circle'
        );

        -- NOTIFICA AL GIOCATORE 2
        PERFORM create_notification(
            NEW.loser_id,
            'match_time_changed',
            '⏰ Orario partita modificato',
            'L''orario della partita contro ' || player1_name || ' è stato spostato al ' || new_match_date || '. Controlla il tuo calendario! 📅',
            NEW.id,
            'match',
            'alert-circle'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi il vecchio trigger se esiste
DROP TRIGGER IF EXISTS trigger_notify_match_time_changed ON public.matches;

-- Crea il nuovo trigger
CREATE TRIGGER trigger_notify_match_time_changed
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_time_changed();

COMMENT ON FUNCTION notify_match_time_changed IS 'Crea notifiche quando l''orario di una partita programmata viene modificato';
