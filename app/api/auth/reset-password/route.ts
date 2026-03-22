import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { supabaseAdmin } from '@/lib/supabase';
import { generateVerificationToken } from '@/lib/crypto';
import { sendPasswordResetEmail } from '@/lib/email';
import { z } from 'zod';

const requestResetSchema = z.object({ email: z.string().email() });
const confirmResetSchema = z.object({
  token: z.string(),
  password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
});

// Request password reset
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.token) {
      // Confirm reset
      const validation = confirmResetSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ success: false, error: 'Invalid input' }, { status: 400 });
      }

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, reset_token_expires')
        .eq('reset_token', validation.data.token)
        .single();

      if (!user || new Date(user.reset_token_expires) < new Date()) {
        return NextResponse.json(
          { success: false, error: 'Invalid or expired reset token' },
          { status: 400 }
        );
      }

      const password_hash = await bcrypt.hash(validation.data.password, 12);
      await supabaseAdmin
        .from('users')
        .update({ password_hash, reset_token: null, reset_token_expires: null })
        .eq('id', user.id);

      return NextResponse.json({ success: true, message: 'Password reset successfully' });
    } else {
      // Request reset
      const validation = requestResetSchema.safeParse(body);
      if (!validation.success) {
        return NextResponse.json({ success: false, error: 'Invalid email' }, { status: 400 });
      }

      const { data: user } = await supabaseAdmin
        .from('users')
        .select('id, full_name, email')
        .eq('email', validation.data.email.toLowerCase())
        .single();

      if (user) {
        const token = generateVerificationToken();
        const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await supabaseAdmin
          .from('users')
          .update({ reset_token: token, reset_token_expires: expires.toISOString() })
          .eq('id', user.id);

        await sendPasswordResetEmail(user.email, user.full_name, token).catch(console.error);
      }

      // Always return success to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If this email exists, a reset link has been sent',
      });
    }
  } catch {
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
