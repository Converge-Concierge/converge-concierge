import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { Lock, KeyRound, CheckCircle2, AlertCircle, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { AppLogoMark } from "@/components/AppLogoMark";
import { useAppBranding } from "@/hooks/use-app-branding";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function PasswordStrengthBar({ password }: { password: string }) {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /[0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const colors = ["bg-muted", "bg-red-400", "bg-amber-400", "bg-teal-400", "bg-teal-500"];
  const labels = ["", "Too weak", "Weak", "Good", "Strong"];
  if (!password) return null;
  return (
    <div className="mt-2 space-y-1.5">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i < score ? colors[score] : "bg-muted"}`} />
        ))}
      </div>
      <p className={`text-xs ${score < 2 ? "text-red-500" : score < 4 ? "text-amber-600" : "text-teal-600"}`}>{labels[score]}</p>
    </div>
  );
}

export default function AdminResetPasswordPage() {
  const { appName } = useAppBranding();
  const [, nav] = useLocation();
  const [token, setToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [tokenMissing, setTokenMissing] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("token");
    if (t) {
      setToken(t);
    } else {
      setTokenMissing(true);
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one uppercase letter, one lowercase letter, and one number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.message ?? "Reset failed. Please try again.");
        return;
      }
      setSuccess(true);
      setTimeout(() => nav("/login"), 3000);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md px-6"
      >
        <div className="flex justify-center mb-8">
          <Link href="/login">
            <div className="flex items-center gap-3 cursor-pointer">
              <AppLogoMark containerClassName="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" iconClassName="h-6 w-6" imgClassName="h-9 max-w-[160px] object-contain" />
              <span className="font-display text-xl font-bold text-foreground tracking-tight">{appName}</span>
            </div>
          </Link>
        </div>

        <div className="bg-card rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50 p-8 sm:p-10">
          {success ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-teal-600" />
                </div>
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-3">Password reset</h1>
              <p className="text-sm text-muted-foreground mb-6">
                Your password has been reset successfully. You can now sign in with your new password.
              </p>
              <p className="text-xs text-muted-foreground mb-4">Redirecting to sign in…</p>
              <Link href="/login">
                <Button className="w-full gap-2">
                  <ArrowLeft className="h-4 w-4" /> Go to Sign In
                </Button>
              </Link>
            </div>
          ) : tokenMissing ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-destructive/10 flex items-center justify-center">
                  <AlertCircle className="h-7 w-7 text-destructive" />
                </div>
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-3">Invalid reset link</h1>
              <p className="text-sm text-muted-foreground mb-6">
                This password reset link is invalid or has expired. Please request a new reset link.
              </p>
              <Link href="/admin/forgot-password">
                <Button className="w-full gap-2" data-testid="btn-request-new-link">
                  Request New Reset Link
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <KeyRound className="h-6 w-6 text-accent" />
                  </div>
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-2">Reset Password</h1>
                <p className="text-sm text-muted-foreground">Create a new password for your admin account.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="new-password"
                      type={showPw ? "text" : "password"}
                      data-testid="input-new-password"
                      className="pl-9 pr-10"
                      placeholder="Min 8 chars, A-Z, a-z, 0-9"
                      value={newPassword}
                      onChange={(e) => { setNewPassword(e.target.value); setError(""); }}
                      required
                    />
                    <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <PasswordStrengthBar password={newPassword} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-sm font-medium">Confirm New Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      data-testid="input-confirm-password"
                      className="pl-9 pr-10"
                      placeholder="Re-enter your password"
                      value={confirmPassword}
                      onChange={(e) => { setConfirmPassword(e.target.value); setError(""); }}
                      required
                    />
                    <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-xs text-destructive">Passwords do not match.</p>
                  )}
                </div>

                {error && (
                  <div className="flex items-start gap-2.5 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                    <p className="text-sm text-destructive">{error}</p>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full gap-2"
                  disabled={loading || !newPassword || !confirmPassword}
                  data-testid="btn-reset-password"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                      Resetting…
                    </span>
                  ) : (
                    <><KeyRound className="h-4 w-4" /> Reset Password</>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/admin/forgot-password">
                  <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
                    <ArrowLeft className="h-3.5 w-3.5" /> Request new reset link
                  </button>
                </Link>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
