import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateFileHash, generateQRCodeData } from '@/lib/crypto';
import { storeDocumentHash } from '@/lib/blockchain';

interface BulkUploadResult {
  success: boolean;
  student_id: string;
  document_type: string;
  file_name: string;
  file_hash?: string;
  error?: string;
}

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
    const files = formData.getAll('files') as File[];
    const metadata = JSON.parse(formData.get('metadata') as string || '[]') as Array<{
      student_id: string;
      document_type: string;
      file_index: number;
    }>;

    if (!files.length || !metadata.length) {
      return NextResponse.json(
        { success: false, error: 'No files or metadata provided' },
        { status: 400 }
      );
    }

    const results: BulkUploadResult[] = [];
    const errors: string[] = [];

    for (const meta of metadata) {
      const file = files[meta.file_index];
      if (!file) {
        results.push({
          success: false,
          student_id: meta.student_id,
          document_type: meta.document_type,
          file_name: 'N/A',
          error: 'File not found',
        });
        continue;
      }

      try {
        // Find graduate
        const { data: graduate, error: gradError } = await supabaseAdmin
          .from('graduates')
          .select('id, user_id, student_id')
          .eq('student_id', meta.student_id)
          .single();

        if (gradError || !graduate) {
          results.push({
            success: false,
            student_id: meta.student_id,
            document_type: meta.document_type,
            file_name: file.name,
            error: 'Graduate not found',
          });
          continue;
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
          results.push({
            success: false,
            student_id: meta.student_id,
            document_type: meta.document_type,
            file_name: file.name,
            error: 'Document already exists',
          });
          continue;
        }

        // Upload to storage
        const fileName = `${graduate.student_id}/${meta.document_type}/${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabaseAdmin.storage
          .from('documents')
          .upload(fileName, fileBuffer, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          results.push({
            success: false,
            student_id: meta.student_id,
            document_type: meta.document_type,
            file_name: file.name,
            error: 'Upload failed',
          });
          continue;
        }

        // Store on blockchain
        const blockchainResult = await storeDocumentHash(fileHash, graduate.student_id, meta.document_type);

        // Save to database
        await supabaseAdmin.from('documents').insert({
          graduate_id: graduate.id,
          document_type: meta.document_type,
          file_name: file.name,
          file_path: uploadData.path,
          file_size: file.size,
          file_hash: fileHash,
          blockchain_tx_hash: blockchainResult.txHash || null,
          blockchain_block: blockchainResult.blockNumber || null,
          status: 'active',
          uploaded_by: user.id,
        });

        results.push({
          success: true,
          student_id: meta.student_id,
          document_type: meta.document_type,
          file_name: file.name,
          file_hash: fileHash,
        });
      } catch (error) {
        results.push({
          success: false,
          student_id: meta.student_id,
          document_type: meta.document_type,
          file_name: file.name,
          error: 'Processing failed',
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'bulk_upload_documents',
      details: { total: results.length, success: successCount, failed: failCount },
    });

    return NextResponse.json({
      success: true,
      data: {
        results,
        summary: {
          total: results.length,
          success: successCount,
          failed: failCount,
        },
      },
      message: `Bulk upload completed: ${successCount} successful, ${failCount} failed`,
    });
  } catch (error) {
    console.error('Bulk upload error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

// GET: Download CSV template
export async function GET() {
  const csvTemplate = `student_id,document_type,file_name
JU/1234/15,diploma,diploma.pdf
JU/1235/15,transcript,transcript.pdf
JU/1236/15,fee_clearance,clearance.pdf`;

  return new NextResponse(csvTemplate, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="bulk_upload_template.csv"',
    },
  });
}
