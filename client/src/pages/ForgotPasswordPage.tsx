import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Mail, ArrowLeft, CheckCircle2, AlertCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AppLogoMark } from "@/components/AppLogoMark";
import { useAppBranding } from "@/hooks/use-app-branding";

export default function ForgotPasswordPage() {
  const { appName } = useAppBranding();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setError(data.message ?? "Too many requests. Please wait before trying again.");
        return;
      }
      setSent(true);
    } catch {
      setError("Something went wrong. Please try again.");
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
          {sent ? (
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="h-14 w-14 rounded-2xl bg-teal-100 flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-teal-600" />
                </div>
              </div>
              <h1 className="text-2xl font-display font-bold text-foreground mb-3">Check your email</h1>
              <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. The link expires in 1 hour.
              </p>
              <p className="text-xs text-muted-foreground mb-6">
                Don't see it? Check your spam folder or request another link.
              </p>
              <div className="flex flex-col gap-3">
                <Button variant="outline" className="w-full gap-2" onClick={() => { setSent(false); }} data-testid="btn-request-another">
                  Request another link
                </Button>
                <Link href="/login">
                  <Button variant="ghost" className="w-full gap-2">
                    <ArrowLeft className="h-4 w-4" /> Back to Sign In
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <div className="flex justify-center mb-4">
                  <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-accent" />
                  </div>
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-2">Forgot Password</h1>
                <p className="text-sm text-muted-foreground">
                  Enter your work email and we'll send you a link to reset your password.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="fp-email" className="text-sm font-medium">Work Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      id="fp-email"
                      type="email"
                      data-testid="input-forgot-email"
                      className="pl-9"
                      placeholder="you@company.com"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setError(""); }}
                      autoComplete="email"
                      required
                    />
                  </div>
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
                  disabled={loading || !email.trim()}
                  data-testid="btn-send-reset-link"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Reset Link</>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center">
                <Link href="/login">
                  <button className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors" data-testid="btn-back-to-signin">
                    <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
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
