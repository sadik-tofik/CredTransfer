import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateFileHash, generateQRCodeData } from '@/lib/crypto';
import { storeDocumentHash } from '@/lib/blockchain';
import { sendDocumentUploadNotification } from '@/lib/email';
import { uploadDocument } from '@/lib/storage';

const ALLOWED_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const role = user.user_metadata?.role;
  if (!['registrar', 'admin'].includes(role)) {
    return NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const graduate_id = formData.get('graduate_id') as string;
    const student_id = formData.get('student_id') as string;
    const document_type = formData.get('document_type') as string;

    if (!file || (!graduate_id && !student_id) || !document_type) {
      return NextResponse.json(
        { success: false, error: 'File, graduate/student ID, and document type are required' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Allowed: PDF, PNG, JPEG' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      );
    }

    // Find graduate (by graduate_id or student_id)
    let graduate;
    let gradError;
    
    if (graduate_id) {
      const result = await supabaseAdmin
        .from('graduates')
        .select('id, user_id, student_id, department, user:users(full_name, email)')
        .eq('id', graduate_id)
        .single();
      graduate = result.data;
      gradError = result.error;
    } else {
      const result = await supabaseAdmin
        .from('graduates')
        .select('id, user_id, student_id, department, user:users(full_name, email)')
        .eq('student_id', student_id)
        .single();
      graduate = result.data;
      gradError = result.error;
    }

    if (gradError || !graduate) {
      return NextResponse.json(
        { success: false, error: 'Graduate not found with this student ID' },
        { status: 404 }
      );
    }

    // Generate file hash
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const fileHash = generateFileHash(fileBuffer);

    // Check if hash already exists
    const { data: existingDoc } = await supabaseAdmin
      .from('documents')
      .select('id')
      .eq('file_hash', fileHash)
      .single();

    if (existingDoc) {
      return NextResponse.json(
        { success: false, error: 'This document has already been uploaded' },
        { status: 400 }
      );
    }

    // Upload file to Supabase Storage
    const fileName = `${graduate.student_id}/${document_type}/${Date.now()}-${file.name}`;
    const { path: filePath, error: uploadError } = await uploadDocument(fileName, fileBuffer, file.type);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      return NextResponse.json(
        { success: false, error: `Failed to upload file: ${uploadError}` },
        { status: 500 }
      );
    }

    // Store hash on blockchain
    const blockchainResult = await storeDocumentHash(fileHash, graduate.student_id, document_type);

    // Generate QR code
    const verifyUrl = `${process.env.NEXT_PUBLIC_APP_URL}/verify?hash=${fileHash}`;
    const qrCodeDataUrl = await generateQRCodeData(verifyUrl);

    // Save document metadata to database
    const { data: document, error: docError } = await supabaseAdmin
      .from('documents')
      .insert({
        graduate_id: graduate.id,
        document_type,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        file_hash: fileHash,
        blockchain_tx_hash: blockchainResult.txHash || null,
        blockchain_block: blockchainResult.blockNumber || null,
        blockchain_timestamp: blockchainResult.success ? new Date().toISOString() : null,
        status: 'active',
        uploaded_by: user.id,
      })
      .select()
      .single();

    if (docError) {
      console.error('Document save error:', docError);
      return NextResponse.json(
        { success: false, error: 'Failed to save document metadata' },
        { status: 500 }
      );
    }

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'upload_document',
      resource_type: 'document',
      resource_id: document.id,
      details: {
        graduate_student_id: student_id,
        document_type,
        file_hash: fileHash,
        blockchain_tx: blockchainResult.txHash,
      },
    });

    // Notify graduate
    const graduateUser = graduate.user as unknown as { full_name: string; email: string };
    if (graduateUser?.email) {
      sendDocumentUploadNotification(
        graduateUser.email,
        graduateUser.full_name,
        document_type
      ).catch(console.error);
    }

    return NextResponse.json({
      success: true,
      data: {
        document,
        file_hash: fileHash,
        blockchain: blockchainResult,
        qr_code: qrCodeDataUrl,
      },
      message: 'Document uploaded successfully',
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
