import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, Tag, ChevronRight, Pencil, CheckCircle2,
  CalendarDays, Users, Bookmark, ExternalLink, ArrowRight, Building2, Calendar, Mail, Bell,
  Lightbulb, Sparkles, MapPin, Clock, UserCheck, AlertCircle,
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
  id: string; title: string; description?: string | null;
  sessionDate: string | null; startTime: string | null; endTime: string | null;
  locationName?: string | null; isFeatured?: boolean;
  sessionTypeLabel?: string; overlapScore: number;
  overlapTopicLabels: string[]; speakers?: { name: string; title?: string | null }[];
}
interface RecommendedSponsor {
  id: string; name: string; category: string | null; logoUrl: string | null;
  shortDescription?: string | null; overlapScore: number; overlapTopicLabels: string[];
}
interface SuggestedMeeting {
  id: string; name: string; logoUrl: string | null;
  shortDescription?: string | null; overlapScore: number; overlapTopicLabels: string[];
}
interface SponsorInteractions {
  meetings: Record<string, { status: string }>;
  infoRequests: Record<string, { status: string }>;
}

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

// ── Onboarding Steps ──────────────────────────────────────────────────────────

function WelcomeStep({ me, onStart, onSkip, isSkipping }: { me: AttendeeMe; onStart: () => void; onSkip: () => void; isSkipping: boolean }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md text-center space-y-6">
        <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Star className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-welcome-heading">
            Welcome, {me.attendee.firstName || me.attendee.name}
          </h1>
          <p className="text-muted-foreground mt-2">
            You're registered for <span className="font-medium text-foreground">{me.event.name}</span>.
            Let's personalise your experience.
          </p>
        </div>
        <div className="space-y-3">
          <Button className="w-full" size="lg" onClick={onStart} data-testid="button-get-started">
            Get Started <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip} disabled={isSkipping} data-testid="button-skip-onboarding">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

function TopicSelectionStep({ topics, currentSelections, onSave, onSkip, isSaving, isSkipping }: {
  topics: Topic[]; currentSelections: string[];
  onSave: (ids: string[]) => void; onSkip: () => void;
  isSaving: boolean; isSkipping: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelections));
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-topic-heading">Select Your Interests</h1>
          <p className="text-muted-foreground mt-1">We'll personalise your session and sponsor recommendations.</p>
        </div>
        <div className="flex flex-wrap gap-2 justify-center" data-testid="topics-list">
          {topics.map((t) => (
            <button key={t.id} onClick={() => toggle(t.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${selected.has(t.id) ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground hover:border-primary/50"}`}
              data-testid={`button-topic-${t.id}`}>
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button className="flex-1" onClick={() => onSave([...selected])} disabled={isSaving} data-testid="button-save-interests">
            {isSaving ? "Saving…" : `Save Interests (${selected.size})`}
          </Button>
          <Button variant="ghost" className="text-muted-foreground" onClick={onSkip} disabled={isSkipping} data-testid="button-skip-topics">
            Skip
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ─────────────────────────────────────────────────────────────────

function RelevanceLabel({ labels }: { labels: string[] }) {
  if (!labels || labels.length === 0) return null;
  return (
    <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
      <Sparkles className="h-3 w-3 shrink-0" />
      Relevant to your interests: {labels.slice(0, 3).join(", ")}
    </p>
  );
}

function Dashboard({
  me, topics, selections, sessions, sponsors, suggestedMeetings, savedSessionIds,
  onEditInterests, onSaveSession, onUnsaveSession, isSavingSession,
  sponsorInteractions, onRequestMeeting, onRequestInfo, isActingOnSponsor, invitationCount,
}: {
  me: AttendeeMe; topics: Topic[]; selections: TopicSelection[];
  sessions: RecommendedSession[]; sponsors: RecommendedSponsor[];
  suggestedMeetings: SuggestedMeeting[];
  savedSessionIds: Set<string>;
  onEditInterests: () => void;
  onSaveSession: (id: string) => void; onUnsaveSession: (id: string) => void;
  isSavingSession: boolean;
  sponsorInteractions: SponsorInteractions;
  onRequestMeeting: (id: string) => void;
  onRequestInfo: (id: string) => void;
  isActingOnSponsor: string | null;
  invitationCount: number;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedTopics = selections.map((s) => topicMap.get(s.topicId)).filter(Boolean) as Topic[];
  const [detailSession, setDetailSession] = useState<AgendaSessionDetail | null>(null);

  const hasInterests = selections.length > 0;
  const hasSavedSessions = savedSessionIds.size > 0;
  const hasMeetings = Object.keys(sponsorInteractions.meetings).length > 0;
  const hasSuggestedMeetings = suggestedMeetings.length > 0;

  // ── Smart contextual prompts ──────────────────────────────────────────────
  const prompts: { key: string; icon: React.ReactNode; text: string; cta: string; href?: string; action?: () => void }[] = [];
  if (!hasInterests) {
    prompts.push({ key: "no-interests", icon: <Tag className="h-4 w-4" />, text: "Select your interests to unlock personalised session and sponsor recommendations.", cta: "Add Interests", action: onEditInterests });
  }
  if (hasInterests && !hasSavedSessions && sessions.length > 0) {
    prompts.push({ key: "no-saved", icon: <Bookmark className="h-4 w-4" />, text: "Save sessions to build your personal agenda for the event.", cta: "Browse Sessions", href: "/attendee/agenda" });
  }
  if (hasInterests && !hasMeetings && hasSuggestedMeetings) {
    prompts.push({ key: "no-meetings", icon: <UserCheck className="h-4 w-4" />, text: `${suggestedMeetings.length} sponsor${suggestedMeetings.length !== 1 ? "s" : ""} align with your interests. Request a meeting to connect.`, cta: "View Sponsors", href: "/attendee/sponsors" });
  }

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

      {/* Meeting invitation banner — highest priority */}
      {invitationCount > 0 && (
        <Link href="/attendee/meetings">
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/30 rounded-xl px-4 py-3 cursor-pointer hover:bg-primary/10 transition-colors" data-testid="banner-meeting-invitations">
            <div className="h-8 w-8 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
              <Bell className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Meeting Invitation{invitationCount !== 1 ? "s" : ""} ({invitationCount})
              </p>
              <p className="text-xs text-muted-foreground">
                {invitationCount === 1 ? "You have 1 meeting invitation" : `You have ${invitationCount} meeting invitations`} waiting for your response
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* Smart prompts */}
      {prompts.length > 0 && (
        <div className="space-y-2" data-testid="smart-prompts">
          {prompts.map((p) => (
            <div key={p.key} className="flex items-center gap-3 bg-accent/30 border border-border/50 rounded-xl px-4 py-3" data-testid={`prompt-${p.key}`}>
              <div className="h-7 w-7 rounded-full bg-background border border-border/60 flex items-center justify-center shrink-0 text-muted-foreground">
                {p.icon}
              </div>
              <p className="flex-1 text-sm text-foreground">{p.text}</p>
              {p.href ? (
                <Link href={p.href}>
                  <Button variant="outline" size="sm" className="h-7 text-xs shrink-0">{p.cta}</Button>
                </Link>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs shrink-0" onClick={p.action}>{p.cta}</Button>
              )}
            </div>
          ))}
        </div>
      )}

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
        {sessions.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            {!hasInterests ? (
              <div className="space-y-2">
                <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                <p className="text-sm text-muted-foreground">
                  <button className="text-primary underline" onClick={onEditInterests}>Select your interests</button> to unlock personalised session recommendations.
                </p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No recommendations yet — <Link href="/attendee/agenda"><span className="text-primary underline cursor-pointer">browse the full agenda</span></Link>.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3" data-testid="sessions-list">
            {sessions.map((session) => {
              const saved = savedSessionIds.has(session.id);
              return (
                <div key={session.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-session-${session.id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        {session.isFeatured && <Badge variant="secondary" className="rounded-full text-xs px-2 py-0 h-5">Featured</Badge>}
                        {session.sessionTypeLabel && <span className="text-xs text-muted-foreground">{session.sessionTypeLabel}</span>}
                      </div>
                      <button className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors" onClick={() => setDetailSession(session as AgendaSessionDetail)}>
                        {session.title}
                      </button>
                      {(session.sessionDate || session.locationName) && (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                          {session.sessionDate && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(session.sessionDate)}{session.startTime ? ` · ${formatTimeRange(session.startTime, session.endTime)}` : ""}
                            </p>
                          )}
                          {session.locationName && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{session.locationName}
                            </p>
                          )}
                        </div>
                      )}
                      <RelevanceLabel labels={session.overlapTopicLabels} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
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
        )}
      </div>

      {/* Suggested Meetings */}
      {(hasInterests && hasSuggestedMeetings) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-primary" /> Suggested Meetings
            </h2>
            <Link href="/attendee/sponsors">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="link-view-all-sponsors-meetings">
                All Sponsors <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          <div className="bg-card border border-border/60 rounded-2xl divide-y divide-border/40" data-testid="suggested-meetings-list">
            {suggestedMeetings.map((s) => {
              const acting = isActingOnSponsor === s.id;
              const hasMeeting = !!sponsorInteractions.meetings[s.id];
              return (
                <div key={s.id} className="flex items-center gap-3 px-4 py-3" data-testid={`card-suggested-meeting-${s.id}`}>
                  {s.logoUrl
                    ? <img src={s.logoUrl} alt={s.name} className="h-8 w-8 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-0.5" />
                    : <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{s.name}</p>
                    <RelevanceLabel labels={s.overlapTopicLabels} />
                  </div>
                  {hasMeeting ? (
                    <span className="flex items-center gap-1 text-xs text-primary font-medium shrink-0" data-testid={`status-suggested-meeting-${s.id}`}>
                      <CheckCircle2 className="h-3.5 w-3.5" /> Requested
                    </span>
                  ) : (
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" disabled={acting}
                      onClick={() => onRequestMeeting(s.id)} data-testid={`button-request-meeting-suggested-${s.id}`}>
                      <Calendar className="h-3 w-3" /> Request
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

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
        {sponsors.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            {!hasInterests ? (
              <p className="text-sm text-muted-foreground">
                <button className="text-primary underline" onClick={onEditInterests}>Add interests</button> to see sponsor recommendations.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No sponsor recommendations yet.</p>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" data-testid="sponsors-list">
            {sponsors.map((sponsor) => {
              const hasMeeting = !!sponsorInteractions.meetings[sponsor.id];
              const hasInfo = !!sponsorInteractions.infoRequests[sponsor.id];
              const acting = isActingOnSponsor === sponsor.id;
              return (
                <div key={sponsor.id} className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-2.5" data-testid={`card-sponsor-${sponsor.id}`}>
                  <div className="flex items-start gap-3">
                    {sponsor.logoUrl
                      ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-9 w-9 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-0.5" />
                      : <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{sponsor.name}</p>
                      {sponsor.category && <p className="text-xs text-muted-foreground">{sponsor.category}</p>}
                      {sponsor.shortDescription && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sponsor.shortDescription}</p>}
                      <RelevanceLabel labels={sponsor.overlapTopicLabels} />
                    </div>
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
        )}
      </div>

      {/* Your Interests */}
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

  const suggestedMeetingsQuery = useQuery<SuggestedMeeting[]>({
    queryKey: ["/api/attendee-portal/suggested-meetings"],
    queryFn: () => fetch("/api/attendee-portal/suggested-meetings", { headers }).then((r) => r.json()),
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

  const meetingsQuery = useQuery<{ id: string; status: string; source: string }[]>({
    queryKey: ["/api/attendee-portal/meetings"],
    queryFn: () => fetch("/api/attendee-portal/meetings", { headers }).then((r) => r.json()),
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/suggested-meetings"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sponsors"] });
    },
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
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/suggested-meetings"] });
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
  const invitationCount = (meetingsQuery.data ?? []).filter((m) => m.source === "admin" && m.status === "Scheduled").length;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me.attendee.firstName || me.attendee.name}>
      <Dashboard
        me={me}
        topics={topicsQuery.data ?? []}
        selections={selectionsQuery.data ?? []}
        sessions={sessionsQuery.data ?? []}
        sponsors={sponsorsQuery.data ?? []}
        suggestedMeetings={suggestedMeetingsQuery.data ?? []}
        savedSessionIds={savedSessionIds}
        onEditInterests={() => setOnboardingStep("topics")}
        onSaveSession={(id) => saveSessionMutation.mutate(id)}
        onUnsaveSession={(id) => unsaveSessionMutation.mutate(id)}
        isSavingSession={saveSessionMutation.isPending || unsaveSessionMutation.isPending}
        sponsorInteractions={interactionsQuery.data ?? { meetings: {}, infoRequests: {} }}
        onRequestMeeting={(id) => requestMeetingMutation.mutate(id)}
        onRequestInfo={(id) => requestInfoMutation.mutate(id)}
        isActingOnSponsor={actingOnSponsor}
        invitationCount={invitationCount}
      />
    </AttendeeShell>
  );
}
