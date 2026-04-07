import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateHashCode, generateQRCodeData } from '@/lib/crypto';
import { transferRequestSchema } from '@/lib/validations';
import { sendTransferShareEmail } from '@/lib/email';

// POST: Create transfer request
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Defensive: ensure body is an object
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid request format' 
      }, { status: 400 });
    }
    
    // Defensive: ensure required fields exist and are strings
    const sanitizedBody = {
      document_id: typeof body.document_id === 'string' ? body.document_id.trim() : '',
      recipient_institution: typeof body.recipient_institution === 'string' ? body.recipient_institution.trim() : '',
      recipient_email: typeof body.recipient_email === 'string' ? body.recipient_email.trim() : '',
      university_email: typeof body.university_email === 'string' ? body.university_email.trim() : '',
      payment_method: body.payment_method
    };
    
    // Validate first before checking auth
    const validation = transferRequestSchema.safeParse(sanitizedBody);
    
    // Extract variables for use
    const { document_id, recipient_institution, recipient_email, university_email, payment_method } = sanitizedBody;
    if (!validation.success) {
      return NextResponse.json({ 
        success: false, 
        error: validation.error.issues[0].message,
        details: validation.error.issues 
      }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError) {
      return NextResponse.json({ success: false, error: 'Failed to verify user role' }, { status: 500 });
    }

    if (userData?.role !== 'graduate') {
      return NextResponse.json({ success: false, error: 'Only graduates can request transfers' }, { status: 403 });
    }

    // Get graduate profile
    const { data: graduate, error: graduateError } = await supabaseAdmin
      .from('graduates')
      .select('id, fee_cleared, student_id')
      .eq('user_id', user.id)
      .single();

    if (graduateError) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    // Get document and verify ownership
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
    
    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = await generateQRCodeData(verifyUrl);
    } catch (qrError) {
      return NextResponse.json({ success: false, error: 'Failed to generate QR code' }, { status: 500 });
    }

    // Create transfer request
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .insert({
        graduate_id: graduate.id,
        document_id,
        recipient_institution,
        recipient_email: recipient_email || null,
        university_email: university_email,
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

    // Send email to recipient if provided
    if (recipient_email) {
      try {
        await sendTransferShareEmail(
          recipient_email,
          recipient_institution,
          'Salim Aman', // TODO: Get from graduate profile
          document.document_type,
          hashCode,
          qrCodeDataUrl
        );
      } catch (emailError) {
        // Don't fail the request if email fails, but log it
        console.error('Failed to send recipient email:', emailError);
      }
    }

    // Send email to university email
    try {
      await sendTransferShareEmail(
        university_email,
        recipient_institution,
        'Salim Aman', // TODO: Get from graduate profile
        document.document_type,
        hashCode,
        qrCodeDataUrl
      );
    } catch (emailError) {
      // Don't fail the request if email fails, but log it
      console.error('Failed to send university email:', emailError);
    }

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
