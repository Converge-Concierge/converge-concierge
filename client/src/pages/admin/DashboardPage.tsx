import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Event, Sponsor, Attendee, Meeting } from "@shared/schema";
import {
  CalendarDays, Building2, Users, Handshake, TrendingUp,
  ArrowRight, Clock, CheckCircle2, XCircle, AlertCircle,
} from "lucide-react";
import { format, parseISO, isAfter } from "date-fns";
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

  const { data: events   = [] } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: attendees = [] } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: meetings = [] } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });

  const activeEvents   = events.filter((e) => e.status === "active");
  const activeSponsors = sponsors.filter((s) => s.status === "active");

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0 };
    meetings.forEach((m) => { if (m.status in counts) counts[m.status]++; });
    return counts;
  }, [meetings]);

  // Upcoming meetings: Scheduled status, sorted by date+time ascending
  const upcoming = useMemo(() => {
    return [...meetings]
      .filter((m) => m.status === "Scheduled")
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
      .slice(0, 8);
  }, [meetings]);

  // Per-event meeting counts
  const meetingsByEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.eventId] = (counts[m.eventId] ?? 0) + 1; });
    return events
      .map((e) => ({ event: e, count: counts[e.id] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [meetings, events]);

  function getSponsorName(id: string) { return sponsors.find((s) => s.id === id)?.name ?? "—"; }
  function getAttendeeName(id: string) { return attendees.find((a) => a.id === id)?.name ?? "—"; }
  function getEventSlug(id: string) { return events.find((e) => e.id === id)?.slug ?? "—"; }

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
          Overview of your scheduling activity across all events.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
      </div>

      {/* Status breakdown */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-accent" /> Meeting Status Breakdown
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Object.entries(statusCounts).map(([status, count]) => (
            <div key={status} className="flex flex-col items-center justify-center p-4 rounded-xl bg-muted/40 border border-border/40">
              <span className={cn("flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full mb-2", statusColors[status] ?? "bg-muted text-muted-foreground")}>
                {statusIcons[status]} {status}
              </span>
              <span className="text-2xl font-display font-bold text-foreground">{count}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming meetings */}
        <div className="lg:col-span-2 bg-card rounded-2xl border border-border/60 shadow-sm p-6">
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
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
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

        {/* Meetings by event */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-accent" /> Meetings by Event
          </h2>
          {meetingsByEvent.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
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
      </div>
    </motion.div>
  );
}
