-- =====================================================
-- FIX PRO MASTER RANKINGS SYSTEM
-- =====================================================
-- This script updates calculate_pro_master_points to also
-- update pro_master_rank_position after assigning points
-- =====================================================

-- First, create the update_pro_master_rankings function
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
  updated_count INTEGER := 0;
BEGIN
  -- Update pro_master_rank_position based on pro_master_points (descending order)
  FOR player_record IN
    SELECT
      id,
      display_name,
      pro_master_points
    FROM public.players
    WHERE championship_id = target_championship_id
    ORDER BY pro_master_points DESC, live_rank_position ASC
  LOOP
    UPDATE public.players
    SET
      pro_master_rank_position = current_position,
      updated_at = now()
    WHERE id = player_record.id;

    current_position := current_position + 1;
    updated_count := updated_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master rankings updated successfully',
    'updated_players', updated_count
  );
END;
$$;

-- Now update calculate_pro_master_points to call update_pro_master_rankings at the end
CREATE OR REPLACE FUNCTION public.calculate_pro_master_points(
  target_championship_id UUID,
  target_month DATE DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  player_record RECORD;
  points_assigned INTEGER := 0;
  points_to_add NUMERIC;
  prev_month_start TIMESTAMP WITH TIME ZONE;
  prev_month_end TIMESTAMP WITH TIME ZONE;
  awarded_players_array JSON[] := '{}';
  all_players_array JSON[] := '{}';
  ranking_result JSON;
BEGIN
  IF target_month IS NULL THEN
    prev_month_start := date_trunc('month', now() - interval '1 month');
    prev_month_end := date_trunc('month', now());
  ELSE
    prev_month_start := date_trunc('month', target_month::timestamp);
    prev_month_end := date_trunc('month', target_month::timestamp) + interval '1 month';
  END IF;

  FOR player_record IN
    SELECT
      p.id,
      p.user_id,
      p.display_name,
      p.live_rank_position,
      COUNT(m.id) as monthly_matches
    FROM public.players p
    LEFT JOIN public.matches m ON
      (m.winner_id = p.user_id OR m.loser_id = p.user_id) AND
      m.championship_id = target_championship_id AND
      m.played_at >= prev_month_start AND
      m.played_at < prev_month_end AND
      m.is_scheduled = false
    WHERE p.championship_id = target_championship_id
    GROUP BY p.id, p.user_id, p.display_name, p.live_rank_position
    ORDER BY p.live_rank_position ASC
  LOOP
    points_to_add := get_pro_master_points_by_position(player_record.live_rank_position);

    all_players_array := all_players_array || json_build_object(
      'name', player_record.display_name,
      'position', player_record.live_rank_position,
      'matches_last_month', player_record.monthly_matches,
      'points_calculated', points_to_add
    );

    IF player_record.monthly_matches >= 1 THEN
      UPDATE public.players
      SET
        pro_master_points = pro_master_points + points_to_add,
        updated_at = now()
      WHERE id = player_record.id;

      points_assigned := points_assigned + 1;

      awarded_players_array := awarded_players_array || json_build_object(
        'name', player_record.display_name,
        'position', player_record.live_rank_position,
        'matches', player_record.monthly_matches,
        'points_added', points_to_add
      );

      INSERT INTO public.monthly_snapshots (
        player_id,
        championship_id,
        month_date,
        rank_position,
        points_awarded,
        matches_played
      )
      VALUES (
        player_record.id,
        target_championship_id,
        prev_month_start,
        player_record.live_rank_position,
        points_to_add,
        player_record.monthly_matches
      )
      ON CONFLICT (player_id, month_date)
      DO UPDATE SET
        rank_position = EXCLUDED.rank_position,
        points_awarded = EXCLUDED.points_awarded,
        matches_played = EXCLUDED.matches_played;
    END IF;
  END LOOP;

  -- IMPORTANT: Update Pro Master rankings after assigning points
  ranking_result := update_pro_master_rankings(target_championship_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master points assigned and rankings updated',
    'players_awarded', points_assigned,
    'period', json_build_object(
      'from', prev_month_start,
      'to', prev_month_end
    ),
    'all_players', all_players_array,
    'awarded_details', awarded_players_array,
    'ranking_update', ranking_result
  );
END;
$$;

-- Create triggers for automatic best rank updates
CREATE OR REPLACE FUNCTION public.update_best_live_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_live_rank if current position is better (lower number = better)
  -- OR if best_live_rank is NULL
  IF NEW.live_rank_position IS NOT NULL THEN
    IF OLD.best_live_rank IS NULL OR NEW.live_rank_position < OLD.best_live_rank THEN
      NEW.best_live_rank := NEW.live_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_best_live_rank ON public.players;
CREATE TRIGGER trigger_update_best_live_rank
  BEFORE UPDATE OF live_rank_position ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_best_live_rank();

CREATE OR REPLACE FUNCTION public.update_best_pro_master_rank()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Update best_pro_master_rank if current position is better (lower number = better)
  -- OR if best_pro_master_rank is NULL
  IF NEW.pro_master_rank_position IS NOT NULL THEN
    IF OLD.best_pro_master_rank IS NULL OR NEW.pro_master_rank_position < OLD.best_pro_master_rank THEN
      NEW.best_pro_master_rank := NEW.pro_master_rank_position;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_best_pro_master_rank ON public.players;
CREATE TRIGGER trigger_update_best_pro_master_rank
  BEFORE UPDATE OF pro_master_rank_position ON public.players
  FOR EACH ROW
  EXECUTE FUNCTION public.update_best_pro_master_rank();
