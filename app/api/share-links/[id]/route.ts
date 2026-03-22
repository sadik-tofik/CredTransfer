import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateQRCodeData } from '@/lib/crypto';

// GET: Get share link details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get graduate record
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate not found' }, { status: 404 });
    }

    // Get transfer request
    const { data, error } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        document:documents(id, document_type, file_name, file_hash, blockchain_tx_hash),
        payment:payments(id, amount, status, payment_method, paid_at)
      `)
      .eq('id', id)
      .eq('graduate_id', graduate.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Share link not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in share link API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH: Update share link (extend expiry, regenerate QR)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const { extend_days, regenerate_qr } = body;

    // Get graduate record
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: transfer } = await supabaseAdmin
      .from('transfer_requests')
      .select('id, hash_code, expires_at')
      .eq('id', id)
      .eq('graduate_id', graduate.id)
      .single();

    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Share link not found' }, { status: 404 });
    }

    const updates: Record<string, string | number> = {};

    if (extend_days) {
      const newExpiry = new Date(transfer.expires_at);
      newExpiry.setDate(newExpiry.getDate() + extend_days);
      updates.expires_at = newExpiry.toISOString();
    }

    if (regenerate_qr) {
      const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${transfer.hash_code}`;
      updates.qr_code = await generateQRCodeData(verifyUrl);
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'No updates provided' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('transfer_requests')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to update share link' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error in share link update API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Revoke share link
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Get graduate record
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate not found' }, { status: 404 });
    }

    // Verify ownership
    const { data: transfer } = await supabaseAdmin
      .from('transfer_requests')
      .select('id')
      .eq('id', id)
      .eq('graduate_id', graduate.id)
      .single();

    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Share link not found' }, { status: 404 });
    }

    // Mark as expired (soft delete)
    const { error } = await supabaseAdmin
      .from('transfer_requests')
      .update({
        status: 'expired',
        expires_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      return NextResponse.json({ success: false, error: 'Failed to revoke share link' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'revoke_share_link',
      resource_type: 'transfer_request',
      resource_id: id,
    });

    return NextResponse.json({ success: true, message: 'Share link revoked successfully' });
  } catch (error) {
    console.error('Error in share link delete API:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
