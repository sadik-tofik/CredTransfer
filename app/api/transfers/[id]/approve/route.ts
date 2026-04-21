import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { sendTransferShareEmail, sendTransferApprovedEmail } from '@/lib/email';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Role check
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role, full_name')
      .eq('id', user.id)
      .single();
    if (!userData || !['registrar', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // Fetch transfer with all needed relations
    const { data: transfer, error: fetchError } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        graduate:graduates(
          id,
          student_id,
          user:users(id, full_name, email)
        ),
        document:documents(id, document_type, file_hash, file_name),
        payment:payments(id, amount, payment_method, status, payment_screenshot_url)
      `)
      .eq('id', id)
      .single();

    if (fetchError || !transfer) {
      return NextResponse.json({ success: false, error: 'Transfer request not found' }, { status: 404 });
    }
    if (transfer.status !== 'pending') {
      return NextResponse.json({ success: false, error: `Transfer is already ${transfer.status}` }, { status: 400 });
    }

    // Type helpers
    const graduate = transfer.graduate as {
      id: string;
      student_id: string;
      user: { id: string; full_name: string; email: string };
    };
    const doc = transfer.document as {
      id: string;
      document_type: string;
      file_hash: string;
      file_name: string;
    };

    // 1. Mark transfer approved
    await supabaseAdmin
      .from('transfer_requests')
      .update({
        status:         'approved',
        payment_status: 'completed',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', id);

    // 2. Mark payment completed
    if (transfer.payment_id) {
      await supabaseAdmin
        .from('payments')
        .update({
          status:      'completed',
          paid_at:     new Date().toISOString(),
          verified_by: user.id,
          verified_at: new Date().toISOString(),
        } as Record<string, unknown>)
        .eq('id', transfer.payment_id);
    }

    // 3. Send email to receiving UNIVERSITY with QR + hash + verification link
    const universityEmail = (transfer as Record<string, unknown>).university_email as string | undefined;
    const recipientEmail  = transfer.recipient_email;
    const graduateName    = graduate?.user?.full_name || 'A Jimma University Graduate';
    const hashCode        = transfer.hash_code || '';
    const qrCode          = transfer.qr_code || '';
    const docType         = doc?.document_type || 'academic_document';

    const emailTargets: string[] = [];
    if (universityEmail) emailTargets.push(universityEmail);
    if (recipientEmail && recipientEmail !== universityEmail) emailTargets.push(recipientEmail);

    for (const emailAddr of emailTargets) {
      sendTransferShareEmail(
        emailAddr,
        transfer.recipient_institution,
        graduateName,
        docType,
        hashCode,
        qrCode
      ).catch((err) => console.error(`Failed to send approval email to ${emailAddr}:`, err));
    }

    // 4a. Also email the graduate to confirm their request was approved
    if (graduate?.user?.email) {
      sendTransferApprovedEmail(
        graduate.user.email,
        graduateName,
        transfer.recipient_institution,
        docType,
        hashCode,
        qrCode
      ).catch((err) => console.error('Failed to send graduate approval email:', err));
    }

    // 4. Notify the graduate
    if (graduate?.user?.id) {
      await supabaseAdmin.from('notifications').insert({
        user_id:           graduate.user.id,
        title:             'Transfer Request Approved! ✅',
        message:           `Your transfer request to ${transfer.recipient_institution} has been approved. The verification QR code and hash have been sent to the receiving university.`,
        notification_type: 'transfer_approved',
        metadata:          { transfer_id: id, hash_code: hashCode },
      });
    }

    // 5. Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id:  user.id,
      action:   'approve_transfer',
      details:  {
        transfer_id:           id,
        graduate_id:           graduate?.id,
        recipient_institution: transfer.recipient_institution,
        university_email:      universityEmail,
        document_type:         docType,
        approved_by:           userData.full_name,
      },
    });

    return NextResponse.json({
      success: true,
      message: `Transfer approved. Verification email sent to ${emailTargets.join(', ') || 'the receiving institution'}.`,
    });

  } catch (error) {
    console.error('Transfer approval error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
