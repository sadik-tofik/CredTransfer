import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { revokeDocumentHash } from '@/lib/blockchain';

// GET: Get document by ID
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    const { data: document, error } = await supabaseAdmin
      .from('documents')
      .select(`
        *,
        graduate:graduates(
          id, student_id, graduation_year, department, fee_cleared,
          user:users(id, full_name, email, phone)
        ),
        uploader:users!uploaded_by(id, full_name, email)
      `)
      .eq('id', id)
      .single();

    if (error || !document) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    // Access control
    if (userData?.role === 'graduate') {
      const grad = document.graduate as { user: { id: string } };
      if (grad?.user?.id !== user.id) {
        return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
      }
    }

    return NextResponse.json({ success: true, data: document });
  } catch (error) {
    console.error('Document fetch error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE: Revoke document (registrar only)
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Get user role
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!userData || !['registrar', 'admin'].includes(userData.role)) {
      return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
    }

    const { data: document } = await supabaseAdmin
      .from('documents')
      .select('id, file_hash, status')
      .eq('id', id)
      .single();

    if (!document) {
      return NextResponse.json({ success: false, error: 'Document not found' }, { status: 404 });
    }

    if (document.status === 'revoked') {
      return NextResponse.json({ success: false, error: 'Document is already revoked' }, { status: 400 });
    }

    // Revoke on blockchain
    const blockchainResult = await revokeDocumentHash(document.file_hash);

    // Update database
    await supabaseAdmin
      .from('documents')
      .update({ status: 'revoked' })
      .eq('id', id);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'revoke_document',
      details: { document_id: id, blockchain_tx: blockchainResult.txHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Document revoked successfully',
      blockchain: blockchainResult,
    });
  } catch (error) {
    console.error('Document revoke error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
