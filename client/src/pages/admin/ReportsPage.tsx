import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor, Attendee, Meeting } from "@shared/schema";
import {
  BarChart3, Download, Calendar, Building2, Users,
  Clock, CheckCircle2, XCircle, AlertCircle, Handshake, Search,
  TrendingUp, ArrowUpDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, Cell,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#3b82f6",
  Completed:  "#22c55e",
  Cancelled:  "#ef4444",
  NoShow:     "#f59e0b",
};

const statusBadgeColors: Record<string, string> = {
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

type SortKey = "name" | "total" | "scheduled" | "completed" | "cancelled" | "noShow" | "companies";

// ── Sub-components ─────────────────────────────────────────────────────────────

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

function SortHeader({
  label, sortKey, current, dir, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; dir: "asc" | "desc";
  onSort: (k: SortKey) => void;
}) {
  const active = current === sortKey;
  return (
    <th
      className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap cursor-pointer select-none hover:text-foreground transition-colors group"
      onClick={() => onSort(sortKey)}
      data-testid={`sort-col-${sortKey}`}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3 transition-opacity", active ? "opacity-100 text-accent" : "opacity-30 group-hover:opacity-70")} />
        {active && <span className="text-[10px] font-normal text-accent">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

// ── Custom tooltip for recharts ───────────────────────────────────────────────

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm shrink-0" style={{ background: p.fill }} />
            <span className="text-muted-foreground">{p.dataKey}</span>
          </span>
          <span className="font-semibold text-foreground">{p.value}</span>
        </div>
      ))}
      <div className="border-t border-border/40 mt-2 pt-2 flex justify-between">
        <span className="text-muted-foreground">Total</span>
        <span className="font-bold text-foreground">{total}</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

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

  // ── Sponsor analytics ─────────────────────────────────────────────────────

  const sponsorAnalytics = useMemo(() => {
    type Row = { id: string; name: string; total: number; scheduled: number; completed: number; cancelled: number; noShow: number; companies: number };
    const map: Record<string, Row> = {};

    sponsors.forEach((s) => {
      map[s.id] = { id: s.id, name: s.name, total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, companies: 0 };
    });

    const companyTracker: Record<string, Set<string>> = {};
    meetings.forEach((m) => {
      if (!map[m.sponsorId]) return;
      const row = map[m.sponsorId];
      row.total++;
      if (m.status === "Scheduled")  row.scheduled++;
      if (m.status === "Completed")  row.completed++;
      if (m.status === "Cancelled")  row.cancelled++;
      if (m.status === "NoShow")     row.noShow++;
      if (!companyTracker[m.sponsorId]) companyTracker[m.sponsorId] = new Set();
      const company = attendees.find((a) => a.id === m.attendeeId)?.company;
      if (company) companyTracker[m.sponsorId].add(company);
    });

    Object.keys(companyTracker).forEach((sid) => {
      if (map[sid]) map[sid].companies = companyTracker[sid].size;
    });

    return Object.values(map);
  }, [meetings, sponsors, attendees]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedAnalytics = useMemo(() => {
    return [...sponsorAnalytics].sort((a, b) => {
      const av = a[sortKey] as any;
      const bv = b[sortKey] as any;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sponsorAnalytics, sortKey, sortDir]);

  const chartData = useMemo(() =>
    [...sponsorAnalytics]
      .filter((s) => s.total > 0)
      .sort((a, b) => b.total - a.total)
      .map((s) => ({
        name: s.name,
        Scheduled: s.scheduled,
        Completed:  s.completed,
        Cancelled:  s.cancelled,
        NoShow:     s.noShow,
      })),
    [sponsorAnalytics]
  );

  // ── Meeting log ───────────────────────────────────────────────────────────

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
        <StatCard label="Total Meetings"        value={meetings.length}                                icon={Handshake}    color="bg-card border-border/60" />
        <StatCard label="Scheduled"              value={statusCounts.Scheduled}                         icon={Clock}        color="bg-blue-50 border-blue-200 text-blue-800" />
        <StatCard label="Completed"              value={statusCounts.Completed}                         icon={CheckCircle2} color="bg-green-50 border-green-200 text-green-800" />
        <StatCard label="Cancelled / No-Show"    value={statusCounts.Cancelled + statusCounts.NoShow}   icon={XCircle}      color="bg-red-50 border-red-200 text-red-800" />
      </div>

      {/* Meetings by Event breakdown */}
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
                      <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">
                        {event.name.slice(0, 40)}{event.name.length > 40 ? "…" : ""}
                      </span>
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

      {/* ── Sponsor Performance Analytics ───────────────────────────────────── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-accent" />
          <h2 className="text-xl font-display font-semibold text-foreground">Sponsor Performance Analytics</h2>
        </div>

        {/* Stacked bar chart */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6" data-testid="sponsor-analytics-chart">
          <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-accent" /> Meeting Breakdown by Sponsor
          </h3>
          {chartData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <BarChart3 className="h-8 w-8 opacity-20" />
              <p className="text-sm">No meeting data yet. Meetings will appear here once scheduled.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 56 + 60)}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
                barCategoryGap="28%"
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis
                  type="number"
                  allowDecimals={false}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={90}
                  tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                <Legend
                  wrapperStyle={{ fontSize: 12, paddingTop: 16 }}
                  formatter={(value) => <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{value}</span>}
                />
                <Bar dataKey="Scheduled" stackId="a" fill={STATUS_COLORS.Scheduled} radius={[0, 0, 0, 0]} />
                <Bar dataKey="Completed"  stackId="a" fill={STATUS_COLORS.Completed}  radius={[0, 0, 0, 0]} />
                <Bar dataKey="Cancelled"  stackId="a" fill={STATUS_COLORS.Cancelled}  radius={[0, 0, 0, 0]} />
                <Bar dataKey="NoShow"     stackId="a" fill={STATUS_COLORS.NoShow}     radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Analytics table */}
        <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid="sponsor-analytics-table">
          <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Sponsor Breakdown</h3>
            <span className="ml-auto text-xs text-muted-foreground">Click column headers to sort</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  <SortHeader label="Sponsor"           sortKey="name"      current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Total"             sortKey="total"     current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Scheduled"         sortKey="scheduled" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Completed"         sortKey="completed" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Cancelled"         sortKey="cancelled" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="No-Show"           sortKey="noShow"    current={sortKey} dir={sortDir} onSort={handleSort} />
                  <SortHeader label="Unique Companies"  sortKey="companies" current={sortKey} dir={sortDir} onSort={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Completion Rate</th>
                </tr>
              </thead>
              <tbody>
                {sortedAnalytics.map((row, i) => {
                  const done = row.completed + row.cancelled + row.noShow;
                  const rate = done > 0 ? Math.round((row.completed / done) * 100) : null;
                  const isEmpty = row.total === 0;
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/30 transition-colors",
                        i % 2 === 1 && "bg-muted/10",
                        isEmpty && "opacity-50",
                      )}
                      data-testid={`analytics-row-${row.id}`}
                    >
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{row.name}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-sm font-bold",
                          row.total > 0 ? "text-foreground" : "text-muted-foreground",
                        )}>
                          {row.total}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {row.scheduled > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border w-fit bg-blue-100 text-blue-700 border-blue-200">
                            {row.scheduled}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.completed > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border w-fit bg-green-100 text-green-700 border-green-200">
                            {row.completed}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.cancelled > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border w-fit bg-red-100 text-red-700 border-red-200">
                            {row.cancelled}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.noShow > 0 ? (
                          <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border w-fit bg-yellow-100 text-yellow-700 border-yellow-200">
                            {row.noShow}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {row.companies > 0 ? (
                          <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                            <Users className="h-3.5 w-3.5 text-accent" />{row.companies}
                          </span>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {rate !== null ? (
                          <div className="flex items-center gap-2 min-w-[100px]">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-green-500 rounded-full transition-all duration-500"
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <span className="text-xs font-semibold text-foreground w-8 text-right">{rate}%</span>
                          </div>
                        ) : <span className="text-muted-foreground text-sm">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Meeting log table */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
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
                      <span className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border w-fit", statusBadgeColors[m.status] ?? "bg-muted text-muted-foreground border-muted")}>
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
