-- ============================================================
-- CREDTRANSFER DATABASE MIGRATIONS
-- Jimma University - Academic Credential Verification System
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- TABLES
-- ============================================================

-- Users table (base for all roles)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('graduate', 'registrar', 'admin')),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    is_verified BOOLEAN DEFAULT FALSE,
    verification_token VARCHAR(255),
    verification_token_expires TIMESTAMP,
    reset_token VARCHAR(255),
    reset_token_expires TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Graduates table
CREATE TABLE IF NOT EXISTS graduates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id VARCHAR(50) UNIQUE NOT NULL,
    graduation_year INTEGER,
    department VARCHAR(255),
    fee_cleared BOOLEAN DEFAULT FALSE,
    profile_photo_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Registrars table
CREATE TABLE IF NOT EXISTS registrars (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    employee_id VARCHAR(50) UNIQUE NOT NULL,
    department VARCHAR(255),
    permissions JSONB DEFAULT '{"upload": true, "approve": true, "reports": true, "manage_graduates": true}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graduate_id UUID REFERENCES graduates(id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL CHECK (document_type IN ('diploma', 'transcript', 'fee_clearance', 'other')),
    file_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    file_size INTEGER,
    file_hash VARCHAR(255) UNIQUE NOT NULL,
    blockchain_tx_hash VARCHAR(255),
    blockchain_block INTEGER,
    blockchain_timestamp TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'pending', 'expired')),
    uploaded_by UUID REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graduate_id UUID REFERENCES graduates(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'ETB',
    payment_method VARCHAR(50) NOT NULL CHECK (payment_method IN ('telebirr', 'bank_transfer', 'cbe_birr')),
    transaction_reference VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
    paid_at TIMESTAMP WITH TIME ZONE,
    receipt_url VARCHAR(500),
    metadata JSONB,
    idempotency_key VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Transfer requests table
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    graduate_id UUID REFERENCES graduates(id) ON DELETE CASCADE,
    document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
    recipient_institution VARCHAR(255) NOT NULL,
    recipient_email VARCHAR(255),
    payment_status VARCHAR(50) DEFAULT 'pending',
    payment_id UUID REFERENCES payments(id),
    qr_code TEXT,
    hash_code VARCHAR(50) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'completed')),
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '30 days'
);

-- Verifications table
CREATE TABLE IF NOT EXISTS verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID REFERENCES documents(id),
    transfer_request_id UUID REFERENCES transfer_requests(id),
    verifier_institution VARCHAR(255),
    verification_code VARCHAR(50),
    result VARCHAR(50) CHECK (result IN ('verified', 'invalid', 'suspicious', 'revoked')),
    verified_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    ip_address INET
);

-- Audit logs table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_graduates_student_id ON graduates(student_id);
CREATE INDEX IF NOT EXISTS idx_graduates_user_id ON graduates(user_id);
CREATE INDEX IF NOT EXISTS idx_documents_graduate_id ON documents(graduate_id);
CREATE INDEX IF NOT EXISTS idx_documents_file_hash ON documents(file_hash);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_graduate_id ON transfer_requests(graduate_id);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_hash_code ON transfer_requests(hash_code);
CREATE INDEX IF NOT EXISTS idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_payments_graduate_id ON payments(graduate_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_transaction_reference ON payments(transaction_reference);
CREATE INDEX IF NOT EXISTS idx_verifications_document_id ON verifications(document_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_graduates_updated_at
    BEFORE UPDATE ON graduates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_transfer_requests_updated_at
    BEFORE UPDATE ON transfer_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to check if graduate has fee clearance
CREATE OR REPLACE FUNCTION check_fee_clearance(grad_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    is_cleared BOOLEAN;
BEGIN
    SELECT fee_cleared INTO is_cleared FROM graduates WHERE id = grad_id;
    RETURN COALESCE(is_cleared, FALSE);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get graduate statistics
CREATE OR REPLACE FUNCTION get_graduate_stats(grad_user_id UUID)
RETURNS JSONB AS $$
DECLARE
    grad_id UUID;
    result JSONB;
BEGIN
    SELECT id INTO grad_id FROM graduates WHERE user_id = grad_user_id;

    SELECT jsonb_build_object(
        'total_documents', (SELECT COUNT(*) FROM documents WHERE graduate_id = grad_id AND status = 'active'),
        'active_transfers', (SELECT COUNT(*) FROM transfer_requests WHERE graduate_id = grad_id AND status IN ('pending', 'approved')),
        'total_verifications', (SELECT COUNT(*) FROM verifications v
                                JOIN documents d ON v.document_id = d.id
                                WHERE d.graduate_id = grad_id),
        'completed_transfers', (SELECT COUNT(*) FROM transfer_requests WHERE graduate_id = grad_id AND status = 'completed')
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get registrar dashboard stats
CREATE OR REPLACE FUNCTION get_registrar_stats()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'total_documents', (SELECT COUNT(*) FROM documents),
        'total_graduates', (SELECT COUNT(*) FROM graduates),
        'pending_requests', (SELECT COUNT(*) FROM transfer_requests WHERE status = 'pending'),
        'total_verifications', (SELECT COUNT(*) FROM verifications),
        'documents_today', (SELECT COUNT(*) FROM documents WHERE DATE(uploaded_at) = CURRENT_DATE),
        'revenue_this_month', (SELECT COALESCE(SUM(amount), 0) FROM payments
                               WHERE status = 'completed'
                               AND DATE_TRUNC('month', paid_at) = DATE_TRUNC('month', CURRENT_DATE))
    ) INTO result;

    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE graduates ENABLE ROW LEVEL SECURITY;
ALTER TABLE registrars ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE transfer_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE verifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users RLS
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Admins can view all users" ON users
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
    );

-- Graduates RLS
CREATE POLICY "Graduates can view own data" ON graduates
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Registrars can view all graduates" ON graduates
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin'))
    );

CREATE POLICY "Registrars can update graduates" ON graduates
    FOR UPDATE USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin'))
    );

-- Documents RLS
CREATE POLICY "Graduates can view own documents" ON documents
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM graduates WHERE id = documents.graduate_id AND user_id = auth.uid())
    );

CREATE POLICY "Registrars can manage documents" ON documents
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin'))
    );

-- Transfer requests RLS
CREATE POLICY "Graduates can view own transfers" ON transfer_requests
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM graduates WHERE id = transfer_requests.graduate_id AND user_id = auth.uid())
    );

CREATE POLICY "Graduates can create transfer requests" ON transfer_requests
    FOR INSERT WITH CHECK (
        EXISTS (SELECT 1 FROM graduates WHERE id = transfer_requests.graduate_id AND user_id = auth.uid())
    );

CREATE POLICY "Registrars can manage transfers" ON transfer_requests
    FOR ALL USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin'))
    );

-- Payments RLS
CREATE POLICY "Graduates can view own payments" ON payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM graduates WHERE id = payments.graduate_id AND user_id = auth.uid())
    );

CREATE POLICY "Registrars can view all payments" ON payments
    FOR SELECT USING (
        EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('registrar', 'admin'))
    );

-- Notifications RLS
CREATE POLICY "Users can view own notifications" ON notifications
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can update own notifications" ON notifications
    FOR UPDATE USING (user_id = auth.uid());

-- ============================================================
-- SEED DATA (Demo/Testing)
-- ============================================================

-- Insert admin user (password: Admin@123456)
INSERT INTO users (id, email, password_hash, role, full_name, is_verified)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@ju.edu.et',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGhGnNp3QyilEJWFEIEMKwPXJJi',
    'admin',
    'System Administrator',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert demo registrar (password: Registrar@123)
INSERT INTO users (id, email, password_hash, role, full_name, phone, is_verified)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'registrar@ju.edu.et',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGhGnNp3QyilEJWFEIEMKwPXJJi',
    'registrar',
    'Ato Kebede Alemu',
    '+251911234567',
    true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO registrars (user_id, employee_id, department)
VALUES (
    'b0000000-0000-0000-0000-000000000001',
    'JU-REG-001',
    'Academic Registrar'
) ON CONFLICT (employee_id) DO NOTHING;

-- Insert demo graduate (password: Graduate@123)
INSERT INTO users (id, email, password_hash, role, full_name, phone, is_verified)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'abebe.bikila@ju.edu.et',
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TiGhGnNp3QyilEJWFEIEMKwPXJJi',
    'graduate',
    'Abebe Bikila',
    '+251922345678',
    true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO graduates (user_id, student_id, graduation_year, department, fee_cleared)
VALUES (
    'c0000000-0000-0000-0000-000000000001',
    'JU/1234/15',
    2023,
    'Computer Science and Engineering',
    true
) ON CONFLICT (student_id) DO NOTHING;
