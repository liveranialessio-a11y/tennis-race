-- =====================================================
-- FIX: Classifica Attuale (riccardo oragni duplicato in pos 1)
-- =====================================================
-- Problema: Alessio e riccardo sono entrambi in posizione 1
-- Soluzione: riccardo deve andare in posizione 2 (ha perso contro Alessio)
-- =====================================================

-- Fix riccardo oragni position (ha perso contro Alessio, quindi va in pos 2)
UPDATE public.players
SET
  live_rank_position = 2,
  live_rank_category = 'gold',
  updated_at = now()
WHERE display_name = 'riccardo oragni';

-- Verifica la classifica dopo il fix
SELECT
  p.display_name,
  p.live_rank_position,
  p.live_rank_category,
  p.wins,
  p.losses
FROM public.players p
WHERE p.championship_id = (SELECT id FROM public.championships LIMIT 1)
ORDER BY p.live_rank_position ASC;
