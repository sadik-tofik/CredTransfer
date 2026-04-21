-- Update existing demo graduate to require payment
-- Run this if you already have the demo user in your database

UPDATE graduates 
SET fee_cleared = false 
WHERE user_id = 'c0000000-0000-0000-0000-000000000001';

-- Add a comment explaining the change
COMMENT ON COLUMN graduates.fee_cleared IS 'Updated to false for payment testing - demo users should require payment to test the full payment flow';
