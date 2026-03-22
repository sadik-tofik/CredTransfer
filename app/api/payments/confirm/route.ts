import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const confirmSchema = z.object({
  payment_id: z.string().uuid(),
  transaction_reference: z.string().optional(),
});

// POST: Manually confirm bank transfer payment (registrar only)
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['registrar', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const validation = confirmSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.errors[0].message }, { status: 400 });
    }

    const { payment_id, transaction_reference } = validation.data;

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('id, graduate_id, status, amount')
      .eq('id', payment_id)
      .single();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    if (payment.status === 'completed') {
      return NextResponse.json({ success: false, error: 'Payment already confirmed' }, { status: 400 });
    }

    await supabaseAdmin
      .from('payments')
      .update({
        status: 'completed',
        paid_at: new Date().toISOString(),
        transaction_reference: transaction_reference || payment_id,
      })
      .eq('id', payment_id);

    // Update associated transfer request
    await supabaseAdmin
      .from('transfer_requests')
      .update({ payment_status: 'completed', status: 'approved' })
      .eq('payment_id', payment_id);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'confirm_payment',
      details: { payment_id, transaction_reference },
    });

    return NextResponse.json({ success: true, message: 'Payment confirmed successfully' });
  } catch (error) {
    console.error('Payment confirmation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
