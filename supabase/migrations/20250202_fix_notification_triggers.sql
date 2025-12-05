-- =====================================================
-- FIX NOTIFICATION TRIGGERS
-- =====================================================
-- Corregge i trigger per usare user_id invece di player_id
-- =====================================================

-- Fix trigger: Nuova sfida ricevuta
CREATE OR REPLACE FUNCTION notify_challenge_received()
RETURNS TRIGGER AS $$
DECLARE
    launcher_name TEXT;
    opponent_user_id UUID;
    challenge_date TEXT;
BEGIN
    -- Solo se è una nuova sfida lanciata
    IF NEW.challenge_status = 'lanciata' AND (OLD IS NULL OR OLD.challenge_status IS NULL) THEN

        -- Ottieni il nome di chi ha lanciato la sfida
        SELECT display_name INTO launcher_name
        FROM public.players
        WHERE user_id = NEW.challenge_launcher_id;

        -- Determina chi è l'avversario (chi non ha lanciato la sfida)
        IF NEW.winner_id = NEW.challenge_launcher_id THEN
            opponent_user_id := NEW.loser_id;
        ELSE
            opponent_user_id := NEW.winner_id;
        END IF;

        -- Formatta la data della sfida
        challenge_date := TO_CHAR(NEW.played_at, 'DD/MM/YYYY HH24:MI');

        -- Crea notifica per l'avversario
        PERFORM create_notification(
            opponent_user_id,
            'challenge_received',
            'Nuova sfida ricevuta!',
            launcher_name || ' ti ha lanciato una sfida per il ' || challenge_date,
            NEW.id,
            'challenge',
            'swords'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix trigger: Sfida accettata
CREATE OR REPLACE FUNCTION notify_challenge_accepted()
RETURNS TRIGGER AS $$
DECLARE
    acceptor_name TEXT;
BEGIN
    -- Solo se lo stato passa da 'lanciata' a 'accettata'
    IF OLD.challenge_status = 'lanciata' AND NEW.challenge_status = 'accettata' THEN

        -- Ottieni il nome di chi ha accettato
        IF NEW.winner_id = NEW.challenge_launcher_id THEN
            SELECT display_name INTO acceptor_name
            FROM public.players
            WHERE user_id = NEW.loser_id;
        ELSE
            SELECT display_name INTO acceptor_name
            FROM public.players
            WHERE user_id = NEW.winner_id;
        END IF;

        -- Crea notifica per chi ha lanciato la sfida
        PERFORM create_notification(
            NEW.challenge_launcher_id,
            'challenge_accepted',
            'Sfida accettata!',
            acceptor_name || ' ha accettato la tua sfida',
            NEW.id,
            'challenge',
            'check-circle'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix trigger: Risultato pendente
CREATE OR REPLACE FUNCTION notify_result_pending()
RETURNS TRIGGER AS $$
DECLARE
    submitter_name TEXT;
    opponent_user_id UUID;
BEGIN
    -- Solo se è un nuovo risultato (non una sfida in pending)
    IF NEW.winner_id IS NOT NULL AND NEW.loser_id IS NOT NULL
       AND NEW.challenge_status IS NULL
       AND (OLD IS NULL OR OLD.winner_id IS NULL) THEN

        -- Ottieni il nome di chi ha inserito il risultato
        SELECT display_name INTO submitter_name
        FROM public.players
        WHERE user_id = NEW.winner_id;

        -- L'avversario è il loser
        opponent_user_id := NEW.loser_id;

        -- Crea notifica per l'avversario
        PERFORM create_notification(
            opponent_user_id,
            'result_pending',
            'Risultato da confermare',
            submitter_name || ' ha inserito un risultato. Conferma o contesta!',
            NEW.id,
            'match',
            'file-check'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_challenge_received IS 'Crea notifica quando un utente riceve una nuova sfida (FIXED: usa user_id)';
COMMENT ON FUNCTION notify_challenge_accepted IS 'Crea notifica quando una sfida viene accettata (FIXED: usa user_id)';
COMMENT ON FUNCTION notify_result_pending IS 'Crea notifica quando viene inserito un risultato da confermare (FIXED: usa user_id)';
