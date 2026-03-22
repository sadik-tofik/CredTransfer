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

    // Get user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['registrar', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const start_date = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const end_date = searchParams.get('end_date') || new Date().toISOString().split('T')[0];

    const [documents, transfers, payments, verifications] = await Promise.all([
      supabaseAdmin
        .from('documents')
        .select('id, document_type, uploaded_at, graduate:graduates(student_id, user:users(full_name))')
        .gte('uploaded_at', start_date)
        .lte('uploaded_at', end_date + 'T23:59:59')
        .order('uploaded_at', { ascending: false }),

      supabaseAdmin
        .from('transfer_requests')
        .select('id, status, created_at, recipient_institution, graduate:graduates(student_id, user:users(full_name))')
        .gte('created_at', start_date)
        .lte('created_at', end_date + 'T23:59:59')
        .order('created_at', { ascending: false }),

      supabaseAdmin
        .from('payments')
        .select('id, amount, status, payment_method, paid_at')
        .eq('status', 'completed')
        .gte('paid_at', start_date)
        .lte('paid_at', end_date + 'T23:59:59'),

      supabaseAdmin
        .from('verifications')
        .select('id, result, verified_at, verifier_institution')
        .gte('verified_at', start_date)
        .lte('verified_at', end_date + 'T23:59:59'),
    ]);

    const totalRevenue = payments.data?.reduce((sum, p) => sum + p.amount, 0) || 0;

    return NextResponse.json({
      success: true,
      data: {
        period: { start_date, end_date },
        summary: {
          total_documents: documents.data?.length || 0,
          total_transfers: transfers.data?.length || 0,
          total_revenue: totalRevenue,
          total_verifications: verifications.data?.length || 0,
          successful_verifications: verifications.data?.filter((v) => v.result === 'verified').length || 0,
        },
        documents: documents.data || [],
        transfers: transfers.data || [],
        payments: payments.data || [],
        verifications: verifications.data || [],
      },
    });
  } catch (error) {
    console.error('Reports error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
