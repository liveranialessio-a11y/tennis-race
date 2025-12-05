-- =====================================================
-- RIMUOVI TRIGGER NOTIFICHE CHE BLOCCA REGISTRAZIONE
-- =====================================================
-- Il trigger create_default_notification_preferences
-- causa errori durante la registrazione utente perché
-- tenta di inserire in notification_preferences prima
-- che l'utente sia completamente salvato in auth.users
-- =====================================================

-- Rimuovi il trigger che causa problemi durante signup
DROP TRIGGER IF EXISTS trigger_create_default_notification_preferences ON auth.users;

-- Rimuovi la funzione associata
DROP FUNCTION IF EXISTS create_default_notification_preferences();

COMMENT ON TABLE public.notification_preferences IS 'Tabella delle preferenze notifiche. Le preferenze vengono create manualmente quando necessario, non automaticamente alla registrazione.';
