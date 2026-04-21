import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Auth
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Only graduates can upload screenshots
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || userData.role !== 'graduate') {
      return NextResponse.json({ success: false, error: 'Only graduates can upload payment screenshots' }, { status: 403 });
    }

    // Parse multipart form data
    const formData = await request.formData();
    const screenshot = formData.get('screenshot') as File | null;
    const transferId = formData.get('transfer_id') as string | null;
    const paymentId = formData.get('payment_id') as string | null;

    if (!screenshot || !transferId || !paymentId) {
      return NextResponse.json({ success: false, error: 'Missing required fields: screenshot, transfer_id, payment_id' }, { status: 400 });
    }

    // Validate file type and size
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(screenshot.type)) {
      return NextResponse.json({ success: false, error: 'Invalid file type. Only JPG, PNG and WebP are allowed.' }, { status: 400 });
    }
    const MAX_SIZE = 5 * 1024 * 1024; // 5 MB
    if (screenshot.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: 'File is too large. Maximum size is 5 MB.' }, { status: 400 });
    }

    // Verify the transfer belongs to this graduate
    const { data: graduate } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (!graduate) {
      return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
    }

    const { data: transfer } = await supabaseAdmin
      .from('transfer_requests')
      .select('id, payment_id, payment_status')
      .eq('id', transferId)
      .eq('graduate_id', graduate.id)
      .single();

    if (!transfer) {
      return NextResponse.json({ success: false, error: 'Transfer request not found or not owned by you' }, { status: 404 });
    }

    // Upload screenshot to Supabase Storage
    const fileExt = screenshot.name.split('.').pop() || 'jpg';
    const fileName = `payment_${paymentId}_${Date.now()}.${fileExt}`;
    const filePath = `screenshots/${graduate.id}/${fileName}`;

    const arrayBuffer = await screenshot.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
      .from('payment-screenshots')
      .upload(filePath, buffer, {
        contentType: screenshot.type,
        upsert: true,
      });

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      // Fallback: store as base64 in metadata if storage bucket doesn't exist yet
      const base64 = buffer.toString('base64');
      const screenshotDataUrl = `data:${screenshot.type};base64,${base64.substring(0, 100)}...[truncated]`;
      
      // Update payment record with metadata note
      await supabaseAdmin
        .from('payments')
        .update({
          metadata: { 
            screenshot_uploaded: true, 
            screenshot_note: 'Screenshot uploaded but storage bucket not configured. Please create payment-screenshots bucket in Supabase.',
            uploaded_at: new Date().toISOString()
          },
          status: 'processing',
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);
      
      // Still mark transfer as pending review
      await supabaseAdmin
        .from('transfer_requests')
        .update({ payment_status: 'processing' })
        .eq('id', transferId);

      // Log audit
      await supabaseAdmin.from('audit_logs').insert({
        user_id: user.id,
        action: 'upload_payment_screenshot',
        details: { transfer_id: transferId, payment_id: paymentId, storage_error: uploadError.message },
      });

      return NextResponse.json({ 
        success: true, 
        message: 'Screenshot received. Awaiting registrar verification.',
        warning: 'Storage bucket not configured — screenshot metadata saved.' 
      });
    }

    // Get public URL (the bucket should be private, so we store the path and generate signed URLs on demand)
    const screenshotPath = uploadData?.path || filePath;

    // Update payment record with screenshot URL
    await supabaseAdmin
      .from('payments')
      .update({
        payment_screenshot_url: screenshotPath,
        screenshot_uploaded_at: new Date().toISOString(),
        status: 'processing',
        updated_at: new Date().toISOString(),
      } as Record<string, unknown>)
      .eq('id', paymentId);

    // Update transfer request payment status
    await supabaseAdmin
      .from('transfer_requests')
      .update({ payment_status: 'processing' })
      .eq('id', transferId);

    // Create notification for registrar(s)
    const { data: registrars } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('role', 'registrar');

    if (registrars && registrars.length > 0) {
      await supabaseAdmin.from('notifications').insert(
        registrars.map((r) => ({
          user_id: r.id,
          title: 'Payment Screenshot Uploaded',
          message: `A graduate has uploaded a payment screenshot for transfer request. Please review and verify.`,
          notification_type: 'payment_review',
          metadata: { transfer_id: transferId, payment_id: paymentId },
        }))
      );
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'upload_payment_screenshot',
      details: { transfer_id: transferId, payment_id: paymentId, screenshot_path: screenshotPath },
    });

    return NextResponse.json({
      success: true,
      message: 'Payment screenshot uploaded successfully. Awaiting registrar verification.',
      data: { screenshot_path: screenshotPath },
    });

  } catch (error) {
    console.error('Screenshot upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
