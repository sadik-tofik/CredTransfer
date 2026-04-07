-- Add university_email column to transfer_requests table
ALTER TABLE transfer_requests 
ADD COLUMN university_email VARCHAR(255);

-- Add comment for clarity
COMMENT ON COLUMN transfer_requests.university_email IS 'Email of the receiving university (required for verification access)';
