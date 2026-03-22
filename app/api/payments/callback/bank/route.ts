import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST: Manual bank payment confirmation (registrar only)
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (!['registrar', 'admin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { payment_id, transaction_reference, confirmed } = await request.json();

    if (!payment_id) {
      return NextResponse.json(
        { success: false, error: 'Payment ID is required' },
        { status: 400 }
      );
    }

    // Get payment
    const { data: payment, error: paymentError } = await supabaseAdmin
      .from('payments')
      .select('*, graduate:graduates(id, user_id, user:users(email, full_name))')
      .eq('id', payment_id)
      .single();

    if (paymentError || !payment) {
      return NextResponse.json(
        { success: false, error: 'Payment not found' },
        { status: 404 }
      );
    }

    if (payment.status === 'completed') {
      return NextResponse.json(
        { success: false, error: 'Payment already confirmed' },
        { status: 400 }
      );
    }

    // Update payment status
    const newStatus = confirmed ? 'completed' : 'failed';
    const { error: updateError } = await supabaseAdmin
      .from('payments')
      .update({
        status: newStatus,
        transaction_reference: transaction_reference || payment.transaction_reference,
        paid_at: confirmed ? new Date().toISOString() : null,
        metadata: {
          ...((payment.metadata as object) || {}),
          confirmed_by: user.id,
          confirmed_at: new Date().toISOString(),
        },
      })
      .eq('id', payment_id);

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update payment' },
        { status: 500 }
      );
    }

    // If payment confirmed, update related transfer request
    if (confirmed) {
      await supabaseAdmin
        .from('transfer_requests')
        .update({
          payment_status: 'completed',
          status: 'approved',
        })
        .eq('payment_id', payment_id);

      // Create notification for graduate
      const graduate = payment.graduate as { user_id: string; user: { email: string; full_name: string } };
      if (graduate?.user_id) {
        await supabaseAdmin.from('notifications').insert({
          user_id: graduate.user_id,
          title: 'Payment Confirmed',
          message: 'Your payment has been confirmed. Your document is now ready to share.',
          type: 'success',
          action_url: '/graduate/transfers',
        });
      }
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: confirmed ? 'confirm_bank_payment' : 'reject_bank_payment',
      resource_type: 'payment',
      resource_id: payment_id,
      details: { transaction_reference, status: newStatus },
    });

    return NextResponse.json({
      success: true,
      message: confirmed ? 'Payment confirmed successfully' : 'Payment marked as failed',
    });
  } catch (error) {
    console.error('Bank payment callback error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET: List pending bank payments for confirmation
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (!['registrar', 'admin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('payments')
      .select(`
        *,
        graduate:graduates(
          id,
          student_id,
          user:users(full_name, email)
        )
      `)
      .eq('payment_method', 'bank_transfer')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching pending bank payments:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
