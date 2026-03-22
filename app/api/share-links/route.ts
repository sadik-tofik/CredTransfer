import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateHashCode, generateQRCodeData } from '@/lib/crypto';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get graduate record
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate not found' }, { status: 404 });
    }

    // Get transfer requests with share info for this graduate
    const { data, error } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        document:documents(id, document_type, file_name, file_hash),
        payment:payments(id, amount, status, payment_method)
      `)
      .eq('graduate_id', graduate.id)
      .not('hash_code', 'is', null)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in share links API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { document_id, recipient_institution, recipient_email, expires_in_days = 30 } = body;

    if (!document_id || !recipient_institution) {
      return NextResponse.json(
        { success: false, error: 'Document ID and recipient institution are required' },
        { status: 400 }
      );
    }

    // Get graduate record
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id, fee_cleared')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate not found' }, { status: 404 });
    }

    // Verify document ownership
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('id, file_hash, document_type')
      .eq('id', document_id)
      .eq('graduate_id', graduate.id)
      .single();

    if (!document) {
      return NextResponse.json(
        { success: false, error: 'Document not found or not owned by you' },
        { status: 404 }
      );
    }

    // Generate hash code and QR code
    const hashCode = generateHashCode();
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${hashCode}`;
    const qrCodeDataUrl = await generateQRCodeData(verifyUrl);

    // Calculate expiry
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expires_in_days);

    // Create transfer request with share link
    const { data: transferRequest, error } = await supabaseAdmin
      .from('transfer_requests')
      .insert({
        graduate_id: graduate.id,
        document_id,
        recipient_institution,
        recipient_email: recipient_email || null,
        payment_status: graduate.fee_cleared ? 'waived' : 'pending',
        qr_code: qrCodeDataUrl,
        hash_code: hashCode,
        status: graduate.fee_cleared ? 'approved' : 'pending',
        expires_at: expiresAt.toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating share link:', error);
      return NextResponse.json({ success: false, error: 'Failed to create share link' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_share_link',
      resource_type: 'transfer_request',
      resource_id: transferRequest.id,
      details: { document_id, recipient_institution, expires_at: expiresAt.toISOString() },
    });

    return NextResponse.json({
      success: true,
      data: {
        transfer_id: transferRequest.id,
        hash_code: hashCode,
        qr_code: qrCodeDataUrl,
        verify_url: verifyUrl,
        expires_at: expiresAt.toISOString(),
        requires_payment: !graduate.fee_cleared,
      },
      message: graduate.fee_cleared
        ? 'Share link created successfully!'
        : 'Share link created. Payment required to activate.',
    });
  } catch (error) {
    console.error('Error in share links API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
