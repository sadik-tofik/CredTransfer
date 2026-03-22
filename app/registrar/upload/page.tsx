'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
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
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatBytes, getDocumentTypeLabel } from '@/lib/utils';
import type { Graduate, DocumentType } from '@/types';

const uploadSchema = z.object({
  document_type: z.enum(['diploma', 'transcript', 'fee_clearance', 'other']),
});

type UploadFormData = z.infer<typeof uploadSchema>;

interface UploadResult {
  document_id: string;
  file_hash: string;
  blockchain_tx_hash?: string;
  qr_code?: string;
}

const DOCUMENT_TYPES: { value: DocumentType; label: string }[] = [
  { value: 'diploma', label: 'Diploma' },
  { value: 'transcript', label: 'Academic Transcript' },
  { value: 'fee_clearance', label: 'Fee Clearance Certificate' },
  { value: 'other', label: 'Other Document' },
];

export default function RegistrarUploadPage() {
  const [step, setStep] = useState<'search' | 'upload' | 'processing' | 'success'>('search');
  const [studentId, setStudentId] = useState('');
  const [graduate, setGraduate] = useState<Graduate | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  
  const [file, setFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);

  const {
    setValue,
    watch,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      document_type: 'diploma',
    },
  });

  const documentType = watch('document_type');

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    multiple: false,
  });

  const handleSearch = async () => {
    if (!studentId.trim()) {
      setSearchError('Please enter a student ID');
      return;
    }

    setIsSearching(true);
    setSearchError('');
    setGraduate(null);

    try {
      const response = await axios.get(`/api/graduates?student_id=${encodeURIComponent(studentId.trim())}`);
      const graduates = response.data.data || [];
      
      if (graduates.length > 0) {
        setGraduate(graduates[0]);
        setStep('upload');
      } else {
        setSearchError('No graduate found with this Student ID. Please verify the ID and try again.');
      }
    } catch (error) {
      setSearchError('Failed to search for graduate. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleUpload = async () => {
    if (!file || !graduate) return;

    setIsUploading(true);
    setStep('processing');
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('graduate_id', graduate.id);
      formData.append('document_type', documentType);

      const response = await axios.post('/api/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = progressEvent.total 
            ? Math.round((progressEvent.loaded * 100) / progressEvent.total)
            : 0;
          setUploadProgress(percent);
        },
      });

      setUploadResult(response.data.data);
      setStep('success');
      toast.success('Document uploaded and hashed successfully!');
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Upload failed. Please try again.');
      setStep('upload');
    } finally {
      setIsUploading(false);
    }
  };

  const resetForm = () => {
    setStep('search');
    setStudentId('');
    setGraduate(null);
    setFile(null);
    setUploadProgress(0);
    setUploadResult(null);
    setValue('document_type', 'diploma');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Upload Document</h1>
        <p className="text-white/50 text-sm">
          Upload academic documents for graduates. Documents are hashed and stored on blockchain.
        </p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {['Search Graduate', 'Upload File', 'Processing', 'Complete'].map((label, i) => {
          const stepNum = i + 1;
          const stepMap = { search: 1, upload: 2, processing: 3, success: 4 };
          const currentStep = stepMap[step];
          const isActive = currentStep === stepNum;
          const isPast = currentStep > stepNum;
          
          return (
            <div key={label} className="flex items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                isActive ? 'bg-blue-600 text-white' : 
                isPast ? 'bg-blue-900/50 text-blue-300' : 
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
              {i < 3 && <div className={`w-8 sm:w-16 h-0.5 mx-2 ${isPast ? 'bg-blue-600' : 'bg-white/10'}`} />}
            </div>
          );
        })}
      </div>

      {/* Step 1: Search Graduate */}
      {step === 'search' && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Find Graduate</CardTitle>
            <CardDescription className="text-white/60">
              Enter the student ID to find the graduate&apos;s record
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1">
                <Input
                  value={studentId}
                  onChange={(e) => setStudentId(e.target.value)}
                  placeholder="Enter Student ID (e.g., JU/1234/15)"
                  className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={isSearching}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isSearching ? (
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Search
                  </>
                )}
              </Button>
            </div>

            {searchError && (
              <Alert className="bg-red-900/30 border-red-700 text-red-300">
                <AlertDescription>{searchError}</AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 2: Upload File */}
      {step === 'upload' && graduate && (
        <div className="space-y-6">
          {/* Graduate Info Card */}
          <Card className="bg-gradient-to-r from-blue-900/30 to-blue-800/20 border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                    {graduate.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'GR'}
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-lg">{graduate.user?.full_name || 'Graduate'}</h3>
                    <p className="text-blue-300/70 text-sm">{graduate.department}</p>
                    <div className="flex items-center gap-4 mt-1 text-white/50 text-xs">
                      <span>ID: {graduate.student_id}</span>
                      <span>Class of {graduate.graduation_year}</span>
                      {graduate.fee_cleared ? (
                        <Badge className="bg-green-900/50 text-green-300 border-green-700 text-xs">Fee Cleared</Badge>
                      ) : (
                        <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700 text-xs">Fee Pending</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('search')}
                  className="text-blue-400 hover:text-blue-300"
                >
                  Change Graduate
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Upload Form */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Upload Document</CardTitle>
              <CardDescription className="text-white/60">
                Select document type and upload the file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Document Type */}
              <div className="space-y-2">
                <Label className="text-white/80">Document Type</Label>
                <Select
                  value={documentType}
                  onValueChange={(value) => setValue('document_type', value as DocumentType)}
                >
                  <SelectTrigger className="bg-white/10 border-white/20 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOCUMENT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.document_type && (
                  <p className="text-red-400 text-sm">{errors.document_type.message}</p>
                )}
              </div>

              {/* Dropzone */}
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-900/20'
                    : file
                    ? 'border-green-500 bg-green-900/20'
                    : 'border-white/20 hover:border-white/40'
                }`}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-green-900/50 rounded-lg flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <p className="text-white font-medium">{file.name}</p>
                    <p className="text-white/50 text-sm">{formatBytes(file.size)}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-red-400 hover:text-red-300"
                    >
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center mx-auto">
                      <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <p className="text-white">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop a file here, or click to select'}
                    </p>
                    <p className="text-white/40 text-sm">PDF, PNG, JPEG up to 10MB</p>
                  </div>
                )}
              </div>

              <Separator className="bg-white/10" />

              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => setStep('search')}
                  className="flex-1 border-white/20 text-white hover:bg-white/10"
                >
                  Back
                </Button>
                <Button
                  onClick={handleUpload}
                  disabled={!file || isUploading}
                  className="flex-1 bg-blue-600 hover:bg-blue-700"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Upload & Hash
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === 'processing' && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-12 text-center space-y-6">
            <div className="w-20 h-20 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-blue-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white mb-2">Processing Document</h2>
              <p className="text-white/60">Please wait while we upload and hash your document...</p>
            </div>
            <div className="max-w-xs mx-auto space-y-2">
              <Progress value={uploadProgress} className="h-2" />
              <p className="text-white/40 text-sm">{uploadProgress}% complete</p>
            </div>
            <div className="text-white/40 text-xs space-y-1">
              <p>1. Uploading file to secure storage...</p>
              <p>2. Computing SHA-256 hash...</p>
              <p>3. Storing hash on blockchain...</p>
              <p>4. Generating QR code...</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Success */}
      {step === 'success' && uploadResult && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-8 text-center space-y-6">
            <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-10 h-10 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>

            <div>
              <h2 className="text-2xl font-bold text-white mb-2">Document Uploaded Successfully!</h2>
              <p className="text-white/60">
                The document has been hashed and {uploadResult.blockchain_tx_hash ? 'stored on blockchain' : 'saved to database'}
              </p>
            </div>

            {/* Hash Info */}
            <div className="p-4 bg-white/5 rounded-lg text-left">
              <p className="text-white/50 text-xs mb-2">Document Hash (SHA-256)</p>
              <code className="text-green-400 text-sm break-all">{uploadResult.file_hash}</code>
            </div>

            {/* Blockchain Info */}
            {uploadResult.blockchain_tx_hash && (
              <div className="p-4 bg-purple-900/20 rounded-lg border border-purple-700/50 text-left">
                <div className="flex items-center gap-2 mb-2">
                  <svg className="w-5 h-5 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101" />
                  </svg>
                  <span className="text-purple-300 font-medium">Blockchain Verified</span>
                </div>
                <p className="text-white/50 text-xs mb-1">Transaction Hash</p>
                <a
                  href={`https://sepolia.etherscan.io/tx/${uploadResult.blockchain_tx_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-purple-400 hover:text-purple-300 text-sm break-all"
                >
                  {uploadResult.blockchain_tx_hash}
                </a>
              </div>
            )}

            {/* QR Code */}
            {uploadResult.qr_code && (
              <div>
                <p className="text-white/50 text-sm mb-3">Verification QR Code</p>
                <div className="p-4 bg-white rounded-lg inline-block">
                  <img 
                    src={uploadResult.qr_code} 
                    alt="Document QR Code" 
                    className="w-48 h-48"
                  />
                </div>
                <p className="text-white/40 text-xs mt-2">
                  Print this QR code and attach to the physical document
                </p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 justify-center pt-4">
              <Button
                onClick={resetForm}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Upload Another Document
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/registrar/dashboard'}
                className="border-white/20 text-white hover:bg-white/10"
              >
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
