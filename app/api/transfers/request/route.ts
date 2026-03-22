import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateHashCode, generateQRCodeData } from '@/lib/crypto';
import { transferRequestSchema } from '@/lib/validations';

// POST: Create transfer request
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userData?.role !== 'graduate') {
      return NextResponse.json({ success: false, error: 'Only graduates can request transfers' }, { status: 403 });
    }

    const body = await request.json();
    const validation = transferRequestSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 });
    }

    const { document_id, recipient_institution, recipient_email, payment_method } = validation.data;

    // Get graduate profile
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id, fee_cleared, student_id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    // Get document and verify ownership
    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('id, document_type, file_hash, status')
      .eq('id', document_id)
      .eq('graduate_id', graduate.id)
      .single();

    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found or not owned by you' }, { status: 404 });
    }

    if (document.status !== 'active') {
      return NextResponse.json({ success: false, error: 'Document is not active' }, { status: 400 });
    }

    // Check if payment is required
    const serviceFee = parseFloat(process.env.SERVICE_FEE_ETB || '500');
    const requiresPayment = !graduate.fee_cleared;

    // Create payment record
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        graduate_id: graduate.id,
        amount: serviceFee,
        currency: 'ETB',
        payment_method,
        status: 'pending',
      })
      .select()
      .single();

    if (paymentError) {
      return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
    }

    // Generate hash code and QR code
    const hashCode = generateHashCode();
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${hashCode}`;
    const qrCodeDataUrl = await generateQRCodeData(verifyUrl);

    // Create transfer request
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .insert({
        graduate_id: graduate.id,
        document_id,
        recipient_institution,
        recipient_email: recipient_email || null,
        payment_status: requiresPayment ? 'pending' : 'waived',
        payment_id: payment.id,
        qr_code: qrCodeDataUrl,
        hash_code: hashCode,
        status: requiresPayment ? 'pending' : 'approved',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (transferError) {
      return NextResponse.json({ success: false, error: 'Failed to create transfer request' }, { status: 500 });
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'create_transfer_request',
      details: { document_id, recipient_institution, payment_id: payment.id },
    });

    return NextResponse.json({
      success: true,
      data: {
        transfer_request: transferRequest,
        payment: {
          id: payment.id,
          amount: serviceFee,
          method: payment_method,
          requires_payment: requiresPayment,
        },
        hash_code: hashCode,
        qr_code: qrCodeDataUrl,
      },
      message: requiresPayment
        ? 'Transfer request created. Please complete payment to activate.'
        : 'Transfer request approved. Document is ready to share.',
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
        payment:payments(id, amount, status, payment_method)
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
