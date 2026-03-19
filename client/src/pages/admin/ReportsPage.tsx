import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor, Attendee, Meeting, InformationRequest, INFORMATION_REQUEST_STATUSES } from "@shared/schema";
import {
  BarChart3, Download, Calendar, Building2, Users,
  Clock, CheckCircle2, XCircle, AlertCircle, Handshake, Search,
  TrendingUp, ArrowUpDown, ExternalLink, User, Globe, Shield,
  Monitor, Video, FileDown, MessageSquare,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";

// ── Constants ─────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  Scheduled: "#3b82f6",
  Completed:  "#22c55e",
  Cancelled:  "#ef4444",
  NoShow:     "#f59e0b",
  Pending:    "#8b5cf6",
  Confirmed:  "#06b6d4",
};

const statusBadgeColors: Record<string, string> = {
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Completed: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-700 border-red-200",
  NoShow:    "bg-yellow-100 text-yellow-700 border-yellow-200",
  Pending:   "bg-violet-100 text-violet-700 border-violet-200",
  Confirmed: "bg-cyan-100 text-cyan-700 border-cyan-200",
};

const statusIcons: Record<string, React.ReactNode> = {
  Scheduled: <Clock className="h-3 w-3" />,
  Completed: <CheckCircle2 className="h-3 w-3" />,
  Cancelled: <XCircle className="h-3 w-3" />,
  NoShow:    <AlertCircle className="h-3 w-3" />,
  Pending:   <Clock className="h-3 w-3" />,
  Confirmed: <CheckCircle2 className="h-3 w-3" />,
};

const ALL_STATUSES = ["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed"];

type ReportTab = "all" | "by-sponsor" | "by-attendee";
type SortKey = "name" | "total" | "scheduled" | "completed" | "cancelled" | "noShow" | "companies" | "online" | "onsite" | "pending";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: string | number; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className={cn("rounded-2xl border p-5 flex items-center gap-4", color)}>
      <div className="h-10 w-10 rounded-xl bg-white/60 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-2xl font-display font-bold leading-none">{value}</p>
        <p className="text-xs font-medium mt-1 opacity-80">{label}</p>
        {sub && <p className="text-[10px] opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SortHeader({ label, sortKey, current, dir, onSort }: {
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
        {active && <span className="text-[10px] text-accent">{dir === "asc" ? "▲" : "▼"}</span>}
      </span>
    </th>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s: number, p: any) => s + (p.value ?? 0), 0);
  return (
    <div className="bg-card border border-border/60 rounded-xl shadow-lg px-4 py-3 text-xs min-w-[160px]">
      <p className="font-semibold text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.fill }} />
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

// ── Meeting row used in all three report tables ───────────────────────────────

function MeetingRow({ m, eventSlug, sponsorName, attendee, striped }: {
  m: Meeting;
  eventSlug: string;
  sponsorName: string;
  attendee: Attendee | undefined;
  striped: boolean;
}) {
  const isOnline = m.meetingType === "online_request";
  return (
    <tr
      className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors", striped && "bg-muted/10")}
      data-testid={`report-row-${m.id}`}
    >
      <td className="px-4 py-3">
        <span className="font-mono text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">{eventSlug}</span>
      </td>
      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{sponsorName}</td>
      <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">{attendee?.name ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{attendee?.company ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{attendee?.title ?? "—"}</td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap text-xs">{attendee?.email ?? "—"}</td>
      <td className="px-4 py-3">
        {attendee?.linkedinUrl ? (
          <a href={attendee.linkedinUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-[#0077B5] hover:opacity-80 transition-opacity whitespace-nowrap"
            data-testid={`linkedin-${m.id}`}
          >
            <ExternalLink className="h-3 w-3" /> View
          </a>
        ) : <span className="text-muted-foreground text-xs">—</span>}
      </td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{m.date}</td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{fmt12(m.time)}</td>
      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{m.location}</td>
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border w-fit",
          isOnline
            ? "bg-violet-50 text-violet-700 border-violet-200"
            : "bg-sky-50 text-sky-700 border-sky-200",
        )}>
          {isOnline ? <Video className="h-3 w-3" /> : <Monitor className="h-3 w-3" />}
          {isOnline ? "Online" : "Onsite"}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={cn("flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border w-fit", statusBadgeColors[m.status] ?? "bg-muted text-muted-foreground border-muted")}>
          {statusIcons[m.status]} {m.status}
        </span>
      </td>
      <td className="px-4 py-3">
        {m.source === "public"
          ? <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200"><Globe className="h-3 w-3" />Public</span>
          : <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-600 border-slate-200"><Shield className="h-3 w-3" />Admin</span>
        }
      </td>
    </tr>
  );
}

const REPORT_THEAD = (
  <thead>
    <tr className="border-b border-border/50 bg-muted/30">
      {["Event Code", "Sponsor", "Attendee", "Company", "Title", "Email", "LinkedIn", "Date", "Time", "Location", "Type", "Status", "Source"].map((h) => (
        <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
      ))}
    </tr>
  </thead>
);

// ── Main component ─────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [mainTab, setMainTab] = useState<"overview" | "sponsor-perf" | "meeting-data" | "info-requests">("overview");
  const [globalEventId, setGlobalEventId] = useState("");
  const [tab, setTab] = useState<ReportTab>("all");
  const [reportEventId, setReportEventId] = useState("");
  const [reportSponsorId, setReportSponsorId] = useState("");
  const [reportMeetingType, setReportMeetingType] = useState("");
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [filterSponsorId, setFilterSponsorId] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterMeetingType, setFilterMeetingType] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("total");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pdfDownloading, setPdfDownloading] = useState(false);

  const [irEventId, setIrEventId] = useState("");
  const [irSponsorId, setIrSponsorId] = useState("");
  const [irStatus, setIrStatus] = useState("");
  const [irSource, setIrSource] = useState("");
  const [irSearch, setIrSearch] = useState("");

  const { data: events    = [] } = useQuery<Event[]>   ({ queryKey: ["/api/events"]    });
  const { data: sponsors  = [] } = useQuery<Sponsor[]> ({ queryKey: ["/api/sponsors"]  });
  const { data: attendees = [] } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: meetings  = [], isLoading } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: allInfoRequests = [] } = useQuery<InformationRequest[]>({ queryKey: ["/api/admin/information-requests"] });

  const getEventSlug    = (id: string) => events.find((e) => e.id === id)?.slug ?? "—";
  const getSponsorName  = (id: string) => sponsors.find((s) => s.id === id)?.name ?? "—";
  const getAttendee     = (id: string | undefined) => attendees.find((a) => a.id === id);
  const getAttendeeName = (id: string | undefined) => getAttendee(id)?.name ?? "—";
  const getAttendeeCompany = (id: string | undefined) => getAttendee(id)?.company ?? "—";

  // ── Summary stat cards ─────────────────────────────────────────────────────

  const filteredMeetings = useMemo(() => {
    if (!globalEventId) return meetings;
    return meetings.filter(m => m.eventId === globalEventId);
  }, [meetings, globalEventId]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0, Pending: 0, Confirmed: 0 };
    filteredMeetings.forEach((m) => { if (m.status in c) c[m.status]++; });
    return c;
  }, [filteredMeetings]);

  // ── KPI metrics ────────────────────────────────────────────────────────────

  const kpiMetrics = useMemo(() => {
    const uniqueAttendeeIds = new Set(filteredMeetings.map((m) => m.attendeeId).filter(Boolean));
    const uniqueCompanies = new Set<string>();
    filteredMeetings.forEach((m) => {
      const company = getAttendee(m.attendeeId)?.company;
      if (company) uniqueCompanies.add(company);
    });
    const sponsorsWithMeetings = new Set(filteredMeetings.map((m) => m.sponsorId)).size;
    const avgMeetings = sponsorsWithMeetings > 0 ? (filteredMeetings.length / sponsorsWithMeetings).toFixed(1) : "0";
    return {
      uniqueAttendees: uniqueAttendeeIds.size,
      uniqueCompanies: uniqueCompanies.size,
      avgMeetings,
    };
  }, [filteredMeetings, attendees]);

  // ── Pie chart data (Meeting Status Distribution) ────────────────────────

  const pieData = useMemo(() => {
    return Object.entries(statusCounts)
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({ name: status, value: count, fill: STATUS_COLORS[status] ?? "#94a3b8" }));
  }, [statusCounts]);

  // ── Engagement Funnel data ────────────────────────────────────────────────

  const funnelData = useMemo(() => {
    const totalSponsors = sponsors.length;
    const sponsorsWithMeetings = new Set(filteredMeetings.map((m) => m.sponsorId)).size;
    const totalMeetings = filteredMeetings.length;
    const completedMeetings = statusCounts.Completed ?? 0;
    return [
      { stage: "Total Sponsors", value: totalSponsors, fill: "#6366f1" },
      { stage: "With Meetings", value: sponsorsWithMeetings, fill: "#3b82f6" },
      { stage: "Meetings Held", value: totalMeetings, fill: "#06b6d4" },
      { stage: "Completed", value: completedMeetings, fill: "#22c55e" },
    ];
  }, [sponsors, filteredMeetings, statusCounts]);

  // ── Meetings by Event bar ──────────────────────────────────────────────────

  const perEvent = useMemo(() => {
    const counts: Record<string, number> = {};
    meetings.forEach((m) => { counts[m.eventId] = (counts[m.eventId] ?? 0) + 1; });
    return events.map((e) => ({ event: e, count: counts[e.id] ?? 0 })).sort((a, b) => b.count - a.count);
  }, [meetings, events]);

  // ── Sponsor analytics ──────────────────────────────────────────────────────

  const sponsorAnalytics = useMemo(() => {
    type Row = {
      id: string; name: string; total: number;
      scheduled: number; completed: number; cancelled: number; noShow: number;
      companies: number; online: number; onsite: number; pending: number;
    };
    const map: Record<string, Row> = {};
    sponsors.forEach((s) => {
      map[s.id] = { id: s.id, name: s.name, total: 0, scheduled: 0, completed: 0, cancelled: 0, noShow: 0, companies: 0, online: 0, onsite: 0, pending: 0 };
    });
    const companyTracker: Record<string, Set<string>> = {};
    filteredMeetings.forEach((m) => {
      if (!map[m.sponsorId]) return;
      const row = map[m.sponsorId];
      row.total++;
      if (m.status === "Scheduled") row.scheduled++;
      if (m.status === "Completed")  row.completed++;
      if (m.status === "Cancelled")  row.cancelled++;
      if (m.status === "NoShow")     row.noShow++;
      if (m.status === "Pending")    row.pending++;
      if (m.meetingType === "online_request") row.online++;
      else                                    row.onsite++;
      if (!companyTracker[m.sponsorId]) companyTracker[m.sponsorId] = new Set();
      const company = getAttendee(m.attendeeId)?.company;
      if (company) companyTracker[m.sponsorId].add(company);
    });
    Object.keys(companyTracker).forEach((sid) => { if (map[sid]) map[sid].companies = companyTracker[sid].size; });
    return Object.values(map);
  }, [filteredMeetings, sponsors, attendees]);

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => d === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("desc"); }
  }

  const sortedAnalytics = useMemo(() =>
    [...sponsorAnalytics].sort((a, b) => {
      const av = a[sortKey] as any, bv = b[sortKey] as any;
      const cmp = typeof av === "string" ? av.localeCompare(bv) : av - bv;
      return sortDir === "asc" ? cmp : -cmp;
    }),
  [sponsorAnalytics, sortKey, sortDir]);

  const chartData = useMemo(() =>
    [...sponsorAnalytics].filter((s) => s.total > 0).sort((a, b) => b.total - a.total)
      .map((s) => ({ name: s.name, Scheduled: s.scheduled, Completed: s.completed, Cancelled: s.cancelled, NoShow: s.noShow, Pending: s.pending })),
  [sponsorAnalytics]);

  // ── Report tab data ────────────────────────────────────────────────────────

  const reportMeetings = useMemo(() => {
    let ms = meetings;
    if (reportEventId)    ms = ms.filter((m) => m.eventId === reportEventId);
    if (reportSponsorId)  ms = ms.filter((m) => m.sponsorId === reportSponsorId);
    if (reportMeetingType) {
      ms = ms.filter((m) => {
        if (reportMeetingType === "onsite") return (m.meetingType ?? "onsite") !== "online_request";
        if (reportMeetingType === "online") return m.meetingType === "online_request";
        return true;
      });
    }
    return [...ms].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  }, [meetings, reportEventId, reportSponsorId, reportMeetingType]);

  // Grouped by sponsor
  const bySponsorsGroups = useMemo(() => {
    const groups: Record<string, Meeting[]> = {};
    reportMeetings.forEach((m) => {
      if (!groups[m.sponsorId]) groups[m.sponsorId] = [];
      groups[m.sponsorId].push(m);
    });
    return Object.entries(groups)
      .map(([sponsorId, ms]) => ({ sponsorId, name: getSponsorName(sponsorId), meetings: ms }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [reportMeetings]);

  // Grouped by attendee
  const byAttendeeGroups = useMemo(() => {
    const groups: Record<string, Meeting[]> = {};
    reportMeetings.forEach((m) => {
      const key = m.attendeeId || `manual-${m.id}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(m);
    });
    return Object.entries(groups)
      .map(([attendeeId, ms]) => ({ attendeeId, attendee: getAttendee(attendeeId), meetings: ms }))
      .sort((a, b) => (a.attendee?.name ?? "").localeCompare(b.attendee?.name ?? ""));
  }, [reportMeetings]);

  // ── CSV exports ────────────────────────────────────────────────────────────

  const HEADERS = [
    "Event Code", "Sponsor", "Attendee Name", "Company", "Title", "Email", "LinkedIn",
    "Date", "Time", "Location", "Meeting Type", "Status", "Source", "Platform",
  ];

  function meetingToRow(m: Meeting) {
    const at = getAttendee(m.attendeeId);
    const isOnline = m.meetingType === "online_request";
    return [
      getEventSlug(m.eventId),
      getSponsorName(m.sponsorId),
      at?.name ?? "—",
      at?.company ?? "—",
      at?.title ?? "—",
      at?.email ?? "—",
      at?.linkedinUrl ?? "",
      m.date,
      fmt12(m.time),
      m.location,
      isOnline ? "Online" : "Onsite",
      m.status,
      m.source === "public" ? "Public" : "Admin",
      isOnline ? ((m as any).platform ?? "") : "",
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
  }

  function exportCSV(rows: Meeting[], filename: string) {
    const csv = [HEADERS.map((h) => `"${h}"`).join(","), ...rows.map(meetingToRow)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportSponsorSummaryCSV() {
    const headers = ["Sponsor", "Total Meetings", "Scheduled", "Completed", "Cancelled", "No-Show", "Pending", "Onsite", "Online"];
    const rows = bySponsorsGroups.map(({ name, meetings: sms }) => {
      const scheduled  = sms.filter((m) => m.status === "Scheduled").length;
      const completed  = sms.filter((m) => m.status === "Completed").length;
      const cancelled  = sms.filter((m) => m.status === "Cancelled").length;
      const noShow     = sms.filter((m) => m.status === "NoShow").length;
      const pending    = sms.filter((m) => m.status === "Pending").length;
      const online     = sms.filter((m) => m.meetingType === "online_request").length;
      const onsite     = sms.length - online;
      return [name, sms.length, scheduled, completed, cancelled, noShow, pending, onsite, online]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sponsor-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportAttendeeSummaryCSV() {
    const headers = ["Attendee Name", "Company", "Title", "Email", "Total Meetings", "Events"];
    const rows = byAttendeeGroups.map(({ attendee, meetings: ams }) => {
      const uniqueEvents = Array.from(new Set(ams.map((m) => getEventSlug(m.eventId))));
      const eventList = uniqueEvents.join("; ");
      return [
        attendee?.name ?? "—",
        attendee?.company ?? "—",
        attendee?.title ?? "—",
        attendee?.email ?? "—",
        ams.length,
        eventList,
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.map((h) => `"${h}"`).join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendee-summary-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function downloadAdminPDF() {
    const eid = reportEventId || globalEventId;
    if (!eid || !reportSponsorId || pdfDownloading) return;
    setPdfDownloading(true);
    try {
      const res = await fetch(
        `/api/admin/reports/sponsor-pdf?eventId=${eid}&sponsorId=${reportSponsorId}`,
        { credentials: "include" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "PDF generation failed" }));
        alert(err.message ?? "PDF generation failed");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const sponsorName = sponsors.find((s) => s.id === reportSponsorId)?.name ?? "Sponsor";
      const eventSlug   = events.find((e) => e.id === eid)?.slug ?? "Event";
      a.href = url;
      a.download = `${sponsorName.replace(/\s+/g, "_")}_${eventSlug}_Report.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfDownloading(false);
    }
  }

  // ── Meeting log filter ─────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return meetings
      .filter((m) => {
        const effectiveEventId = globalEventId || filterEvent;
        if (effectiveEventId && m.eventId !== effectiveEventId) return false;
        if (filterSponsorId && m.sponsorId !== filterSponsorId) return false;
        if (filterStatus && m.status !== filterStatus) return false;
        if (filterMeetingType) {
          if (filterMeetingType === "onsite" && m.meetingType === "online_request") return false;
          if (filterMeetingType === "online" && m.meetingType !== "online_request") return false;
        }
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
  }, [meetings, filterEvent, globalEventId, filterSponsorId, filterStatus, filterMeetingType, search]);

  const selectClass = "flex h-9 rounded-lg border border-input bg-card px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  const tabLabels: { key: ReportTab; label: string }[] = [
    { key: "all",         label: "All Meetings"  },
    { key: "by-sponsor",  label: "By Sponsor"    },
    { key: "by-attendee", label: "By Attendee"   },
  ];

  const EmptyReport = () => (
    <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
      <Handshake className="h-8 w-8 opacity-20" />
      <p className="text-sm">No meetings yet.</p>
    </div>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-8 max-w-7xl mx-auto"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Reports</h1>
          <p className="text-muted-foreground mt-1 text-sm">Meeting analytics and exports across all events.</p>
        </div>
        <div className="flex flex-col gap-1.5 min-w-[200px]">
          <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1">Global Event Filter</label>
          <select
            className={selectClass}
            value={globalEventId}
            onChange={(e) => setGlobalEventId(e.target.value)}
            data-testid="select-global-event"
          >
            <option value="">All Events</option>
            {events.map((e) => <option key={e.id} value={e.id}>{e.slug} — {e.name}</option>)}
          </select>
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 p-1 bg-muted/60 rounded-xl border border-border/40 w-fit">
        {[
          { key: "overview",       label: "Event Overview" },
          { key: "sponsor-perf",   label: "Sponsor Performance" },
          { key: "meeting-data",   label: "Meeting Data" },
          { key: "info-requests",  label: "Information Requests" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key as any)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all",
              mainTab === t.key
                ? "bg-card shadow-sm text-foreground border border-border/60"
                : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`main-tab-${t.key}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === "overview" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {/* Top stats — row 1: volume & status */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Meetings"       value={filteredMeetings.length}                         icon={Handshake}    color="bg-card border-border/60" />
            <KpiCard label="Scheduled"             value={statusCounts.Scheduled}                         icon={Clock}        color="bg-blue-50 border-blue-200 text-blue-800" />
            <KpiCard label="Completed"             value={statusCounts.Completed}                         icon={CheckCircle2} color="bg-green-50 border-green-200 text-green-800" />
            <KpiCard label="Cancelled / No-Show"   value={statusCounts.Cancelled + statusCounts.NoShow}   icon={XCircle}      color="bg-red-50 border-red-200 text-red-800" />
          </div>

          {/* Top stats — row 2: ROI KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <KpiCard
              label="Unique Attendees"
              value={kpiMetrics.uniqueAttendees}
              icon={User}
              color="bg-indigo-50 border-indigo-200 text-indigo-800"
              sub="distinct individuals across all meetings"
            />
            <KpiCard
              label="Unique Companies"
              value={kpiMetrics.uniqueCompanies}
              icon={Building2}
              color="bg-teal-50 border-teal-200 text-teal-800"
              sub="distinct organizations represented"
            />
            <KpiCard
              label="Avg Meetings / Sponsor"
              value={kpiMetrics.avgMeetings}
              icon={TrendingUp}
              color="bg-amber-50 border-amber-200 text-amber-800"
              sub="among sponsors with at least one meeting"
            />
          </div>

          {/* Meetings by Event */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" /> Meetings by Event
            </h2>
            {perEvent.every((x) => x.count === 0) ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No data yet.</p>
            ) : (
              <div className="space-y-3">
                {perEvent.map(({ event, count }) => {
                  const max = Math.max(...perEvent.map((x) => x.count), 1);
                  return (
                    <div key={event.id} data-testid={`bar-event-${event.id}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div>
                          <span className="text-xs font-mono font-bold text-foreground">{event.slug}</span>
                          <span className="text-xs text-muted-foreground ml-2 hidden sm:inline">{event.name.slice(0, 40)}{event.name.length > 40 ? "…" : ""}</span>
                        </div>
                        <span className="text-xs font-semibold text-foreground">{count}</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-accent rounded-full transition-all duration-500" style={{ width: count === 0 ? "0%" : `${(count / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Meeting Status Distribution — Pie chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6" data-testid="meeting-status-pie">
              <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-accent" /> Meeting Status Distribution
              </h2>
              {pieData.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">No meeting data yet.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number, name: string) => [value, name]} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Engagement Funnel — horizontal bar chart */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6" data-testid="engagement-funnel-chart">
              <h2 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" /> Engagement Funnel
              </h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={funnelData} layout="vertical" margin={{ top: 4, right: 32, left: 8, bottom: 4 }} barCategoryGap="30%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="stage" width={110} tick={{ fontSize: 11, fill: "hsl(var(--foreground))" }} tickLine={false} axisLine={false} />
                  <Tooltip formatter={(value: number) => [value]} />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {funnelData.map((entry, index) => (
                      <Cell key={`funnel-cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {mainTab === "sponsor-perf" && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-semibold text-foreground">Sponsor Performance</h2>
            <p className="text-sm text-muted-foreground">Compare sponsor engagement and meeting outcomes.</p>
          </div>

          {/* Stacked bar chart */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6" data-testid="sponsor-analytics-chart">
            <h3 className="text-sm font-semibold text-foreground mb-5 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-accent" /> Total Meetings by Sponsor
            </h3>
            {chartData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                <BarChart3 className="h-8 w-8 opacity-20" />
                <p className="text-sm">No meeting data yet.</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 56 + 60)}>
                <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 24, left: 8, bottom: 4 }} barCategoryGap="28%">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 12, fill: "hsl(var(--foreground))", fontWeight: 500 }} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "hsl(var(--muted))", opacity: 0.5 }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 16 }} formatter={(v) => <span style={{ color: "hsl(var(--foreground))", fontWeight: 500 }}>{v}</span>} />
                  <Bar dataKey="Scheduled" stackId="a" fill={STATUS_COLORS.Scheduled} />
                  <Bar dataKey="Completed"  stackId="a" fill={STATUS_COLORS.Completed}  />
                  <Bar dataKey="Cancelled"  stackId="a" fill={STATUS_COLORS.Cancelled}  />
                  <Bar dataKey="NoShow"     stackId="a" fill={STATUS_COLORS.NoShow}     />
                  <Bar dataKey="Pending"    stackId="a" fill={STATUS_COLORS.Pending}    radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Analytics table */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid="sponsor-analytics-table">
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-accent" />
              <h3 className="text-sm font-semibold text-foreground">Sponsor Breakdown</h3>
              <span className="ml-auto text-xs text-muted-foreground">Click headers to sort</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    <SortHeader label="Sponsor"          sortKey="name"      current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Total"            sortKey="total"     current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Scheduled"        sortKey="scheduled" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Completed"        sortKey="completed" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Cancelled"        sortKey="cancelled" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="No-Show"          sortKey="noShow"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Unique Companies" sortKey="companies" current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Onsite"           sortKey="onsite"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <SortHeader label="Online"           sortKey="online"    current={sortKey} dir={sortDir} onSort={handleSort} />
                    <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">Completion Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAnalytics.map((row, i) => {
                    const done = row.completed + row.cancelled + row.noShow;
                    const rate = done > 0 ? Math.round((row.completed / done) * 100) : null;
                    return (
                      <tr key={row.id} className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10", row.total === 0 && "opacity-50")} data-testid={`analytics-row-${row.id}`}>
                        <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{row.name}</td>
                        <td className="px-4 py-3"><span className={cn("text-sm font-bold", row.total > 0 ? "text-foreground" : "text-muted-foreground")}>{row.total}</span></td>
                        <td className="px-4 py-3">{row.scheduled > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-blue-100 text-blue-700 border-blue-200">{row.scheduled}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.completed > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-green-100 text-green-700 border-green-200">{row.completed}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.cancelled > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-red-100 text-red-700 border-red-200">{row.cancelled}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.noShow > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-yellow-100 text-yellow-700 border-yellow-200">{row.noShow}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.companies > 0 ? <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Users className="h-3.5 w-3.5 text-accent" />{row.companies}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.onsite > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200">{row.onsite}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">{row.online > 0 ? <span className="text-xs font-semibold px-2 py-0.5 rounded-full border bg-violet-100 text-violet-700 border-violet-200">{row.online}</span> : <span className="text-muted-foreground text-sm">—</span>}</td>
                        <td className="px-4 py-3">
                          {rate !== null ? (
                            <div className="flex items-center gap-2 min-w-[100px]">
                              <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div className="h-full bg-green-500 rounded-full transition-all duration-500" style={{ width: `${rate}%` }} />
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

          {/* Sponsor PDF Report */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
            <div className="flex items-center gap-2 mb-2">
              <FileDown className="h-5 w-5 text-accent" />
              <h2 className="text-lg font-display font-semibold text-foreground">Sponsor PDF Generator</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-5">Generate a detailed sponsorship performance report for a selected sponsor and event.</p>
            <div className="flex flex-wrap gap-3 items-end">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</label>
                <select
                  className={selectClass}
                  value={reportEventId || globalEventId}
                  onChange={(e) => setReportEventId(e.target.value)}
                  data-testid="select-pdf-event"
                >
                  <option value="">— select event —</option>
                  {events.map((e) => <option key={e.id} value={e.id}>{e.slug} — {e.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sponsor</label>
                <select
                  className={selectClass}
                  value={reportSponsorId}
                  onChange={(e) => setReportSponsorId(e.target.value)}
                  data-testid="select-pdf-sponsor"
                >
                  <option value="">— select sponsor —</option>
                  {sponsors
                    .filter((s) => {
                      const eid = reportEventId || globalEventId;
                      return !eid || (s.assignedEvents ?? []).some((ae) => ae.eventId === eid);
                    })
                    .map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <button
                onClick={downloadAdminPDF}
                disabled={!(reportEventId || globalEventId) || !reportSponsorId || pdfDownloading}
                data-testid="btn-download-sponsor-pdf"
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors",
                  (reportEventId || globalEventId) && reportSponsorId && !pdfDownloading
                    ? "bg-accent text-accent-foreground border-accent hover:bg-accent/90 shadow-sm"
                    : "bg-muted text-muted-foreground border-muted cursor-not-allowed opacity-50"
                )}
              >
                <FileDown className="h-4 w-4" />
                {pdfDownloading ? "Generating…" : "Download Sponsorship Performance Report"}
              </button>
            </div>
            {(reportEventId || globalEventId) && reportSponsorId && (
              <p className="text-xs text-muted-foreground mt-3">
                Generating report for <strong>{sponsors.find((s) => s.id === reportSponsorId)?.name}</strong> at <strong>{events.find((e) => e.id === (reportEventId || globalEventId))?.name}</strong>.
              </p>
            )}
          </div>
        </div>
      )}

      {mainTab === "meeting-data" && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
          <div className="space-y-1">
            <h2 className="text-xl font-display font-semibold text-foreground">Meeting Data</h2>
            <p className="text-sm text-muted-foreground">Review and export detailed individual meeting records.</p>
          </div>

          {/* Combined Controls Row */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              {/* Sub-Tabs (Existing Event Reports Tabs) */}
              <div className="flex gap-1 p-1 bg-muted/60 rounded-xl border border-border/40">
                {tabLabels.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setTab(key)}
                    data-testid={`tab-${key}`}
                    className={cn(
                      "px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                      tab === key
                        ? "bg-card shadow-sm text-foreground border border-border/60"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Exports */}
              <div className="flex items-center gap-2">
                {tab === "by-sponsor" && (
                  <button
                    onClick={exportSponsorSummaryCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm whitespace-nowrap"
                    data-testid="btn-export-sponsor-summary"
                  >
                    <Download className="h-4 w-4" /> Export Sponsor Summary
                  </button>
                )}
                {tab === "by-attendee" && (
                  <button
                    onClick={exportAttendeeSummaryCSV}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm whitespace-nowrap"
                    data-testid="btn-export-attendee-summary"
                  >
                    <Download className="h-4 w-4" /> Export Attendee Summary
                  </button>
                )}
                <button
                  onClick={() => {
                    const filename = tab === "all" ? "all-meetings" : tab === "by-sponsor" ? "meetings-by-sponsor" : "meetings-by-attendee";
                    exportCSV(filtered, filename);
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium text-foreground hover:bg-muted transition-colors shadow-sm whitespace-nowrap"
                  data-testid="btn-export-report"
                >
                  <Download className="h-4 w-4" /> Export Meeting Data CSV
                </button>
              </div>
            </div>

            {/* Filter Row */}
            <div className="flex flex-wrap gap-2 items-center">
              <select
                className={selectClass}
                value={filterEvent || globalEventId}
                onChange={(e) => setFilterEvent(e.target.value)}
                data-testid="select-report-event"
              >
                <option value="">All Events</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.slug} — {e.name}</option>)}
              </select>
              <select
                className={selectClass}
                value={filterSponsorId}
                onChange={(e) => setFilterSponsorId(e.target.value)}
                data-testid="select-report-sponsor"
              >
                <option value="">All Sponsors</option>
                {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select
                className={selectClass}
                value={filterMeetingType}
                onChange={(e) => setFilterMeetingType(e.target.value)}
                data-testid="select-report-meeting-type"
              >
                <option value="">All Types</option>
                <option value="onsite">Onsite</option>
                <option value="online">Online</option>
              </select>
              <select
                className={selectClass}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                data-testid="select-report-status"
              >
                <option value="">All Statuses</option>
                {ALL_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-9 h-9 w-[200px]"
                  placeholder="Search meetings..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              {(filterEvent || filterSponsorId || filterMeetingType || filterStatus || search) && (
                <button
                  onClick={() => { setFilterEvent(""); setFilterSponsorId(""); setFilterMeetingType(""); setFilterStatus(""); setSearch(""); }}
                  className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-lg border border-border/60 hover:bg-muted transition-colors"
                  data-testid="btn-report-clear-filters"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Unified Table View */}
          <div className="space-y-4">
            {tab === "all" && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid="report-all-meetings">
                <div className="px-5 py-3 border-b border-border/50 bg-muted/20 text-xs text-muted-foreground">
                  <strong className="text-foreground">{filtered.length}</strong> meeting{filtered.length !== 1 ? "s" : ""}
                </div>
                {filtered.length === 0 ? <EmptyReport /> : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      {REPORT_THEAD}
                      <tbody>
                        {filtered.map((m, i) => (
                          <MeetingRow key={m.id} m={m} eventSlug={getEventSlug(m.eventId)} sponsorName={getSponsorName(m.sponsorId)} attendee={getAttendee(m.attendeeId)} striped={i % 2 === 1} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === "by-sponsor" && (
              <div className="space-y-4" data-testid="report-by-sponsor">
                {bySponsorsGroups.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm"><EmptyReport /></div>
                ) : bySponsorsGroups.map(({ sponsorId, name, meetings: sms }) => {
                  const filteredSms = sms.filter(m => filtered.some(fm => fm.id === m.id));
                  if (filteredSms.length === 0) return null;
                  return (
                    <div key={sponsorId} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid={`sponsor-group-${sponsorId}`}>
                      <div className="px-6 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-accent shrink-0" />
                        <span className="font-semibold text-sm text-foreground">{name}</span>
                        <span className="text-xs text-muted-foreground ml-1">{filteredSms.length} meeting{filteredSms.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          {REPORT_THEAD}
                          <tbody>
                            {filteredSms.map((m, i) => (
                              <MeetingRow key={m.id} m={m} eventSlug={getEventSlug(m.eventId)} sponsorName={name} attendee={getAttendee(m.attendeeId)} striped={i % 2 === 1} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {tab === "by-attendee" && (
              <div className="space-y-4" data-testid="report-by-attendee">
                {byAttendeeGroups.length === 0 ? (
                  <div className="bg-card rounded-2xl border border-border/60 shadow-sm"><EmptyReport /></div>
                ) : byAttendeeGroups.map(({ attendeeId, attendee: at, meetings: ams }) => {
                  const filteredAms = ams.filter(m => filtered.some(fm => fm.id === m.id));
                  if (filteredAms.length === 0) return null;
                  return (
                    <div key={attendeeId} className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden" data-testid={`attendee-group-${attendeeId}`}>
                      <div className="px-6 py-3 border-b border-border/50 bg-muted/20 flex items-center gap-3 flex-wrap">
                        <User className="h-4 w-4 text-accent shrink-0" />
                        <span className="font-semibold text-sm text-foreground">{at?.name ?? "Unknown"}</span>
                        {at?.company && <span className="text-xs text-muted-foreground">· {at.company}</span>}
                        {at?.email && <span className="text-xs text-muted-foreground font-mono">{at.email}</span>}
                        {at?.linkedinUrl && (
                          <a href={at.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-[#0077B5] hover:opacity-80 flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> LinkedIn
                          </a>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">{filteredAms.length} meeting{filteredAms.length !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          {REPORT_THEAD}
                          <tbody>
                            {filteredAms.map((m, i) => (
                              <MeetingRow key={m.id} m={m} eventSlug={getEventSlug(m.eventId)} sponsorName={getSponsorName(m.sponsorId)} attendee={at} striped={i % 2 === 1} />
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ── Info Requests Tab ───────────────────────────────────────────── */}
      {mainTab === "info-requests" && (() => {
        const irStatusColors: Record<string, string> = {
          New: "bg-blue-100 text-blue-700 border-blue-200",
          Open: "bg-blue-100 text-blue-700 border-blue-200",
          Contacted: "bg-amber-100 text-amber-700 border-amber-200",
          "Email Sent": "bg-amber-100 text-amber-700 border-amber-200",
          "Meeting Scheduled": "bg-teal-100 text-teal-700 border-teal-200",
          "Not Qualified": "bg-orange-100 text-orange-700 border-orange-200",
          Closed: "bg-gray-100 text-gray-600 border-gray-200",
        };

        const filteredIR = allInfoRequests.filter((r) => {
          if (irEventId && r.eventId !== irEventId) return false;
          if (irSponsorId && r.sponsorId !== irSponsorId) return false;
          if (irStatus && r.status !== irStatus) return false;
          if (irSource && r.source !== irSource) return false;
          if (irSearch) {
            const q = irSearch.toLowerCase();
            const name = `${r.attendeeFirstName} ${r.attendeeLastName}`.toLowerCase();
            if (!name.includes(q) && !r.attendeeEmail.toLowerCase().includes(q) && !r.attendeeCompany.toLowerCase().includes(q)) return false;
          }
          return true;
        });

        const irSources = Array.from(new Set(allInfoRequests.map((r) => r.source).filter(Boolean)));

        const irSummary = INFORMATION_REQUEST_STATUSES.reduce((acc, s) => {
          acc[s] = filteredIR.filter((r) => r.status === s).length;
          return acc;
        }, {} as Record<string, number>);

        function exportIRCSV() {
          const headers = ["Event", "Sponsor", "First Name", "Last Name", "Company", "Email", "Title", "Source", "Status", "Submitted", "Last Updated", "Message"];
          const rows = filteredIR.map((r) => [
            events.find((e) => e.id === r.eventId)?.slug ?? "",
            sponsors.find((s) => s.id === r.sponsorId)?.name ?? "",
            r.attendeeFirstName, r.attendeeLastName, r.attendeeCompany, r.attendeeEmail, r.attendeeTitle,
            r.source, r.status,
            new Date(r.createdAt).toLocaleDateString("en-US"),
            new Date(r.updatedAt).toLocaleDateString("en-US"),
            (r.message ?? "").replace(/\n/g, " "),
          ]);
          const csv = [headers, ...rows].map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
          const blob = new Blob([csv], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a"); a.href = url; a.download = "information_requests.csv"; a.click();
          URL.revokeObjectURL(url);
        }

        const selectClass = "h-8 text-sm rounded-lg border border-border/60 bg-background px-3 focus:outline-none focus:ring-1 focus:ring-accent/40";

        return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-4 col-span-2 sm:col-span-1">
                <p className="text-2xl font-display font-bold text-foreground">{filteredIR.length}</p>
                <p className="text-xs font-medium text-muted-foreground mt-1">Total</p>
              </div>
              {(["New", "Open", "Email Sent", "Meeting Scheduled", "Closed", "Not Qualified"] as const).map((s) => (
                <div key={s} className={cn("rounded-xl border p-4", irStatusColors[s] ?? "bg-card border-border/60")}>
                  <p className="text-2xl font-display font-bold leading-none">{irSummary[s] ?? 0}</p>
                  <p className="text-xs font-medium mt-1 opacity-80">{s}</p>
                </div>
              ))}
            </div>

            {/* Filters + Export */}
            <div className="flex flex-wrap gap-3 items-center">
              <select className={selectClass} value={irEventId} onChange={(e) => setIrEventId(e.target.value)} data-testid="ir-filter-event">
                <option value="">All Events</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.slug}</option>)}
              </select>
              <select className={selectClass} value={irSponsorId} onChange={(e) => setIrSponsorId(e.target.value)} data-testid="ir-filter-sponsor">
                <option value="">All Sponsors</option>
                {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select className={selectClass} value={irStatus} onChange={(e) => setIrStatus(e.target.value)} data-testid="ir-filter-status">
                <option value="">All Statuses</option>
                {INFORMATION_REQUEST_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select className={selectClass} value={irSource} onChange={(e) => setIrSource(e.target.value)} data-testid="ir-filter-source">
                <option value="">All Sources</option>
                {irSources.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search name, company, email…"
                  value={irSearch}
                  onChange={(e) => setIrSearch(e.target.value)}
                  className="pl-8 h-8 text-sm"
                  data-testid="ir-search"
                />
              </div>
              <button
                onClick={exportIRCSV}
                className="flex items-center gap-2 h-8 px-3 rounded-lg border border-border/60 bg-card text-sm font-medium hover:bg-muted/50 transition-colors"
                data-testid="button-export-ir-csv"
              >
                <FileDown className="h-3.5 w-3.5" /> Export CSV
              </button>
            </div>

            {/* Table */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-border/50 flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-accent" />
                <span className="text-sm font-semibold text-foreground">
                  {filteredIR.length} information request{filteredIR.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      {["Event", "Sponsor", "Name", "Company", "Email", "Source", "Status", "Submitted", "Updated", "Message"].map((h) => (
                        <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredIR.length === 0 ? (
                      <tr><td colSpan={10} className="text-center py-12 text-muted-foreground italic text-sm">No information requests match the current filters.</td></tr>
                    ) : (
                      filteredIR.map((r, i) => (
                        <tr key={r.id} className={cn("border-b border-border/30 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")} data-testid={`ir-row-${r.id}`}>
                          <td className="px-4 py-3">
                            <span className="font-mono text-xs font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">
                              {events.find((e) => e.id === r.eventId)?.slug ?? "—"}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground whitespace-nowrap">
                            {sponsors.find((s) => s.id === r.sponsorId)?.name ?? "—"}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">{r.attendeeFirstName} {r.attendeeLastName}</td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{r.attendeeCompany}</td>
                          <td className="px-4 py-3 text-muted-foreground text-xs font-mono whitespace-nowrap">{r.attendeeEmail}</td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">{r.source}</span>
                          </td>
                          <td className="px-4 py-3">
                            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", irStatusColors[r.status] ?? "bg-muted text-muted-foreground border-border")}>
                              {r.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                            {new Date(r.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          </td>
                          <td className="px-4 py-3 max-w-[200px]">
                            {r.message ? (
                              <span className="text-xs text-muted-foreground truncate block" title={r.message}>
                                {r.message.slice(0, 60)}{r.message.length > 60 ? "…" : ""}
                              </span>
                            ) : <span className="text-xs text-muted-foreground/50">—</span>}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}
    </motion.div>
  );
}
