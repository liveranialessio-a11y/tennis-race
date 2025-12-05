-- =====================================================
-- PLAYER SUSPENSIONS SYSTEM
-- Date: 2025-02-04
-- =====================================================
-- Aggiunge il sistema di sospensione volontaria dei giocatori
-- =====================================================

-- 1. CREA ENUM per availability_status
CREATE TYPE availability_status_enum AS ENUM ('available', 'unavailable', 'suspended');

-- 2. AGGIUNGI colonna availability_status alla tabella players
ALTER TABLE public.players
ADD COLUMN availability_status availability_status_enum DEFAULT 'available' NOT NULL;

COMMENT ON COLUMN public.players.availability_status IS 'Stato disponibilità giocatore: available (verde), unavailable (rosso - ha match attivi), suspended (arancione - sospeso volontariamente)';

-- 3. CREA tabella player_suspensions
CREATE TABLE public.player_suspensions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    start_date TIMESTAMP WITH TIME ZONE NOT NULL,
    end_date TIMESTAMP WITH TIME ZONE NOT NULL,
    reason TEXT NOT NULL CHECK (char_length(reason) <= 200),
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,

    CONSTRAINT valid_date_range CHECK (end_date > start_date)
);

-- Indice unico parziale: un solo suspension attiva per utente
CREATE UNIQUE INDEX idx_one_active_suspension_per_user
    ON public.player_suspensions(user_id)
    WHERE is_active = true;

-- Indici per performance
CREATE INDEX idx_player_suspensions_user_id ON public.player_suspensions(user_id);
CREATE INDEX idx_player_suspensions_active ON public.player_suspensions(is_active) WHERE is_active = true;
CREATE INDEX idx_player_suspensions_end_date ON public.player_suspensions(end_date) WHERE is_active = true;

COMMENT ON TABLE public.player_suspensions IS 'Gestisce le sospensioni volontarie degli utenti (globali, non per campionato)';

-- 4. ABILITA RLS sulla tabella player_suspensions
ALTER TABLE public.player_suspensions ENABLE ROW LEVEL SECURITY;

-- Policy: I giocatori possono leggere solo le proprie sospensioni
CREATE POLICY "Players can view own suspensions"
    ON public.player_suspensions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Policy: I giocatori possono inserire solo le proprie sospensioni
CREATE POLICY "Players can insert own suspensions"
    ON public.player_suspensions
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policy: I giocatori possono aggiornare solo le proprie sospensioni
CREATE POLICY "Players can update own suspensions"
    ON public.player_suspensions
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Policy: Gli admin possono vedere tutte le sospensioni
CREATE POLICY "Admins can view all suspensions"
    ON public.player_suspensions
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.players
            WHERE user_id = auth.uid() AND is_admin = true
        )
    );

-- 5. FUNZIONE per creare una sospensione
CREATE OR REPLACE FUNCTION create_player_suspension(
    p_user_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE,
    p_end_date TIMESTAMP WITH TIME ZONE,
    p_reason TEXT
)
RETURNS UUID AS $$
DECLARE
    v_suspension_id UUID;
    v_cancelled_challenges INT := 0;
    v_opponent_id UUID;
    v_player_name TEXT;
    v_opponent_name TEXT;
BEGIN
    -- Verifica che l'utente esista
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
        RAISE EXCEPTION 'Utente non trovato';
    END IF;

    -- Verifica che non ci siano già sospensioni attive
    IF EXISTS (SELECT 1 FROM public.player_suspensions WHERE user_id = p_user_id AND is_active = true) THEN
        RAISE EXCEPTION 'Esiste già una sospensione attiva per questo utente';
    END IF;

    -- Ottieni il nome del giocatore (prendi il primo display_name trovato)
    SELECT display_name INTO v_player_name
    FROM public.players
    WHERE user_id = p_user_id
    LIMIT 1;

    -- Crea la sospensione
    INSERT INTO public.player_suspensions (user_id, start_date, end_date, reason, is_active)
    VALUES (p_user_id, p_start_date, p_end_date, p_reason, true)
    RETURNING id INTO v_suspension_id;

    -- Aggiorna lo stato in TUTTI i record players dell'utente (se ha multipli campionati)
    UPDATE public.players
    SET availability_status = 'suspended'
    WHERE user_id = p_user_id;

    -- Annulla tutte le sfide attive (score = 'Da giocare') in TUTTI i campionati
    -- Notifica gli avversari
    FOR v_opponent_id, v_opponent_name IN
        SELECT DISTINCT
            CASE
                WHEN m.winner_id = p_user_id THEN m.loser_id
                ELSE m.winner_id
            END as opponent_id,
            CASE
                WHEN m.winner_id = p_user_id THEN pl.display_name
                ELSE pw.display_name
            END as opponent_name
        FROM public.matches m
        LEFT JOIN public.players pw ON m.winner_id = pw.user_id
        LEFT JOIN public.players pl ON m.loser_id = pl.user_id
        WHERE m.challenge_status IS NULL
            AND m.score = 'Da giocare'
            AND (m.winner_id = p_user_id OR m.loser_id = p_user_id)
    LOOP
        -- Invia notifica all'avversario
        PERFORM create_notification(
            v_opponent_id,
            'challenge_cancelled',
            '❌ Sfida annullata',
            'La tua sfida con ' || v_player_name || ' è stata annullata perché il giocatore è temporaneamente impossibilitato a giocare.',
            NULL,
            'challenge',
            'x-circle'
        );
    END LOOP;

    -- Elimina tutte le sfide attive in TUTTI i campionati
    DELETE FROM public.matches
    WHERE challenge_status IS NULL
        AND score = 'Da giocare'
        AND (winner_id = p_user_id OR loser_id = p_user_id);

    RETURN v_suspension_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION create_player_suspension IS 'Crea una nuova sospensione globale per un utente, annulla le sfide attive in tutti i campionati e notifica gli avversari';

-- 6. FUNZIONE per rimuovere una sospensione (anticipata)
CREATE OR REPLACE FUNCTION remove_player_suspension(p_user_id UUID)
RETURNS VOID AS $$
DECLARE
    v_has_active_matches BOOLEAN;
BEGIN
    -- Disattiva la sospensione
    UPDATE public.player_suspensions
    SET is_active = false, updated_at = now()
    WHERE user_id = p_user_id AND is_active = true;

    -- Controlla se l'utente ha match attivi in qualsiasi campionato
    SELECT EXISTS (
        SELECT 1 FROM public.matches
        WHERE challenge_status IS NULL
            AND score = 'Da giocare'
            AND (winner_id = p_user_id OR loser_id = p_user_id)
    ) INTO v_has_active_matches;

    -- Aggiorna lo stato in TUTTI i record players dell'utente
    UPDATE public.players
    SET availability_status = CASE
        WHEN v_has_active_matches THEN 'unavailable'::availability_status_enum
        ELSE 'available'::availability_status_enum
    END
    WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION remove_player_suspension IS 'Rimuove la sospensione globale di un utente e aggiorna lo stato di disponibilità in tutti i campionati';

-- 7. FUNZIONE per verificare sospensioni scadute e inviare notifiche
CREATE OR REPLACE FUNCTION check_expired_suspensions()
RETURNS TABLE(user_id UUID, player_name TEXT, player_email TEXT) AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        ps.user_id,
        p.display_name,
        au.email
    FROM public.player_suspensions ps
    JOIN public.players p ON ps.user_id = p.user_id
    JOIN auth.users au ON ps.user_id = au.id
    WHERE ps.is_active = true
        AND ps.end_date <= now()
    ORDER BY ps.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION check_expired_suspensions IS 'Restituisce gli utenti con sospensioni scadute che devono essere riattivati';

-- 8. FUNZIONE per ottenere la sospensione attiva di un utente
CREATE OR REPLACE FUNCTION get_active_suspension(p_user_id UUID)
RETURNS TABLE(
    id UUID,
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE,
    reason TEXT,
    is_expired BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        ps.id,
        ps.start_date,
        ps.end_date,
        ps.reason,
        ps.end_date <= now() as is_expired
    FROM public.player_suspensions ps
    WHERE ps.user_id = p_user_id
        AND ps.is_active = true
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_active_suspension IS 'Ottiene la sospensione attiva di un utente se presente';

-- 9. TRIGGER per aggiornare automaticamente availability_status quando cambiano i match
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
    v_affected_players := ARRAY(SELECT DISTINCT unnest(v_affected_players) WHERE unnest IS NOT NULL);

    -- Aggiorna lo stato di ciascun giocatore
    FOREACH v_player IN ARRAY v_affected_players
    LOOP
        -- Controlla se è sospeso
        SELECT EXISTS (
            SELECT 1 FROM public.player_suspensions
            WHERE player_id = v_player AND is_active = true
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

-- Crea i trigger sulla tabella matches
DROP TRIGGER IF EXISTS update_availability_on_match_insert ON public.matches;
CREATE TRIGGER update_availability_on_match_insert
    AFTER INSERT ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_player_availability_on_match_change();

DROP TRIGGER IF EXISTS update_availability_on_match_update ON public.matches;
CREATE TRIGGER update_availability_on_match_update
    AFTER UPDATE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_player_availability_on_match_change();

DROP TRIGGER IF EXISTS update_availability_on_match_delete ON public.matches;
CREATE TRIGGER update_availability_on_match_delete
    AFTER DELETE ON public.matches
    FOR EACH ROW
    EXECUTE FUNCTION update_player_availability_on_match_change();

COMMENT ON FUNCTION update_player_availability_on_match_change IS 'Aggiorna automaticamente lo stato di disponibilità dei giocatori quando cambiano i match';
