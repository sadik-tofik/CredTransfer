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

    // Get graduate profile with user info
    const { data: graduate, error } = await supabaseAdmin
      .from('graduates')
      .select(`
        id,
        student_id,
        graduation_year,
        department,
        fee_cleared,
        created_at,
        user:users (
          id,
          email,
          full_name,
          phone,
          is_verified
        )
      `)
      .eq('user_id', user.id)
      .single();

    if (error || !graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate profile not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: graduate,
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { phone, department } = body;

    // Update user phone
    if (phone) {
      await supabaseAdmin
        .from('users')
        .update({ phone })
        .eq('id', user.id);
    }

    // Update graduate department
    if (department) {
      await supabaseAdmin
        .from('graduates')
        .update({ department })
        .eq('user_id', user.id);
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Profile update error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
