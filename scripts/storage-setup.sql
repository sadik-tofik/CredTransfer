-- ============================================================
-- SUPABASE STORAGE SETUP
-- Jimma University - Academic Credential Verification System
-- Run this in your Supabase SQL editor to set up storage buckets
-- ============================================================

-- Create storage bucket for documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'documents',
    'documents',
    false, -- Private bucket, access via signed URLs
    10485760, -- 10MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    false, -- Private bucket
    2097152, -- 2MB limit
    ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for receipts
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'receipts',
    'receipts',
    false, -- Private bucket
    5242880, -- 5MB limit
    ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- STORAGE POLICIES (RLS for Storage)
-- ============================================================

-- Documents bucket policies
CREATE POLICY "Users can view their own documents" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'documents' AND
        auth.role() = 'authenticated' AND
        (
            -- Graduate can view their own documents
            EXISTS (
                SELECT 1 FROM documents d
                JOIN graduates g ON d.graduate_id = g.id
                WHERE d.file_path = storage.foldername(name) || '/' || storage.filename(name)
                AND g.user_id = auth.uid()
            ) OR
            -- Registrars and admins can view all documents
            EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid() AND role IN ('registrar', 'admin')
            )
        )
    );

CREATE POLICY "Registrars can upload documents" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'documents' AND
        auth.role() = 'authenticated' AND
        EXISTS (
            SELECT 1 FROM users
            WHERE id = auth.uid() AND role IN ('registrar', 'admin')
        )
    );

CREATE POLICY "System can update documents" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'documents' AND
        auth.role() = 'authenticated'
    );

-- Profile photos bucket policies
CREATE POLICY "Users can view their own profile photos" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'profile-photos' AND
        auth.role() = 'authenticated' AND
        (
            -- User can view their own profile photo
            name LIKE auth.uid() || '/%' OR
            -- Registrars and admins can view all profile photos
            EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid() AND role IN ('registrar', 'admin')
            )
        )
    );

CREATE POLICY "Users can upload their own profile photos" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'profile-photos' AND
        auth.role() = 'authenticated' AND
        name LIKE auth.uid() || '/%'
    );

CREATE POLICY "Users can update their own profile photos" ON storage.objects
    FOR UPDATE USING (
        bucket_id = 'profile-photos' AND
        auth.role() = 'authenticated' AND
        name LIKE auth.uid() || '/%'
    );

-- Receipts bucket policies
CREATE POLICY "Users can view their own receipts" ON storage.objects
    FOR SELECT USING (
        bucket_id = 'receipts' AND
        auth.role() = 'authenticated' AND
        (
            -- Graduate can view their own receipts
            EXISTS (
                SELECT 1 FROM payments p
                JOIN graduates g ON p.graduate_id = g.id
                WHERE p.receipt_url LIKE '%' || storage.foldername(name) || '/' || storage.filename(name)
                AND g.user_id = auth.uid()
            ) OR
            -- Registrars and admins can view all receipts
            EXISTS (
                SELECT 1 FROM users
                WHERE id = auth.uid() AND role IN ('registrar', 'admin')
            )
        )
    );

CREATE POLICY "System can upload receipts" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'receipts' AND
        auth.role() = 'authenticated'
    );

-- ============================================================
-- FUNCTIONS FOR STORAGE OPERATIONS
-- ============================================================

-- Function to generate signed URL for document access
CREATE OR REPLACE FUNCTION get_document_url(file_path TEXT)
RETURNS TEXT AS $$
DECLARE
    signed_url TEXT;
BEGIN
    SELECT storage.get_signed_url(
        'documents',
        file_path,
        3600 -- 1 hour expiry
    ) INTO signed_url;
    
    RETURN signed_url;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has access to document
CREATE OR REPLACE FUNCTION can_access_document(document_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    graduate_user_id UUID;
    user_role TEXT;
BEGIN
    -- Get the graduate user_id for this document
    SELECT g.user_id INTO graduate_user_id
    FROM documents d
    JOIN graduates g ON d.graduate_id = g.id
    WHERE d.id = document_id;
    
    -- Get the requesting user's role
    SELECT role INTO user_role FROM users WHERE id = user_id;
    
    -- Allow access if it's their own document or they're registrar/admin
    RETURN (graduate_user_id = user_id) OR (user_role IN ('registrar', 'admin'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant necessary permissions
GRANT ALL ON storage.buckets TO authenticated;
GRANT ALL ON storage.objects TO authenticated;
