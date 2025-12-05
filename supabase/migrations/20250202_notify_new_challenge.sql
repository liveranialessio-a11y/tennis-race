-- =====================================================
-- NOTIFICA: NUOVA SFIDA CREATA
-- =====================================================
-- Quando un utente crea una nuova sfida dal pulsante
-- "Nuova Sfida", l'avversario riceve una notifica
-- =====================================================

CREATE OR REPLACE FUNCTION notify_new_challenge()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
    opponent_id UUID;
    match_date TEXT;
BEGIN
    -- Verifica che:
    -- 1. Sia un INSERT (nuova sfida creata)
    -- 2. Sia una partita programmata (is_scheduled = true)
    -- 3. Il punteggio sia "Da giocare" (non ancora giocata)
    -- 4. Non sia una sfida in pending (challenge_status = NULL)
    IF NEW.is_scheduled = true
       AND NEW.score = 'Da giocare'
       AND NEW.challenge_status IS NULL
       AND NEW.winner_id IS NOT NULL
       AND NEW.loser_id IS NOT NULL THEN

        -- Ottieni il nome del creatore della sfida (winner_id)
        SELECT display_name INTO creator_name
        FROM public.players
        WHERE user_id = NEW.winner_id;

        -- L'avversario è il loser_id (colui che riceve la sfida)
        opponent_id := NEW.loser_id;

        -- Formatta la data della partita
        match_date := TO_CHAR(NEW.played_at, 'DD/MM/YYYY') || ' alle ' || TO_CHAR(NEW.played_at, 'HH24:MI');

        -- NOTIFICA ALL'AVVERSARIO
        PERFORM create_notification(
            opponent_id,
            'challenge_received',
            '📅 Nuova sfida ricevuta!',
            creator_name || ' ti ha lanciato una sfida programmata per il ' || match_date || '. Preparati a giocare! 🎾',
            NEW.id,
            'challenge',
            'swords'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rimuovi il vecchio trigger se esiste
DROP TRIGGER IF EXISTS trigger_notify_new_challenge ON public.matches;

-- Crea il nuovo trigger (solo per INSERT)
CREATE TRIGGER trigger_notify_new_challenge
    AFTER INSERT ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION notify_new_challenge();

COMMENT ON FUNCTION notify_new_challenge IS 'Crea notifica per l''avversario quando viene creata una nuova sfida dal pulsante "Nuova Sfida"';
