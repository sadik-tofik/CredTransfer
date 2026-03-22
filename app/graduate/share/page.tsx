'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { getDocumentTypeLabel } from '@/lib/utils';
import type { Document, PaymentMethod } from '@/types';

const shareSchema = z.object({
  document_id: z.string().min(1, 'Please select a document'),
  recipient_institution: z.string().min(2, 'Institution name is required'),
  recipient_email: z.string().email('Invalid email address').optional().or(z.literal('')),
  payment_method: z.enum(['telebirr', 'bank_transfer', 'cbe_birr']),
});

type ShareFormData = z.infer<typeof shareSchema>;

interface ShareResult {
  transfer_id: string;
  hash_code: string;
  qr_code: string;
  payment_reference: string;
  payment_url?: string;
  bank_details?: {
    bank_name: string;
    account_number: string;
    account_name: string;
    reference: string;
    amount: number;
  };
}

const SERVICE_FEE = 500; // ETB

export default function GraduateSharePage() {
  const searchParams = useSearchParams();
  const preselectedDoc = searchParams.get('document');
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feeCleared, setFeeCleared] = useState(false);
  const [step, setStep] = useState<'form' | 'payment' | 'success'>('form');
  const [shareResult, setShareResult] = useState<ShareResult | null>(null);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ShareFormData>({
    resolver: zodResolver(shareSchema),
    defaultValues: {
      document_id: preselectedDoc || '',
      recipient_institution: '',
      recipient_email: '',
      payment_method: 'telebirr',
    },
  });

  const selectedDocId = watch('document_id');
  const paymentMethod = watch('payment_method');
  const recipientInstitution = watch('recipient_institution');
  
  // Debug: Watch the recipient_institution field
  useEffect(() => {
    console.log('recipient_institution changed:', recipientInstitution);
  }, [recipientInstitution]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [docsRes, profileRes] = await Promise.all([
          axios.get('/api/graduate/documents'),
          axios.get('/api/graduate/profile'),
        ]);
        setDocuments(docsRes.data.data || []);
        setFeeCleared(profileRes.data.data?.fee_cleared || false);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const selectedDocument = documents.find(d => d.id === selectedDocId);

  const onSubmit = async (data: ShareFormData) => {
    setIsSubmitting(true);
    
    // Get the actual form values directly from the form as a fallback
    const formElement = document.querySelector('form') as HTMLFormElement;
    const formData = new FormData(formElement);
    const institutionValue = formData.get('recipient_institution') as string;
    
    console.log('=== FORM SUBMISSION DEBUG ===');
    console.log('React Hook Form data:', data);
    console.log('FormData value:', institutionValue);
    console.log('Form field types:', {
      document_id: typeof data.document_id,
      recipient_institution: typeof data.recipient_institution,
      recipient_email: typeof data.recipient_email,
      payment_method: typeof data.payment_method
    });
    console.log('==============================');
    
    // Use FormData value if React Hook Form value is undefined
    const finalInstitution = data.recipient_institution || institutionValue || '';
    
    if (!finalInstitution || finalInstitution.trim() === '') {
      toast.error('Institution name is required');
      setIsSubmitting(false);
      return;
    }
    
    try {
      const requestData = {
        document_id: data.document_id,
        recipient_institution: finalInstitution.trim(),
        recipient_email: data.recipient_email || '',
        payment_method: data.payment_method,
        amount: SERVICE_FEE,
      };
      
      console.log('Request data being sent:', requestData);
      
      const response = await axios.post('/api/transfers/request', requestData);
      
      setShareResult(response.data.data);
      
      if (feeCleared) {
        setStep('success');
        toast.success('Document shared successfully!');
      } else {
        setStep('payment');
      }
    } catch (error) {
      const err = error as { response?: { data?: { error?: string; details?: any } } };
      console.error('Submit error:', err.response?.data);
      console.error('Full error:', error);
      toast.error(err.response?.data?.error || 'Failed to create transfer request');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePaymentConfirm = async () => {
    if (!shareResult) return;
    
    setIsSubmitting(true);
    try {
      // For bank transfer, just move to success as it will be manually confirmed
      if (paymentMethod === 'bank_transfer') {
        setStep('success');
        toast.success('Transfer request submitted! Complete payment to receive QR code.');
        return;
      }

      // For TeleBirr, redirect to payment URL
      if (shareResult.payment_url) {
        window.location.href = shareResult.payment_url;
      } else {
        setStep('success');
      }
    } catch (error) {
      toast.error('Payment processing failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-96 w-full bg-white/10" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Share Document</h1>
        <p className="text-white/50 text-sm">
          Send your academic credentials to receiving institutions
        </p>
      </div>

      {/* Fee Status Alert */}
      {!feeCleared && (
        <Card className="bg-yellow-900/20 border-yellow-700/50">
          <CardContent className="p-4 flex items-center gap-3">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-yellow-300 font-medium">Service Fee Required</p>
              <p className="text-yellow-200/70 text-sm">
                A {SERVICE_FEE} ETB service fee is required to share documents. You can pay via TeleBirr or bank transfer.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {['Select Document', 'Payment', 'Complete'].map((label, i) => {
          const stepNum = i + 1;
          const isActive = (step === 'form' && stepNum === 1) || 
                          (step === 'payment' && stepNum === 2) || 
                          (step === 'success' && stepNum === 3);
          const isPast = (step === 'payment' && stepNum === 1) || 
                        (step === 'success' && stepNum <= 2);
          return (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isActive ? 'bg-green-600 text-white' : 
                isPast ? 'bg-green-900/50 text-green-300' : 
                'bg-white/10 text-white/40'
              }`}>
                {isPast ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : stepNum}
              </div>
              <span className={`ml-2 text-sm hidden sm:inline ${isActive ? 'text-white' : 'text-white/40'}`}>
                {label}
              </span>
              {i < 2 && <div className={`w-8 sm:w-16 h-0.5 mx-2 ${isPast ? 'bg-green-600' : 'bg-white/10'}`} />}
            </div>
          );
        })}
      </div>

      {/* Form Step */}
      {step === 'form' && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Transfer Request Details</CardTitle>
            <CardDescription className="text-white/60">
              Select the document you want to share and provide recipient details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Document Selection */}
              <div className="space-y-2">
                <Label className="text-white/80">Select Document</Label>
                <Select
                  value={selectedDocId ?? ''}
                  onValueChange={(value) => setValue('document_id', value)}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue placeholder="Choose a document to share" />
                  </SelectTrigger>
                  <SelectContent>
                    {documents.filter(d => d.status === 'active').map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        {getDocumentTypeLabel(doc.document_type)} - {doc.file_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.document_id && (
                  <p className="text-red-400 text-sm">{errors.document_id.message}</p>
                )}
              </div>

              {/* Selected Document Preview */}
              {selectedDocument && (
                <div className="p-4 bg-green-900/20 rounded-lg border border-green-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-white font-medium">{getDocumentTypeLabel(selectedDocument.document_type)}</p>
                      <p className="text-green-300/70 text-sm">{selectedDocument.file_name}</p>
                    </div>
                    {selectedDocument.blockchain_tx_hash && (
                      <Badge className="bg-purple-900/50 text-purple-300 border-purple-700">Verified</Badge>
                    )}
                  </div>
                </div>
              )}

              <Separator className="bg-white/10" />

              {/* Recipient Details */}
              <div className="space-y-4">
                <h4 className="text-white font-medium">Recipient Institution</h4>
                
                <div className="space-y-2">
                  <Label className="text-white/80">Institution Name</Label>
                  <Input
                    {...register('recipient_institution', { required: true })}
                    name="recipient_institution"
                    placeholder="e.g. Addis Ababa University"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                    onChange={(e) => {
                      console.log('Input changed:', e.target.value);
                      setValue('recipient_institution', e.target.value);
                    }}
                  />
                  {errors.recipient_institution && (
                    <p className="text-red-400 text-sm">{errors.recipient_institution.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Contact Email (Optional)</Label>
                  <Input
                    {...register('recipient_email')}
                    type="email"
                    placeholder="registrar@example.edu"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  />
                  {errors.recipient_email && (
                    <p className="text-red-400 text-sm">{errors.recipient_email.message}</p>
                  )}
                  <p className="text-white/40 text-xs">
                    If provided, the institution will receive an email with verification details
                  </p>
                </div>
              </div>

              {!feeCleared && (
                <>
                  <Separator className="bg-white/10" />

                  {/* Payment Method */}
                  <div className="space-y-4">
                    <h4 className="text-white font-medium">Payment Method</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {[
                        { value: 'telebirr', label: 'TeleBirr', icon: '📱' },
                        { value: 'bank_transfer', label: 'Bank Transfer', icon: '🏦' },
                        { value: 'cbe_birr', label: 'CBE Birr', icon: '💳' },
                      ].map((method) => (
                        <button
                          key={method.value}
                          type="button"
                          onClick={() => setValue('payment_method', method.value as PaymentMethod)}
                          className={`p-4 rounded-lg border text-center transition-all ${
                            paymentMethod === method.value
                              ? 'bg-green-900/30 border-green-500 text-white'
                              : 'bg-white/5 border-white/10 text-white/60 hover:border-white/30'
                          }`}
                        >
                          <span className="text-2xl mb-1 block">{method.icon}</span>
                          <span className="text-sm font-medium">{method.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fee Summary */}
                  <div className="p-4 bg-white/5 rounded-lg">
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Service Fee</span>
                      <span className="text-white font-bold text-lg">{SERVICE_FEE} ETB</span>
                    </div>
                  </div>
                </>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || !selectedDocId}
                className="w-full bg-green-600 hover:bg-green-700"
              >
                {isSubmitting ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </span>
                ) : feeCleared ? (
                  'Share Document'
                ) : (
                  `Continue to Payment (${SERVICE_FEE} ETB)`
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Payment Step */}
      {step === 'payment' && shareResult && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Complete Payment</CardTitle>
            <CardDescription className="text-white/60">
              Pay the service fee to receive your verification codes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {paymentMethod === 'bank_transfer' && shareResult.bank_details && (
              <div className="space-y-4">
                <div className="p-4 bg-blue-900/20 rounded-lg border border-blue-700/50">
                  <h4 className="text-blue-300 font-medium mb-3">Bank Transfer Details</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-white/60">Bank</span>
                      <span className="text-white">{shareResult.bank_details.bank_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-white/60">Account Name</span>
                      <span className="text-white">{shareResult.bank_details.account_name}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Account Number</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">{shareResult.bank_details.account_number}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-white/60 hover:text-white"
                          onClick={() => copyToClipboard(shareResult.bank_details!.account_number, 'Account number')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-white/60">Reference</span>
                      <div className="flex items-center gap-2">
                        <span className="text-white font-mono">{shareResult.payment_reference}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-white/60 hover:text-white"
                          onClick={() => copyToClipboard(shareResult.payment_reference, 'Reference')}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </Button>
                      </div>
                    </div>
                    <Separator className="bg-blue-700/50 my-2" />
                    <div className="flex justify-between">
                      <span className="text-white/60">Amount</span>
                      <span className="text-white font-bold">{shareResult.bank_details.amount} ETB</span>
                    </div>
                  </div>
                </div>
                <p className="text-white/50 text-sm text-center">
                  Include the reference number in your transfer description. Your verification codes will be sent via email once payment is confirmed.
                </p>
              </div>
            )}

            {paymentMethod === 'telebirr' && (
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-3xl">📱</span>
                </div>
                <p className="text-white">You will be redirected to TeleBirr to complete your payment.</p>
                <p className="text-white/50 text-sm">Reference: {shareResult.payment_reference}</p>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep('form')}
                className="flex-1 border-white/20 text-white hover:bg-white/10"
              >
                Back
              </Button>
              <Button
                onClick={handlePaymentConfirm}
                disabled={isSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {paymentMethod === 'bank_transfer' ? "I've Made the Transfer" : 'Pay with TeleBirr'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Step */}
      {step === 'success' && shareResult && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Transfer Request Created!</h2>
              <p className="text-white/60">
                {feeCleared 
                  ? 'Your document can now be verified using the codes below.'
                  : 'Complete your payment to receive verification codes.'}
              </p>
            </div>

            {(feeCleared || shareResult.hash_code) && (
              <div className="space-y-4">
                {/* Hash Code */}
                <div className="p-4 bg-white/5 rounded-lg">
                  <p className="text-white/50 text-sm mb-2">Verification Hash Code</p>
                  <div className="flex items-center justify-center gap-2">
                    <code className="text-2xl font-bold text-green-400 tracking-widest">
                      {shareResult.hash_code}
                    </code>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-white/60 hover:text-white"
                      onClick={() => copyToClipboard(shareResult.hash_code, 'Hash code')}
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                    </Button>
                  </div>
                </div>

                {/* QR Code */}
                {shareResult.qr_code && (
                  <div className="p-4 bg-white rounded-lg inline-block mx-auto">
                    <img 
                      src={shareResult.qr_code} 
                      alt="Verification QR Code" 
                      className="w-48 h-48"
                    />
                  </div>
                )}

                <p className="text-white/40 text-sm">
                  Share this code or QR with the receiving institution for verification at{' '}
                  <span className="text-green-400">credtransfer.ju.edu.et/verify</span>
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                onClick={() => {
                  setStep('form');
                  setShareResult(null);
                }}
                variant="outline"
                className="border-white/20 text-white hover:bg-white/10"
              >
                Share Another Document
              </Button>
              <Button
                onClick={() => window.location.href = '/graduate/transfers'}
                className="bg-green-600 hover:bg-green-700"
              >
                View Transfer History
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
