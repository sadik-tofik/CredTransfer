import { NextRequest, NextResponse } from 'next/server';
import { verifyDocumentOnChain } from '@/lib/blockchain';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hash } = body;

    if (!hash) {
      return NextResponse.json(
        { success: false, error: 'Document hash is required' },
        { status: 400 }
      );
    }

    const result = await verifyDocumentOnChain(hash);

    if (!result) {
      return NextResponse.json({
        success: true,
        data: {
          exists: false,
          verified: false,
        },
        message: 'Document not found on blockchain',
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        exists: result.exists,
        revoked: result.revoked,
        verified: result.exists && !result.revoked,
        graduateId: result.graduateId,
        timestamp: result.timestamp,
        documentType: result.documentType,
      },
      message: result.exists 
        ? (result.revoked ? 'Document found but has been revoked' : 'Document verified on blockchain')
        : 'Document not found on blockchain',
    });
  } catch (error) {
    console.error('Blockchain verify error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const hash = searchParams.get('hash');

  if (!hash) {
    return NextResponse.json(
      { success: false, error: 'Document hash is required' },
      { status: 400 }
    );
  }

  try {
    const result = await verifyDocumentOnChain(hash);

    return NextResponse.json({
      success: true,
      data: result || { exists: false },
    });
  } catch (error) {
    console.error('Blockchain verify error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
