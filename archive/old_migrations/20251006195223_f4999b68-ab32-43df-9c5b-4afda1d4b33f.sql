-- Add challenge_number column with sequence for unique numeric IDs
CREATE SEQUENCE IF NOT EXISTS challenge_number_seq START 1;

ALTER TABLE challenges 
ADD COLUMN IF NOT EXISTS challenge_number INTEGER DEFAULT nextval('challenge_number_seq');

-- Update existing challenges to have sequential numbers
DO $$
DECLARE
  challenge_record RECORD;
  counter INTEGER := 1;
BEGIN
  FOR challenge_record IN 
    SELECT id FROM challenges ORDER BY created_at
  LOOP
    UPDATE challenges SET challenge_number = counter WHERE id = challenge_record.id;
    counter := counter + 1;
  END LOOP;
END $$;

-- Make challenge_number NOT NULL and UNIQUE after populating existing records
ALTER TABLE challenges 
ALTER COLUMN challenge_number SET NOT NULL,
ADD CONSTRAINT challenges_challenge_number_unique UNIQUE (challenge_number);