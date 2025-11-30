-- Add index on players.user_id for faster lookups
-- This will speed up queries like: SELECT * FROM players WHERE user_id = '...'
CREATE INDEX IF NOT EXISTS idx_players_user_id ON public.players(user_id);

-- Add comment
COMMENT ON INDEX idx_players_user_id IS 'Index for faster user_id lookups in players table';
