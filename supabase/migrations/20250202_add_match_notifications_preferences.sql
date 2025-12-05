-- =====================================================
-- AGGIUNGI PREFERENZE: MODIFICA ORARIO E ELIMINAZIONE
-- =====================================================
-- Aggiunge le colonne per le preferenze di notifica
-- quando viene modificato l'orario o eliminata una partita
-- =====================================================

-- Aggiungi la colonna per modifica orario se non esiste
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS match_time_changed VARCHAR(20) DEFAULT 'both';

-- Aggiungi la colonna per eliminazione partita se non esiste
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS match_deleted VARCHAR(20) DEFAULT 'both';

-- Aggiorna le righe esistenti per avere il valore di default
UPDATE public.notification_preferences
SET match_time_changed = 'both'
WHERE match_time_changed IS NULL;

UPDATE public.notification_preferences
SET match_deleted = 'both'
WHERE match_deleted IS NULL;

COMMENT ON COLUMN public.notification_preferences.match_time_changed IS 'Notifica quando viene modificato l''orario di una partita programmata';
COMMENT ON COLUMN public.notification_preferences.match_deleted IS 'Notifica quando una partita o sfida viene eliminata';
