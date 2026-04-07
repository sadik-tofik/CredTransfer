'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';

interface ReportStats {
  documents_uploaded: number;
  transfers_requested: number;
  transfers_completed: number;
  verifications_count: number;
  revenue: number;
  new_graduates: number;
}

export default function RegistrarReportsPage() {
  const [stats, setStats] = useState<ReportStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [period, setPeriod] = useState('month');

  useEffect(() => {
    const fetchStats = async () => {
      setIsLoading(true);
      try {
        const response = await axios.get(`/api/reports/daily?period=${period}`);
        setStats(response.data.data?.dashboard_stats);
      } catch (error) {
        console.error('Failed to fetch report data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [period]);

  const statCards = [
    { label: 'Documents Uploaded', value: stats?.documents_uploaded || 0, icon: '📄', change: '+12%' },
    { label: 'Transfer Requests', value: stats?.transfers_requested || 0, icon: '📤', change: '+8%' },
    { label: 'Completed Transfers', value: stats?.transfers_completed || 0, icon: '✅', change: '+15%' },
    { label: 'Verifications', value: stats?.verifications_count || 0, icon: '🔍', change: '+23%' },
    { label: 'Total Revenue', value: formatCurrency(stats?.revenue || 0), icon: '💰', change: '+18%' },
    { label: 'New Graduates', value: stats?.new_graduates || 0, icon: '🎓', change: '+5%' },
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
                    <Skeleton className="h-8 w-20 bg-white/10 mt-1" />
                  ) : (
                    <p className="text-white font-bold text-2xl mt-1">{stat.value}</p>
                  )}
                </div>
                <div className="text-2xl">{stat.icon}</div>
              </div>
              <p className="text-green-400 text-xs mt-2">{stat.change} from last period</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Reports */}
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
            <div className="space-y-4">
              {[
                { action: 'Document uploaded', user: 'Registrar', time: '5 min ago', type: 'upload' },
                { action: 'Transfer approved', user: 'Admin', time: '15 min ago', type: 'approve' },
                { action: 'New verification', user: 'External', time: '1 hour ago', type: 'verify' },
                { action: 'Payment confirmed', user: 'System', time: '2 hours ago', type: 'payment' },
                { action: 'Graduate registered', user: 'Self', time: '3 hours ago', type: 'register' },
              ].map((activity, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className={`w-2 h-2 rounded-full mt-2 ${
                    activity.type === 'upload' ? 'bg-blue-400' :
                    activity.type === 'approve' ? 'bg-green-400' :
                    activity.type === 'verify' ? 'bg-purple-400' :
                    activity.type === 'payment' ? 'bg-yellow-400' :
                    'bg-cyan-400'
                  }`} />
                  <div className="flex-1">
                    <p className="text-white text-sm">{activity.action}</p>
                    <p className="text-white/40 text-xs">{activity.user} • {activity.time}</p>
                  </div>
                </div>
              ))}
            </div>
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
