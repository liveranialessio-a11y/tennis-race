-- =====================================================
-- TRIGGER AUTOMATICI PER NOTIFICHE
-- =====================================================
-- Questi trigger creano automaticamente notifiche
-- quando succedono eventi importanti nell'app
-- =====================================================

-- =====================================================
-- HELPER FUNCTION: Crea una notifica
-- =====================================================
CREATE OR REPLACE FUNCTION create_notification(
    p_user_id UUID,
    p_type VARCHAR(50),
    p_title VARCHAR(255),
    p_message TEXT,
    p_related_id UUID DEFAULT NULL,
    p_related_type VARCHAR(50) DEFAULT NULL,
    p_icon VARCHAR(50) DEFAULT 'megaphone'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO public.notifications (
        user_id,
        type,
        title,
        message,
        related_id,
        related_type,
        icon
    )
    VALUES (
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_related_id,
        p_related_type,
        p_icon
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 1. NOTIFICHE SFIDE
-- =====================================================

-- Trigger: Nuova sfida lanciata (stato = 'lanciata')
CREATE OR REPLACE FUNCTION notify_challenge_received()
RETURNS TRIGGER AS $$
DECLARE
    launcher_name TEXT;
    opponent_id UUID;
    challenge_date TEXT;
BEGIN
    -- Solo se è una nuova sfida lanciata
    IF NEW.challenge_status = 'lanciata' AND (OLD IS NULL OR OLD.challenge_status IS NULL) THEN

        -- Ottieni il nome di chi ha lanciato la sfida
        SELECT display_name INTO launcher_name
        FROM public.players
        WHERE id = NEW.challenge_launcher_id;

        -- Determina chi è l'avversario (chi non ha lanciato la sfida)
        IF NEW.winner_id = NEW.challenge_launcher_id THEN
            opponent_id := NEW.loser_id;
        ELSE
            opponent_id := NEW.winner_id;
        END IF;

        -- Formatta la data della sfida
        challenge_date := TO_CHAR(NEW.played_at, 'DD/MM/YYYY HH24:MI');

        -- Crea notifica per l'avversario
        PERFORM create_notification(
            (SELECT user_id FROM public.players WHERE id = opponent_id),
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

CREATE TRIGGER trigger_notify_challenge_received
    AFTER INSERT OR UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_challenge_received();

-- Trigger: Sfida accettata (stato cambia da 'lanciata' a 'accettata')
CREATE OR REPLACE FUNCTION notify_challenge_accepted()
RETURNS TRIGGER AS $$
DECLARE
    acceptor_name TEXT;
    launcher_id UUID;
BEGIN
    -- Solo se lo stato passa da 'lanciata' a 'accettata'
    IF OLD.challenge_status = 'lanciata' AND NEW.challenge_status = 'accettata' THEN

        -- Ottieni il nome di chi ha accettato
        IF NEW.winner_id = NEW.challenge_launcher_id THEN
            SELECT display_name INTO acceptor_name
            FROM public.players
            WHERE id = NEW.loser_id;
        ELSE
            SELECT display_name INTO acceptor_name
            FROM public.players
            WHERE id = NEW.winner_id;
        END IF;

        -- Crea notifica per chi ha lanciato la sfida
        PERFORM create_notification(
            (SELECT user_id FROM public.players WHERE id = NEW.challenge_launcher_id),
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

CREATE TRIGGER trigger_notify_challenge_accepted
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_challenge_accepted();

-- =====================================================
-- 2. NOTIFICHE RISULTATI
-- =====================================================

-- Trigger: Nuovo risultato inserito (winner_id e loser_id impostati)
CREATE OR REPLACE FUNCTION notify_result_pending()
RETURNS TRIGGER AS $$
DECLARE
    submitter_name TEXT;
    opponent_id UUID;
    opponent_user_id UUID;
BEGIN
    -- Solo se è un nuovo risultato (non una sfida in pending)
    IF NEW.winner_id IS NOT NULL AND NEW.loser_id IS NOT NULL
       AND NEW.challenge_status IS NULL
       AND (OLD IS NULL OR OLD.winner_id IS NULL) THEN

        -- Ottieni il nome di chi ha inserito il risultato
        SELECT display_name INTO submitter_name
        FROM public.players
        WHERE id = NEW.winner_id;

        -- L'avversario è il loser
        opponent_id := NEW.loser_id;

        -- Ottieni lo user_id dell'avversario
        SELECT user_id INTO opponent_user_id
        FROM public.players
        WHERE id = opponent_id;

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

CREATE TRIGGER trigger_notify_result_pending
    AFTER INSERT OR UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_result_pending();

-- =====================================================
-- 3. NOTIFICHE CLASSIFICA (quando cambia live_rank_position)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_ranking_change()
RETURNS TRIGGER AS $$
DECLARE
    position_diff INT;
BEGIN
    -- Solo se la posizione è cambiata
    IF OLD.live_rank_position IS DISTINCT FROM NEW.live_rank_position THEN

        position_diff := OLD.live_rank_position - NEW.live_rank_position;

        -- Se ha scalato posizioni (position_diff > 0)
        IF position_diff > 0 THEN

            -- Primo posto raggiunto
            IF NEW.live_rank_position = 1 THEN
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_first_place',
                    'Complimenti! 🎉',
                    'Hai raggiunto il primo posto in classifica!',
                    NULL,
                    'ranking',
                    'trophy'
                );

            -- Scalato più posizioni
            ELSIF position_diff >= 3 THEN
                PERFORM create_notification(
                    NEW.user_id,
                    'ranking_position_change',
                    'Ottimo lavoro! 📈',
                    'Hai scalato ' || position_diff || ' posizioni! Ora sei ' || NEW.live_rank_position || '°',
                    NULL,
                    'ranking',
                    'trophy'
                );
            END IF;

        -- Se ha perso posizioni (position_diff < 0)
        ELSIF position_diff < -3 THEN
            PERFORM create_notification(
                NEW.user_id,
                'ranking_position_change',
                'Posizione in classifica',
                'Sei sceso al ' || NEW.live_rank_position || '° posto',
                NULL,
                'ranking',
                'alert-circle'
            );
        END IF;

    END IF;

    -- Se è cambiata la categoria
    IF OLD.live_rank_category IS DISTINCT FROM NEW.live_rank_category THEN
        PERFORM create_notification(
            NEW.user_id,
            'ranking_category_change',
            'Cambio categoria! 🏆',
            'Sei passato alla categoria ' || UPPER(NEW.live_rank_category),
            NULL,
            'ranking',
            'trophy'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_ranking_change
    AFTER UPDATE ON public.players
    FOR EACH ROW
    EXECUTE FUNCTION notify_ranking_change();

-- =====================================================
-- 4. NOTIFICHE ADMIN (nuove richieste di registrazione)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_admin_new_registration()
RETURNS TRIGGER AS $$
DECLARE
    admin_user_id UUID;
BEGIN
    -- Solo per nuove richieste pending
    IF NEW.status = 'pending' AND (OLD IS NULL OR OLD.status IS NULL) THEN

        -- Ottieni tutti gli admin
        FOR admin_user_id IN
            SELECT user_id FROM public.profiles WHERE is_admin = TRUE
        LOOP
            PERFORM create_notification(
                admin_user_id,
                'admin_new_registration',
                'Nuova richiesta di registrazione',
                NEW.full_name || ' ha chiesto di iscriversi',
                NEW.id,
                'registration',
                'alert-circle'
            );
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_admin_new_registration
    AFTER INSERT OR UPDATE ON public.registration_requests
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_new_registration();

-- =====================================================
-- COMMENTI DOCUMENTAZIONE
-- =====================================================

COMMENT ON FUNCTION create_notification IS 'Helper function per creare notifiche. Verifica automaticamente le preferenze utente.';
COMMENT ON FUNCTION notify_challenge_received IS 'Crea notifica quando un utente riceve una nuova sfida';
COMMENT ON FUNCTION notify_challenge_accepted IS 'Crea notifica quando una sfida viene accettata';
COMMENT ON FUNCTION notify_result_pending IS 'Crea notifica quando viene inserito un risultato da confermare';
COMMENT ON FUNCTION notify_ranking_change IS 'Crea notifica quando cambia la posizione o categoria in classifica';
COMMENT ON FUNCTION notify_admin_new_registration IS 'Crea notifica per gli admin quando arriva una nuova richiesta di registrazione';
