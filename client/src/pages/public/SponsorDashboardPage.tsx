import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Hexagon, ShieldX, Calendar, MapPin, Building2, Users,
  CheckCircle2, Clock, Handshake, Linkedin, LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface DashboardData {
  sponsor: { id: string; name: string; level: string; logoUrl: string };
  event: { id: string; name: string; slug: string; location: string; startDate: string; endDate: string };
  stats: { total: number; scheduled: number; completed: number; cancelled: number; companies: number };
  meetings: {
    id: string;
    date: string;
    time: string;
    location: string;
    status: string;
    attendee: { name: string; company: string; title: string; email: string; linkedinUrl?: string };
  }[];
}

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow:    "bg-yellow-100 text-yellow-700 border-yellow-200",
};

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ElementType }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col gap-3">
      <div className="h-9 w-9 rounded-xl bg-muted flex items-center justify-center">
        <Icon className="h-4 w-4 text-accent" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SponsorDashboardPage() {
  const [, nav] = useLocation();
  const token = localStorage.getItem("sponsor_token") ?? "";

  useEffect(() => {
    if (!token) nav("/sponsor/login");
  }, [token]);

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/sponsor-access", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-access/${token}`);
      if (!res.ok) throw new Error("Invalid or expired token");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  function handleSignOut() {
    localStorage.removeItem("sponsor_token");
    nav("/sponsor/login");
  }

  // ── Loading ──
  if (!token || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  // ── Access denied ──
  if (isError || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:block">Converge Concierge</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="bg-card rounded-2xl border border-border/60 shadow-xl p-10 max-w-sm w-full text-center"
          >
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-sm text-muted-foreground mb-6">
              This link is invalid, has been revoked, or has expired. Please contact your event coordinator for a new access link.
            </p>
            <Button variant="outline" onClick={handleSignOut}>Back to Login</Button>
          </motion.div>
        </main>
      </div>
    );
  }

  const { sponsor, event, stats, meetings } = data;

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:block">Converge Concierge</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 border border-green-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700">Secure Access</span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleSignOut}
            data-testid="btn-sign-out"
          >
            <LogOut className="h-4 w-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="flex-1 relative z-10 pb-20">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="w-full max-w-5xl mx-auto px-6 pt-8 space-y-8"
        >
          {/* Sponsor + Event header */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-muted border border-border flex items-center justify-center shrink-0">
                {sponsor.logoUrl ? (
                  <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 max-w-[48px] object-contain" />
                ) : (
                  <Building2 className="h-7 w-7 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-sponsor-name">{sponsor.name}</h1>
                  <span className="text-xs font-semibold bg-yellow-100 text-yellow-800 border border-yellow-300 px-2.5 py-0.5 rounded-full">
                    {sponsor.level} Sponsor
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                    {event.slug}
                  </span>
                  <span className="font-medium text-foreground">{event.name}</span>
                </div>
                <div className="flex flex-wrap items-center gap-4 mt-1.5 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-accent" />
                    {format(parseISO(event.startDate), "MMMM d")} – {format(parseISO(event.endDate), "MMMM d, yyyy")}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />{event.location}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Total Meetings"  value={stats.total}     icon={Handshake} />
            <StatCard label="Scheduled"        value={stats.scheduled} icon={Clock} />
            <StatCard label="Completed"        value={stats.completed} icon={CheckCircle2} />
            <StatCard label="Companies Met"    value={stats.companies} icon={Users} />
          </div>

          {/* Meeting list */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Handshake className="h-4 w-4 text-accent" /> Your Meetings
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} · {event.name}
              </p>
            </div>

            {meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Handshake className="h-8 w-8 opacity-20" />
                <p className="text-sm">No meetings scheduled yet.</p>
              </div>
            ) : (
              <>
                {/* Table header */}
                <div className="hidden sm:grid grid-cols-[120px_1fr_140px_110px_100px] gap-4 px-6 py-2.5 bg-muted/40 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Date / Time</span>
                  <span>Attendee</span>
                  <span>Company</span>
                  <span>Location</span>
                  <span>Status</span>
                </div>
                <div className="divide-y divide-border/40">
                  {[...meetings]
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                    .map((m) => (
                      <div
                        key={m.id}
                        className="px-6 py-4 flex flex-col sm:grid sm:grid-cols-[120px_1fr_140px_110px_100px] sm:items-center gap-3 sm:gap-4 hover:bg-muted/30 transition-colors"
                        data-testid={`meeting-row-${m.id}`}
                      >
                        {/* Date + Time */}
                        <div className="shrink-0">
                          <p className="text-sm font-semibold text-foreground">{m.date}</p>
                          <p className="text-xs text-muted-foreground">{fmt12(m.time)}</p>
                        </div>

                        {/* Attendee */}
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold text-foreground" data-testid={`text-attendee-name-${m.id}`}>{m.attendee.name}</p>
                            {m.attendee.linkedinUrl && (
                              <a
                                href={m.attendee.linkedinUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[#0077B5] hover:opacity-80 transition-opacity"
                                title="View LinkedIn Profile"
                                data-testid={`link-linkedin-${m.id}`}
                              >
                                <Linkedin className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{m.attendee.title}</p>
                        </div>

                        {/* Company */}
                        <div className="min-w-0">
                          <p className="text-sm text-foreground truncate" data-testid={`text-attendee-company-${m.id}`}>{m.attendee.company}</p>
                        </div>

                        {/* Location */}
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground min-w-0">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{m.location}</span>
                        </div>

                        {/* Status */}
                        <div>
                          <span className={cn(
                            "text-xs font-semibold px-2.5 py-1 rounded-full border w-fit block",
                            statusColors[m.status] ?? "bg-muted text-muted-foreground border-muted"
                          )}>
                            {m.status}
                          </span>
                        </div>
                      </div>
                    ))}
                </div>
              </>
            )}
          </div>
        </motion.div>
      </main>

      <footer className="w-full border-t border-border/50 bg-white/50 py-5 relative z-10 text-center shrink-0">
        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} Converge Concierge. This is a private, secure page.
        </p>
      </footer>
    </div>
  );
}
