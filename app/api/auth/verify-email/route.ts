import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  const { data: user, error } = await supabaseAdmin
    .from('users')
    .select('id, email, verification_token_expires')
    .eq('verification_token', token)
    .eq('is_verified', false)
    .single();

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?error=invalid_token', request.url));
  }

  // Check token expiry
  if (new Date(user.verification_token_expires) < new Date()) {
    return NextResponse.redirect(new URL('/login?error=token_expired', request.url));
  }

  // Mark user as verified
  await supabaseAdmin
    .from('users')
    .update({
      is_verified: true,
      verification_token: null,
      verification_token_expires: null,
    })
    .eq('id', user.id);

  return NextResponse.redirect(new URL('/login?verified=true', request.url));
}
