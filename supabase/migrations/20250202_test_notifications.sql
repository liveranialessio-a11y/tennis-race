-- =====================================================
-- FUNZIONE DI TEST PER NOTIFICHE
-- =====================================================
-- Usa questa funzione per creare notifiche di test
-- e vedere subito il sistema in azione!
-- =====================================================

-- Funzione per creare notifiche di test per un utente
CREATE OR REPLACE FUNCTION create_test_notifications(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    notification_count INT := 0;
BEGIN
    -- 1. Notifica sfida ricevuta
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'challenge_received',
        'Nuova sfida ricevuta!',
        'Mario Rossi ti ha lanciato una sfida per il 15/03/2025 alle 18:00',
        'swords',
        'challenge'
    );
    notification_count := notification_count + 1;

    -- 2. Notifica sfida accettata
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'challenge_accepted',
        'Sfida accettata!',
        'Alessio Liverani ha accettato la tua sfida',
        'check-circle',
        'challenge'
    );
    notification_count := notification_count + 1;

    -- 3. Notifica risultato da confermare
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'result_pending',
        'Risultato da confermare',
        'Giovanni Bianchi ha inserito un risultato. Conferma o contesta!',
        'file-check',
        'match'
    );
    notification_count := notification_count + 1;

    -- 4. Notifica vittoria confermata
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'result_confirmed',
        'Vittoria confermata!',
        'Hai vinto 3 punti master',
        'check-circle',
        'match'
    );
    notification_count := notification_count + 1;

    -- 5. Notifica cambio posizione
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'ranking_position_change',
        'Ottimo lavoro! 📈',
        'Hai scalato 3 posizioni! Ora sei 5°',
        'trophy',
        'ranking'
    );
    notification_count := notification_count + 1;

    -- 6. Notifica primo posto
    INSERT INTO public.notifications (
        user_id, type, title, message, icon, related_type
    ) VALUES (
        p_user_id,
        'ranking_first_place',
        'Complimenti! 🎉',
        'Hai raggiunto il primo posto in classifica!',
        'trophy',
        'ranking'
    );
    notification_count := notification_count + 1;

    RETURN 'Creato ' || notification_count || ' notifiche di test con successo!';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- COME USARE QUESTA FUNZIONE
-- =====================================================
-- Esegui questa query sostituendo USER_ID con il tuo user_id:
--
-- SELECT create_test_notifications('TUO_USER_ID_QUI');
--
-- Per trovare il tuo user_id, esegui:
-- SELECT id, email FROM auth.users WHERE email = 'tua-email@example.com';
-- =====================================================

-- Funzione per ripulire tutte le notifiche di test
CREATE OR REPLACE FUNCTION delete_all_notifications(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM public.notifications
    WHERE user_id = p_user_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;

    RETURN 'Eliminate ' || deleted_count || ' notifiche';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- ESEMPIO DI UTILIZZO:
-- =====================================================
-- 1. Trova il tuo user_id:
--    SELECT id, email FROM auth.users WHERE email = 'tua-email@example.com';
--
-- 2. Crea notifiche di test:
--    SELECT create_test_notifications('tuo-user-id');
--
-- 3. Vai nell'app e clicca sulla campanella - vedrai le notifiche!
--
-- 4. Per ripulire tutto:
--    SELECT delete_all_notifications('tuo-user-id');
-- =====================================================

COMMENT ON FUNCTION create_test_notifications IS 'Crea 6 notifiche di esempio per testare il sistema';
COMMENT ON FUNCTION delete_all_notifications IS 'Elimina tutte le notifiche di un utente per ripulire i test';
