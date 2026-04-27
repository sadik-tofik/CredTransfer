import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json() as {
      transfer_id: string;
      payment_id:  string;
      amount:      number;
    };

    const { transfer_id, payment_id, amount } = body;
    if (!transfer_id || !payment_id || !amount) {
      return NextResponse.json(
        { success: false, error: 'transfer_id, payment_id, and amount are required' },
        { status: 400 }
      );
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('full_name, email')
      .eq('id', user.id)
      .single();

    if (!userData) {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }

    const chapaSecretKey = process.env.CHAPA_SECRET_KEY;
    if (!chapaSecretKey) {
      return NextResponse.json(
        { success: false, error: 'Chapa is not configured on the server.' },
        { status: 500 }
      );
    }

    const txRef = `CT-${payment_id.slice(0, 8).toUpperCase()}-${Date.now()}`;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

    const nameParts = (userData.full_name || 'Graduate User').trim().split(' ');
    const firstName = nameParts[0] || 'Graduate';
    const lastName  = nameParts.slice(1).join(' ') || 'User';

    // ─── FIXED: title ≤ 16 chars, description ≤ 50 chars, only letters/numbers/hyphens/underscores/spaces/dots ───
    const chapaResponse = await fetch('https://api.chapa.co/v1/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${chapaSecretKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        amount:       amount.toString(),
        currency:     'ETB',
        email:        userData.email,
        first_name:   firstName,
        last_name:    lastName,
        tx_ref:       txRef,
        callback_url: `${appUrl}/api/payments/callback/chapa`,
        return_url:   `${appUrl}/graduate/transfers?payment=success&ref=${txRef}`,
        customization: {
          title:       'Doc Transfer Fee',        // ≤ 16 chars ✓
          description: 'CredTransfer service fee 500 ETB', // ≤ 50 chars, safe chars ✓
        },
        meta: {
          transfer_id,
          payment_id,
        },
      }),
    });

    const chapaData = await chapaResponse.json() as {
      status:  string;
      message: string | object;
      data?: { checkout_url: string };
    };

    if (!chapaResponse.ok || chapaData.status !== 'success' || !chapaData.data?.checkout_url) {
      console.error('Chapa init failed:', chapaData);
      const errMsg = typeof chapaData.message === 'string'
        ? chapaData.message
        : JSON.stringify(chapaData.message);
      return NextResponse.json(
        { success: false, error: errMsg || 'Chapa payment initialization failed.' },
        { status: 502 }
      );
    }

    // Store tx_ref in payments row
    await supabaseAdmin
      .from('payments')
      .update({
        transaction_reference: txRef,
        status:                'processing',
        metadata: {
          chapa_tx_ref:  txRef,
          chapa_init_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', payment_id);

    await supabaseAdmin
      .from('transfer_requests')
      .update({ payment_status: 'processing' })
      .eq('id', transfer_id);

    // Audit log — non-fatal, use try/catch not .catch()
    try {
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action:  'chapa_payment_initiated',
        details: { transfer_id, payment_id, tx_ref: txRef, amount },
      });
    } catch (_) { /* non-fatal */ }

    return NextResponse.json({
      success:      true,
      checkout_url: chapaData.data.checkout_url,
      tx_ref:       txRef,
    });

  } catch (error) {
    console.error('Chapa initiation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
