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

// Reusable eye icon components
function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeSlashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [role, setRole] = useState<'graduate' | 'registrar'>('graduate');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

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
          <Button onClick={() => router.push('/login')} className="bg-blue-600 hover:bg-blue-700 w-full">
            Go to Login
          </Button>
        </Card>
      </div>
    );
  }

  const inputClass = "w-full h-9 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-sm text-white placeholder:text-white/40 outline-none focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50";

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
                <input {...register('full_name')} placeholder="Abebe Bikila" className={inputClass} />
                {errors.full_name && <p className="text-red-400 text-sm">{errors.full_name.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Email Address</Label>
                <input type="email" {...register('email')} placeholder="your@email.com" className={inputClass} />
                {errors.email && <p className="text-red-400 text-sm">{errors.email.message}</p>}
              </div>

              <div className="space-y-2">
                <Label className="text-white/80">Phone Number (Optional)</Label>
                <input {...register('phone')} placeholder="+251 9XX XXX XXX" className={inputClass} />
                {errors.phone && <p className="text-red-400 text-sm">{errors.phone.message}</p>}
              </div>

              {role === 'graduate' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/80">Student ID</Label>
                    <input {...register('student_id')} placeholder="JU/1234/15" className={inputClass} />
                    {errors.student_id && <p className="text-red-400 text-sm">{errors.student_id.message}</p>}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-white/80">Department</Label>
                      <Select onValueChange={(v) => setValue('department', v as string)}>
                        <SelectTrigger className="bg-white/10 border-white/20 text-white h-9">
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
                        className={inputClass}
                      />
                    </div>
                  </div>
                </>
              )}

              {role === 'registrar' && (
                <>
                  <div className="space-y-2">
                    <Label className="text-white/80">Employee ID</Label>
                    <input {...register('employee_id')} placeholder="JU-REG-XXX" className={inputClass} />
                    {errors.employee_id && <p className="text-red-400 text-sm">{errors.employee_id.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Department</Label>
                    <input {...register('department')} placeholder="Academic Registrar" className={inputClass} />
                  </div>
                </>
              )}

              {/* Password fields with show/hide toggles */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-white/80">Password</Label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      {...register('password')}
                      placeholder="••••••••"
                      className={`${inputClass} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {errors.password && <p className="text-red-400 text-sm">{errors.password.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label className="text-white/80">Confirm Password</Label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      {...register('confirm_password')}
                      placeholder="••••••••"
                      className={`${inputClass} pr-9`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/80 transition-colors"
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                    >
                      {showConfirmPassword ? <EyeSlashIcon /> : <EyeIcon />}
                    </button>
                  </div>
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
