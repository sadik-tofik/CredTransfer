import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

// TeleBirr webhook callback
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify TeleBirr signature
    const { outTradeNo, totalAmount, sign, tradeNo, tradeStatus } = body;

    if (!outTradeNo || !sign) {
      return NextResponse.json({ success: false, error: 'Invalid payload' }, { status: 400 });
    }

    // Verify signature
    const appKey = process.env.TELEBIRR_APP_KEY;
    const expectedSign = crypto
      .createHash('sha256')
      .update(`outTradeNo=${outTradeNo}&totalAmount=${totalAmount}&tradeNo=${tradeNo}&tradeStatus=${tradeStatus}&appKey=${appKey}`)
      .digest('hex')
      .toUpperCase();

    if (sign !== expectedSign) {
      console.error('TeleBirr signature mismatch');
      return NextResponse.json({ success: false, error: 'Invalid signature' }, { status: 401 });
    }

    // Find payment by reference
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status')
      .eq('transaction_reference', outTradeNo)
      .single();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status === 'completed') {
      return NextResponse.json({ success: true, message: 'Already processed' });
    }

    const isSuccess = tradeStatus === 'SUCCESS' || tradeStatus === 'TRADE_SUCCESS';

    // Update payment status
    await supabaseAdmin
      .from('payments')
      .update({
        status: isSuccess ? 'completed' : 'failed',
        paid_at: isSuccess ? new Date().toISOString() : null,
        metadata: { telebirr_trade_no: tradeNo, trade_status: tradeStatus, raw: body },
      })
      .eq('id', payment.id);

    if (isSuccess) {
      // Update associated transfer request
      await supabaseAdmin
        .from('transfer_requests')
        .update({ payment_status: 'completed', status: 'approved' })
        .eq('payment_id', payment.id);

      // Create notification for graduate
      const { data: graduate } = await supabaseAdmin
        .from('graduates')
        .select('user_id')
        .eq('id', payment.graduate_id)
        .single();

      if (graduate) {
        await supabaseAdmin.from('notifications').insert({
          user_id: graduate.user_id,
          title: 'Payment Confirmed',
          message: `Your payment of ${totalAmount} ETB has been confirmed. Your document transfer is now active.`,
          type: 'success',
          action_url: '/graduate/transfers',
        });
      }
    }

    return NextResponse.json({ success: true, message: 'Callback processed' });
  } catch (error) {
    console.error('TeleBirr callback error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
