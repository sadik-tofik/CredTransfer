'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type FilterType = 'pending' | 'approved' | 'rejected' | 'all';

interface PaymentInfo {
  id: string;
  amount: number;
  payment_method: string;
  status: string;
  transaction_reference?: string;
  // These come pre-extracted from metadata by the API
  screenshot_data_url?: string;
  screenshot_file_name?: string;
  screenshot_uploaded_at?: string;
}

interface TransferItem {
  id: string;
  status: string;
  payment_status: string;
  payment_id?: string;
  recipient_institution: string;
  recipient_email?: string;
  university_email?: string;
  hash_code?: string;
  qr_code?: string;
  created_at: string;
  expires_at: string;
  rejection_reason?: string;
  graduate?: {
    id: string;
    student_id: string;
    graduation_year?: number;
    department?: string;
    user?: { full_name: string; email: string; phone?: string };
  };
  document?: {
    id: string;
    document_type: string;
    file_name: string;
    status: string;
    blockchain_tx_hash?: string;
  };
  payment?: PaymentInfo | null;
}

// ─────────────────────────────────────────────
// Badge helpers
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, string> = {
    pending:   'bg-amber-900/50 text-amber-300 border-amber-700/40',
    approved:  'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
    rejected:  'bg-red-900/50 text-red-300 border-red-700/40',
    completed: 'bg-blue-900/50 text-blue-300 border-blue-700/40',
    expired:   'bg-slate-700/50 text-slate-300 border-slate-600/40',
  };
  return (
    <Badge className={`${cfg[status] ?? 'bg-white/10 text-white/60'} text-xs font-semibold capitalize`}>
      {status}
    </Badge>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    pending:    { cls: 'bg-amber-900/50 text-amber-300 border-amber-700/40',      label: '⏳ Awaiting' },
    processing: { cls: 'bg-blue-900/50 text-blue-300 border-blue-700/40',         label: '🔍 Needs Review' },
    completed:  { cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40', label: '✓ Paid' },
    failed:     { cls: 'bg-red-900/50 text-red-300 border-red-700/40',             label: '✗ Failed' },
  };
  const c = cfg[status] ?? cfg.pending;
  return <Badge className={`${c.cls} text-xs font-semibold`}>{c.label}</Badge>;
}

function MethodLabel({ method }: { method?: string }) {
  if (!method) return <span className="text-white/40 text-xs">—</span>;
  const map: Record<string, string> = {
    cbe_birr:     '🏦 CBE Birr',
    telebirr:     '📱 TeleBirr',
    bank_transfer:'🏛️ Bank Transfer',
  };
  return <span className="text-white/60 text-xs">{map[method] ?? method}</span>;
}

function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <span className="text-white/40 text-xs flex-shrink-0">{label}</span>
      <span className={`text-white text-sm text-right ${mono ? 'font-mono text-xs' : 'font-medium'} max-w-[240px] truncate`}>
        {value}
      </span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Screenshot Panel — renders base64 directly
// ─────────────────────────────────────────────
function ScreenshotPanel({ payment }: { payment: PaymentInfo }) {
  const [expanded, setExpanded] = useState(false);

  if (!payment.screenshot_data_url) {
    return (
      <div className="flex items-center gap-3 p-4 bg-amber-500/8 border border-amber-500/20 rounded-xl">
        <span className="text-amber-400 text-xl flex-shrink-0">⏳</span>
        <div>
          <p className="text-amber-300 font-medium text-sm">Waiting for Payment Screenshot</p>
          <p className="text-amber-200/50 text-xs mt-0.5">
            The graduate has not yet uploaded proof of payment.
            You can still approve if you verified the payment through other means.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-white/70 text-sm font-semibold flex items-center gap-2">
          📸 Payment Screenshot
          <Badge className="bg-blue-900/50 text-blue-300 border-blue-700/40 text-xs">Uploaded by Graduate</Badge>
        </p>
        {payment.screenshot_uploaded_at && (
          <span className="text-white/30 text-xs">{formatDate(payment.screenshot_uploaded_at)}</span>
        )}
      </div>

      {/* Screenshot image — renders from base64 data-URL */}
      <div
        className={`rounded-xl border border-white/10 overflow-hidden bg-black/30 cursor-pointer transition-all ${
          expanded ? 'max-h-none' : 'max-h-72'
        }`}
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? 'Click to collapse' : 'Click to expand'}
      >
        <img
          src={payment.screenshot_data_url}
          alt={`Payment screenshot — ${payment.screenshot_file_name || 'proof of payment'}`}
          className="w-full object-contain"
          style={{ maxHeight: expanded ? '600px' : '270px' }}
        />
      </div>

      <p className="text-white/30 text-xs text-center">
        {payment.screenshot_file_name && `${payment.screenshot_file_name} · `}
        Click image to {expanded ? 'collapse' : 'expand'} · Verify amount is <strong className="text-white/50">500 ETB</strong> before approving
      </p>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function RegistrarRequestsPage() {
  const [requests, setRequests]               = useState<TransferItem[]>([]);
  const [isLoading, setIsLoading]             = useState(true);
  const [filter, setFilter]                   = useState<FilterType>('pending');
  const [search, setSearch]                   = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TransferItem | null>(null);
  const [actionType, setActionType]           = useState<'approve' | 'reject' | 'view' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing]       = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const statusParam = filter === 'all' ? '' : filter;
      const res = await axios.get(`/api/transfers/pending?status=${statusParam}&limit=100`);
      setRequests(res.data.data || []);
    } catch {
      toast.error('Failed to load transfer requests.');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const openRequest = (req: TransferItem, action: 'approve' | 'reject' | 'view') => {
    setSelectedRequest(req);
    setActionType(action);
    setRejectionReason('');
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType || actionType === 'view') return;
    setIsProcessing(true);
    try {
      await axios.post(`/api/transfers/${selectedRequest.id}/${actionType}`, {
        ...(actionType === 'reject' && { reason: rejectionReason }),
      });
      toast.success(`Transfer ${actionType === 'approve' ? 'approved ✅' : 'rejected'} successfully!`);
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      toast.error(e?.response?.data?.error || `Failed to ${actionType} request`);
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredRequests = requests.filter((req) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      req.graduate?.user?.full_name?.toLowerCase().includes(q) ||
      req.graduate?.student_id?.toLowerCase().includes(q) ||
      req.recipient_institution.toLowerCase().includes(q) ||
      req.hash_code?.toLowerCase().includes(q)
    );
  });

  const pendingCount           = requests.filter((r) => r.status === 'pending').length;
  const screenshotPendingCount = requests.filter(
    (r) => r.status === 'pending' && r.payment?.screenshot_data_url
  ).length;

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'pending',  label: 'Pending'  },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all',      label: 'All'      },
  ];

  // ─────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transfer Requests</h1>
          <p className="text-white/50 text-sm mt-0.5">
            Review payment screenshots and approve or reject document transfers
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {screenshotPendingCount > 0 && (
            <Badge className="bg-blue-900/50 text-blue-300 border-blue-700/40 text-xs">
              🔍 {screenshotPendingCount} screenshot{screenshotPendingCount > 1 ? 's' : ''} to verify
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge className="bg-amber-900/50 text-amber-300 border-amber-700/40 text-xs">
              {pendingCount} pending
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchRequests}
            className="border-white/20 text-white hover:bg-white/10 h-8 text-xs"
          >
            🔄 Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name, student ID, institution, or hash…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 flex-1"
        />
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1 flex-shrink-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                filter === tab.key
                  ? 'bg-white text-slate-900 shadow'
                  : 'text-white/50 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Request list */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">
            {filter === 'all' ? 'All Requests' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`}
            <span className="text-white/30 font-normal ml-2 text-sm">({filteredRequests.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-16 bg-white/5 rounded-lg" />)}
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white/40 font-medium">No requests found</p>
              <p className="text-white/20 text-sm mt-1">
                {filter === 'pending' ? 'No pending transfer requests at this time.' : `No ${filter} requests found.`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredRequests.map((req) => {
                const hasScreenshot = !!req.payment?.screenshot_data_url;
                const needsReview   = req.status === 'pending' && req.payment?.status === 'processing';
                return (
                  <div
                    key={req.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
                      needsReview
                        ? 'bg-blue-900/10 border-blue-700/30 hover:border-blue-600/50'
                        : 'bg-white/5 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Left */}
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg ${
                        needsReview ? 'bg-blue-800/40' : 'bg-white/10'
                      }`}>
                        {hasScreenshot ? '📸' : '📄'}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-white font-semibold text-sm">
                            {req.graduate?.user?.full_name || 'Unknown Graduate'}
                          </p>
                          <span className="text-white/30 text-xs">{req.graduate?.student_id}</span>
                          {needsReview && (
                            <Badge className="bg-blue-900/60 text-blue-300 border-blue-700/40 text-xs">
                              🔍 Screenshot Ready
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-white/40 text-xs">
                            {req.document ? getDocumentTypeLabel(req.document.document_type) : 'Document'}
                          </span>
                          <span className="text-white/20 text-xs">→</span>
                          <span className="text-white/50 text-xs truncate max-w-[160px]">
                            {req.recipient_institution}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Right */}
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      {req.payment && (
                        <>
                          <MethodLabel method={req.payment.payment_method} />
                          <PaymentBadge status={req.payment.status} />
                        </>
                      )}
                      <StatusBadge status={req.status} />
                      <span className="text-white/25 text-xs hidden lg:block">{formatDate(req.created_at)}</span>

                      {req.status === 'pending' ? (
                        <div className="flex gap-1.5">
                          <Button
                            size="sm"
                            className="bg-emerald-600 hover:bg-emerald-700 h-8 text-xs font-semibold px-3"
                            onClick={() => openRequest(req, 'approve')}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-red-700/50 text-red-400 hover:bg-red-900/20 h-8 text-xs px-3"
                            onClick={() => openRequest(req, 'reject')}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-blue-400 hover:text-blue-300 h-8 text-xs"
                          onClick={() => openRequest(req, 'view')}
                        >
                          View
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail / Action Dialog ─────────────────────────────────────────── */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={() => { setSelectedRequest(null); setActionType(null); setRejectionReason(''); }}
      >
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {actionType === 'approve' ? '✅ Approve Transfer'
                : actionType === 'reject' ? '❌ Reject Transfer'
                : '🔍 Transfer Details'}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              {actionType === 'approve'
                ? 'Verify the payment screenshot, then approve. The receiving university will be emailed the verification QR code automatically.'
                : actionType === 'reject'
                ? 'Provide a clear reason. The graduate will be notified by email.'
                : 'Full details of this transfer request.'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 mt-1">

              {/* Graduate + Transfer grid */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">Graduate</p>
                  <InfoRow label="Name"       value={selectedRequest.graduate?.user?.full_name || '—'} />
                  <InfoRow label="Student ID" value={selectedRequest.graduate?.student_id || '—'} mono />
                  {selectedRequest.graduate?.department && (
                    <InfoRow label="Department" value={selectedRequest.graduate.department} />
                  )}
                  {selectedRequest.graduate?.user?.email && (
                    <InfoRow label="Email" value={selectedRequest.graduate.user.email} />
                  )}
                </div>
                <div className="p-4 bg-white/5 rounded-xl">
                  <p className="text-white/40 text-xs uppercase tracking-wider font-semibold mb-3">Transfer</p>
                  <InfoRow label="Document"    value={selectedRequest.document ? getDocumentTypeLabel(selectedRequest.document.document_type) : '—'} />
                  <InfoRow label="Recipient"   value={selectedRequest.recipient_institution} />
                  {selectedRequest.university_email && (
                    <InfoRow label="Univ. Email" value={selectedRequest.university_email} />
                  )}
                  <InfoRow label="Requested"   value={formatDate(selectedRequest.created_at)} />
                  <InfoRow label="Expires"     value={formatDate(selectedRequest.expires_at)} />
                  <div className="flex items-center justify-between gap-4 py-1">
                    <span className="text-white/40 text-xs">Status</span>
                    <StatusBadge status={selectedRequest.status} />
                  </div>
                </div>
              </div>

              {/* Payment info */}
              {selectedRequest.payment && (
                <div className="p-4 bg-white/5 rounded-xl">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/40 text-xs uppercase tracking-wider font-semibold">Payment</p>
                    <PaymentBadge status={selectedRequest.payment.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    <InfoRow label="Amount"  value={`${selectedRequest.payment.amount} ETB`} />
                    <InfoRow label="Method"  value={
                      selectedRequest.payment.payment_method === 'cbe_birr'      ? 'CBE Birr' :
                      selectedRequest.payment.payment_method === 'telebirr'      ? 'TeleBirr' :
                      selectedRequest.payment.payment_method === 'bank_transfer' ? 'Bank Transfer' :
                      selectedRequest.payment.payment_method
                    } />
                    {selectedRequest.payment.transaction_reference && (
                      <InfoRow label="Reference" value={selectedRequest.payment.transaction_reference} mono />
                    )}
                    {selectedRequest.payment.screenshot_uploaded_at && (
                      <InfoRow label="Screenshot at" value={formatDate(selectedRequest.payment.screenshot_uploaded_at)} />
                    )}
                  </div>
                </div>
              )}

              {/* ── SCREENSHOT — rendered straight from base64 ── */}
              {selectedRequest.payment && (
                <ScreenshotPanel payment={selectedRequest.payment} />
              )}

              {/* Verification code if already approved */}
              {selectedRequest.hash_code && selectedRequest.status !== 'pending' && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
                  <p className="text-emerald-300/60 text-xs uppercase tracking-wider font-semibold mb-2">
                    Verification Code
                  </p>
                  <p className="text-emerald-300 font-mono font-bold text-xl tracking-widest">
                    {selectedRequest.hash_code}
                  </p>
                </div>
              )}

              {/* Rejection reason input */}
              {actionType === 'reject' && (
                <>
                  <Separator className="bg-white/10" />
                  <div className="space-y-2">
                    <Label className="text-white/70 text-sm font-medium">Rejection Reason *</Label>
                    <Textarea
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Explain why this request is being rejected. The graduate will see this message."
                      className="bg-white/10 border-white/20 text-white placeholder:text-white/30 min-h-[100px] text-sm"
                    />
                  </div>
                </>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => { setSelectedRequest(null); setActionType(null); setRejectionReason(''); }}
              className="border-white/20 text-white hover:bg-white/10"
            >
              {actionType === 'view' ? 'Close' : 'Cancel'}
            </Button>

            {actionType !== 'view' && (
              <Button
                onClick={handleAction}
                disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}
                className={`font-semibold ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isProcessing ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing…
                  </span>
                ) : actionType === 'approve' ? (
                  '✅ Confirm & Approve Transfer'
                ) : (
                  'Reject Request'
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
