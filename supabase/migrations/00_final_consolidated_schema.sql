-- =====================================================
-- SMASHRANK PRODUCTION SCHEMA
-- Consolidated from all migrations
-- Generated: 2025-01-23
-- =====================================================
-- This file represents the complete and final database schema
-- consolidating all previous migrations into a single source of truth.
-- Use this to recreate the database from scratch.
-- =====================================================

-- =====================================================
-- SECTION 1: EXTENSIONS
-- =====================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- SECTION 2: TABLES
-- =====================================================

-- -----------------------------------------------------
-- TABLE: championships
-- -----------------------------------------------------
-- Main table for tournament championships
CREATE TABLE IF NOT EXISTS public.championships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  admin_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE,
  end_date DATE,
  is_public BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Monthly parameters
  min_matches_required INTEGER DEFAULT 2 NOT NULL CHECK (min_matches_required >= 0 AND min_matches_required <= 10),
  min_matches_for_points INTEGER DEFAULT 1 NOT NULL CHECK (min_matches_for_points >= 0 AND min_matches_for_points <= 10),

  -- Pro Master points configuration
  first_place_points INTEGER DEFAULT 500 NOT NULL CHECK (first_place_points >= 0),

  -- Category player counters
  gold_players_count INTEGER DEFAULT 0,
  silver_players_count INTEGER DEFAULT 0,
  bronze_players_count INTEGER DEFAULT 0
);

COMMENT ON TABLE public.championships IS 'Tournament championships with monthly parameters and category counters';
COMMENT ON COLUMN public.championships.min_matches_required IS 'Minimum number of matches required per month to be considered active. Players below this threshold will be demoted.';
COMMENT ON COLUMN public.championships.min_matches_for_points IS 'Minimum number of matches required per month to receive Pro Master points.';
COMMENT ON COLUMN public.championships.first_place_points IS 'Pro Master points awarded to 1st place (position 1). All other positions receive proportionally fewer points based on their rank. Last of Gold gets more than first of Silver automatically.';
COMMENT ON COLUMN public.championships.gold_players_count IS 'Number of players in gold category';
COMMENT ON COLUMN public.championships.silver_players_count IS 'Number of players in silver category';
COMMENT ON COLUMN public.championships.bronze_players_count IS 'Number of players in bronze category';

-- -----------------------------------------------------
-- TABLE: players
-- -----------------------------------------------------
-- Player records in championships
-- NOTE: Statistics (wins, losses, sets) are calculated dynamically from matches table
CREATE TABLE IF NOT EXISTS public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  phone TEXT,
  avatar_url TEXT,

  -- Live ranking (global positions 1-30)
  live_rank_position INTEGER,
  live_rank_category VARCHAR(20) CHECK (live_rank_category IN ('gold', 'silver', 'bronze')),
  best_live_rank INTEGER,
  best_category VARCHAR(20) CHECK (best_category IN ('gold', 'silver', 'bronze')),

  -- Pro Master ranking
  pro_master_points INTEGER DEFAULT 0,
  pro_master_rank_position INTEGER,
  best_pro_master_rank INTEGER,

  -- Monthly tracking
  matches_this_month INTEGER DEFAULT 0,
  last_match_date TIMESTAMP WITH TIME ZONE,

  -- Admin flag
  is_admin BOOLEAN DEFAULT false,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  UNIQUE(user_id, championship_id)
);

COMMENT ON TABLE public.players IS 'Player records for championships. Statistics (wins, losses, sets, etc.) are calculated dynamically from the matches table using get_filtered_player_stats function.';
COMMENT ON COLUMN public.players.best_live_rank IS 'Best live rank position ever achieved by this player (global system: 1-30). Lower is better. Updated automatically via trigger.';

-- -----------------------------------------------------
-- TABLE: matches
-- -----------------------------------------------------
-- Match records between players and challenge system
CREATE TABLE IF NOT EXISTS public.matches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  winner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loser_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score VARCHAR(50),
  played_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  is_scheduled BOOLEAN DEFAULT false,
  is_draw BOOLEAN DEFAULT false,
  challenge_status TEXT CHECK (challenge_status IS NULL OR challenge_status IN ('lanciata', 'accettata')),
  challenge_launcher_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.matches IS 'Match records and challenge system. Player statistics (wins, losses, sets, draws) are calculated dynamically using get_filtered_player_stats function. Position swapping and stats only apply when challenge_status IS NULL (completed matches).';
COMMENT ON COLUMN public.matches.challenge_status IS 'Challenge status: lanciata (launched, waiting acceptance), accettata (accepted, waiting date/time), NULL (normal match or completed challenge)';
COMMENT ON COLUMN public.matches.challenge_launcher_id IS 'User ID of the player who launched the challenge';

-- Create index for challenge_status
CREATE INDEX IF NOT EXISTS idx_matches_challenge_status ON public.matches(challenge_status) WHERE challenge_status IS NOT NULL;

-- -----------------------------------------------------
-- TABLE: registration_requests
-- -----------------------------------------------------
-- Pending registration requests from new users
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  phone TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rejected_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, championship_id)
);

COMMENT ON TABLE public.registration_requests IS 'Stores pending registration requests from new users waiting for admin approval';

-- -----------------------------------------------------
-- TABLE: monthly_snapshots
-- -----------------------------------------------------
-- Monthly snapshots of player rankings for historical tracking
CREATE TABLE IF NOT EXISTS public.monthly_snapshots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  championship_id UUID NOT NULL REFERENCES public.championships(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name VARCHAR(255) NOT NULL,
  live_rank_position INTEGER,
  live_rank_category VARCHAR(20),
  pro_master_points INTEGER DEFAULT 0,
  pro_master_rank_position INTEGER,
  matches_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(championship_id, month, player_id)
);

COMMENT ON TABLE public.monthly_snapshots IS 'Monthly snapshots of player rankings for historical tracking and analysis';

-- -----------------------------------------------------
-- TABLE: trophies
-- -----------------------------------------------------
-- Player trophies and achievements
CREATE TABLE IF NOT EXISTS public.trophies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  trophy_type VARCHAR(20) NOT NULL CHECK (trophy_type IN ('pro_master_rank', 'live_rank', 'tournament')),
  rank_position INTEGER,
  month DATE,
  tournament_title VARCHAR(255),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  CONSTRAINT tournament_title_required_for_tournament CHECK (
    (trophy_type = 'tournament' AND tournament_title IS NOT NULL) OR
    (trophy_type = 'live_rank' AND tournament_title IS NOT NULL) OR
    (trophy_type = 'pro_master_rank' AND tournament_title IS NULL)
  )
);

COMMENT ON TABLE public.trophies IS 'Player trophies and achievements for top rankings and tournaments';
COMMENT ON CONSTRAINT tournament_title_required_for_tournament ON public.trophies IS 'Tournament and live_rank trophies require tournament_title, pro_master_rank must have NULL';

-- =====================================================
-- SECTION 3: INDEXES
-- =====================================================

-- Championships indexes
CREATE INDEX IF NOT EXISTS idx_championships_admin ON public.championships(admin_id);

-- Players indexes
CREATE INDEX IF NOT EXISTS idx_players_championship ON public.players(championship_id);
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Matches indexes
CREATE INDEX IF NOT EXISTS idx_matches_championship ON public.matches(championship_id);
CREATE INDEX IF NOT EXISTS idx_matches_winner ON public.matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_matches_loser ON public.matches(loser_id);
CREATE INDEX IF NOT EXISTS idx_matches_played_at ON public.matches(played_at);

-- Registration requests indexes
CREATE INDEX IF NOT EXISTS idx_registration_requests_status ON public.registration_requests(status);
CREATE INDEX IF NOT EXISTS idx_registration_requests_championship ON public.registration_requests(championship_id);
CREATE INDEX IF NOT EXISTS idx_registration_requests_user ON public.registration_requests(user_id);

-- Monthly snapshots indexes
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_championship ON public.monthly_snapshots(championship_id);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_month ON public.monthly_snapshots(month);
CREATE INDEX IF NOT EXISTS idx_monthly_snapshots_player ON public.monthly_snapshots(player_id);

-- Trophies indexes
CREATE INDEX IF NOT EXISTS idx_trophies_player ON public.trophies(player_id);

-- =====================================================
-- SECTION 4: ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE public.championships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trophies ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------
-- Championships policies
-- -----------------------------------------------------
CREATE POLICY "Public championships are viewable by everyone"
ON public.championships FOR SELECT
USING (is_public = true);

CREATE POLICY "Users can view their own championships"
ON public.championships FOR SELECT
USING (admin_id = auth.uid());

CREATE POLICY "Users can create championships"
ON public.championships FOR INSERT
WITH CHECK (admin_id = auth.uid());

CREATE POLICY "Users can update their own championships"
ON public.championships FOR UPDATE
USING (admin_id = auth.uid());

-- -----------------------------------------------------
-- Players policies
-- -----------------------------------------------------
CREATE POLICY "Players are viewable by everyone in public championships"
ON public.players FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = players.championship_id
    AND championships.is_public = true
  )
);

CREATE POLICY "Users can view their own player records"
ON public.players FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own player records"
ON public.players FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own player records"
ON public.players FOR UPDATE
USING (user_id = auth.uid());

-- -----------------------------------------------------
-- Matches policies
-- -----------------------------------------------------
CREATE POLICY "Matches are viewable by everyone in public championships"
ON public.matches FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = matches.championship_id
    AND championships.is_public = true
  )
);

CREATE POLICY "Users can view their own matches"
ON public.matches FOR SELECT
USING (winner_id = auth.uid() OR loser_id = auth.uid());

CREATE POLICY "Users can create matches they're involved in"
ON public.matches FOR INSERT
WITH CHECK (
  (winner_id = auth.uid() OR loser_id = auth.uid()) AND
  (
    (COALESCE(is_scheduled, false) = false) OR
    (is_scheduled = true AND
     public.can_user_create_challenge(auth.uid(), championship_id) AND
     public.can_user_create_challenge(
       CASE
         WHEN winner_id = auth.uid() THEN loser_id
         ELSE winner_id
       END,
       championship_id
     ))
  )
);

COMMENT ON POLICY "Users can create matches they're involved in" ON public.matches IS
'Users can create completed matches freely, but can only create scheduled challenges if BOTH players (creator and opponent) have no pending challenges or matches to register.';

-- -----------------------------------------------------
-- Registration requests policies
-- -----------------------------------------------------
CREATE POLICY "Users can view their own registration requests"
ON public.registration_requests FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create registration requests"
ON public.registration_requests FOR INSERT
WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "Admins can view registration requests for their championships"
ON public.registration_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = registration_requests.championship_id
    AND championships.admin_id = auth.uid()
  )
);

CREATE POLICY "Admins can update registration requests for their championships"
ON public.registration_requests FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = registration_requests.championship_id
    AND championships.admin_id = auth.uid()
  )
);

-- -----------------------------------------------------
-- Monthly snapshots policies
-- -----------------------------------------------------
CREATE POLICY "Monthly snapshots are viewable by everyone in public championships"
ON public.monthly_snapshots FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.championships
    WHERE championships.id = monthly_snapshots.championship_id
    AND championships.is_public = true
  )
);

-- -----------------------------------------------------
-- Trophies policies
-- -----------------------------------------------------
CREATE POLICY "Trophies are viewable by everyone"
ON public.trophies FOR SELECT
USING (true);

-- =====================================================
-- SECTION 5: FUNCTIONS
-- =====================================================

-- -----------------------------------------------------
-- FUNCTION: update_updated_at_column
-- -----------------------------------------------------
-- Trigger function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.update_updated_at_column IS 'Automatically updates the updated_at timestamp';

-- -----------------------------------------------------
-- FUNCTION: get_category_by_position
-- -----------------------------------------------------
-- Returns category based on global position (1-10 gold, 11-20 silver, 21-30 bronze)
CREATE OR REPLACE FUNCTION public.get_category_by_position(position INTEGER)
RETURNS VARCHAR(20)
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF position >= 1 AND position <= 10 THEN
    RETURN 'gold';
  ELSIF position >= 11 AND position <= 20 THEN
    RETURN 'silver';
  ELSIF position >= 21 AND position <= 30 THEN
    RETURN 'bronze';
  ELSE
    RETURN 'bronze';
  END IF;
END;
$$;

COMMENT ON FUNCTION public.get_category_by_position IS 'Returns category based on global position (1-10 gold, 11-20 silver, 21-30 bronze)';

-- -----------------------------------------------------
-- FUNCTION: get_category_position
-- -----------------------------------------------------
-- Converts global position to category-relative position
CREATE OR REPLACE FUNCTION public.get_category_position(
  p_live_rank_position INTEGER,
  p_live_rank_category TEXT,
  p_championship_id UUID
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_gold_count INTEGER;
  v_silver_count INTEGER;
BEGIN
  SELECT gold_players_count, silver_players_count
  INTO v_gold_count, v_silver_count
  FROM public.championships
  WHERE id = p_championship_id;

  CASE p_live_rank_category
    WHEN 'gold' THEN
      RETURN p_live_rank_position;
    WHEN 'silver' THEN
      RETURN p_live_rank_position - v_gold_count;
    WHEN 'bronze' THEN
      RETURN p_live_rank_position - v_gold_count - v_silver_count;
    ELSE
      RETURN p_live_rank_position;
  END CASE;
END;
$$;

COMMENT ON FUNCTION public.get_category_position IS 'Converts global live_rank_position to category-relative position (1-N per category)';

-- -----------------------------------------------------
-- FUNCTION: calculate_sets_from_score
-- -----------------------------------------------------
-- Calculates sets won/lost from score string
CREATE OR REPLACE FUNCTION public.calculate_sets_from_score(score_str TEXT)
RETURNS TABLE(winner_sets INTEGER, loser_sets INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  set_parts text[];
  winner_score integer;
  loser_score integer;
  winner_sets_count integer := 0;
  loser_sets_count integer := 0;
BEGIN
  IF score_str IS NULL OR score_str = 'Da giocare' OR LENGTH(score_str) < 3 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  set_parts := string_to_array(score_str, ' ');

  FOR i IN 1..array_length(set_parts, 1) LOOP
    IF set_parts[i] ~ '^\d+-\d+$' THEN
      winner_score := split_part(set_parts[i], '-', 1)::integer;
      loser_score := split_part(set_parts[i], '-', 2)::integer;

      IF winner_score > loser_score THEN
        winner_sets_count := winner_sets_count + 1;
      ELSE
        loser_sets_count := loser_sets_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN QUERY SELECT winner_sets_count, loser_sets_count;
END;
$$;

COMMENT ON FUNCTION public.calculate_sets_from_score IS 'Calculates the number of sets won by winner and loser from score string';

-- -----------------------------------------------------
-- FUNCTION: calculate_games_from_score
-- -----------------------------------------------------
-- Calculates games won/lost from score string
CREATE OR REPLACE FUNCTION public.calculate_games_from_score(score_str TEXT)
RETURNS TABLE(winner_games INTEGER, loser_games INTEGER)
LANGUAGE plpgsql
AS $$
DECLARE
  set_parts text[];
  winner_score integer;
  loser_score integer;
  winner_games_count integer := 0;
  loser_games_count integer := 0;
BEGIN
  IF score_str IS NULL OR score_str = 'Da giocare' OR LENGTH(score_str) < 3 THEN
    RETURN QUERY SELECT 0, 0;
    RETURN;
  END IF;

  set_parts := string_to_array(score_str, ' ');

  FOR i IN 1..array_length(set_parts, 1) LOOP
    IF set_parts[i] ~ '^\d+-\d+$' THEN
      winner_score := split_part(set_parts[i], '-', 1)::integer;
      loser_score := split_part(set_parts[i], '-', 2)::integer;

      winner_games_count := winner_games_count + winner_score;
      loser_games_count := loser_games_count + loser_score;
    END IF;
  END LOOP;

  RETURN QUERY SELECT winner_games_count, loser_games_count;
END;
$$;

COMMENT ON FUNCTION public.calculate_games_from_score IS 'Calcola il totale dei game vinti dal vincitore e dal perdente in un match. Include set completi e incompleti. Formato score: "6-4 6-2" o "6-4 3-0".';

-- -----------------------------------------------------
-- FUNCTION: get_filtered_player_stats
-- -----------------------------------------------------
-- Returns filtered player statistics (wins, losses, sets, games, percentages)
CREATE OR REPLACE FUNCTION public.get_filtered_player_stats(
  player_uuid uuid,
  filter_type text,
  filter_year integer DEFAULT NULL,
  filter_month integer DEFAULT NULL
)
RETURNS TABLE(
  wins integer,
  losses integer,
  matches_played integer,
  sets_won integer,
  sets_lost integer,
  win_percentage integer,
  sets_win_percentage integer,
  draws integer,
  games_won integer,
  games_lost integer,
  games_win_percentage integer
)
LANGUAGE plpgsql
AS $$
DECLARE
  user_uuid uuid;
  total_wins integer := 0;
  total_losses integer := 0;
  total_draws integer := 0;
  total_sets_won integer := 0;
  total_sets_lost integer := 0;
  total_games_won integer := 0;
  total_games_lost integer := 0;
  loss_count integer;
  sets_won_in_losses integer;
  sets_lost_in_losses integer;
  games_won_in_losses integer;
  games_lost_in_losses integer;
BEGIN
  SELECT p.user_id INTO user_uuid
  FROM public.players p
  WHERE p.id = player_uuid;

  IF user_uuid IS NULL THEN
    RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0;
    RETURN;
  END IF;

  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer,
    COALESCE(SUM(games.winner_games), 0)::integer,
    COALESCE(SUM(games.loser_games), 0)::integer
  INTO total_wins, total_sets_won, total_sets_lost, total_games_won, total_games_lost
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  CROSS JOIN LATERAL calculate_games_from_score(m.score) AS games
  WHERE m.winner_id = user_uuid
    AND m.score IS NOT NULL
    AND m.score != ''
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)
    AND m.challenge_status IS NULL
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  SELECT
    COALESCE(COUNT(*), 0)::integer,
    COALESCE(SUM(sets.loser_sets), 0)::integer,
    COALESCE(SUM(sets.winner_sets), 0)::integer,
    COALESCE(SUM(games.loser_games), 0)::integer,
    COALESCE(SUM(games.winner_games), 0)::integer
  INTO loss_count, sets_won_in_losses, sets_lost_in_losses, games_won_in_losses, games_lost_in_losses
  FROM public.matches m
  CROSS JOIN LATERAL calculate_sets_from_score(m.score) AS sets
  CROSS JOIN LATERAL calculate_games_from_score(m.score) AS games
  WHERE m.loser_id = user_uuid
    AND m.score IS NOT NULL
    AND m.score != ''
    AND (m.is_draw IS NULL OR m.is_draw = false)
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)
    AND m.challenge_status IS NULL
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  SELECT COALESCE(COUNT(*), 0)::integer
  INTO total_draws
  FROM public.matches m
  WHERE (m.winner_id = user_uuid OR m.loser_id = user_uuid)
    AND m.is_draw = true
    AND (m.is_scheduled IS NULL OR m.is_scheduled = false)
    AND m.challenge_status IS NULL
    AND CASE
      WHEN filter_type = 'monthly' AND filter_year IS NOT NULL AND filter_month IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year AND EXTRACT(MONTH FROM m.played_at) = filter_month
      WHEN filter_type = 'annual' AND filter_year IS NOT NULL THEN
        EXTRACT(YEAR FROM m.played_at) = filter_year
      ELSE true
    END;

  total_losses := loss_count;
  total_sets_won := total_sets_won + sets_won_in_losses;
  total_sets_lost := total_sets_lost + sets_lost_in_losses;
  total_games_won := total_games_won + games_won_in_losses;
  total_games_lost := total_games_lost + games_lost_in_losses;

  RETURN QUERY SELECT
    total_wins,
    total_losses,
    total_wins + total_losses + total_draws,
    total_sets_won,
    total_sets_lost,
    CASE
      WHEN (total_wins + total_losses) > 0
      THEN ((total_wins::numeric / (total_wins + total_losses)) * 100)::integer
      ELSE 0
    END,
    CASE
      WHEN (total_sets_won + total_sets_lost) > 0
      THEN ((total_sets_won::numeric / (total_sets_won + total_sets_lost)) * 100)::integer
      ELSE 0
    END,
    total_draws,
    total_games_won,
    total_games_lost,
    CASE
      WHEN (total_games_won + total_games_lost) > 0
      THEN ((total_games_won::numeric / (total_games_won + total_games_lost)) * 100)::integer
      ELSE 0
    END;
END;
$$;

COMMENT ON FUNCTION public.get_filtered_player_stats IS 'Returns filtered player statistics including matches, sets, games, and percentages. Only counts completed matches (is_scheduled = false, challenge_status IS NULL, score not empty). Supports filters: all, monthly (year+month), annual (year).';

-- -----------------------------------------------------
-- FUNCTION: is_admin
-- -----------------------------------------------------
-- Checks if a user is an admin
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.players
    WHERE players.user_id = is_admin.user_id
    AND is_admin = true
  );
$$;

COMMENT ON FUNCTION public.is_admin IS 'Checks if a user is an admin by looking up the is_admin column in the players table';

-- -----------------------------------------------------
-- FUNCTION: can_user_create_challenge
-- -----------------------------------------------------
-- Checks if user can create a new challenge
CREATE OR REPLACE FUNCTION public.can_user_create_challenge(
  p_user_id UUID,
  p_championship_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_has_future_challenges INTEGER;
  v_has_matches_to_register INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO v_has_future_challenges
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at > NOW();

  SELECT COUNT(*)
  INTO v_has_matches_to_register
  FROM public.matches
  WHERE championship_id = p_championship_id
    AND (winner_id = p_user_id OR loser_id = p_user_id)
    AND is_scheduled = true
    AND played_at <= NOW();

  RETURN (v_has_future_challenges = 0 AND v_has_matches_to_register = 0);
END;
$$;

COMMENT ON FUNCTION public.can_user_create_challenge IS 'Checks if a user can create a new challenge. Returns false if user has pending scheduled challenges or matches to register.';

-- -----------------------------------------------------
-- FUNCTION: create_player_profile
-- -----------------------------------------------------
-- Creates or updates a player profile
CREATE OR REPLACE FUNCTION public.create_player_profile(
  p_user_id UUID,
  p_championship_id UUID,
  p_display_name VARCHAR,
  p_phone VARCHAR DEFAULT NULL,
  p_avatar_url VARCHAR DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  existing_player RECORD;
  max_position INTEGER;
BEGIN
  SELECT * INTO existing_player
  FROM public.players
  WHERE user_id = p_user_id AND championship_id = p_championship_id;

  IF existing_player IS NOT NULL THEN
    UPDATE public.players
    SET
      display_name = COALESCE(p_display_name, display_name),
      phone = COALESCE(p_phone, phone),
      avatar_url = COALESCE(p_avatar_url, avatar_url),
      updated_at = now()
    WHERE user_id = p_user_id AND championship_id = p_championship_id;

    RETURN json_build_object(
      'success', true,
      'message', 'Player profile updated',
      'player_id', existing_player.id
    );
  ELSE
    SELECT COALESCE(MAX(live_rank_position), 0) + 1 INTO max_position
    FROM public.players
    WHERE championship_id = p_championship_id;

    INSERT INTO public.players (
      user_id,
      championship_id,
      display_name,
      phone,
      avatar_url,
      live_rank_position,
      live_rank_category,
      pro_master_points,
      matches_this_month
    )
    VALUES (
      p_user_id,
      p_championship_id,
      p_display_name,
      p_phone,
      p_avatar_url,
      max_position,
      get_category_by_position(max_position),
      0,
      0
    );

    RETURN json_build_object(
      'success', true,
      'message', 'Player profile created',
      'player_id', (SELECT id FROM public.players WHERE user_id = p_user_id AND championship_id = p_championship_id)
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating/updating player: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.create_player_profile IS 'Create or update player profile during registration. Statistics are calculated dynamically from matches table.';

-- -----------------------------------------------------
-- FUNCTION: get_default_championship_id
-- -----------------------------------------------------
-- Returns the default championship ID for new user registrations
CREATE OR REPLACE FUNCTION public.get_default_championship_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  default_championship_id UUID;
BEGIN
  SELECT id INTO default_championship_id
  FROM public.championships
  WHERE is_public = true
  ORDER BY created_at ASC
  LIMIT 1;

  RETURN default_championship_id;
END;
$$;

COMMENT ON FUNCTION public.get_default_championship_id IS 'Returns the default championship ID for new user registrations';

-- -----------------------------------------------------
-- FUNCTION: approve_registration_request
-- -----------------------------------------------------
-- Admin function to approve a registration request and place user in a specific category
CREATE OR REPLACE FUNCTION public.approve_registration_request(
  request_id UUID,
  target_category TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
  last_position INTEGER;
  new_position INTEGER;
  championship_admin UUID;
  player_exists BOOLEAN;
  is_caller_admin BOOLEAN;
  last_pro_master_position INTEGER;
  new_pro_master_position INTEGER;
BEGIN
  SELECT * INTO request_record
  FROM public.registration_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or already processed'
    );
  END IF;

  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  SELECT EXISTS(
    SELECT 1 FROM public.players
    WHERE user_id = auth.uid()
    AND is_admin = true
  ) INTO is_caller_admin;

  IF championship_admin != auth.uid() AND NOT is_caller_admin THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: You are not an admin'
    );
  END IF;

  IF target_category NOT IN ('gold', 'silver', 'bronze') THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Invalid category. Must be gold, silver, or bronze'
    );
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.players
    WHERE user_id = request_record.user_id
    AND championship_id = request_record.championship_id
  ) INTO player_exists;

  IF player_exists THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Player already exists in this championship'
    );
  END IF;

  SELECT COALESCE(MAX(live_rank_position), 0) INTO last_position
  FROM public.players
  WHERE championship_id = request_record.championship_id
  AND live_rank_category = target_category;

  new_position := last_position + 1;

  SELECT COALESCE(MAX(pro_master_rank_position), 0) INTO last_pro_master_position
  FROM public.players
  WHERE championship_id = request_record.championship_id;

  new_pro_master_position := last_pro_master_position + 1;

  INSERT INTO public.players (
    user_id,
    championship_id,
    display_name,
    phone,
    live_rank_position,
    live_rank_category,
    best_live_rank,
    best_category,
    pro_master_points,
    pro_master_rank_position,
    best_pro_master_rank,
    matches_this_month,
    is_admin
  ) VALUES (
    request_record.user_id,
    request_record.championship_id,
    request_record.display_name,
    request_record.phone,
    new_position,
    target_category,
    new_position,
    target_category,
    0,
    new_pro_master_position,
    new_pro_master_position,
    0,
    false
  );

  UPDATE public.registration_requests
  SET
    status = 'approved',
    processed_at = now(),
    processed_by = auth.uid(),
    updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration approved successfully',
    'player_position', new_position,
    'player_category', target_category,
    'pro_master_position', new_pro_master_position
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error approving request: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.approve_registration_request IS 'Admin function to approve a registration request. Each category has independent ranking (1-N). Statistics are calculated dynamically from matches table.';

-- -----------------------------------------------------
-- FUNCTION: reject_registration_request
-- -----------------------------------------------------
-- Admin function to reject a registration request
CREATE OR REPLACE FUNCTION public.reject_registration_request(
  request_id UUID,
  rejection_reason TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  request_record RECORD;
  championship_admin UUID;
BEGIN
  SELECT * INTO request_record
  FROM public.registration_requests
  WHERE id = request_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Request not found or already processed'
    );
  END IF;

  SELECT admin_id INTO championship_admin
  FROM public.championships
  WHERE id = request_record.championship_id;

  IF championship_admin != auth.uid() THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Unauthorized: You are not the admin of this championship'
    );
  END IF;

  UPDATE public.registration_requests
  SET
    status = 'rejected',
    processed_at = now(),
    processed_by = auth.uid(),
    rejected_reason = rejection_reason,
    updated_at = now()
  WHERE id = request_id;

  RETURN json_build_object(
    'success', true,
    'message', 'Registration rejected successfully'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error rejecting request: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.reject_registration_request IS 'Admin function to reject a registration request';

-- -----------------------------------------------------
-- FUNCTION: admin_create_match
-- -----------------------------------------------------
-- Admin function to create a match with position swap logic
CREATE OR REPLACE FUNCTION public.admin_create_match(
  p_championship_id UUID,
  p_winner_id UUID,
  p_loser_id UUID,
  p_score VARCHAR(50),
  p_played_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  p_is_scheduled BOOLEAN DEFAULT false
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_match_id UUID;
  winner_player RECORD;
  loser_player RECORD;
  winner_old_position INTEGER;
  loser_old_position INTEGER;
BEGIN
  SELECT * INTO winner_player FROM public.players
  WHERE user_id = p_winner_id AND championship_id = p_championship_id;

  SELECT * INTO loser_player FROM public.players
  WHERE user_id = p_loser_id AND championship_id = p_championship_id;

  IF winner_player IS NULL OR loser_player IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'One or both players not found in this championship'
    );
  END IF;

  winner_old_position := winner_player.live_rank_position;
  loser_old_position := loser_player.live_rank_position;

  INSERT INTO public.matches (
    championship_id,
    winner_id,
    loser_id,
    score,
    played_at,
    is_scheduled
  )
  VALUES (
    p_championship_id,
    p_winner_id,
    p_loser_id,
    p_score,
    p_played_at,
    p_is_scheduled
  )
  RETURNING id INTO new_match_id;

  IF NOT p_is_scheduled THEN
    IF winner_old_position > loser_old_position THEN
      UPDATE public.players
      SET
        live_rank_position = loser_old_position,
        live_rank_category = get_category_by_position(loser_old_position),
        updated_at = now()
      WHERE id = winner_player.id;

      UPDATE public.players
      SET
        live_rank_position = winner_old_position,
        live_rank_category = get_category_by_position(winner_old_position),
        updated_at = now()
      WHERE id = loser_player.id;
    END IF;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Match created successfully',
    'match_id', new_match_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating match: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.admin_create_match IS 'Admin function to create match with position swap logic (FIXED: parameter names match frontend)';

-- -----------------------------------------------------
-- FUNCTION: admin_update_match_score
-- -----------------------------------------------------
-- Admin function to update match score
CREATE OR REPLACE FUNCTION public.admin_update_match_score(
  match_id_param UUID,
  new_score TEXT,
  new_winner_id UUID DEFAULT NULL,
  new_loser_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_match RECORD;
  current_winner_id UUID;
  current_loser_id UUID;
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Solo gli amministratori possono modificare i punteggi'
    );
  END IF;

  SELECT * INTO old_match
  FROM public.matches
  WHERE id = match_id_param;

  IF old_match IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Match non trovato'
    );
  END IF;

  current_winner_id := old_match.winner_id;
  current_loser_id := old_match.loser_id;

  IF new_winner_id IS NOT NULL AND new_winner_id != current_winner_id THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Non è possibile cambiare il vincitore della partita'
    );
  END IF;

  UPDATE public.matches
  SET
    score = new_score,
    updated_at = now()
  WHERE id = match_id_param;

  RETURN json_build_object(
    'success', true,
    'message', 'Punteggio aggiornato con successo',
    'old_score', old_match.score,
    'new_score', new_score
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Errore nell''aggiornamento: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.admin_update_match_score IS 'Admin function to update match score. Does NOT allow changing the winner. Statistics are recalculated dynamically from matches table.';

-- -----------------------------------------------------
-- FUNCTION: create_monthly_snapshot
-- -----------------------------------------------------
-- Admin function to create a monthly snapshot of all players
CREATE OR REPLACE FUNCTION public.create_monthly_snapshot(
  target_championship_id UUID,
  snapshot_month DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  total_snapshots INTEGER := 0;
BEGIN
  FOR player_record IN
    SELECT * FROM public.players
    WHERE championship_id = target_championship_id
  LOOP
    INSERT INTO public.monthly_snapshots (
      championship_id,
      month,
      player_id,
      user_id,
      display_name,
      live_rank_position,
      live_rank_category,
      pro_master_points,
      pro_master_rank_position,
      matches_count
    )
    VALUES (
      target_championship_id,
      snapshot_month,
      player_record.id,
      player_record.user_id,
      player_record.display_name,
      player_record.live_rank_position,
      player_record.live_rank_category,
      player_record.pro_master_points,
      player_record.pro_master_rank_position,
      player_record.matches_this_month
    )
    ON CONFLICT (championship_id, month, player_id) DO UPDATE
    SET
      live_rank_position = EXCLUDED.live_rank_position,
      live_rank_category = EXCLUDED.live_rank_category,
      pro_master_points = EXCLUDED.pro_master_points,
      pro_master_rank_position = EXCLUDED.pro_master_rank_position,
      matches_count = EXCLUDED.matches_count;

    total_snapshots := total_snapshots + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Monthly snapshot created successfully',
    'total_snapshots', total_snapshots,
    'snapshot_month', snapshot_month
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error creating snapshot: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.create_monthly_snapshot IS 'Admin function to create a snapshot of all players for a specific month';

-- -----------------------------------------------------
-- FUNCTION: process_category_swaps
-- -----------------------------------------------------
-- Admin function to swap positions between categories at end of month
CREATE OR REPLACE FUNCTION public.process_category_swaps(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  gold_8_id UUID;
  gold_9_id UUID;
  gold_10_id UUID;
  silver_11_id UUID;
  silver_12_id UUID;
  silver_13_id UUID;
  silver_18_id UUID;
  silver_19_id UUID;
  silver_20_id UUID;
  bronze_21_id UUID;
  bronze_22_id UUID;
  bronze_23_id UUID;
  swaps_performed INTEGER := 0;
BEGIN
  SELECT id INTO gold_8_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 8;

  SELECT id INTO gold_9_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 9;

  SELECT id INTO gold_10_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 10;

  SELECT id INTO silver_11_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 11;

  SELECT id INTO silver_12_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 12;

  SELECT id INTO silver_13_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 13;

  IF gold_8_id IS NOT NULL AND silver_11_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 11, live_rank_category = 'silver', updated_at = now()
    WHERE id = gold_8_id;

    UPDATE public.players SET live_rank_position = 8, live_rank_category = 'gold', updated_at = now()
    WHERE id = silver_11_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  IF gold_9_id IS NOT NULL AND silver_12_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 12, live_rank_category = 'silver', updated_at = now()
    WHERE id = gold_9_id;

    UPDATE public.players SET live_rank_position = 9, live_rank_category = 'gold', updated_at = now()
    WHERE id = silver_12_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  IF gold_10_id IS NOT NULL AND silver_13_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 13, live_rank_category = 'silver', updated_at = now()
    WHERE id = gold_10_id;

    UPDATE public.players SET live_rank_position = 10, live_rank_category = 'gold', updated_at = now()
    WHERE id = silver_13_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  SELECT id INTO silver_18_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 18;

  SELECT id INTO silver_19_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 19;

  SELECT id INTO silver_20_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 20;

  SELECT id INTO bronze_21_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 21;

  SELECT id INTO bronze_22_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 22;

  SELECT id INTO bronze_23_id FROM public.players
  WHERE championship_id = target_championship_id AND live_rank_position = 23;

  IF silver_18_id IS NOT NULL AND bronze_21_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 21, live_rank_category = 'bronze', updated_at = now()
    WHERE id = silver_18_id;

    UPDATE public.players SET live_rank_position = 18, live_rank_category = 'silver', updated_at = now()
    WHERE id = bronze_21_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  IF silver_19_id IS NOT NULL AND bronze_22_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 22, live_rank_category = 'bronze', updated_at = now()
    WHERE id = silver_19_id;

    UPDATE public.players SET live_rank_position = 19, live_rank_category = 'silver', updated_at = now()
    WHERE id = bronze_22_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  IF silver_20_id IS NOT NULL AND bronze_23_id IS NOT NULL THEN
    UPDATE public.players SET live_rank_position = 23, live_rank_category = 'bronze', updated_at = now()
    WHERE id = silver_20_id;

    UPDATE public.players SET live_rank_position = 20, live_rank_category = 'silver', updated_at = now()
    WHERE id = bronze_23_id;

    swaps_performed := swaps_performed + 2;
  END IF;

  RETURN json_build_object(
    'success', true,
    'message', 'Category swaps completed successfully',
    'swaps_performed', swaps_performed,
    'details', json_build_object(
      'gold_silver_swaps', CASE WHEN gold_8_id IS NOT NULL THEN 6 ELSE 0 END,
      'silver_bronze_swaps', CASE WHEN silver_18_id IS NOT NULL THEN 6 ELSE 0 END
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error performing category swaps: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.process_category_swaps IS 'Admin function to swap positions between categories: last 3 of each category swap with first 3 of next category, maintaining order';

-- -----------------------------------------------------
-- FUNCTION: calculate_inactivity_demotion
-- -----------------------------------------------------
-- Demotes inactive players within their category
-- Fixed: Dynamic ranges + correct swap algorithm
CREATE OR REPLACE FUNCTION public.calculate_inactivity_demotion(
  target_championship_id UUID,
  target_month DATE DEFAULT NULL,
  min_matches_required INTEGER DEFAULT 2
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  category_record RECORD;
  player_record RECORD;
  movements_array JSON[] := '{}';
  all_players_array JSON[] := '{}';
  total_movements INTEGER := 0;
  category_min_pos INTEGER;
  category_max_pos INTEGER;
  v_gold_count INTEGER;
  v_silver_count INTEGER;
  v_bronze_count INTEGER;
BEGIN
  -- Read actual counters from championship
  SELECT gold_players_count, silver_players_count, bronze_players_count
  INTO v_gold_count, v_silver_count, v_bronze_count
  FROM public.championships
  WHERE id = target_championship_id;

  IF v_gold_count IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Championship not found'
    );
  END IF;

  FOR category_record IN
    SELECT DISTINCT
      live_rank_category,
      CASE live_rank_category
        WHEN 'gold' THEN 1
        WHEN 'silver' THEN 2
        WHEN 'bronze' THEN 3
        ELSE 4
      END as category_order
    FROM public.players
    WHERE championship_id = target_championship_id
    ORDER BY category_order
  LOOP
    -- Dynamic range calculation based on actual player counts
    CASE category_record.live_rank_category
      WHEN 'gold' THEN
        category_min_pos := 1;
        category_max_pos := v_gold_count;
      WHEN 'silver' THEN
        category_min_pos := v_gold_count + 1;
        category_max_pos := v_gold_count + v_silver_count;
      WHEN 'bronze' THEN
        category_min_pos := v_gold_count + v_silver_count + 1;
        category_max_pos := v_gold_count + v_silver_count + v_bronze_count;
      ELSE
        CONTINUE;
    END CASE;

    DROP TABLE IF EXISTS temp_players;
    CREATE TEMP TABLE temp_players AS
    SELECT
      p.id,
      p.user_id,
      p.display_name,
      p.live_rank_position as old_position,
      p.matches_this_month,
      CASE WHEN p.matches_this_month < min_matches_required THEN true ELSE false END as is_inactive,
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC) as relative_position,
      ROW_NUMBER() OVER (ORDER BY p.live_rank_position ASC)::INTEGER as new_relative_position
    FROM public.players p
    WHERE p.championship_id = target_championship_id
      AND p.live_rank_category = category_record.live_rank_category;

    -- Correct algorithm: Each inactive player is swapped with the first active player below them
    DECLARE
      inactive_rec RECORD;
      first_active_below_pos INTEGER;
      swap_target_id UUID;
    BEGIN
      FOR inactive_rec IN
        SELECT id, relative_position, display_name
        FROM temp_players
        WHERE is_inactive = true
        ORDER BY relative_position ASC
      LOOP
        -- Find first active player below this inactive
        SELECT id, relative_position INTO swap_target_id, first_active_below_pos
        FROM temp_players
        WHERE is_inactive = false
          AND relative_position > inactive_rec.relative_position
        ORDER BY relative_position ASC
        LIMIT 1;

        -- If an active player exists below, swap them
        IF swap_target_id IS NOT NULL THEN
          -- Swap: active takes inactive's position
          UPDATE temp_players
          SET new_relative_position = inactive_rec.relative_position
          WHERE id = swap_target_id;

          -- Inactive drops to active's position
          UPDATE temp_players
          SET new_relative_position = first_active_below_pos
          WHERE id = inactive_rec.id;

          -- Update relative_position for next comparisons
          UPDATE temp_players
          SET relative_position = new_relative_position
          WHERE id IN (swap_target_id, inactive_rec.id);
        END IF;
      END LOOP;
    END;

    -- Convert relative positions to global positions using dynamic ranges
    UPDATE temp_players
    SET new_relative_position = category_min_pos + new_relative_position - 1
    WHERE TRUE;

    FOR player_record IN SELECT * FROM temp_players ORDER BY old_position LOOP
      all_players_array := all_players_array || json_build_object(
        'name', player_record.display_name,
        'category', category_record.live_rank_category,
        'old_position', player_record.old_position,
        'new_position', player_record.new_relative_position,
        'matches_this_month', player_record.matches_this_month,
        'is_inactive', player_record.is_inactive
      );

      IF player_record.old_position != player_record.new_relative_position THEN
        movements_array := movements_array || json_build_object(
          'player', player_record.display_name,
          'category', category_record.live_rank_category,
          'from', player_record.old_position,
          'to', player_record.new_relative_position,
          'matches', player_record.matches_this_month,
          'type', CASE WHEN player_record.is_inactive THEN 'demoted' ELSE 'promoted' END
        );
        total_movements := total_movements + 1;
      END IF;
    END LOOP;

    FOR player_record IN SELECT * FROM temp_players LOOP
      UPDATE public.players
      SET
        live_rank_position = player_record.new_relative_position,
        updated_at = now()
      WHERE id = player_record.id;
    END LOOP;

    DROP TABLE IF EXISTS temp_players;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Inactivity demotion completed - each inactive player is swapped with the first active player below them',
    'total_movements', total_movements,
    'all_players', all_players_array,
    'movements', movements_array,
    'category_ranges', json_build_object(
      'gold', json_build_object('min', 1, 'max', v_gold_count),
      'silver', json_build_object('min', v_gold_count + 1, 'max', v_gold_count + v_silver_count),
      'bronze', json_build_object('min', v_gold_count + v_silver_count + 1, 'max', v_gold_count + v_silver_count + v_bronze_count)
    )
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error in inactivity demotion: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.calculate_inactivity_demotion IS 'Retrocede giocatori inattivi (< min_matches_required partite). Ogni inattivo viene sorpassato dal primo attivo sotto di lui nella classifica. I range di posizioni sono calcolati dinamicamente in base a gold_players_count, silver_players_count, bronze_players_count.';

-- -----------------------------------------------------
-- FUNCTION: calculate_pro_master_points
-- -----------------------------------------------------
-- Assigns Pro Master points based on live rank position
CREATE OR REPLACE FUNCTION public.calculate_pro_master_points(
  target_championship_id UUID,
  target_month DATE DEFAULT NULL,
  min_matches_for_points INTEGER DEFAULT 1,
  first_place_points INTEGER DEFAULT 500
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  eligible_players_array JSON[] := '{}';
  all_players_array JSON[] := '{}';
  total_points_assigned INTEGER := 0;
  ranking_result JSON;
  global_position INTEGER;
  total_eligible_players INTEGER;
  player_weight NUMERIC;
  max_weight NUMERIC;
  player_points INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_eligible_players
  FROM public.players p
  WHERE p.championship_id = target_championship_id
    AND p.matches_this_month >= min_matches_for_points;

  IF total_eligible_players = 0 OR first_place_points = 0 THEN
    RETURN json_build_object(
      'success', true,
      'message', 'No eligible players to award points',
      'total_points_assigned', 0,
      'min_matches_required', min_matches_for_points,
      'first_place_points', first_place_points,
      'eligible_players', '[]'::json,
      'all_players', '[]'::json
    );
  END IF;

  max_weight := total_eligible_players;
  global_position := 1;

  FOR player_record IN
    SELECT
      p.id,
      p.display_name,
      p.live_rank_position,
      p.live_rank_category,
      p.matches_this_month,
      p.pro_master_points as current_points
    FROM public.players p
    WHERE p.championship_id = target_championship_id
      AND p.matches_this_month >= min_matches_for_points
    ORDER BY p.live_rank_position ASC
  LOOP
    player_weight := (total_eligible_players - global_position + 1);
    player_points := ROUND((player_weight / max_weight) * first_place_points);

    UPDATE public.players
    SET
      pro_master_points = pro_master_points + player_points,
      updated_at = now()
    WHERE id = player_record.id;

    eligible_players_array := eligible_players_array || json_build_object(
      'player', player_record.display_name,
      'category', player_record.live_rank_category,
      'position', player_record.live_rank_position,
      'global_rank', global_position,
      'matches_this_month', player_record.matches_this_month,
      'points_awarded', player_points,
      'new_total_points', player_record.current_points + player_points,
      'weight', player_weight
    );

    total_points_assigned := total_points_assigned + player_points;
    global_position := global_position + 1;
  END LOOP;

  FOR player_record IN
    SELECT
      p.id,
      p.display_name,
      p.live_rank_position,
      p.live_rank_category,
      p.matches_this_month,
      p.pro_master_points
    FROM public.players p
    WHERE p.championship_id = target_championship_id
    ORDER BY p.live_rank_position ASC
  LOOP
    all_players_array := all_players_array || json_build_object(
      'player', player_record.display_name,
      'category', player_record.live_rank_category,
      'position', player_record.live_rank_position,
      'matches_this_month', player_record.matches_this_month,
      'total_points', player_record.pro_master_points,
      'is_eligible', player_record.matches_this_month >= min_matches_for_points
    );
  END LOOP;

  ranking_result := public.update_pro_master_rankings(target_championship_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master points assigned based on first place points, distributed proportionally',
    'total_points_assigned', total_points_assigned,
    'first_place_points', first_place_points,
    'min_matches_required', min_matches_for_points,
    'eligible_players_count', total_eligible_players,
    'eligible_players', eligible_players_array,
    'all_players', all_players_array,
    'ranking_update', ranking_result
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error assigning Pro Master points: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.calculate_pro_master_points IS 'Assigns Pro Master points based on first_place_points. Position 1 gets first_place_points, all others get proportionally less based on rank. Last of Gold always gets more than first of Silver. Automatically updates pro_master_rank_position after assigning points.';

-- -----------------------------------------------------
-- FUNCTION: update_pro_master_rankings
-- -----------------------------------------------------
-- Recalculates Pro Master rank positions based on points
CREATE OR REPLACE FUNCTION public.update_pro_master_rankings(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  current_position INTEGER := 1;
  updates_array JSON[] := '{}';
BEGIN
  FOR player_record IN
    SELECT id, display_name, pro_master_points, pro_master_rank_position
    FROM public.players
    WHERE championship_id = target_championship_id
    ORDER BY pro_master_points DESC, display_name ASC
  LOOP
    UPDATE public.players
    SET pro_master_rank_position = current_position
    WHERE id = player_record.id;

    updates_array := updates_array || json_build_object(
      'player', player_record.display_name,
      'old_position', player_record.pro_master_rank_position,
      'new_position', current_position,
      'points', player_record.pro_master_points
    );

    current_position := current_position + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master rankings updated successfully',
    'total_updates', current_position - 1,
    'updates', updates_array
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error updating Pro Master rankings: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.update_pro_master_rankings IS 'Recalculates Pro Master rank positions for all players based on pro_master_points (DESC)';

-- -----------------------------------------------------
-- FUNCTION: reset_monthly_matches
-- -----------------------------------------------------
-- Resets matches_this_month counter for all players
CREATE OR REPLACE FUNCTION public.reset_monthly_matches(
  target_championship_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  updated_count INTEGER := 0;
BEGIN
  UPDATE public.players
  SET
    matches_this_month = 0,
    updated_at = now()
  WHERE championship_id = target_championship_id;

  GET DIAGNOSTICS updated_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'message', 'Monthly matches counter reset successfully',
    'players_updated', updated_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Error resetting monthly matches: ' || SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.reset_monthly_matches IS 'Admin function to reset matches_this_month counter for all players at the start of a new month';

-- =====================================================
-- SECTION 6: TRIGGERS
-- =====================================================

-- -----------------------------------------------------
-- TRIGGER: update_updated_at_column
-- -----------------------------------------------------
-- Auto-update updated_at timestamp on all tables
CREATE TRIGGER update_championships_updated_at
  BEFORE UPDATE ON public.championships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_players_updated_at
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_matches_updated_at
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_registration_requests_updated_at
  BEFORE UPDATE ON public.registration_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- -----------------------------------------------------
-- TRIGGER: update_best_live_rank
-- -----------------------------------------------------
-- Automatically updates best_live_rank when position improves
CREATE OR REPLACE FUNCTION public.update_best_live_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.live_rank_position IS NOT NULL THEN
    IF OLD.best_live_rank IS NULL OR NEW.live_rank_position < OLD.best_live_rank THEN
      NEW.best_live_rank := NEW.live_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_best_live_rank
  BEFORE UPDATE OF live_rank_position ON public.players
  FOR EACH ROW
  WHEN (NEW.live_rank_position IS DISTINCT FROM OLD.live_rank_position)
  EXECUTE FUNCTION update_best_live_rank();

COMMENT ON FUNCTION public.update_best_live_rank IS 'Updates best_live_rank when live_rank_position changes. Uses global position system (1-30). Lower is better.';

-- -----------------------------------------------------
-- TRIGGER: update_best_pro_master_rank
-- -----------------------------------------------------
-- Automatically updates best_pro_master_rank when position improves
CREATE OR REPLACE FUNCTION public.update_best_pro_master_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.pro_master_rank_position IS NOT NULL THEN
    IF OLD.best_pro_master_rank IS NULL OR NEW.pro_master_rank_position < OLD.best_pro_master_rank THEN
      NEW.best_pro_master_rank := NEW.pro_master_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_best_pro_master_rank
  BEFORE UPDATE ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION update_best_pro_master_rank();

COMMENT ON FUNCTION public.update_best_pro_master_rank IS 'Automatically updates best_pro_master_rank when pro_master_rank_position improves (gets lower)';

-- -----------------------------------------------------
-- TRIGGER: update_category_counters
-- -----------------------------------------------------
-- Automatically updates championship category counters when a player is added
CREATE OR REPLACE FUNCTION public.update_category_counters()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.live_rank_category = 'gold' THEN
    UPDATE public.championships
    SET gold_players_count = gold_players_count + 1
    WHERE id = NEW.championship_id;
  ELSIF NEW.live_rank_category = 'silver' THEN
    UPDATE public.championships
    SET silver_players_count = silver_players_count + 1
    WHERE id = NEW.championship_id;
  ELSIF NEW.live_rank_category = 'bronze' THEN
    UPDATE public.championships
    SET bronze_players_count = bronze_players_count + 1
    WHERE id = NEW.championship_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_category_counters
  AFTER INSERT ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION update_category_counters();

COMMENT ON FUNCTION public.update_category_counters IS 'Automatically updates championship category counters when a player is added';

-- -----------------------------------------------------
-- TRIGGER: handle_match_completion
-- -----------------------------------------------------
-- Handles position swapping after match completion
CREATE OR REPLACE FUNCTION public.handle_match_completion()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
  winner_old_position INTEGER;
  loser_old_position INTEGER;
BEGIN
  -- Skip if match is scheduled (not yet played)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- Skip if match is a draw
  IF NEW.is_draw = true THEN
    RETURN NEW;
  END IF;

  -- ⭐ NEW: Skip if challenge is not yet completed
  -- Only swap positions when challenge_status IS NULL
  -- (meaning the challenge has been completed and finalized)
  IF NEW.challenge_status IS NOT NULL THEN
    RAISE NOTICE 'Skipping position swap: challenge still in status "%"', NEW.challenge_status;
    RETURN NEW;
  END IF;

  SELECT id, live_rank_position
  INTO winner_player_id, winner_old_position
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  SELECT id, live_rank_position
  INTO loser_player_id, loser_old_position
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  RAISE NOTICE 'Winner player id: %, position: %', winner_player_id, winner_old_position;
  RAISE NOTICE 'Loser player id: %, position: %', loser_player_id, loser_old_position;

  IF winner_player_id = loser_player_id THEN
    RAISE NOTICE 'ERROR: Winner and loser are the same player!';
    RETURN NEW;
  END IF;

  IF winner_old_position > loser_old_position THEN
    RAISE NOTICE 'Swapping positions: winner % -> %, loser % -> %',
      winner_old_position, loser_old_position, loser_old_position, winner_old_position;

    UPDATE public.players
    SET
      live_rank_position = loser_old_position,
      live_rank_category = get_category_by_position(loser_old_position),
      updated_at = now()
    WHERE id = winner_player_id;

    UPDATE public.players
    SET
      live_rank_position = winner_old_position,
      live_rank_category = get_category_by_position(winner_old_position),
      updated_at = now()
    WHERE id = loser_player_id;

    RAISE NOTICE 'Position swap completed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_match_completion
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION handle_match_completion();

COMMENT ON FUNCTION public.handle_match_completion IS 'Handles position swapping after match completion. Only swaps positions when challenge_status IS NULL (completed). Statistics (wins, losses, sets, draws) are calculated dynamically from matches table using get_filtered_player_stats function.';

-- -----------------------------------------------------
-- TRIGGER: increment_monthly_matches
-- -----------------------------------------------------
-- Automatically increments matches_this_month counter for both players
CREATE OR REPLACE FUNCTION public.increment_matches_this_month()
RETURNS TRIGGER AS $$
DECLARE
  winner_player_id UUID;
  loser_player_id UUID;
BEGIN
  -- Skip if match is scheduled (not yet played)
  IF NEW.is_scheduled = true THEN
    RETURN NEW;
  END IF;

  -- ⭐ NEW: Skip if challenge is not yet completed
  -- Only count matches when challenge_status IS NULL
  -- (meaning the challenge has been completed and finalized)
  IF NEW.challenge_status IS NOT NULL THEN
    RAISE NOTICE 'Skipping match count increment: challenge still in status "%"', NEW.challenge_status;
    RETURN NEW;
  END IF;

  SELECT id INTO winner_player_id
  FROM public.players
  WHERE user_id = NEW.winner_id
  LIMIT 1;

  SELECT id INTO loser_player_id
  FROM public.players
  WHERE user_id = NEW.loser_id
  LIMIT 1;

  IF winner_player_id IS NULL OR loser_player_id IS NULL THEN
    RAISE NOTICE 'Player not found: winner_id=%, loser_id=%', NEW.winner_id, NEW.loser_id;
    RETURN NEW;
  END IF;

  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = winner_player_id;

  UPDATE public.players
  SET
    matches_this_month = COALESCE(matches_this_month, 0) + 1,
    updated_at = now()
  WHERE id = loser_player_id;

  RAISE NOTICE 'Incremented matches_this_month for players: % and %', winner_player_id, loser_player_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER increment_monthly_matches
  AFTER INSERT OR UPDATE ON public.matches
  FOR EACH ROW
  EXECUTE FUNCTION increment_matches_this_month();

COMMENT ON FUNCTION public.increment_matches_this_month IS 'Automatically increments matches_this_month counter for both players when a match is completed (challenge_status IS NULL)';

-- =====================================================
-- SECTION 7: GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_category_by_position TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_position TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_sets_from_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_games_from_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_filtered_player_stats TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_user_create_challenge TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_player_profile TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.get_default_championship_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.approve_registration_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_registration_request TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_match TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_match_score TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_monthly_snapshot TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_category_swaps TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_inactivity_demotion TO authenticated;
GRANT EXECUTE ON FUNCTION public.calculate_pro_master_points TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_pro_master_rankings TO authenticated;
GRANT EXECUTE ON FUNCTION public.reset_monthly_matches TO authenticated;

-- =====================================================
-- END OF SCHEMA
-- =====================================================
