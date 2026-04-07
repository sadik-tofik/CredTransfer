'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatDate, getDocumentTypeLabel } from '@/lib/utils';
import { useApiData } from '@/hooks/use-api-data';
import { useAppStore } from '@/lib/store';

interface DashboardStats {
  total_documents: number;
  total_graduates: number;
  pending_requests: number;
  total_verifications: number;
  documents_today: number;
  revenue_this_month: number;
}

interface RecentDocument {
  id: string;
  document_type: string;
  file_name: string;
  uploaded_at: string;
  graduate: { student_id: string; user: { full_name: string } };
}

interface PendingRequest {
  id: string;
  recipient_institution: string;
  created_at: string;
  status: string;
  graduate: { user: { full_name: string } };
  document: { document_type: string };
}

export default function RegistrarDashboard() {
  const { setDashboardStats, isGlobalLoading, setGlobalLoading } = useAppStore();
  const [recentDocs, setRecentDocs] = useState<RecentDocument[]>([]);
  const [pendingRequests, setPendingRequests] = useState<PendingRequest[]>([]);

  // Optimized data fetching with caching
  const { data: statsData, loading: statsLoading, refetch: refetchStats } = useApiData(
    async () => {
      const response = await axios.get('/api/registrar/stats');
      return response.data;
    },
    { cacheKey: 'registrar-stats', ttl: 2 * 60 * 1000 } // 2 minutes cache
  );

  const { data: reportsData, loading: reportsLoading } = useApiData(
    async () => {
      const response = await axios.get('/api/reports/daily');
      return response.data;
    },
    { cacheKey: 'reports-daily', ttl: 5 * 60 * 1000 } // 5 minutes cache
  );

  const { data: transfersData } = useApiData(
    async () => {
      const response = await axios.get('/api/transfers/pending?status=pending&limit=5');
      return response.data;
    },
    { cacheKey: 'pending-transfers', ttl: 30 * 1000 } // 30 seconds cache
  );

  const { data: blockchainData } = useApiData(
    async () => {
      try {
        const response = await axios.get('/api/blockchain/status');
        return response.data;
      } catch (error) {
        // Return fallback data when blockchain is unavailable
        return {
          success: false,
          data: {
            connected: false,
            network: 'offline',
          }
        };
      }
    },
    { cacheKey: 'blockchain-status', ttl: 10 * 1000 } // 10 seconds cache
  );

  // Combine loading states
  const isLoading = statsLoading || reportsLoading || isGlobalLoading;

  // Update store and local state when data changes
  useEffect(() => {
    if (statsData) {
      const combinedStats = {
        total_documents: statsData.stats?.totalDocuments || 0,
        total_graduates: statsData.stats?.totalGraduates || 0,
        pending_requests: statsData.stats?.pendingTransfers || 0,
        total_verifications: statsData.stats?.verifiedDocuments || 0,
        documents_today: reportsData?.data?.summary?.total_documents || 0,
        revenue_this_month: reportsData?.data?.summary?.total_revenue || 0,
      };
      setDashboardStats(combinedStats);
    }
    
    if (reportsData?.data) {
      setRecentDocs(reportsData.data.documents?.slice(0, 5) || []);
    }
    
    if (transfersData?.data) {
      setPendingRequests(transfersData.data);
    }
  }, [statsData, reportsData, transfersData, setDashboardStats]);

  // Manual refresh function
  const handleRefresh = async () => {
    setGlobalLoading(true);
    try {
      await Promise.all([
        refetchStats(),
        // Other refetch functions can be added here
      ]);
    } finally {
      setGlobalLoading(false);
    }
  };

  const stats = useAppStore(state => state.dashboardStats);
  const blockchainStatus = blockchainData?.data;

  const statCards = [
    { label: 'Total Documents', value: stats?.total_documents || 0, icon: '📄', color: 'blue' },
    { label: 'Total Graduates', value: stats?.total_graduates || 0, icon: '🎓', color: 'green' },
    { label: 'Pending Requests', value: stats?.pending_requests || 0, icon: '⏳', color: 'yellow' },
    { label: 'Total Verifications', value: stats?.total_verifications || 0, icon: '✅', color: 'purple' },
    { label: 'Uploads Today', value: stats?.documents_today || 0, icon: '📤', color: 'cyan' },
    { label: 'Revenue This Month', value: `${(stats?.revenue_this_month || 0).toFixed(0)} ETB`, icon: '💰', color: 'orange' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-white/50 text-sm">Registrar overview and quick actions</p>
        </div>
        <div className="flex items-center gap-3">
          {blockchainStatus && (
            <Badge
              className={
                blockchainStatus.connected
                  ? 'bg-green-900/50 text-green-300 border-green-700'
                  : 'bg-red-900/50 text-red-300 border-red-700'
              }
            >
              {blockchainStatus.connected ? '⛓️ Blockchain Connected' : '⛓️ Blockchain Offline'}
            </Badge>
          )}
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isLoading}
            className="border-white/20 text-white hover:bg-white/10"
          >
            {isLoading ? '🔄 Refreshing...' : '🔄 Refresh'}
          </Button>
          <Link href="/registrar/upload">
            <Button className="bg-blue-600 hover:bg-blue-700">
              📤 Upload Document
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="text-3xl">{stat.icon}</div>
              <div>
                <p className="text-white font-bold text-2xl">
                  {isLoading ? (
                    <span className="inline-block w-12 h-6 bg-white/10 rounded animate-pulse" />
                  ) : (
                    stat.value
                  )}
                </p>
                <p className="text-white/50 text-xs">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Recent Documents */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-white text-base">Recent Uploads</CardTitle>
            <Link href="/registrar/upload">
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs">
                Upload New →
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
              ))
            ) : recentDocs.length > 0 ? (
              recentDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {doc.graduate?.user?.full_name || 'Unknown'}
                    </p>
                    <p className="text-white/40 text-xs">
                      {getDocumentTypeLabel(doc.document_type)} · {doc.graduate?.student_id}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-900/50 text-green-300 border-green-700 text-xs">Active</Badge>
                    <p className="text-white/30 text-xs mt-1">{formatDate(doc.uploaded_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white/30 text-sm text-center py-4">No documents uploaded yet</p>
            )}
          </CardContent>
        </Card>

        {/* Pending Requests */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-white text-base">Pending Requests</CardTitle>
            <Link href="/registrar/requests">
              <Button variant="ghost" size="sm" className="text-blue-400 hover:text-blue-300 text-xs">
                View All →
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              Array(3).fill(0).map((_, i) => (
                <div key={i} className="h-12 bg-white/5 rounded animate-pulse" />
              ))
            ) : pendingRequests.length > 0 ? (
              pendingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div>
                    <p className="text-white text-sm font-medium">
                      {req.graduate?.user?.full_name || 'Unknown'}
                    </p>
                    <p className="text-white/40 text-xs">
                      → {req.recipient_institution}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700 text-xs">Pending</Badge>
                    <p className="text-white/30 text-xs mt-1">{formatDate(req.created_at)}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-white/30 text-sm text-center py-4">No pending requests</p>
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
              { href: '/registrar/upload', label: 'Upload Document', icon: '📤', desc: 'Add new credential' },
              { href: '/registrar/graduates', label: 'Search Graduate', icon: '🔍', desc: 'Find student records' },
              { href: '/registrar/requests', label: 'Review Requests', icon: '📋', desc: 'Approve/reject transfers' },
              { href: '/registrar/reports', label: 'Generate Report', icon: '📊', desc: 'Download analytics' },
            ].map((action) => (
              <Link key={action.href} href={action.href}>
                <div className="p-4 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-all border border-white/5 hover:border-blue-500/50 text-center">
                  <div className="text-3xl mb-2">{action.icon}</div>
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
