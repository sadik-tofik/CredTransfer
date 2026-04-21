import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateHashCode, generateQRCodeData } from '@/lib/crypto';
import { transferRequestSchema } from '@/lib/validations';

// POST: Create transfer request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request format' }, { status: 400 });
    }

    const sanitizedBody = {
      document_id:           typeof body.document_id === 'string'           ? body.document_id.trim()           : '',
      recipient_institution: typeof body.recipient_institution === 'string' ? body.recipient_institution.trim() : '',
      recipient_email:       typeof body.recipient_email === 'string'       ? body.recipient_email.trim()       : '',
      university_email:      typeof body.university_email === 'string'      ? body.university_email.trim()      : '',
      payment_method:        body.payment_method ?? 'cbe_birr',
    };

    const validation = transferRequestSchema.safeParse(sanitizedBody);
    if (!validation.success) {
      return NextResponse.json({
        success: false,
        error: validation.error.issues[0].message,
        details: validation.error.issues,
      }, { status: 400 });
    }

    const { document_id, recipient_institution, recipient_email, university_email, payment_method } = sanitizedBody;

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    if (userError || userData?.role !== 'graduate') {
      return NextResponse.json({ success: false, error: 'Only graduates can request transfers' }, { status: 403 });
    }

    // Get graduate profile
    const { data: graduate, error: graduateError } = await supabaseAdmin
      .from('graduates')
      .select('id, fee_cleared, student_id')
      .eq('user_id', user.id)
      .single();
    if (graduateError || !graduate) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    // Verify document ownership
    const { data: document, error: documentError } = await supabaseAdmin
      .from('documents')
      .select('id, document_type, file_hash, status')
      .eq('id', document_id)
      .eq('graduate_id', graduate.id)
      .single();
    if (documentError || !document) {
      return NextResponse.json({ success: false, error: 'Document not found or not owned by you' }, { status: 404 });
    }
    if (document.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Document is not active' }, { status: 400 });
    }

    const serviceFee = parseFloat(process.env.SERVICE_FEE_ETB || '500');
    const requiresPayment = !graduate.fee_cleared;

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        graduate_id:       graduate.id,
        amount:            serviceFee,
        currency:          'ETB',
        payment_method,
        status:            requiresPayment ? 'pending' : 'completed',
        paid_at:           requiresPayment ? null : new Date().toISOString(),
      })
      .select()
      .single();
    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Failed to create payment record' }, { status: 500 });
    }

    // Generate verification hash code and QR
    const hashCode = generateHashCode();
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${hashCode}`;
    let qrCodeDataUrl = '';
    try {
      qrCodeDataUrl = await generateQRCodeData(verifyUrl);
    } catch {
      // Non-fatal — we continue without QR
      console.warn('QR generation failed, continuing without QR');
    }

    // Create transfer request
    // NOTE: Email to university is intentionally NOT sent here.
    // It is sent only when the registrar APPROVES (after verifying payment).
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .insert({
        graduate_id:           graduate.id,
        document_id,
        recipient_institution,
        recipient_email:       recipient_email || null,
        university_email,
        payment_method,
        payment_status:        requiresPayment ? 'pending' : 'completed',
        payment_id:            payment.id,
        qr_code:               qrCodeDataUrl,
        hash_code:             hashCode,
        status:                requiresPayment ? 'pending' : 'approved',
        expires_at:            new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();
    if (transferError || !transferRequest) {
      console.error('Transfer insert error:', transferError);
      return NextResponse.json({ success: false, error: 'Failed to create transfer request' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id:   user.id,
      action:    'create_transfer_request',
      details:   { document_id, recipient_institution, payment_id: payment.id, requires_payment: requiresPayment },
    });

    // Notify registrars of new request
    const { data: registrars } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'registrar');
    if (registrars?.length) {
      await supabaseAdmin.from('notifications').insert(
        registrars.map((r) => ({
          user_id:           r.id,
          title:             'New Transfer Request',
          message:           `${userData.full_name || 'A graduate'} has submitted a transfer request to ${recipient_institution}.`,
          notification_type: 'transfer_request',
          metadata:          { transfer_id: transferRequest.id },
        }))
      );
    }

    // If fee was already cleared (waived), send email now
    if (!requiresPayment && university_email) {
      const { sendTransferShareEmail } = await import('@/lib/email');
      sendTransferShareEmail(
        university_email,
        recipient_institution,
        userData.full_name || 'Graduate',
        document.document_type,
        hashCode,
        qrCodeDataUrl
      ).catch(console.error);
    }

    // Payment reference = payment id for now (registrar matches by reference)
    const paymentReference = `CT-${payment.id.slice(0, 8).toUpperCase()}`;

    // Update payment with reference
    await supabaseAdmin
      .from('payments')
      .update({ transaction_reference: paymentReference })
      .eq('id', payment.id);

    return NextResponse.json({
      success: true,
      message: requiresPayment
        ? 'Transfer request created. Please complete payment to activate.'
        : 'Transfer request approved. Document is ready to share.',
      data: {
        transfer_id:       transferRequest.id,
        payment_id:        payment.id,
        hash_code:         hashCode,
        qr_code:           qrCodeDataUrl,
        payment_reference: paymentReference,
        requires_payment:  requiresPayment,
      },
    });

  } catch (error) {
    console.error('Transfer request error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET: List transfer requests for current graduate
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    const { data, error } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        document:documents(id, document_type, file_name, status),
        payment:payments(id, amount, status, payment_method, payment_screenshot_url, screenshot_uploaded_at)
      `)
      .eq('graduate_id', graduate.id)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Transfer requests list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
