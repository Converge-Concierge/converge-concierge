import { useState } from "react";
import { useLocation, Link } from "wouter";
import { motion } from "framer-motion";
import { Hexagon, Link2, ArrowRight, ShieldX, KeyRound } from "lucide-react";
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

export default function SponsorLoginPage() {
  const [, nav] = useLocation();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const token = extractToken(value);
    if (!token) {
      setError("Please paste your full access link or token.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/sponsor-access/${token}`);
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        const body = await res.json().catch(() => ({}));
        setError(body.message || "This link is invalid or has been revoked.");
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      localStorage.setItem("sponsor_token", token);
      nav("/sponsor/dashboard");
    } catch {
      setError("Network error. Please check your connection and try again.");
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
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-12 w-12 rounded-2xl bg-accent/10 flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-accent" />
              </div>
            </div>
            <h1 className="text-2xl font-display font-bold text-foreground mb-2">Sponsor Access</h1>
            <p className="text-sm text-muted-foreground">
              Paste the access link you received from your event coordinator to view your meeting schedule.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="token-input" className="text-sm font-medium">Access Link or Token</Label>
              <div className="relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <Input
                  id="token-input"
                  data-testid="input-sponsor-token"
                  className="pl-9 font-mono text-sm"
                  placeholder="https://… or paste token"
                  value={value}
                  onChange={(e) => { setValue(e.target.value); setError(""); }}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl bg-destructive/8 border border-destructive/20 px-4 py-3">
                <ShieldX className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{error}</p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full gap-2"
              disabled={loading || !value.trim()}
              data-testid="btn-sponsor-login"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-primary-foreground/40 border-t-primary-foreground rounded-full animate-spin" />
                  Verifying…
                </span>
              ) : (
                <>View My Meetings <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Don't have an access link? Contact your event coordinator.
          </p>
        </div>
      </motion.div>
    </div>
  );
}
