import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Hexagon, ShieldX, Calendar, MapPin, Building2, Users,
  CheckCircle2, Clock, Handshake, Linkedin, LogOut,
  Bell, BellOff, Download, ExternalLink, Video, Mail,
  UserCheck, AlertCircle, ChevronDown, ChevronUp, FileDown,
  BarChart3, Monitor, TrendingUp, Link2, X as XIcon, Gem, MessageSquare,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";

import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadICS, googleCalendarUrl } from "@/lib/ics";

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
  };
  event: { id: string; name: string; slug: string; location: string; startDate: string; endDate: string; logoUrl?: string | null };
  stats: { total: number; scheduled: number; completed: number; cancelled: number; pendingOnline: number; companies: number };
  meetings: SponsorMeeting[];
  notifications: SponsorNotification[];
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
  meeting_cancelled:        { icon: AlertCircle,  color: "text-red-500",    label: "Meeting cancelled"       },
  request_confirmed:        { icon: CheckCircle2, color: "text-green-500",  label: "Request confirmed"       },
  request_declined:         { icon: BellOff,      color: "text-orange-500", label: "Request declined"        },
  meeting_completed:        { icon: CheckCircle2, color: "text-teal-500",   label: "Meeting completed"       },
};

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── Stat card ──────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, accent }: { label: string; value: number | string; icon: React.ElementType; accent?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card shadow-sm p-5 flex flex-col gap-3">
      <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accent ? `bg-${accent}-100` : "bg-muted")}>
        <Icon className={cn("h-4 w-4", accent ? `text-${accent}-600` : "text-accent")} />
      </div>
      <div>
        <p className="text-2xl font-display font-bold text-foreground" data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
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
  const [notifOpen, setNotifOpen] = useState(true);
  const [leadsOpen, setLeadsOpen] = useState(false);
  const [infoRequestsOpen, setInfoRequestsOpen] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [linkInput, setLinkInput] = useState("");

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
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold text-foreground tracking-tight">Converge Concierge</span>
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

  const { sponsor, event, stats, meetings, notifications } = data;

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
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:inline">Converge Concierge</span>
        </div>
        <div className="flex items-center gap-3">
          {unreadCount > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-violet-100 border border-violet-300">
              <Bell className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-xs font-semibold text-violet-700">{unreadCount} new</span>
            </div>
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
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              {/* Sponsor logo on the left — primary visual */}
              <div className="h-16 w-16 rounded-xl bg-white border border-border/70 flex items-center justify-center shrink-0 overflow-hidden shadow-sm" data-testid="img-sponsor-logo-card">
                {sponsor.logoUrl ? (
                  <img src={sponsor.logoUrl} alt={sponsor.name} className="h-14 max-w-[60px] object-contain p-1" />
                ) : (
                  <div className="flex flex-col items-center justify-center w-full h-full bg-muted/50">
                    <Building2 className="h-7 w-7 text-muted-foreground/40" />
                  </div>
                )}
              </div>
              <div className="flex-1">
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
                  <p className="text-sm text-muted-foreground mb-1.5">{sponsor.shortDescription}</p>
                )}
                {/* Event label row with optional event logo */}
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-mono text-xs font-bold text-accent bg-accent/10 px-2 py-0.5 rounded border border-accent/20">
                    {event.slug}
                  </span>
                  <span className="font-medium text-foreground">{event.name}</span>
                  {event.logoUrl && (
                    <div className="h-6 w-6 rounded border border-border/60 bg-white flex items-center justify-center overflow-hidden shrink-0" data-testid="img-event-logo-card">
                      <img src={event.logoUrl} alt={event.name} className="h-5 w-5 object-contain p-px" />
                    </div>
                  )}
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
                {(sponsor.websiteUrl || sponsor.linkedinUrl) && (
                  <div className="flex items-center gap-3 mt-2">
                    {sponsor.websiteUrl && (
                      <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-accent hover:underline">
                        <ExternalLink className="h-3.5 w-3.5" /> Website
                      </a>
                    )}
                    {sponsor.linkedinUrl && (
                      <a href={sponsor.linkedinUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-[#0077B5] hover:underline">
                        <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <StatCard label="Total Meetings"      value={stats.total}              icon={Handshake}      />
            <StatCard label="Completed"           value={stats.completed}          icon={CheckCircle2}   />
            <StatCard label="Pending Online"      value={stats.pendingOnline}      icon={Video}          />
            <StatCard label="Companies Met"       value={stats.companies}          icon={Users}          />
            <StatCard label="Info Requests"       value={infoRequests.length}      icon={MessageSquare}  />
          </div>

          {/* Charts — only shown when there's data */}
          {stats.total > 0 && (() => {
            const statusData = [
              { name: "Completed",  value: stats.completed,     color: "#14b8a6" },
              { name: "Pending",    value: stats.pendingOnline, color: "#8b5cf6" },
              { name: "Scheduled",  value: stats.scheduled,     color: "#3b82f6" },
              { name: "Cancelled",  value: stats.cancelled,     color: "#ef4444" },
            ].filter((d) => d.value > 0);

            const onsiteCount  = meetings.filter((m) => m.meetingType === "onsite").length;
            const onlineCount  = meetings.filter((m) => m.meetingType !== "onsite").length;
            const typeData = [
              { name: "Onsite",  value: onsiteCount,  color: "#0d9488" },
              { name: "Online",  value: onlineCount,  color: "#6366f1" },
            ].filter((d) => d.value > 0);

            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Meeting status donut */}
                {statusData.length > 0 && (
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
                    <p className="text-sm font-semibold text-foreground mb-1">Meeting Status</p>
                    <p className="text-xs text-muted-foreground mb-4">Breakdown of all {stats.total} meeting{stats.total !== 1 ? "s" : ""}</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                          formatter={(val: number, name: string) => [`${val}`, name]}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
                {/* Meeting type pie */}
                {typeData.length > 1 && (
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5">
                    <p className="text-sm font-semibold text-foreground mb-1">Meeting Type</p>
                    <p className="text-xs text-muted-foreground mb-4">Onsite vs. Online split</p>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={typeData}
                          cx="50%"
                          cy="50%"
                          innerRadius={55}
                          outerRadius={80}
                          paddingAngle={2}
                          dataKey="value"
                        >
                          {typeData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} stroke="transparent" />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}
                          formatter={(val: number, name: string) => [`${val}`, name]}
                        />
                        <Legend
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Notifications */}
          {notifications.length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="w-full px-6 py-4 border-b border-border/50 flex items-center justify-between hover:bg-muted/30 transition-colors"
                data-testid="toggle-notifications"
              >
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold text-foreground">Notifications</span>
                  {unreadCount > 0 && (
                    <span className="text-xs font-bold bg-violet-500 text-white rounded-full px-2 py-0.5">{unreadCount}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unreadCount > 0 && (
                    <span
                      className="text-xs text-accent underline underline-offset-2 hover:opacity-80"
                      onClick={(e) => { e.stopPropagation(); markAllRead.mutate(); }}
                      data-testid="btn-mark-all-read"
                    >
                      Mark all read
                    </span>
                  )}
                  {notifOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {notifOpen && (
                <div className="divide-y divide-border/40">
                  {notifications.map((n) => {
                    const meta = notifIcons[n.type] ?? { icon: Bell, color: "text-muted-foreground", label: n.type };
                    const Icon = meta.icon;
                    return (
                      <div
                        key={n.id}
                        className={cn(
                          "px-6 py-4 flex items-start gap-4 transition-colors cursor-pointer",
                          n.isRead ? "opacity-60 hover:opacity-80" : "bg-violet-50/40 hover:bg-violet-50/60",
                        )}
                        onClick={() => !n.isRead && markRead.mutate(n.id)}
                        data-testid={`notif-${n.id}`}
                      >
                        <div className={cn("h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0", !n.isRead && "bg-violet-100")}>
                          <Icon className={cn("h-4 w-4", meta.color)} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-foreground">{meta.label}</span>
                            {!n.isRead && <span className="h-2 w-2 rounded-full bg-violet-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {n.attendeeName} · {n.attendeeCompany}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {n.date} at {fmt12(n.time)}
                          </p>
                        </div>
                        <span className="text-[11px] text-muted-foreground shrink-0">
                          {format(new Date(n.createdAt), "MMM d")}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Meeting list */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Handshake className="h-4 w-4 text-accent" /> Your Meetings
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {meetings.length} meeting{meetings.length !== 1 ? "s" : ""} · {event.name}
                </p>
              </div>
            </div>

            {meetings.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <Handshake className="h-8 w-8 opacity-20" />
                <p className="text-sm">No meetings scheduled yet.</p>
              </div>
            ) : (
              <>
                <div className="hidden sm:grid grid-cols-[120px_1fr_140px_90px_90px_90px_150px] gap-3 px-6 py-2.5 bg-muted/40 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  <span>Date / Time</span>
                  <span>Attendee</span>
                  <span>Company</span>
                  <span>Type</span>
                  <span>Location</span>
                  <span>Status</span>
                  <span>Actions</span>
                </div>
                <div className="divide-y divide-border/40">
                  {[...meetings]
                    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
                    .map((m) => {
                      const isOnline = m.meetingType === "online_request";
                      const canExport = m.status === "Scheduled" || m.status === "Confirmed" || m.status === "Completed";
                      const isConfirming = confirmingId === m.id;
                      const isBusy = updateStatus.isPending;
                      return (
                        <div
                          key={m.id}
                          className="px-6 py-4 flex flex-col sm:grid sm:grid-cols-[120px_1fr_140px_90px_90px_90px_150px] sm:items-start gap-3 hover:bg-muted/30 transition-colors"
                          data-testid={`meeting-row-${m.id}`}
                        >
                          {/* Date + Time + ICS */}
                          <div className="shrink-0">
                            <p className="text-sm font-semibold text-foreground">{m.date}</p>
                            <p className="text-xs text-muted-foreground">{fmt12(m.time)}</p>
                            {canExport && !isOnline && (
                              <div className="flex items-center gap-2 mt-1">
                                <button
                                  onClick={() => downloadICS({
                                    meetingId:    m.id,
                                    sponsorName:  sponsor.name,
                                    attendeeName: m.attendee.name,
                                    eventName:    event.name,
                                    eventSlug:    event.slug,
                                    date:         m.date,
                                    time:         m.time,
                                    location:     m.location,
                                    meetingType:  "onsite",
                                  })}
                                  className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                                  title="Download .ics"
                                  data-testid={`btn-ics-${m.id}`}
                                >
                                  <Download className="h-3 w-3" /> .ics
                                </button>
                                <a
                                  href={googleCalendarUrl({
                                    meetingId:    m.id,
                                    sponsorName:  sponsor.name,
                                    attendeeName: m.attendee.name,
                                    eventName:    event.name,
                                    eventSlug:    event.slug,
                                    date:         m.date,
                                    time:         m.time,
                                    location:     m.location,
                                    meetingType:  "onsite",
                                  })}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[10px] text-accent hover:underline flex items-center gap-0.5"
                                  title="Add to Google Calendar"
                                  data-testid={`link-gcal-${m.id}`}
                                >
                                  <ExternalLink className="h-3 w-3" /> GCal
                                </a>
                              </div>
                            )}
                          </div>

                          {/* Attendee */}
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="text-sm font-semibold text-foreground" data-testid={`text-attendee-name-${m.id}`}>{m.attendee.name}</p>
                              {m.attendee.linkedinUrl && (
                                <a href={m.attendee.linkedinUrl} target="_blank" rel="noopener noreferrer"
                                  className="text-[#0077B5] hover:opacity-80" title="LinkedIn"
                                  data-testid={`link-linkedin-${m.id}`}>
                                  <Linkedin className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{m.attendee.title}</p>
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Mail className="h-3 w-3" />{m.attendee.email}
                            </p>
                          </div>

                          {/* Company */}
                          <div className="min-w-0">
                            <p className="text-sm text-foreground truncate" data-testid={`text-attendee-company-${m.id}`}>{m.attendee.company}</p>
                          </div>

                          {/* Type */}
                          <div>
                            <span className={cn(
                              "text-xs font-semibold px-2 py-0.5 rounded-full border w-fit block",
                              isOnline ? "bg-violet-100 text-violet-700 border-violet-200" : "bg-blue-50 text-blue-700 border-blue-200"
                            )}>
                              {isOnline ? "Online" : "Onsite"}
                            </span>
                            {isOnline && m.platform && (
                              <p className="text-[10px] text-muted-foreground mt-0.5">{m.platform}</p>
                            )}
                          </div>

                          {/* Location */}
                          <div className="flex items-start gap-1.5 text-xs text-muted-foreground min-w-0">
                            {isOnline ? <Video className="h-3.5 w-3.5 shrink-0 mt-0.5" /> : <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />}
                            <span className="truncate">{isOnline ? (m.platform || "Online") : m.location}</span>
                          </div>

                          {/* Status */}
                          <div>
                            <span className={cn(
                              "text-xs font-semibold px-2.5 py-1 rounded-full border w-fit block",
                              statusColors[m.status] ?? "bg-muted text-muted-foreground border-muted"
                            )} data-testid={`status-badge-${m.id}`}>
                              {m.status}
                            </span>
                            {m.meetingLink && (
                              <a href={m.meetingLink} target="_blank" rel="noopener noreferrer" className="text-[10px] text-accent hover:underline flex items-center gap-0.5 mt-1" data-testid={`link-meeting-link-${m.id}`}>
                                <Link2 className="h-2.5 w-2.5" /> Meeting link
                              </a>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex flex-col gap-1 min-w-0" data-testid={`actions-${m.id}`}>
                            {/* Onsite Scheduled or Online Confirmed → Complete / Cancel */}
                            {((m.status === "Scheduled" && !isOnline) ||
                              (m.status === "Confirmed")) && (
                              <>
                                <button
                                  onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Completed" })}
                                  disabled={isBusy}
                                  className="text-xs px-2 py-1 rounded-md bg-green-100 text-green-700 hover:bg-green-200 border border-green-200 transition-colors disabled:opacity-50 w-full text-left"
                                  data-testid={`btn-complete-${m.id}`}
                                >
                                  Mark Completed
                                </button>
                                <button
                                  onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Cancelled" })}
                                  disabled={isBusy}
                                  className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 w-full text-left"
                                  data-testid={`btn-cancel-${m.id}`}
                                >
                                  Cancel
                                </button>
                              </>
                            )}

                            {/* Online Pending → Confirm / Decline / Cancel */}
                            {m.status === "Pending" && isOnline && (
                              isConfirming ? (
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                    <Link2 className="h-2.5 w-2.5" /> Meeting link (optional)
                                  </div>
                                  <input
                                    type="text"
                                    placeholder="https://..."
                                    value={linkInput}
                                    onChange={(e) => setLinkInput(e.target.value)}
                                    className="text-xs px-2 py-1 rounded-md border border-input bg-background w-full"
                                    data-testid={`input-meeting-link-${m.id}`}
                                    autoFocus
                                  />
                                  <div className="flex gap-1">
                                    <button
                                      onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Confirmed", meetingLink: linkInput })}
                                      disabled={isBusy}
                                      className="flex-1 text-xs px-2 py-1 rounded-md bg-teal-600 text-white hover:bg-teal-700 transition-colors disabled:opacity-50"
                                      data-testid={`btn-confirm-submit-${m.id}`}
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      onClick={() => { setConfirmingId(null); setLinkInput(""); }}
                                      className="text-xs px-2 py-1 rounded-md bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"
                                      data-testid={`btn-confirm-cancel-${m.id}`}
                                    >
                                      <XIcon className="h-3 w-3" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => { setConfirmingId(m.id); setLinkInput(""); }}
                                    className="text-xs px-2 py-1 rounded-md bg-teal-100 text-teal-700 hover:bg-teal-200 border border-teal-200 transition-colors w-full text-left"
                                    data-testid={`btn-confirm-${m.id}`}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Declined" })}
                                    disabled={isBusy}
                                    className="text-xs px-2 py-1 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 border border-orange-200 transition-colors disabled:opacity-50 w-full text-left"
                                    data-testid={`btn-decline-${m.id}`}
                                  >
                                    Decline Request
                                  </button>
                                  <button
                                    onClick={() => updateStatus.mutate({ meetingId: m.id, status: "Cancelled" })}
                                    disabled={isBusy}
                                    className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 transition-colors disabled:opacity-50 w-full text-left"
                                    data-testid={`btn-cancel-${m.id}`}
                                  >
                                    Cancel
                                  </button>
                                </>
                              )
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </>
            )}
          </div>

          {/* Leads table */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <button
              onClick={() => setLeadsOpen((v) => !v)}
              className="w-full px-6 py-4 border-b border-border/50 flex items-center justify-between hover:bg-muted/30 transition-colors"
              data-testid="toggle-leads"
            >
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-accent" />
                Lead Contacts
                <span className="text-xs font-normal text-muted-foreground">({leads.length} unique)</span>
              </h2>
              <div className="flex items-center gap-3">
                {leads.length > 0 && (
                  <span
                    className="text-xs text-accent underline underline-offset-2 hover:opacity-80 flex items-center gap-1"
                    onClick={(e) => { e.stopPropagation(); exportLeadsCSV(); }}
                    data-testid="btn-export-leads"
                  >
                    <Download className="h-3.5 w-3.5" /> Export CSV
                  </span>
                )}
                {leadsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {leadsOpen && (
              leads.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <Users className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No leads yet.</p>
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[1fr_140px_140px_160px_40px] gap-3 px-6 py-2.5 bg-muted/40 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Name / Title</span>
                    <span>Company</span>
                    <span>Email</span>
                    <span>LinkedIn</span>
                    <span>#</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {leads.map((lead, i) => (
                      <div
                        key={lead.email || i}
                        className="px-6 py-3 flex flex-col sm:grid sm:grid-cols-[1fr_140px_140px_160px_40px] sm:items-center gap-2 hover:bg-muted/20 transition-colors"
                        data-testid={`lead-row-${i}`}
                      >
                        <div>
                          <p className="text-sm font-semibold text-foreground">{lead.name}</p>
                          <p className="text-xs text-muted-foreground">{lead.title}</p>
                        </div>
                        <p className="text-sm text-foreground truncate">{lead.company}</p>
                        <p className="text-xs text-muted-foreground truncate">{lead.email}</p>
                        <div>
                          {lead.linkedinUrl ? (
                            <a href={lead.linkedinUrl} target="_blank" rel="noopener noreferrer"
                              className="text-xs text-[#0077B5] hover:underline flex items-center gap-1"
                              data-testid={`lead-linkedin-${i}`}>
                              <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </div>
                        <span className="text-xs text-muted-foreground font-mono">{lead.meetings}</span>
                      </div>
                    ))}
                  </div>
                </>
              )
            )}
          </div>
          {/* ── Information Requests section ──────────────────────────────── */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <button
              onClick={() => setInfoRequestsOpen((v) => !v)}
              className="w-full px-6 py-4 border-b border-border/50 flex items-center justify-between hover:bg-muted/30 transition-colors"
              data-testid="toggle-info-requests"
            >
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                Information Requests
                <span className="text-xs font-normal text-muted-foreground">({infoRequests.length} total)</span>
              </h2>
              <div className="flex items-center gap-3">
                {infoRequestsOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>

            {infoRequestsOpen && (
              infoRequests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
                  <MessageSquare className="h-8 w-8 opacity-20" />
                  <p className="text-sm">No information requests yet.</p>
                </div>
              ) : (
                <>
                  <div className="hidden sm:grid grid-cols-[1fr_140px_160px_120px_100px_160px] gap-3 px-6 py-2.5 bg-muted/40 border-b border-border/40 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Name / Title</span>
                    <span>Company</span>
                    <span>Email</span>
                    <span>Status</span>
                    <span>Source</span>
                    <span>Actions</span>
                  </div>
                  <div className="divide-y divide-border/40">
                    {[...infoRequests]
                      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                      .map((req) => {
                        const statusColor =
                          req.status === "New"       ? "bg-blue-100 text-blue-700 border-blue-200" :
                          req.status === "Contacted" ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                       "bg-gray-100 text-gray-600 border-gray-200";
                        return (
                          <div
                            key={req.id}
                            className="px-6 py-4 flex flex-col sm:grid sm:grid-cols-[1fr_140px_160px_120px_100px_160px] sm:items-start gap-3 hover:bg-muted/30 transition-colors"
                            data-testid={`info-req-row-${req.id}`}
                          >
                            <div>
                              <p className="text-sm font-semibold text-foreground">{req.attendeeFirstName} {req.attendeeLastName}</p>
                              <p className="text-xs text-muted-foreground">{req.attendeeTitle}</p>
                              {req.message && (
                                <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2 italic">"{req.message}"</p>
                              )}
                            </div>
                            <p className="text-sm text-foreground truncate">{req.attendeeCompany}</p>
                            <p className="text-xs text-muted-foreground truncate">{req.attendeeEmail}</p>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusColor} w-fit`}>
                              {req.status}
                            </span>
                            <p className="text-xs text-muted-foreground">{req.source}</p>
                            <div className="flex gap-2 flex-wrap">
                              {req.status === "New" && (
                                <button
                                  onClick={() => updateInfoStatus.mutate({ id: req.id, status: "Contacted" })}
                                  disabled={updateInfoStatus.isPending}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-amber-300 text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors disabled:opacity-50"
                                  data-testid={`btn-contacted-${req.id}`}
                                >
                                  Mark Contacted
                                </button>
                              )}
                              {req.status !== "Closed" && (
                                <button
                                  onClick={() => updateInfoStatus.mutate({ id: req.id, status: "Closed" })}
                                  disabled={updateInfoStatus.isPending}
                                  className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 text-gray-600 bg-gray-50 hover:bg-gray-100 transition-colors disabled:opacity-50"
                                  data-testid={`btn-close-req-${req.id}`}
                                >
                                  Close
                                </button>
                              )}
                              {req.status === "Closed" && (
                                <span className="text-xs text-muted-foreground/50">Closed</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )
            )}
          </div>

          {/* ── Performance Report section ─────────────────────────────────── */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-accent" /> Sponsor Performance Report
              </h2>
            </div>

            <div className="p-6 space-y-6">
              {/* Metrics grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Total Meetings",           value: stats.total,                                              icon: Handshake,   color: "bg-card border-border/60" },
                  { label: "Completed",                 value: stats.completed,                                          icon: CheckCircle2, color: "bg-green-50 border-green-200 text-green-800" },
                  { label: "Pending Online Requests",   value: stats.pendingOnline,                                      icon: Video,        color: "bg-violet-50 border-violet-200 text-violet-800" },
                  { label: "Cancelled / No-Show",       value: stats.cancelled,                                          icon: AlertCircle,  color: "bg-red-50 border-red-200 text-red-800" },
                  { label: "Unique Companies Met",      value: stats.companies,                                          icon: Users,        color: "bg-teal-50 border-teal-200 text-teal-800" },
                  { label: "Total Leads Captured",      value: (() => { const s = new Set(meetings.map((m) => m.attendee.email || m.attendee.name)); return s.size; })(), icon: UserCheck, color: "bg-indigo-50 border-indigo-200 text-indigo-800" },
                  { label: "Onsite Meetings",           value: meetings.filter((m) => m.meetingType !== "online_request").length, icon: Monitor, color: "bg-blue-50 border-blue-200 text-blue-800" },
                  { label: "Online Meetings",           value: meetings.filter((m) => m.meetingType === "online_request").length, icon: Video,  color: "bg-violet-50 border-violet-200 text-violet-800" },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div key={label} className={cn("rounded-xl border p-4 flex flex-col gap-2", color)}>
                    <Icon className="h-4 w-4 opacity-70" />
                    <div>
                      <p className="text-xl font-display font-bold leading-none">{value}</p>
                      <p className="text-[11px] font-medium mt-1 opacity-75 leading-tight">{label}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top Companies */}
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
                  <div>
                    <h3 className="text-xs font-semibold text-foreground flex items-center gap-2 mb-3">
                      <TrendingUp className="h-3.5 w-3.5 text-accent" /> Top Companies Met
                    </h3>
                    <div className="space-y-2">
                      {top5.map(([company, count], i) => {
                        const max = top5[0][1];
                        return (
                          <div key={company}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span className="text-foreground font-medium">{i + 1}. {company}</span>
                              <span className="text-muted-foreground">{count} meeting{count !== 1 ? "s" : ""}</span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-accent rounded-full" style={{ width: `${(count / max) * 100}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2 border-t border-border/40">
                <a
                  href={`/api/sponsor-report/pdf?token=${token}`}
                  download
                  className="flex-1"
                  data-testid="link-download-pdf"
                >
                  <Button className="w-full gap-2 bg-accent text-accent-foreground hover:bg-accent/90">
                    <FileDown className="h-4 w-4" />
                    Download PDF Report
                  </Button>
                </a>
                <Button
                  variant="outline"
                  className="flex-1 gap-2"
                  onClick={exportLeadsCSV}
                  data-testid="btn-export-leads-report"
                >
                  <Download className="h-4 w-4" />
                  Export Leads CSV
                </Button>
              </div>
            </div>
          </div>

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
