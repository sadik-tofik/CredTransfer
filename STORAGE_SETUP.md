# Supabase Storage Setup

This document explains how the Supabase storage is configured for the CredTransfer application.

## Overview

The application uses Supabase Storage to store:
- **Documents**: Academic credentials (diplomas, transcripts, fee clearances)
- **Profile Photos**: User profile pictures
- **Receipts**: Payment receipts

## Storage Buckets

### Documents Bucket (`documents`)
- **Purpose**: Stores academic documents uploaded by registrars
- **Access**: Private (access via signed URLs only)
- **File Size Limit**: 10MB
- **Allowed MIME Types**: 
  - `application/pdf`
  - `image/png`
  - `image/jpeg`
  - `image/jpg`
- **Structure**: `{student_id}/{document_type}/{timestamp}-{filename}`

### Profile Photos Bucket (`profile-photos`)
- **Purpose**: Stores user profile pictures
- **Access**: Private
- **File Size Limit**: 2MB
- **Allowed MIME Types**: PNG, JPEG, JPG, WebP
- **Structure**: `{user_id}/{filename}`

### Receipts Bucket (`receipts`)
- **Purpose**: Stores payment receipts
- **Access**: Private
- **File Size Limit**: 5MB
- **Allowed MIME Types**: PDF, PNG, JPEG, JPG
- **Structure**: `{payment_id}/{filename}`

## Security Policies

### Documents Bucket
- **Read Access**: 
  - Graduates can view their own documents
  - Registrars and admins can view all documents
- **Write Access**: Only registrars and admins can upload documents

### Profile Photos Bucket
- **Read Access**: 
  - Users can view their own profile photos
  - Registrars and admins can view all profile photos
- **Write Access**: Users can only upload to their own folder

### Receipts Bucket
- **Read Access**: 
  - Graduates can view their own receipts
  - Registrars and admins can view all receipts
- **Write Access**: System-controlled uploads

## Setup Instructions

### 1. Manual Setup (SQL)

Run the `scripts/storage-setup.sql` file in your Supabase SQL editor:

```sql
-- Copy and paste the contents of scripts/storage-setup.sql
```

### 2. Automatic Setup (API)

The application provides an API endpoint to set up storage automatically:

```bash
# Check storage health
curl http://localhost:3000/api/storage/setup

# Run storage setup
curl -X POST http://localhost:3000/api/storage/setup
```

### 3. Test the Setup

Run the test script to verify everything is working:

```bash
node scripts/test-storage.js
```

## Utility Functions

The application includes storage utility functions in `lib/storage.ts`:

- `ensureDocumentsBucket()`: Creates the documents bucket if it doesn't exist
- `uploadDocument()`: Uploads a file to the documents bucket
- `getDocumentUrl()`: Generates a signed URL for document access
- `deleteDocument()`: Deletes a document from storage

## Error Handling

The upload API now includes robust error handling:

1. **Bucket Not Found**: Automatically creates the bucket if it doesn't exist
2. **File Validation**: Checks file type and size before upload
3. **Duplicate Detection**: Prevents uploading the same document twice
4. **Signed URLs**: Uses signed URLs for secure document access

## Troubleshooting

### "Bucket not found" Error
- Run the storage setup: `curl -X POST http://localhost:3000/api/storage/setup`
- Check Supabase permissions for your service role key

### Permission Denied Errors
- Ensure your `SUPABASE_SERVICE_ROLE_KEY` has proper storage permissions
- Check that Row Level Security policies are correctly configured

### Upload Failures
- Verify file type is in the allowed list
- Check file size doesn't exceed the limit
- Ensure the user has proper permissions (registrar or admin role)

## Monitoring

Use the storage health check endpoint to monitor status:

```bash
curl http://localhost:3000/api/storage/setup
```

This will return information about:
- Whether storage is accessible
- If the documents bucket exists
- Total number of buckets

## Security Notes

- All buckets are private by default
- Access is controlled via Row Level Security (RLS) policies
- Documents are accessed via signed URLs with 1-hour expiry
- File uploads are validated for type and size
- Document integrity is verified using file hashing
