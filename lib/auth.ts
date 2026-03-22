import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from './supabase';
import type { User } from '@supabase/supabase-js';

export interface UserWithRole extends User {
  role?: string;
}

export async function getServerSession() {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  
  if (error || !user) {
    return null;
  }

  // Get user role from database
  const { data: userData } = await supabaseAdmin
    .from('users')
    .select('role, full_name')
    .eq('id', user.id)
    .single();

  return {
    user: {
      ...user,
      role: userData?.role || 'graduate',
      name: userData?.full_name || user.user_metadata?.full_name,
    },
  };
}

export async function requireAuth() {
  const session = await getServerSession();
  
  if (!session) {
    throw new Error('Unauthorized');
  }
  
  return session;
}

export async function requireRole(allowedRoles: string[]) {
  const session = await requireAuth();
  
  if (!allowedRoles.includes(session.user.role)) {
    throw new Error('Forbidden');
  }
  
  return session;
}

export async function logAuditAction(userId: string, action: string, details: Record<string, unknown>) {
  await supabaseAdmin.from('audit_logs').insert({
    user_id: userId,
    action,
    details,
  });
}
