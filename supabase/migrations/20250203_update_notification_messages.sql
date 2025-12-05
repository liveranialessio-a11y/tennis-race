-- =====================================================
-- UPDATE NOTIFICATION MESSAGES
-- Date: 2025-02-03
-- =====================================================
-- Aggiorna i messaggi delle notifiche per renderli più chiari
-- =====================================================

-- 1. MODIFICA: Sfida ricevuta - rimuove la data e aggiunge CTA
CREATE OR REPLACE FUNCTION notify_new_challenge()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
    opponent_id UUID;
BEGIN
    -- Verifica che sia una nuova sfida creata con il pulsante "Nuova Sfida"
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

        -- NOTIFICA ALL'AVVERSARIO (MESSAGGIO AGGIORNATO)
        PERFORM create_notification(
            opponent_id,
            'challenge_received',
            '📅 Nuova sfida ricevuta!',
            creator_name || ' ti ha lanciato una sfida! Corri ad accettarla!',
            NEW.id,
            'challenge',
            'swords'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_new_challenge IS 'Crea notifica per l''avversario quando viene creata una nuova sfida (messaggio aggiornato)';


-- 2. MODIFICA: Risultato perdente - aggiunge info sul punto Pro Master guadagnato
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

        -- Calcola i punti master
        winner_points := 3;
        loser_points := 1;

        -- NOTIFICA AL VINCITORE
        PERFORM create_notification(
            NEW.winner_id,
            'result_confirmed',
            '🏆 Vittoria!',
            'Hai vinto contro ' || loser_name || ' con il punteggio ' || match_score || '. Hai guadagnato ' || winner_points || ' punti Pro Master! 🎾',
            NEW.id,
            'match',
            'trophy'
        );

        -- NOTIFICA AL PERDENTE (MESSAGGIO AGGIORNATO)
        PERFORM create_notification(
            NEW.loser_id,
            'result_confirmed',
            'Partita conclusa',
            'Hai perso contro ' || winner_name || ' con il punteggio ' || match_score || '. Hai comunque guadagnato ' || loser_points || ' punto Pro Master. Continua ad allenarti! 💪',
            NEW.id,
            'match',
            'alert-circle'
        );

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION notify_result_inserted IS 'Crea notifiche dettagliate per vincitore e perdente quando viene inserito un risultato (messaggi aggiornati)';
