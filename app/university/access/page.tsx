'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Shield, Clock, CheckCircle } from 'lucide-react';

interface UniversityAccessResult {
  graduate: {
    id: string;
    full_name: string;
    student_id: string;
    email: string;
  };
  document: {
    id: string;
    document_type: string;
    file_name: string;
    file_url: string;
    file_hash: string;
  };
  secure_token: string;
  expires_at: string;
  download_url: string;
}

export default function UniversityAccessPage() {
  const [formData, setFormData] = useState({
    access_code: '',
    university_email: '',
    verification_code: '',
  });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UniversityAccessResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await fetch('/api/university/access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setResult(data.data);
      } else {
        setError(data.error || 'Access failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!result?.secure_token) return;

    window.open(`/university/download/${result.secure_token}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold mx-auto mb-4">
            CT
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            University Document Access
          </h1>
          <p className="text-white/60 text-lg">
            Secure portal for educational institutions to access verified academic credentials
          </p>
        </div>

        {!result ? (
          /* Access Form */
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-xl">
                Request Document Access
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <Label htmlFor="access_code" className="text-white/80 text-base">
                    Access Code
                  </Label>
                  <Input
                    id="access_code"
                    type="text"
                    placeholder="Enter access code from email"
                    value={formData.access_code}
                    onChange={(e) =>
                      setFormData({ ...formData, access_code: e.target.value })
                    }
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-base h-12"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="university_email" className="text-white/80 text-base">
                    University Email
                  </Label>
                  <Input
                    id="university_email"
                    type="email"
                    placeholder="your.university@edu"
                    value={formData.university_email}
                    onChange={(e) =>
                      setFormData({ ...formData, university_email: e.target.value })
                    }
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-base h-12"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="verification_code" className="text-white/80 text-base">
                    Verification Code
                  </Label>
                  <Input
                    id="verification_code"
                    type="text"
                    placeholder="Enter verification code"
                    value={formData.verification_code}
                    onChange={(e) =>
                      setFormData({ ...formData, verification_code: e.target.value })
                    }
                    className="bg-white/5 border-white/20 text-white placeholder:text-white/40 text-base h-12"
                    required
                  />
                </div>

                {error && (
                  <Alert className="bg-red-900/50 border-red-700 text-red-200">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg"
                  disabled={loading}
                >
                  {loading ? 'Verifying...' : 'Access Documents'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Success Result */
          <div className="space-y-6">
            <Card className="bg-green-900/20 border-green-700/50">
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">
                  Access Granted Successfully
                </h2>
                <p className="text-white/70 text-base">
                  You can now download the verified academic documents
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-8">
                <div className="flex items-center gap-4 mb-6">
                  <FileText className="w-12 h-12 text-blue-400" />
                  <div>
                    <h3 className="text-xl font-bold text-white">
                      {result.document.document_type}
                    </h3>
                    <p className="text-white/60 text-base">
                      {result.document.file_name}
                    </p>
                  </div>
                </div>

                <div className="space-y-4 mb-6">
                  <div className="flex items-center gap-3">
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                      Graduate: {result.graduate.full_name}
                    </Badge>
                    <Badge className="bg-green-900/50 text-green-300 border-green-700">
                      Student ID: {result.graduate.student_id}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>
                      Access expires: {new Date(result.expires_at).toLocaleString()}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 text-white/60 text-sm">
                    <Shield className="w-4 h-4" />
                    <span>Blockchain verified and tamper-proof</span>
                  </div>
                </div>

                <Button
                  onClick={handleDownload}
                  className="w-full bg-blue-600 hover:bg-blue-700 py-4 text-lg"
                >
                  Download Document
                </Button>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
