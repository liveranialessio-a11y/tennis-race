-- Create enum types
CREATE TYPE public.challenge_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled', 'expired');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table for user data
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  avatar_url TEXT,
  gender TEXT CHECK (gender IN ('M', 'F')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  current_level INTEGER NOT NULL DEFAULT 1,
  current_position INTEGER NOT NULL DEFAULT 1,
  master_points DECIMAL(10,2) NOT NULL DEFAULT 0,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  matches_lost INTEGER NOT NULL DEFAULT 0,
  sets_won INTEGER NOT NULL DEFAULT 0,
  sets_lost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenger_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  challenged_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status challenge_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  proposed_dates TEXT[], -- Array of proposed dates as strings
  accepted_date TIMESTAMP WITH TIME ZONE,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE,
  CONSTRAINT no_self_challenge CHECK (challenger_id != challenged_id)
);

-- Create match_results table
CREATE TABLE public.match_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  submitted_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  player1_sets INTEGER[] NOT NULL, -- Array of sets won by player 1
  player2_sets INTEGER[] NOT NULL, -- Array of sets won by player 2
  winner_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending_validation', -- pending_validation, validated
  validated_by UUID REFERENCES public.profiles(user_id),
  validated_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create app_config table for admin settings
CREATE TABLE public.app_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  giorni_attesa INTEGER NOT NULL DEFAULT 7,
  giorni_max_sfida INTEGER NOT NULL DEFAULT 14,
  punti_vincitore INTEGER NOT NULL DEFAULT 3,
  punti_perdente INTEGER NOT NULL DEFAULT 1,
  utenti_per_livello INTEGER NOT NULL DEFAULT 15,
  numero_livelli INTEGER NOT NULL DEFAULT 1,
  promotion_cycle_locked BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create system_logs table
CREATE TABLE public.system_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  message TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create announcements table for admin banners
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  image_url TEXT,
  priority INTEGER NOT NULL DEFAULT 1,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  end_date TIMESTAMP WITH TIME ZONE,
  active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create monthly_stats table for user statistics
CREATE TABLE public.monthly_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(user_id) ON DELETE CASCADE,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  matches_played INTEGER NOT NULL DEFAULT 0,
  matches_won INTEGER NOT NULL DEFAULT 0,
  matches_lost INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, year, month)
);

-- Insert default configuration
INSERT INTO public.app_config (giorni_attesa, giorni_max_sfida, punti_vincitore, punti_perdente, utenti_per_livello, numero_livelli)
VALUES (7, 14, 3, 1, 15, 1);

-- Enable Row Level Security on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_stats ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check admin status
CREATE OR REPLACE FUNCTION public.is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE profiles.user_id = is_admin.user_id 
    AND is_admin = true
  );
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view all profiles" ON public.profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update any profile" ON public.profiles
  FOR UPDATE USING (public.is_admin(auth.uid()));

-- RLS Policies for challenges
CREATE POLICY "Users can view challenges involving them" ON public.challenges
  FOR SELECT USING (challenger_id = auth.uid() OR challenged_id = auth.uid());

CREATE POLICY "Users can view all challenges for ranking display" ON public.challenges
  FOR SELECT USING (true);

CREATE POLICY "Users can create challenges" ON public.challenges
  FOR INSERT WITH CHECK (challenger_id = auth.uid());

CREATE POLICY "Users can update their challenges" ON public.challenges
  FOR UPDATE USING (challenger_id = auth.uid() OR challenged_id = auth.uid());

CREATE POLICY "Admins can manage all challenges" ON public.challenges
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for match_results
CREATE POLICY "Users can view match results involving them" ON public.match_results
  FOR SELECT USING (player1_id = auth.uid() OR player2_id = auth.uid());

CREATE POLICY "Users can view all match results for stats" ON public.match_results
  FOR SELECT USING (true);

CREATE POLICY "Users can create match results for their games" ON public.match_results
  FOR INSERT WITH CHECK (
    submitted_by = auth.uid() AND 
    (player1_id = auth.uid() OR player2_id = auth.uid())
  );

CREATE POLICY "Admins can manage all match results" ON public.match_results
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for app_config
CREATE POLICY "Anyone can view config" ON public.app_config
  FOR SELECT USING (true);

CREATE POLICY "Only admins can modify config" ON public.app_config
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for system_logs
CREATE POLICY "Only admins can view logs" ON public.system_logs
  FOR SELECT USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can create logs" ON public.system_logs
  FOR INSERT WITH CHECK (public.is_admin(auth.uid()));

-- RLS Policies for announcements
CREATE POLICY "Anyone can view active announcements" ON public.announcements
  FOR SELECT USING (active = true AND start_date <= now() AND (end_date IS NULL OR end_date >= now()));

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (public.is_admin(auth.uid()));

-- RLS Policies for monthly_stats
CREATE POLICY "Users can view all stats" ON public.monthly_stats
  FOR SELECT USING (true);

CREATE POLICY "Only system can create/update stats" ON public.monthly_stats
  FOR ALL USING (public.is_admin(auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_challenges_updated_at
  BEFORE UPDATE ON public.challenges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_match_results_updated_at
  BEFORE UPDATE ON public.match_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_app_config_updated_at
  BEFORE UPDATE ON public.app_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at
  BEFORE UPDATE ON public.announcements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_monthly_stats_updated_at
  BEFORE UPDATE ON public.monthly_stats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, first_name, last_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'first_name', 'Nome'),
    COALESCE(NEW.raw_user_meta_data->>'last_name', 'Cognome')
  );
  RETURN NEW;
END;
$$;

-- Create trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();