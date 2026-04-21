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

    if (!userData || !['registrar', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    // --- Aggregate queries run in parallel ---
    const [
      docCount,
      gradCount,
      transferStats,
      verificationCount,
      revenueData,
      recentActivity,
      documentTypeBreakdown,
      monthlyTransfers,
    ] = await Promise.all([
      // Total documents
      supabaseAdmin.from('documents').select('id', { count: 'exact', head: true }),
      // Total graduates
      supabaseAdmin.from('graduates').select('id', { count: 'exact', head: true }),
      // Transfer status breakdown
      supabaseAdmin
        .from('transfer_requests')
        .select('status'),
      // Total verifications
      supabaseAdmin.from('verifications').select('id', { count: 'exact', head: true }),
      // Revenue from completed payments
      supabaseAdmin
        .from('payments')
        .select('amount')
        .eq('status', 'completed'),
      // Recent 5 transfers
      supabaseAdmin
        .from('transfer_requests')
        .select(`
          id, status, created_at, recipient_institution,
          graduate:graduates(user:users(full_name)),
          document:documents(document_type)
        `)
        .order('created_at', { ascending: false })
        .limit(5),
      // Document type breakdown
      supabaseAdmin
        .from('documents')
        .select('document_type'),
      // Transfers per month (last 6 months)
      supabaseAdmin
        .from('transfer_requests')
        .select('created_at, status')
        .gte('created_at', new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString()),
    ]);

    // Process transfer stats
    const transferData = transferStats.data || [];
    const byStatus = transferData.reduce((acc: Record<string, number>, t) => {
      acc[t.status] = (acc[t.status] || 0) + 1;
      return acc;
    }, {});

    // Process revenue
    const totalRevenue = (revenueData.data || []).reduce((sum, p) => sum + Number(p.amount), 0);

    // Process document type breakdown
    const docTypes = (documentTypeBreakdown.data || []).reduce((acc: Record<string, number>, d) => {
      acc[d.document_type] = (acc[d.document_type] || 0) + 1;
      return acc;
    }, {});

    // Process monthly transfers
    const monthlyData = buildMonthlyData(monthlyTransfers.data || []);

    return NextResponse.json({
      success: true,
      data: {
        totals: {
          documents:     docCount.count     || 0,
          graduates:     gradCount.count    || 0,
          verifications: verificationCount.count || 0,
          revenue:       totalRevenue,
          transfers:     {
            total:     transferData.length,
            pending:   byStatus.pending   || 0,
            approved:  byStatus.approved  || 0,
            completed: byStatus.completed || 0,
            rejected:  byStatus.rejected  || 0,
          },
        },
        charts: {
          transfersByStatus: [
            { name: 'Pending',   value: byStatus.pending   || 0, color: '#f59e0b' },
            { name: 'Approved',  value: byStatus.approved  || 0, color: '#10b981' },
            { name: 'Completed', value: byStatus.completed || 0, color: '#3b82f6' },
            { name: 'Rejected',  value: byStatus.rejected  || 0, color: '#ef4444' },
          ],
          documentTypes: Object.entries(docTypes).map(([type, count]) => ({
            name:  type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            value: count,
          })),
          monthlyTransfers: monthlyData,
        },
        recentActivity: recentActivity.data || [],
      },
    });

  } catch (err) {
    console.error('Analytics error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function buildMonthlyData(transfers: { created_at: string; status: string }[]) {
  const months: Record<string, { month: string; total: number; approved: number }> = {};

  for (let i = 5; i >= 0; i--) {
    const d    = new Date();
    d.setMonth(d.getMonth() - i);
    const key  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleString('en', { month: 'short', year: '2-digit' });
    months[key] = { month: label, total: 0, approved: 0 };
  }

  for (const t of transfers) {
    const d   = new Date(t.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (months[key]) {
      months[key].total++;
      if (t.status === 'approved' || t.status === 'completed') months[key].approved++;
    }
  }

  return Object.values(months);
}
