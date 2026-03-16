import { useState, useMemo } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bookmark, CalendarDays, Clock, MapPin, Download, Trash2 } from "lucide-react";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTimeRange(s: string, e: string) {
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return `${fmt(s)} – ${fmt(e)}`;
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeMyAgendaPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const [detailSession, setDetailSession] = useState<SavedSession | null>(null);

  const savedQuery = useQuery<SavedSession[]>({
    queryKey: ["/api/attendee-portal/saved-sessions"],
    queryFn: () => fetch("/api/attendee-portal/saved-sessions", { headers }).then((r) => r.json()),
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
    const token = localStorage.getItem("attendee_token");
    window.open(`/api/attendee-portal/my-agenda/ics?token=${token}`, "_blank");
  }

  function handleAddToCalendar(sessionId: string) {
    window.open(`/api/agenda-sessions/${sessionId}/ics`, "_blank");
  }

  const sessions = savedQuery.data ?? [];

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, SavedSession[]>();
    for (const s of sessions) {
      if (!map.has(s.sessionDate)) map.set(s.sessionDate, []);
      map.get(s.sessionDate)!.push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  const isRemoving = unsaveSessionMutation.isPending;

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-primary" /> My Agenda
            </h1>
            {sessions.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">{sessions.length} session{sessions.length !== 1 ? "s" : ""} saved</p>
            )}
          </div>
          {sessions.length > 0 && (
            <Button variant="outline" size="sm" className="gap-2 shrink-0" onClick={handleDownloadAll} data-testid="button-download-all-ics">
              <Download className="h-4 w-4" /> Download All
            </Button>
          )}
        </div>

        {/* Loading */}
        {savedQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Empty state */}
        {!savedQuery.isLoading && sessions.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <Bookmark className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-foreground mb-2">No sessions saved yet</p>
            <p className="text-sm text-muted-foreground mb-6">Browse the agenda to build your personal schedule.</p>
            <Link href="/attendee/agenda">
              <Button data-testid="button-browse-agenda">Browse Agenda</Button>
            </Link>
          </div>
        )}

        {/* Grouped sessions */}
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
                          <button className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors w-full" onClick={() => setDetailSession(session)} data-testid={`button-view-my-session-${session.id}`}>
                            {session.title}
                          </button>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1.5">
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" /> {formatTimeRange(session.startTime, session.endTime)}
                            </span>
                            {location && (
                              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {location}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => handleAddToCalendar(session.id)} data-testid={`button-calendar-${session.id}`}>
                          <CalendarDays className="h-3 w-3" /> Add to Calendar
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7 text-destructive hover:text-destructive hover:bg-destructive/10" disabled={isRemoving} onClick={() => unsaveSessionMutation.mutate(session.id)} data-testid={`button-remove-${session.id}`}>
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
