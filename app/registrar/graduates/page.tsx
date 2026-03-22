'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';
import type { Graduate, Document } from '@/types';

export default function RegistrarGraduatesPage() {
  const [graduates, setGraduates] = useState<Graduate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedGraduate, setSelectedGraduate] = useState<Graduate | null>(null);
  const [graduateDocuments, setGraduateDocuments] = useState<Document[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const fetchGraduates = async () => {
      try {
        const response = await axios.get('/api/graduates');
        setGraduates(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch graduates:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchGraduates();
  }, []);

  const handleSearch = async () => {
    if (!search.trim()) {
      const response = await axios.get('/api/graduates');
      setGraduates(response.data.data || []);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get(`/api/graduates?search=${encodeURIComponent(search)}`);
      setGraduates(response.data.data || []);
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewGraduate = async (graduate: Graduate) => {
    setSelectedGraduate(graduate);
    setIsLoadingDocuments(true);
    
    try {
      const response = await axios.get(`/api/graduates/${graduate.id}`);
      setGraduateDocuments(response.data.data?.documents || []);
    } catch (error) {
      console.error('Failed to fetch graduate details:', error);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const handleToggleFeeCleared = async (graduate: Graduate) => {
    setIsUpdating(true);
    try {
      await axios.patch(`/api/graduates/${graduate.id}`, {
        fee_cleared: !graduate.fee_cleared,
      });

      setGraduates(prev => 
        prev.map(g => g.id === graduate.id ? { ...g, fee_cleared: !g.fee_cleared } : g)
      );
      
      if (selectedGraduate?.id === graduate.id) {
        setSelectedGraduate(prev => prev ? { ...prev, fee_cleared: !prev.fee_cleared } : null);
      }

      toast.success(`Fee status updated for ${graduate.user?.full_name}`);
    } catch (error) {
      toast.error('Failed to update fee status');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredGraduates = graduates.filter(g => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      g.user?.full_name?.toLowerCase().includes(searchLower) ||
      g.student_id.toLowerCase().includes(searchLower) ||
      g.department?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Graduate Management</h1>
          <p className="text-white/50 text-sm">Search and manage graduate records</p>
        </div>
        <Badge className="bg-blue-900/50 text-blue-300 border-blue-700 px-4 py-2">
          {graduates.length} Graduate{graduates.length !== 1 ? 's' : ''}
        </Badge>
      </div>

      {/* Search */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <Input
                placeholder="Search by name, student ID, or department..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <Button onClick={handleSearch} className="bg-blue-600 hover:bg-blue-700">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Graduates Table */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">
            Graduates
            <span className="text-white/40 ml-2">({filteredGraduates.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5" />
              ))}
            </div>
          ) : filteredGraduates.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/60">Name</TableHead>
                    <TableHead className="text-white/60">Student ID</TableHead>
                    <TableHead className="text-white/60">Department</TableHead>
                    <TableHead className="text-white/60">Graduation</TableHead>
                    <TableHead className="text-white/60">Fee Status</TableHead>
                    <TableHead className="text-white/60">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredGraduates.map((graduate) => (
                    <TableRow key={graduate.id} className="border-white/10">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                            {graduate.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'GR'}
                          </div>
                          <div>
                            <p className="text-white font-medium">{graduate.user?.full_name || 'Unknown'}</p>
                            <p className="text-white/40 text-xs">{graduate.user?.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-white/80 font-mono">{graduate.student_id}</TableCell>
                      <TableCell className="text-white/80">{graduate.department || 'N/A'}</TableCell>
                      <TableCell className="text-white/80">{graduate.graduation_year || 'N/A'}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={graduate.fee_cleared}
                            onCheckedChange={() => handleToggleFeeCleared(graduate)}
                            disabled={isUpdating}
                          />
                          <Badge className={graduate.fee_cleared 
                            ? 'bg-green-900/50 text-green-300 border-green-700' 
                            : 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
                          }>
                            {graduate.fee_cleared ? 'Cleared' : 'Pending'}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300 h-8"
                            onClick={() => handleViewGraduate(graduate)}
                          >
                            View
                          </Button>
                          <Link href={`/registrar/upload?student_id=${graduate.student_id}`}>
                            <Button
                              size="sm"
                              className="bg-blue-600 hover:bg-blue-700 h-8"
                            >
                              Upload Doc
                            </Button>
                          </Link>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">No Graduates Found</h3>
              <p className="text-white/50 text-sm">
                {search ? 'No graduates match your search criteria.' : 'No graduates registered yet.'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Graduate Details Dialog */}
      <Dialog open={!!selectedGraduate} onOpenChange={() => setSelectedGraduate(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>Graduate Details</DialogTitle>
            <DialogDescription className="text-white/60">
              View graduate profile and uploaded documents
            </DialogDescription>
          </DialogHeader>

          {selectedGraduate && (
            <div className="space-y-6 py-4">
              {/* Profile Info */}
              <div className="flex items-start gap-4 p-4 bg-white/5 rounded-lg">
                <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {selectedGraduate.user?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'GR'}
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-semibold text-lg">{selectedGraduate.user?.full_name}</h3>
                  <p className="text-white/50 text-sm">{selectedGraduate.user?.email}</p>
                  <div className="flex flex-wrap gap-2 mt-2">
                    <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                      {selectedGraduate.student_id}
                    </Badge>
                    {selectedGraduate.graduation_year && (
                      <Badge className="bg-white/10 text-white/70 border-transparent">
                        Class of {selectedGraduate.graduation_year}
                      </Badge>
                    )}
                    <Badge className={selectedGraduate.fee_cleared 
                      ? 'bg-green-900/50 text-green-300 border-green-700' 
                      : 'bg-yellow-900/50 text-yellow-300 border-yellow-700'
                    }>
                      {selectedGraduate.fee_cleared ? 'Fee Cleared' : 'Fee Pending'}
                    </Badge>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-white/60 text-sm">Fee Cleared</Label>
                  <Switch
                    checked={selectedGraduate.fee_cleared}
                    onCheckedChange={() => handleToggleFeeCleared(selectedGraduate)}
                    disabled={isUpdating}
                  />
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 mb-1">Department</p>
                  <p className="text-white">{selectedGraduate.department || 'Not specified'}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 mb-1">Phone</p>
                  <p className="text-white">{selectedGraduate.user?.phone || 'Not provided'}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 mb-1">Registered</p>
                  <p className="text-white">{formatDate(selectedGraduate.created_at)}</p>
                </div>
                <div className="p-3 bg-white/5 rounded-lg">
                  <p className="text-white/50 mb-1">Email Verified</p>
                  <p className="text-white">{selectedGraduate.user?.is_verified ? 'Yes' : 'No'}</p>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h4 className="text-white font-medium mb-3">Uploaded Documents</h4>
                {isLoadingDocuments ? (
                  <div className="space-y-2">
                    {Array(3).fill(0).map((_, i) => (
                      <Skeleton key={i} className="h-12 bg-white/5" />
                    ))}
                  </div>
                ) : graduateDocuments.length > 0 ? (
                  <div className="space-y-2">
                    {graduateDocuments.map((doc) => (
                      <div key={doc.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-white font-medium">{getDocumentTypeLabel(doc.document_type)}</p>
                            <p className="text-white/40 text-xs">{formatDate(doc.uploaded_at)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {doc.blockchain_tx_hash && (
                            <Badge className="bg-purple-900/50 text-purple-300 border-purple-700 text-xs">
                              On-chain
                            </Badge>
                          )}
                          <Badge className={doc.status === 'active' 
                            ? 'bg-green-900/50 text-green-300 border-transparent' 
                            : 'bg-gray-900/50 text-gray-300 border-transparent'
                          }>
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 bg-white/5 rounded-lg">
                    <p className="text-white/40 text-sm">No documents uploaded for this graduate</p>
                    <Link href={`/registrar/upload?student_id=${selectedGraduate.student_id}`}>
                      <Button className="mt-3 bg-blue-600 hover:bg-blue-700" size="sm">
                        Upload First Document
                      </Button>
                    </Link>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <Link href={`/registrar/upload?student_id=${selectedGraduate.student_id}`} className="flex-1">
                  <Button className="w-full bg-blue-600 hover:bg-blue-700">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Upload Document
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
