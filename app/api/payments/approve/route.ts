import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';
import { generateHashCode, generateQRCodeData } from '@/lib/crypto';
import { sendTransferShareEmail } from '@/lib/email';

const approvePaymentSchema = z.object({
  payment_id: z.string().uuid(),
  action: z.enum(['approve', 'reject']),
  rejection_reason: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a registrar
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (userError || userData?.role !== 'registrar') {
      return NextResponse.json({ success: false, error: 'Access denied. Registrar role required.' }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = approvePaymentSchema.parse(body);

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        graduates!inner(
          user_id,
          student_id
        )
      `)
      .eq('id', validatedData.payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    if (validatedData.action === 'reject') {
      // Reject payment
      const { data: updatedPayment, error: updateError } = await supabaseAdmin
        .from('payments')
        .update({
          status: 'rejected',
          rejection_reason: validatedData.rejection_reason,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user.id,
        })
        .eq('id', validatedData.payment_id)
        .select()
        .single();

      if (updateError) {
        return NextResponse.json({ success: false, error: 'Failed to reject payment' }, { status: 500 });
      }

      // Update transfer request status
      await supabaseAdmin
        .from('transfer_requests')
        .update({
          payment_status: 'rejected',
          status: 'rejected',
          updated_at: new Date().toISOString(),
        })
        .eq('payment_id', validatedData.payment_id);

      // Create audit log
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'reject_payment',
        resource_type: 'payment',
        resource_id: payment.id,
        details: {
          rejection_reason: validatedData.rejection_reason,
        },
      });

      return NextResponse.json({
        success: true,
        data: {
          payment: updatedPayment,
          message: 'Payment rejected successfully.',
        },
      });
    }

    // Approve payment
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.id,
      })
      .eq('id', validatedData.payment_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to approve payment' }, { status: 500 });
    }

    // Get transfer request details
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        documents!inner(
          document_type
        )
      `)
      .eq('payment_id', validatedData.payment_id)
      .single();

    if (transferError || !transferRequest) {
      return NextResponse.json({ success: false, error: 'Transfer request not found' }, { status: 404 });
    }

    // Generate QR code and hash for approved payment
    const hashCode = generateHashCode();
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${hashCode}`;
    
    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = await generateQRCodeData(verifyUrl);
    } catch (qrError) {
      console.error('QR code generation failed:', qrError);
      return NextResponse.json({ success: false, error: 'Failed to generate QR code' }, { status: 500 });
    }

    // Update transfer request with QR code and approve it
    await supabaseAdmin
      .from('transfer_requests')
      .update({
        payment_status: 'completed',
        status: 'approved',
        qr_code: qrCodeDataUrl,
        hash_code: hashCode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', transferRequest.id);

    // Send emails with verification codes
    try {
      await sendTransferShareEmail(
        transferRequest.university_email,
        transferRequest.recipient_institution,
        'Student', // TODO: Get from graduate profile
        transferRequest.documents.document_type,
        hashCode,
        qrCodeDataUrl
      );

      if (transferRequest.recipient_email) {
        await sendTransferShareEmail(
          transferRequest.recipient_email,
          transferRequest.recipient_institution,
          'Student', // TODO: Get from graduate profile
          transferRequest.documents.document_type,
          hashCode,
          qrCodeDataUrl
        );
      }
    } catch (emailError) {
      console.error('Failed to send emails:', emailError);
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'approve_payment',
      resource_type: 'payment',
      resource_id: payment.id,
      details: {
        payment_method: payment.payment_method,
        amount: payment.amount,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        payment: updatedPayment,
        transfer_request: {
          ...transferRequest,
          qr_code: qrCodeDataUrl,
          hash_code: hashCode,
        },
        message: 'Payment approved successfully. Verification codes sent.',
      },
    });
  } catch (error: any) {
    console.error('Payment approval error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
