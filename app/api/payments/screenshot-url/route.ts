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

    // Only registrars/admins can fetch screenshot URLs
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

    // Get the screenshot path from the payment record
    const { data: payment, error } = await supabaseAdmin
      .from('payments')
      .select('payment_screenshot_url')
      .eq('id', paymentId)
      .single();

    if (error || !payment?.payment_screenshot_url) {
      return NextResponse.json({ success: false, error: 'Screenshot not found' }, { status: 404 });
    }

    // Generate a signed URL valid for 1 hour
    const { data: signedData, error: signError } = await supabaseAdmin.storage
      .from('payment-screenshots')
      .createSignedUrl(payment.payment_screenshot_url, 3600);

    if (signError || !signedData?.signedUrl) {
      // Bucket may not exist yet — return the path itself for fallback display
      return NextResponse.json({
        success: false,
        error: 'Could not generate signed URL. Ensure payment-screenshots bucket exists in Supabase Storage.',
        data: { path: payment.payment_screenshot_url }
      }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: { url: signedData.signedUrl } });

  } catch (err) {
    console.error('Screenshot URL error:', err);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
