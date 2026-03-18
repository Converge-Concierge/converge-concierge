import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Bookmark, CalendarDays, Clock, MapPin, Download, Trash2,
  Building2, Calendar, ListChecks,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import SessionDetailSheet, { type AgendaSessionDetail } from "@/components/attendee/SessionDetailSheet";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SavedSession extends AgendaSessionDetail {
  savedId: string;
  savedAt: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  sessionTypeLabel: string;
  speakerLabelPlural: string;
}

interface AttendeeMeeting {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl: string | null;
  date: string;
  time: string;
  location: string;
  meetingType: string;
  status: string;
  source: string;
  notes: string | null;
  meetingLink: string | null;
}

// Combined item for planning view
type PlanItem =
  | { kind: "session"; date: string; sortTime: string; data: SavedSession }
  | { kind: "meeting"; date: string; sortTime: string; data: AttendeeMeeting };

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTimeRange(s: string, e: string) {
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return `${fmt(s)} – ${fmt(e)}`;
}
function formatSingleTime(t: string) {
  if (!t || t === "00:00") return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// Detect overlap between a session and confirmed meetings (simple start-time check)
function hasOverlap(session: SavedSession, meetings: AttendeeMeeting[]): boolean {
  if (!session.sessionDate || !session.startTime) return false;
  return meetings.some((m) => {
    if (m.date !== session.sessionDate) return false;
    const mT = m.time.slice(0, 5);
    const sS = session.startTime.slice(0, 5);
    const sE = session.endTime.slice(0, 5);
    return mT >= sS && mT < sE;
  });
}

// ── My Agenda Tab ─────────────────────────────────────────────────────────────

function MyAgendaTab({
  sessions, savedQuery, unsaveSession, isRemoving, onViewSession, onAddToCalendar, onDownloadAll,
}: {
  sessions: SavedSession[];
  savedQuery: { isLoading: boolean };
  unsaveSession: (id: string) => void;
  isRemoving: boolean;
  onViewSession: (s: SavedSession) => void;
  onAddToCalendar: (id: string) => void;
  onDownloadAll: () => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<string, SavedSession[]>();
    for (const s of sessions) {
      if (!map.has(s.sessionDate)) map.set(s.sessionDate, []);
      map.get(s.sessionDate)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  if (savedQuery.isLoading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (sessions.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
        <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="font-medium text-foreground mb-2">No sessions saved yet</p>
        <p className="text-sm text-muted-foreground mb-6">Browse the agenda to build your personal schedule.</p>
        <Link href="/attendee/agenda"><Button data-testid="button-browse-agenda">Browse Agenda</Button></Link>
      </div>
    );
  }

  return (
    <>
      {sessions.length > 0 && (
        <div className="flex justify-end mb-4">
          <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={onDownloadAll} data-testid="button-download-all-ics">
            <Download className="h-4 w-4" /> Download All
          </Button>
        </div>
      )}
      <div className="space-y-8" data-testid="my-agenda-list">
        {grouped.map(([date, daySessions]) => (
          <div key={date}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid={`heading-myagenda-day-${date}`}>
              {formatDate(date)}
            </h2>
            <div className="space-y-3">
              {daySessions.map((session) => {
                const location = [session.locationName, session.locationDetails].filter(Boolean).join(" — ");
                return (
                  <div key={session.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-my-session-${session.id}`}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <Badge variant="outline" className="text-xs rounded-full mb-1.5">{session.sessionTypeLabel}</Badge>
                        <button className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors w-full" onClick={() => onViewSession(session)} data-testid={`button-view-my-session-${session.id}`}>
                          {session.title}
                        </button>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatTimeRange(session.startTime, session.endTime)}</span>
                          {location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{location}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => onAddToCalendar(session.id)} data-testid={`button-calendar-${session.id}`}>
                        <CalendarDays className="h-3 w-3" /> Add to Calendar
                      </Button>
                      <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isRemoving} onClick={() => unsaveSession(session.id)} data-testid={`button-remove-${session.id}`}>
                        <Trash2 className="h-3 w-3" /> Remove
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

// ── My Schedule Tab (combined view) ──────────────────────────────────────────

function MyScheduleTab({ sessions, meetings, isLoading }: { sessions: SavedSession[]; meetings: AttendeeMeeting[]; isLoading: boolean }) {
  const confirmedMeetings = meetings.filter((m) => m.status === "Confirmed");

  const items = useMemo<PlanItem[]>(() => {
    const list: PlanItem[] = [];
    for (const s of sessions) {
      if (s.sessionDate && s.startTime) {
        list.push({ kind: "session", date: s.sessionDate, sortTime: s.startTime, data: s });
      }
    }
    for (const m of confirmedMeetings) {
      if (m.date) list.push({ kind: "meeting", date: m.date, sortTime: m.time, data: m });
    }
    return list.sort((a, b) => a.date.localeCompare(b.date) || a.sortTime.localeCompare(b.sortTime));
  }, [sessions, meetings]);

  const grouped = useMemo(() => {
    const map = new Map<string, PlanItem[]>();
    for (const item of items) {
      if (!map.has(item.date)) map.set(item.date, []);
      map.get(item.date)!.push(item);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [items]);

  if (isLoading) return <div className="flex items-center justify-center py-16"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (items.length === 0) {
    return (
      <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
        <ListChecks className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
        <p className="font-medium text-foreground mb-2">Your schedule is empty</p>
        <p className="text-sm text-muted-foreground">Saved sessions and confirmed meetings will appear here together.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8" data-testid="my-schedule-list">
      {grouped.map(([date, dayItems]) => (
        <div key={date}>
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" data-testid={`heading-schedule-day-${date}`}>
            {formatDate(date)}
          </h2>
          <div className="space-y-2">
            {dayItems.map((item) => {
              if (item.kind === "session") {
                const s = item.data;
                const location = [s.locationName, s.locationDetails].filter(Boolean).join(" — ");
                const conflict = hasOverlap(s, confirmedMeetings);
                return (
                  <div key={`s-${s.id}`} className="bg-card border border-border/60 rounded-xl px-4 py-3 flex items-start gap-3" data-testid={`plan-session-${s.id}`}>
                    <div className="w-14 shrink-0 pt-0.5">
                      <p className="text-xs font-semibold text-primary tabular-nums">{formatSingleTime(s.startTime)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground leading-snug">{s.title}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        <span className="text-xs text-muted-foreground">{s.sessionTypeLabel}</span>
                        {location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{location}</span>}
                        {conflict && (
                          <span className="text-xs text-orange-600 font-medium flex items-center gap-1" title="This session overlaps with a confirmed meeting">
                            ⚠ Conflicts with meeting
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] rounded-full shrink-0">Session</Badge>
                  </div>
                );
              } else {
                const m = item.data;
                return (
                  <div key={`m-${m.id}`} className="bg-green-50 dark:bg-green-950/20 border border-green-200/60 rounded-xl px-4 py-3 flex items-start gap-3" data-testid={`plan-meeting-${m.id}`}>
                    <div className="w-14 shrink-0 pt-0.5">
                      <p className="text-xs font-semibold text-green-700 tabular-nums">{formatSingleTime(m.time)}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground leading-snug">Meeting – {m.sponsorName}</p>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {m.location && <span className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{m.location}</span>}
                      </div>
                    </div>
                    <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200 rounded-full shrink-0">Meeting</Badge>
                  </div>
                );
              }
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeMyAgendaPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<"agenda" | "schedule">("agenda");
  const [detailSession, setDetailSession] = useState<SavedSession | null>(null);

  const savedQuery = useQuery<SavedSession[]>({
    queryKey: ["/api/attendee-portal/saved-sessions"],
    queryFn: () => fetch("/api/attendee-portal/saved-sessions", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const meetingsQuery = useQuery<AttendeeMeeting[]>({
    queryKey: ["/api/attendee-portal/meetings"],
    queryFn: () => fetch("/api/attendee-portal/meetings", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const unsaveSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch(`/api/attendee-portal/saved-sessions/${sessionId}`, { method: "DELETE", headers }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/saved-sessions"] });
      if (detailSession) setDetailSession(null);
    },
  });

  function handleDownloadAll() {
    const t = localStorage.getItem("attendee_token");
    window.open(`/api/attendee-portal/my-agenda/ics?token=${t}`, "_blank");
  }

  function handleAddToCalendar(sessionId: string) {
    window.open(`/api/agenda-sessions/${sessionId}/ics`, "_blank");
  }

  const sessions = savedQuery.data ?? [];
  const meetings = meetingsQuery.data ?? [];
  const isRemoving = unsaveSessionMutation.isPending;

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName} accentColor={me?.event.buttonColor || me?.event.accentColor || null}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Bookmark className="h-6 w-6 text-primary" /> My Agenda
          </h1>
          {sessions.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{sessions.length} session{sessions.length !== 1 ? "s" : ""} saved</p>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit" data-testid="my-agenda-tabs">
          <button
            onClick={() => setActiveTab("agenda")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "agenda" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-my-agenda"
          >
            <span className="flex items-center gap-1.5"><Bookmark className="h-3.5 w-3.5" /> My Agenda</span>
          </button>
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === "schedule" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            data-testid="tab-my-schedule"
          >
            <span className="flex items-center gap-1.5"><ListChecks className="h-3.5 w-3.5" /> My Schedule</span>
          </button>
        </div>

        {/* Tab content */}
        {activeTab === "agenda" && (
          <MyAgendaTab
            sessions={sessions}
            savedQuery={{ isLoading: savedQuery.isLoading }}
            unsaveSession={(id) => unsaveSessionMutation.mutate(id)}
            isRemoving={isRemoving}
            onViewSession={setDetailSession}
            onAddToCalendar={handleAddToCalendar}
            onDownloadAll={handleDownloadAll}
          />
        )}

        {activeTab === "schedule" && (
          <MyScheduleTab
            sessions={sessions}
            meetings={meetings}
            isLoading={savedQuery.isLoading || meetingsQuery.isLoading}
          />
        )}
      </div>

      {/* Session detail sheet */}
      {detailSession && (
        <SessionDetailSheet
          session={detailSession}
          isSaved={true}
          onClose={() => setDetailSession(null)}
          onSave={() => {}}
          onUnsave={() => unsaveSessionMutation.mutate(detailSession.id)}
          isSaving={isRemoving}
        />
      )}
    </AttendeeShell>
  );
}
