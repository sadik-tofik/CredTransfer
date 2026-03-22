import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (role !== 'graduate') {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Get graduate profile
    const { data: graduate, error: gradError } = await supabaseAdmin
      .from('graduates')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (gradError || !graduate) {
      return NextResponse.json({ 
        success: false, 
        error: 'Graduate profile not found' 
      }, { status: 404 });
    }

    // Get documents
    const { data: documents } = await supabaseAdmin
      .from('documents')
      .select('*')
      .eq('graduate_id', graduate.id)
      .order('uploaded_at', { ascending: false })
      .limit(10);

    // Get transfer requests
    const { data: transfers } = await supabaseAdmin
      .from('transfer_requests')
      .select(`
        *,
        document:documents(id, document_type, file_name)
      `)
      .eq('graduate_id', graduate.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Calculate stats
    const activeDocuments = documents?.filter(d => d.status === 'active') || [];
    const activeTransfers = transfers?.filter(t => ['pending', 'approved'].includes(t.status)) || [];
    const completedTransfers = transfers?.filter(t => t.status === 'completed') || [];

    // Get verification count
    const { count: verificationCount } = await supabaseAdmin
      .from('verifications')
      .select('*', { count: 'exact', head: true })
      .in('document_id', activeDocuments.length > 0 ? activeDocuments.map(d => d.id) : ['00000000-0000-0000-0000-000000000000']);

    const stats = {
      total_documents: activeDocuments.length,
      active_transfers: activeTransfers.length,
      completed_transfers: completedTransfers.length,
      total_verifications: verificationCount || 0,
    };

    return NextResponse.json({
      success: true,
      data: {
        graduate,
        stats,
        documents: documents || [],
        transfers: transfers || [],
      },
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
