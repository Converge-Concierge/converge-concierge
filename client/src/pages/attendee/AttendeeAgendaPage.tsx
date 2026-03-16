import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, Clock, Bookmark, Users, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import SessionDetailSheet, { type AgendaSessionDetail } from "@/components/attendee/SessionDetailSheet";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AgendaSession extends AgendaSessionDetail {
  sessionTypeKey: string;
  sessionTypeLabel: string;
  speakerLabelPlural: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  timezone: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatDateShort(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTimeRange(s: string, e: string) {
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return `${fmt(s)} – ${fmt(e)}`;
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({ session, saved, onSave, onUnsave, onView, isSaving }: {
  session: AgendaSession; saved: boolean;
  onSave: () => void; onUnsave: () => void; onView: () => void;
  isSaving: boolean;
}) {
  const location = [session.locationName, session.locationDetails].filter(Boolean).join(" — ");
  const hasSpeakers = (session.speakers ?? []).length > 0;

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 hover:border-border transition-colors" data-testid={`card-session-${session.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs rounded-full shrink-0">{session.sessionTypeLabel}</Badge>
            {session.isFeatured && <Badge className="text-xs rounded-full bg-amber-500/10 text-amber-700 border-amber-200 dark:text-amber-400">Featured</Badge>}
          </div>
          <button className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors w-full" onClick={onView} data-testid={`button-view-session-${session.id}`}>
            {session.title}
          </button>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {formatTimeRange(session.startTime, session.endTime)}
            </span>
            {location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3" /> {location}
              </span>
            )}
            {session.sponsorName && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" /> {session.sponsorName}
              </span>
            )}
          </div>
          {hasSpeakers && (
            <p className="text-xs text-muted-foreground/80 mt-1.5">
              {session.speakerLabelPlural}: {session.speakers!.slice(0, 3).map((sp) => sp.name).join(", ")}
              {session.speakers!.length > 3 && ` +${session.speakers!.length - 3} more`}
            </p>
          )}
        </div>
        <Button
          variant={saved ? "secondary" : "outline"}
          size="sm"
          className="h-8 shrink-0 gap-1.5 text-xs"
          disabled={isSaving}
          data-testid={`button-save-agenda-${session.id}`}
          onClick={saved ? onUnsave : onSave}
        >
          <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
          {saved ? "Saved" : "Save"}
        </Button>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeAgendaPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const [detailSession, setDetailSession] = useState<AgendaSession | null>(null);
  const [filterDay, setFilterDay] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");

  const agendaQuery = useQuery<AgendaSession[]>({
    queryKey: ["/api/attendee-portal/agenda"],
    queryFn: () => fetch("/api/attendee-portal/agenda", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const savedQuery = useQuery<{ savedId: string; id: string }[]>({
    queryKey: ["/api/attendee-portal/saved-sessions"],
    queryFn: () => fetch("/api/attendee-portal/saved-sessions", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const saveSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch("/api/attendee-portal/saved-sessions", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ sessionId }) }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/saved-sessions"] }),
  });

  const unsaveSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch(`/api/attendee-portal/saved-sessions/${sessionId}`, { method: "DELETE", headers }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/saved-sessions"] }),
  });

  const savedSessionIds = useMemo(() => new Set((savedQuery.data ?? []).map((s) => s.id)), [savedQuery.data]);

  // Build filter options
  const sessions = agendaQuery.data ?? [];
  const days = useMemo(() => [...new Set(sessions.map((s) => s.sessionDate))].sort(), [sessions]);
  const types = useMemo(() => [...new Set(sessions.map((s) => s.sessionTypeKey))].map((key) => {
    const s = sessions.find((ss) => ss.sessionTypeKey === key);
    return { key, label: s?.sessionTypeLabel ?? key };
  }), [sessions]);

  // Apply filters + group by day
  const filtered = useMemo(() => {
    return sessions.filter((s) => {
      if (filterDay !== "all" && s.sessionDate !== filterDay) return false;
      if (filterType !== "all" && s.sessionTypeKey !== filterType) return false;
      return true;
    });
  }, [sessions, filterDay, filterType]);

  const grouped = useMemo(() => {
    const map = new Map<string, AgendaSession[]>();
    for (const s of filtered) {
      if (!map.has(s.sessionDate)) map.set(s.sessionDate, []);
      map.get(s.sessionDate)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const isSaving = saveSessionMutation.isPending || unsaveSessionMutation.isPending;

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarDays className="h-6 w-6 text-primary" /> Agenda
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
        </div>

        {/* Filters */}
        {sessions.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-6">
            {/* Day filter */}
            <div className="relative">
              <select
                value={filterDay}
                onChange={(e) => setFilterDay(e.target.value)}
                className="appearance-none bg-card border border-border/60 rounded-lg px-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                data-testid="select-filter-day"
              >
                <option value="all">All Days</option>
                {days.map((d) => <option key={d} value={d}>{formatDateShort(d)}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            </div>
            {/* Type filter */}
            {types.length > 1 && (
              <div className="relative">
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className="appearance-none bg-card border border-border/60 rounded-lg px-3 pr-8 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  data-testid="select-filter-type"
                >
                  <option value="all">All Types</option>
                  {types.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {agendaQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Empty state */}
        {!agendaQuery.isLoading && sessions.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <CalendarDays className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">The agenda will appear here once sessions are published.</p>
          </div>
        )}

        {/* No results after filter */}
        {!agendaQuery.isLoading && sessions.length > 0 && filtered.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground">No sessions match the selected filters.</p>
            <Button variant="ghost" size="sm" className="mt-3" onClick={() => { setFilterDay("all"); setFilterType("all"); }}>Clear filters</Button>
          </div>
        )}

        {/* Grouped sessions */}
        <div className="space-y-8">
          {grouped.map(([date, daySessions]) => (
            <div key={date}>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid={`heading-day-${date}`}>
                {formatDate(date)}
              </h2>
              <div className="space-y-3">
                {daySessions.map((session) => (
                  <SessionCard
                    key={session.id}
                    session={session}
                    saved={savedSessionIds.has(session.id)}
                    onSave={() => saveSessionMutation.mutate(session.id)}
                    onUnsave={() => unsaveSessionMutation.mutate(session.id)}
                    onView={() => setDetailSession(session)}
                    isSaving={isSaving}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Session detail sheet */}
      {detailSession && (
        <SessionDetailSheet
          session={detailSession}
          isSaved={savedSessionIds.has(detailSession.id)}
          onClose={() => setDetailSession(null)}
          onSave={() => saveSessionMutation.mutate(detailSession.id)}
          onUnsave={() => unsaveSessionMutation.mutate(detailSession.id)}
          isSaving={isSaving}
        />
      )}
    </AttendeeShell>
  );
}
