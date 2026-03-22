import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTransferShareEmail } from '@/lib/email';

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

    const { data: transfer, error } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        graduate:graduates(
          student_id,
          user:users(full_name, email)
        ),
        document:documents(document_type, file_hash)
      `)
      .eq('id', id)
      .single();

    if (error || !transfer) {
      return NextResponse.json({ success: false, error: 'Transfer request not found' }, { status: 404 });
    }

    if (transfer.status !== 'pending') {
      return NextResponse.json({ success: false, error: 'Transfer is not in pending status' }, { status: 400 });
    }

    // Update status
    await supabaseAdmin
      .from('transfer_requests')
      .update({ status: 'approved' })
      .eq('id', id);

    // Send email to recipient if available
    const graduate = transfer.graduate as unknown as {
      student_id: string;
      user: { full_name: string; email: string };
    };
    const doc = transfer.document as unknown as { document_type: string; file_hash: string };

    if (transfer.recipient_email && graduate?.user?.full_name) {
      sendTransferShareEmail(
        transfer.recipient_email,
        transfer.recipient_institution,
        graduate.user.full_name,
        doc?.document_type || '',
        transfer.hash_code || '',
        transfer.qr_code || ''
      ).catch(console.error);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'approve_transfer',
      details: { transfer_id: id },
    });

    return NextResponse.json({ success: true, message: 'Transfer request approved' });
  } catch (error) {
    console.error('Transfer approval error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
