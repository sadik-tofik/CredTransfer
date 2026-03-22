import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyDocumentOnChain } from '@/lib/blockchain';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const verifierInstitution = request.headers.get('x-verifier-institution') || null;

    if (!code || code.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // Check if it's a transfer hash code (16-char alphanumeric)
    const isHashCode = /^[A-Z0-9]{16}$/.test(code);
    
    // Check if it's a full SHA-256 hash (64 hex chars)
    const isFullHash = /^[a-fA-F0-9]{64}$/.test(code);

    let document = null;
    let graduate = null;
    let transfer = null;

    if (isHashCode) {
      // Look up by transfer request hash code
      const { data: transferData, error: transferError } = await supabaseAdmin
        .from('transfer_requests')
        .select(`
          id,
          hash_code,
          qr_code,
          recipient_institution,
          status,
          expires_at,
          document:documents (
            id,
            document_type,
            file_name,
            file_hash,
            blockchain_tx_hash,
            blockchain_block,
            blockchain_timestamp,
            status,
            uploaded_at,
            graduate:graduates (
              id,
              student_id,
              graduation_year,
              department,
              user:users (
                full_name
              )
            )
          )
        `)
        .eq('hash_code', code)
        .single();

      if (!transferError && transferData) {
        transfer = transferData;
        document = transferData.document as {
          id: string;
          document_type: string;
          file_name: string;
          file_hash: string;
          blockchain_tx_hash: string | null;
          blockchain_block: number | null;
          blockchain_timestamp: string | null;
          status: string;
          uploaded_at: string;
          graduate: {
            id: string;
            student_id: string;
            graduation_year: number;
            department: string;
            user: { full_name: string };
          };
        };
        graduate = document?.graduate;
      }
    }

    if (!document && isFullHash) {
      // Look up by document file hash
      const { data: docData, error: docError } = await supabaseAdmin
        .from('documents')
        .select(`
          id,
          document_type,
          file_name,
          file_hash,
          blockchain_tx_hash,
          blockchain_block,
          blockchain_timestamp,
          status,
          uploaded_at,
          graduate:graduates (
            id,
            student_id,
            graduation_year,
            department,
            user:users (
              full_name
            )
          )
        `)
        .eq('file_hash', code.toLowerCase())
        .single();

      if (!docError && docData) {
        document = docData;
        graduate = docData.graduate as {
          id: string;
          student_id: string;
          graduation_year: number;
          department: string;
          user: { full_name: string };
        };
      }
    }

    // If still no document found, try searching more broadly
    if (!document) {
      const { data: docData } = await supabaseAdmin
        .from('documents')
        .select(`
          id,
          document_type,
          file_name,
          file_hash,
          blockchain_tx_hash,
          blockchain_block,
          blockchain_timestamp,
          status,
          uploaded_at,
          graduate:graduates (
            id,
            student_id,
            graduation_year,
            department,
            user:users (
              full_name
            )
          )
        `)
        .ilike('file_hash', `%${code}%`)
        .limit(1)
        .single();

      if (docData) {
        document = docData;
        graduate = docData.graduate as {
          id: string;
          student_id: string;
          graduation_year: number;
          department: string;
          user: { full_name: string };
        };
      }
    }

    // Document not found in database
    if (!document) {
      // Log failed verification attempt
      await supabaseAdmin.from('verifications').insert({
        verifier_institution: verifierInstitution,
        verification_code: code,
        result: 'invalid',
        ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
      });

      return NextResponse.json({
        success: true,
        data: {
          result: 'invalid',
          message: 'No document found matching this verification code',
        },
      });
    }

    // Check blockchain verification
    let blockchainData = null;
    if (document.file_hash) {
      blockchainData = await verifyDocumentOnChain(document.file_hash);
    }

    // Determine verification result
    let result: 'verified' | 'invalid' | 'suspicious' | 'revoked' = 'invalid';

    if (document.status === 'revoked') {
      result = 'revoked';
    } else if (blockchainData?.exists && !blockchainData.revoked) {
      result = 'verified';
    } else if (document.blockchain_tx_hash) {
      // Has tx hash but blockchain check failed - might be pending or suspicious
      result = blockchainData ? 'verified' : 'suspicious';
    } else {
      // Not on blockchain yet
      result = 'suspicious';
    }

    // Check if transfer is expired
    if (transfer && new Date(transfer.expires_at) < new Date()) {
      result = 'invalid';
    }

    // Log verification
    await supabaseAdmin.from('verifications').insert({
      document_id: document.id,
      transfer_request_id: transfer?.id || null,
      verifier_institution: verifierInstitution,
      verification_code: code,
      result,
      ip_address: request.headers.get('x-forwarded-for')?.split(',')[0] || null,
    });

    // Build response
    const graduateUser = graduate?.user as { full_name: string } | undefined;
    const responseData = {
      result,
      message: getResultMessage(result),
      document: {
        id: document.id,
        document_type: document.document_type,
        file_name: document.file_name,
        file_hash: document.file_hash,
        uploaded_at: document.uploaded_at,
      },
      graduate: graduate ? {
        full_name: graduateUser?.full_name || 'Unknown',
        student_id: graduate.student_id,
        department: graduate.department,
        graduation_year: graduate.graduation_year,
      } : null,
      blockchain: blockchainData ? {
        tx_hash: document.blockchain_tx_hash,
        block_number: document.blockchain_block,
        timestamp: blockchainData.timestamp,
        network: 'sepolia',
        graduate_id: blockchainData.graduateId,
        document_type: blockchainData.documentType,
      } : null,
      transfer: transfer ? {
        recipient_institution: transfer.recipient_institution,
        expires_at: transfer.expires_at,
      } : null,
    };

    return NextResponse.json({
      success: true,
      data: responseData,
    });
  } catch (error) {
    console.error('Verification error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

function getResultMessage(result: string): string {
  switch (result) {
    case 'verified':
      return 'This document is authentic and verified on blockchain';
    case 'revoked':
      return 'This document has been revoked by the issuing institution';
    case 'suspicious':
      return 'Document found but blockchain verification pending or failed';
    case 'invalid':
    default:
      return 'This verification code is invalid or expired';
  }
}
