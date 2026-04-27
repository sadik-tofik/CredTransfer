import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const data = JSON.parse(body) as Record<string, unknown>;

    // ── Signature verification (optional but recommended) ─────────────────────
    const webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = request.headers.get('x-chapa-signature') || '';
      const expected  = crypto
        .createHmac('sha256', webhookSecret)
        .update(body)
        .digest('hex');
      if (signature !== expected) {
        console.warn('Chapa webhook: invalid signature');
        return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      }
    }

    const txRef = data.tx_ref as string | undefined;
    if (!txRef) {
      return NextResponse.json({ error: 'Missing tx_ref' }, { status: 400 });
    }

    // ── Verify with Chapa ─────────────────────────────────────────────────────
    const chapaSecretKey = process.env.CHAPA_SECRET_KEY || '';
    const verifyResponse = await fetch(
      `https://api.chapa.co/v1/transaction/verify/${encodeURIComponent(txRef)}`,
      { headers: { 'Authorization': `Bearer ${chapaSecretKey}` } }
    );
    const verifyData = await verifyResponse.json() as {
      status: string;
      data?: {
        status: string;
        amount: string | number;
        tx_ref: string;
        meta?:  { transfer_id?: string; payment_id?: string };
      };
    };

    if (verifyData?.data?.status !== 'success') {
      return NextResponse.json({ received: true, action: 'ignored — not success' });
    }

    const transferId = verifyData.data.meta?.transfer_id;
    const paymentId  = verifyData.data.meta?.payment_id;

    if (!paymentId) {
      const { data: payment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('transaction_reference', txRef)
        .single();

      if (payment) await markPaymentComplete(payment.id, txRef, null);
      return NextResponse.json({ received: true });
    }

    await markPaymentComplete(paymentId, txRef, transferId || null);
    return NextResponse.json({ received: true, message: 'Payment confirmed.' });

  } catch (error) {
    console.error('Chapa callback error:', error);
    return NextResponse.json({ received: true, error: 'Internal error' });
  }
}

async function markPaymentComplete(
  paymentId: string,
  txRef: string,
  transferId: string | null
) {
  await supabaseAdmin
    .from('payments')
    .update({
      status:                'completed',
      paid_at:               new Date().toISOString(),
      transaction_reference: txRef,
      metadata: {
        chapa_tx_ref:   txRef,
        chapa_verified: true,
        completed_at:   new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId);

  if (transferId) {
    await supabaseAdmin
      .from('transfer_requests')
      .update({ payment_status: 'completed' })
      .eq('id', transferId);

    // Notify registrars — non-fatal
    try {
      const { data: registrars } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('role', 'registrar');

      if (registrars?.length) {
        await supabaseAdmin.from('notifications').insert(
          registrars.map((r) => ({
            user_id:           r.id,
            title:             'Chapa Payment Confirmed',
            message:           `Transfer payment verified via Chapa (ref: ${txRef}). Please review and approve.`,
            notification_type: 'payment_review',
            metadata:          { transfer_id: transferId, payment_id: paymentId, tx_ref: txRef },
          }))
        );
      }
    } catch (_) { /* non-fatal */ }
  }

  // Audit log — non-fatal
  try {
    await supabaseAdmin.from('audit_logs').insert({
      action:  'chapa_payment_completed',
      details: { payment_id: paymentId, transfer_id: transferId, tx_ref: txRef },
    });
  } catch (_) { /* non-fatal */ }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', service: 'CredTransfer Chapa Webhook' });
}
