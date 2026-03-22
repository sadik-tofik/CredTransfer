import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
  return !!(supabaseUrl && supabaseAnonKey);
};

// Create a mock client for when Supabase is not configured
const createMockClient = (): SupabaseClient => {
  const handler = {
    get: () => {
      return new Proxy(() => {}, {
        get: () => handler.get(),
        apply: () => {
          console.warn('Supabase is not configured. Please add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.');
          return Promise.resolve({ data: null, error: { message: 'Supabase not configured' } });
        },
      });
    },
  };
  return new Proxy({} as SupabaseClient, handler);
};

// Client-side Supabase client (uses anon key, respects RLS)
export const supabase: SupabaseClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : createMockClient();

// Server-side admin client (uses service role key, bypasses RLS)
export const supabaseAdmin: SupabaseClient = supabaseUrl && supabaseServiceKey
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : createMockClient();

export default supabase;
