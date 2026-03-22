import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET: Search/list graduates (registrar only)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check user role - first try users table, then fallback to metadata
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
    const student_id = searchParams.get('student_id');
    const name = searchParams.get('name');
    const department = searchParams.get('department');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;

    let query = supabaseAdmin
      .from('graduates')
      .select(`
        *,
        user:users(id, email, full_name, phone, is_verified, created_at)
      `, { count: 'exact' });

    if (student_id) query = query.ilike('student_id', `%${student_id}%`);
    if (department) query = query.ilike('department', `%${department}%`);
    if (name) {
      query = query.filter('user.full_name', 'ilike', `%${name}%`);
    }

    const { data, error, count } = await query
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
    console.error('Graduates list error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
