import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chapa } from '@/lib/chapa';

// POST: Chapa payment webhook callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('chapa-signature');

    if (!signature) {
      console.error('Missing Chapa signature');
      return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
    }

    // Verify webhook signature
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error('Missing Chapa webhook secret');
      return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
    }

    const isValidSignature = chapa.verifyWebhookSignature(body, signature, webhookSecret);
    if (!isValidSignature) {
      console.error('Invalid Chapa signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const event = JSON.parse(body);
    console.log('Chapa webhook event:', event);

    // Handle different event types
    if (event.event === 'payment.completed') {
      await handlePaymentCompleted(event.data);
    } else if (event.event === 'payment.failed') {
      await handlePaymentFailed(event.data);
    } else if (event.event === 'payment.cancelled') {
      await handlePaymentCancelled(event.data);
    }

    return NextResponse.json({ status: 200 });
  } catch (error) {
    console.error('Chapa webhook error:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentCompleted(paymentData: any) {
  const { tx_ref, amount, currency, email, first_name, last_name } = paymentData;

  try {
    // Find payment by transaction reference
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status, amount')
      .eq('transaction_reference', tx_ref)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found for reference:', tx_ref);
      return;
    }

    if (payment.status === 'completed') {
      console.log('Payment already completed:', tx_ref);
      return;
    }

    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        metadata: {
          chapa_data: paymentData,
          verified_at: new Date().toISOString(),
        },
      })
      .eq('id', payment.id);

    // Get transfer request details
    const { data: transferRequest, error: transferError } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        id,
        recipient_institution,
        recipient_email,
        university_email,
        document_id
      `)
      .eq('payment_id', payment.id)
      .single();

    if (transferError || !transferRequest) {
      console.error('Transfer request not found for payment:', tx_ref);
      return;
    }

    // Get document details
    const { data: document, error: documentError } = await supabaseAdmin
      .from('documents')
      .select('document_type')
      .eq('id', transferRequest.document_id)
      .single();

    if (documentError || !document) {
      console.error('Document not found for transfer:', tx_ref);
      return;
    }

    // Generate QR code and hash after payment is completed
    const { generateHashCode } = await import('@/lib/crypto');
    const { generateQRCodeData } = await import('@/lib/crypto');
    const hashCode = generateHashCode();
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?code=${hashCode}`;
    
    let qrCodeDataUrl;
    try {
      qrCodeDataUrl = await generateQRCodeData(verifyUrl);
    } catch (qrError) {
      console.error('QR code generation failed:', qrError);
      return;
    }

    // Update transfer request with QR code, hash, and approve it
    await supabaseAdmin
      .from('transfer_requests')
      .update({ 
        payment_status: 'completed', 
        status: 'approved',
        qr_code: qrCodeDataUrl,
        hash_code: hashCode,
        updated_at: new Date().toISOString()
      })
      .eq('id', transferRequest.id);

    // Send email to university
    const { sendTransferShareEmail } = await import('@/lib/email');
    try {
      await sendTransferShareEmail(
        transferRequest.university_email,
        transferRequest.recipient_institution,
        'Salim Aman', // TODO: Get from graduate profile
        document.document_type,
        hashCode,
        qrCodeDataUrl
      );
    } catch (emailError) {
      console.error('Failed to send university email:', emailError);
    }

    // Send email to recipient if provided
    if (transferRequest.recipient_email) {
      try {
        await sendTransferShareEmail(
          transferRequest.recipient_email,
          transferRequest.recipient_institution,
          'Salim Aman', // TODO: Get from graduate profile
          document.document_type,
          hashCode,
          qrCodeDataUrl
        );
      } catch (emailError) {
        console.error('Failed to send recipient email:', emailError);
      }
    }

    // Log successful payment
    await supabaseAdmin.from('audit_logs').insert({
      user_id: null, // System action
      action: 'payment_completed',
      resource_type: 'payment',
      resource_id: payment.id,
      details: {
        payment_method: 'chapa',
        transaction_reference: tx_ref,
        amount,
        currency,
        email,
      },
    });

    console.log('Payment completed and emails sent:', tx_ref);
  } catch (error) {
    console.error('Error handling payment completion:', error);
  }
}

async function handlePaymentFailed(paymentData: any) {
  const { tx_ref, amount, currency, email } = paymentData;

  try {
    // Find payment by transaction reference
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status')
      .eq('transaction_reference', tx_ref)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found for reference:', tx_ref);
      return;
    }

    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'failed',
        metadata: {
          chapa_data: paymentData,
          failed_at: new Date().toISOString(),
        },
      })
      .eq('id', payment.id);

    // Update associated transfer request
    await supabaseAdmin
      .from('transfer_requests')
      .update({ 
        payment_status: 'failed',
        status: 'rejected',
        rejection_reason: 'Payment failed',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', payment.id);

    // Log failed payment
    await supabaseAdmin.from('audit_logs').insert({
      user_id: null, // System action
      action: 'payment_failed',
      resource_type: 'payment',
      resource_id: payment.id,
      details: {
        payment_method: 'chapa',
        transaction_reference: tx_ref,
        amount,
        currency,
        email,
      },
    });

    console.log('Payment failed:', tx_ref);
  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

async function handlePaymentCancelled(paymentData: any) {
  const { tx_ref, amount, currency, email } = paymentData;

  try {
    // Find payment by transaction reference
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status')
      .eq('transaction_reference', tx_ref)
      .single();

    if (paymentError || !payment) {
      console.error('Payment not found for reference:', tx_ref);
      return;
    }

    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({
        status: 'cancelled',
        metadata: {
          chapa_data: paymentData,
          cancelled_at: new Date().toISOString(),
        },
      })
      .eq('id', payment.id);

    // Update associated transfer request
    await supabaseAdmin
      .from('transfer_requests')
      .update({ 
        payment_status: 'cancelled',
        status: 'cancelled',
        rejection_reason: 'Payment cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('payment_id', payment.id);

    // Log cancelled payment
    await supabaseAdmin.from('audit_logs').insert({
      user_id: null, // System action
      action: 'payment_cancelled',
      resource_type: 'payment',
      resource_id: payment.id,
      details: {
        payment_method: 'chapa',
        transaction_reference: tx_ref,
        amount,
        currency,
        email,
      },
    });

    console.log('Payment cancelled:', tx_ref);
  } catch (error) {
    console.error('Error handling payment cancellation:', error);
  }
}
