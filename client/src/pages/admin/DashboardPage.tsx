import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Event, Sponsor, Attendee, Meeting, InformationRequest } from "@shared/schema";
import {
  CalendarDays, Building2, Users, Handshake, TrendingUp,
  ArrowRight, Clock, CheckCircle2, XCircle, AlertCircle,
  MessageSquare, FileText, AlertTriangle, ShieldAlert,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700",
  Completed: "bg-green-100 text-green-700",
  Cancelled: "bg-red-100 text-red-700",
  NoShow:    "bg-yellow-100 text-yellow-700",
};
const statusIcons: Record<string, React.ReactNode> = {
  Scheduled: <Clock className="h-3 w-3" />,
  Completed: <CheckCircle2 className="h-3 w-3" />,
  Cancelled: <XCircle className="h-3 w-3" />,
  NoShow:    <AlertCircle className="h-3 w-3" />,
};

const infoStatusColors: Record<string, string> = {
  New:              "bg-blue-100 text-blue-700",
  Open:             "bg-blue-100 text-blue-700",
  "Email Sent":     "bg-amber-100 text-amber-700",
  Contacted:        "bg-amber-100 text-amber-700",
  "Meeting Scheduled": "bg-teal-100 text-teal-700",
  Closed:           "bg-gray-100 text-gray-600",
  "Not Qualified":  "bg-orange-100 text-orange-700",
};

function StatCard({
  label, value, icon: Icon, sub, accent, onClick,
}: { label: string; value: number | string; icon: React.ElementType; sub?: string; accent?: string; onClick?: () => void }) {
  return (
    <motion.div
      whileHover={{ y: -2 }}
      onClick={onClick}
      className={cn(
        "bg-card rounded-2xl border border-border/60 shadow-sm p-6 flex flex-col gap-4",
        onClick ? "cursor-pointer hover:shadow-md transition-all duration-200" : "",
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center", accent ?? "bg-muted")}>
          <Icon className="h-4 w-4 text-foreground/70" />
        </div>
      </div>
      <div>
        <p className="text-3xl font-display font-bold text-foreground">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

export default function DashboardPage() {
  const [, nav] = useLocation();

  const { data: events      = [] } = useQuery<Event[]>             ({ queryKey: ["/api/events"]   });
  const { data: sponsors    = [] } = useQuery<Sponsor[]>           ({ queryKey: ["/api/sponsors"] });
  const { data: attendees   = [] } = useQuery<Attendee[]>          ({ queryKey: ["/api/attendees"] });
  const { data: meetings    = [] } = useQuery<Meeting[]>           ({ queryKey: ["/api/meetings"] });
  const { data: infoRequests = [] } = useQuery<InformationRequest[]>({ queryKey: ["/api/admin/information-requests"] });

  const activeEvents   = events.filter((e) => (e.archiveState ?? "active") === "active");
  const activeSponsors = sponsors.filter((s) => (s.archiveState ?? "active") === "active");

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0 };
    meetings.forEach((m) => { if (m.status in counts) counts[m.status]++; });
    return counts;
  }, [meetings]);

  const upcoming = useMemo(() => {
    return [...meetings]
      .filter((m) => m.status === "Scheduled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 8);
  }, [meetings]);

  const recentInfoRequests = useMemo(() => {
    return [...infoRequests]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  }, [infoRequests]);

  const meetingsByEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.eventId] = (counts[m.eventId] ?? 0) + 1; });
    return events
      .map((e) => ({ event: e, count: counts[e.id] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [meetings, events]);

  const meetingsBySponsor = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.sponsorId] = (counts[m.sponsorId] ?? 0) + 1; });
    return sponsors
      .map((s) => ({ sponsor: s, count: counts[s.id] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [meetings, sponsors]);

  const needsAttentionItems = useMemo(() => {
    const items: Array<{
      severity: "error" | "warning" | "info";
      title: string;
      desc: string;
      link: string;
      linkText: string;
    }> = [];

    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const stale = infoRequests.filter(
      (r) => (r.status === "New" || r.status === "Open") && new Date(r.createdAt) < threeDaysAgo,
    );
    if (stale.length > 0) {
      items.push({
        severity: "warning",
        title: `${stale.length} open info request${stale.length !== 1 ? "s" : ""} older than 3 days`,
        desc: "These requests haven't been addressed and may need follow-up.",
        link: "/admin/information-requests",
        linkText: "View Requests",
      });
    }

    const sponsorMeetingCounts: Record<string, number> = {};
    meetings.forEach((m) => { sponsorMeetingCounts[m.sponsorId] = (sponsorMeetingCounts[m.sponsorId] ?? 0) + 1; });
    const zeroMeetingSponsors = activeSponsors.filter((s) => !sponsorMeetingCounts[s.id]);
    if (zeroMeetingSponsors.length > 0) {
      items.push({
        severity: "info",
        title: `${zeroMeetingSponsors.length} sponsor${zeroMeetingSponsors.length !== 1 ? "s" : ""} with no meetings`,
        desc: "These sponsors have no meetings scheduled across any event.",
        link: "/admin/sponsors",
        linkText: "View Sponsors",
      });
    }

    const now = new Date();
    const fortyEightHoursFromNow = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const urgentPending = meetings.filter((m) => {
      if (m.status !== "Pending") return false;
      try {
        const dt = new Date(`${m.date}T${m.time}`);
        return dt >= now && dt <= fortyEightHoursFromNow;
      } catch { return false; }
    });
    if (urgentPending.length > 0) {
      items.push({
        severity: "error",
        title: `${urgentPending.length} pending meeting${urgentPending.length !== 1 ? "s" : ""} within 48 hours`,
        desc: "These meetings are approaching but haven't been confirmed or completed.",
        link: "/admin/meetings",
        linkText: "View Meetings",
      });
    }

    return items;
  }, [infoRequests, meetings, activeSponsors]);

  function getSponsorName(id: string) { return sponsors.find((s) => s.id === id)?.name ?? "—"; }
  function getAttendeeName(id: string) { return attendees.find((a) => a.id === id)?.name ?? "—"; }
  function getEventSlug(id: string) { return events.find((e) => e.id === id)?.slug ?? "—"; }
  function getSponsorNameById(id: string | null) { return id ? (sponsors.find((s) => s.id === id)?.name ?? "—") : "—"; }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div>
        <h1 className="text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Command center — activity, queue, and performance across all events.
        </p>
      </div>

      {/* Top KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          label="Total Meetings"
          value={meetings.length}
          icon={Handshake}
          sub={`${statusCounts.Scheduled} scheduled`}
          accent="bg-accent/10"
          onClick={() => nav("/admin/meetings")}
        />
        <StatCard
          label="Active Events"
          value={activeEvents.length}
          icon={CalendarDays}
          sub={`${events.length} total`}
          accent="bg-primary/10"
          onClick={() => nav("/admin/events")}
        />
        <StatCard
          label="Active Sponsors"
          value={activeSponsors.length}
          icon={Building2}
          sub={`${sponsors.length} total`}
          accent="bg-yellow-100"
          onClick={() => nav("/admin/sponsors")}
        />
        <StatCard
          label="Attendees"
          value={attendees.length}
          icon={Users}
          sub="registered"
          accent="bg-green-100"
          onClick={() => nav("/admin/attendees")}
        />
        <StatCard
          label="Info Requests"
          value={infoRequests.length}
          icon={MessageSquare}
          sub={`${infoRequests.filter((r) => r.status === "New" || r.status === "Open").length} open`}
          accent="bg-blue-100"
          onClick={() => nav("/admin/information-requests")}
        />
      </div>

      {/* Needs Attention */}
      <div className={cn(
        "rounded-2xl border shadow-sm p-6",
        needsAttentionItems.length > 0 ? "bg-card border-amber-200" : "bg-green-50 dark:bg-green-950/30 border-green-200",
      )}>
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          {needsAttentionItems.length > 0
            ? <ShieldAlert className="h-4 w-4 text-amber-500" />
            : <CheckCircle2 className="h-4 w-4 text-green-500" />
          }
          Needs Attention
        </h2>
        {needsAttentionItems.length === 0 ? (
          <p className="text-sm text-green-700 dark:text-green-400 font-medium">All clear — no issues detected.</p>
        ) : (
          <div className="space-y-3">
            {needsAttentionItems.map((item, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-start gap-3 p-3 rounded-xl border",
                  item.severity === "error" && "bg-red-50 border-red-200 dark:bg-red-950/30",
                  item.severity === "warning" && "bg-amber-50 border-amber-200 dark:bg-amber-950/30",
                  item.severity === "info" && "bg-blue-50 border-blue-200 dark:bg-blue-950/30",
                )}
                data-testid={`needs-attention-item-${i}`}
              >
                <div className="mt-0.5 shrink-0">
                  {item.severity === "error" && <AlertCircle className="h-4 w-4 text-red-500" />}
                  {item.severity === "warning" && <AlertTriangle className="h-4 w-4 text-amber-500" />}
                  {item.severity === "info" && <AlertCircle className="h-4 w-4 text-blue-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-sm font-semibold",
                    item.severity === "error" && "text-red-700 dark:text-red-400",
                    item.severity === "warning" && "text-amber-700 dark:text-amber-400",
                    item.severity === "info" && "text-blue-700 dark:text-blue-400",
                  )}>{item.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                </div>
                <button
                  onClick={() => nav(item.link)}
                  className={cn(
                    "shrink-0 text-xs font-medium flex items-center gap-1 hover:underline underline-offset-2",
                    item.severity === "error" && "text-red-600",
                    item.severity === "warning" && "text-amber-600",
                    item.severity === "info" && "text-blue-600",
                  )}
                  data-testid={`needs-attention-link-${i}`}
                >
                  {item.linkText} <ArrowRight className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Status breakdown */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" /> Meeting Status Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/40 border border-border/40 cursor-pointer hover:bg-muted/60 transition-colors" onClick={() => nav("/admin/meetings")}>
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-2", statusColors[status] ?? "bg-muted text-muted-foreground")}>
                {statusIcons[status]} {status}
              </span>
              <span className="text-2xl font-display font-bold text-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Operational widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upcoming meetings */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" /> Upcoming Meetings
            </h2>
            <button
              onClick={() => nav("/admin/meetings")}
              className="text-xs text-accent flex items-center gap-1 hover:underline underline-offset-2"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {upcoming.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Handshake className="h-8 w-8 opacity-20" />
              <p className="text-sm">No upcoming meetings scheduled.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Handshake className="h-4 w-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {getSponsorName(m.sponsorId)} · {getAttendeeName(m.attendeeId)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {getEventSlug(m.eventId)} · {m.date} at {m.time}
                    </p>
                  </div>
                  <span className="text-xs font-mono text-muted-foreground shrink-0 hidden sm:block">
                    {m.location}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Info Requests */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-accent" /> Recent Info Requests
            </h2>
            <button
              onClick={() => nav("/admin/information-requests")}
              className="text-xs text-accent flex items-center gap-1 hover:underline underline-offset-2"
            >
              View all <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {recentInfoRequests.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <MessageSquare className="h-8 w-8 opacity-20" />
              <p className="text-sm">No information requests yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentInfoRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                    <FileText className="h-4 w-4 text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {req.attendeeFirstName} {req.attendeeLastName} · {req.attendeeCompany}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {getSponsorNameById(req.sponsorId)} · {getEventSlug(req.eventId ?? "")}
                    </p>
                  </div>
                  <span className={cn(
                    "text-xs font-semibold px-2 py-0.5 rounded-full shrink-0",
                    infoStatusColors[req.status] ?? "bg-muted text-muted-foreground",
                  )}>
                    {req.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Performance visuals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meetings by event */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-accent" /> Meetings by Event
            </h2>
            <button
              onClick={() => nav("/admin/reports")}
              className="text-xs text-accent flex items-center gap-1 hover:underline underline-offset-2"
            >
              Reports <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {meetingsByEvent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <CalendarDays className="h-8 w-8 opacity-20" />
              <p className="text-sm text-center">No meetings recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetingsByEvent.map(({ event, count }) => {
                const max = meetingsByEvent[0].count;
                return (
                  <div key={event.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-mono font-semibold text-foreground">{event.slug}</span>
                      <span className="text-xs text-muted-foreground font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Meetings by sponsor */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" /> Meetings by Sponsor
            </h2>
            <button
              onClick={() => nav("/admin/sponsors")}
              className="text-xs text-accent flex items-center gap-1 hover:underline underline-offset-2"
            >
              View sponsors <ArrowRight className="h-3 w-3" />
            </button>
          </div>
          {meetingsBySponsor.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground gap-2">
              <Building2 className="h-8 w-8 opacity-20" />
              <p className="text-sm text-center">No meetings recorded yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {meetingsBySponsor.map(({ sponsor, count }) => {
                const max = meetingsBySponsor[0].count;
                return (
                  <div key={sponsor.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground truncate max-w-[180px]">{sponsor.name}</span>
                      <span className="text-xs text-muted-foreground font-medium">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-full transition-all duration-500"
                        style={{ width: `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
