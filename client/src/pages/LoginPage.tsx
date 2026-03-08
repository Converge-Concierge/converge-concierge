import { useLocation, Link } from "wouter";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, Lock, Mail, ArrowRight, ShieldCheck, AlertCircle, KeyRound, CheckCircle2, ChevronLeft, Copy, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";

type FlowStep = "login" | "forgot-email" | "forgot-reset";

export default function LoginPage() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [email, setEmail] = useState("admin@converge.com");
  const [password, setPassword] = useState("password");
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password state
  const [step, setStep] = useState<FlowStep>("login");
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotError, setForgotError] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    try {
      await login(email, password);
      setLocation("/admin");
    } catch (err: any) {
      setError(err.message ?? "Login failed. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError("");
    setForgotLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Request failed");
      setResetToken(data.token);
      setStep("forgot-reset");
    } catch (err: any) {
      setForgotError(err.message ?? "Something went wrong");
    } finally {
      setForgotLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    setResetLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: tokenInput || resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Reset failed");
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err.message ?? "Password reset failed");
    } finally {
      setResetLoading(false);
    }
  };

  function copyToken() {
    navigator.clipboard.writeText(resetToken).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function backToLogin() {
    setStep("login");
    setForgotEmail("");
    setForgotError("");
    setResetError("");
    setResetToken("");
    setTokenInput("");
    setNewPassword("");
    setResetSuccess(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 z-0 flex">
        <div className="w-1/2 h-full bg-primary relative hidden lg:block">
          <img 
            src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80" 
            alt="Modern Architecture" 
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-primary to-primary/80" />
          <div className="relative z-10 flex flex-col justify-center h-full p-16 xl:p-24 text-primary-foreground max-w-2xl">
            <div className="mb-12">
              <Hexagon className="h-16 w-16 text-accent mb-6" />
              <h1 className="text-5xl font-display font-bold leading-tight mb-6">
                Command Center for Premium Events
              </h1>
              <p className="text-primary-foreground/70 text-lg leading-relaxed max-w-lg">
                Manage attendees, coordinate VIP meetings, and oversee sponsor interactions from one centralized concierge platform.
              </p>
            </div>
            
            <div className="space-y-6 mt-12 border-t border-primary-foreground/20 pt-12">
              <div className="flex items-center gap-4 text-primary-foreground/90">
                <div className="h-10 w-10 rounded-full bg-primary-foreground/10 flex items-center justify-center shrink-0">
                  <ShieldCheck className="h-5 w-5 text-accent" />
                </div>
                <p className="font-medium">Enterprise-grade security and access controls</p>
              </div>
            </div>
          </div>
        </div>
        <div className="w-full lg:w-1/2 h-full bg-background relative flex items-center justify-center p-6 sm:p-12">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.15] pointer-events-none" />
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-md relative z-10"
          >
            <div className="lg:hidden flex justify-center mb-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Hexagon className="h-7 w-7" />
              </div>
            </div>

            <div className="bg-card p-8 sm:p-10 rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50">
              <AnimatePresence mode="wait">
                {/* ── LOGIN ──────────────────────────────────────────────── */}
                {step === "login" && (
                  <motion.div
                    key="login"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="text-center sm:text-left mb-8">
                      <h2 className="text-3xl font-display font-bold text-foreground">Welcome Back</h2>
                      <p className="text-muted-foreground mt-2">Sign in to access the admin dashboard</p>
                    </div>

                    {error && (
                      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 mb-5">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        <p className="text-sm text-destructive">{error}</p>
                      </div>
                    )}

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="email" className="text-foreground/80 font-medium">Work Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                          <Input 
                            id="email" 
                            type="email" 
                            placeholder="admin@converge.com" 
                            className="pl-10 h-12 rounded-xl border-border/80 focus-visible:ring-accent"
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            data-testid="input-login-email"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="password" className="text-foreground/80 font-medium">Password</Label>
                        </div>
                        <div className="relative">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                          <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••" 
                            className="pl-10 pr-10 h-12 rounded-xl border-border/80 focus-visible:ring-accent"
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            data-testid="input-login-password"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-muted-foreground"
                            tabIndex={-1}
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>

                      <Button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-base mt-2 shadow-lg shadow-primary/25 transition-all group"
                        data-testid="button-login-submit"
                      >
                        {isLoading ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Authenticating...
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            Sign In to Dashboard
                            <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                          </span>
                        )}
                      </Button>
                    </form>

                    <div className="mt-6 space-y-3 text-center text-sm text-muted-foreground">
                      <button
                        type="button"
                        onClick={() => { setStep("forgot-email"); setForgotEmail(email); }}
                        className="text-foreground/70 hover:text-accent transition-colors underline underline-offset-4 text-sm"
                        data-testid="btn-forgot-password"
                      >
                        Forgot password?
                      </button>
                      <p>Not an administrator? <Link href="/" className="font-medium text-foreground hover:text-accent transition-colors">Return to events</Link></p>
                    </div>
                  </motion.div>
                )}

                {/* ── FORGOT — STEP 1: Enter Email ────────────────────────── */}
                {step === "forgot-email" && (
                  <motion.div
                    key="forgot-email"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <button
                      type="button"
                      onClick={backToLogin}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                      data-testid="btn-back-to-login"
                    >
                      <ChevronLeft className="h-4 w-4" /> Back to sign in
                    </button>

                    <div className="mb-6">
                      <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center mb-4">
                        <KeyRound className="h-6 w-6 text-accent" />
                      </div>
                      <h2 className="text-2xl font-display font-bold text-foreground">Password Recovery</h2>
                      <p className="text-muted-foreground mt-1.5 text-sm">Enter the email address associated with your admin account.</p>
                    </div>

                    {forgotError && (
                      <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 mb-5">
                        <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                        <p className="text-sm text-destructive">{forgotError}</p>
                      </div>
                    )}

                    <form onSubmit={handleForgotEmail} className="space-y-5">
                      <div className="space-y-2">
                        <Label htmlFor="forgot-email">Admin Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground/60" />
                          <Input
                            id="forgot-email"
                            type="email"
                            placeholder="admin@converge.com"
                            className="pl-10 h-12 rounded-xl border-border/80 focus-visible:ring-accent"
                            required
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            data-testid="input-forgot-email"
                          />
                        </div>
                      </div>
                      <Button
                        type="submit"
                        disabled={forgotLoading}
                        className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                        data-testid="btn-send-reset"
                      >
                        {forgotLoading ? (
                          <span className="flex items-center gap-2">
                            <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                            Generating token…
                          </span>
                        ) : "Generate Reset Token"}
                      </Button>
                    </form>
                  </motion.div>
                )}

                {/* ── FORGOT — STEP 2: Use Token ─────────────────────────── */}
                {step === "forgot-reset" && (
                  <motion.div
                    key="forgot-reset"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {resetSuccess ? (
                      <div className="text-center py-4">
                        <div className="h-14 w-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                          <CheckCircle2 className="h-7 w-7 text-green-600" />
                        </div>
                        <h2 className="text-xl font-display font-bold text-foreground mb-2">Password Updated</h2>
                        <p className="text-muted-foreground text-sm mb-6">Your password has been changed successfully.</p>
                        <Button onClick={backToLogin} className="w-full" data-testid="btn-back-after-reset">
                          Sign In with New Password
                        </Button>
                      </div>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => setStep("forgot-email")}
                          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
                        >
                          <ChevronLeft className="h-4 w-4" /> Back
                        </button>

                        <div className="mb-5">
                          <h2 className="text-2xl font-display font-bold text-foreground">Set New Password</h2>
                          <p className="text-muted-foreground mt-1 text-sm">Your reset token has been generated. Use it below to set a new password.</p>
                        </div>

                        {/* Dev token display */}
                        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide">Reset Token (Dev Preview)</p>
                          <div className="flex items-center gap-2">
                            <code className="text-xs text-amber-900 bg-amber-100 rounded px-2 py-1 flex-1 break-all" data-testid="text-reset-token">{resetToken}</code>
                            <button
                              type="button"
                              onClick={copyToken}
                              className="shrink-0 text-amber-700 hover:text-amber-900 transition-colors"
                              title="Copy token"
                            >
                              {copied ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                            </button>
                          </div>
                          <p className="text-[10px] text-amber-600">In production, this would be sent via email. Token expires in 1 hour.</p>
                        </div>

                        {resetError && (
                          <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/20 px-4 py-3 mb-4">
                            <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
                            <p className="text-sm text-destructive">{resetError}</p>
                          </div>
                        )}

                        <form onSubmit={handleReset} className="space-y-4">
                          <div className="space-y-1.5">
                            <Label htmlFor="token-input">Reset Token</Label>
                            <Input
                              id="token-input"
                              value={tokenInput || resetToken}
                              onChange={(e) => setTokenInput(e.target.value)}
                              placeholder="Paste reset token"
                              className="h-11 rounded-xl font-mono text-xs"
                              data-testid="input-reset-token"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="new-password">New Password</Label>
                            <div className="relative">
                              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/60" />
                              <Input
                                id="new-password"
                                type="password"
                                placeholder="At least 6 characters"
                                className="pl-9 h-11 rounded-xl border-border/80 focus-visible:ring-accent"
                                required
                                minLength={6}
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                data-testid="input-new-password"
                              />
                            </div>
                          </div>
                          <Button
                            type="submit"
                            disabled={resetLoading}
                            className="w-full h-12 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                            data-testid="btn-reset-password"
                          >
                            {resetLoading ? (
                              <span className="flex items-center gap-2">
                                <div className="h-4 w-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                                Updating…
                              </span>
                            ) : "Update Password"}
                          </Button>
                        </form>
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  );
}
