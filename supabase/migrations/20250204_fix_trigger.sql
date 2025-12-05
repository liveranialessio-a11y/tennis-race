-- =====================================================
-- FIX TRIGGER FUNCTION
-- Date: 2025-02-04
-- =====================================================
-- Corregge la sintassi del trigger per availability_status
-- =====================================================

CREATE OR REPLACE FUNCTION update_player_availability_on_match_change()
RETURNS TRIGGER AS $$
DECLARE
    v_affected_players UUID[];
    v_player UUID;
    v_has_active_matches BOOLEAN;
    v_is_suspended BOOLEAN;
BEGIN
    -- Determina quali giocatori sono coinvolti
    IF TG_OP = 'DELETE' THEN
        v_affected_players := ARRAY[OLD.winner_id, OLD.loser_id];
    ELSIF TG_OP = 'UPDATE' THEN
        v_affected_players := ARRAY[NEW.winner_id, NEW.loser_id, OLD.winner_id, OLD.loser_id];
    ELSE -- INSERT
        v_affected_players := ARRAY[NEW.winner_id, NEW.loser_id];
    END IF;

    -- Rimuovi duplicati e NULL
    SELECT ARRAY_AGG(DISTINCT player_id)
    INTO v_affected_players
    FROM unnest(v_affected_players) AS player_id
    WHERE player_id IS NOT NULL;

    -- Aggiorna lo stato di ciascun giocatore
    FOREACH v_player IN ARRAY v_affected_players
    LOOP
        -- Controlla se è sospeso
        SELECT EXISTS (
            SELECT 1 FROM public.player_suspensions
            WHERE user_id = v_player AND is_active = true
        ) INTO v_is_suspended;

        -- Se è sospeso, non cambiare lo stato
        IF v_is_suspended THEN
            CONTINUE;
        END IF;

        -- Controlla se ha match attivi
        SELECT EXISTS (
            SELECT 1 FROM public.matches
            WHERE challenge_status IS NULL
                AND score = 'Da giocare'
                AND (winner_id = v_player OR loser_id = v_player)
        ) INTO v_has_active_matches;

        -- Aggiorna lo stato
        UPDATE public.players
        SET availability_status = CASE
            WHEN v_has_active_matches THEN 'unavailable'::availability_status_enum
            ELSE 'available'::availability_status_enum
        END
        WHERE user_id = v_player;
    END LOOP;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION update_player_availability_on_match_change IS 'Aggiorna automaticamente lo stato di disponibilità dei giocatori quando cambiano i match (FIXED)';
