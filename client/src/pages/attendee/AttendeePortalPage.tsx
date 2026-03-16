import { useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Hexagon, Star, Users, CalendarDays, Tag, ChevronRight, LogOut, Pencil, CheckCircle2, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendeeMe {
  attendee: { id: string; firstName: string; lastName: string; name: string; company: string; title: string; email: string };
  event: { id: string; name: string; startDate: string | null; endDate: string | null; location: string | null };
  onboarding: { completedAt: string | null; skippedAt: string | null; isDone: boolean };
}

interface Topic {
  id: string;
  label: string;
  topicKey: string;
  color: string | null;
}

interface TopicSelection {
  topicId: string;
}

interface RecommendedSession {
  id: string;
  title: string;
  sessionDate: string | null;
  startTime: string | null;
  endTime: string | null;
  overlapScore: number;
  topicIds: string[];
}

interface RecommendedSponsor {
  id: string;
  name: string;
  category: string | null;
  logoUrl: string | null;
  overlapScore: number;
  topicIds: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getToken(): string | null {
  return localStorage.getItem("attendee_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { "x-attendee-token": token } : {};
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTimeRange(start: string | null, end: string | null): string {
  if (!start) return "";
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  };
  return end ? `${fmt(start)} – ${fmt(end)}` : fmt(start);
}

// ── Shared Header ─────────────────────────────────────────────────────────────

function PortalHeader({ onLogout }: { onLogout: () => void }) {
  return (
    <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border/60">
      <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md shadow-primary/20">
            <Hexagon className="h-4 w-4" />
          </div>
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Converge Concierge</span>
        </div>
        <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" data-testid="button-logout" onClick={onLogout}>
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </header>
  );
}

// ── Step 1: Welcome ───────────────────────────────────────────────────────────

function WelcomeStep({ me, onStart, onSkip, isSkipping }: { me: AttendeeMe; onStart: () => void; onSkip: () => void; isSkipping: boolean }) {
  return (
    <div className="max-w-lg mx-auto px-4 py-16 text-center">
      <div className="flex justify-center mb-6">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center shadow-inner">
          <Star className="h-10 w-10 text-primary" />
        </div>
      </div>
      <h1 className="text-3xl font-display font-bold text-foreground mb-2 tracking-tight">
        Welcome, {me.attendee.firstName || me.attendee.name}!
      </h1>
      <p className="text-muted-foreground mb-2 text-base">
        You're registered for <span className="font-semibold text-foreground">{me.event.name}</span>.
      </p>
      {me.event.location && (
        <p className="text-sm text-muted-foreground mb-8">{me.event.location}</p>
      )}
      <div className="bg-card border border-border/60 rounded-2xl p-6 mb-8 text-left">
        <p className="text-sm font-medium text-foreground mb-1">Your Concierge will help you:</p>
        <ul className="space-y-2 mt-3">
          {[
            "Discover sessions that match your interests",
            "Find sponsors aligned with your goals",
            "Make the most of your time at the event",
          ].map((item) => (
            <li key={item} className="flex items-start gap-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-3">
        <Button size="lg" className="w-full gap-2" data-testid="button-start-setup" onClick={onStart}>
          Set Up My Interests
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" data-testid="button-skip-onboarding" onClick={onSkip} disabled={isSkipping}>
          <SkipForward className="h-4 w-4" />
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ── Step 2: Topic Selection ───────────────────────────────────────────────────

function TopicSelectionStep({
  topics,
  currentSelections,
  onSave,
  onSkip,
  isSaving,
  isSkipping,
}: {
  topics: Topic[];
  currentSelections: string[];
  onSave: (ids: string[]) => void;
  onSkip: () => void;
  isSaving: boolean;
  isSkipping: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelections));

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="max-w-lg mx-auto px-4 py-12">
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
        <p className="text-center text-sm text-muted-foreground py-8">No topics have been set up for this event yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 justify-center mb-8">
          {topics.map((topic) => {
            const active = selected.has(topic.id);
            return (
              <button
                key={topic.id}
                data-testid={`chip-topic-${topic.id}`}
                onClick={() => {
                  if (!active && selected.size >= 5) return;
                  toggle(topic.id);
                }}
                className={[
                  "px-4 py-2 rounded-full text-sm font-medium border transition-all cursor-pointer select-none",
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                    : "bg-card text-muted-foreground border-border/60 hover:border-primary/50 hover:text-foreground",
                  !active && selected.size >= 5 ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {topic.label}
              </button>
            );
          })}
        </div>
      )}

      {selected.size > 0 && (
        <p className="text-center text-xs text-muted-foreground mb-6">
          {selected.size} of 5 selected
        </p>
      )}

      <div className="flex flex-col gap-3">
        <Button
          size="lg"
          className="w-full"
          data-testid="button-save-topics"
          disabled={selected.size === 0 || isSaving}
          onClick={() => onSave(Array.from(selected))}
        >
          {isSaving ? "Saving…" : "Save My Interests"}
        </Button>
        <Button variant="ghost" size="sm" className="text-muted-foreground gap-1" data-testid="button-skip-topics" onClick={onSkip} disabled={isSkipping}>
          <SkipForward className="h-4 w-4" />
          Skip for now
        </Button>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function Dashboard({
  me,
  topics,
  selections,
  sessions,
  sponsors,
  onEditInterests,
}: {
  me: AttendeeMe;
  topics: Topic[];
  selections: TopicSelection[];
  sessions: RecommendedSession[];
  sponsors: RecommendedSponsor[];
  onEditInterests: () => void;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedTopics = selections.map((s) => topicMap.get(s.topicId)).filter(Boolean) as Topic[];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight" data-testid="text-greeting">
          Hello, {me.attendee.firstName || me.attendee.name} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1" data-testid="text-event-name">
          {me.event.name}
          {me.event.location ? ` · ${me.event.location}` : ""}
        </p>
      </div>

      {/* Interests */}
      <div className="bg-card border border-border/60 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" />
            Your Interests
          </h2>
          <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="button-edit-interests" onClick={onEditInterests}>
            <Pencil className="h-3 w-3" />
            Edit
          </Button>
        </div>
        {selectedTopics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No interests selected yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2" data-testid="interests-list">
            {selectedTopics.map((t) => (
              <Badge key={t.id} variant="secondary" className="rounded-full" data-testid={`badge-topic-${t.id}`}>
                {t.label}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Recommended Sessions */}
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
          <CalendarDays className="h-4 w-4 text-primary" />
          Recommended Sessions
        </h2>
        {sessions.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No session recommendations yet — check back after adding interests.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="sessions-list">
            {sessions.map((session) => {
              const matchedTopics = session.topicIds.map((id) => topicMap.get(id)).filter(Boolean) as Topic[];
              return (
                <div
                  key={session.id}
                  className="bg-card border border-border/60 rounded-xl p-4"
                  data-testid={`card-session-${session.id}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground text-sm leading-snug" data-testid={`text-session-title-${session.id}`}>{session.title}</p>
                      {session.sessionDate && (
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(session.sessionDate)}
                          {session.startTime ? ` · ${formatTimeRange(session.startTime, session.endTime)}` : ""}
                        </p>
                      )}
                      {matchedTopics.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {matchedTopics.map((t) => (
                            <Badge key={t.id} variant="outline" className="text-xs rounded-full px-2 py-0">
                              {t.label}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    {session.overlapScore > 0 && (
                      <Badge className="shrink-0 rounded-full text-xs" data-testid={`badge-session-score-${session.id}`}>
                        {session.overlapScore} match{session.overlapScore !== 1 ? "es" : ""}
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recommended Sponsors */}
      <div>
        <h2 className="text-base font-semibold text-foreground flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-primary" />
          Recommended Sponsors
        </h2>
        {sponsors.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            <p className="text-sm text-muted-foreground">No sponsor recommendations yet — check back after adding interests.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="sponsors-list">
            {sponsors.map((sponsor) => {
              const matchedTopics = sponsor.topicIds.map((id) => topicMap.get(id)).filter(Boolean) as Topic[];
              return (
                <div
                  key={sponsor.id}
                  className="bg-card border border-border/60 rounded-xl p-4 flex items-start gap-4"
                  data-testid={`card-sponsor-${sponsor.id}`}
                >
                  {sponsor.logoUrl ? (
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 w-10 rounded-lg object-contain shrink-0 border border-border/40" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-foreground text-sm" data-testid={`text-sponsor-name-${sponsor.id}`}>{sponsor.name}</p>
                    {sponsor.category && (
                      <p className="text-xs text-muted-foreground mt-0.5">{sponsor.category}</p>
                    )}
                    {matchedTopics.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {matchedTopics.map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs rounded-full px-2 py-0">
                            {t.label}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  {sponsor.overlapScore > 0 && (
                    <Badge className="shrink-0 rounded-full text-xs self-start" data-testid={`badge-sponsor-score-${sponsor.id}`}>
                      {sponsor.overlapScore} match{sponsor.overlapScore !== 1 ? "es" : ""}
                    </Badge>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type OnboardingStep = "welcome" | "topics" | "done";

export default function AttendeePortalPage() {
  const [, nav] = useLocation();
  const qc = useQueryClient();
  const token = getToken();

  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep | null>(null);

  // Redirect if no token
  if (!token) {
    nav("/");
    return null;
  }

  const headers = authHeaders();

  const meQuery = useQuery<AttendeeMe>({
    queryKey: ["/api/attendee-portal/me"],
    queryFn: () => fetch("/api/attendee-portal/me", { headers }).then((r) => r.ok ? r.json() : Promise.reject(r)),
    retry: false,
  });

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

  const saveTopicsMutation = useMutation({
    mutationFn: (topicIds: string[]) =>
      fetch("/api/attendee-portal/topic-selections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ topicIds }),
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
      fetch("/api/attendee-portal/skip-onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({}),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/me"] });
      setOnboardingStep(null);
    },
  });

  function handleLogout() {
    localStorage.removeItem("attendee_token");
    nav("/");
  }

  // Loading state
  if (meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  // Error state
  if (meQuery.isError || !meQuery.data) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <PortalHeader onLogout={handleLogout} />
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="text-center max-w-sm">
            <p className="text-muted-foreground mb-4" data-testid="text-portal-error">
              Your session has expired or this link is no longer valid.
            </p>
            <Button variant="outline" onClick={handleLogout} data-testid="button-error-logout">
              Return to Home
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const me = meQuery.data;
  const topics = topicsQuery.data ?? [];
  const selections = selectionsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const sponsors = sponsorsQuery.data ?? [];

  // Determine what to show
  const showOnboarding = onboardingStep !== null
    ? onboardingStep
    : (!me.onboarding.isDone ? "welcome" : null);

  return (
    <div className="min-h-screen bg-background">
      <PortalHeader onLogout={handleLogout} />
      <main>
        {showOnboarding === "welcome" && (
          <WelcomeStep
            me={me}
            onStart={() => setOnboardingStep("topics")}
            onSkip={() => skipMutation.mutate()}
            isSkipping={skipMutation.isPending}
          />
        )}
        {showOnboarding === "topics" && (
          <TopicSelectionStep
            topics={topics}
            currentSelections={selections.map((s) => s.topicId)}
            onSave={(ids) => saveTopicsMutation.mutate(ids)}
            onSkip={() => skipMutation.mutate()}
            isSaving={saveTopicsMutation.isPending}
            isSkipping={skipMutation.isPending}
          />
        )}
        {!showOnboarding && (
          <Dashboard
            me={me}
            topics={topics}
            selections={selections}
            sessions={sessions}
            sponsors={sponsors}
            onEditInterests={() => setOnboardingStep("topics")}
          />
        )}
      </main>
    </div>
  );
}
