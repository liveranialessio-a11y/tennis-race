-- =====================================================
-- Migration: Add previous position tracking for arrows
-- Date: 2025-01-26
-- =====================================================
-- Aggiunge il tracking della posizione precedente per mostrare
-- le frecce di movimento in classifica (demolition + sfide)
-- =====================================================

-- Aggiungi colonna per tracciare la posizione precedente
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS previous_live_rank_position INTEGER;

COMMENT ON COLUMN public.players.previous_live_rank_position IS 'Posizione precedente in classifica live. Usata per mostrare frecce di movimento (↑ migliorato, ↓ peggiorato). Viene aggiornata dopo inactivity demolition e dopo sfide completate.';

-- Inizializza la colonna con i valori attuali per i giocatori esistenti
UPDATE public.players
SET previous_live_rank_position = live_rank_position
WHERE previous_live_rank_position IS NULL;
