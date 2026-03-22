import { supabaseAdmin } from '@/lib/supabase';

/**
 * Ensure the documents storage bucket exists
 */
export async function ensureDocumentsBucket(): Promise<boolean> {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabaseAdmin.storage.listBuckets();
    
    if (listError) {
      console.error('Error listing buckets:', listError);
      return false;
    }

    const documentsBucket = buckets?.find(bucket => bucket.name === 'documents');
    
    if (!documentsBucket) {
      // Create the bucket if it doesn't exist
      const { error: createError } = await supabaseAdmin.storage.createBucket('documents', {
        public: false,
        fileSizeLimit: 10 * 1024 * 1024, // 10MB
        allowedMimeTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg']
      });

      if (createError) {
        console.error('Error creating documents bucket:', createError);
        return false;
      }

      console.log('Documents bucket created successfully');
    }

    return true;
  } catch (error) {
    console.error('Error ensuring documents bucket:', error);
    return false;
  }
}

/**
 * Upload a file to the documents bucket
 */
export async function uploadDocument(
  fileName: string,
  fileBuffer: Buffer,
  contentType: string
): Promise<{ path: string; error?: string }> {
  try {
    // Ensure bucket exists before uploading
    const bucketReady = await ensureDocumentsBucket();
    if (!bucketReady) {
      return { path: '', error: 'Failed to prepare storage bucket' };
    }

    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: false,
      });

    if (error) {
      console.error('Storage upload error:', error);
      return { path: '', error: error.message };
    }

    return { path: data.path };
  } catch (error) {
    console.error('Unexpected upload error:', error);
    return { path: '', error: 'Unexpected upload error' };
  }
}

/**
 * Get a public URL for a document (signed URL for private bucket)
 */
export async function getDocumentUrl(path: string): Promise<{ url: string; error?: string }> {
  try {
    const { data, error } = await supabaseAdmin.storage
      .from('documents')
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.error('Error creating signed URL:', error);
      return { url: '', error: error.message };
    }

    return { url: data.signedUrl };
  } catch (error) {
    console.error('Unexpected URL generation error:', error);
    return { url: '', error: 'Unexpected URL generation error' };
  }
}

/**
 * Delete a document from storage
 */
export async function deleteDocument(path: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabaseAdmin.storage
      .from('documents')
      .remove([path]);

    if (error) {
      console.error('Error deleting document:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Unexpected delete error:', error);
    return { success: false, error: 'Unexpected delete error' };
  }
}
