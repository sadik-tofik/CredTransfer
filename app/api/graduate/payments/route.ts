import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  // Get graduate profile
  const { data: graduate } = await supabaseAdmin
    .from('graduates')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!graduate) {
    return NextResponse.json({ success: false, error: 'Graduate profile not found' }, { status: 404 });
  }

  // Get payments
  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('*')
    .eq('graduate_id', graduate.id)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, data });
}
