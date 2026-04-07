import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().min(10, 'Please provide a reason for rejection'),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
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
    const validation = rejectSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json({ success: false, error: validation.error.issues[0].message }, { status: 400 });
    }

    const { data: transfer } = await supabaseAdmin
      .from('transfer_requests')
      .select('id, status')
      .eq('id', id)
      .single();

    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Transfer request not found' }, { status: 404 });
    }

    if (transfer.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Transfer is not in pending status' }, { status: 400 });
    }

    await supabaseAdmin
      .from('transfer_requests')
      .update({ status: 'rejected' })
      .eq('id', id);

    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'reject_transfer',
      details: { transfer_id: id, reason: validation.data.reason },
    });

    return NextResponse.json({ success: true, message: 'Transfer request rejected' });
  } catch (error) {
    console.error('Transfer rejection error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
