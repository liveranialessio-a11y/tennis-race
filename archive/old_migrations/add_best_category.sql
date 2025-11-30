-- Aggiungi colonna best_category alla tabella players
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS best_category TEXT DEFAULT 'bronze';

-- Imposta il valore iniziale basandosi sulla categoria corrente
UPDATE public.players
SET best_category = live_rank_category
WHERE best_category IS NULL OR best_category = 'bronze';

-- Crea una funzione per aggiornare best_category quando la categoria migliora
CREATE OR REPLACE FUNCTION update_best_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Ordine delle categorie: gold = 1, silver = 2, bronze = 3
  -- Se la nuova categoria è migliore (numero più basso), aggiorna best_category
  IF NEW.live_rank_category IS NOT NULL THEN
    CASE
      WHEN NEW.live_rank_category = 'gold' THEN
        -- Gold è sempre la migliore
        NEW.best_category := 'gold';
      WHEN NEW.live_rank_category = 'silver' THEN
        -- Silver è migliore solo se best_category era bronze
        IF OLD.best_category IS NULL OR OLD.best_category = 'bronze' THEN
          NEW.best_category := 'silver';
        END IF;
      WHEN NEW.live_rank_category = 'bronze' THEN
        -- Bronze non migliora nulla, mantieni best_category esistente
        IF OLD.best_category IS NULL THEN
          NEW.best_category := 'bronze';
        END IF;
      ELSE
        NULL;
    END CASE;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger per aggiornare automaticamente best_category
DROP TRIGGER IF EXISTS on_category_change ON public.players;
CREATE TRIGGER on_category_change
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  WHEN (OLD.live_rank_category IS DISTINCT FROM NEW.live_rank_category)
  EXECUTE FUNCTION update_best_category();
