-- =====================================================
-- ABILITA REALTIME SULLA TABELLA NOTIFICATIONS
-- =====================================================
-- Questo permette di ricevere notifiche in tempo reale
-- senza dover ricaricare la pagina
-- =====================================================

-- Abilita la replica per la tabella notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Verifica che sia stata abilitata
-- (Questa query serve solo per verificare, puoi eseguirla separatamente)
-- SELECT schemaname, tablename
-- FROM pg_publication_tables
-- WHERE pubname = 'supabase_realtime';

COMMENT ON TABLE public.notifications IS 'Tabella notifiche con Realtime abilitato per aggiornamenti in tempo reale';
