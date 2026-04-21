import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const paymentProofSchema = z.object({
  payment_id: z.string().uuid(),
  screenshot_url: z.string().url(),
  payment_method: z.enum(['chapa', 'telebirr', 'bank_transfer', 'cbe_birr']),
  transaction_reference: z.string().optional(),
  additional_notes: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validatedData = paymentProofSchema.parse(body);

    // Get payment details
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', validatedData.payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    // Verify this payment belongs to the current user
    const { data: graduate, error: graduateError } = await supabaseAdmin
      .from('graduates')
      .select('user_id')
      .eq('id', payment.graduate_id)
      .single();

    if (graduateError || !graduate || graduate.user_id !== user.id) {
      return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
    }

    // Update payment with proof
    const { data: updatedPayment, error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: 'processing',
        screenshot_url: validatedData.screenshot_url,
        transaction_reference: validatedData.transaction_reference,
        additional_notes: validatedData.additional_notes,
        proof_uploaded_at: new Date().toISOString(),
        metadata: {
          ...payment.metadata,
          proof_upload: {
            uploaded_at: new Date().toISOString(),
            payment_method: validatedData.payment_method,
          }
        }
      })
      .eq('id', validatedData.payment_id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ success: false, error: 'Failed to update payment' }, { status: 500 });
    }

    // Create audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'upload_payment_proof',
      resource_type: 'payment',
      resource_id: payment.id,
      details: {
        payment_method: validatedData.payment_method,
        transaction_reference: validatedData.transaction_reference,
      },
    });

    // Notify registrars about new payment proof
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: null, // System notification for all registrars
        type: 'payment_proof_uploaded',
        title: 'New Payment Proof Uploaded',
        message: `A student has uploaded payment proof for document transfer. Please review and approve.`,
        metadata: {
          payment_id: payment.id,
          graduate_id: payment.graduate_id,
        },
        read: false,
      });

    return NextResponse.json({
      success: true,
      data: {
        payment: updatedPayment,
        message: 'Payment proof uploaded successfully. Waiting for registrar approval.',
      },
    });
  } catch (error: any) {
    console.error('Payment proof upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
