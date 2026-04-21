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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';
import type { TransferRequest } from '@/types';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
type FilterType = 'pending' | 'approved' | 'rejected' | 'all';

interface ExtendedTransferRequest extends TransferRequest {
  payment?: {
    id: string;
    amount: number;
    payment_method: string;
    payment_screenshot_url?: string;
    screenshot_uploaded_at?: string;
    status: string;
    transaction_reference?: string;
  };
  university_email?: string;
}

// ─────────────────────────────────────────────
// Status Badge helpers
// ─────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    pending:   { cls: 'bg-amber-900/50 text-amber-300 border-amber-700/50',   label: 'Pending' },
    approved:  { cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50', label: 'Approved' },
    rejected:  { cls: 'bg-red-900/50 text-red-300 border-red-700/50',         label: 'Rejected' },
    completed: { cls: 'bg-blue-900/50 text-blue-300 border-blue-700/50',      label: 'Completed' },
    expired:   { cls: 'bg-slate-700/50 text-slate-300 border-slate-600/50',   label: 'Expired' },
  };
  const c = cfg[status] ?? cfg.pending;
  return <Badge className={`${c.cls} text-xs font-semibold`}>{c.label}</Badge>;
}

function PaymentBadge({ status }: { status: string }) {
  const cfg: Record<string, { cls: string; label: string }> = {
    pending:    { cls: 'bg-amber-900/50 text-amber-300 border-amber-700/50',   label: '⏳ Awaiting' },
    processing: { cls: 'bg-blue-900/50 text-blue-300 border-blue-700/50',      label: '🔍 Review' },
    completed:  { cls: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/50', label: '✓ Paid' },
    failed:     { cls: 'bg-red-900/50 text-red-300 border-red-700/50',         label: '✗ Failed' },
  };
  const c = cfg[status] ?? cfg.pending;
  return <Badge className={`${c.cls} text-xs font-semibold`}>{c.label}</Badge>;
}

function MethodIcon({ method }: { method?: string }) {
  if (method === 'telebirr') return <span title="TeleBirr">📱</span>;
  if (method === 'cbe_birr') return <span title="CBE Birr">🏦</span>;
  return <span title="Bank Transfer">🏛️</span>;
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function RegistrarRequestsPage() {
  const [requests, setRequests] = useState<ExtendedTransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>('pending');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<ExtendedTransferRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | 'view' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState<string | null>(null);
  const [loadingScreenshot, setLoadingScreenshot] = useState(false);

  const fetchRequests = useCallback(async () => {
    try {
      const response = await axios.get(`/api/transfers/pending?status=${filter === 'all' ? '' : filter}`);
      setRequests(response.data.data || []);
    } catch {
      toast.error('Failed to load requests');
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Load screenshot signed URL when viewing a request
  const loadScreenshot = useCallback(async (paymentId: string, screenshotPath: string) => {
    setLoadingScreenshot(true);
    try {
      const response = await axios.get(`/api/payments/screenshot-url?payment_id=${paymentId}`);
      setScreenshotUrl(response.data.data?.url || null);
    } catch {
      // Fallback: try to construct URL
      setScreenshotUrl(null);
    } finally {
      setLoadingScreenshot(false);
    }
  }, []);

  const openRequest = (req: ExtendedTransferRequest, action: 'approve' | 'reject' | 'view') => {
    setSelectedRequest(req);
    setActionType(action);
    setScreenshotUrl(null);
    // Load screenshot if payment has one
    if (req.payment?.payment_screenshot_url && req.payment?.id) {
      loadScreenshot(req.payment.id, req.payment.payment_screenshot_url);
    }
  };

  const handleAction = async () => {
    if (!selectedRequest || !actionType || actionType === 'view') return;
    setIsProcessing(true);
    try {
      await axios.post(`/api/transfers/${selectedRequest.id}/${actionType}`, {
        ...(actionType === 'reject' && { reason: rejectionReason }),
      });
      toast.success(`Transfer ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason('');
      fetchRequests();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || `Failed to ${actionType} request`);
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
      req.recipient_institution.toLowerCase().includes(q)
    );
  });

  const pendingCount = requests.filter((r) => r.status === 'pending').length;
  const screenshotPendingCount = requests.filter(
    (r) => r.status === 'pending' && r.payment?.payment_screenshot_url
  ).length;

  const filterTabs: { key: FilterType; label: string }[] = [
    { key: 'pending', label: 'Pending' },
    { key: 'approved', label: 'Approved' },
    { key: 'rejected', label: 'Rejected' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Transfer Requests</h1>
          <p className="text-white/50 text-sm mt-0.5">Review payment screenshots and approve or reject document transfers</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {screenshotPendingCount > 0 && (
            <Badge className="bg-blue-900/50 text-blue-300 border-blue-700/50 text-xs">
              🔍 {screenshotPendingCount} screenshot{screenshotPendingCount > 1 ? 's' : ''} to verify
            </Badge>
          )}
          {pendingCount > 0 && (
            <Badge className="bg-amber-900/50 text-amber-300 border-amber-700/50 text-xs">
              {pendingCount} pending
            </Badge>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by name, student ID, or institution…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 flex-1"
        />
        <div className="flex gap-1 bg-white/5 border border-white/10 rounded-lg p-1 flex-shrink-0">
          {filterTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
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

      {/* Table */}
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
                const hasScreenshot = !!req.payment?.payment_screenshot_url;
                const needsReview = req.status === 'pending' && req.payment?.status === 'processing';
                return (
                  <div
                    key={req.id}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border transition-all ${
                      needsReview
                        ? 'bg-blue-900/10 border-blue-700/30 hover:border-blue-700/50'
                        : 'bg-white/5 border-white/5 hover:border-white/20'
                    }`}
                  >
                    {/* Left: graduate + document info */}
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
                            <Badge className="bg-blue-900/60 text-blue-300 border-blue-700/50 text-xs">
                              🔍 Screenshot Ready to Review
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          <span className="text-white/40 text-xs">
                            {req.document ? getDocumentTypeLabel(req.document.document_type) : 'Document'}
                          </span>
                          <span className="text-white/20 text-xs">→</span>
                          <span className="text-white/50 text-xs truncate max-w-[180px]">{req.recipient_institution}</span>
                        </div>
                      </div>
                    </div>

                    {/* Right: badges + actions */}
                    <div className="flex items-center gap-2 flex-wrap flex-shrink-0">
                      {req.payment && (
                        <div className="flex items-center gap-1.5">
                          <MethodIcon method={req.payment.payment_method} />
                          <PaymentBadge status={req.payment.status} />
                        </div>
                      )}
                      <StatusBadge status={req.status} />
                      <span className="text-white/30 text-xs hidden lg:block">{formatDate(req.created_at)}</span>

                      {/* Actions */}
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

      {/* ── Action / View Dialog ───────────────────────────────── */}
      <Dialog
        open={!!selectedRequest}
        onOpenChange={() => { setSelectedRequest(null); setActionType(null); setRejectionReason(''); setScreenshotUrl(null); }}
      >
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">
              {actionType === 'approve'
                ? '✅ Approve Transfer Request'
                : actionType === 'reject'
                ? '❌ Reject Transfer Request'
                : '🔍 Transfer Request Details'}
            </DialogTitle>
            <DialogDescription className="text-white/50 text-sm">
              {actionType === 'approve'
                ? 'Verify the payment screenshot below before approving. Once approved, the receiving university will get an email with the verification QR code.'
                : actionType === 'reject'
                ? 'Please provide a clear reason for rejection. The graduate will be notified.'
                : 'Full details of this transfer request.'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 mt-2">
              {/* Graduate + Transfer Info */}
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-4 bg-white/5 rounded-xl space-y-2.5">
                  <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">Graduate</p>
                  <InfoRow label="Name" value={selectedRequest.graduate?.user?.full_name || '—'} />
                  <InfoRow label="Student ID" value={selectedRequest.graduate?.student_id || '—'} mono />
                  {selectedRequest.graduate?.department && (
                    <InfoRow label="Department" value={selectedRequest.graduate.department} />
                  )}
                </div>
                <div className="p-4 bg-white/5 rounded-xl space-y-2.5">
                  <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">Transfer</p>
                  <InfoRow label="Document" value={selectedRequest.document ? getDocumentTypeLabel(selectedRequest.document.document_type) : '—'} />
                  <InfoRow label="Recipient" value={selectedRequest.recipient_institution} />
                  {(selectedRequest as ExtendedTransferRequest).university_email && (
                    <InfoRow label="Univ. Email" value={(selectedRequest as ExtendedTransferRequest).university_email!} />
                  )}
                  <InfoRow label="Requested" value={formatDate(selectedRequest.created_at)} />
                  <InfoRow label="Expires" value={formatDate(selectedRequest.expires_at)} />
                </div>
              </div>

              {/* Payment Info */}
              {selectedRequest.payment && (
                <div className="p-4 bg-white/5 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <p className="text-white/50 text-xs uppercase tracking-wider font-semibold">Payment</p>
                    <PaymentBadge status={selectedRequest.payment.status} />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <InfoRow label="Amount" value={`${selectedRequest.payment.amount} ETB`} />
                    <InfoRow label="Method" value={selectedRequest.payment.payment_method.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())} />
                    {selectedRequest.payment.transaction_reference && (
                      <InfoRow label="Reference" value={selectedRequest.payment.transaction_reference} mono />
                    )}
                    {selectedRequest.payment.screenshot_uploaded_at && (
                      <InfoRow label="Screenshot at" value={formatDate(selectedRequest.payment.screenshot_uploaded_at)} />
                    )}
                  </div>
                </div>
              )}

              {/* Payment Screenshot */}
              {selectedRequest.payment?.payment_screenshot_url && (
                <div className="space-y-2">
                  <p className="text-white/70 text-sm font-semibold flex items-center gap-2">
                    📸 Payment Screenshot
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-700/50 text-xs">Uploaded by Graduate</Badge>
                  </p>
                  <div className="rounded-xl border border-white/10 overflow-hidden bg-black/20">
                    {loadingScreenshot ? (
                      <div className="h-48 flex items-center justify-center">
                        <svg className="animate-spin h-8 w-8 text-white/30" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                      </div>
                    ) : screenshotUrl ? (
                      <img
                        src={screenshotUrl}
                        alt="Payment proof screenshot"
                        className="w-full max-h-80 object-contain"
                      />
                    ) : (
                      <ScreenshotFallback
                        paymentId={selectedRequest.payment.id}
                        screenshotPath={selectedRequest.payment.payment_screenshot_url}
                      />
                    )}
                  </div>
                  <p className="text-white/30 text-xs">
                    Verify that the payment amount is 500 ETB and the transaction appears successful before approving.
                  </p>
                </div>
              )}

              {/* No screenshot yet */}
              {selectedRequest.status === 'pending' && !selectedRequest.payment?.payment_screenshot_url && (
                <div className="flex items-center gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
                  <span className="text-amber-400 text-xl">⏳</span>
                  <div>
                    <p className="text-amber-300 font-medium text-sm">Waiting for Payment Screenshot</p>
                    <p className="text-amber-200/60 text-xs mt-0.5">
                      The graduate has not yet uploaded a payment screenshot. You may still approve if you have confirmed payment through other means.
                    </p>
                  </div>
                </div>
              )}

              {/* Hash code if approved */}
              {selectedRequest.hash_code && (
                <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                  <p className="text-emerald-300/60 text-xs uppercase tracking-wider font-semibold mb-2">Verification Code</p>
                  <p className="text-emerald-300 font-mono font-bold text-xl tracking-widest">{selectedRequest.hash_code}</p>
                </div>
              )}

              <Separator className="bg-white/10" />

              {/* Reject reason input */}
              {actionType === 'reject' && (
                <div className="space-y-2">
                  <Label className="text-white/70 text-sm font-medium">Rejection Reason *</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Explain why this request is being rejected (the graduate will see this message)…"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/30 min-h-[100px] text-sm"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 mt-2">
            <Button
              variant="outline"
              onClick={() => { setSelectedRequest(null); setActionType(null); setRejectionReason(''); setScreenshotUrl(null); }}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
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
                  'Confirm & Approve Transfer'
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

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function InfoRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-white/40 text-xs">{label}</span>
      <span className={`text-white text-sm text-right ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
    </div>
  );
}

function ScreenshotFallback({ paymentId, screenshotPath }: { paymentId: string; screenshotPath: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get(`/api/payments/screenshot-url?payment_id=${paymentId}`)
      .then((res) => setUrl(res.data.data?.url || null))
      .catch(() => setUrl(null))
      .finally(() => setLoading(false));
  }, [paymentId]);

  if (loading) {
    return (
      <div className="h-48 flex items-center justify-center text-white/30 text-sm">
        Loading screenshot…
      </div>
    );
  }

  if (!url) {
    return (
      <div className="h-48 flex flex-col items-center justify-center gap-2 text-white/30">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <p className="text-sm">Screenshot path: {screenshotPath}</p>
        <p className="text-xs text-white/20">Configure Supabase Storage to view inline.</p>
      </div>
    );
  }

  return <img src={url} alt="Payment screenshot" className="w-full max-h-80 object-contain" />;
}
