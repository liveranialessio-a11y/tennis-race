-- =====================================================
-- CREATE TROPHIES TABLE
-- =====================================================
-- Tabella per gestire i trofei dei giocatori
-- =====================================================

CREATE TABLE IF NOT EXISTS public.trophies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  trophy_type TEXT NOT NULL CHECK (trophy_type IN ('pro_master_rank', 'tournament')),
  position INTEGER NOT NULL CHECK (position >= 1 AND position <= 3),
  tournament_title TEXT,
  awarded_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT tournament_title_required_for_tournament
    CHECK (
      (trophy_type = 'tournament' AND tournament_title IS NOT NULL) OR
      (trophy_type = 'pro_master_rank')
    )
);

-- Index per ottimizzare le query
CREATE INDEX idx_trophies_player_id ON public.trophies(player_id);
CREATE INDEX idx_trophies_championship_id ON public.trophies(championship_id);
CREATE INDEX idx_trophies_trophy_type ON public.trophies(trophy_type);
CREATE INDEX idx_trophies_awarded_date ON public.trophies(awarded_date DESC);

-- Enable RLS
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;

-- Policy: everyone can read trophies
CREATE POLICY "Trophies are viewable by everyone"
  ON public.trophies FOR SELECT
  USING (true);

-- Policy: only admins can insert trophies
CREATE POLICY "Only admins can insert trophies"
  ON public.trophies FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Policy: only admins can delete trophies
CREATE POLICY "Only admins can delete trophies"
  ON public.trophies FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.players
      WHERE user_id = auth.uid() AND is_admin = true
    )
  );

-- Comment on table
COMMENT ON TABLE public.trophies IS 'Trofei assegnati ai giocatori';
