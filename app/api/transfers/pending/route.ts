import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: List pending transfer requests (registrar only)
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

    let userRole = userData?.role;
    
    // Fallback to user metadata if users table lookup fails
    if (!userRole && user.user_metadata?.role) {
      userRole = user.user_metadata.role;
    }

    if (!userRole || !['registrar', 'admin'].includes(userRole)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        graduate:graduates(
          id, student_id, graduation_year, department,
          user:users(full_name, email, phone)
        ),
        document:documents(id, document_type, file_name, status, blockchain_tx_hash),
        payment:payments(id, amount, status, payment_method, transaction_reference)
      `, { count: 'exact' })
      .eq('status', status)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      data,
      total: count || 0,
      page,
      limit,
      totalPages: Math.ceil((count || 0) / limit),
    });
  } catch (error) {
    console.error('Pending transfers list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
