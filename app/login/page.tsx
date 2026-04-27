'use client';

import { useState, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { loginSchema, type LoginFormData } from '@/lib/validations';

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const supabase = createClient();

  const verified = searchParams.get('verified');
  const errorParam = searchParams.get('error');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({ 
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur'
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: data.email,
        password: data.password,
      });

      if (authError) {
        setError(authError.message === 'Invalid login credentials' 
          ? 'Invalid email or password' 
          : authError.message);
        setIsLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Login failed. Please try again.');
        setIsLoading(false);
        return;
      }

      toast.success('Welcome back!');

      const role = authData.user.user_metadata?.role;
      if (role === 'registrar' || role === 'admin') {
        router.push('/registrar/dashboard');
      } else if (role === 'graduate') {
        router.push('/graduate/dashboard');
      } else {
        router.push('/');
      }
      
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">
              CT
            </div>
            <div className="text-left">
              <p className="text-white font-bold">CredTransfer</p>
              <p className="text-blue-300 text-xs">Jimma University</p>
            </div>
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">Welcome Back</CardTitle>
            <CardDescription className="text-white/60">
              Sign in to your CredTransfer account
            </CardDescription>
          </CardHeader>
          <CardContent>
            {verified && (
              <Alert className="mb-4 bg-green-900/30 border-green-700 text-green-300">
                <AlertDescription>
                  Email verified successfully! You can now sign in.
                </AlertDescription>
              </Alert>
            )}

            {(error || errorParam === 'unauthorized') && (
              <Alert className="mb-4 bg-red-900/30 border-red-700 text-red-300">
                <AlertDescription>
                  {error || 'You do not have permission to access that page.'}
                </AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/80">Email Address</Label>
                <input
                  id="email"
                  type="email"
                  placeholder="your@email.com"
                  {...register('email')}
                  className="w-full h-9 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50"
                />
                {errors.email && (
                  <p className="text-red-400 text-sm">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password" className="text-white/80">Password</Label>
                  <Link href="/reset-password" className="text-blue-400 text-sm hover:text-blue-300">
                    Forgot password?
                  </Link>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password')}
                    className="w-full h-9 rounded-lg border border-white/20 bg-white/10 px-3 pr-10 py-1.5 text-sm text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-400 text-sm">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Signing in...
                  </span>
                ) : 'Sign In'}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-white/50 text-sm">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="text-blue-400 hover:text-blue-300">
                  Register here
                </Link>
              </p>
            </div>

            <div className="mt-4 pt-4 border-t border-white/10 text-center">
              <p className="text-white/30 text-xs mb-2">Demo Credentials</p>
              <div className="text-white/40 text-xs space-y-1">
                <p>Registrar: registrar@ju.edu.et / Admin@123456</p>
                <p>Graduate: abebe.bikila@ju.edu.et / Admin@123456</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/verify" className="text-blue-400 text-sm hover:text-blue-300">
            Verify a document without signing in →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
