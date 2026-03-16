import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, Tag, ChevronRight, Pencil, CheckCircle2, SkipForward,
  CalendarDays, Users, Bookmark, ExternalLink, ArrowRight, Building2, Calendar, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import { useAttendeeAuth, type AttendeeMe } from "@/hooks/use-attendee-auth";
import SessionDetailSheet, { type AgendaSessionDetail } from "@/components/attendee/SessionDetailSheet";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Topic { id: string; label: string; topicKey: string }
interface TopicSelection { topicId: string }
interface RecommendedSession {
  id: string; title: string; sessionDate: string | null; startTime: string | null;
  endTime: string | null; overlapScore: number; topicIds: string[];
  sessionTypeLabel?: string; description?: string | null;
  locationName?: string | null; speakers?: { name: string }[];
}
interface RecommendedSponsor { id: string; name: string; category: string | null; logoUrl: string | null; overlapScore: number }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTimeRange(s: string | null, e: string | null) {
  if (!s) return "";
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

// ── Welcome Step ──────────────────────────────────────────────────────────────

function WelcomeStep({ me, onStart, onSkip, isSkipping }: { me: AttendeeMe; onStart: () => void; onSkip: () => void; isSkipping: boolean }) {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Star className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold text-foreground tracking-tight">Converge Concierge</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full text-center">
          <div className="flex justify-center mb-6">
            <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Star className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground mb-2 tracking-tight">
            Welcome, {me.attendee.firstName || me.attendee.name}!
          </h1>
          <p className="text-muted-foreground mb-2">
            You're registered for <span className="font-semibold text-foreground">{me.event.name}</span>.
          </p>
          {me.event.location && <p className="text-sm text-muted-foreground mb-8">{me.event.location}</p>}
          <div className="bg-card border border-border/60 rounded-2xl p-6 mb-8 text-left">
            <p className="text-sm font-medium text-foreground mb-3">Your Concierge will help you:</p>
            <ul className="space-y-2">
              {["Discover sessions that match your interests", "Find sponsors aligned with your goals", "Build your personal event schedule"].map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full gap-2" data-testid="button-start-setup" onClick={onStart}>
              Set Up My Interests <ChevronRight className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" data-testid="button-skip-onboarding" onClick={onSkip} disabled={isSkipping}>
              <SkipForward className="h-4 w-4" /> Skip for now
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Topic Selection Step ──────────────────────────────────────────────────────

function TopicSelectionStep({ topics, currentSelections, onSave, onSkip, isSaving, isSkipping }: {
  topics: Topic[]; currentSelections: string[];
  onSave: (ids: string[]) => void; onSkip: () => void;
  isSaving: boolean; isSkipping: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelections));
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="w-full max-w-7xl mx-auto px-6 h-16 flex items-center">
        <div className="flex items-center gap-2.5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Tag className="h-4 w-4" />
          </div>
          <span className="font-display text-base font-bold text-foreground tracking-tight">Converge Concierge</span>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-lg w-full">
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Tag className="h-7 w-7 text-primary" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground tracking-tight mb-2">What are you interested in?</h2>
            <p className="text-sm text-muted-foreground">Choose up to 5 topics — we'll tailor your session and sponsor recommendations.</p>
          </div>
          {topics.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-8">No topics set up for this event yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2 justify-center mb-6">
              {topics.map((topic) => {
                const active = selected.has(topic.id);
                return (
                  <button key={topic.id} data-testid={`chip-topic-${topic.id}`}
                    onClick={() => { if (!active && selected.size >= 5) return; toggle(topic.id); }}
                    className={["px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer select-none",
                      active ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20" : "bg-card text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground",
                      !active && selected.size >= 5 ? "opacity-40 cursor-not-allowed" : ""].join(" ")}>
                    {topic.label}
                  </button>
                );
              })}
            </div>
          )}
          {selected.size > 0 && <p className="text-center text-xs text-muted-foreground mb-6">{selected.size} of 5 selected</p>}
          <div className="flex flex-col gap-3">
            <Button size="lg" className="w-full" data-testid="button-save-topics" disabled={selected.size === 0 || isSaving} onClick={() => onSave(Array.from(selected))}>
              {isSaving ? "Saving…" : "Save My Interests"}
            </Button>
            <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" data-testid="button-skip-topics" onClick={onSkip} disabled={isSkipping}>
              <SkipForward className="h-4 w-4" /> Skip for now
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

interface SponsorInteractions {
  meetings: Record<string, { status: string }>;
  infoRequests: Record<string, { status: string }>;
}

function Dashboard({ me, topics, selections, sessions, sponsors, savedSessionIds, onEditInterests, onSaveSession, onUnsaveSession, isSavingSession, sponsorInteractions, onRequestMeeting, onRequestInfo, isActingOnSponsor }: {
  me: AttendeeMe; topics: Topic[]; selections: TopicSelection[];
  sessions: RecommendedSession[]; sponsors: RecommendedSponsor[];
  savedSessionIds: Set<string>;
  onEditInterests: () => void;
  onSaveSession: (id: string) => void; onUnsaveSession: (id: string) => void;
  isSavingSession: boolean;
  sponsorInteractions: SponsorInteractions;
  onRequestMeeting: (id: string) => void;
  onRequestInfo: (id: string) => void;
  isActingOnSponsor: string | null;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedTopics = selections.map((s) => topicMap.get(s.topicId)).filter(Boolean) as Topic[];
  const [detailSession, setDetailSession] = useState<AgendaSessionDetail | null>(null);

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight" data-testid="text-greeting">
          Hello, {me.attendee.firstName || me.attendee.name} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-event-name">
          {me.event.name}{me.event.location ? ` · ${me.event.location}` : ""}
        </p>
      </div>

      {/* Interests */}
      <div className="bg-card border border-border/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Your Interests
          </h2>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="button-edit-interests" onClick={onEditInterests}>
            <Pencil className="h-3 w-3" /> Edit
          </Button>
        </div>
        {selectedTopics.length === 0
          ? <p className="text-sm text-muted-foreground">No interests selected yet. <button className="text-primary underline" onClick={onEditInterests}>Add interests</button></p>
          : <div className="flex flex-wrap gap-2" data-testid="interests-list">
              {selectedTopics.map((t) => <Badge key={t.id} variant="secondary" className="rounded-full" data-testid={`badge-topic-${t.id}`}>{t.label}</Badge>)}
            </div>
        }
      </div>

      {/* Recommended Sessions */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" /> Recommended Sessions
          </h2>
          <Link href="/attendee/agenda">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="link-view-full-agenda">
              Full Agenda <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {sessions.length === 0
          ? <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No recommendations yet — add interests above or <Link href="/attendee/agenda"><span className="text-primary underline cursor-pointer">browse the full agenda</span></Link>.</p>
            </div>
          : <div className="space-y-3" data-testid="sessions-list">
              {sessions.slice(0, 5).map((session) => {
                const saved = savedSessionIds.has(session.id);
                return (
                  <div key={session.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-session-${session.id}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <button className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors" onClick={() => setDetailSession(session as AgendaSessionDetail)}>
                          {session.title}
                        </button>
                        {session.sessionDate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatDate(session.sessionDate)}{session.startTime ? ` · ${formatTimeRange(session.startTime, session.endTime)}` : ""}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {session.overlapScore > 0 && <Badge className="rounded-full text-xs">{session.overlapScore} match{session.overlapScore !== 1 ? "es" : ""}</Badge>}
                        <Button variant={saved ? "secondary" : "outline"} size="sm" className="h-7 text-xs gap-1"
                          data-testid={`button-save-session-${session.id}`}
                          disabled={isSavingSession}
                          onClick={() => saved ? onUnsaveSession(session.id) : onSaveSession(session.id)}>
                          <Bookmark className={`h-3 w-3 ${saved ? "fill-current" : ""}`} />
                          {saved ? "Saved" : "Save"}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* Recommended Sponsors */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Recommended Sponsors
          </h2>
          <Link href="/attendee/sponsors">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground">
              All Sponsors <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {sponsors.length === 0
          ? <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
              <p className="text-sm text-muted-foreground">No sponsor recommendations yet.</p>
            </div>
          : <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="sponsors-list">
              {sponsors.slice(0, 4).map((sponsor) => {
                const hasMeeting = !!sponsorInteractions.meetings[sponsor.id];
                const hasInfo = !!sponsorInteractions.infoRequests[sponsor.id];
                const acting = isActingOnSponsor === sponsor.id;
                return (
                  <div key={sponsor.id} className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-2.5" data-testid={`card-sponsor-${sponsor.id}`}>
                    <div className="flex items-center gap-3">
                      {sponsor.logoUrl
                        ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-9 w-9 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-0.5" />
                        : <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{sponsor.name}</p>
                        {sponsor.category && <p className="text-xs text-muted-foreground">{sponsor.category}</p>}
                      </div>
                      {sponsor.overlapScore > 0 && <Badge className="shrink-0 rounded-full text-xs">{sponsor.overlapScore}</Badge>}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Link href="/attendee/sponsors">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" data-testid={`button-view-sponsor-${sponsor.id}`}>
                          View <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                      {hasMeeting ? (
                        <span className="flex items-center gap-1 text-xs text-primary font-medium" data-testid={`status-meeting-${sponsor.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Requested
                        </span>
                      ) : (
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={acting} onClick={() => onRequestMeeting(sponsor.id)} data-testid={`button-request-meeting-${sponsor.id}`}>
                          <Calendar className="h-3 w-3" /> Meeting
                        </Button>
                      )}
                      {hasInfo ? (
                        <span className="flex items-center gap-1 text-xs text-accent font-medium" data-testid={`status-info-${sponsor.id}`}>
                          <CheckCircle2 className="h-3.5 w-3.5" /> Info Sent
                        </span>
                      ) : (
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" disabled={acting} onClick={() => onRequestInfo(sponsor.id)} data-testid={`button-request-info-${sponsor.id}`}>
                          <Mail className="h-3 w-3" /> Info
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
        }
      </div>

      {/* Session detail sheet */}
      {detailSession && (
        <SessionDetailSheet
          session={detailSession}
          isSaved={savedSessionIds.has(detailSession.id)}
          onClose={() => setDetailSession(null)}
          onSave={() => onSaveSession(detailSession.id)}
          onUnsave={() => onUnsaveSession(detailSession.id)}
          isSaving={isSavingSession}
        />
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type OnboardingStep = "welcome" | "topics" | null;

export default function AttendeePortalPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);

  const topicsQuery = useQuery<Topic[]>({
    queryKey: ["/api/attendee-portal/topics"],
    queryFn: () => fetch("/api/attendee-portal/topics", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data,
  });

  const selectionsQuery = useQuery<TopicSelection[]>({
    queryKey: ["/api/attendee-portal/topic-selections"],
    queryFn: () => fetch("/api/attendee-portal/topic-selections", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data,
  });

  const sessionsQuery = useQuery<RecommendedSession[]>({
    queryKey: ["/api/attendee-portal/recommended-sessions"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sessions", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data?.onboarding.isDone,
  });

  const sponsorsQuery = useQuery<RecommendedSponsor[]>({
    queryKey: ["/api/attendee-portal/recommended-sponsors"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sponsors", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data?.onboarding.isDone,
  });

  const savedQuery = useQuery<{ savedId: string; id: string }[]>({
    queryKey: ["/api/attendee-portal/saved-sessions"],
    queryFn: () => fetch("/api/attendee-portal/saved-sessions", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data?.onboarding.isDone,
  });

  const saveSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch("/api/attendee-portal/saved-sessions", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ sessionId }),
      }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/saved-sessions"] }),
  });

  const unsaveSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      fetch(`/api/attendee-portal/saved-sessions/${sessionId}`, { method: "DELETE", headers }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/saved-sessions"] }),
  });

  const interactionsQuery = useQuery<SponsorInteractions>({
    queryKey: ["/api/attendee-portal/sponsor-interactions"],
    queryFn: () => fetch("/api/attendee-portal/sponsor-interactions", { headers }).then((r) => r.json()),
    enabled: !!meQuery.data?.onboarding.isDone,
  });

  const [actingOnSponsor, setActingOnSponsor] = useState<string | null>(null);

  const requestMeetingMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-meeting", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (id) => setActingOnSponsor(id),
    onSettled: () => setActingOnSponsor(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] }),
  });

  const requestInfoMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-info", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (id) => setActingOnSponsor(id),
    onSettled: () => setActingOnSponsor(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] }),
  });

  const saveTopicsMutation = useMutation({
    mutationFn: (topicIds: string[]) =>
      fetch("/api/attendee-portal/topic-selections", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ topicIds }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/me"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/topic-selections"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sponsors"] });
      setOnboardingStep(null);
    },
  });

  const skipMutation = useMutation({
    mutationFn: () =>
      fetch("/api/attendee-portal/skip-onboarding", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" }).then((r) => r.json()),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/attendee-portal/me"] }); setOnboardingStep(null); },
  });

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  if (meQuery.isError || !meQuery.data) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Session expired. Please use your access link again.</p></div>;
  }

  const me = meQuery.data;

  // Determine onboarding display
  const showOnboarding: OnboardingStep = onboardingStep !== null ? onboardingStep : (!me.onboarding.isDone ? "welcome" : null);

  if (showOnboarding === "welcome") {
    return <WelcomeStep me={me} onStart={() => setOnboardingStep("topics")} onSkip={() => skipMutation.mutate()} isSkipping={skipMutation.isPending} />;
  }

  if (showOnboarding === "topics") {
    return (
      <TopicSelectionStep
        topics={topicsQuery.data ?? []}
        currentSelections={(selectionsQuery.data ?? []).map((s) => s.topicId)}
        onSave={(ids) => saveTopicsMutation.mutate(ids)}
        onSkip={() => skipMutation.mutate()}
        isSaving={saveTopicsMutation.isPending}
        isSkipping={skipMutation.isPending}
      />
    );
  }

  const savedSessionIds = new Set((savedQuery.data ?? []).map((s) => s.id));

  return (
    <AttendeeShell onLogout={logout} attendeeName={me.attendee.firstName || me.attendee.name}>
      <Dashboard
        me={me}
        topics={topicsQuery.data ?? []}
        selections={selectionsQuery.data ?? []}
        sessions={sessionsQuery.data ?? []}
        sponsors={sponsorsQuery.data ?? []}
        savedSessionIds={savedSessionIds}
        onEditInterests={() => setOnboardingStep("topics")}
        onSaveSession={(id) => saveSessionMutation.mutate(id)}
        onUnsaveSession={(id) => unsaveSessionMutation.mutate(id)}
        isSavingSession={saveSessionMutation.isPending || unsaveSessionMutation.isPending}
        sponsorInteractions={interactionsQuery.data ?? { meetings: {}, infoRequests: {} }}
        onRequestMeeting={(id) => requestMeetingMutation.mutate(id)}
        onRequestInfo={(id) => requestInfoMutation.mutate(id)}
        isActingOnSponsor={actingOnSponsor}
      />
    </AttendeeShell>
  );
}
