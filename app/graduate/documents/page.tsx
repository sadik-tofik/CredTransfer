'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { formatDate, getDocumentTypeLabel, truncateHash, getEtherscanLink } from '@/lib/utils';
import type { Document } from '@/types';

export default function GraduateDocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      try {
        const response = await axios.get('/api/graduate/documents');
        setDocuments(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDocuments();
  }, []);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; border: string }> = {
      active: { bg: 'bg-green-900/50', text: 'text-green-300', border: 'border-green-700' },
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', border: 'border-yellow-700' },
      revoked: { bg: 'bg-red-900/50', text: 'text-red-300', border: 'border-red-700' },
      expired: { bg: 'bg-gray-900/50', text: 'text-gray-300', border: 'border-gray-700' },
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.bg} ${c.text} ${c.border}`}>{status.toUpperCase()}</Badge>;
  };

  const getDocIcon = (type: string) => {
    const icons: Record<string, { bg: string; color: string }> = {
      diploma: { bg: 'bg-blue-900/50', color: 'text-blue-400' },
      transcript: { bg: 'bg-green-900/50', color: 'text-green-400' },
      fee_clearance: { bg: 'bg-purple-900/50', color: 'text-purple-400' },
      other: { bg: 'bg-gray-900/50', color: 'text-gray-400' },
    };
    const c = icons[type] || icons.other;
    return (
      <div className={`w-12 h-12 ${c.bg} rounded-lg flex items-center justify-center`}>
        <svg className={`w-6 h-6 ${c.color}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">My Documents</h1>
          <p className="text-white/50 text-sm">View and share your academic credentials</p>
        </div>
        <Link href="/graduate/share">
          <Button className="bg-green-600 hover:bg-green-700">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share Document
          </Button>
        </Link>
      </div>

      {/* Documents Grid */}
      {isLoading ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="bg-white/5 border-white/10">
              <CardContent className="p-6">
                <Skeleton className="h-12 w-12 rounded-lg bg-white/10 mb-4" />
                <Skeleton className="h-5 w-3/4 bg-white/10 mb-2" />
                <Skeleton className="h-4 w-1/2 bg-white/10" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : documents.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {documents.map((doc) => (
            <Card 
              key={doc.id} 
              className="bg-white/5 border-white/10 hover:border-green-500/50 transition-all cursor-pointer"
              onClick={() => setSelectedDoc(doc)}
            >
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  {getDocIcon(doc.document_type)}
                  {getStatusBadge(doc.status)}
                </div>
                <h3 className="text-white font-semibold mb-1">{getDocumentTypeLabel(doc.document_type)}</h3>
                <p className="text-white/50 text-sm mb-3">{doc.file_name}</p>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-white/40">Uploaded: {formatDate(doc.uploaded_at)}</span>
                  {doc.blockchain_tx_hash && (
                    <Badge className="bg-purple-900/50 text-purple-300 border-purple-700 text-xs">
                      <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                      </svg>
                      On-chain
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">No Documents Found</h3>
            <p className="text-white/50 text-sm mb-4">
              Your academic documents will appear here once they are uploaded by the registrar.
            </p>
            <p className="text-white/30 text-xs">
              If you believe your documents should be here, please contact the Academic Registrar&apos;s Office.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Document Details Dialog */}
      <Dialog open={!!selectedDoc} onOpenChange={() => setSelectedDoc(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              {selectedDoc && getDocIcon(selectedDoc.document_type)}
              <span>{selectedDoc && getDocumentTypeLabel(selectedDoc.document_type)}</span>
            </DialogTitle>
            <DialogDescription className="text-white/60">
              Document details and blockchain verification
            </DialogDescription>
          </DialogHeader>

          {selectedDoc && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/50 mb-1">File Name</p>
                  <p className="text-white">{selectedDoc.file_name}</p>
                </div>
                <div>
                  <p className="text-white/50 mb-1">Status</p>
                  {getStatusBadge(selectedDoc.status)}
                </div>
                <div>
                  <p className="text-white/50 mb-1">Upload Date</p>
                  <p className="text-white">{formatDate(selectedDoc.uploaded_at)}</p>
                </div>
                <div>
                  <p className="text-white/50 mb-1">Document Type</p>
                  <p className="text-white">{getDocumentTypeLabel(selectedDoc.document_type)}</p>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg">
                <p className="text-white/50 text-xs mb-2">Document Hash (SHA-256)</p>
                <p className="text-white font-mono text-sm break-all">{selectedDoc.file_hash}</p>
              </div>

              {selectedDoc.blockchain_tx_hash && (
                <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/50">
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                    </svg>
                    <span className="text-purple-300 font-medium">Blockchain Verified</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/50">Transaction</span>
                      <a
                        href={getEtherscanLink(selectedDoc.blockchain_tx_hash, 'sepolia')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 font-mono"
                      >
                        {truncateHash(selectedDoc.blockchain_tx_hash, 8, 6)}
                      </a>
                    </div>
                    {selectedDoc.blockchain_block && (
                      <div className="flex justify-between">
                        <span className="text-white/50">Block</span>
                        <span className="text-white">{selectedDoc.blockchain_block}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-white/50">Network</span>
                      <Badge className="bg-blue-900/50 text-blue-300 border-blue-700 text-xs">Sepolia Testnet</Badge>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Link href={`/graduate/share?document=${selectedDoc.id}`} className="flex-1">
                  <Button className="w-full bg-green-600 hover:bg-green-700">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                    </svg>
                    Share This Document
                  </Button>
                </Link>
                <Link href={`/verify?hash=${selectedDoc.file_hash}`}>
                  <Button variant="outline" className="border-white/20 text-white hover:bg-white/10">
                    Verify
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
