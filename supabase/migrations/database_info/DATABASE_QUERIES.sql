-- =====================================================
-- QUERY PER DOCUMENTAZIONE DATABASE
-- =====================================================
-- Esegui queste query sul database di produzione
-- e incolla i risultati per creare la documentazione finale
-- =====================================================

-- =====================================================
-- QUERY 1: Lista di tutte le tabelle
-- =====================================================
SELECT
    table_name,
    table_type
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- =====================================================
-- QUERY 2: Schema completo della tabella "championships"
-- =====================================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'championships'
ORDER BY ordinal_position;

-- =====================================================
-- QUERY 3: Schema completo della tabella "players"
-- =====================================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'players'
ORDER BY ordinal_position;

-- =====================================================
-- QUERY 4: Schema completo della tabella "matches"
-- =====================================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'matches'
ORDER BY ordinal_position;

-- =====================================================
-- QUERY 5: Schema completo della tabella "registration_requests"
-- =====================================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'registration_requests'
ORDER BY ordinal_position;

-- =====================================================
-- QUERY 6: Schema completo della tabella "trophies"
-- =====================================================
SELECT
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public'
AND table_name = 'trophies'
ORDER BY ordinal_position;


-- =====================================================
-- QUERY 8: Lista di tutte le funzioni (stored procedures)
-- =====================================================
SELECT
    routine_name,
    routine_type,
    data_type as return_type
FROM information_schema.routines
WHERE routine_schema = 'public'
AND routine_type = 'FUNCTION'
ORDER BY routine_name;

-- =====================================================
-- QUERY 9: Lista di tutti i trigger
-- =====================================================
SELECT
    trigger_name,
    event_manipulation,
    event_object_table,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- =====================================================
-- QUERY 10: Lista di tutti gli indici
-- =====================================================
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- =====================================================
-- QUERY 11: Foreign Keys (relazioni tra tabelle)
-- =====================================================
SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'public'
ORDER BY tc.table_name, kcu.column_name;

-- =====================================================
-- QUERY 12: RLS Policies attive
-- =====================================================
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- =====================================================
-- QUERY 13: Statistiche rapide - Conteggio record per tabella
-- =====================================================
SELECT
    'championships' as table_name,
    COUNT(*) as record_count
FROM public.championships
UNION ALL
SELECT
    'players' as table_name,
    COUNT(*) as record_count
FROM public.players
UNION ALL
SELECT
    'matches' as table_name,
    COUNT(*) as record_count
FROM public.matches
UNION ALL
SELECT
    'registration_requests' as table_name,
    COUNT(*) as record_count
FROM public.registration_requests
UNION ALL
SELECT
    'trophies' as table_name,
    COUNT(*) as record_count
FROM public.trophies
ORDER BY table_name;

-- =====================================================
-- FINE QUERY
-- =====================================================
-- Esegui tutte queste query e incolla i risultati
-- separando ogni risultato con il numero della query
-- =====================================================
