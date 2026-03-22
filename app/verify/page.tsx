'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatDate, formatDateTime, getEtherscanLink, truncateHash, getDocumentTypeLabel } from '@/lib/utils';
import type { VerificationResult_Full } from '@/types';

export default function VerifyPage() {
  const searchParams = useSearchParams();
  const [code, setCode] = useState(searchParams.get('code') || searchParams.get('hash') || '');
  const [institution, setInstitution] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<VerificationResult_Full | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVerify = async (verifyCode?: string) => {
    const codeToVerify = verifyCode || code;
    if (!codeToVerify.trim()) {
      toast.error('Please enter a verification code');
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await axios.get(`/api/verifications/public/${encodeURIComponent(codeToVerify.trim())}`, {
        headers: institution ? { 'x-verifier-institution': institution } : {},
      });
      setResult(response.data.data);
    } catch {
      toast.error('Verification service unavailable. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Auto-verify if code is in URL
  useState(() => {
    const urlCode = searchParams.get('code') || searchParams.get('hash');
    if (urlCode) {
      setTimeout(() => handleVerify(urlCode), 500);
    }
  });

  const resultConfig = {
    verified: {
      bg: 'bg-green-900/30 border-green-700',
      badge: 'bg-green-500 text-white',
      icon: '✅',
      text: 'VERIFIED',
      desc: 'This document is authentic and verified on blockchain',
    },
    invalid: {
      bg: 'bg-red-900/30 border-red-700',
      badge: 'bg-red-500 text-white',
      icon: '❌',
      text: 'INVALID',
      desc: 'This document could not be verified',
    },
    suspicious: {
      bg: 'bg-yellow-900/30 border-yellow-700',
      badge: 'bg-yellow-500 text-white',
      icon: '⚠️',
      text: 'SUSPICIOUS',
      desc: 'Document found in database but not confirmed on blockchain',
    },
    revoked: {
      bg: 'bg-red-900/30 border-red-700',
      badge: 'bg-red-700 text-white',
      icon: '🚫',
      text: 'REVOKED',
      desc: 'This document has been revoked by the issuing institution',
    },
  };

  const config = result ? resultConfig[result.result] : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-500 rounded flex items-center justify-center font-bold text-white text-sm">CT</div>
            <div>
              <p className="text-white font-bold text-sm">CredTransfer</p>
              <p className="text-blue-300 text-xs">Jimma University</p>
            </div>
          </Link>
          <Badge className="bg-purple-900/50 text-purple-300 border-purple-700">
            Public Verification
          </Badge>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Document Verification</h1>
          <p className="text-white/60">
            Verify the authenticity of academic credentials from Jimma University
          </p>
        </div>

        {/* Verification Form */}
        <Card className="bg-white/5 border-white/10 mb-8">
          <CardHeader>
            <CardTitle className="text-white text-lg">Enter Verification Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Verification Code or Document Hash</Label>
              <div className="flex gap-3">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter 16-char code (e.g. ABCD1234EFGH5678) or SHA-256 hash"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-500 font-mono"
                  onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
                />
                <Button
                  onClick={() => handleVerify()}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 px-6"
                >
                  {isLoading ? (
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : (
                    'Verify'
                  )}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-white/60 text-sm">Your Institution (Optional - for audit purposes)</Label>
              <Input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="e.g. Addis Ababa University"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-500"
              />
            </div>

            <div className="flex items-center gap-4 pt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) toast.info('QR scanning coming soon. Please enter the code manually.');
                }}
              />
              <Button
                variant="outline"
                size="sm"
                className="border-white/20 text-white/60 hover:bg-white/10"
                onClick={() => fileInputRef.current?.click()}
              >
                📷 Upload QR Code
              </Button>
              <span className="text-white/30 text-xs">or scan with phone camera</span>
            </div>
          </CardContent>
        </Card>

        {/* Verification Result */}
        {result && config && (
          <Card className={`border-2 ${config.bg} mb-6`}>
            <CardContent className="p-8">
              {/* Status Badge */}
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">{config.icon}</div>
                <div className={`inline-block px-8 py-3 rounded-full text-2xl font-bold ${config.badge} shadow-lg`}>
                  {config.text}
                </div>
                <p className="text-white/70 mt-3 text-lg">{config.desc}</p>
              </div>

              <Separator className="bg-white/10 my-6" />

              {result.document && result.graduate && (
                <div className="grid md:grid-cols-2 gap-8">
                  {/* Graduate Info */}
                  <div>
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      🎓 Graduate Information
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Full Name" value={result.graduate.full_name} />
                      <InfoRow label="Student ID" value={result.graduate.student_id} mono />
                      {result.graduate.department && (
                        <InfoRow label="Department" value={result.graduate.department} />
                      )}
                      {result.graduate.graduation_year && (
                        <InfoRow label="Graduation Year" value={result.graduate.graduation_year.toString()} />
                      )}
                    </div>
                  </div>

                  {/* Document Info */}
                  <div>
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      📄 Document Information
                    </h3>
                    <div className="space-y-3">
                      <InfoRow label="Document Type" value={getDocumentTypeLabel(result.document.document_type)} />
                      <InfoRow label="File Name" value={result.document.file_name} />
                      <InfoRow label="Upload Date" value={formatDate(result.document.uploaded_at)} />
                      <InfoRow label="SHA-256 Hash" value={truncateHash(result.document.file_hash, 8, 6)} mono />
                    </div>
                  </div>
                </div>
              )}

              {/* Blockchain Proof */}
              {result.blockchain && result.result === 'verified' && (
                <>
                  <Separator className="bg-white/10 my-6" />
                  <div>
                    <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                      ⛓️ Blockchain Proof
                    </h3>
                    <div className="bg-black/30 rounded-lg p-4 space-y-3">
                      <InfoRow label="Network" value={result.blockchain.network?.toUpperCase() || 'SEPOLIA'} badge />
                      {result.blockchain.tx_hash && (
                        <div className="flex items-center justify-between">
                          <span className="text-white/50 text-sm">Transaction Hash</span>
                          <a
                            href={getEtherscanLink(result.blockchain.tx_hash, result.blockchain.network)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm font-mono"
                          >
                            {truncateHash(result.blockchain.tx_hash, 10, 8)} ↗
                          </a>
                        </div>
                      )}
                      {result.blockchain.block_number && (
                        <InfoRow label="Block Number" value={result.blockchain.block_number.toString()} mono />
                      )}
                      {result.blockchain.timestamp && (
                        <InfoRow
                          label="Stored On"
                          value={formatDateTime(new Date(result.blockchain.timestamp * 1000).toISOString())}
                        />
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Transfer Info */}
              {(result as { transfer?: { recipient_institution: string; expires_at: string } }).transfer && (
                <>
                  <Separator className="bg-white/10 my-6" />
                  <div>
                    <h3 className="text-white font-semibold mb-4">📤 Transfer Details</h3>
                    <div className="space-y-3">
                      <InfoRow
                        label="Shared With"
                        value={(result as { transfer?: { recipient_institution: string } }).transfer?.recipient_institution || ''}
                      />
                      <InfoRow
                        label="Valid Until"
                        value={formatDate((result as { transfer?: { expires_at: string } }).transfer?.expires_at || '')}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Issuer */}
              <Separator className="bg-white/10 my-6" />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold">JU</div>
                  <div>
                    <p className="text-white font-medium">Jimma University</p>
                    <p className="text-white/50 text-sm">Academic Registrar&apos;s Office, Ethiopia</p>
                  </div>
                </div>
                <Badge className="bg-green-900/50 text-green-300 border-green-700">Official Issuer</Badge>
              </div>
            </CardContent>
          </Card>
        )}

        {/* How to verify */}
        {!result && (
          <div className="grid md:grid-cols-3 gap-4 mt-8">
            {[
              { icon: '🔑', title: 'Hash Code', desc: 'Enter the 16-character alphanumeric code from your document' },
              { icon: '📷', title: 'QR Code', desc: 'Upload or scan the QR code attached to the document' },
              { icon: '🔗', title: 'Document Hash', desc: 'Enter the full SHA-256 hash of the document file' },
            ].map((item) => (
              <Card key={item.title} className="bg-white/5 border-white/10 p-4 text-center">
                <CardContent className="p-0">
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <h4 className="text-white font-medium mb-1">{item.title}</h4>
                  <p className="text-white/50 text-xs">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function InfoRow({
  label,
  value,
  mono = false,
  badge = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
  badge?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/50 text-sm whitespace-nowrap">{label}</span>
      {badge ? (
        <Badge className="bg-blue-900/50 text-blue-300 border-blue-700 text-xs">{value}</Badge>
      ) : (
        <span className={`text-white text-sm text-right ${mono ? 'font-mono' : ''}`}>{value}</span>
      )}
    </div>
  );
}
