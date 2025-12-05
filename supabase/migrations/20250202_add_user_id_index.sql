-- Add index on players.user_id for fast user lookup
-- This index will dramatically improve authentication performance

-- Create index on players.user_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_players_user_id ON players(user_id);

-- Also add index on registration_requests.user_id for completeness
CREATE INDEX IF NOT EXISTS idx_registration_requests_user_id ON registration_requests(user_id);

-- Add comment to explain the purpose
COMMENT ON INDEX idx_players_user_id IS 'Index for fast user lookup during authentication - critical for performance';
COMMENT ON INDEX idx_registration_requests_user_id IS 'Index for fast user lookup in registration requests';
