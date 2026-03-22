import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { registerSchema } from '@/lib/validations';

// Create admin client for user management
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = registerSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error.issues[0].message },
        { status: 400 }
      );
    }

    const data = validation.data;

    // Check if student ID already exists (for graduates)
    if (data.role === 'graduate' && data.student_id) {
      const { data: existingGrad } = await supabaseAdmin
        .from('graduates')
        .select('id')
        .eq('student_id', data.student_id)
        .single();

      if (existingGrad) {
        return NextResponse.json(
          { success: false, error: 'This student ID is already registered' },
          { status: 400 }
        );
      }
    }

    // Check if employee ID already exists (for registrars)
    if (data.role === 'registrar' && data.employee_id) {
      const { data: existingReg } = await supabaseAdmin
        .from('registrars')
        .select('id')
        .eq('employee_id', data.employee_id)
        .single();

      if (existingReg) {
        return NextResponse.json(
          { success: false, error: 'This employee ID is already registered' },
          { status: 400 }
        );
      }
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email.toLowerCase(),
      password: data.password,
      email_confirm: true, // Auto-confirm for development
      user_metadata: {
        full_name: data.full_name,
        role: data.role,
        phone: data.phone || null,
      },
    });

    if (authError || !authData.user) {
      console.error('Auth creation error:', authError);
      if (authError?.message?.includes('already registered')) {
        return NextResponse.json(
          { success: false, error: 'An account with this email already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      );
    }

    const userId = authData.user.id;

    // Create user record in our users table
    const { error: userError } = await supabaseAdmin
      .from('users')
      .insert({
        id: userId,
        email: data.email.toLowerCase(),
        password_hash: 'supabase_auth', // Placeholder since Supabase Auth handles passwords
        role: data.role,
        full_name: data.full_name,
        phone: data.phone || null,
        is_verified: true, // Auto-verify for development
      });

    if (userError) {
      console.error('User table creation error:', userError);
      // Rollback: delete auth user if user table creation fails
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json(
        { success: false, error: 'Failed to create account' },
        { status: 500 }
      );
    }

    // Create role-specific profile
    if (data.role === 'graduate') {
      const { error: gradError } = await supabaseAdmin.from('graduates').insert({
        user_id: userId,
        student_id: data.student_id!,
        graduation_year: data.graduation_year || null,
        department: data.department || null,
        fee_cleared: false,
      });

      if (gradError) {
        console.error('Graduate profile creation error:', gradError);
      }
    } else if (data.role === 'registrar') {
      const { error: regError } = await supabaseAdmin.from('registrars').insert({
        user_id: userId,
        employee_id: data.employee_id!,
        department: data.department || null,
      });

      if (regError) {
        console.error('Registrar profile creation error:', regError);
      }
    }

    // Skip email verification for development
    // const { error: emailError } = await supabaseAdmin.auth.admin.generateLink({
    //   type: 'signup',
    //   email: data.email.toLowerCase(),
    //   password: data.password,
    //   options: {
    //     redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login?verified=true`,
    //   },
    // });

    // if (emailError) {
    //   console.error('Failed to send verification email:', emailError);
    // }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: userId,
      action: 'register',
      details: { email: data.email.toLowerCase(), role: data.role },
      ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip'),
    });

    return NextResponse.json(
      {
        success: true,
        message: 'Account created successfully. You can now log in.',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
