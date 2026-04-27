-- ============================================================
-- MIGRATION: Payment Screenshot & University Email Support
-- Run this in your Supabase SQL editor
-- ============================================================

-- 1. Add payment_screenshot_url to payments table
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_screenshot_url TEXT,
  ADD COLUMN IF NOT EXISTS screenshot_uploaded_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE;

-- 1b. Expand payment_method CHECK constraint to include 'chapa'
-- Drop old constraint and add new one
ALTER TABLE payments DROP CONSTRAINT IF EXISTS payments_payment_method_check;
ALTER TABLE payments ADD CONSTRAINT payments_payment_method_check
  CHECK (payment_method IN ('chapa', 'telebirr', 'bank_transfer', 'cbe_birr'));

-- Also update transfer_requests if it has a payment_method column constraint
ALTER TABLE transfer_requests DROP CONSTRAINT IF EXISTS transfer_requests_payment_method_check;


-- 2. Add university_email to transfer_requests (receiving institution's official email)
ALTER TABLE transfer_requests
  ADD COLUMN IF NOT EXISTS university_email VARCHAR(255),
  ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'bank_transfer';

-- 3. Create storage bucket for payment screenshots (run in Supabase dashboard or via API)
-- The bucket "payment-screenshots" should be created as a private bucket.

-- 4. RLS policy: graduates can insert their own screenshots
-- (Assumes you have RLS enabled on payments table)

-- Policy to allow authenticated users to upload to payment-screenshots bucket
-- Run this in Supabase Storage policies:
-- INSERT policy: (auth.uid() IS NOT NULL)
-- SELECT policy: (auth.uid() IS NOT NULL)

-- 5. Add index for faster lookups
CREATE INDEX IF NOT EXISTS idx_payments_graduate_status ON payments(graduate_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_payment_id ON transfer_requests(payment_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status_created ON transfer_requests(status, created_at DESC);

-- 6. Update audit_logs to include more action types (they're already VARCHAR so no change needed)

-- 7. Add notification_type to notifications for better filtering
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS notification_type VARCHAR(50) DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS read_at TIMESTAMP WITH TIME ZONE;

-- Verify columns added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payments' 
ORDER BY ordinal_position;

SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'transfer_requests' 
ORDER BY ordinal_position;
