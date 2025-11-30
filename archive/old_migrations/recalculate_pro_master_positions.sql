-- =====================================================
-- RECALCULATE PRO MASTER POSITIONS
-- =====================================================
-- Execute this to recalculate pro_master_rank_position
-- based on pro_master_points (highest points = position 1)
-- =====================================================

DO $$
DECLARE
  championship_record RECORD;
  player_record RECORD;
  current_position INTEGER;
  result_message TEXT := '';
BEGIN
  -- Loop through all championships
  FOR championship_record IN
    SELECT DISTINCT id, name FROM public.championships ORDER BY name
  LOOP
    current_position := 1;
    result_message := result_message || 'Championship: ' || championship_record.name || E'\n';

    -- Update positions for each championship
    FOR player_record IN
      SELECT
        id,
        display_name,
        pro_master_points
      FROM public.players
      WHERE championship_id = championship_record.id
      ORDER BY pro_master_points DESC, live_rank_position ASC
    LOOP
      UPDATE public.players
      SET
        pro_master_rank_position = current_position,
        updated_at = now()
      WHERE id = player_record.id;

      result_message := result_message || '  ' || current_position || '. ' ||
                       player_record.display_name || ' (' ||
                       player_record.pro_master_points || ' points)' || E'\n';

      current_position := current_position + 1;
    END LOOP;

    result_message := result_message || E'\n';
  END LOOP;

  RAISE NOTICE '%', result_message;
  RAISE NOTICE 'Pro Master positions recalculated successfully!';
END;
$$;

-- Verify the results
SELECT
  display_name,
  pro_master_points,
  pro_master_rank_position,
  live_rank_position
FROM public.players
ORDER BY pro_master_points DESC, live_rank_position ASC
LIMIT 10;
