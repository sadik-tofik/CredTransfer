'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate, formatCurrency } from '@/lib/utils';
import type { Payment } from '@/types';

export default function GraduatePaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        const response = await axios.get('/api/graduate/payments');
        setPayments(response.data.data || []);
      } catch (error) {
        console.error('Failed to fetch payments:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPayments();
  }, []);

  const getStatusBadge = (status: string) => {
    const config: Record<string, { bg: string; text: string }> = {
      pending: { bg: 'bg-yellow-900/50', text: 'text-yellow-300' },
      processing: { bg: 'bg-blue-900/50', text: 'text-blue-300' },
      completed: { bg: 'bg-green-900/50', text: 'text-green-300' },
      failed: { bg: 'bg-red-900/50', text: 'text-red-300' },
      refunded: { bg: 'bg-purple-900/50', text: 'text-purple-300' },
    };
    const c = config[status] || config.pending;
    return <Badge className={`${c.bg} ${c.text} border-transparent`}>{status.toUpperCase()}</Badge>;
  };

  const getMethodIcon = (method: string) => {
    switch (method) {
      case 'telebirr':
        return '📱';
      case 'bank_transfer':
        return '🏦';
      case 'cbe_birr':
        return '💳';
      default:
        return '💰';
    }
  };

  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Payment History</h1>
        <p className="text-white/50 text-sm">View your payment transactions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-white">{payments.length}</p>
            <p className="text-white/50 text-xs">Total Transactions</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">{formatCurrency(totalPaid)}</p>
            <p className="text-white/50 text-xs">Total Paid</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-400">
              {payments.filter(p => p.status === 'completed').length}
            </p>
            <p className="text-white/50 text-xs">Completed</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-400">
              {payments.filter(p => p.status === 'pending').length}
            </p>
            <p className="text-white/50 text-xs">Pending</p>
          </CardContent>
        </Card>
      </div>

      {/* Payments List */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Transactions</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array(5).fill(0).map((_, i) => (
                <Skeleton key={i} className="h-16 bg-white/5" />
              ))}
            </div>
          ) : payments.length > 0 ? (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-4 bg-white/5 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center text-xl">
                      {getMethodIcon(payment.payment_method)}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Document Transfer Fee
                      </p>
                      <p className="text-white/50 text-sm">
                        {payment.payment_method.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())} • {payment.transaction_reference || 'No reference'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-white font-bold">{formatCurrency(payment.amount)}</p>
                    <div className="flex items-center gap-2 justify-end mt-1">
                      {getStatusBadge(payment.status)}
                      <span className="text-white/40 text-xs">{formatDate(payment.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                </svg>
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">No Payments Yet</h3>
              <p className="text-white/50 text-sm">
                Your payment history will appear here once you make a transaction.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
