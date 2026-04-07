'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useForm } from 'react-hook-form';
import type { User } from '@supabase/supabase-js';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';

const profileSchema = z.object({
  phone: z.string().optional().refine(
    (val) => !val || /^(\+251[79]\d{8}|0[79]\d{8})$/.test(val.replace(/\s/g, '')),
    { message: 'Invalid Ethiopian phone number' }
  ),
});

type ProfileFormData = z.infer<typeof profileSchema>;

interface ProfileData {
  id: string;
  student_id: string;
  graduation_year: number;
  department: string;
  fee_cleared: boolean;
  user: {
    id: string;
    email: string;
    full_name: string;
    phone: string | null;
    is_verified: boolean;
  };
}

export default function GraduateProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase.auth]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  });

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const response = await axios.get('/api/graduate/profile');
        setProfile(response.data.data);
        reset({ phone: response.data.data?.user?.phone || '' });
      } catch (error) {
        console.error('Failed to fetch profile:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [reset]);

  const onSubmit = async (data: ProfileFormData) => {
    setIsSaving(true);
    try {
      await axios.put('/api/graduate/profile', data);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64 bg-white/10" />
        <Skeleton className="h-96 w-full bg-white/10" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">My Profile</h1>
        <p className="text-white/50 text-sm">View and manage your account information</p>
      </div>

      {/* Profile Card */}
      <Card className="bg-gradient-to-r from-green-900/30 to-green-800/20 border-green-700/50">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-24 h-24 bg-green-600 rounded-full flex items-center justify-center text-white text-4xl font-bold">
              {user?.user_metadata?.full_name?.split(' ').map((n: string) => n[0]).join('').slice(0, 2) || 'GR'}
            </div>
            <div className="text-center sm:text-left">
              <h2 className="text-white text-2xl font-bold">{user?.user_metadata?.full_name}</h2>
              <p className="text-green-300/70">{profile?.department}</p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mt-2">
                <Badge className="bg-green-900/50 text-green-300 border-green-700">
                  ID: {profile?.student_id}
                </Badge>
                <Badge className="bg-blue-900/50 text-blue-300 border-blue-700">
                  Class of {profile?.graduation_year}
                </Badge>
                {profile?.fee_cleared ? (
                  <Badge className="bg-green-900/50 text-green-300 border-green-700">
                    Fee Cleared
                  </Badge>
                ) : (
                  <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700">
                    Fee Pending
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Account Information */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Account Information</CardTitle>
          <CardDescription className="text-white/60">
            Your account details from registration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-white/60">Full Name</Label>
              <Input
                value={profile?.user?.full_name || ''}
                disabled
                className="bg-white/5 border-white/10 text-white/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/60">Email Address</Label>
              <Input
                value={profile?.user?.email || ''}
                disabled
                className="bg-white/5 border-white/10 text-white/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/60">Student ID</Label>
              <Input
                value={profile?.student_id || ''}
                disabled
                className="bg-white/5 border-white/10 text-white/60"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-white/60">Department</Label>
              <Input
                value={profile?.department || ''}
                disabled
                className="bg-white/5 border-white/10 text-white/60"
              />
            </div>
          </div>
          <p className="text-white/30 text-xs">
            To update your name, email, or student ID, please contact the registrar office.
          </p>
        </CardContent>
      </Card>

      {/* Editable Information */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Contact Information</CardTitle>
          <CardDescription className="text-white/60">
            Update your phone number for notifications
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label className="text-white/80">Phone Number</Label>
              <Input
                {...register('phone')}
                placeholder="+251 9XX XXX XXX"
                className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-green-500"
              />
              {errors.phone && (
                <p className="text-red-400 text-sm">{errors.phone.message}</p>
              )}
              <p className="text-white/40 text-xs">
                Format: +251 9XX XXX XXX or 09XX XXX XXX
              </p>
            </div>

            <Button
              type="submit"
              disabled={!isDirty || isSaving}
              className="bg-green-600 hover:bg-green-700"
            >
              {isSaving ? 'Saving...' : 'Save Changes'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Security</CardTitle>
          <CardDescription className="text-white/60">
            Manage your account security settings
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-white/5 rounded-lg">
            <div>
              <p className="text-white font-medium">Email Verification</p>
              <p className="text-white/50 text-sm">Your email address is verified</p>
            </div>
            <Badge className="bg-green-900/50 text-green-300 border-green-700">
              Verified
            </Badge>
          </div>

          <Separator className="bg-white/10" />

          <div className="flex items-center justify-between">
            <div>
              <p className="text-white font-medium">Change Password</p>
              <p className="text-white/50 text-sm">Update your account password</p>
            </div>
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => toast.info('Password change will be available soon')}
            >
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
