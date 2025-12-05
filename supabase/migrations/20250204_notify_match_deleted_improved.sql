-- =====================================================
-- NOTIFICA: PARTITA/SFIDA ELIMINATA (MIGLIORATA)
-- Date: 2025-02-04
-- =====================================================
-- Gestisce 4 tipi di eliminazione con messaggi specifici:
-- 1. Sfida lanciata (ancora da accettare)
-- 2. Sfida accettata (senza data/ora)
-- 3. Sfida programmata (con data/ora, non giocata)
-- 4. Partita giocata (con risultato da registrare)
-- =====================================================

CREATE OR REPLACE FUNCTION notify_match_deleted()
RETURNS TRIGGER AS $$
DECLARE
    current_user_id UUID;
    deleter_name TEXT;
    opponent_id UUID;
    opponent_name TEXT;
    match_date TEXT;
BEGIN
    -- Ottieni l'ID dell'utente autenticato (chi ha fatto l'eliminazione)
    current_user_id := auth.uid();

    -- Se non riusciamo a ottenere l'utente corrente, esci
    IF current_user_id IS NULL THEN
        RETURN OLD;
    END IF;

    -- Determina chi è l'avversario (chi NON ha eliminato)
    IF OLD.winner_id = current_user_id THEN
        opponent_id := OLD.loser_id;
    ELSIF OLD.loser_id = current_user_id THEN
        opponent_id := OLD.winner_id;
    ELSE
        -- L'utente corrente non è coinvolto in questa sfida, esci
        RETURN OLD;
    END IF;

    -- Ottieni i nomi dei giocatori
    SELECT display_name INTO deleter_name
    FROM public.players
    WHERE user_id = current_user_id;

    SELECT display_name INTO opponent_name
    FROM public.players
    WHERE user_id = opponent_id;

    -- Formatta la data se presente
    IF OLD.played_at IS NOT NULL THEN
        match_date := TO_CHAR(OLD.played_at, 'DD/MM/YYYY') || ' alle ' || TO_CHAR(OLD.played_at, 'HH24:MI');
    END IF;

    -- CASO 1: SFIDA LANCIATA (ancora da accettare/rifiutare)
    IF OLD.challenge_status = 'lanciata' AND OLD.challenge_launcher_id IS NOT NULL THEN

        -- Messaggio: "ha ritirato il lancio della sfida"
        PERFORM create_notification(
            opponent_id,
            'challenge_withdrawn',
            '🔙 Sfida ritirata',
            deleter_name || ' ha ritirato il lancio della sfida',
            NULL,
            'challenge',
            'alert-circle'
        );

    -- CASO 2: SFIDA ACCETTATA (senza data/ora impostata)
    ELSIF OLD.challenge_status = 'accettata' AND OLD.challenge_launcher_id IS NOT NULL THEN

        -- Notifica solo all'avversario
        PERFORM create_notification(
            opponent_id,
            'challenge_deleted',
            '🗑️ Sfida eliminata',
            'La sfida con ' || deleter_name || ' è stata eliminata',
            NULL,
            'challenge',
            'alert-circle'
        );

    -- CASO 3: SFIDA PROGRAMMATA (con data/ora, non ancora giocata)
    ELSIF OLD.challenge_status IS NULL
          AND OLD.challenge_launcher_id IS NOT NULL
          AND OLD.score = 'In attesa'
          AND OLD.is_scheduled = true THEN

        -- Notifica solo all'avversario
        PERFORM create_notification(
            opponent_id,
            'match_deleted',
            '🗑️ Sfida programmata eliminata',
            'La sfida contro ' || deleter_name || ' del ' || match_date || ' è stata eliminata',
            NULL,
            'match',
            'alert-circle'
        );

    -- CASO 4: PARTITA GIOCATA (con risultato da registrare)
    ELSIF OLD.challenge_status IS NULL
          AND OLD.challenge_launcher_id IS NULL
          AND OLD.score = 'Da giocare'
          AND OLD.is_scheduled = true
          AND OLD.played_at < NOW() THEN

        -- Notifica solo all'avversario
        PERFORM create_notification(
            opponent_id,
            'match_deleted',
            '🗑️ Partita giocata eliminata',
            'La partita giocata contro ' || deleter_name || ' del ' || match_date || ' è stata eliminata',
            NULL,
            'match',
            'alert-circle'
        );

    END IF;

    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi il vecchio trigger se esiste
DROP TRIGGER IF EXISTS trigger_notify_match_deleted ON public.matches;

-- Crea il nuovo trigger
CREATE TRIGGER trigger_notify_match_deleted
    BEFORE DELETE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_deleted();

COMMENT ON FUNCTION notify_match_deleted IS 'Crea notifiche specifiche quando una sfida/partita viene eliminata (4 casi gestiti)';
