-- =====================================================
-- AGGIUNGI PREFERENZA: PARTITA PROGRAMMATA
-- =====================================================
-- Aggiunge la colonna per la preferenza di notifica
-- quando viene programmata una partita
-- =====================================================

-- Aggiungi la colonna se non esiste
ALTER TABLE public.notification_preferences
ADD COLUMN IF NOT EXISTS match_scheduled VARCHAR(20) DEFAULT 'both';

-- Aggiorna le righe esistenti per avere il valore di default
UPDATE public.notification_preferences
SET match_scheduled = 'both'
WHERE match_scheduled IS NULL;

COMMENT ON COLUMN public.notification_preferences.match_scheduled IS 'Notifica quando viene programmata una partita (data/ora impostata)';
