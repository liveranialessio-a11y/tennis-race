-- =====================================================
-- NOTIFICA: PARTITA/SFIDA ELIMINATA
-- =====================================================
-- Quando una partita o sfida viene eliminata,
-- entrambi i giocatori ricevono una notifica
-- =====================================================

CREATE OR REPLACE FUNCTION notify_match_deleted()
RETURNS TRIGGER AS $$
DECLARE
    player1_name TEXT;
    player2_name TEXT;
    match_date TEXT;
    match_type TEXT;
BEGIN
    -- Verifica che ci siano entrambi i giocatori
    IF OLD.winner_id IS NOT NULL AND OLD.loser_id IS NOT NULL THEN

        -- Ottieni i nomi dei giocatori
        SELECT display_name INTO player1_name
        FROM public.players
        WHERE user_id = OLD.winner_id;

        SELECT display_name INTO player2_name
        FROM public.players
        WHERE user_id = OLD.loser_id;

        -- Determina il tipo di match eliminato
        IF OLD.score = 'Da giocare' THEN
            match_type := 'partita programmata';
            match_date := TO_CHAR(OLD.played_at, 'DD/MM/YYYY') || ' alle ' || TO_CHAR(OLD.played_at, 'HH24:MI');
        ELSE
            match_type := 'partita';
            match_date := TO_CHAR(OLD.played_at, 'DD/MM/YYYY');
        END IF;

        -- NOTIFICA AL GIOCATORE 1
        PERFORM create_notification(
            OLD.winner_id,
            'match_deleted',
            '🗑️ Partita eliminata',
            'La ' || match_type || ' contro ' || player2_name ||
            CASE
                WHEN OLD.score = 'Da giocare' THEN ' prevista per il ' || match_date
                ELSE ' del ' || match_date
            END || ' è stata eliminata.',
            OLD.id,
            'match',
            'x-circle'
        );

        -- NOTIFICA AL GIOCATORE 2
        PERFORM create_notification(
            OLD.loser_id,
            'match_deleted',
            '🗑️ Partita eliminata',
            'La ' || match_type || ' contro ' || player1_name ||
            CASE
                WHEN OLD.score = 'Da giocare' THEN ' prevista per il ' || match_date
                ELSE ' del ' || match_date
            END || ' è stata eliminata.',
            OLD.id,
            'match',
            'x-circle'
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

COMMENT ON FUNCTION notify_match_deleted IS 'Crea notifiche quando una partita o sfida viene eliminata';
