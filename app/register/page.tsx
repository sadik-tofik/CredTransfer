'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import axios from 'axios';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { registerSchema, type RegisterFormData } from '@/lib/validations';

const DEPARTMENTS = [
  'Computer Science and Engineering',
  'Electrical and Computer Engineering',
  'Medicine and Health Sciences',
  'Natural Sciences',
  'Business and Economics',
  'Law',
  'Agriculture and Veterinary Medicine',
  'Social Sciences and Humanities',
  'Institute of Technology',
  'Other',
];

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<'graduate' | 'registrar'>('graduate');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: { 
      role: 'graduate',
      full_name: '',
      email: '',
      phone: '',
      student_id: '',
      employee_id: '',
      department: '',
      graduation_year: undefined,
      password: '',
      confirm_password: ''
    },
    mode: 'onBlur'
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    try {
      await axios.post('/api/auth/register', data);
      setSuccess(true);
      toast.success('Account created! You can now log in.');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-white/5 border-white/10 max-w-md w-full text-center p-8">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-white text-2xl font-bold mb-2">Account Created!</h2>
          <p className="text-white/60 mb-6">
            Your account has been created successfully. You can now log in with your credentials.
          </p>
          <Button
            onClick={() => router.push('/login')}
            className="bg-blue-600 hover:bg-blue-700 w-full"
          >
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center font-bold text-white text-lg">CT</div>
            <div className="text-left">
              <p className="text-white font-bold">CredTransfer</p>
              <p className="text-blue-300 text-xs">Jimma University</p>
            </div>
          </Link>
        </div>

        <Card className="bg-white/5 border-white/10 backdrop-blur-sm">
          <CardHeader className="text-center">
            <CardTitle className="text-white text-2xl">Create Account</CardTitle>
            <CardDescription className="text-white/60">
              Join the Jimma University credential system
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Role Toggle */}
            <div className="flex mb-6 bg-white/10 rounded-lg p-1">
              {(['graduate', 'registrar'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => { setRole(r); setValue('role', r); }}
                  className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                    role === r
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-white/60 hover:text-white'
                  }`}
                >
                  {r === 'graduate' ? '🎓 Graduate' : '🏛️ Registrar'}
                </button>
              ))}
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-white/80">Full Name</Label>
                <input
                  {...register('full_name')}
                  placeholder="Abebe Bikila"
                  className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                />
                {errors.full_name && <p className="text-red-400 text-sm">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Email Address</Label>
                <input
                  type="email"
                  {...register('email')}
                  placeholder="your@email.com"
                  className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                />
                {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Phone Number (Optional)</Label>
                <input
                  {...register('phone')}
                  placeholder="+251 9XX XXX XXX"
                  className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                />
                {errors.phone && <p className="text-red-400 text-sm">{errors.phone.message}</p>}
              </div>

              {role === 'graduate' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/80">Student ID</Label>
                    <input
                      {...register('student_id')}
                      placeholder="JU/1234/15"
                      className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                    />
                    {errors.student_id && <p className="text-red-400 text-sm">{errors.student_id.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-white/80">Department</Label>
                      <Select onValueChange={(v) => setValue('department', v as string)}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white">
                          <SelectValue placeholder="Select dept." />
                        </SelectTrigger>
                        <SelectContent>
                          {DEPARTMENTS.map((d) => (
                            <SelectItem key={d} value={d}>{d}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-white/80">Grad. Year</Label>
                      <input
                        type="number"
                        {...register('graduation_year', { valueAsNumber: true })}
                        placeholder="2023"
                        min={2000}
                        max={new Date().getFullYear()}
                        className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                      />
                    </div>
                  </div>
                </>
              )}

              {role === 'registrar' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/80">Employee ID</Label>
                    <input
                      {...register('employee_id')}
                      placeholder="JU-REG-XXX"
                      className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                    />
                    {errors.employee_id && <p className="text-red-400 text-sm">{errors.employee_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Department</Label>
                    <input
                      {...register('department')}
                      placeholder="Academic Registrar"
                      className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-white/80">Password</Label>
                  <input
                    type="password"
                    {...register('password')}
                    placeholder="••••••••"
                    className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                  />
                  {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Confirm Password</Label>
                  <input
                    type="password"
                    {...register('confirm_password')}
                    placeholder="••••••••"
                    className="w-full h-8 rounded-lg border border-white/20 bg-white/10 px-2.5 py-1 text-base text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50 md:text-sm"
                  />
                  {errors.confirm_password && <p className="text-red-400 text-sm">{errors.confirm_password.message}</p>}
                </div>
              </div>

              <p className="text-white/30 text-xs">
                Password must be at least 8 characters with uppercase and number.
              </p>

              <Button
                type="submit"
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="mt-4 text-center">
              <p className="text-white/50 text-sm">
                Already have an account?{' '}
                <Link href="/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
