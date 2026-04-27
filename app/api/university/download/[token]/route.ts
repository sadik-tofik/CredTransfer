import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    // Decode and verify the secure token
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    } catch {
      return NextResponse.json(
        { error: 'Invalid download token' },
        { status: 400 }
      );
    }

    // Check if token has expired
    const expiresAt = new Date(decoded.expires_at);
    if (expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Download link has expired' },
        { status: 410 }
      );
    }

    const supabase = createClient();

    // Get the transfer details
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select(`
        *,
        graduate:graduates(id, full_name, student_id, email),
        document:documents(id, document_type, file_name, file_url, file_hash)
      `)
      .eq('id', decoded.transfer_id)
      .eq('status', 'approved')
      .single();

    if (transferError || !transfer) {
      return NextResponse.json(
        { error: 'Transfer not found or not approved' },
        { status: 404 }
      );
    }

    // Verify university email matches
    if (transfer.university_email !== decoded.university_email) {
      return NextResponse.json(
        { error: 'Unauthorized access' },
        { status: 403 }
      );
    }

    // Check download count (max 3 downloads)
    const { data: downloadLogs } = await supabase
      .from('university_access_logs')
      .select('download_count')
      .eq('transfer_id', transfer.id)
      .eq('university_email', decoded.university_email)
      .single();

    if (downloadLogs && downloadLogs.download_count >= 3) {
      return NextResponse.json(
        { error: 'Download limit exceeded' },
        { status: 429 }
      );
    }

    // Increment download count
    await supabase
      .from('university_access_logs')
      .update({
        download_count: (downloadLogs?.download_count || 0) + 1,
        last_downloaded_at: new Date().toISOString(),
      })
      .eq('transfer_id', transfer.id)
      .eq('university_email', decoded.university_email);

    // Get the file from storage
    const { data: fileData, error: fileError } = await supabase.storage
      .from('documents')
      .download(transfer.document.file_url);

    if (fileError) {
      console.error('File download error:', fileError);
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Return the file with proper headers
    const headers = new Headers();
    headers.set('Content-Type', 'application/pdf');
    headers.set('Content-Disposition', `attachment; filename="${transfer.document.file_name}"`);
    headers.set('Cache-Control', 'private, max-age=3600');

    return new NextResponse(fileData, {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
