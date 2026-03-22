import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generatePaymentReference } from '@/lib/crypto';
import { paymentInitiateSchema } from '@/lib/validations';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const validation = paymentInitiateSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 });
    }

    const { graduate_id, amount, payment_method } = validation.data;
    const reference = generatePaymentReference('CRED');

    // Update payment with reference
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .update({ transaction_reference: reference, status: 'processing' })
      .eq('graduate_id', graduate_id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !payment) {
      // Create new payment if not found
      const { data: newPayment } = await supabaseAdmin
        .from('payments')
        .insert({
          graduate_id,
          amount,
          currency: 'ETB',
          payment_method,
          transaction_reference: reference,
          status: 'processing',
        })
        .select()
        .single();

      if (!newPayment) {
        return NextResponse.json({ success: false, error: 'Failed to create payment' }, { status: 500 });
      }
    }

    if (payment_method === 'telebirr') {
      // TeleBirr integration
      const telebirrPayload = initiateTeleBirr(reference, amount);
      return NextResponse.json({
        success: true,
        data: {
          payment_id: payment?.id,
          reference,
          payment_url: telebirrPayload.payment_url,
          method: 'telebirr',
        },
      });
    } else if (payment_method === 'bank_transfer' || payment_method === 'cbe_birr') {
      return NextResponse.json({
        success: true,
        data: {
          payment_id: payment?.id,
          reference,
          bank_details: {
            bank_name: process.env.BANK_NAME || 'Commercial Bank of Ethiopia',
            account_number: process.env.BANK_ACCOUNT_NUMBER || '1000123456789',
            account_name: process.env.BANK_ACCOUNT_NAME || 'Jimma University CredTransfer',
            reference,
            amount,
            currency: 'ETB',
          },
          method: payment_method,
          instruction: 'Please transfer the exact amount and include the reference number.',
        },
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid payment method' }, { status: 400 });
  } catch (error) {
    console.error('Payment initiation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function initiateTeleBirr(reference: string, amount: number) {
  // TeleBirr API integration
  const merchantId = process.env.TELEBIRR_MERCHANT_ID;
  const appId = process.env.TELEBIRR_APP_ID;
  const appKey = process.env.TELEBIRR_APP_KEY;
  const callbackUrl = `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/callback/telebirr`;
  const returnUrl = `${process.env.NEXT_PUBLIC_APP_URL}/graduate/payments?ref=${reference}`;

  const timestamp = Date.now().toString();
  const nonce = crypto.randomBytes(8).toString('hex');

  // Build signature string per TeleBirr API spec
  const signStr = `appId=${appId}&merchantId=${merchantId}&nonce=${nonce}&outTradeNo=${reference}&returnUrl=${returnUrl}&subject=CredTransfer Service Fee&timeStamp=${timestamp}&totalAmount=${amount}&appKey=${appKey}`;
  const sign = crypto.createHash('sha256').update(signStr).digest('hex').toUpperCase();

  const payload = {
    appId,
    merchantId,
    nonce,
    outTradeNo: reference,
    returnUrl,
    subject: 'CredTransfer Service Fee',
    timeStamp: timestamp,
    totalAmount: amount.toString(),
    sign,
  };

  // In production, make actual API call to TeleBirr
  const payment_url = `${process.env.TELEBIRR_API_URL}/payment?${new URLSearchParams(payload as Record<string, string>).toString()}`;

  return { payment_url, payload };
}
