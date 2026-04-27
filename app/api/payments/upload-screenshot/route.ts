import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'graduate') {
      return NextResponse.json(
        { success: false, error: 'Only graduates can upload payment screenshots' },
        { status: 403 }
      );
    }

    // ── Parse form data ────────────────────────────────────────────────────────
    const formData  = await request.formData();
    const screenshot = formData.get('screenshot') as File | null;
    const transferId = formData.get('transfer_id') as string | null;
    const paymentId  = formData.get('payment_id')  as string | null;

    if (!screenshot || !transferId || !paymentId) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: screenshot, transfer_id, payment_id' },
        { status: 400 }
      );
    }

    // ── Validate ───────────────────────────────────────────────────────────────
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(screenshot.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Please upload a JPG, PNG, WebP, or GIF.' },
        { status: 400 }
      );
    }
    const MAX_SIZE = 4 * 1024 * 1024; // 4 MB
    if (screenshot.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Screenshot too large. Please use an image under 4 MB.' },
        { status: 400 }
      );
    }

    // ── Verify transfer ownership ──────────────────────────────────────────────
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    const { data: transfer } = await supabaseAdmin
      .from('transfer_requests')
      .select('id, payment_id, status')
      .eq('id', transferId)
      .eq('graduate_id', graduate.id)
      .single();

    if (!transfer) {
      return NextResponse.json(
        { success: false, error: 'Transfer request not found or does not belong to you' },
        { status: 404 }
      );
    }

    // ── Convert image to base64 data-URL ───────────────────────────────────────
    const arrayBuffer = await screenshot.arrayBuffer();
    const base64      = Buffer.from(arrayBuffer).toString('base64');
    const dataUrl     = `data:${screenshot.type};base64,${base64}`;

    // ── Save into payments.metadata (JSONB column — no migration needed) ───────
    const { error: updatePaymentError } = await supabaseAdmin
      .from('payments')
      .update({
        status:   'processing',
        metadata: {
          screenshot_data_url:  dataUrl,
          screenshot_file_name: screenshot.name,
          screenshot_file_size: screenshot.size,
          screenshot_mime_type: screenshot.type,
          uploaded_at:          new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId);

    if (updatePaymentError) {
      console.error('Payment update error:', updatePaymentError);
      return NextResponse.json(
        { success: false, error: 'Failed to save screenshot. Please try again.' },
        { status: 500 }
      );
    }

    // ── Mark transfer as awaiting review ──────────────────────────────────────
    await supabaseAdmin
      .from('transfer_requests')
      .update({ payment_status: 'processing' })
      .eq('id', transferId);

    // ── Notify registrars (non-fatal) ─────────────────────────────────────────
    try {
      const { data: registrars } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'registrar');

      if (registrars?.length) {
        await supabaseAdmin.from('notifications').insert(
          registrars.map((r) => ({
            user_id:           r.id,
            title:             'Payment Screenshot Uploaded',
            message:           'A graduate has uploaded a payment screenshot. Please review the transfer request.',
            notification_type: 'payment_review',
            metadata:          { transfer_id: transferId, payment_id: paymentId },
          }))
        );
      }
    } catch (_) { /* non-fatal */ }

    // ── Audit log (non-fatal) ──────────────────────────────────────────────────
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action:  'upload_payment_screenshot',
        details: {
          transfer_id:  transferId,
          payment_id:   paymentId,
          file_name:    screenshot.name,
          file_size_kb: Math.round(screenshot.size / 1024),
        },
      });
    } catch (_) { /* non-fatal */ }

    return NextResponse.json({
      success: true,
      message: 'Screenshot uploaded successfully. Awaiting registrar verification.',
    });

  } catch (error) {
    console.error('Screenshot upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
