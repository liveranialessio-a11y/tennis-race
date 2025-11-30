-- =====================================================
-- SMASHRANK SCHEMA - Sistema di Campionati con ELO
-- =====================================================

-- FUNZIONE: update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tabella: championships
CREATE TABLE public.championships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_public BOOLEAN NOT NULL DEFAULT true,
  enable_set_bonus BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabella: players
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  current_rank NUMERIC NOT NULL DEFAULT 1500,
  previous_rank NUMERIC NOT NULL DEFAULT 1500,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, championship_id)
);

-- Tabella: matches
CREATE TABLE public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score VARCHAR(50) NOT NULL,
  played_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  winner_points_gained NUMERIC,
  loser_points_lost NUMERIC,
  is_validated BOOLEAN NOT NULL DEFAULT false,
  reported_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

-- RLS POLICIES - Championships
CREATE POLICY "Anyone can view public championships" ON public.championships
  FOR SELECT USING (is_public = true);

CREATE POLICY "Admins can view their championships" ON public.championships
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Authenticated users can create championships" ON public.championships
  FOR INSERT WITH CHECK (auth.uid() = admin_id);

CREATE POLICY "Admins can update their championships" ON public.championships
  FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "Admins can delete their championships" ON public.championships
  FOR DELETE USING (admin_id = auth.uid());

-- RLS POLICIES - Players
CREATE POLICY "Anyone can view players in public championships" ON public.players
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.championships 
      WHERE championships.id = players.championship_id 
      AND championships.is_public = true
    )
  );

CREATE POLICY "Players can view themselves" ON public.players
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can register to championships" ON public.players
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Players can update their display_name" ON public.players
  FOR UPDATE USING (user_id = auth.uid());

-- RLS POLICIES - Matches
CREATE POLICY "Anyone can view validated matches in public championships" ON public.matches
  FOR SELECT USING (
    is_validated = true AND
    EXISTS (
      SELECT 1 FROM public.championships 
      WHERE championships.id = matches.championship_id 
      AND championships.is_public = true
    )
  );

CREATE POLICY "Players can view their own matches" ON public.matches
  FOR SELECT USING (
    winner_id = auth.uid() OR loser_id = auth.uid()
  );

CREATE POLICY "Users can create matches they're involved in" ON public.matches
  FOR INSERT WITH CHECK (
    reported_by = auth.uid() AND
    (winner_id = auth.uid() OR loser_id = auth.uid())
  );

CREATE POLICY "Losers can validate matches" ON public.matches
  FOR UPDATE USING (
    loser_id = auth.uid() AND
    is_validated = false
  );

-- TRIGGERS
CREATE TRIGGER update_championships_updated_at
  BEFORE UPDATE ON public.championships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FUNZIONE: Calcolo ELO
CREATE OR REPLACE FUNCTION public.calculate_elo_on_validation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  winner_player RECORD;
  loser_player RECORD;
  winner_expected NUMERIC;
  loser_expected NUMERIC;
  winner_k NUMERIC;
  loser_k NUMERIC;
  multiplier NUMERIC := 1.0;
  winner_delta NUMERIC;
  loser_delta NUMERIC;
BEGIN
  IF NEW.is_validated = true AND OLD.is_validated = false THEN
    
    SELECT * INTO winner_player FROM public.players 
    WHERE user_id = NEW.winner_id AND championship_id = NEW.championship_id;
    
    SELECT * INTO loser_player FROM public.players 
    WHERE user_id = NEW.loser_id AND championship_id = NEW.championship_id;
    
    IF winner_player.matches_played <= 10 THEN
      winner_k := 48;
    ELSIF winner_player.matches_played <= 30 THEN
      winner_k := 32;
    ELSE
      winner_k := 16;
    END IF;
    
    IF loser_player.matches_played <= 10 THEN
      loser_k := 48;
    ELSIF loser_player.matches_played <= 30 THEN
      loser_k := 32;
    ELSE
      loser_k := 16;
    END IF;
    
    IF (SELECT enable_set_bonus FROM public.championships WHERE id = NEW.championship_id) THEN
      IF NEW.score !~ '\d+-\d+\s+\d+-\d+\s+\d+-\d+' THEN
        multiplier := 1.15;
      END IF;
    END IF;
    
    winner_expected := 1.0 / (1.0 + POWER(10, (loser_player.current_rank - winner_player.current_rank) / 400.0));
    loser_expected := 1.0 / (1.0 + POWER(10, (winner_player.current_rank - loser_player.current_rank) / 400.0));
    
    winner_delta := ROUND(winner_k * multiplier * (1 - winner_expected), 2);
    loser_delta := ROUND(loser_k * (0 - loser_expected), 2);
    
    UPDATE public.players
    SET 
      previous_rank = current_rank,
      current_rank = current_rank + winner_delta,
      wins = wins + 1,
      matches_played = matches_played + 1,
      updated_at = now()
    WHERE user_id = NEW.winner_id AND championship_id = NEW.championship_id;
    
    UPDATE public.players
    SET 
      previous_rank = current_rank,
      current_rank = current_rank + loser_delta,
      losses = losses + 1,
      matches_played = matches_played + 1,
      updated_at = now()
    WHERE user_id = NEW.loser_id AND championship_id = NEW.championship_id;
    
    NEW.winner_points_gained := winner_delta;
    NEW.loser_points_lost := loser_delta;
    
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER calculate_elo_after_validation
  BEFORE UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_elo_on_validation();
