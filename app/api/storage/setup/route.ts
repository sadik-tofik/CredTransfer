import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { ensureDocumentsBucket } from '@/lib/storage';

export async function POST() {
  try {
    // Ensure documents bucket exists
    const bucketReady = await ensureDocumentsBucket();
    
    if (!bucketReady) {
      return NextResponse.json(
        { success: false, error: 'Failed to set up storage bucket' },
        { status: 500 }
      );
    }

    // Check if bucket is accessible
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Failed to list buckets' },
        { status: 500 }
      );
    }

    const documentsBucket = buckets?.find(b => b.name === 'documents');
    
    return NextResponse.json({
      success: true,
      message: 'Storage setup completed successfully',
      data: {
        bucketExists: !!documentsBucket,
        bucketInfo: documentsBucket ? {
          name: documentsBucket.name,
          public: documentsBucket.public,
          fileSizeLimit: documentsBucket.file_size_limit,
          allowedMimeTypes: documentsBucket.allowed_mime_types
        } : null,
        allBuckets: buckets?.map(b => ({
          name: b.name,
          public: b.public
        }))
      }
    });
  } catch (error) {
    console.error('Storage setup error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  // Health check endpoint
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    
    if (error) {
      return NextResponse.json(
        { success: false, error: 'Storage not accessible' },
        { status: 500 }
      );
    }

    const documentsBucket = buckets?.find(b => b.name === 'documents');
    
    return NextResponse.json({
      success: true,
      data: {
        storageReady: !!documentsBucket,
        bucketExists: !!documentsBucket,
        bucketsCount: buckets?.length || 0
      }
    });
  } catch (error) {
    console.error('Storage health check error:', error);
    return NextResponse.json(
      { success: false, error: 'Storage health check failed' },
      { status: 500 }
    );
  }
}
