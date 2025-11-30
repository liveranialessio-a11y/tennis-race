-- =====================================================
-- CLEANUP: Remove Debug Functions
-- =====================================================

DROP FUNCTION IF EXISTS public.debug_step1_inactive_demotion(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.debug_step2_active_order(UUID, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.debug_step3_fill_holes(UUID, INTEGER) CASCADE;
