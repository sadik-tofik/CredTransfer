import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { storeDocumentHash } from '@/lib/blockchain';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { document_id, file_hash, graduate_id, document_type } = body;

    if (!file_hash || !graduate_id || !document_type) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Store hash on blockchain
    const result = await storeDocumentHash(file_hash, graduate_id, document_type);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Blockchain transaction failed' },
        { status: 500 }
      );
    }

    // Update document with blockchain info if document_id provided
    if (document_id) {
      await supabaseAdmin
        .from('documents')
        .update({
          blockchain_tx_hash: result.txHash,
          blockchain_block: result.blockNumber,
        })
        .eq('id', document_id);
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'store_blockchain_hash',
      details: {
        file_hash,
        graduate_id,
        document_type,
        tx_hash: result.txHash,
        block_number: result.blockNumber,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        txHash: result.txHash,
        blockNumber: result.blockNumber,
      },
      message: 'Hash stored on blockchain successfully',
    });
  } catch (error) {
    console.error('Blockchain store error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
