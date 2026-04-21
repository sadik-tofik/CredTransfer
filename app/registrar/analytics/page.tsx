'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';

interface AnalyticsData {
  totals: {
    documents:     number;
    graduates:     number;
    verifications: number;
    revenue:       number;
    transfers: {
      total:     number;
      pending:   number;
      approved:  number;
      completed: number;
      rejected:  number;
    };
  };
  charts: {
    transfersByStatus:  { name: string; value: number; color: string }[];
    documentTypes:      { name: string; value: number }[];
    monthlyTransfers:   { month: string; total: number; approved: number }[];
  };
  recentActivity: {
    id: string;
    status: string;
    created_at: string;
    recipient_institution: string;
    graduate?: { user?: { full_name?: string } };
    document?:  { document_type?: string };
  }[];
}

// ─── Tiny bar chart (no external lib needed) ────────────────────────────────
function BarChart({ data }: { data: { month: string; total: number; approved: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);
  return (
    <div className="flex items-end gap-2 h-36">
      {data.map((d) => (
        <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
          <div className="w-full flex flex-col-reverse gap-0.5" style={{ height: '108px' }}>
            {/* Approved bar */}
            <div
              className="w-full bg-emerald-500/60 rounded-sm transition-all duration-500"
              style={{ height: `${(d.approved / max) * 100}%` }}
              title={`Approved: ${d.approved}`}
            />
            {/* Remaining (pending/rejected) bar */}
            {d.total - d.approved > 0 && (
              <div
                className="w-full bg-white/15 rounded-sm transition-all duration-500"
                style={{ height: `${((d.total - d.approved) / max) * 100}%` }}
                title={`Other: ${d.total - d.approved}`}
              />
            )}
          </div>
          <span className="text-white/40 text-xs">{d.month}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Donut chart (SVG) ──────────────────────────────────────────────────────
function DonutChart({ data }: { data: { name: string; value: number; color: string }[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-white/30 text-sm">No data yet</div>
    );
  }
  const radius = 50;
  const cx = 60; const cy = 60;
  let cumulative = 0;
  const slices = data.filter((d) => d.value > 0).map((d) => {
    const pct   = d.value / total;
    const start = cumulative;
    cumulative += pct;
    const startAngle = start * 2 * Math.PI - Math.PI / 2;
    const endAngle   = cumulative * 2 * Math.PI - Math.PI / 2;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const large = pct > 0.5 ? 1 : 0;
    return { ...d, pct, path: `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z` };
  });

  return (
    <div className="flex items-center gap-6">
      <svg viewBox="0 0 120 120" className="w-28 h-28 flex-shrink-0">
        {slices.map((s, i) => (
          <path key={i} d={s.path} fill={s.color} opacity={0.85} />
        ))}
        <circle cx={cx} cy={cy} r={32} fill="#0f172a" />
        <text x={cx} y={cy - 6} textAnchor="middle" fill="white" fontSize="14" fontWeight="bold">{total}</text>
        <text x={cx} y={cy + 10} textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="7">transfers</text>
      </svg>
      <div className="space-y-1.5">
        {slices.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: s.color }} />
            <span className="text-white/60 text-xs">{s.name}</span>
            <span className="text-white text-xs font-semibold ml-auto pl-4">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────────────
function KPICard({ label, value, icon, sub, accent }: {
  label: string; value: string | number; icon: string; sub?: string; accent?: string;
}) {
  return (
    <Card className="bg-white/5 border-white/10">
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 ${accent || 'bg-white/10'}`}>
          {icon}
        </div>
        <div>
          <p className="text-white font-bold text-2xl leading-none">{value}</p>
          <p className="text-white/50 text-xs mt-1">{label}</p>
          {sub && <p className="text-white/30 text-xs">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function getStatusBadge(status: string) {
  const cfg: Record<string, string> = {
    pending:   'bg-amber-900/50 text-amber-300 border-amber-700/40',
    approved:  'bg-emerald-900/50 text-emerald-300 border-emerald-700/40',
    completed: 'bg-blue-900/50 text-blue-300 border-blue-700/40',
    rejected:  'bg-red-900/50 text-red-300 border-red-700/40',
  };
  return <Badge className={`${cfg[status] || 'bg-white/10 text-white/50'} text-xs`}>{status}</Badge>;
}

function formatDate(iso: string) {
  try { return new Date(iso).toLocaleDateString('en-ET', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return iso; }
}

// ─── Main Page ───────────────────────────────────────────────────────────────
export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.get('/api/registrar/analytics')
      .then((res) => setData(res.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Analytics</h1>
          <p className="text-white/50 text-sm mt-0.5">System performance and usage statistics</p>
        </div>
        <Badge className="bg-emerald-900/50 text-emerald-300 border-emerald-700/50 text-xs">
          Live Data
        </Badge>
      </div>

      {/* KPI grid */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-20 bg-white/5 rounded-xl" />)}
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <KPICard label="Total Documents"     value={data.totals.documents}                      icon="📄" accent="bg-blue-900/40" />
          <KPICard label="Graduates"           value={data.totals.graduates}                      icon="🎓" accent="bg-purple-900/40" />
          <KPICard label="Total Transfers"     value={data.totals.transfers.total}                icon="📤" accent="bg-amber-900/40" />
          <KPICard label="Approved"            value={data.totals.transfers.approved}             icon="✅" accent="bg-emerald-900/40" />
          <KPICard label="Verifications"       value={data.totals.verifications}                  icon="🔍" accent="bg-cyan-900/40" />
          <KPICard
            label="Total Revenue"
            value={`${data.totals.revenue.toLocaleString()} ETB`}
            icon="💰"
            accent="bg-green-900/40"
            sub="from completed payments"
          />
        </div>
      ) : null}

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Monthly bar chart */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Monthly Transfers (Last 6 Months)</CardTitle>
            <div className="flex items-center gap-4 mt-1">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/60" />
                <span className="text-white/40 text-xs">Approved</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-white/15" />
                <span className="text-white/40 text-xs">Other</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-36 bg-white/5" />
            ) : data ? (
              <BarChart data={data.charts.monthlyTransfers} />
            ) : null}
          </CardContent>
        </Card>

        {/* Donut: transfers by status */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Transfers by Status</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-center py-2">
            {loading ? (
              <Skeleton className="w-28 h-28 rounded-full bg-white/5" />
            ) : data ? (
              <DonutChart data={data.charts.transfersByStatus} />
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Document type breakdown + recent activity */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Document types */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Documents by Type</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-8 bg-white/5" />)}</div>
            ) : data && data.charts.documentTypes.length > 0 ? (
              <div className="space-y-3">
                {data.charts.documentTypes.map((dt) => {
                  const total = data.charts.documentTypes.reduce((s, d) => s + d.value, 0);
                  const pct   = total > 0 ? Math.round((dt.value / total) * 100) : 0;
                  return (
                    <div key={dt.name}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-white/70 text-sm">{dt.name}</span>
                        <span className="text-white/50 text-xs">{dt.value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500/70 rounded-full transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-white/30 text-sm text-center py-4">No documents yet</p>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Recent Transfer Requests</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-3">{Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-12 bg-white/5" />)}</div>
            ) : data && data.recentActivity.length > 0 ? (
              <div className="space-y-2">
                {data.recentActivity.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">
                        {(a.graduate as { user?: { full_name?: string } } | undefined)?.user?.full_name || 'Unknown'}
                      </p>
                      <p className="text-white/40 text-xs truncate">→ {a.recipient_institution}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      {getStatusBadge(a.status)}
                      <span className="text-white/30 text-xs hidden sm:block">{formatDate(a.created_at)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-white/30 text-sm text-center py-4">No recent activity</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Transfer health summary */}
      {data && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-base">Transfer Health Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {
                  label:   'Approval Rate',
                  value:   data.totals.transfers.total > 0
                             ? `${Math.round(((data.totals.transfers.approved + data.totals.transfers.completed) / data.totals.transfers.total) * 100)}%`
                             : 'N/A',
                  color:   'text-emerald-400',
                },
                {
                  label:   'Pending Review',
                  value:   data.totals.transfers.pending,
                  color:   data.totals.transfers.pending > 5 ? 'text-amber-400' : 'text-white',
                },
                {
                  label:   'Rejection Rate',
                  value:   data.totals.transfers.total > 0
                             ? `${Math.round((data.totals.transfers.rejected / data.totals.transfers.total) * 100)}%`
                             : 'N/A',
                  color:   'text-red-400',
                },
                {
                  label:   'Avg Revenue/Transfer',
                  value:   data.totals.transfers.total > 0
                             ? `${Math.round(data.totals.revenue / data.totals.transfers.total)} ETB`
                             : 'N/A',
                  color:   'text-blue-400',
                },
              ].map((stat) => (
                <div key={stat.label} className="text-center p-4 bg-white/5 rounded-xl">
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                  <p className="text-white/40 text-xs mt-1">{stat.label}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
