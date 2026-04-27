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

    const { searchParams } = new URL(request.url);
    const page   = parseInt(searchParams.get('page')   || '1');
    const limit  = parseInt(searchParams.get('limit')  || '30');
    const action = searchParams.get('action') || '';
    const offset = (page - 1) * limit;

    // Build query — audit_logs uses 'timestamp' column (not 'created_at')
    let query = supabaseAdmin
      .from('audit_logs')
      .select(`
        id, action, details, ip_address, timestamp,
        user:users(full_name, email, role)
      `, { count: 'exact' });

    if (action) {
      query = query.eq('action', action);
    }

    const { data, error, count } = await query
      .range(offset, offset + limit - 1)
      .order('timestamp', { ascending: false }); // ← fixed: was 'created_at'

    if (error) {
      console.error('Audit log query error:', error);
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data:       data || [],
      total:      count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (err) {
    console.error('Audit log error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
