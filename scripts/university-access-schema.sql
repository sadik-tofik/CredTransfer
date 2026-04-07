-- University Access Schema for CredTransfer
-- Enables receiving universities to securely access transferred documents

-- University Access Logs Table
CREATE TABLE IF NOT EXISTS university_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transfer_id UUID REFERENCES transfers(id) ON DELETE CASCADE,
    university_email VARCHAR(255) NOT NULL,
    access_granted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_downloaded_at TIMESTAMP WITH TIME ZONE,
    download_count INTEGER DEFAULT 0,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_university_access_logs_transfer_id ON university_access_logs(transfer_id);
CREATE INDEX IF NOT EXISTS idx_university_access_logs_email ON university_access_logs(university_email);
CREATE INDEX IF NOT EXISTS idx_university_access_logs_created_at ON university_access_logs(created_at);

-- Add university_email to transfers table if not exists
ALTER TABLE transfers 
ADD COLUMN IF NOT EXISTS university_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS access_code VARCHAR(32) DEFAULT encode(gen_random_bytes(16), 'hex'),
ADD COLUMN IF NOT EXISTS verification_code VARCHAR(32) DEFAULT encode(gen_random_bytes(16), 'hex');

-- Create unique constraint on access codes
ALTER TABLE transfers 
ADD CONSTRAINT unique_access_code UNIQUE (access_code);

-- Row Level Security for university_access_logs
ALTER TABLE university_access_logs ENABLE ROW LEVEL SECURITY;

-- Policy for inserting access logs (anyone can insert when they have valid transfer)
CREATE POLICY "Users can insert university access logs" ON university_access_logs
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM transfers 
            WHERE transfers.id = transfer_id 
            AND transfers.status = 'approved'
        )
    );

-- Policy for reading access logs (only system admins and transfer owner)
CREATE POLICY "Users can view university access logs" ON university_access_logs
    FOR SELECT USING (
        auth.jwt() ->> 'role' = 'admin' OR
        EXISTS (
            SELECT 1 FROM transfers t
            JOIN graduates g ON t.graduate_id = g.id
            JOIN auth.users u ON g.user_id = u.id
            WHERE t.id = transfer_id AND u.id = auth.uid()
        )
    );

-- Function to generate access codes
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS TEXT AS $$
BEGIN
    RETURN encode(gen_random_bytes(16), 'hex');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to automatically generate access codes when transfer is approved
CREATE OR REPLACE FUNCTION set_transfer_access_codes()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'approved' AND OLD.status != 'approved' THEN
        NEW.access_code := encode(gen_random_bytes(16), 'hex');
        NEW.verification_code := encode(gen_random_bytes(16), 'hex');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS transfer_access_codes_trigger ON transfers;
CREATE TRIGGER transfer_access_codes_trigger
    BEFORE UPDATE ON transfers
    FOR EACH ROW
    EXECUTE FUNCTION set_transfer_access_codes();

-- Function to send university access email
CREATE OR REPLACE FUNCTION send_university_access_email(
    p_transfer_id UUID,
    p_university_email VARCHAR(255)
)
RETURNS BOOLEAN AS $$
DECLARE
    v_access_code VARCHAR(32);
    v_verification_code VARCHAR(32);
    v_graduate_name VARCHAR(255);
    v_document_type VARCHAR(100);
BEGIN
    -- Get transfer details
    SELECT 
        t.access_code,
        t.verification_code,
        g.full_name,
        d.document_type
    INTO v_access_code, v_verification_code, v_graduate_name, v_document_type
    FROM transfers t
    JOIN graduates g ON t.graduate_id = g.id
    JOIN documents d ON t.document_id = d.id
    WHERE t.id = p_transfer_id;
    
    -- TODO: Implement actual email sending logic
    -- This would integrate with your email service
    RAISE NOTICE 'University access email sent to % for graduate % document %', 
        p_university_email, v_graduate_name, v_document_type;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
