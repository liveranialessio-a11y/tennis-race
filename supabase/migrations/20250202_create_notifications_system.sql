-- =====================================================
-- SISTEMA NOTIFICHE - SENZA RLS
-- =====================================================
-- Sicurezza gestita tramite:
-- 1. Service Role Key lato backend
-- 2. Validazione user_id nel frontend
-- 3. Policies a livello applicativo
-- =====================================================

-- Tabella notifiche
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'challenge_received', 'challenge_accepted', 'result_pending', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    related_id UUID, -- ID della sfida, match, etc.
    related_type VARCHAR(50), -- 'challenge', 'match', 'ranking', etc.
    icon VARCHAR(50), -- 'megaphone', 'racket', 'check-circle', etc.
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    read_at TIMESTAMPTZ
);

-- Indici per performance sulla tabella notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);

-- Tabella preferenze notifiche
CREATE TABLE IF NOT EXISTS public.notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Attivazione generale
    in_app_enabled BOOLEAN DEFAULT TRUE,
    push_enabled BOOLEAN DEFAULT FALSE,

    -- Notifiche specifiche (in_app, push, o disattivate)
    challenge_received VARCHAR(20) DEFAULT 'both', -- 'in_app', 'push', 'both', 'none'
    challenge_accepted VARCHAR(20) DEFAULT 'both',
    challenge_rejected VARCHAR(20) DEFAULT 'both',
    challenge_cancelled VARCHAR(20) DEFAULT 'in_app',
    challenge_reminder_24h VARCHAR(20) DEFAULT 'push',
    challenge_reminder_2h VARCHAR(20) DEFAULT 'push',

    result_pending VARCHAR(20) DEFAULT 'both',
    result_confirmed VARCHAR(20) DEFAULT 'in_app',
    result_contested VARCHAR(20) DEFAULT 'both',
    result_expiring VARCHAR(20) DEFAULT 'push',

    ranking_position_change VARCHAR(20) DEFAULT 'in_app',
    ranking_category_change VARCHAR(20) DEFAULT 'both',
    ranking_first_place VARCHAR(20) DEFAULT 'both',

    championship_new_season VARCHAR(20) DEFAULT 'in_app',
    championship_announcement VARCHAR(20) DEFAULT 'in_app',

    admin_new_registration VARCHAR(20) DEFAULT 'in_app',
    admin_contested_result VARCHAR(20) DEFAULT 'in_app',

    -- Modalità Non Disturbare
    dnd_enabled BOOLEAN DEFAULT FALSE,
    dnd_start_time TIME DEFAULT '22:00:00',
    dnd_end_time TIME DEFAULT '08:00:00',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indice per performance sulla tabella notification_preferences
CREATE INDEX IF NOT EXISTS idx_notification_prefs_user_id ON public.notification_preferences(user_id);

-- Tabella per i token push (per notifiche PWA)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, endpoint)
);

-- Indice per performance sulla tabella push_subscriptions
CREATE INDEX IF NOT EXISTS idx_push_subs_user_id ON public.push_subscriptions(user_id);

-- Funzione per aggiornare updated_at automaticamente
CREATE OR REPLACE FUNCTION update_notification_preferences_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per updated_at
CREATE TRIGGER trigger_update_notification_preferences_updated_at
    BEFORE UPDATE ON public.notification_preferences
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_preferences_updated_at();

-- Funzione per creare preferenze di default quando si registra un utente
CREATE OR REPLACE FUNCTION create_default_notification_preferences()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notification_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per creare preferenze automaticamente
CREATE TRIGGER trigger_create_default_notification_preferences
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION create_default_notification_preferences();

-- Commenti per documentazione
COMMENT ON TABLE public.notifications IS 'Tabella delle notifiche per gli utenti. Sicurezza gestita a livello applicativo.';
COMMENT ON TABLE public.notification_preferences IS 'Preferenze notifiche per ogni utente. Sicurezza gestita a livello applicativo.';
COMMENT ON TABLE public.push_subscriptions IS 'Token per notifiche push PWA. Sicurezza gestita a livello applicativo.';

-- Grants (accesso pubblico, sicurezza gestita dall''app)
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notification_preferences TO authenticated;
GRANT ALL ON public.push_subscriptions TO authenticated;

GRANT ALL ON public.notifications TO anon;
GRANT ALL ON public.notification_preferences TO anon;
GRANT ALL ON public.push_subscriptions TO anon;
