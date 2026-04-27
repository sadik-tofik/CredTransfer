import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/payments/screenshot-url?payment_id=xxx
//
// Returns the base64 data-URL of the payment screenshot stored in
// payments.metadata.screenshot_data_url — no Supabase Storage needed.
// ─────────────────────────────────────────────────────────────────────────────
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
    const paymentId = searchParams.get('payment_id');
    if (!paymentId) {
      return NextResponse.json({ success: false, error: 'payment_id is required' }, { status: 400 });
    }

    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('metadata, status')
      .eq('id', paymentId)
      .single();

    if (error || !payment) {
      return NextResponse.json({ success: false, error: 'Payment not found' }, { status: 404 });
    }

    const meta = payment.metadata as Record<string, unknown> | null;
    const dataUrl = meta?.screenshot_data_url as string | undefined;

    if (!dataUrl) {
      return NextResponse.json(
        { success: false, error: 'No screenshot has been uploaded for this payment yet.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        url:       dataUrl,
        file_name: (meta?.screenshot_file_name as string) || 'screenshot',
        file_size: meta?.screenshot_file_size as number | undefined,
        mime_type: meta?.screenshot_mime_type as string | undefined,
        uploaded_at: meta?.uploaded_at as string | undefined,
      },
    });

  } catch (err) {
    console.error('Screenshot URL error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
