-- =====================================================
-- Fix Pro Master Points Calculation
-- Date: 2025-01-30
-- =====================================================
-- PROBLEMA:
-- I punti Pro Master vengono distribuiti proporzionalmente al numero
-- di giocatori ELIGIBILI (che hanno abbastanza match), non in base
-- alla posizione assoluta nella classifica.
--
-- SOLUZIONE:
-- I punti devono essere assegnati in base alla posizione assoluta
-- nella classifica Live (live_rank_position), indipendentemente
-- da quanti giocatori hanno diritto ai punti.
--
-- Sistema fisso: 60 posizioni (Gold 1-20, Silver 21-40, Bronze 41-60)
-- - Posizione 1: 500 punti (first_place_points)
-- - Posizione 60: ~8.47 punti
-- - Distribuzione lineare decrescente
-- =====================================================

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
  player_points INTEGER;
  total_positions INTEGER := 60; -- Fixed: Gold (1-20) + Silver (21-40) + Bronze (41-60)
  eligible_count INTEGER := 0;
BEGIN
  -- Count eligible players (for reporting only)
  SELECT COUNT(*) INTO eligible_count
  FROM public.players p
  WHERE p.championship_id = target_championship_id
    AND p.matches_this_month >= min_matches_for_points;

  IF eligible_count = 0 OR first_place_points = 0 THEN
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

  -- Process eligible players
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
    -- Calculate points based on ABSOLUTE position (1-60)
    -- Formula: first_place_points * (total_positions - position + 1) / total_positions
    -- Position 1:  500 * (60 - 1 + 1) / 60 = 500 * 60/60 = 500.00 punti
    -- Position 20: 500 * (60 - 20 + 1) / 60 = 500 * 41/60 = 341.67 punti
    -- Position 21: 500 * (60 - 21 + 1) / 60 = 500 * 40/60 = 333.33 punti
    -- Position 40: 500 * (60 - 40 + 1) / 60 = 500 * 21/60 = 175.00 punti
    -- Position 41: 500 * (60 - 41 + 1) / 60 = 500 * 20/60 = 166.67 punti
    -- Position 60: 500 * (60 - 60 + 1) / 60 = 500 * 1/60 = 8.33 punti

    player_points := ROUND(
      (first_place_points::NUMERIC * (total_positions - player_record.live_rank_position + 1) / total_positions)
    );

    -- Update player points
    UPDATE public.players
    SET
      pro_master_points = pro_master_points + player_points,
      updated_at = now()
    WHERE id = player_record.id;

    -- Track eligible players
    eligible_players_array := eligible_players_array || json_build_object(
      'player', player_record.display_name,
      'category', player_record.live_rank_category,
      'position', player_record.live_rank_position,
      'matches_this_month', player_record.matches_this_month,
      'points_awarded', player_points,
      'new_total_points', player_record.current_points + player_points,
      'calculation', format('500 * (%s - %s + 1) / %s = %s',
        total_positions,
        player_record.live_rank_position,
        total_positions,
        player_points)
    );

    total_points_assigned := total_points_assigned + player_points;
  END LOOP;

  -- Get all players for reporting
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

  -- Update Pro Master rankings based on total points
  ranking_result := public.update_pro_master_rankings(target_championship_id);

  RETURN json_build_object(
    'success', true,
    'message', 'Pro Master points assigned based on absolute live rank position (1-60)',
    'total_points_assigned', total_points_assigned,
    'first_place_points', first_place_points,
    'min_matches_required', min_matches_for_points,
    'eligible_players_count', eligible_count,
    'total_positions', total_positions,
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

COMMENT ON FUNCTION public.calculate_pro_master_points IS
'Assigns Pro Master points based on ABSOLUTE live_rank_position (1-60).
Position 1 gets first_place_points (500), position 60 gets ~8.33 points.
Points are distributed linearly regardless of how many players are eligible.
Only players with >= min_matches_for_points receive points.';
