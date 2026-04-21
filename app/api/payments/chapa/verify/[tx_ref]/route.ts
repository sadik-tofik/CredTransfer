import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { chapa } from '@/lib/chapa';

// GET: Verify Chapa payment status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tx_ref: string }> }
) {
  try {
    const { tx_ref } = await params;

    if (!tx_ref) {
      return NextResponse.json({ success: false, error: 'Transaction reference is required' }, { status: 400 });
    }

    // Verify with Chapa
    const chapaResponse = await chapa.verifyTransaction(tx_ref);

    if (chapaResponse.status !== 'success' || !chapaResponse.data) {
      return NextResponse.json({ 
        success: false, 
        error: chapaResponse.message || 'Failed to verify transaction' 
      }, { status: 400 });
    }

    const paymentData = chapaResponse.data;

    // Find payment in database
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status, amount, currency')
      .eq('transaction_reference', tx_ref)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found in database' }, { status: 404 });
    }

    // Update payment status based on Chapa response
    const chapaStatus = paymentData.status;
    let newStatus = payment.status;

    if (chapaStatus === 'success' && payment.status !== 'completed') {
      newStatus = 'completed';
      
      // Update payment
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'completed',
          paid_at: new Date().toISOString(),
          metadata: {
            chapa_verification: paymentData,
            verified_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id);

      // Update transfer request
      await supabaseAdmin
        .from('transfer_requests')
        .update({ 
          payment_status: 'completed', 
          status: 'approved',
          updated_at: new Date().toISOString()
        })
        .eq('payment_id', payment.id);

      // Log verification
      await supabaseAdmin.from('audit_logs').insert({
        user_id: null,
        action: 'payment_verified',
        resource_type: 'payment',
        resource_id: payment.id,
        details: {
          payment_method: 'chapa',
          transaction_reference: tx_ref,
          chapa_status: chapaStatus,
        },
      });

    } else if (chapaStatus === 'failed' && payment.status !== 'failed') {
      newStatus = 'failed';
      
      // Update payment
      await supabaseAdmin
        .from('payments')
        .update({
          status: 'failed',
          metadata: {
            chapa_verification: paymentData,
            failed_at: new Date().toISOString(),
          },
        })
        .eq('id', payment.id);

      // Update transfer request
      await supabaseAdmin
        .from('transfer_requests')
        .update({ 
          payment_status: 'failed',
          status: 'rejected',
          rejection_reason: 'Payment failed',
          updated_at: new Date().toISOString()
        })
        .eq('payment_id', payment.id);
    }

    return NextResponse.json({
      success: true,
      data: {
        payment: {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
          status: newStatus,
        },
        chapa: paymentData,
        verification: {
          verified_at: new Date().toISOString(),
          status: chapaStatus,
        },
      },
    });

  } catch (error: any) {
    console.error('Payment verification error:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message || 'Internal server error' 
    }, { status: 500 });
  }
}
