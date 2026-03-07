import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor, Attendee, Meeting } from "@shared/schema";
import {
  BarChart3, Download, Calendar, Building2, Users,
  Clock, CheckCircle2, XCircle, AlertCircle, Handshake, Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";

const statusColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow:    "bg-yellow-100 text-yellow-700 border-yellow-200",
};
const statusIcons: Record<string, React.ReactNode> = {
  Scheduled: <Clock className="h-3 w-3" />,
  Completed: <CheckCircle2 className="h-3 w-3" />,
  Cancelled: <XCircle className="h-3 w-3" />,
  NoShow:    <AlertCircle className="h-3 w-3" />,
};

function StatCard({ label, value, icon: Icon, color }: { label: string; value: number; icon: React.ElementType; color: string }) {
  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-4", color)}>
      <div className="h-10 w-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold leading-none">{value}</p>
        <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
      </div>
    </div>
  );
}

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");

  const { data: events   = [] } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: attendees = [] } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });

  const getName = (arr: { id: string; name: string }[], id: string) => arr.find((x) => x.id === id)?.name ?? "—";
  const getEventSlug = (id: string) => events.find((e) => e.id === id)?.slug ?? "—";
  const getSponsorName = (id: string) => getName(sponsors as any, id);
  const getAttendeeName = (id: string) => getName(attendees as any, id);
  const getAttendeeCompany = (id: string) => attendees.find((a) => a.id === id)?.company ?? "—";

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0 };
    meetings.forEach((m) => { if (m.status in c) c[m.status]++; });
    return c;
  }, [meetings]);

  const perEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.eventId] = (counts[m.eventId] ?? 0) + 1; });
    return events
      .map((e) => ({ event: e, count: counts[e.id] ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [meetings, events]);

  const perSponsor = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.sponsorId] = (counts[m.sponsorId] ?? 0) + 1; });
    return sponsors
      .map((s) => ({ sponsor: s, count: counts[s.id] ?? 0 }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [meetings, sponsors]);

  const filtered = useMemo(() => {
    return meetings
      .filter((m) => {
        if (filterEvent && m.eventId !== filterEvent) return false;
        if (filterStatus && m.status !== filterStatus) return false;
        if (search) {
          const q = search.toLowerCase();
          const sponsor = getSponsorName(m.sponsorId).toLowerCase();
          const attendee = getAttendeeName(m.attendeeId).toLowerCase();
          const slug = getEventSlug(m.eventId).toLowerCase();
          if (!sponsor.includes(q) && !attendee.includes(q) && !slug.includes(q) && !m.date.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [meetings, filterEvent, filterStatus, search]);

  const handleExport = () => {
    const rows = [
      ["Event", "Sponsor", "Attendee", "Company", "Date", "Time", "Location", "Status"].join(","),
      ...filtered.map((m) => [
        getEventSlug(m.eventId),
        getSponsorName(m.sponsorId),
        getAttendeeName(m.attendeeId),
        getAttendeeCompany(m.attendeeId),
        m.date,
        m.time,
        m.location,
        m.status,
      ].map((v) => `"${v}"`).join(",")),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meeting-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectClass = "flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">Scheduled meeting data across all events.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm"
          data-testid="button-export-csv"
        >
          <Download className="h-4 w-4" /> Export CSV
        </button>
      </div>

      {/* Top stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Meetings"  value={meetings.length}            icon={Handshake}    color="bg-card border-border/60" />
        <StatCard label="Scheduled"        value={statusCounts.Scheduled}     icon={Clock}        color="bg-blue-50 border-blue-200 text-blue-800" />
        <StatCard label="Completed"        value={statusCounts.Completed}     icon={CheckCircle2} color="bg-green-50 border-green-200 text-green-800" />
        <StatCard label="Cancelled / No-Show" value={statusCounts.Cancelled + statusCounts.NoShow} icon={XCircle} color="bg-red-50 border-red-200 text-red-800" />
      </div>

      {/* Breakdowns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* By Event */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-accent" /> Meetings by Event
          </h2>
          {perEvent.length === 0 || perEvent.every((x) => x.count === 0) ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {perEvent.map(({ event, count }) => {
                const max = Math.max(...perEvent.map((x) => x.count), 1);
                return (
                  <div key={event.id}>
                    <div className="flex items-center justify-between mb-1">
                      <div>
                        <span className="text-xs font-mono font-bold text-foreground">{event.slug}</span>
                        <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{event.name.slice(0, 30)}{event.name.length > 30 ? "…" : ""}</span>
                      </div>
                      <span className="text-xs font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-accent rounded-full transition-all duration-500"
                        style={{ width: count === 0 ? "0%" : `${(count / max) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* By Sponsor */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" /> Meetings by Sponsor
          </h2>
          {perSponsor.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>
          ) : (
            <div className="space-y-3">
              {perSponsor.map(({ sponsor, count }) => {
                const max = Math.max(...perSponsor.map((x) => x.count), 1);
                return (
                  <div key={sponsor.id}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-foreground">{sponsor.name}</span>
                      <span className="text-xs font-semibold text-foreground">{count}</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-500"
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

      {/* Meeting schedule table */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {/* Table filters */}
        <div className="p-5 border-b border-border/50 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by sponsor, attendee, event…"
              className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20 h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-reports-search"
            />
          </div>
          <select className={selectClass} value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} data-testid="select-reports-event">
            <option value="">All Events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.slug}</option>)}
          </select>
          <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="select-reports-status">
            <option value="">All Statuses</option>
            {["Scheduled", "Completed", "Cancelled", "NoShow"].map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {/* Count */}
        <div className="px-5 py-2.5 border-b border-border/50 bg-muted/20 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            Showing <strong className="text-foreground">{filtered.length}</strong> of <strong className="text-foreground">{meetings.length}</strong> meetings
          </span>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Handshake className="h-8 w-8 opacity-20" />
            <p className="text-sm">No meetings match the current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {["Event", "Date", "Time", "Sponsor", "Attendee", "Company", "Location", "Status"].map((h) => (
                    <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => (
                  <tr
                    key={m.id}
                    className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors", i % 2 === 0 ? "" : "bg-muted/10")}
                    data-testid={`report-row-${m.id}`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                        {getEventSlug(m.eventId)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{m.date}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{m.time}</td>
                    <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{getSponsorName(m.sponsorId)}</td>
                    <td className="px-4 py-3 text-foreground whitespace-nowrap">{getAttendeeName(m.attendeeId)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{getAttendeeCompany(m.attendeeId)}</td>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{m.location}</td>
                    <td className="px-4 py-3">
                      <span className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border w-fit", statusColors[m.status] ?? "bg-muted text-muted-foreground border-muted")}>
                        {statusIcons[m.status]} {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
