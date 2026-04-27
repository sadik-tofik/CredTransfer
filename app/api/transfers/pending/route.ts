import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const userRole = userData?.role || (user.user_metadata?.role as string | undefined);
    if (!userRole || !['registrar', 'admin'].includes(userRole)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '50');
    const offset = (page - 1) * limit;

    // Include metadata so the registrar page can show the screenshot inline
    // without a second API call — the base64 data-URL is inside metadata.
    let query = supabaseAdmin
      .from('transfer_requests')
      .select(`
        id, status, payment_status, payment_id,
        recipient_institution, recipient_email, university_email,
        hash_code, qr_code, created_at, expires_at, rejection_reason,
        graduate:graduates(
          id, student_id, graduation_year, department,
          user:users(full_name, email, phone)
        ),
        document:documents(id, document_type, file_name, status, blockchain_tx_hash),
        payment:payments(
          id, amount, status, payment_method, transaction_reference, metadata
        )
      `, { count: 'exact' });

    if (status && status !== '') {
      query = query.eq('status', status);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Pending transfers query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    // Pull screenshot_data_url out of metadata so the UI can access it cleanly
    const enriched = (data || []).map((req: Record<string, unknown>) => {
      const payment = req.payment as Record<string, unknown> | null;
      const meta    = payment?.metadata as Record<string, unknown> | null;
      return {
        ...req,
        payment: payment ? {
          ...payment,
          screenshot_data_url:  meta?.screenshot_data_url  as string | undefined,
          screenshot_file_name: meta?.screenshot_file_name as string | undefined,
          screenshot_uploaded_at: meta?.uploaded_at        as string | undefined,
        } : null,
      };
    });

    return NextResponse.json({
      success: true,
      data:       enriched,
      total:      count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });

  } catch (error) {
    console.error('Pending transfers list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
