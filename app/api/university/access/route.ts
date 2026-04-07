import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const accessRequestSchema = z.object({
  access_code: z.string().min(1, 'Access code is required'),
  university_email: z.string().email('Valid university email is required'),
  verification_code: z.string().min(1, 'Verification code is required'),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { access_code, university_email, verification_code } = accessRequestSchema.parse(body);

    const supabase = createClient();

    // Verify the transfer exists and is approved
    const { data: transfer, error: transferError } = await supabase
      .from('transfers')
      .select(`
        *,
        graduate:graduates(id, full_name, student_id, email),
        document:documents(id, document_type, file_name, file_url, file_hash)
      `)
      .eq('access_code', access_code)
      .eq('status', 'approved')
      .single();

    if (transferError || !transfer) {
      return NextResponse.json(
        { error: 'Invalid or expired access code' },
        { status: 404 }
      );
    }

    // Verify the verification code matches
    if (transfer.verification_code !== verification_code) {
      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if access has already been granted
    const { data: existingAccess } = await supabase
      .from('university_access_logs')
      .select('*')
      .eq('transfer_id', transfer.id)
      .eq('university_email', university_email)
      .single();

    if (existingAccess) {
      return NextResponse.json(
        { error: 'Access already granted to this university' },
        { status: 400 }
      );
    }

    // Log the access attempt
    const { error: logError } = await supabase
      .from('university_access_logs')
      .insert({
        transfer_id: transfer.id,
        university_email,
        access_granted_at: new Date().toISOString(),
        ip_address: request.headers.get('x-forwarded-for') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      });

    if (logError) {
      console.error('Error logging access:', logError);
      return NextResponse.json(
        { error: 'Failed to log access' },
        { status: 500 }
      );
    }

    // Generate secure download URL (valid for 72 hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    const secureToken = Buffer.from(
      JSON.stringify({
        transfer_id: transfer.id,
        university_email,
        expires_at: expiresAt.toISOString(),
      })
    ).toString('base64');

    return NextResponse.json({
      success: true,
      data: {
        graduate: transfer.graduate,
        document: transfer.document,
        secure_token: secureToken,
        expires_at: expiresAt.toISOString(),
        download_url: `/university/download/${secureToken}`,
      },
    });
  } catch (error) {
    console.error('University access error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
