import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const verifierInstitution = request.headers.get('x-verifier-institution') || null;

    if (!code || code.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if it's a transfer hash code (16-char alphanumeric)
    const isHashCode = /^[A-Z0-9]{16}$/.test(code);

    if (!isHashCode) {
      return NextResponse.json(
        { success: false, error: 'Invalid download code format' },
        { status: 400 }
      );
    }

    // Look up the transfer request
    const { data: transfer, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        id,
        hash_code,
        status,
        expires_at,
        recipient_institution,
        university_email,
        document:documents (
          id,
          file_name,
          file_path,
          file_hash,
          status
        )
      `)
      .eq('hash_code', code)
      .single();

    if (transferError || !transfer) {
      return NextResponse.json(
        { success: false, error: 'Transfer request not found' },
        { status: 404 }
      );
    }

    // Check if transfer is valid and not expired
    if (transfer.status !== 'approved' && transfer.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: 'Transfer request is not approved' },
        { status: 403 }
      );
    }

    if (new Date(transfer.expires_at) < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Transfer request has expired' },
        { status: 403 }
      );
    }

    const document = transfer.document as any;
    if (!document || document.status !== 'active') {
      return NextResponse.json(
        { success: false, error: 'Document not available' },
        { status: 404 }
      );
    }

    // Log the download attempt for audit
    await supabaseAdmin.from('audit_logs').insert({
      user_id: null, // Anonymous download
      action: 'download_shared_document',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        verification_code: code,
        verifier_institution: verifierInstitution || 'Unknown',
        recipient_institution: transfer.recipient_institution,
        university_email: transfer.university_email,
      },
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
    });

    // Get the file from Supabase storage
    const { data: fileData, error: fileError } = await supabaseAdmin.storage
      .from('documents')
      .download(document.file_path);

    if (fileError) {
      console.error('File download error:', fileError);
      return NextResponse.json(
        { success: false, error: 'File not found in storage' },
        { status: 404 }
      );
    }

    // Convert file to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Set appropriate headers for file download
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${document.file_name}"`);
    headers.set('Content-Length', buffer.length.toString());

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
