'use client';

import { useEffect, useState, useCallback } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';

interface AuditEntry {
  id: string;
  action: string;
  details?: Record<string, unknown>;
  ip_address?: string;
  timestamp?: string;
  created_at: string;
  user?: { full_name: string; email: string; role: string } | null;
}

const ACTION_META: Record<string, { label: string; color: string; icon: string }> = {
  create_transfer_request:  { label: 'Transfer Created',   color: 'bg-blue-900/50 text-blue-300 border-blue-700/40',     icon: '📤' },
  approve_transfer:         { label: 'Transfer Approved',  color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40', icon: '✅' },
  reject_transfer:          { label: 'Transfer Rejected',  color: 'bg-red-900/50 text-red-300 border-red-700/40',        icon: '❌' },
  upload_document:          { label: 'Document Uploaded',  color: 'bg-purple-900/50 text-purple-300 border-purple-700/40', icon: '📄' },
  upload_payment_screenshot:{ label: 'Screenshot Uploaded',color: 'bg-amber-900/50 text-amber-300 border-amber-700/40',  icon: '📸' },
  confirm_payment:          { label: 'Payment Confirmed',  color: 'bg-emerald-900/50 text-emerald-300 border-emerald-700/40', icon: '💰' },
  verify_document:          { label: 'Document Verified',  color: 'bg-cyan-900/50 text-cyan-300 border-cyan-700/40',     icon: '🔍' },
  login:                    { label: 'User Login',          color: 'bg-slate-700/50 text-slate-300 border-slate-600/40',  icon: '🔐' },
  register:                 { label: 'User Registered',    color: 'bg-indigo-900/50 text-indigo-300 border-indigo-700/40', icon: '👤' },
  revoke_document:          { label: 'Document Revoked',   color: 'bg-red-900/50 text-red-300 border-red-700/40',        icon: '🚫' },
};

function getActionMeta(action: string) {
  return ACTION_META[action] ?? {
    label: action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color: 'bg-white/10 text-white/60 border-white/10',
    icon:  '🔄',
  };
}

function formatDateTime(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-ET', {
      year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AuditLogPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const fetchAudit = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '30' });
      if (actionFilter) params.set('action', actionFilter);
      const response = await axios.get(`/api/registrar/audit?${params}`);
      setEntries(response.data.data || []);
      setTotalPages(response.data.totalPages || 1);
      setTotal(response.data.total || 0);
    } catch {
      // silently fail — table may not exist yet
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [page, actionFilter]);

  useEffect(() => { fetchAudit(); }, [fetchAudit]);

  const filtered = entries.filter((e) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      e.action.toLowerCase().includes(q) ||
      e.user?.full_name?.toLowerCase().includes(q) ||
      e.user?.email?.toLowerCase().includes(q) ||
      JSON.stringify(e.details || {}).toLowerCase().includes(q)
    );
  });

  const uniqueActions = Array.from(new Set(Object.keys(ACTION_META)));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Audit Log</h1>
          <p className="text-white/50 text-sm mt-0.5">
            Full chronological record of all system actions — {total.toLocaleString()} entries
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAudit}
          className="border-white/20 text-white hover:bg-white/10 self-start sm:self-auto"
        >
          🔄 Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search by user, action, or details…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-white/10 border-white/20 text-white placeholder:text-white/30 flex-1"
        />
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm outline-none focus:border-emerald-500 transition-all min-w-[180px]"
        >
          <option value="">All Actions</option>
          {uniqueActions.map((a) => (
            <option key={a} value={a}>{ACTION_META[a]?.label || a}</option>
          ))}
        </select>
      </div>

      {/* Log */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base">
            Activity Timeline
            <span className="text-white/30 font-normal ml-2 text-sm">({filtered.length} shown)</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array(8).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5 rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-white/40 font-medium">No audit entries found</p>
              <p className="text-white/20 text-sm mt-1">Actions will appear here as users interact with the system.</p>
            </div>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/10" />
              <div className="space-y-1">
                {filtered.map((entry) => {
                  const meta = getActionMeta(entry.action);
                  const ts   = entry.created_at || entry.timestamp || '';
                  return (
                    <div key={entry.id} className="flex gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors group">
                      {/* Timeline dot */}
                      <div className="relative flex-shrink-0 z-10">
                        <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center text-base group-hover:border-white/20 transition-colors">
                          {meta.icon}
                        </div>
                      </div>
                      {/* Content */}
                      <div className="flex-1 min-w-0 py-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <Badge className={`${meta.color} text-xs font-semibold`}>{meta.label}</Badge>
                          {entry.user && (
                            <span className="text-white/70 text-sm font-medium">{entry.user.full_name}</span>
                          )}
                          {entry.user?.role && (
                            <span className="text-white/30 text-xs capitalize">({entry.user.role})</span>
                          )}
                        </div>
                        {/* Details */}
                        {entry.details && Object.keys(entry.details).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-1">
                            {Object.entries(entry.details).map(([k, v]) => {
                              if (k === 'password' || k === 'token') return null;
                              const val = typeof v === 'string' ? v : JSON.stringify(v);
                              const short = val.length > 40 ? val.slice(0, 40) + '…' : val;
                              return (
                                <span key={k} className="text-white/30 text-xs font-mono bg-white/5 px-2 py-0.5 rounded">
                                  {k}: <span className="text-white/50">{short}</span>
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Timestamp */}
                      <div className="flex-shrink-0 text-right py-1">
                        <p className="text-white/50 text-xs">{timeAgo(ts)}</p>
                        <p className="text-white/20 text-xs mt-0.5 hidden lg:block">{formatDateTime(ts)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-white/10">
              <p className="text-white/40 text-sm">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="border-white/20 text-white hover:bg-white/10 disabled:opacity-30"
                >
                  ← Prev
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="border-white/20 text-white hover:bg-white/10 disabled:opacity-30"
                >
                  Next →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
