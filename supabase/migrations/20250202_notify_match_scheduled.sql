-- =====================================================
-- NOTIFICA: PARTITA PROGRAMMATA
-- =====================================================
-- Quando viene impostata la data/ora di una sfida accettata,
-- entrambi i giocatori ricevono una notifica
-- =====================================================

CREATE OR REPLACE FUNCTION notify_match_scheduled()
RETURNS TRIGGER AS $$
DECLARE
    player1_name TEXT;
    player2_name TEXT;
    match_date TEXT;
BEGIN
    -- Verifica che:
    -- 1. Sia un UPDATE (non un INSERT)
    -- 2. La data è stata appena impostata (OLD.played_at era NULL, NEW.played_at non è NULL)
    -- 3. Il punteggio è ancora "Da giocare" (non è ancora stata giocata)
    -- 4. Non è una sfida in pending (challenge_status = NULL o 'accettata')
    IF OLD IS NOT NULL
       AND OLD.played_at IS NULL
       AND NEW.played_at IS NOT NULL
       AND NEW.score = 'Da giocare'
       AND (NEW.challenge_status IS NULL OR NEW.challenge_status = 'accettata') THEN

        -- Ottieni i nomi dei giocatori
        SELECT display_name INTO player1_name
        FROM public.players
        WHERE user_id = NEW.winner_id;

        SELECT display_name INTO player2_name
        FROM public.players
        WHERE user_id = NEW.loser_id;

        -- Formatta la data della partita
        match_date := TO_CHAR(NEW.played_at, 'DD/MM/YYYY') || ' alle ' || TO_CHAR(NEW.played_at, 'HH24:MI');

        -- NOTIFICA AL GIOCATORE 1 (winner_id nella sfida)
        PERFORM create_notification(
            NEW.winner_id,
            'match_scheduled',
            '📅 Partita programmata!',
            'La tua partita contro ' || player2_name || ' è fissata per il ' || match_date || '. Preparati! 🎾',
            NEW.id,
            'match',
            'megaphone'
        );

        -- NOTIFICA AL GIOCATORE 2 (loser_id nella sfida)
        PERFORM create_notification(
            NEW.loser_id,
            'match_scheduled',
            '📅 Partita programmata!',
            'La tua partita contro ' || player1_name || ' è fissata per il ' || match_date || '. Preparati! 🎾',
            NEW.id,
            'match',
            'megaphone'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crea il trigger
CREATE TRIGGER trigger_notify_match_scheduled
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_match_scheduled();

COMMENT ON FUNCTION notify_match_scheduled IS 'Crea notifiche quando viene impostata la data/ora di una partita programmata';
