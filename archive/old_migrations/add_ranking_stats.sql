-- Aggiungi colonne per tracciare la migliore posizione in ogni categoria
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS best_position_in_gold INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS best_position_in_silver INTEGER DEFAULT NULL,
ADD COLUMN IF NOT EXISTS best_position_in_bronze INTEGER DEFAULT NULL;

-- Imposta i valori iniziali basandosi sulla categoria e posizione corrente
UPDATE public.players
SET best_position_in_gold =
  CASE
    WHEN live_rank_category = 'gold' THEN live_rank_position
    ELSE NULL
  END,
best_position_in_silver =
  CASE
    WHEN live_rank_category = 'silver' THEN live_rank_position
    WHEN live_rank_category = 'gold' THEN NULL -- Se ora e' gold, potrebbe essere stato silver prima
    ELSE NULL
  END,
best_position_in_bronze =
  CASE
    WHEN live_rank_category = 'bronze' THEN live_rank_position
    ELSE NULL
  END
WHERE best_position_in_gold IS NULL
  AND best_position_in_silver IS NULL
  AND best_position_in_bronze IS NULL;

-- Crea una funzione per aggiornare la migliore posizione nella categoria
CREATE OR REPLACE FUNCTION update_best_position_in_category()
RETURNS TRIGGER AS $$
BEGIN
  -- Aggiorna la migliore posizione nella categoria corrente
  IF NEW.live_rank_category = 'gold' THEN
    -- Se e' la prima volta in gold o se la posizione e' migliore
    IF OLD.best_position_in_gold IS NULL OR NEW.live_rank_position < OLD.best_position_in_gold THEN
      NEW.best_position_in_gold := NEW.live_rank_position;
    END IF;
  ELSIF NEW.live_rank_category = 'silver' THEN
    IF OLD.best_position_in_silver IS NULL OR NEW.live_rank_position < OLD.best_position_in_silver THEN
      NEW.best_position_in_silver := NEW.live_rank_position;
    END IF;
  ELSIF NEW.live_rank_category = 'bronze' THEN
    IF OLD.best_position_in_bronze IS NULL OR NEW.live_rank_position < OLD.best_position_in_bronze THEN
      NEW.best_position_in_bronze := NEW.live_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crea il trigger per aggiornare automaticamente la migliore posizione
DROP TRIGGER IF EXISTS on_position_change ON public.players;
CREATE TRIGGER on_position_change
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  WHEN (OLD.live_rank_position IS DISTINCT FROM NEW.live_rank_position
        OR OLD.live_rank_category IS DISTINCT FROM NEW.live_rank_category)
  EXECUTE FUNCTION update_best_position_in_category();
