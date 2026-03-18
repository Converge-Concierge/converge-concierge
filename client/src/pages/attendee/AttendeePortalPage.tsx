import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Star, ChevronRight, CheckCircle2, Hexagon,
  CalendarDays, Users, Bookmark, ExternalLink, ArrowRight, Building2, Calendar, Mail, Bell,
  Lightbulb, Sparkles, MapPin, Clock, AlertCircle, X, Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import { useAttendeeAuth, type AttendeeMe } from "@/hooks/use-attendee-auth";
import { useToast } from "@/hooks/use-toast";
import SessionDetailSheet, { type AgendaSessionDetail } from "@/components/attendee/SessionDetailSheet";
import MeetingSchedulerDialog from "@/components/attendee/MeetingSchedulerDialog";
import { RequestInfoModal } from "@/components/RequestInfoModal";

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
  id: string; name: string; level: string | null; category: string | null; logoUrl: string | null;
  shortDescription?: string | null; websiteUrl?: string | null; overlapScore: number; overlapTopicLabels: string[];
  onsiteMeetingEnabled: boolean; onlineMeetingEnabled: boolean; informationRequestEnabled: boolean;
}

interface SponsorInteractions {
  meetings: Record<string, { status: string }>;
  infoRequests: Record<string, { status: string }>;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string | null) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
function formatTimeRange(s: string | null, e: string | null) {
  if (!s) return "";
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

// ── Shared wizard chrome ───────────────────────────────────────────────────────

function OnboardingCard({ step, children }: { step: number; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Star className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Converge Concierge</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-primary" : i < step ? "w-4 bg-primary/50" : "w-4 bg-border"}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground ml-1">Step {step} of 4</span>
          </div>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8">
        {children}
      </div>
    </div>
  );
}

// ── Welcome screen (pre-wizard) ────────────────────────────────────────────────

function WelcomeStep({ me, onStart, onSkip, isSkipping }: { me: AttendeeMe; onStart: () => void; onSkip: () => void; isSkipping: boolean }) {
  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
  const startStr = fmtDate(me.event.startDate);
  const endStr = fmtDate(me.event.endDate);
  const dateString = startStr && endStr && startStr !== endStr ? `${startStr} – ${endStr}` : startStr;
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <Star className="h-8 w-8 text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">You're registered</p>
            <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-welcome-heading">
              Welcome, {me.attendee.firstName || me.attendee.name}
            </h1>
            <p className="font-medium text-foreground mt-2">{me.event.name}</p>
            {(dateString || me.event.location) && (
              <div className="flex items-center justify-center gap-3 mt-1.5 flex-wrap">
                {dateString && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <CalendarDays className="h-3.5 w-3.5" /> {dateString}
                  </span>
                )}
                {me.event.location && (
                  <span className="flex items-center gap-1 text-sm text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" /> {me.event.location}
                  </span>
                )}
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            Let's personalise your conference experience in just a few steps.
          </p>
        </div>
        <div className="space-y-3">
          <Button className="w-full gap-2" size="lg" onClick={onStart} data-testid="button-get-started">
            Get Started <ArrowRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onSkip} disabled={isSkipping} data-testid="button-skip-onboarding">
            Skip for now
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Card 1: Select Topics ─────────────────────────────────────────────────────

function TopicsCard({ topics, currentSelections, onSave, onSkip, isSaving, isSkipping }: {
  topics: Topic[]; currentSelections: string[];
  onSave: (ids: string[]) => void; onSkip: () => void;
  isSaving: boolean; isSkipping: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelections));
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedList = [...selected].map((id) => topicMap.get(id)).filter(Boolean) as Topic[];
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <OnboardingCard step={1}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-primary font-medium mb-1">Let's personalise your conference experience.</p>
          <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-topic-heading">
            Select Your Interests
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Choose the topics most relevant to you so Concierge can personalise your sessions, sponsors, and meeting suggestions.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5">
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading topics…</p>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="topics-list">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    selected.has(t.id)
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  data-testid={`button-topic-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {selectedList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {selectedList.length} interest{selectedList.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedList.map((t) => (
                  <Badge key={t.id} variant="secondary" className="rounded-full text-xs">{t.label}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 pb-8">
          <Button
            className="w-full gap-2" size="lg"
            onClick={() => onSave([...selected])}
            disabled={isSaving}
            data-testid="button-save-interests"
          >
            {isSaving ? "Saving…" : "Continue"}
            {!isSaving && <ArrowRight className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost" className="w-full text-muted-foreground"
            onClick={onSkip} disabled={isSkipping}
            data-testid="button-skip-topics"
          >
            Skip for now
          </Button>
        </div>
      </div>
    </OnboardingCard>
  );
}

// ── Card 2: Recommended Sessions ──────────────────────────────────────────────

function SessionsCard({ sessions, savedSessionIds, onSave, onUnsave, isSaving, onContinue, onViewSession }: {
  sessions: RecommendedSession[];
  savedSessionIds: Set<string>;
  onSave: (id: string) => void;
  onUnsave: (id: string) => void;
  isSaving: boolean;
  onContinue: () => void;
  onViewSession: (s: RecommendedSession) => void;
}) {
  return (
    <OnboardingCard step={2}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-primary font-medium mb-1">Here are sessions that match your interests.</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Recommended Sessions</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Based on your selected interests, here are sessions you may want to attend.
          </p>
        </div>

        {sessions.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            <CalendarDays className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">No recommendations yet</p>
            <p className="text-xs text-muted-foreground">Recommended sessions will appear as the agenda is published.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="onboarding-sessions-list">
            {sessions.slice(0, 3).map((s) => {
              const saved = savedSessionIds.has(s.id);
              return (
                <div key={s.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-onboarding-session-${s.id}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      {s.sessionTypeLabel && (
                        <Badge variant="outline" className="text-xs rounded-full mb-1.5">{s.sessionTypeLabel}</Badge>
                      )}
                      <button
                        className="font-medium text-foreground text-sm leading-snug text-left hover:text-primary transition-colors w-full"
                        onClick={() => onViewSession(s)}
                        data-testid={`button-view-onboarding-session-${s.id}`}
                      >
                        {s.title}
                      </button>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                        {s.sessionDate && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(s.sessionDate)}{s.startTime ? ` · ${formatTimeRange(s.startTime, s.endTime)}` : ""}
                          </span>
                        )}
                        {s.locationName && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />{s.locationName}
                          </span>
                        )}
                      </div>
                      {(s.overlapTopicLabels ?? []).length > 0 && (
                        <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Relevant to your interests: {s.overlapTopicLabels.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 gap-1.5 text-xs shrink-0"
                      disabled={isSaving}
                      onClick={() => saved ? onUnsave(s.id) : onSave(s.id)}
                      data-testid={`button-save-onboarding-session-${s.id}`}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
                      {saved ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 pb-8">
          <Button className="w-full gap-2" size="lg" onClick={onContinue} data-testid="button-sessions-continue">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/attendee/agenda">
            <Button variant="ghost" className="w-full text-muted-foreground" data-testid="button-view-full-agenda-onboarding">
              View Full Agenda
            </Button>
          </Link>
        </div>
      </div>
    </OnboardingCard>
  );
}

// ── Card 3: Recommended Sponsors ──────────────────────────────────────────────

function SponsorsCard({ sponsors, sponsorInteractions, onRequestMeeting, onRequestInfo, isActingOnSponsor, onContinue }: {
  sponsors: RecommendedSponsor[];
  sponsorInteractions: SponsorInteractions;
  onRequestMeeting: (id: string) => void;
  onRequestInfo: (id: string) => void;
  isActingOnSponsor: string | null;
  onContinue: () => void;
}) {
  return (
    <OnboardingCard step={3}>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-primary font-medium mb-1">Here are sponsors you may want to meet.</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Recommended Sponsors</h1>
          <p className="text-sm text-muted-foreground mt-2">
            These sponsors align with the interests you selected.
          </p>
        </div>

        {sponsors.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center">
            <Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Sponsor recommendations will appear as profiles are completed.</p>
          </div>
        ) : (
          <div className="space-y-3" data-testid="onboarding-sponsors-list">
            {sponsors.slice(0, 3).map((s) => {
              const acting = isActingOnSponsor === s.id;
              return (
                <div key={s.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-onboarding-sponsor-${s.id}`}>
                  <div className="flex items-start gap-3 mb-3">
                    {s.logoUrl
                      ? <img src={s.logoUrl} alt={s.name} className="h-10 w-10 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-0.5" />
                      : <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
                    }
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-foreground text-sm">{s.name}</p>
                      {s.shortDescription && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{s.shortDescription}</p>}
                      {(s.overlapTopicLabels ?? []).length > 0 && (
                        <p className="text-xs text-primary/80 mt-1 flex items-center gap-1">
                          <Sparkles className="h-3 w-3" /> Relevant to your interests: {s.overlapTopicLabels.slice(0, 3).join(", ")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={acting}
                      onClick={() => onRequestMeeting(s.id)}
                      data-testid={`button-onboarding-request-meeting-${s.id}`}>
                      <Calendar className="h-3 w-3" /> Request Meeting
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" disabled={acting}
                      onClick={() => onRequestInfo(s.id)}
                      data-testid={`button-onboarding-request-info-${s.id}`}>
                      <Mail className="h-3 w-3" /> Request Info
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="space-y-3 pb-8">
          <Button className="w-full gap-2" size="lg" onClick={onContinue} data-testid="button-sponsors-continue">
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
          <Link href="/attendee/sponsors">
            <Button variant="ghost" className="w-full text-muted-foreground" data-testid="button-view-all-sponsors-onboarding">
              View All Sponsors
            </Button>
          </Link>
        </div>
      </div>
    </OnboardingCard>
  );
}

// ── Card 4: Dashboard Ready ───────────────────────────────────────────────────

function ReadyCard({ me, selections, topics, sessionCount, sponsorCount, onDone }: {
  me: AttendeeMe;
  selections: TopicSelection[];
  topics: Topic[];
  sessionCount: number;
  sponsorCount: number;
  onDone: () => void;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedTopics = selections.map((s) => topicMap.get(s.topicId)).filter(Boolean) as Topic[];

  return (
    <OnboardingCard step={4}>
      <div className="space-y-6">
        <div className="text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="text-sm text-primary font-medium mb-1">Your personalised dashboard is ready.</p>
          <h1 className="text-2xl font-display font-bold text-foreground">Your Concierge Dashboard Is Ready</h1>
          <p className="text-sm text-muted-foreground mt-2">
            You can now explore your recommended sessions, sponsors, meetings, and saved agenda all in one place.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5 space-y-4">
          {selectedTopics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">You selected</p>
              <div className="flex flex-wrap gap-1.5">
                {selectedTopics.map((t) => (
                  <Badge key={t.id} variant="secondary" className="rounded-full text-xs">{t.label}</Badge>
                ))}
              </div>
            </div>
          )}
          <div className={`flex gap-4 ${selectedTopics.length > 0 ? "pt-4 border-t border-border/40" : ""}`}>
            <div className="flex-1 text-center">
              <p className="text-2xl font-display font-bold text-primary" data-testid="text-ready-session-count">{sessionCount}</p>
              <p className="text-xs text-muted-foreground">Recommended Sessions</p>
            </div>
            <div className="flex-1 text-center">
              <p className="text-2xl font-display font-bold text-primary" data-testid="text-ready-sponsor-count">{sponsorCount}</p>
              <p className="text-xs text-muted-foreground">Recommended Sponsors</p>
            </div>
          </div>
        </div>

        <div className="pb-8">
          <Button className="w-full gap-2" size="lg" onClick={onDone} data-testid="button-go-to-dashboard">
            Go to My Dashboard <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </OnboardingCard>
  );
}

// ── Edit Topics (from dashboard) ──────────────────────────────────────────────

function EditTopicsCard({ topics, currentSelections, onSave, onCancel, isSaving }: {
  topics: Topic[]; currentSelections: string[];
  onSave: (ids: string[]) => void; onCancel: () => void;
  isSaving: boolean;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentSelections));
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedList = [...selected].map((id) => topicMap.get(id)).filter(Boolean) as Topic[];
  const toggle = (id: string) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border/60">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Star className="h-4 w-4 text-primary" />
            </div>
            <span className="text-sm font-semibold text-foreground">Edit Your Interests</span>
          </div>
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2" onClick={onCancel} data-testid="button-cancel-edit-topics">
            <X className="h-4 w-4" /> Cancel
          </Button>
        </div>
      </div>
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-xl font-display font-bold text-foreground">Your Interests</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update your topic selections to refresh your session and sponsor recommendations.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-5">
          {topics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Loading topics…</p>
          ) : (
            <div className="flex flex-wrap gap-2" data-testid="topics-list">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    selected.has(t.id)
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  data-testid={`button-topic-${t.id}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          )}
          {selectedList.length > 0 && (
            <div className="mt-4 pt-4 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" /> {selectedList.length} interest{selectedList.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedList.map((t) => (
                  <Badge key={t.id} variant="secondary" className="rounded-full text-xs">{t.label}</Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3 pb-8">
          <Button
            className="w-full gap-2" size="lg"
            onClick={() => onSave([...selected])}
            disabled={isSaving}
            data-testid="button-save-interests"
          >
            {isSaving ? "Saving…" : "Save Interests"}
            {!isSaving && <CheckCircle2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" className="w-full text-muted-foreground" onClick={onCancel} data-testid="button-cancel-edit-interests">
            Cancel
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

// ── Sponsor Card (home dashboard variant) ─────────────────────────────────────

function HomeSponsorCard({
  sponsor,
  accentColor,
  onScheduleOnsite,
  onScheduleOnline,
  onRequestInfo,
}: {
  sponsor: RecommendedSponsor;
  accentColor: string | null;
  onScheduleOnsite: () => void;
  onScheduleOnline: () => void;
  onRequestInfo: () => void;
}) {
  const ac = accentColor;
  const acColor = ac ? { color: ac } : undefined;
  const acBg = ac ? { backgroundColor: `${ac}18` } : undefined;
  const hasActions = sponsor.onsiteMeetingEnabled || sponsor.onlineMeetingEnabled || sponsor.informationRequestEnabled;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3" data-testid={`card-home-sponsor-${sponsor.id}`}>
      <div className="flex items-start justify-between gap-2">
        {sponsor.logoUrl
          ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-12 rounded-xl object-contain shrink-0 border border-border/40 bg-white p-1" />
          : (
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10" style={acBg}>
              <Building2 className="h-6 w-6 text-primary" style={acColor} />
            </div>
          )
        }
        {sponsor.level && (
          <Badge variant="secondary" className="rounded-full text-[10px] shrink-0 font-semibold px-2.5">
            {sponsor.level}
          </Badge>
        )}
      </div>
      <div className="space-y-1 min-w-0">
        <p className="font-bold text-sm text-foreground leading-snug">{sponsor.name}</p>
        {sponsor.shortDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{sponsor.shortDescription}</p>
        )}
        {sponsor.overlapTopicLabels.length > 0 && (
          <div className="flex items-start gap-1 pt-0.5">
            <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" style={acColor} />
            <p className="text-xs text-primary font-medium leading-snug" style={acColor}>
              Relevant to your interests: {sponsor.overlapTopicLabels.join(", ")}
            </p>
          </div>
        )}
        {sponsor.websiteUrl && (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            style={acColor}
          >
            <ExternalLink className="h-3 w-3" /> View Profile
          </a>
        )}
      </div>
      {hasActions && (
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          {sponsor.onsiteMeetingEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 bg-foreground text-background hover:bg-foreground/90"
              onClick={onScheduleOnsite}
              data-testid={`button-home-onsite-${sponsor.id}`}
            >
              <Calendar className="h-3.5 w-3.5" /> Schedule Onsite Meeting
            </button>
          )}
          {sponsor.onlineMeetingEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-semibold border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              onClick={onScheduleOnline}
              data-testid={`button-home-online-${sponsor.id}`}
            >
              <Video className="h-3.5 w-3.5" /> Online Meeting
            </button>
          )}
          {sponsor.informationRequestEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-[0.98] flex items-center justify-center"
              onClick={onRequestInfo}
              data-testid={`button-home-info-${sponsor.id}`}
            >
              Request Information
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dashboard ──────────────────────────────────────────────────────────────────

function Dashboard({
  me, topics, selections, sessions, savedSessionIds,
  onEditInterests, onSaveSession, onUnsaveSession, isSavingSession,
  invitationCount, registrationUrl, websiteUrl, meetingsScheduledCount, accentColor, headers,
}: {
  me: AttendeeMe; topics: Topic[]; selections: TopicSelection[];
  sessions: RecommendedSession[];
  savedSessionIds: Set<string>;
  onEditInterests: () => void;
  onSaveSession: (id: string) => void; onUnsaveSession: (id: string) => void;
  isSavingSession: boolean;
  invitationCount: number;
  registrationUrl: string | null;
  websiteUrl: string | null;
  meetingsScheduledCount: number;
  accentColor: string | null;
  headers: Record<string, string>;
}) {
  const topicMap = new Map(topics.map((t) => [t.id, t]));
  const selectedTopics = selections.map((s) => topicMap.get(s.topicId)).filter(Boolean) as Topic[];
  const [detailSession, setDetailSession] = useState<AgendaSessionDetail | null>(null);
  const [schedulerModal, setSchedulerModal] = useState<{ sponsorId: string; sponsorName: string; mode: "onsite" | "online" } | null>(null);
  const [requestInfoSponsor, setRequestInfoSponsor] = useState<{ id: string; name: string } | null>(null);

  const recommendedSponsorsQuery = useQuery<RecommendedSponsor[]>({
    queryKey: ["/api/attendee-portal/recommended-sponsors"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sponsors", { headers }).then((r) => r.json()),
    enabled: true,
  });
  const recommendedSponsors = recommendedSponsorsQuery.data ?? [];

  const hasInterests = selections.length > 0;
  const teamUrl = registrationUrl || websiteUrl;
  const ac = accentColor;
  const acBg  = ac ? { backgroundColor: `${ac}18` } : undefined;
  const acBgXl = ac ? { backgroundColor: `${ac}0D` } : undefined;
  const acColor = ac ? { color: ac } : undefined;
  const acBannerBg = ac ? { backgroundColor: `${ac}0D`, borderColor: `${ac}35` } : undefined;
  const acBarBg = ac ? { backgroundColor: `${ac}45` } : undefined;

  const parseDateOnly = (d: string | null) => {
    if (!d) return null;
    const part = d.split("T")[0];
    const [y, mo, day] = part.split("-").map(Number);
    return new Date(y, mo - 1, day);
  };
  const fmtDateShort = (d: string | null) => {
    const dt = parseDateOnly(d);
    if (!dt) return null;
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };
  const startStr = fmtDateShort(me.event.startDate);
  const endStr = fmtDateShort(me.event.endDate);
  const eventDateStr = startStr && endStr && startStr !== endStr ? `${startStr} – ${endStr}` : (startStr ?? null);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">

      {/* ── Event Header Card ───────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-2xl p-5 shadow-sm flex items-center gap-5" data-testid="section-event-hero">
        {/* Event Logo */}
        {me.event.logoUrl ? (
          <img
            src={me.event.logoUrl}
            alt={me.event.name}
            className="h-[84px] w-[84px] rounded-xl object-contain border border-border/40 bg-white shrink-0 p-1.5"
            data-testid="img-event-logo"
          />
        ) : (
          <div
            className="h-[84px] w-[84px] rounded-xl shrink-0 flex items-center justify-center border border-border/40"
            style={acBg ?? { backgroundColor: "hsl(var(--primary) / 0.08)" }}
          >
            <Hexagon className="h-9 w-9 text-primary" style={acColor} />
          </div>
        )}

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          {me.onboarding.isDone && (
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-green-50 border border-green-200 text-green-700 text-xs font-medium mb-2 dark:bg-green-950/30 dark:border-green-800 dark:text-green-400" data-testid="badge-setup-complete">
              <CheckCircle2 className="h-3.5 w-3.5" /> Setup Complete
            </div>
          )}
          <h1 className="font-display font-bold text-xl text-foreground leading-tight mb-2" data-testid="text-event-name">
            {me.event.name}
          </h1>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {eventDateStr && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" /> {eventDateStr}
              </span>
            )}
            {me.event.location && (
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-3.5 w-3.5 shrink-0" /> {me.event.location}
              </span>
            )}
            {me.event.websiteUrl && (
              <a
                href={me.event.websiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm font-medium hover:underline transition-colors"
                style={acColor ?? { color: "hsl(var(--primary))" }}
                data-testid="link-event-website"
              >
                <ExternalLink className="h-3.5 w-3.5 shrink-0" /> Event Website
              </a>
            )}
          </div>
        </div>
      </div>

      {/* ── Greeting + Stats ────────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-2xl px-5 py-4 shadow-sm">
        <p className="text-sm text-muted-foreground mb-4" data-testid="text-greeting">
          Welcome back, <span className="font-semibold text-foreground">{me.attendee.firstName || me.attendee.name}</span>.{" "}
          Your personalised event dashboard is ready.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { value: savedSessionIds.size, label: "Sessions Saved", testId: "stat-sessions-saved" },
            { value: meetingsScheduledCount, label: "Meetings Scheduled", testId: "stat-meetings-scheduled" },
          ].map(({ value, label, testId }) => (
            <div key={label} className="bg-background border border-border/60 rounded-xl p-3 text-center" data-testid={testId}>
              <p className="text-2xl font-display font-bold text-primary leading-none mb-1" style={acColor}>{value}</p>
              <p className="text-[11px] text-muted-foreground leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Meeting Invitation Banner ──────────────────────────────────── */}
      {invitationCount > 0 && (
        <Link href="/attendee/meetings">
          <div className="flex items-center gap-3 bg-primary/5 border border-primary/20 rounded-2xl px-5 py-4 cursor-pointer hover:bg-primary/10 transition-colors" style={acBannerBg} data-testid="banner-meeting-invitations">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0" style={acBg}>
              <Bell className="h-5 w-5 text-primary" style={acColor} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {invitationCount} Meeting Invitation{invitationCount !== 1 ? "s" : ""}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Tap to review and respond to your pending invitations
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </div>
        </Link>
      )}

      {/* ── Action Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="section-action-cards">

        {/* Build Your Agenda */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center" style={acBg}>
            <CalendarDays className="h-5 w-5 text-primary" style={acColor} />
          </div>
          <p className="font-semibold text-foreground text-sm">Build Your Agenda</p>
          <Link href="/attendee/agenda">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium" data-testid="button-build-agenda">
              Browse Sessions <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Discover Sponsors */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center" style={acBg}>
            <Building2 className="h-5 w-5 text-primary" style={acColor} />
          </div>
          <p className="font-semibold text-foreground text-sm">Meet Relevant Sponsors</p>
          <Link href="/attendee/sponsors">
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium" data-testid="button-discover-sponsors">
              View Sponsors <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        {/* Bring a Team */}
        <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3" data-testid="section-bring-a-team">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center" style={acBg}>
            <Users className="h-5 w-5 text-primary" style={acColor} />
          </div>
          <p className="font-semibold text-foreground text-sm">Bring a Team</p>
          {teamUrl ? (
            <a href={teamUrl} target="_blank" rel="noopener noreferrer" data-testid="link-bring-a-team">
              <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium" data-testid="button-register-team-member">
                Register a Colleague <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </a>
          ) : (
            <Button variant="outline" size="sm" className="w-full gap-1.5 text-xs font-medium" disabled data-testid="button-register-team-member">
              Register a Colleague <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* ── Recommended Sponsors ──────────────────────────────────────── */}
      {(recommendedSponsorsQuery.isLoading || recommendedSponsors.length > 0) && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" style={acColor} /> Recommended for You
            </h2>
            <Link href="/attendee/sponsors">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="link-view-all-sponsors">
                All Sponsors <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
          {recommendedSponsorsQuery.isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="home-recommended-sponsors-grid">
              {recommendedSponsors.map((sponsor) => (
                <HomeSponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  accentColor={ac}
                  onScheduleOnsite={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "onsite" })}
                  onScheduleOnline={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "online" })}
                  onRequestInfo={() => setRequestInfoSponsor({ id: sponsor.id, name: sponsor.name })}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Recommended Sessions ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" style={acColor} /> Recommended Sessions
          </h2>
          <Link href="/attendee/agenda">
            <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="link-view-full-agenda">
              Full Agenda <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        {sessions.length === 0 ? (
          <div className="bg-card border border-border/60 rounded-2xl p-8 text-center space-y-2">
            <CalendarDays className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            {!hasInterests ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/attendee/interests"><span className="text-primary underline cursor-pointer">Select your interests</span></Link> to unlock personalised session recommendations.
              </p>
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
                <div key={session.id} className="bg-card border border-border/60 rounded-2xl p-5 hover:border-border transition-colors" data-testid={`card-session-${session.id}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-1 self-stretch rounded-full bg-primary/25 shrink-0 mt-0.5" style={acBarBg} />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      {(session.isFeatured || session.sessionTypeLabel) && (
                        <div className="flex items-center gap-2 flex-wrap">
                          {session.isFeatured && (
                            <Badge variant="secondary" className="rounded-full text-[10px] px-2 py-0 h-4.5 font-semibold">
                              <Star className="h-2.5 w-2.5 mr-1 fill-current" />Featured
                            </Badge>
                          )}
                          {session.sessionTypeLabel && (
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{session.sessionTypeLabel}</span>
                          )}
                        </div>
                      )}
                      <button
                        className="font-semibold text-foreground text-sm leading-snug text-left hover:text-primary transition-colors"
                        onClick={() => setDetailSession(session as AgendaSessionDetail)}
                      >
                        {session.title}
                      </button>
                      {(session.sessionDate || session.locationName) && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-0.5">
                          {session.sessionDate && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(session.sessionDate)}{session.startTime ? ` · ${formatTimeRange(session.startTime, session.endTime)}` : ""}
                            </span>
                          )}
                          {session.locationName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{session.locationName}
                            </span>
                          )}
                        </div>
                      )}
                      <RelevanceLabel labels={session.overlapTopicLabels} />
                    </div>
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      size="sm"
                      className="h-8 px-3 text-xs gap-1.5 shrink-0 font-medium"
                      data-testid={`button-save-session-${session.id}`}
                      disabled={isSavingSession}
                      onClick={() => saved ? onUnsaveSession(session.id) : onSaveSession(session.id)}
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${saved ? "fill-current" : ""}`} />
                      {saved ? "Saved" : "Save"}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
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

      {/* Meeting scheduler */}
      {schedulerModal && (
        <MeetingSchedulerDialog
          open={!!schedulerModal}
          onClose={() => setSchedulerModal(null)}
          sponsorId={schedulerModal.sponsorId}
          sponsorName={schedulerModal.sponsorName}
          mode={schedulerModal.mode}
          me={me}
          headers={headers}
          onSuccess={() => setSchedulerModal(null)}
        />
      )}

      {/* Request information */}
      {requestInfoSponsor && (
        <RequestInfoModal
          open={!!requestInfoSponsor}
          onClose={() => setRequestInfoSponsor(null)}
          onSuccess={() => setRequestInfoSponsor(null)}
          sponsorId={requestInfoSponsor.id}
          sponsorName={requestInfoSponsor.name}
          eventId={me.event.id}
          prefill={{
            email: me.attendee.email,
            firstName: me.attendee.firstName,
            lastName: me.attendee.lastName,
            company: me.attendee.company,
            title: me.attendee.title,
          }}
        />
      )}

    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type OnboardingStep = "welcome" | "topics" | "edit-topics" | "sessions" | "sponsors" | "ready" | null;

export default function AttendeePortalPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [onboardingStep, setOnboardingStep] = useState<OnboardingStep>(null);
  const [wizardDetailSession, setWizardDetailSession] = useState<RecommendedSession | null>(null);

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

  // Enable post-onboarding queries during wizard steps 2-4 AND when onboarding is done
  // Also enable when arriving from an email CTA (?source=email) — always treat as post-onboarding
  const fromEmailEarly = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "email";
  const isPostOnboarding = !!(meQuery.data?.onboarding.isDone) || fromEmailEarly ||
    (["sessions", "sponsors", "ready"].includes(onboardingStep ?? ""));

  const sessionsQuery = useQuery<RecommendedSession[]>({
    queryKey: ["/api/attendee-portal/recommended-sessions"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sessions", { headers }).then((r) => r.json()),
    enabled: isPostOnboarding,
  });

  const sponsorsQuery = useQuery<RecommendedSponsor[]>({
    queryKey: ["/api/attendee-portal/recommended-sponsors"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sponsors", { headers }).then((r) => r.json()),
    enabled: isPostOnboarding,
  });

  const savedQuery = useQuery<{ savedId: string; id: string }[]>({
    queryKey: ["/api/attendee-portal/saved-sessions"],
    queryFn: () => fetch("/api/attendee-portal/saved-sessions", { headers }).then((r) => r.json()),
    enabled: isPostOnboarding,
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
    enabled: isPostOnboarding,
  });

  const meetingsQuery = useQuery<{ id: string; status: string; source: string }[]>({
    queryKey: ["/api/attendee-portal/meetings"],
    queryFn: () => fetch("/api/attendee-portal/meetings", { headers }).then((r) => r.json()),
    enabled: isPostOnboarding,
  });

  const [actingOnSponsor, setActingOnSponsor] = useState<string | null>(null);

  const requestMeetingMutation = useMutation({
    mutationFn: ({ id, mode }: { id: string; mode?: "onsite" | "online" }) =>
      fetch("/api/attendee-portal/request-meeting", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId: id, requestType: mode }),
      }).then((r) => r.json()),
    onMutate: ({ id }) => setActingOnSponsor(id),
    onSettled: () => setActingOnSponsor(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/suggested-meetings"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sponsors"] });
      toast({ title: "Meeting request sent", description: "We'll connect you with this sponsor." });
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-info", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (id) => setActingOnSponsor(id),
    onSettled: () => setActingOnSponsor(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      toast({ title: "Information requested", description: "This sponsor will be in touch with more details." });
    },
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
      // Wizard flow: advance to sessions card. Edit mode: return to dashboard.
      setOnboardingStep((curr) => curr === "topics" ? "sessions" : null);
    },
  });

  const skipMutation = useMutation({
    mutationFn: () =>
      fetch("/api/attendee-portal/skip-onboarding", { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: "{}" }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/me"] });
      // Skip from wizard: advance to sessions (weaker recs, but still guided). Skip from edit: return to dashboard.
      setOnboardingStep((curr) => curr === "topics" ? "sessions" : null);
    },
  });

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  if (meQuery.isError || !meQuery.data) {
    return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Session expired. Please use your access link again.</p></div>;
  }

  const me = meQuery.data;
  // Secondary safety: if the user arrived via an email CTA link (?source=email),
  // treat onboarding as done so they always land on the dashboard
  const fromEmail = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("source") === "email";
  const onboardingIsDone = me.onboarding.isDone || fromEmail;
  const showOnboarding: OnboardingStep = onboardingStep !== null ? onboardingStep : (!onboardingIsDone ? "welcome" : null);

  const topics = topicsQuery.data ?? [];
  const selections = selectionsQuery.data ?? [];
  const sessions = sessionsQuery.data ?? [];
  const sponsors = sponsorsQuery.data ?? [];
  const savedSessionIds = new Set((savedQuery.data ?? []).map((s) => s.id));
  const interactions = interactionsQuery.data ?? { meetings: {}, infoRequests: {} };
  const invitationCount = (meetingsQuery.data ?? []).filter((m) => m.source === "admin" && m.status === "Scheduled").length;
  const meetingsScheduledCount = (meetingsQuery.data ?? []).filter((m) => m.status === "Scheduled").length;
  const isSavingSession = saveSessionMutation.isPending || unsaveSessionMutation.isPending;

  // ── Wizard Card 2: session detail sheet ───────────────────────────────────
  const wizardSessionSheet = wizardDetailSession && (
    <SessionDetailSheet
      session={wizardDetailSession as AgendaSessionDetail}
      isSaved={savedSessionIds.has(wizardDetailSession.id)}
      onClose={() => setWizardDetailSession(null)}
      onSave={() => saveSessionMutation.mutate(wizardDetailSession.id)}
      onUnsave={() => unsaveSessionMutation.mutate(wizardDetailSession.id)}
      isSaving={isSavingSession}
    />
  );

  // ── Render wizard steps ────────────────────────────────────────────────────

  if (showOnboarding === "welcome") {
    return <WelcomeStep me={me} onStart={() => setOnboardingStep("topics")} onSkip={() => skipMutation.mutate()} isSkipping={skipMutation.isPending} />;
  }

  if (showOnboarding === "topics") {
    return (
      <TopicsCard
        topics={topics}
        currentSelections={selections.map((s) => s.topicId)}
        onSave={(ids) => saveTopicsMutation.mutate(ids)}
        onSkip={() => skipMutation.mutate()}
        isSaving={saveTopicsMutation.isPending}
        isSkipping={skipMutation.isPending}
      />
    );
  }

  if (showOnboarding === "sessions") {
    return (
      <>
        <SessionsCard
          sessions={sessions}
          savedSessionIds={savedSessionIds}
          onSave={(id) => saveSessionMutation.mutate(id)}
          onUnsave={(id) => unsaveSessionMutation.mutate(id)}
          isSaving={isSavingSession}
          onContinue={() => setOnboardingStep("sponsors")}
          onViewSession={(s) => setWizardDetailSession(s)}
        />
        {wizardSessionSheet}
      </>
    );
  }

  if (showOnboarding === "sponsors") {
    return (
      <SponsorsCard
        sponsors={sponsors}
        sponsorInteractions={interactions}
        onRequestMeeting={(id) => requestMeetingMutation.mutate({ id })}
        onRequestInfo={(id) => requestInfoMutation.mutate(id)}
        isActingOnSponsor={actingOnSponsor}
        onContinue={() => setOnboardingStep("ready")}
      />
    );
  }

  if (showOnboarding === "ready") {
    return (
      <ReadyCard
        me={me}
        selections={selections}
        topics={topics}
        sessionCount={sessions.length}
        sponsorCount={sponsors.length}
        onDone={() => setOnboardingStep(null)}
      />
    );
  }

  if (showOnboarding === "edit-topics") {
    return (
      <EditTopicsCard
        topics={topics}
        currentSelections={selections.map((s) => s.topicId)}
        onSave={(ids) => saveTopicsMutation.mutate(ids)}
        onCancel={() => setOnboardingStep(null)}
        isSaving={saveTopicsMutation.isPending}
      />
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────

  const ac = me.event.buttonColor || me.event.accentColor || null;
  return (
    <AttendeeShell onLogout={logout} attendeeName={me.attendee.firstName || me.attendee.name} accentColor={ac}>
      <Dashboard
        me={me}
        topics={topics}
        selections={selections}
        sessions={sessions}
        savedSessionIds={savedSessionIds}
        onEditInterests={() => setOnboardingStep("edit-topics")}
        onSaveSession={(id) => saveSessionMutation.mutate(id)}
        onUnsaveSession={(id) => unsaveSessionMutation.mutate(id)}
        isSavingSession={isSavingSession}
        invitationCount={invitationCount}
        headers={headers}
        registrationUrl={me.event.registrationUrl}
        websiteUrl={me.event.websiteUrl}
        meetingsScheduledCount={meetingsScheduledCount}
        accentColor={me.event.buttonColor || me.event.accentColor || null}
      />
    </AttendeeShell>
  );
}
