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

    // Get graduate record for this user
    const { data: graduate, error: gradError } = await supabaseAdmin
      .from('graduates')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (gradError || !graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate profile not found' },
        { status: 404 }
      );
    }

    // Get documents for this graduate
    const { data: documents, error: docError } = await supabaseAdmin
      .from('documents')
      .select(`
        id,
        document_type,
        file_name,
        file_path,
        file_hash,
        blockchain_tx_hash,
        blockchain_block,
        status,
        uploaded_at,
        expires_at
      `)
      .eq('graduate_id', graduate.id)
      .order('uploaded_at', { ascending: false });

    if (docError) {
      console.error('Documents fetch error:', docError);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: documents || [],
    });
  } catch (error) {
    console.error('Graduate documents error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
