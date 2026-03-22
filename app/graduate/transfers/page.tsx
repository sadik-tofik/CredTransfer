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
import { formatDate, getDocumentTypeLabel, truncateHash } from '@/lib/utils';
import { toast } from 'sonner';
import type { TransferRequest } from '@/types';

export default function GraduateTransfersPage() {
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTransfer, setSelectedTransfer] = useState<TransferRequest | null>(null);

  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const response = await axios.get('/api/graduate/transfers');
        setTransfers(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch transfers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransfers();
  }, []);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string; icon: string }> = {
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300', icon: '⏳' },
      approved: { bg: 'bg-blue-900/50', text: 'text-blue-300', icon: '✓' },
      completed: { bg: 'bg-green-900/50', text: 'text-green-300', icon: '✅' },
      rejected: { bg: 'bg-red-900/50', text: 'text-red-300', icon: '✕' },
      expired: { bg: 'bg-gray-900/50', text: 'text-gray-300', icon: '⌛' },
    };
    const c = config[status] || config.pending;
    return (
      <Badge className={`${c.bg} ${c.text} border-transparent`}>
        <span className="mr-1">{c.icon}</span>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  const activeTransfers = transfers.filter(t => ['pending', 'approved'].includes(t.status));
  const completedTransfers = transfers.filter(t => t.status === 'completed');
  const otherTransfers = transfers.filter(t => ['rejected', 'expired'].includes(t.status));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transfer History</h1>
          <p className="text-white/50 text-sm">Track your document sharing requests</p>
        </div>
        <Link href="/graduate/share">
          <Button className="bg-green-600 hover:bg-green-700">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Transfer
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Transfers', value: transfers.length, color: 'text-white' },
          { label: 'Active', value: activeTransfers.length, color: 'text-blue-400' },
          { label: 'Completed', value: completedTransfers.length, color: 'text-green-400' },
          { label: 'Expired/Rejected', value: otherTransfers.length, color: 'text-red-400' },
        ].map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-white/50 text-xs">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Transfers List */}
      {isLoading ? (
        <div className="space-y-4">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-24 bg-white/5" />
          ))}
        </div>
      ) : transfers.length > 0 ? (
        <div className="space-y-6">
          {/* Active Transfers */}
          {activeTransfers.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Active Transfers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {activeTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    onClick={() => setSelectedTransfer(transfer)}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-blue-900/50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{transfer.recipient_institution}</p>
                        <p className="text-white/50 text-sm">
                          {transfer.document ? getDocumentTypeLabel(transfer.document.document_type) : 'Document'} • {formatDate(transfer.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {transfer.hash_code && (
                        <code className="text-green-400 font-mono text-sm hidden sm:block">
                          {transfer.hash_code}
                        </code>
                      )}
                      {getStatusBadge(transfer.status)}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Completed Transfers */}
          {completedTransfers.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Completed Transfers</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    onClick={() => setSelectedTransfer(transfer)}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{transfer.recipient_institution}</p>
                        <p className="text-white/50 text-sm">
                          {transfer.document ? getDocumentTypeLabel(transfer.document.document_type) : 'Document'} • {formatDate(transfer.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(transfer.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Expired/Rejected */}
          {otherTransfers.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white/60 text-base">Expired / Rejected</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {otherTransfers.map((transfer) => (
                  <div
                    key={transfer.id}
                    onClick={() => setSelectedTransfer(transfer)}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors opacity-60"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-900/50 rounded-lg flex items-center justify-center">
                        <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </div>
                      <div>
                        <p className="text-white font-medium">{transfer.recipient_institution}</p>
                        <p className="text-white/50 text-sm">
                          {transfer.document ? getDocumentTypeLabel(transfer.document.document_type) : 'Document'} • {formatDate(transfer.created_at)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(transfer.status)}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      ) : (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-12 text-center">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 className="text-white font-semibold text-lg mb-2">No Transfers Yet</h3>
            <p className="text-white/50 text-sm mb-4">
              You haven&apos;t shared any documents yet. Start by sharing a document with an institution.
            </p>
            <Link href="/graduate/share">
              <Button className="bg-green-600 hover:bg-green-700">
                Share Your First Document
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Transfer Details Dialog */}
      <Dialog open={!!selectedTransfer} onOpenChange={() => setSelectedTransfer(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Details</DialogTitle>
            <DialogDescription className="text-white/60">
              View transfer request information and verification codes
            </DialogDescription>
          </DialogHeader>

          {selectedTransfer && (
            <div className="space-y-4 mt-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Status</span>
                {getStatusBadge(selectedTransfer.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-white/50 mb-1">Recipient Institution</p>
                  <p className="text-white">{selectedTransfer.recipient_institution}</p>
                </div>
                <div>
                  <p className="text-white/50 mb-1">Created</p>
                  <p className="text-white">{formatDate(selectedTransfer.created_at)}</p>
                </div>
                {selectedTransfer.recipient_email && (
                  <div>
                    <p className="text-white/50 mb-1">Contact Email</p>
                    <p className="text-white">{selectedTransfer.recipient_email}</p>
                  </div>
                )}
                <div>
                  <p className="text-white/50 mb-1">Expires</p>
                  <p className="text-white">{formatDate(selectedTransfer.expires_at)}</p>
                </div>
              </div>

              {selectedTransfer.document && (
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-xs mb-2">Document</p>
                  <p className="text-white font-medium">{getDocumentTypeLabel(selectedTransfer.document.document_type)}</p>
                  <p className="text-white/60 text-sm">{selectedTransfer.document.file_name}</p>
                </div>
              )}

              {selectedTransfer.hash_code && (
                <div className="p-4 bg-green-900/20 rounded-lg border border-green-700/50">
                  <p className="text-green-300/70 text-xs mb-2">Verification Hash Code</p>
                  <div className="flex items-center justify-between">
                    <code className="text-xl font-bold text-green-400 tracking-wider">
                      {selectedTransfer.hash_code}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-green-400 hover:text-green-300"
                      onClick={() => copyToClipboard(selectedTransfer.hash_code!, 'Hash code')}
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </Button>
                  </div>
                </div>
              )}

              {selectedTransfer.qr_code && (
                <div className="text-center">
                  <p className="text-white/50 text-xs mb-2">QR Code</p>
                  <div className="p-4 bg-white rounded-lg inline-block">
                    <img 
                      src={selectedTransfer.qr_code} 
                      alt="Verification QR Code" 
                      className="w-32 h-32"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Link href={`/verify?code=${selectedTransfer.hash_code}`} className="flex-1">
                  <Button variant="outline" className="w-full border-white/20 text-white hover:bg-white/10">
                    Verify Document
                  </Button>
                </Link>
                {['pending', 'approved'].includes(selectedTransfer.status) && (
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={() => {
                      const verifyUrl = `${window.location.origin}/verify?code=${selectedTransfer.hash_code}`;
                      copyToClipboard(verifyUrl, 'Verification link');
                    }}
                  >
                    Copy Verify Link
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
