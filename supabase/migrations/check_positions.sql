-- Query per verificare le posizioni attuali nel database
SELECT
  display_name,
  live_rank_category,
  live_rank_position,
  matches_this_month
FROM players
ORDER BY live_rank_position;
