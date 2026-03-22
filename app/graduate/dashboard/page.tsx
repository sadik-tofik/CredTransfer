'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';
import type { Document, TransferRequest, GraduateStats } from '@/types';
import type { User } from '@supabase/supabase-js';

interface GraduateData {
  graduate: {
    id: string;
    student_id: string;
    graduation_year: number;
    department: string;
    fee_cleared: boolean;
  } | null;
  stats: GraduateStats;
  documents: Document[];
  transfers: TransferRequest[];
}

export default function GraduateDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<GraduateData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase.auth]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('/api/graduate/dashboard');
        setData(response.data.data);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  const statCards = [
    { 
      label: 'My Documents', 
      value: data?.stats?.total_documents || 0, 
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      ),
      color: 'text-blue-400',
      href: '/graduate/documents'
    },
    { 
      label: 'Active Transfers', 
      value: data?.stats?.active_transfers || 0, 
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
        </svg>
      ),
      color: 'text-green-400',
      href: '/graduate/transfers'
    },
    { 
      label: 'Verifications', 
      value: data?.stats?.total_verifications || 0, 
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
      color: 'text-purple-400',
      href: '/verify'
    },
    { 
      label: 'Completed', 
      value: data?.stats?.completed_transfers || 0, 
      icon: (
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      ),
      color: 'text-cyan-400',
      href: '/graduate/transfers'
    },
  ];

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      active: { bg: 'bg-green-900/50', text: 'text-green-300' },
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
      approved: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
      completed: { bg: 'bg-green-900/50', text: 'text-green-300' },
      rejected: { bg: 'bg-red-900/50', text: 'text-red-300' },
      expired: { bg: 'bg-gray-900/50', text: 'text-gray-300' },
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.bg} ${c.text} border-transparent`}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">
            Welcome, {user?.user_metadata?.full_name?.split(' ')[0] || 'Graduate'}
          </h1>
          <p className="text-white/50 text-sm">
            {data?.graduate?.student_id ? `Student ID: ${data.graduate.student_id}` : 'Manage your academic credentials'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data?.graduate?.fee_cleared ? (
            <Badge className="bg-green-900/50 text-green-300 border-green-700">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Fee Cleared
            </Badge>
          ) : (
            <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700">
              <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Fee Pending
            </Badge>
          )}
          <Link href="/graduate/share">
            <Button className="bg-green-600 hover:bg-green-700">
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
              Share Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card className="bg-white/5 border-white/10 hover:bg-white/10 transition-colors cursor-pointer">
              <CardContent className="p-4 flex items-center gap-4">
                <div className={stat.color}>{stat.icon}</div>
                <div>
                  <p className="text-white font-bold text-2xl">
                    {isLoading ? <Skeleton className="h-8 w-12 bg-white/10" /> : stat.value}
                  </p>
                  <p className="text-white/50 text-xs">{stat.label}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Profile Card */}
      {data?.graduate && (
        <Card className="bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-700/50">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {user?.user_metadata?.full_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'GR'}
                </div>
                <div>
                  <h3 className="text-white font-semibold text-lg">{user?.user_metadata?.full_name}</h3>
                  <p className="text-green-300/70 text-sm">{data.graduate.department}</p>
                  <div className="flex items-center gap-4 mt-1 text-white/50 text-xs">
                    <span>ID: {data.graduate.student_id}</span>
                    <span>Class of {data.graduate.graduation_year}</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Link href="/graduate/documents">
                  <Button variant="outline" size="sm" className="border-green-700 text-green-300 hover:bg-green-900/30">
                    View Documents
                  </Button>
                </Link>
                <Link href="/graduate/profile">
                  <Button variant="ghost" size="sm" className="text-white/60 hover:text-white">
                    Edit Profile
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* My Documents */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-white text-base">My Documents</CardTitle>
            <Link href="/graduate/documents">
              <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 text-xs">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5" />
              ))
            ) : data?.documents && data.documents.length > 0 ? (
              data.documents.slice(0, 4).map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{getDocumentTypeLabel(doc.document_type)}</p>
                      <p className="text-white/40 text-xs">{formatDate(doc.uploaded_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(doc.status)}
                    {doc.blockchain_tx_hash && (
                      <Badge className="bg-purple-900/50 text-purple-300 border-transparent text-xs">
                        On-chain
                      </Badge>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">No documents uploaded yet</p>
                <p className="text-white/20 text-xs mt-1">Documents will appear here once uploaded by registrar</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transfers */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-white text-base">Recent Transfers</CardTitle>
            <Link href="/graduate/transfers">
              <Button variant="ghost" size="sm" className="text-green-400 hover:text-green-300 text-xs">
                View All
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5" />
              ))
            ) : data?.transfers && data.transfers.length > 0 ? (
              data.transfers.slice(0, 4).map((transfer) => (
                <div key={transfer.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-900/50 rounded-lg flex items-center justify-center">
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium truncate max-w-[180px]">
                        {transfer.recipient_institution}
                      </p>
                      <p className="text-white/40 text-xs">{formatDate(transfer.created_at)}</p>
                    </div>
                  </div>
                  {getStatusBadge(transfer.status)}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </div>
                <p className="text-white/30 text-sm">No transfers yet</p>
                <Link href="/graduate/share">
                  <Button variant="link" size="sm" className="text-green-400 mt-2">
                    Share your first document
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { href: '/graduate/share', label: 'Share Document', icon: 'share', desc: 'Send to institution' },
              { href: '/graduate/documents', label: 'View Documents', icon: 'file', desc: 'Your credentials' },
              { href: '/graduate/payments', label: 'Payment History', icon: 'credit-card', desc: 'View transactions' },
              { href: '/verify', label: 'Verify Document', icon: 'check', desc: 'Check authenticity' },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all border border-white/5 hover:border-green-500/50 text-center">
                  <div className="w-10 h-10 bg-green-900/30 rounded-lg flex items-center justify-center mx-auto mb-2">
                    {action.icon === 'share' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    )}
                    {action.icon === 'file' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    )}
                    {action.icon === 'credit-card' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    )}
                    {action.icon === 'check' && (
                      <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>
                  <p className="text-white text-sm font-medium">{action.label}</p>
                  <p className="text-white/40 text-xs mt-1">{action.desc}</p>
                </div>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
