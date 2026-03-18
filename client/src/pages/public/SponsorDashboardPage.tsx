import { useEffect, useState, useRef } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { AppLogoMark } from "@/components/AppLogoMark";
import { useAppBranding } from "@/hooks/use-app-branding";
import {
  ShieldX, Calendar, MapPin, Building2, Users,
  CheckCircle2, Clock, Handshake, Linkedin, LogOut,
  Bell, BellOff, Download, ExternalLink, Video, Mail,
  UserCheck, AlertCircle, ChevronDown, ChevronUp, FileDown,
  BarChart3, Monitor, TrendingUp, Link2, X as XIcon, Gem, MessageSquare, Eye, MousePointerClick,
  CalendarX, ClipboardCheck, Package,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parseISO, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadICS, googleCalendarUrl } from "@/lib/ics";
import { SPONSOR_INFO_REQUEST_STATUSES } from "@shared/schema";
import SponsorDeliverablesTab from "@/components/sponsor/SponsorDeliverablesTab";
import AttendeeDiscoveryTab from "@/components/sponsor/AttendeeDiscoveryTab";

import { useToast } from "@/hooks/use-toast";

const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold:     "bg-amber-100 text-amber-900 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-700 border-orange-300",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface SponsorMeeting {
  id: string;
  date: string;
  time: string;
  location: string;
  status: string;
  meetingType: string;
  platform: string | null;
  preferredTimezone: string | null;
  meetingLink: string | null;
  attendee: { name: string; company: string; title: string; email: string; linkedinUrl?: string | null };
}

interface SponsorNotification {
  id: string;
  type: string;
  attendeeName: string;
  attendeeCompany: string;
  eventName: string;
  date: string;
  time: string;
  isRead: boolean;
  createdAt: string;
}

interface DashboardData {
  sponsor: {
    id: string; name: string; level: string; logoUrl: string;
    shortDescription?: string | null;
    websiteUrl?: string | null;
    linkedinUrl?: string | null;
    solutionsSummary?: string | null;
    contactName?: string | null;
    contactEmail?: string | null;
    repsJson?: string | null;
  };
  event: { id: string; name: string; slug: string; location: string; startDate: string; endDate: string; logoUrl?: string | null; accentColor?: string | null };
  stats: { total: number; scheduled: number; completed: number; cancelled: number; pendingOnline: number; companies: number };
  meetings: SponsorMeeting[];
  notifications: SponsorNotification[];
  analytics?: { profileViews: number; meetingCtaClicks: number };
}

interface AppBranding {
  appName: string; appLogoUrl: string; sponsorDashboardLogoUrl: string;
}

// ── Constants ──────────────────────────────────────────────────────────────────

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Completed:  "bg-green-100 text-green-700 border-green-200",
  Cancelled:  "bg-red-100 text-red-700 border-red-200",
  NoShow:     "bg-yellow-100 text-yellow-700 border-yellow-200",
  Pending:    "bg-violet-100 text-violet-700 border-violet-200",
  Confirmed:  "bg-teal-100 text-teal-700 border-teal-200",
  Declined:   "bg-orange-100 text-orange-700 border-orange-200",
};

const notifIcons: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  onsite_booked:            { icon: Handshake,   color: "text-blue-500",   label: "Onsite meeting booked"   },
  online_request_submitted: { icon: Video,        color: "text-violet-500", label: "Online request received" },
  information_request:      { icon: MessageSquare, color: "text-blue-500",  label: "Information request received" },
  meeting_cancelled:        { icon: AlertCircle,  color: "text-red-500",    label: "Meeting cancelled"       },
  request_confirmed:        { icon: CheckCircle2, color: "text-green-500",  label: "Request confirmed"       },
  request_declined:         { icon: BellOff,      color: "text-orange-500", label: "Request declined"        },
  meeting_completed:        { icon: CheckCircle2, color: "text-teal-500",   label: "Meeting completed"       },
};

function fmt12(t: string) {
  if (!t) return "";
  const parts = t.split(":");
  if (parts.length < 2) return t;
  const [h, m] = parts.map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent, sub, onClick }: { label: string; value: number | string; icon: React.ElementType; accent?: string; sub?: string; onClick?: () => void }) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col gap-3",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.98]",
      )}
      onClick={onClick}
    >
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accent ? `bg-${accent}-100` : "bg-muted")}>
        <Icon className={cn("h-4 w-4", accent ? `text-${accent}-600` : "text-accent")} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        {sub && <p className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function SponsorDashboardPage() {
  const [, nav] = useLocation();
  const token = localStorage.getItem("sponsor_token") ?? "";
  const qc = useQueryClient();

  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState(() => {
    const t = localStorage.getItem("sponsor_initial_tab");
    if (t) { localStorage.removeItem("sponsor_initial_tab"); return t; }
    return "overview";
  });
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");
  const notifSectionRef = useRef<HTMLDivElement>(null);
  const meetingsSectionRef = useRef<HTMLDivElement>(null);
  const leadsSectionRef = useRef<HTMLDivElement>(null);
  const infoRequestsSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!token) nav("/sponsor/login"); }, [token]);

  const { data: branding } = useQuery<AppBranding>({ queryKey: ["/api/branding-public"] });

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

  const { data: meData } = useQuery<{ sponsorUser: { accessLevel: string; isPrimary: boolean; isActive: boolean } | null }>({
    queryKey: ["/api/sponsor-dashboard/me", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/me?token=${token}`);
      if (!res.ok) return { sponsorUser: null };
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });
  const canExport = meData === undefined ? true : (meData.sponsorUser?.accessLevel === "owner" && meData.sponsorUser?.isPrimary === true);
  const canEdit = meData === undefined ? true : (meData.sponsorUser === null || meData.sponsorUser.accessLevel === "owner" || meData.sponsorUser.accessLevel === "editor");

  const markAllRead = useMutation({
    mutationFn: () => fetch(`/api/sponsor-notifications/read-all?token=${token}`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sponsor-access", token] }),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => fetch(`/api/sponsor-notifications/${id}/read?token=${token}`, { method: "PATCH" }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/sponsor-access", token] }),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ meetingId, status, meetingLink }: { meetingId: string; status: string; meetingLink?: string }) => {
      const res = await fetch(`/api/sponsor-meetings/${meetingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, status, meetingLink }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update status");
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-access", token] });
      setConfirmingId(null);
      setLinkInput("");
      const labels: Record<string, string> = {
        Completed: "Meeting marked as completed.",
        Cancelled: "Meeting cancelled.",
        Confirmed: "Online request confirmed.",
        Declined:  "Request declined.",
      };
      toast({ title: "Status updated", description: labels[variables.status] ?? "Meeting status updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  interface InfoRequest {
    id: string;
    eventId: string | null;
    attendeeFirstName: string;
    attendeeLastName: string;
    attendeeEmail: string;
    attendeeCompany: string;
    attendeeTitle: string;
    message: string | null;
    consentToShareContact: boolean;
    source: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  }

  const { data: infoRequests = [], refetch: refetchInfoRequests } = useQuery<InfoRequest[]>({
    queryKey: ["/api/sponsor-dashboard/information-requests", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/information-requests?token=${token}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  const { data: sponsorDeliverables = [] } = useQuery<{ id: string; status: string; sponsorVisible: boolean }[]>({
    queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token, "reports"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables?token=${token}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    staleTime: 60_000,
  });

  const deliverableStats = {
    total: sponsorDeliverables.length,
    completed: sponsorDeliverables.filter(d => ["Delivered", "Approved", "Completed"].includes(d.status)).length,
    remaining: sponsorDeliverables.filter(d => !["Delivered", "Approved", "Completed", "N/A"].includes(d.status)).length,
  };

  const updateInfoStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await fetch(`/api/sponsor-dashboard/information-requests/${id}/status?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return res.json();
    },
    onSuccess: () => {
      refetchInfoRequests();
      toast({ title: "Status updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
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
            <AppLogoMark containerClassName="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" iconClassName="h-5 w-5" imgClassName="h-7 max-w-[130px] object-contain" />
            <span className="font-display text-xl font-bold text-foreground tracking-tight">{branding?.appName || "Converge Concierge"}</span>
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

  const { sponsor, event, stats, meetings, notifications, analytics } = data;
  const eventAccent = event.accentColor ?? "#0D9488";

  // Unique attendees (leads)
  const leadsMap = new Map<string, SponsorMeeting["attendee"] & { meetings: number }>();
  for (const m of meetings) {
    const key = m.attendee.email || m.attendee.name;
    if (!leadsMap.has(key)) leadsMap.set(key, { ...m.attendee, meetings: 1 });
    else leadsMap.get(key)!.meetings++;
  }
  const leads = Array.from(leadsMap.values()).sort((a, b) => b.meetings - a.meetings);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  function exportLeadsCSV() {
    const header = "Name,Company,Title,Email,LinkedIn";
    const rows = leads.map((l) =>
      [l.name, l.company, l.title, l.email, l.linkedinUrl ?? ""]
        .map((v) => `"${(v ?? "").replace(/"/g, '""')}"`)
        .join(",")
    );
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${sponsor.name.replace(/\s+/g, "_")}_leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background relative flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <AppLogoMark containerClassName="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20" iconClassName="h-5 w-5" imgClassName="h-7 max-w-[130px] object-contain" />
          <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:inline">{branding?.appName || "Converge Concierge"}</span>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <button
              onClick={() => {
                setActiveTab("overview");
                setTimeout(() => {
                  notifSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 100);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 border border-violet-300 hover-elevate active-elevate-2 transition-colors"
            >
              <Bell className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700">{unreadCount} new</span>
            </button>
          )}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-green-100 border border-green-300">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" />
            <span className="text-xs font-semibold text-green-700 hidden sm:inline">Secure Access</span>
          </div>
          {branding?.appLogoUrl && (
            <div className="h-9 border-l border-border/50 pl-3 flex items-center">
              <img
                src={branding.appLogoUrl}
                alt={branding.appName || "Converge Events"}
                className="h-8 max-w-[140px] object-contain"
                data-testid="img-dashboard-logo"
              />
            </div>
          )}
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
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="p-6">
              {/* Mobile: logos row above text */}
              <div className="flex items-center justify-between sm:hidden mb-4">
                <div className="h-24 w-24 rounded-xl bg-white border border-border/70 flex items-center justify-center shrink-0 overflow-hidden shadow-sm" data-testid="img-sponsor-logo-card-mobile">
                  {sponsor.logoUrl ? (
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="h-20 max-w-[88px] object-contain p-1" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted/50">
                      <Building2 className="h-10 w-10 text-muted-foreground/40" />
                    </div>
                  )}
                </div>
                <div className="h-20 w-20 border border-border/50 bg-white rounded-xl p-2 flex items-center justify-center overflow-hidden shadow-sm" data-testid="img-event-logo-header-mobile">
                  {event.logoUrl ? (
                    <img src={event.logoUrl} alt={event.name} className="h-full max-w-full object-contain" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted/50">
                      <Calendar className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>

              {/* Desktop: 3-column layout (logo | text | logo) */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:gap-8">
                {/* Left: sponsor logo (desktop only) */}
                <div className="hidden sm:flex h-48 w-48 rounded-2xl bg-white border border-border/70 items-center justify-center shrink-0 overflow-hidden shadow-sm" data-testid="img-sponsor-logo-card">
                  {sponsor.logoUrl ? (
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="h-44 max-w-[184px] object-contain p-2" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted/50">
                      <Building2 className="h-20 w-20 text-muted-foreground/40" />
                    </div>
                  )}
                </div>

                {/* Center: sponsor + event info */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-sponsor-name">{sponsor.name}</h1>
                    {sponsor.level && (
                      <span className={cn("text-xs font-semibold border px-2.5 py-0.5 rounded-full inline-flex items-center gap-1", levelBadge[sponsor.level] || "bg-muted text-muted-foreground border-border")}>
                        {sponsor.level === "Platinum" && <Gem className="h-3 w-3" />}
                        {sponsor.level} Sponsor
                      </span>
                    )}
                  </div>
                  {sponsor.shortDescription && (
                    <p className="text-sm text-muted-foreground mb-3">{sponsor.shortDescription}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                      {event.slug}
                    </span>
                    <span className="text-xs font-medium text-foreground">{event.name}</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-accent" />
                      {format(parseISO(event.startDate), "MMMM d")} – {format(parseISO(event.endDate), "MMMM d, yyyy")}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />{event.location}
                    </span>
                    {(() => {
                      const today = new Date();
                      const start = parseISO(event.startDate);
                      const end = parseISO(event.endDate);
                      if (today < start) {
                        const daysUntil = differenceInDays(start, today);
                        return (
                          <span className="font-medium px-2 py-0.5 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
                            Starts in {daysUntil}d
                          </span>
                        );
                      } else if (today <= end) {
                        return (
                          <span className="font-medium px-2 py-0.5 rounded-full border bg-green-50 text-green-700 border-green-200">
                            In progress
                          </span>
                        );
                      } else {
                        return (
                          <span className="font-medium px-2 py-0.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">
                            Completed
                          </span>
                        );
                      }
                    })()}
                  </div>
                </div>

                {/* Right: event logo (desktop only) */}
                <div className="hidden sm:flex h-40 w-40 border border-border/50 bg-white rounded-2xl p-3 items-center justify-center shrink-0 overflow-hidden shadow-sm" data-testid="img-event-logo-header">
                  {event.logoUrl ? (
                    <img src={event.logoUrl} alt={event.name} className="h-full max-w-full object-contain" />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-muted/50">
                      <Calendar className="h-16 w-16 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-7 h-auto p-1 bg-muted/50 border border-border/40 rounded-xl mb-8">
              {(["overview", "deliverables", "meetings", "info-requests", "discovery", "leads", "reports"] as const).map((tab) => (
                <TabsTrigger
                  key={tab}
                  value={tab}
                  data-testid={tab === "deliverables" ? "tab-deliverables" : `tab-${tab}`}
                  className="py-2.5 rounded-lg data-[state=active]:shadow-sm transition-all text-[11px] sm:text-sm"
                  style={activeTab === tab ? { backgroundColor: eventAccent, color: "#ffffff" } : {}}
                >
                  {tab === "overview" ? "Overview"
                    : tab === "deliverables" ? "Deliverables"
                    : tab === "meetings" ? "Meetings"
                    : tab === "info-requests" ? "Info Requests"
                    : tab === "discovery" ? "Discovery"
                    : tab === "leads" ? "Leads"
                    : "Reports"}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="overview" className="space-y-8 outline-none">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard
                  label="Total Meetings"
                  value={stats.total}
                  icon={Handshake}
                  accent="blue"
                  sub={`${stats.completed} completed, ${stats.cancelled} cancelled`}
                  onClick={() => setActiveTab("meetings")}
                />
                <StatCard
                  label="Information Requests"
                  value={infoRequests.length}
                  icon={MessageSquare}
                  accent="violet"
                  onClick={() => setActiveTab("info-requests")}
                />
                <StatCard
                  label="Captured Leads"
                  value={leads.length}
                  icon={UserCheck}
                  accent="indigo"
                  onClick={() => setActiveTab("leads")}
                />
                <StatCard
                  label="Awaiting Sponsor Action"
                  value={stats.pendingOnline}
                  icon={Clock}
                  accent="amber"
                  sub="Online requests pending your review"
                  onClick={() => setActiveTab("meetings")}
                />
              </div>

              {(() => {
                const todayStr = format(new Date(), "yyyy-MM-dd");
                const nextMeeting = [...meetings]
                  .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                  .find(m => (m.status === "Scheduled" || m.status === "Confirmed" || m.status === "Pending") && m.date >= todayStr);

                if (!nextMeeting) return null;

                const isOnline = nextMeeting.meetingType === "online_request";
                return (
                  <div className="bg-accent/5 border border-accent/20 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-xl bg-accent text-accent-foreground flex items-center justify-center shrink-0 shadow-lg shadow-accent/20">
                        <Calendar className="h-6 w-6" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">Your Next Meeting</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {fmt12(nextMeeting.time)}
                          </span>
                        </div>
                        <h3 className="text-lg font-display font-bold text-foreground">Meeting with {nextMeeting.attendee.name}</h3>
                        <p className="text-sm text-muted-foreground">{nextMeeting.attendee.company} • {nextMeeting.attendee.title}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex flex-col items-end mr-2">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                          {isOnline ? <Video className="h-3.5 w-3.5 text-violet-500" /> : <MapPin className="h-3.5 w-3.5 text-accent" />}
                          {isOnline ? "Online Meeting" : nextMeeting.location}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{format(parseISO(nextMeeting.date), "EEEE, MMMM do")}</span>
                      </div>
                      <Button size="sm" variant="outline" className="gap-2" onClick={() => {
                         downloadICS({
                            meetingId:    nextMeeting.id,
                            sponsorName:  sponsor.name,
                            attendeeName: nextMeeting.attendee.name,
                            eventName:    event.name,
                            eventSlug:    event.slug,
                            date:         nextMeeting.date,
                            time:         nextMeeting.time,
                            location:     nextMeeting.location,
                            meetingType:  nextMeeting.meetingType as any,
                          });
                      }}>
                        <Download className="h-3.5 w-3.5" /> Calendar
                      </Button>
                    </div>
                  </div>
                );
              })()}

              {/* Dashboard Owner(s) card */}
              {(() => {
                const hasPrimary = !!(sponsor.contactName || sponsor.contactEmail);
                const additionalOwners: { id: string; name: string; title: string; email: string }[] = (() => {
                  try { return sponsor.repsJson ? JSON.parse(sponsor.repsJson) : []; } catch { return []; }
                })();
                if (!hasPrimary && additionalOwners.length === 0) return null;
                return (
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                      <Users className="h-4 w-4 text-accent" />
                      Dashboard Owner(s)
                    </h2>
                    <div className="flex flex-wrap gap-3">
                      {hasPrimary && (
                        <div className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-sm font-semibold text-foreground truncate">{sponsor.contactName}</p>
                              <span className="text-[10px] bg-primary/10 text-primary rounded px-1.5 py-0.5 shrink-0 font-medium">Primary</span>
                            </div>
                            {sponsor.contactEmail && <p className="text-xs text-muted-foreground truncate">{sponsor.contactEmail}</p>}
                          </div>
                        </div>
                      )}
                      {additionalOwners.map((c) => (
                        <div key={c.id} className="flex items-center gap-3 bg-muted/30 border border-border/40 rounded-xl px-4 py-2.5 min-w-0">
                          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <Users className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{c.name}</p>
                            {(c.title || c.email) && (
                              <p className="text-xs text-muted-foreground truncate">{[c.title, c.email].filter(Boolean).join(" · ")}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div ref={notifSectionRef} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden flex flex-col h-[400px]">
                  <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between shrink-0">
                    <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Bell className="h-4 w-4 text-accent" />
                      Activity Log
                    </h2>
                    {unreadCount > 0 && (
                      <button
                        onClick={() => markAllRead.mutate()}
                        disabled={markAllRead.isPending}
                        className="text-[10px] font-bold uppercase tracking-wider text-accent hover:opacity-80 transition-opacity"
                        data-testid="btn-mark-all-read"
                      >
                        Mark all read
                      </button>
                    )}
                  </div>
                  <div className="flex-1 overflow-y-auto divide-y divide-border/40 scrollbar-thin scrollbar-thumb-border/40">
                    {notifications.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-10 text-center">
                        <BellOff className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm">No notifications yet.</p>
                      </div>
                    ) : (
                      notifications.map((n) => {
                        const cfg = notifIcons[n.type] || { icon: Bell, color: "text-muted-foreground", label: "Update" };
                        const Icon = cfg.icon;
                        return (
                          <div
                            key={n.id}
                            className={cn(
                              "px-6 py-4 flex items-start gap-4 transition-colors relative",
                              !n.isRead && "bg-accent/5",
                            )}
                            onClick={() => !n.isRead && markRead.mutate(n.id)}
                            data-testid={`notif-item-${n.id}`}
                          >
                            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", cfg.color.replace("text-", "bg-").replace("-500", "-100"))}>
                              <Icon className={cn("h-4 w-4", cfg.color)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-foreground mb-0.5">{cfg.label}</p>
                              <p className="text-sm text-muted-foreground leading-snug">
                                <span className="font-medium text-foreground">{n.attendeeName}</span> from <span className="font-medium text-foreground">{n.attendeeCompany}</span>
                                {n.type === "onsite_booked" ? " booked an onsite meeting." :
                                 n.type === "online_request_submitted" ? " requested an online meeting." :
                                 n.type === "information_request" ? " submitted an info request." :
                                 n.type === "meeting_cancelled" ? " cancelled a meeting." :
                                 n.type === "request_confirmed" ? " had their request confirmed." :
                                 n.type === "request_declined" ? " had their request declined." :
                                 n.type === "meeting_completed" ? " meeting was marked completed." : "."}
                              </p>
                              <p className="text-[10px] text-muted-foreground/60 mt-1.5 flex items-center gap-1.5 font-medium">
                                <Clock className="h-2.5 w-2.5" />
                                {format(parseISO(n.createdAt), "MMM d, h:mm a")}
                              </p>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex flex-col h-[400px]">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-6">
                    <TrendingUp className="h-4 w-4 text-accent" />
                    Engagement Overview
                  </h2>
                  <div className="flex-1 space-y-6 overflow-y-auto pr-2">
                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center">
                          <Eye className="h-5 w-5 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{analytics?.profileViews || 0}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Profile Views</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-teal-100 flex items-center justify-center">
                          <MousePointerClick className="h-5 w-5 text-teal-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{analytics?.meetingCtaClicks || 0}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Meeting Button Clicks</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border border-border/40">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-lg bg-violet-100 flex items-center justify-center">
                          <Video className="h-5 w-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">{stats.pendingOnline}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Pending Online Requests</p>
                        </div>
                      </div>
                      {stats.pendingOnline > 0 && (
                        <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold uppercase tracking-tight" onClick={() => setActiveTab("meetings")}>Review</Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="meetings" className="outline-none">
              <div ref={meetingsSectionRef} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-accent" />
                    Meetings Schedule
                    <span className="text-xs font-normal text-muted-foreground">({meetings.length} total)</span>
                  </h2>
                </div>
                {meetings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <CalendarX className="h-12 w-12 opacity-10" />
                    <p className="text-sm font-medium">No meetings scheduled yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/40">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Date & Time</th>
                          <th className="px-6 py-3 font-semibold">Type</th>
                          <th className="px-6 py-3 font-semibold">Attendee</th>
                          <th className="px-6 py-3 font-semibold">Location</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {meetings
                          .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                          .map((m) => {
                            const isOnline = m.meetingType === "online_request";
                            const isBusy = updateStatus.isPending;
                            const isConfirming = confirmingId === m.id;

                            return (
                              <tr key={m.id} className="hover:bg-muted/10 transition-colors" data-testid={`meeting-row-${m.id}`}>
                                <td className="px-6 py-4">
                                  <p className="font-bold text-foreground">{format(parseISO(m.date), "MMM d")}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium">{fmt12(m.time)}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <span className={cn("text-[10px] font-bold uppercase tracking-tight px-1.5 py-0.5 rounded border", isOnline ? "bg-violet-50 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200")}>
                                    {isOnline ? "Online" : "Onsite"}
                                  </span>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="font-semibold text-foreground truncate">{m.attendee.name}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{m.attendee.company}</p>
                                </td>
                                <td className="px-6 py-4">
                                  {isOnline ? (
                                    m.meetingLink ? (
                                      <a href={m.meetingLink.startsWith("http") ? m.meetingLink : `https://${m.meetingLink}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="text-accent hover:underline flex items-center gap-1 font-medium"
                                        data-testid={`meeting-link-${m.id}`}>
                                        <Link2 className="h-3 w-3" /> Online
                                      </a>
                                    ) : <span className="text-muted-foreground/60 italic">Pending Link</span>
                                  ) : (
                                    <span className="text-foreground font-medium flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-accent" /> {m.location}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4">
                                  {canEdit ? (
                                    <select
                                      value={m.status}
                                      onChange={(e) => updateStatus.mutate({ meetingId: m.id, status: e.target.value })}
                                      disabled={isBusy}
                                      className={cn(
                                        "text-[10px] font-bold uppercase tracking-tight border rounded-full px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer disabled:opacity-50 appearance-none bg-white",
                                        statusColors[m.status] || "bg-muted text-muted-foreground"
                                      )}
                                      data-testid={`select-status-${m.id}`}
                                    >
                                      <option value="Scheduled">Scheduled</option>
                                      <option value="Confirmed">Confirmed</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Cancelled">Cancelled</option>
                                      <option value="NoShow">No-Show</option>
                                      {isOnline && <option value="Pending">Pending</option>}
                                      {isOnline && <option value="Declined">Declined</option>}
                                    </select>
                                  ) : (
                                    <span className={cn("text-[10px] font-bold uppercase tracking-tight px-2 py-0.5 rounded-full border", statusColors[m.status])}>
                                      {m.status}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-4 text-right">
                                  {m.status === "Pending" && isOnline && canEdit && (
                                    isConfirming ? (
                                      <div className="flex flex-col gap-1.5 w-40 ml-auto">
                                        <input
                                          type="text"
                                          placeholder="Meeting Link"
                                          value={linkInput}
                                          onChange={(e) => setLinkInput(e.target.value)}
                                          className="text-[10px] px-1.5 py-1 rounded border border-input w-full"
                                          autoFocus
                                        />
                                        <div className="flex gap-1">
                                          <Button size="sm" className="h-6 text-[10px] flex-1 px-1 bg-teal-600 hover:bg-teal-700" onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Confirmed", meetingLink: linkInput })} disabled={isBusy}>Confirm</Button>
                                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setConfirmingId(null); setLinkInput(""); }}><XIcon className="h-3 w-3" /></Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <Button size="sm" variant="outline" className="h-7 text-[10px] border-teal-200 bg-teal-50 text-teal-700 hover:bg-teal-100" onClick={() => setConfirmingId(m.id)}>Review</Button>
                                    )
                                  )}
                                  {(!isOnline || m.status !== "Pending") && (
                                     <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-muted-foreground hover:text-accent"
                                        onClick={() => {
                                          downloadICS({
                                            meetingId:    m.id,
                                            sponsorName:  sponsor.name,
                                            attendeeName: m.attendee.name,
                                            eventName:    event.name,
                                            eventSlug:    event.slug,
                                            date:         m.date,
                                            time:         m.time,
                                            location:     m.location,
                                            meetingType:  m.meetingType as any,
                                          });
                                        }}
                                     >
                                        <Calendar className="h-4 w-4" />
                                     </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="info-requests" className="outline-none">
              <div ref={infoRequestsSectionRef} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-accent" />
                    Information Requests
                    <span className="text-xs font-normal text-muted-foreground">({infoRequests.length} total)</span>
                  </h2>
                </div>
                {infoRequests.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <MessageSquare className="h-12 w-12 opacity-10" />
                    <p className="text-sm font-medium">No information requests yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/40">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Attendee</th>
                          <th className="px-6 py-3 font-semibold">Company</th>
                          <th className="px-6 py-3 font-semibold">Status</th>
                          <th className="px-6 py-3 font-semibold">Source</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {[...infoRequests]
                          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                          .map((req) => {
                            const statusColor =
                              req.status === "New"              ? "bg-blue-100 text-blue-700 border-blue-200" :
                              req.status === "Open"             ? "bg-blue-100 text-blue-700 border-blue-200" :
                              req.status === "Contacted"        ? "bg-amber-100 text-amber-700 border-amber-200" :
                              req.status === "Email Sent"       ? "bg-amber-100 text-amber-700 border-amber-200" :
                              req.status === "Meeting Scheduled"? "bg-teal-100 text-teal-700 border-teal-200" :
                              req.status === "Not Qualified"    ? "bg-orange-100 text-orange-700 border-orange-200" :
                                                                 "bg-gray-100 text-gray-600 border-gray-200";
                            return (
                              <tr key={req.id} className="hover:bg-muted/10 transition-colors" data-testid={`info-req-row-${req.id}`}>
                                <td className="px-6 py-4">
                                  <p className="font-semibold text-foreground">{req.attendeeFirstName} {req.attendeeLastName}</p>
                                  <p className="text-[11px] text-muted-foreground">{req.attendeeTitle}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <p className="text-foreground truncate">{req.attendeeCompany}</p>
                                  <p className="text-[11px] text-muted-foreground truncate">{req.attendeeEmail}</p>
                                </td>
                                <td className="px-6 py-4">
                                  <select
                                    value={req.status}
                                    onChange={(e) => updateInfoStatus.mutate({ id: req.id, status: e.target.value })}
                                    disabled={updateInfoStatus.isPending || !canEdit}
                                    className={cn(
                                      "text-[10px] font-bold uppercase tracking-tight border rounded-full px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-accent cursor-pointer disabled:opacity-50 appearance-none bg-white",
                                      statusColor
                                    )}
                                    data-testid={`select-status-${req.id}`}
                                  >
                                    {SPONSOR_INFO_REQUEST_STATUSES.map((s) => (
                                      <option key={s} value={s}>{s}</option>
                                    ))}
                                    {!SPONSOR_INFO_REQUEST_STATUSES.includes(req.status as any) && (
                                      <option value={req.status}>{req.status}</option>
                                    )}
                                  </select>
                                </td>
                                <td className="px-6 py-4">
                                  <span className="text-[10px] font-bold uppercase tracking-tight text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">{req.source}</span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="discovery" className="outline-none">
              <AttendeeDiscoveryTab token={token ?? ""} eventAccent={eventAccent} />
            </TabsContent>

            <TabsContent value="leads" className="outline-none">
              <div ref={leadsSectionRef} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-accent" />
                    Lead Contacts
                    <span className="text-xs font-normal text-muted-foreground">({leads.length} unique)</span>
                  </h2>
                  {leads.length > 0 && canExport && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 h-8 text-[10px] font-bold uppercase tracking-wider"
                      onClick={exportLeadsCSV}
                      data-testid="btn-export-leads"
                    >
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                  )}
                </div>
                {leads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
                    <Users className="h-12 w-12 opacity-10" />
                    <p className="text-sm font-medium">No leads captured yet.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-muted-foreground uppercase bg-muted/30 border-b border-border/40">
                        <tr>
                          <th className="px-6 py-3 font-semibold">Name / Title</th>
                          <th className="px-6 py-3 font-semibold">Company</th>
                          <th className="px-6 py-3 font-semibold">Email</th>
                          <th className="px-6 py-3 font-semibold">LinkedIn</th>
                          <th className="px-6 py-3 font-semibold text-right">Meetings</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {leads.map((lead, i) => (
                          <tr key={lead.email || i} className="hover:bg-muted/10 transition-colors" data-testid={`lead-row-${i}`}>
                            <td className="px-6 py-4">
                              <p className="font-semibold text-foreground">{lead.name}</p>
                              <p className="text-[11px] text-muted-foreground">{lead.title}</p>
                            </td>
                            <td className="px-6 py-4 text-foreground truncate">{lead.company}</td>
                            <td className="px-6 py-4 text-muted-foreground truncate">{lead.email}</td>
                            <td className="px-6 py-4">
                              {lead.linkedinUrl ? (
                                <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[#0077B5] hover:underline flex items-center gap-1.5 font-medium" data-testid={`lead-linkedin-${i}`}>
                                  <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                                </a>
                              ) : (
                                <span className="text-[11px] text-muted-foreground/30">—</span>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <span className="text-xs text-muted-foreground font-mono font-bold bg-muted/30 px-2 py-0.5 rounded">{lead.meetings}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="deliverables" className="outline-none">
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border/50">
                  <h2 className="text-sm font-semibold text-foreground">Agreement Deliverables</h2>
                  <p className="text-xs text-muted-foreground mt-0.5">Your sponsorship deliverables and action items</p>
                </div>
                <div className="p-6">
                  <SponsorDeliverablesTab token={token} canEdit={canEdit} sponsorLogoUrl={sponsor.logoUrl} />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="reports" className="outline-none">
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden min-h-[500px]">
                <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-accent" />
                    Performance Report
                  </h2>
                </div>

                <div className="p-8 space-y-10">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {[
                      { label: "Total Meetings",           value: stats.total,                                              icon: Handshake,   color: "bg-card border-border/60" },
                      { label: "Completed",                 value: stats.completed,                                          icon: CheckCircle2, color: "bg-green-50 border-green-200 text-green-800" },
                      { label: "Pending Online",            value: stats.pendingOnline,                                      icon: Video,        color: "bg-violet-50 border-violet-200 text-violet-800" },
                      { label: "Cancelled",                 value: stats.cancelled,                                          icon: AlertCircle,  color: "bg-red-50 border-red-200 text-red-800" },
                      { label: "Unique Companies",          value: stats.companies,                                          icon: Users,        color: "bg-teal-50 border-teal-200 text-teal-800" },
                      { label: "Total Leads",               value: leads.length,                                             icon: UserCheck,    color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
                      { label: "Onsite Sessions",           value: meetings.filter((m) => m.meetingType !== "online_request").length, icon: MapPin, color: "bg-blue-50 border-blue-200 text-blue-800" },
                      { label: "Online Sessions",           value: meetings.filter((m) => m.meetingType === "online_request").length, icon: Video,  color: "bg-violet-50 border-violet-200 text-violet-800" },
                    ].map(({ label, value, icon: Icon, color }) => (
                      <div key={label} className={cn("rounded-xl border p-5 flex flex-col gap-3 transition-all hover:shadow-md", color)}>
                        <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center">
                          <Icon className="h-4 w-4 opacity-70" />
                        </div>
                        <div>
                          <p className="text-2xl font-display font-bold leading-none">{value}</p>
                          <p className="text-[11px] font-bold uppercase tracking-wider mt-1.5 opacity-60 leading-tight">{label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Deliverables & Engagement */}
                  {deliverableStats.total > 0 && (
                    <div className="space-y-4">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <ClipboardCheck className="h-4 w-4 text-accent" /> Deliverables & Engagement
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {[
                          { label: "Deliverables Completed", value: deliverableStats.completed, icon: CheckCircle2, color: "bg-green-50 border-green-200 text-green-800" },
                          { label: "Deliverables Remaining", value: deliverableStats.remaining, icon: Package,      color: deliverableStats.remaining > 0 ? "bg-amber-50 border-amber-200 text-amber-800" : "bg-card border-border/60" },
                          { label: "Information Requests",   value: infoRequests.length,        icon: MessageSquare, color: "bg-blue-50 border-blue-200 text-blue-800" },
                        ].map(({ label, value, icon: Icon, color }) => (
                          <div key={label} className={cn("rounded-xl border p-5 flex flex-col gap-3 transition-all hover:shadow-md", color)}>
                            <div className="h-8 w-8 rounded-lg bg-background/50 flex items-center justify-center">
                              <Icon className="h-4 w-4 opacity-70" />
                            </div>
                            <div>
                              <p className="text-2xl font-display font-bold leading-none">{value}</p>
                              <p className="text-[11px] font-bold uppercase tracking-wider mt-1.5 opacity-60 leading-tight">{label}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                      {deliverableStats.total > 0 && (
                        <div className="bg-muted/30 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-muted-foreground">Deliverables Completion</span>
                            <span className="text-xs font-bold text-foreground">{deliverableStats.completed}/{deliverableStats.total} ({Math.round((deliverableStats.completed / deliverableStats.total) * 100)}%)</span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all"
                              style={{ width: `${Math.round((deliverableStats.completed / deliverableStats.total) * 100)}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                    {(() => {
                      const cmap: Record<string, number> = {};
                      for (const m of meetings) {
                        if (m.attendee.company && m.attendee.company !== "—") {
                          cmap[m.attendee.company] = (cmap[m.attendee.company] ?? 0) + 1;
                        }
                      }
                      const top5 = Object.entries(cmap).sort((a, b) => b[1] - a[1]).slice(0, 5);
                      if (top5.length === 0) return null;
                      return (
                        <div className="space-y-6">
                          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-accent" /> Top Companies Met
                          </h3>
                          <div className="space-y-4">
                            {top5.map(([company, count], i) => {
                              const max = top5[0][1];
                              return (
                                <div key={company} className="group">
                                  <div className="flex items-center justify-between text-xs mb-1.5 font-bold">
                                    <span className="text-foreground">{i + 1}. {company}</span>
                                    <span className="text-accent">{count} meeting{count !== 1 ? "s" : ""}</span>
                                  </div>
                                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${(count / max) * 100}%` }}
                                      className="h-full bg-accent rounded-full group-hover:bg-accent/80 transition-colors"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    <div className="space-y-6">
                      <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <Download className="h-4 w-4 text-accent" /> Export & Share
                      </h3>
                      <div className="flex flex-col gap-3">
                        {canExport && (
                          <a href={`/api/sponsor-report/pdf?token=${token}`} download className="w-full" data-testid="link-download-pdf">
                            <Button className="w-full h-12 gap-3 bg-accent text-accent-foreground hover:bg-accent/90 shadow-lg shadow-accent/20 rounded-xl">
                              <FileDown className="h-5 w-5" />
                              Download Sponsorship Performance Report
                            </Button>
                          </a>
                        )}
                        {canExport && (
                          <Button variant="outline" className="w-full h-12 gap-3 rounded-xl border-border/60 hover:bg-muted/50" onClick={exportLeadsCSV} data-testid="btn-export-leads-report">
                            <Download className="h-5 w-5 text-accent" />
                            Export Leads Data (CSV)
                          </Button>
                        )}
                        <p className="text-[10px] text-muted-foreground text-center italic mt-2">
                          * Export permissions are limited to Sponsor Owners and Editors.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </motion.div>
      </main>

      <footer className="w-full border-t border-border/50 bg-white/50 py-5 relative z-10 text-center shrink-0">
        <p className="text-muted-foreground text-xs">
          &copy; 2026 Converge Events. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
