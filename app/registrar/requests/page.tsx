'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';
import type { TransferRequest } from '@/types';

export default function RegistrarRequestsPage() {
  const [requests, setRequests] = useState<TransferRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'approved' | 'rejected'>('pending');
  const [search, setSearch] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<TransferRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const fetchRequests = async () => {
    try {
      const response = await axios.get(`/api/transfers/pending?status=${filter === 'all' ? '' : filter}`);
      setRequests(response.data.data || []);
    } catch (error) {
      console.error('Failed to fetch requests:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [filter]);

  const handleAction = async () => {
    if (!selectedRequest || !actionType) return;

    setIsProcessing(true);
    try {
      const endpoint = `/api/transfers/${selectedRequest.id}/${actionType}`;
      await axios.post(endpoint, {
        ...(actionType === 'reject' && { reason: rejectionReason }),
      });

      toast.success(`Transfer request ${actionType === 'approve' ? 'approved' : 'rejected'} successfully!`);
      setSelectedRequest(null);
      setActionType(null);
      setRejectionReason('');
      fetchRequests();
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || `Failed to ${actionType} request`);
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
      approved: { bg: 'bg-green-900/50', text: 'text-green-300' },
      rejected: { bg: 'bg-red-900/50', text: 'text-red-300' },
      completed: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
      expired: { bg: 'bg-gray-900/50', text: 'text-gray-300' },
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.bg} ${c.text} border-transparent`}>{status.toUpperCase()}</Badge>;
  };

  const getPaymentBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
      completed: { bg: 'bg-green-900/50', text: 'text-green-300' },
      failed: { bg: 'bg-red-900/50', text: 'text-red-300' },
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.bg} ${c.text} border-transparent text-xs`}>{status}</Badge>;
  };

  const filteredRequests = requests.filter(req => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      req.graduate?.user?.full_name?.toLowerCase().includes(searchLower) ||
      req.graduate?.student_id?.toLowerCase().includes(searchLower) ||
      req.recipient_institution.toLowerCase().includes(searchLower)
    );
  });

  const pendingCount = requests.filter(r => r.status === 'pending').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Transfer Requests</h1>
          <p className="text-white/50 text-sm">Review and manage document transfer requests</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700 px-4 py-2">
            {pendingCount} Pending Request{pendingCount !== 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {/* Filters */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by graduate name, student ID, or institution..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40"
              />
            </div>
            <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
              <TabsList className="bg-white/10">
                <TabsTrigger value="pending" className="data-[state=active]:bg-yellow-600">Pending</TabsTrigger>
                <TabsTrigger value="approved" className="data-[state=active]:bg-green-600">Approved</TabsTrigger>
                <TabsTrigger value="rejected" className="data-[state=active]:bg-red-600">Rejected</TabsTrigger>
                <TabsTrigger value="all" className="data-[state=active]:bg-blue-600">All</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      {/* Requests Table */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">
            {filter === 'all' ? 'All Requests' : `${filter.charAt(0).toUpperCase() + filter.slice(1)} Requests`}
            <span className="text-white/40 ml-2">({filteredRequests.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5" />
              ))}
            </div>
          ) : filteredRequests.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10">
                    <TableHead className="text-white/60">Graduate</TableHead>
                    <TableHead className="text-white/60">Document</TableHead>
                    <TableHead className="text-white/60">Recipient</TableHead>
                    <TableHead className="text-white/60">Payment</TableHead>
                    <TableHead className="text-white/60">Status</TableHead>
                    <TableHead className="text-white/60">Date</TableHead>
                    <TableHead className="text-white/60">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => (
                    <TableRow key={request.id} className="border-white/10">
                      <TableCell>
                        <div>
                          <p className="text-white font-medium">{request.graduate?.user?.full_name || 'Unknown'}</p>
                          <p className="text-white/40 text-xs">{request.graduate?.student_id}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <p className="text-white/80">{request.document ? getDocumentTypeLabel(request.document.document_type) : 'N/A'}</p>
                      </TableCell>
                      <TableCell>
                        <div>
                          <p className="text-white/80 max-w-[150px] truncate">{request.recipient_institution}</p>
                          {request.recipient_email && (
                            <p className="text-white/40 text-xs truncate">{request.recipient_email}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getPaymentBadge(request.payment_status)}</TableCell>
                      <TableCell>{getStatusBadge(request.status)}</TableCell>
                      <TableCell className="text-white/60 text-sm">{formatDate(request.created_at)}</TableCell>
                      <TableCell>
                        {request.status === 'pending' ? (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 h-8"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionType('approve');
                              }}
                            >
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-red-700 text-red-400 hover:bg-red-900/30 h-8"
                              onClick={() => {
                                setSelectedRequest(request);
                                setActionType('reject');
                              }}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-blue-400 hover:text-blue-300 h-8"
                            onClick={() => {
                              setSelectedRequest(request);
                              setActionType(null);
                            }}
                          >
                            View
                          </Button>
                        )}
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">No Requests Found</h3>
              <p className="text-white/50 text-sm">
                {filter === 'pending' 
                  ? 'No pending transfer requests at the moment.'
                  : `No ${filter} requests found.`}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={!!selectedRequest && !!actionType} onOpenChange={() => {
        setSelectedRequest(null);
        setActionType(null);
        setRejectionReason('');
      }}>
        <DialogContent className="bg-slate-900 border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>
              {actionType === 'approve' ? 'Approve Transfer Request' : 'Reject Transfer Request'}
            </DialogTitle>
            <DialogDescription className="text-white/60">
              {actionType === 'approve' 
                ? 'This will allow the document to be shared with the receiving institution.'
                : 'Please provide a reason for rejecting this request.'}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-white/5 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Graduate</span>
                  <span className="text-white">{selectedRequest.graduate?.user?.full_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Document</span>
                  <span className="text-white">{selectedRequest.document ? getDocumentTypeLabel(selectedRequest.document.document_type) : 'N/A'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-white/60 text-sm">Recipient</span>
                  <span className="text-white">{selectedRequest.recipient_institution}</span>
                </div>
              </div>

              {actionType === 'reject' && (
                <div className="space-y-2">
                  <Label className="text-white/80">Rejection Reason</Label>
                  <Textarea
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    placeholder="Enter reason for rejection..."
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 min-h-[100px]"
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setSelectedRequest(null);
                setActionType(null);
                setRejectionReason('');
              }}
              className="border-white/20 text-white hover:bg-white/10"
            >
              Cancel
            </Button>
            <Button
              onClick={handleAction}
              disabled={isProcessing || (actionType === 'reject' && !rejectionReason.trim())}
              className={actionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {isProcessing ? (
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : actionType === 'approve' ? (
                'Approve Request'
              ) : (
                'Reject Request'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Dialog */}
      <Dialog open={!!selectedRequest && !actionType} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="bg-slate-900 border-white/10 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle>Transfer Request Details</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-between">
                <span className="text-white/60">Status</span>
                {getStatusBadge(selectedRequest.status)}
              </div>

              <div className="p-4 bg-white/5 rounded-lg space-y-3">
                <h4 className="text-white font-medium">Graduate</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/50">Name</p>
                    <p className="text-white">{selectedRequest.graduate?.user?.full_name}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Student ID</p>
                    <p className="text-white">{selectedRequest.graduate?.student_id}</p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-white/5 rounded-lg space-y-3">
                <h4 className="text-white font-medium">Transfer Details</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-white/50">Document</p>
                    <p className="text-white">{selectedRequest.document ? getDocumentTypeLabel(selectedRequest.document.document_type) : 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Recipient</p>
                    <p className="text-white">{selectedRequest.recipient_institution}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Created</p>
                    <p className="text-white">{formatDate(selectedRequest.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-white/50">Expires</p>
                    <p className="text-white">{formatDate(selectedRequest.expires_at)}</p>
                  </div>
                </div>
              </div>

              {selectedRequest.hash_code && (
                <div className="p-4 bg-green-900/20 rounded-lg border border-green-700/50">
                  <p className="text-green-300/70 text-xs mb-1">Verification Code</p>
                  <code className="text-green-400 font-bold text-lg">{selectedRequest.hash_code}</code>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
