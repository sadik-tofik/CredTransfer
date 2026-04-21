"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { resetPasswordSchema, newPasswordSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";
export const runtime = "edge";

type ResetFormData = { email: string };
type NewPasswordFormData = {
  token: string;
  password: string;
  confirm_password: string;
};

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [passwordReset, setPasswordReset] = useState(false);

  const {
    register: registerEmail,
    handleSubmit: handleEmailSubmit,
    formState: { errors: emailErrors },
  } = useForm<ResetFormData>({
    resolver: zodResolver(resetPasswordSchema),
  });

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    formState: { errors: passwordErrors },
  } = useForm<NewPasswordFormData>({
    resolver: zodResolver(newPasswordSchema),
    defaultValues: { token: token || "" },
  });

  const onEmailSubmit = async (data: ResetFormData) => {
    setIsLoading(true);
    try {
      await axios.post("/api/auth/reset-password", { email: data.email });
      setEmailSent(true);
      toast.success("Password reset email sent!");
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to send reset email");
    } finally {
      setIsLoading(false);
    }
  };

  const onPasswordSubmit = async (data: NewPasswordFormData) => {
    setIsLoading(true);
    try {
      await axios.post("/api/auth/reset-password", {
        token: data.token,
        password: data.password,
      });
      setPasswordReset(true);
      toast.success("Password reset successfully!");
    } catch (error) {
      const err = error as { response?: { data?: { error?: string } } };
      toast.error(err.response?.data?.error || "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  if (passwordReset) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-white/5 border-white/10 max-w-md w-full text-center p-8">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-white text-2xl font-bold mb-2">
            Password Reset Complete
          </h2>
          <p className="text-white/60 mb-6">
            Your password has been successfully reset. You can now sign in with
            your new password.
          </p>
          <Link href="/login">
            <Button className="bg-blue-600 hover:bg-blue-700 w-full">
              Go to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (emailSent && !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <Card className="bg-white/5 border-white/10 max-w-md w-full text-center p-8">
          <div className="text-6xl mb-4">📧</div>
          <h2 className="text-white text-2xl font-bold mb-2">
            Check Your Email
          </h2>
          <p className="text-white/60 mb-6">
            We&apos;ve sent a password reset link to your email address. Please
            check your inbox and follow the instructions.
          </p>
          <Link href="/login">
            <Button
              variant="outline"
              className="border-white/30 text-white hover:bg-white/10 w-full"
            >
              Back to Login
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

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
            <CardTitle className="text-white text-2xl">
              {token ? "Set New Password" : "Reset Password"}
            </CardTitle>
            <CardDescription className="text-white/60">
              {token
                ? "Enter your new password below"
                : "Enter your email address to receive a reset link"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {token ? (
              <form
                onSubmit={handlePasswordSubmit(onPasswordSubmit)}
                className="space-y-4"
              >
                <input
                  type="hidden"
                  {...registerPassword("token")}
                  value={token}
                />

                <div className="space-y-2">
                  <Label className="text-white/80">New Password</Label>
                  <Input
                    type="password"
                    {...registerPassword("password")}
                    placeholder="••••••••"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-500"
                  />
                  {passwordErrors.password && (
                    <p className="text-red-400 text-sm">
                      {passwordErrors.password.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Confirm New Password</Label>
                  <Input
                    type="password"
                    {...registerPassword("confirm_password")}
                    placeholder="••••••••"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-500"
                  />
                  {passwordErrors.confirm_password && (
                    <p className="text-red-400 text-sm">
                      {passwordErrors.confirm_password.message}
                    </p>
                  )}
                </div>

                <p className="text-white/30 text-xs">
                  Password must be at least 8 characters with uppercase and
                  number.
                </p>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Resetting..." : "Reset Password"}
                </Button>
              </form>
            ) : (
              <form
                onSubmit={handleEmailSubmit(onEmailSubmit)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-white/80">Email Address</Label>
                  <Input
                    type="email"
                    {...registerEmail("email")}
                    placeholder="your@email.com"
                    className="bg-white/10 border-white/20 text-white placeholder:text-white/40 focus:border-blue-500"
                  />
                  {emailErrors.email && (
                    <p className="text-red-400 text-sm">
                      {emailErrors.email.message}
                    </p>
                  )}
                </div>

                <Button
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700"
                  disabled={isLoading}
                >
                  {isLoading ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            )}

            <div className="mt-6 text-center">
              <Link
                href="/login"
                className="text-blue-400 text-sm hover:text-blue-300"
              >
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
