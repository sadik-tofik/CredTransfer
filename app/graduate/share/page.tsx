'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getDocumentTypeLabel } from '@/lib/utils';
import type { Document } from '@/types';

const shareSchema = z.object({
  document_id: z.string().min(1, 'Please select a document'),
  recipient_institution: z.string().min(2, 'Institution name is required'),
  recipient_email: z.string().email('Invalid email').optional().or(z.literal('')),
  university_email: z.string().email('A valid university email is required'),
  payment_method: z.enum(['cbe_birr', 'telebirr', 'bank_transfer']),
});
type ShareFormData = z.infer<typeof shareSchema>;

const SERVICE_FEE = 500;

const PAYMENT_ACCOUNTS = {
  cbe_birr: {
    label: 'CBE Birr',
    icon: '🏦',
    instructions: 'Send exactly 500 ETB to the CBE Birr account below, then take a screenshot.',
    fields: [
      { label: 'Account Name', value: 'Jimma University – CredTransfer', copyable: false },
      { label: 'CBE Account Number', value: '1000547823614', copyable: true },
      { label: 'Amount', value: '500 ETB', copyable: false },
    ],
  },
  telebirr: {
    label: 'TeleBirr',
    icon: '📱',
    instructions: 'Send exactly 500 ETB to the TeleBirr number below, then take a screenshot.',
    fields: [
      { label: 'Account Name', value: 'Jimma University – CredTransfer', copyable: false },
      { label: 'TeleBirr Number', value: '0912345678', copyable: true },
      { label: 'Amount', value: '500 ETB', copyable: false },
    ],
  },
  bank_transfer: {
    label: 'Bank Transfer',
    icon: '🏛️',
    instructions: 'Wire 500 ETB to the account below. Include the reference number in the description.',
    fields: [
      { label: 'Bank', value: 'Commercial Bank of Ethiopia', copyable: false },
      { label: 'Account Name', value: 'Jimma University – CredTransfer', copyable: false },
      { label: 'Account Number', value: '1000547823614', copyable: true },
      { label: 'Branch', value: 'Jimma Main Branch', copyable: false },
    ],
  },
};

// ─────────────────────────────────────────────
// Step Indicator
// ─────────────────────────────────────────────
function StepIndicator({ step }: { step: 'form' | 'payment' | 'success' }) {
  const steps = ['Request Details', 'Payment', 'Complete'];
  const current = step === 'form' ? 0 : step === 'payment' ? 1 : 2;
  return (
    <div className="flex items-center">
      {steps.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-semibold border-2 transition-all ${
                i < current
                  ? 'bg-emerald-500 border-emerald-500 text-white'
                  : i === current
                  ? 'bg-white border-white text-slate-900'
                  : 'bg-transparent border-white/20 text-white/30'
              }`}
            >
              {i < current ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`text-xs font-medium hidden sm:block ${i === current ? 'text-white' : 'text-white/30'}`}>
              {label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`w-12 sm:w-20 h-px mx-2 mb-5 transition-all ${i < current ? 'bg-emerald-500' : 'bg-white/10'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────
// Copyable Field
// ─────────────────────────────────────────────
function CopyableRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-white/50 text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <span className="text-white font-mono font-semibold text-sm">{value}</span>
        <button onClick={copy} className="p-1 rounded text-white/30 hover:text-white hover:bg-white/10 transition-colors" title="Copy">
          {copied
            ? <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
            : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          }
        </button>
      </div>
    </div>
  );
}

function PlainRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-white/5 last:border-0">
      <span className="text-white/50 text-sm">{label}</span>
      <span className="text-white text-sm font-medium">{value}</span>
    </div>
  );
}

// ─────────────────────────────────────────────
// Screenshot Upload Component
// ─────────────────────────────────────────────
function ScreenshotUpload({
  transferId,
  paymentId,
  onUploaded,
}: {
  transferId: string;
  paymentId: string;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (!f.type.startsWith('image/')) { toast.error('Please upload an image file'); return; }
    if (f.size > 5 * 1024 * 1024) { toast.error('Max file size is 5 MB'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  };

  const handleSubmit = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('screenshot', file);
      formData.append('transfer_id', transferId);
      formData.append('payment_id', paymentId);
      await axios.post('/api/payments/upload-screenshot', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploaded(true);
      toast.success('Screenshot uploaded! Awaiting registrar verification.');
      onUploaded();
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Upload failed. Try again.');
    } finally {
      setUploading(false);
    }
  };

  if (uploaded) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center">
          <svg className="w-7 h-7 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
        </div>
        <p className="text-emerald-400 font-semibold">Screenshot Submitted Successfully</p>
        <p className="text-white/50 text-sm max-w-sm">
          The registrar will review your payment proof and approve the transfer. You will receive an email notification.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <p className="text-white font-medium text-sm mb-1">Upload Payment Screenshot *</p>
        <p className="text-white/40 text-xs">
          Take a clear screenshot of the successful transaction confirmation and upload it below.
        </p>
      </div>

      <div
        onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl cursor-pointer transition-all ${
          preview ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-white/20 bg-white/5 hover:border-white/40 hover:bg-white/8'
        }`}
      >
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])} />
        {preview ? (
          <div className="p-3">
            <img src={preview} alt="Preview" className="w-full max-h-56 object-contain rounded-lg" />
            <p className="text-center text-emerald-400 text-xs mt-2 font-medium">✓ {file?.name} — Click to change</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3 py-10 px-4">
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-white/60 text-sm font-medium">Drag & drop or click to upload</p>
              <p className="text-white/30 text-xs mt-1">PNG, JPG, JPEG — max 5 MB</p>
            </div>
          </div>
        )}
      </div>

      <Button onClick={handleSubmit} disabled={!file || uploading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 font-semibold">
        {uploading ? (
          <span className="flex items-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
            Uploading…
          </span>
        ) : 'Submit Screenshot for Verification'}
      </Button>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Page
// ─────────────────────────────────────────────
export default function GraduateSharePage() {
  const searchParams = useSearchParams();
  const preselectedDoc = searchParams.get('document');

  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feeCleared, setFeeCleared] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [screenshotDone, setScreenshotDone] = useState(false);
  const [shareResult, setShareResult] = useState<{
    transfer_id: string;
    payment_id: string;
    hash_code: string;
    qr_code: string;
    payment_reference: string;
  } | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<ShareFormData>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      document_id: preselectedDoc || '',
      recipient_institution: '',
      recipient_email: '',
      university_email: '',
      payment_method: 'cbe_birr',
    },
  });

  const selectedDocId = watch('document_id');
  const paymentMethod = watch('payment_method') as keyof typeof PAYMENT_ACCOUNTS;
  const selectedDocument = documents.find((d) => d.id === selectedDocId);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, profileRes] = await Promise.all([
          axios.get('/api/graduate/documents'),
          axios.get('/api/graduate/profile'),
        ]);
        setDocuments(docsRes.data.data || []);
        setFeeCleared(profileRes.data.data?.fee_cleared || false);
      } catch {
        toast.error('Failed to load data. Please refresh.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const onSubmit = async (data: ShareFormData) => {
    setIsSubmitting(true);
    try {
      const response = await axios.post('/api/transfers/request', {
        document_id: data.document_id,
        recipient_institution: data.recipient_institution.trim(),
        recipient_email: data.recipient_email || '',
        university_email: data.university_email.trim(),
        payment_method: data.payment_method,
        amount: SERVICE_FEE,
      });
      setShareResult(response.data.data);
      if (feeCleared) { setStep('success'); toast.success('Transfer request submitted!'); }
      else { setStep('payment'); }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      toast.error(error?.response?.data?.error || 'Failed to submit request');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-5">
        <Skeleton className="h-8 w-52 bg-white/10" />
        <Skeleton className="h-4 w-80 bg-white/10" />
        <Skeleton className="h-[480px] bg-white/10 rounded-2xl" />
      </div>
    );
  }

  // ────────────────────── STEP 1: FORM ──────────────────────
  if (step === 'form') {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Request Document Transfer</h1>
          <p className="text-white/50 text-sm mt-1">Share your academic credentials with a receiving institution</p>
        </div>

        <StepIndicator step="form" />

        {!feeCleared && (
          <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/25 rounded-xl">
            <span className="text-amber-400 text-lg flex-shrink-0">ℹ️</span>
            <div>
              <p className="text-amber-300 font-semibold text-sm">Service Fee Required: {SERVICE_FEE} ETB</p>
              <p className="text-amber-200/60 text-xs mt-0.5">
                A one-time fee is needed to process the transfer. Payment instructions appear in the next step.
              </p>
            </div>
          </div>
        )}

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-6">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Document */}
              <div className="space-y-2">
                <Label className="text-white/70 text-xs uppercase tracking-wider font-semibold">Select Document *</Label>
                <Select value={selectedDocId ?? ''} onValueChange={(v) => setValue('document_id', v)}>
                  <SelectTrigger className="bg-white/10 border-white/20 text-white h-11">
                    <SelectValue placeholder="Choose a document to transfer…" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.filter((d) => d.status === 'active').map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {getDocumentTypeLabel(doc.document_type)} — {doc.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.document_id && <p className="text-red-400 text-xs">{errors.document_id.message}</p>}

                {selectedDocument && (
                  <div className="flex items-center gap-3 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg mt-2">
                    <div className="w-9 h-9 bg-emerald-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium">{getDocumentTypeLabel(selectedDocument.document_type)}</p>
                      <p className="text-white/40 text-xs truncate">{selectedDocument.file_name}</p>
                    </div>
                    {selectedDocument.blockchain_tx_hash && (
                      <Badge className="bg-purple-900/50 text-purple-300 border-purple-700/50 text-xs flex-shrink-0">⛓️ On-chain</Badge>
                    )}
                  </div>
                )}
              </div>

              <Separator className="bg-white/10" />

              {/* Recipient */}
              <div className="space-y-4">
                <p className="text-white font-semibold text-sm">Receiving Institution</p>

                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs uppercase tracking-wider">Institution Name *</Label>
                  <input
                    {...register('recipient_institution')}
                    type="text"
                    placeholder="e.g. Addis Ababa University"
                    className="w-full h-11 px-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                  {errors.recipient_institution && <p className="text-red-400 text-xs">{errors.recipient_institution.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs uppercase tracking-wider">University Official Email *</Label>
                  <input
                    {...register('university_email')}
                    type="email"
                    placeholder="admissions@aau.edu.et"
                    className="w-full h-11 px-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                  {errors.university_email && <p className="text-red-400 text-xs">{errors.university_email.message}</p>}
                  <p className="text-white/30 text-xs">
                    The receiving university will get an email with the verification QR code and hash once approved.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-white/60 text-xs uppercase tracking-wider">Contact Email (Optional)</Label>
                  <input
                    {...register('recipient_email')}
                    type="email"
                    placeholder="registrar@example.edu"
                    className="w-full h-11 px-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder:text-white/30 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/30 transition-all"
                  />
                </div>
              </div>

              {/* Payment method */}
              {!feeCleared && (
                <>
                  <Separator className="bg-white/10" />
                  <div className="space-y-3">
                    <p className="text-white font-semibold text-sm">Payment Method</p>
                    <div className="grid grid-cols-3 gap-3">
                      {(Object.keys(PAYMENT_ACCOUNTS) as Array<keyof typeof PAYMENT_ACCOUNTS>).map((method) => {
                        const info = PAYMENT_ACCOUNTS[method];
                        const isSelected = paymentMethod === method;
                        return (
                          <button
                            key={method}
                            type="button"
                            onClick={() => setValue('payment_method', method)}
                            className={`p-3 rounded-xl border text-center transition-all duration-150 ${
                              isSelected
                                ? 'bg-emerald-500/15 border-emerald-500 text-white shadow-lg shadow-emerald-500/10'
                                : 'bg-white/5 border-white/10 text-white/50 hover:border-white/30 hover:text-white/80'
                            }`}
                          >
                            <span className="text-2xl block mb-1">{info.icon}</span>
                            <span className="text-xs font-semibold">{info.label}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between items-center p-3 bg-white/5 rounded-lg border border-white/5">
                      <span className="text-white/60 text-sm">Service Fee</span>
                      <span className="text-white font-bold text-base">{SERVICE_FEE} ETB</span>
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !selectedDocId}
                className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 font-semibold disabled:opacity-40 transition-all"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    Creating Request…
                  </span>
                ) : feeCleared ? 'Submit Transfer Request →' : `Continue to Payment (${SERVICE_FEE} ETB) →`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ────────────────────── STEP 2: PAYMENT ──────────────────────
  if (step === 'payment' && shareResult) {
    const info = PAYMENT_ACCOUNTS[paymentMethod];
    const reference = shareResult.payment_reference;

    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Complete Payment</h1>
          <p className="text-white/50 text-sm mt-1">Send {SERVICE_FEE} ETB via {info.label}, then upload your screenshot</p>
        </div>

        <StepIndicator step="payment" />

        {/* Payment details card */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <span className="text-xl">{info.icon}</span> {info.label} — Payment Details
            </CardTitle>
            <CardDescription className="text-white/50 text-sm">{info.instructions}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-0">
            {info.fields.map((f) =>
              f.copyable
                ? <CopyableRow key={f.label} label={f.label} value={f.value} />
                : <PlainRow key={f.label} label={f.label} value={f.value} />
            )}
            {/* Reference number always copyable */}
            <div className="flex items-center justify-between py-2.5 mt-1 bg-amber-500/10 rounded-lg px-3">
              <span className="text-amber-300/80 text-sm font-medium">Payment Reference</span>
              <div className="flex items-center gap-2">
                <span className="text-amber-300 font-mono font-bold text-sm">{reference}</span>
                <button
                  onClick={() => { navigator.clipboard.writeText(reference); toast.success('Reference copied!'); }}
                  className="p-1 rounded text-amber-300/50 hover:text-amber-300 hover:bg-amber-500/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                </button>
              </div>
            </div>
            {paymentMethod === 'bank_transfer' && (
              <p className="text-amber-300/60 text-xs pt-3">⚠️ You must include the reference number in your bank transfer description for the registrar to match your payment.</p>
            )}
          </CardContent>
        </Card>

        {/* Screenshot upload card */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Upload Payment Proof</CardTitle>
            <CardDescription className="text-white/50 text-sm">
              After completing the payment, upload a screenshot of the confirmation screen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScreenshotUpload
              transferId={shareResult.transfer_id}
              paymentId={shareResult.payment_id}
              onUploaded={() => setScreenshotDone(true)}
            />
          </CardContent>
        </Card>

        {screenshotDone && (
          <Button onClick={() => setStep('success')} className="w-full bg-emerald-600 hover:bg-emerald-700 font-semibold">
            View Transfer Status →
          </Button>
        )}

        <button onClick={() => setStep('form')} className="w-full text-white/30 hover:text-white/60 text-sm transition-colors py-2">
          ← Back to form
        </button>
      </div>
    );
  }

  // ────────────────────── STEP 3: SUCCESS ──────────────────────
  if (step === 'success' && shareResult) {
    return (
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <StepIndicator step="success" />

        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">
                {feeCleared ? 'Transfer Request Submitted!' : 'Payment Proof Received!'}
              </h2>
              <p className="text-white/60 text-sm leading-relaxed">
                {feeCleared
                  ? 'Your transfer request is under review. You will be notified via email once approved.'
                  : 'The registrar will verify your payment and approve the transfer. You will receive an email when approved.'}
              </p>
            </div>

            {/* Timeline */}
            <div className="text-left space-y-3 p-4 bg-white/5 rounded-xl">
              <p className="text-white/70 text-sm font-semibold mb-3">What happens next</p>
              {[
                { text: feeCleared ? 'Transfer request created' : 'Payment screenshot submitted', done: true },
                { text: 'Registrar verifies payment and approves request', done: false },
                { text: 'Receiving university receives email with QR code and verification hash', done: false },
                { text: 'You can view your verification codes in Transfer History', done: false },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5 ${item.done ? 'bg-emerald-500 text-white' : 'bg-white/10 text-white/30'}`}>
                    {item.done ? '✓' : i + 1}
                  </div>
                  <p className={`text-sm ${item.done ? 'text-white/80' : 'text-white/50'}`}>{item.text}</p>
                </div>
              ))}
            </div>

            {feeCleared && shareResult.hash_code && (
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/25 rounded-xl">
                <p className="text-emerald-300/60 text-xs uppercase tracking-wider font-semibold mb-2">Verification Code</p>
                <p className="text-emerald-300 font-mono font-bold text-2xl tracking-widest">{shareResult.hash_code}</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                variant="outline"
                onClick={() => { setStep('form'); setShareResult(null); setScreenshotDone(false); }}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                New Transfer
              </Button>
              <Button
                onClick={() => (window.location.href = '/graduate/transfers')}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              >
                View Transfer History
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
