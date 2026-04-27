'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface ReportSummary {
  total_documents: number;
  total_transfers: number;
  total_revenue: number;
  total_verifications: number;
  successful_verifications: number;
}

interface AuditEntry {
  id: string;
  action: string;
  timestamp: string;
  user?: { full_name: string; role: string };
}

function periodToDateRange(period: string): { start_date: string; end_date: string } {
  const now = new Date();
  const end_date = now.toISOString().split('T')[0];
  let start = new Date(now);

  if (period === 'today') {
    // same day
  } else if (period === 'week') {
    start.setDate(start.getDate() - 7);
  } else if (period === 'month') {
    start.setMonth(start.getMonth() - 1);
  } else if (period === 'year') {
    start.setFullYear(start.getFullYear() - 1);
  }

  return { start_date: start.toISOString().split('T')[0], end_date };
}

function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    upload_document: 'Document uploaded',
    approve_transfer: 'Transfer approved',
    reject_transfer: 'Transfer rejected',
    upload_payment_screenshot: 'Payment screenshot uploaded',
    chapa_payment_initiated: 'Chapa payment initiated',
    chapa_payment_completed: 'Chapa payment completed',
    verify_document: 'Document verified',
    register_graduate: 'Graduate registered',
  };
  return labels[action] || action.replace(/_/g, ' ');
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

function actionColor(action: string): string {
  if (action.includes('upload')) return 'bg-blue-400';
  if (action.includes('approve')) return 'bg-green-400';
  if (action.includes('reject')) return 'bg-red-400';
  if (action.includes('verify')) return 'bg-purple-400';
  if (action.includes('payment') || action.includes('chapa')) return 'bg-yellow-400';
  return 'bg-cyan-400';
}

export default function RegistrarReportsPage() {
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [recentActivity, setRecentActivity] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const { start_date, end_date } = periodToDateRange(period);

        // Fetch report summary
        const reportRes = await axios.get(
          `/api/reports/daily?start_date=${start_date}&end_date=${end_date}`
        );
        // The API returns: { success, data: { summary: {...}, documents: [...], ... } }
        const apiData = reportRes.data?.data;
        if (apiData?.summary) {
          setSummary(apiData.summary);
        }

        // Fetch real audit log for activity timeline
        const auditRes = await axios.get('/api/registrar/audit?page=1&limit=5');
        if (auditRes.data?.data) {
          setRecentActivity(auditRes.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  const statCards = [
    { label: 'Documents Uploaded', value: summary?.total_documents ?? 0, icon: '📄', change: 'this period' },
    { label: 'Transfer Requests', value: summary?.total_transfers ?? 0, icon: '📤', change: 'this period' },
    { label: 'Completed Transfers', value: summary?.total_transfers ?? 0, icon: '✅', change: 'this period' },
    { label: 'Verifications', value: summary?.total_verifications ?? 0, icon: '🔍', change: `${summary?.successful_verifications ?? 0} successful` },
    { label: 'Total Revenue', value: formatCurrency(summary?.total_revenue ?? 0), icon: '💰', change: 'from payments' },
    { label: 'Success Rate', value: summary?.total_verifications
        ? `${Math.round(((summary?.successful_verifications ?? 0) / summary.total_verifications) * 100)}%`
        : '—', icon: '🎯', change: 'verification success' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Reports & Analytics</h1>
          <p className="text-white/50 text-sm">View system statistics and generate reports</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={(value) => setPeriod(value || 'month')}>
            <SelectTrigger className="w-[150px] bg-white/10 border-white/20 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="today">Today</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
          <Button className="bg-blue-600 hover:bg-blue-700">
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export Report
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {statCards.map((stat) => (
          <Card key={stat.label} className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/50 text-sm">{stat.label}</p>
                  {isLoading ? (
                    <div className="h-8 w-20 bg-white/10 rounded mt-1 animate-pulse" />
                  ) : (
                    <p className="text-white font-bold text-2xl mt-1">{stat.value}</p>
                  )}
                </div>
                <div className="text-2xl">{stat.icon}</div>
              </div>
              <p className="text-blue-400 text-xs mt-2">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Reports + Activity */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Quick Reports</CardTitle>
            <CardDescription className="text-white/60">Generate common reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { name: 'Daily Upload Summary', desc: 'Documents uploaded today', format: 'PDF' },
              { name: 'Monthly Revenue Report', desc: 'Payment transactions this month', format: 'Excel' },
              { name: 'Verification Statistics', desc: 'Document verification history', format: 'PDF' },
              { name: 'Graduate Directory', desc: 'List of all registered graduates', format: 'Excel' },
              { name: 'Transfer Requests Log', desc: 'All transfer requests with status', format: 'PDF' },
            ].map((report) => (
              <div key={report.name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div>
                  <p className="text-white font-medium">{report.name}</p>
                  <p className="text-white/40 text-xs">{report.desc}</p>
                </div>
                <Button size="sm" variant="outline" className="border-blue-700 text-blue-400 hover:bg-blue-900/30">
                  {report.format}
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white text-base">Activity Timeline</CardTitle>
            <CardDescription className="text-white/60">Recent system activities</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full mt-2 bg-white/10 animate-pulse" />
                    <div className="flex-1 space-y-1">
                      <div className="h-3 bg-white/10 rounded w-3/4 animate-pulse" />
                      <div className="h-2 bg-white/10 rounded w-1/2 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            ) : recentActivity.length === 0 ? (
              <p className="text-white/40 text-sm text-center py-8">No recent activity found</p>
            ) : (
              <div className="space-y-4">
                {recentActivity.map((entry) => (
                  <div key={entry.id} className="flex items-start gap-3">
                    <div className={`w-2 h-2 rounded-full mt-2 ${actionColor(entry.action)}`} />
                    <div className="flex-1">
                      <p className="text-white text-sm">{actionLabel(entry.action)}</p>
                      <p className="text-white/40 text-xs">
                        {entry.user?.full_name || 'System'} • {timeAgo(entry.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Placeholder */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Monthly Trends</CardTitle>
          <CardDescription className="text-white/60">Document uploads and verifications over time</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center border border-white/10 rounded-lg">
            <div className="text-center">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-white/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-white/40 text-sm">Charts will display with more data</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
