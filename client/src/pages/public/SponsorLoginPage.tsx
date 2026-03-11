import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Hexagon, Link2, ArrowRight, ShieldX, KeyRound, Mail, CheckCircle2, ArrowLeft, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function extractToken(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/\/sponsor-access\/([a-f0-9]{64})/);
  if (match) return match[1];
  if (/^[a-f0-9]{64}$/.test(trimmed)) return trimmed;
  return "";
}

type Mode = "email" | "token";

const ERROR_MESSAGES: Record<string, string> = {
  missing_token: "The login link is missing. Please request a new one.",
  invalid_token: "This login link is invalid or has expired. Please request a new one.",
  token_used: "This login link has already been used. Please request a new one.",
  token_expired: "This login link has expired. Please request a new one.",
  no_dashboard_access: "Your sponsor account doesn't have active dashboard access. Contact your event coordinator.",
};

export default function SponsorLoginPage() {
  const [, nav] = useLocation();

  // Read error from URL query param (set by magic link redirect)
  const params = new URLSearchParams(window.location.search);
  const urlError = params.get("error");

  const [mode, setMode] = useState<Mode>("email");

  // Email magic link state
  const [email, setEmail] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState(urlError ? (ERROR_MESSAGES[urlError] ?? "An error occurred.") : "");

  // Token paste state
  const [tokenValue, setTokenValue] = useState("");
  const [tokenError, setTokenError] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError("");
    setEmailLoading(true);
    try {
      const res = await fetch("/api/sponsor/login-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (res.status === 429) {
        const data = await res.json().catch(() => ({}));
        setEmailError(data.message ?? "Too many requests. Please wait before trying again.");
        return;
      }
      setEmailSent(true);
    } catch {
      setEmailError("Something went wrong. Please try again.");
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleTokenSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTokenError("");
    const token = extractToken(tokenValue);
    if (!token) {
      setTokenError("Please paste your full access link or token.");
      return;
    }
    setTokenLoading(true);
    try {
      const res = await fetch(`/api/sponsor-access/${token}`);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const body = await res.json().catch(() => ({}));
        setTokenError(body.message || "This link is invalid or has been revoked.");
        return;
      }
      if (!res.ok) {
        setTokenError("Something went wrong. Please try again.");
        return;
      }
      localStorage.setItem("sponsor_token", token);
      nav("/sponsor/dashboard");
    } catch {
      setTokenError("Network error. Please check your connection and try again.");
    } finally {
      setTokenLoading(false);
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
          <Link href="/">
            <div className="flex items-center gap-3 cursor-pointer">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Hexagon className="h-6 w-6" />
              </div>
              <span className="font-display text-xl font-bold text-foreground tracking-tight">Converge Concierge</span>
            </div>
          </Link>
        </div>

        <div className="bg-card rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50 p-8 sm:p-10">
          <AnimatePresence mode="wait">
            {mode === "email" && !emailSent && (
              <motion.div key="email-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-accent" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-display font-bold text-foreground mb-2">Sponsor Dashboard Access</h1>
                  <p className="text-sm text-muted-foreground">
                    Enter your work email and we'll send you a secure link to access your sponsor dashboard.
                  </p>
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="sponsor-email" className="text-sm font-medium">Work Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="sponsor-email"
                        type="email"
                        data-testid="input-sponsor-email"
                        className="pl-9"
                        placeholder="you@company.com"
                        value={email}
                        onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                        autoComplete="email"
                        required
                      />
                    </div>
                  </div>

                  {emailError && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                      <ShieldX className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{emailError}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full gap-2" disabled={emailLoading || !email.trim()} data-testid="btn-send-login-link">
                    {emailLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        Sending…
                      </span>
                    ) : (
                      <><Send className="h-4 w-4" /> Send Login Link</>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => setMode("token")}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="btn-use-token"
                  >
                    Have an access token? Paste it here →
                  </button>
                </div>
              </motion.div>
            )}

            {mode === "email" && emailSent && (
              <motion.div key="email-sent" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="text-center">
                <div className="flex justify-center mb-4">
                  <div className="h-14 w-14 rounded-2xl bg-teal-100 flex items-center justify-center">
                    <CheckCircle2 className="h-7 w-7 text-teal-600" />
                  </div>
                </div>
                <h1 className="text-2xl font-display font-bold text-foreground mb-3">Check your email</h1>
                <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
                  If an account exists for <strong>{email}</strong>, a secure login link has been sent. The link expires in 24 hours.
                </p>
                <p className="text-xs text-muted-foreground mb-6">Don't see it? Check your spam folder or request another link.</p>
                <div className="flex flex-col gap-3">
                  <Button variant="outline" className="w-full gap-2" onClick={() => { setEmailSent(false); setEmail(""); }}>
                    Request another link
                  </Button>
                </div>
              </motion.div>
            )}

            {mode === "token" && (
              <motion.div key="token-form" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
                <div className="text-center mb-8">
                  <div className="flex justify-center mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                      <KeyRound className="h-6 w-6 text-accent" />
                    </div>
                  </div>
                  <h1 className="text-2xl font-display font-bold text-foreground mb-2">Access with Token</h1>
                  <p className="text-sm text-muted-foreground">
                    Paste the access link or token you received from your event coordinator.
                  </p>
                </div>

                <form onSubmit={handleTokenSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="token-input" className="text-sm font-medium">Access Link or Token</Label>
                    <div className="relative">
                      <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                      <Input
                        id="token-input"
                        data-testid="input-sponsor-token"
                        className="pl-9 font-mono text-sm"
                        placeholder="https://… or paste token"
                        value={tokenValue}
                        onChange={(e) => { setTokenValue(e.target.value); setTokenError(""); }}
                        autoComplete="off"
                        spellCheck={false}
                      />
                    </div>
                  </div>

                  {tokenError && (
                    <div className="flex items-start gap-2.5 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                      <ShieldX className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                      <p className="text-sm text-destructive">{tokenError}</p>
                    </div>
                  )}

                  <Button type="submit" className="w-full gap-2" disabled={tokenLoading || !tokenValue.trim()} data-testid="btn-sponsor-login">
                    {tokenLoading ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                        Verifying…
                      </span>
                    ) : (
                      <>View My Meetings <ArrowRight className="h-4 w-4" /></>
                    )}
                  </Button>
                </form>

                <div className="mt-6 text-center">
                  <button
                    onClick={() => { setMode("email"); setTokenError(""); }}
                    className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    data-testid="btn-use-email"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" /> Use email instead
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
