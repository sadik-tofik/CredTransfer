'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import axios from 'axios';

interface PaymentProofUploadProps {
  paymentId: string;
  paymentMethod: string;
  onUploadSuccess: () => void;
}

export default function PaymentProofUpload({ paymentId, paymentMethod, onUploadSuccess }: PaymentProofUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [transactionReference, setTransactionReference] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Simple file upload simulation - in real app, upload to cloud storage
    setUploading(true);
    try {
      // Create a fake URL for demo purposes
      const fakeUrl = URL.createObjectURL(file);
      setScreenshotUrl(fakeUrl);
      toast.success('Screenshot uploaded successfully!');
    } catch (error) {
      toast.error('Failed to upload screenshot');
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!screenshotUrl) {
      toast.error('Please upload a payment screenshot');
      return;
    }

    setUploading(true);
    try {
      const response = await axios.post('/api/payments/upload-proof', {
        payment_id: paymentId,
        screenshot_url: screenshotUrl,
        payment_method: paymentMethod,
        transaction_reference: transactionReference,
        additional_notes: additionalNotes,
      });

      if (response.data.success) {
        toast.success('Payment proof submitted for review!');
        onUploadSuccess();
      } else {
        toast.error(response.data.error || 'Failed to submit payment proof');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to submit payment proof');
    } finally {
      setUploading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="screenshot" className="text-white">Payment Screenshot *</Label>
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            id="screenshot"
            accept="image/*"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full"
          >
            {uploading ? 'Uploading...' : 'Choose Screenshot'}
          </Button>
        </div>
        {screenshotUrl && (
          <div className="mt-2">
            <img 
              src={screenshotUrl} 
              alt="Payment screenshot" 
              className="max-w-full h-32 object-cover rounded"
            />
          </div>
        )}
      </div>

      <div>
        <Label htmlFor="transaction_reference" className="text-white">Transaction Reference</Label>
        <Input
          id="transaction_reference"
          type="text"
          value={transactionReference}
          onChange={(e) => setTransactionReference(e.target.value)}
          placeholder="Enter transaction reference number"
          className="mt-1"
        />
      </div>

      <div>
        <Label htmlFor="additional_notes" className="text-white">Additional Notes</Label>
        <Textarea
          id="additional_notes"
          value={additionalNotes}
          onChange={(e) => setAdditionalNotes(e.target.value)}
          placeholder="Any additional information about your payment"
          className="mt-1"
          rows={3}
        />
      </div>

      <Button 
        type="submit" 
        disabled={uploading || !screenshotUrl}
        className="w-full bg-green-600 hover:bg-green-700"
      >
        {uploading ? 'Submitting...' : 'Submit Payment Proof'}
      </Button>
    </form>
  );
}
