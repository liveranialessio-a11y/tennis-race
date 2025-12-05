-- =====================================================
-- ALLOW ALL USERS TO READ ALL SUSPENSIONS
-- Date: 2025-02-05
-- =====================================================
-- Permette a tutti gli utenti autenticati di vedere le sospensioni
-- degli altri giocatori (necessario per mostrare lo stato nella classifica)
-- =====================================================

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Players can view own suspensions" ON public.player_suspensions;

-- Create new policy: tutti gli utenti autenticati possono vedere tutte le sospensioni attive
CREATE POLICY "Authenticated users can view all suspensions"
    ON public.player_suspensions
    FOR SELECT
    USING (auth.role() = 'authenticated');

COMMENT ON POLICY "Authenticated users can view all suspensions" ON public.player_suspensions
IS 'Permette a tutti gli utenti autenticati di vedere le sospensioni degli altri giocatori per mostrare lo stato nella classifica';
