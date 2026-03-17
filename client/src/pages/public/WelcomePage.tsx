import { useState, useEffect } from "react";
import { useParams } from "wouter";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  CheckCircle, ChevronRight, ChevronLeft, Mail, Calendar, Building2,
  Bookmark, BookmarkCheck, Info, MapPin, Sparkles, ExternalLink,
  Video, Gem, Hexagon, CheckCircle2, Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AgendaSession, EventInterestTopic, Sponsor, EventSponsorLink, AppBranding } from "@shared/schema";
import { RequestInfoModal } from "@/components/RequestInfoModal";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import PublicFooter from "@/components/PublicFooter";

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = "topics" | "email" | "sessions" | "sponsors" | "complete";

interface PublicEvent {
  id: string;
  name: string;
  slug: string;
  startDate: string;
  endDate: string;
  location: string | null;
  venue: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  accentColor: string | null;
  buttonColor: string | null;
}

interface SponsorWithTopics extends Sponsor {
  topicIds: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ["topics", "email", "sessions", "sponsors", "complete"];
const STEP_LABELS = ["Interests", "Your Matches", "Sessions", "Sponsors", "Complete"];

// ── Sponsor level helpers (same source-of-truth as EventPage) ─────────────────

const LEVEL_ORDER: Record<string, number> = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };

const levelBorder: Record<string, string> = {
  Platinum: "border-slate-500 bg-slate-50",
  Gold:     "border-amber-300 bg-amber-50/40",
  Silver:   "border-gray-300 bg-gray-50",
  Bronze:   "border-orange-300 bg-orange-50",
};
const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-800 text-white",
  Gold:     "bg-amber-100 text-amber-900",
  Silver:   "bg-gray-100 text-gray-600",
  Bronze:   "bg-orange-100 text-orange-700",
};
const levelAccent: Record<string, string> = {
  Platinum: "bg-slate-800 hover:bg-slate-900 text-white",
  Gold:     "bg-amber-600 hover:bg-amber-700 text-white",
  Silver:   "bg-gray-500 hover:bg-gray-600 text-white",
  Bronze:   "bg-orange-600 hover:bg-orange-700 text-white",
};
const levelAccentSecondary: Record<string, string> = {
  Platinum: "border-slate-400 text-slate-700 bg-slate-50/60 hover:bg-slate-100",
  Gold:     "border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100",
  Silver:   "border-gray-300 text-gray-600 bg-gray-50/60 hover:bg-gray-100",
  Bronze:   "border-orange-300 text-orange-700 bg-orange-50/60 hover:bg-orange-100",
};

function getSponsorEventLevel(sponsor: Sponsor, eventId: string): string {
  const link = (sponsor.assignedEvents ?? []).find(
    (ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active"
  );
  return link?.sponsorshipLevel ?? "";
}

function getSponsorEventLink(sponsor: Sponsor, eventId: string): EventSponsorLink | undefined {
  return (sponsor.assignedEvents ?? []).find(
    (ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active"
  );
}

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function storageKey(slug: string) { return `pending_concierge_${slug}`; }

function loadFromStorage(slug: string): Record<string, any> | null {
  try { const raw = localStorage.getItem(storageKey(slug)); return raw ? JSON.parse(raw) : null; }
  catch { return null; }
}

function saveToStorage(slug: string, state: Record<string, any>) {
  try { const existing = loadFromStorage(slug) ?? {}; localStorage.setItem(storageKey(slug), JSON.stringify({ ...existing, ...state })); }
  catch {}
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPatch(url: string, body: unknown) {
  const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Shell (mirrors EventPage's Shell exactly) ─────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  const { data: branding } = useQuery<AppBranding>({ queryKey: ["/api/branding-public"] });
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {branding?.appLogoUrl ? (
            <img src={branding.appLogoUrl} alt={branding.appName || "Converge Concierge"} className="h-8 max-w-[140px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-5 w-5" />
            </div>
          )}
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            {branding?.appName || "Converge Concierge"}
          </span>
        </Link>
      </header>
      <main className="flex-1 relative z-10 pb-20">{children}</main>
      <PublicFooter />
    </div>
  );
}

// ── Event Hero Card (matches EventPage step-0 hero exactly) ──────────────────

function EventHero({ event, step }: { event: PublicEvent; step: WizardStep }) {
  const badgeConfig: Record<WizardStep, { label: string; className: string; icon: React.ReactNode }> = {
    topics:    { label: "Registration Confirmed", className: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> },
    email:     { label: "Personalising Your Experience", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <Sparkles className="h-4 w-4 flex-shrink-0" /> },
    sessions:  { label: "Build Your Agenda", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <Calendar className="h-4 w-4 flex-shrink-0" /> },
    sponsors:  { label: "Sponsor Recommendations", className: "bg-blue-50 text-blue-700 border-blue-200", icon: <Users className="h-4 w-4 flex-shrink-0" /> },
    complete:  { label: "Setup Complete", className: "bg-green-50 text-green-700 border-green-200", icon: <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> },
  };
  const badge = badgeConfig[step];

  return (
    <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden mb-5">
      <div className="px-5 py-5 sm:py-6 flex items-center gap-6 sm:gap-8">
        {event.logoUrl ? (
          <div className="flex-shrink-0 bg-white rounded-lg p-3 border border-border/60 shadow-sm">
            <img src={event.logoUrl} alt={event.name} className="h-28 sm:h-32 max-w-[260px] object-contain" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
          </div>
        ) : (
          <div className="flex-shrink-0 h-20 w-20 rounded-xl bg-muted flex items-center justify-center">
            <Building2 className="h-8 w-8 text-muted-foreground/40" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className={cn("inline-flex items-center gap-2 border text-sm font-semibold px-4 py-1.5 rounded-full mb-3", badge.className)}>
            {badge.icon}
            {badge.label}
          </div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight mb-2">
            {event.name}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 text-accent" />
              {format(parseISO(event.startDate as unknown as string), "MMMM d")}
              {" – "}
              {format(parseISO(event.endDate as unknown as string), "MMMM d, yyyy")}
            </span>
            {(event.location ?? event.venue) && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                {event.location ?? event.venue}
              </span>
            )}
            {event.websiteUrl && (
              <a href={event.websiteUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-accent hover:opacity-80 transition-opacity font-medium">
                <ExternalLink className="h-3.5 w-3.5" /> Event Website
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function StepBar({ step, accentColor }: { step: WizardStep; accentColor?: string | null }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-start gap-1.5 mb-5">
      {STEP_ORDER.map((s, i) => {
        const isDone = i < idx;
        const isActive = i === idx;
        const barStyle = accentColor
          ? { backgroundColor: isDone ? accentColor : isActive ? accentColor + "99" : undefined }
          : undefined;
        return (
          <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
            <div
              className={cn("h-1.5 w-full rounded-full transition-all duration-500",
                accentColor ? (isDone || isActive ? "" : "bg-border") :
                  isDone ? "bg-accent" : isActive ? "bg-accent/70" : "bg-border"
              )}
              style={barStyle}
            />
            <span
              className={cn("text-[10px] font-semibold hidden sm:block tracking-wide",
                isDone ? "text-accent" : isActive ? "text-foreground" : "text-muted-foreground"
              )}
              style={accentColor && isDone ? { color: accentColor } : undefined}
            >
              {STEP_LABELS[i]}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Card 1: Topics ────────────────────────────────────────────────────────────

function TopicsCard({ topics, selected, onChange, onNext, loading, accentColor }: {
  topics: EventInterestTopic[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
  loading: boolean;
  accentColor?: string | null;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  const active = topics.filter((t) => t.isActive && t.status === "APPROVED").sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
          What topics interest you?
        </h2>
        <p className="text-muted-foreground text-sm">
          Select all that apply — we'll use these to recommend sessions and sponsors tailored to you.
        </p>
      </div>

      {active.length === 0 ? (
        <p className="text-muted-foreground text-sm italic">No topics configured for this event yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2 mb-8">
          {active.map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                data-testid={`topic-chip-${t.id}`}
                onClick={() => toggle(t.id)}
                className={cn(
                  "px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150 active:scale-[0.97]",
                  on ? "text-white shadow-sm" : "bg-card text-foreground/70 border-border hover:text-foreground"
                )}
                style={on ? { backgroundColor: accentColor || undefined, borderColor: accentColor || undefined } : undefined}
              >
                {on && <CheckCircle className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
                {t.topicLabel}
              </button>
            );
          })}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">What happens next</p>
        <ol className="space-y-1.5">
          {["We'll recommend sessions and sponsors based on your interests", "You save sessions to your personal agenda", "You choose which sponsors you'd like to meet", "We send your personalised event plan to your email"].map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">{i + 1}</span>
              {s}
            </li>
          ))}
        </ol>
      </div>

      <Button
        onClick={onNext}
        disabled={loading}
        className="w-full gap-2"
        size="lg"
        data-testid="button-topics-next"
        style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
      >
        {loading ? "Saving…" : selected.length > 0 ? `Continue with ${selected.length} topic${selected.length !== 1 ? "s" : ""} selected` : "Continue Without Topics"}
        {!loading && <ChevronRight className="w-4 h-4" />}
      </Button>
    </div>
  );
}

// ── Card 2: Email (Your Matches) ──────────────────────────────────────────────

function EmailCard({ profileId, allSessions, sponsors, selectedTopicIds, onNext, onBack, loading, setEmail, email, accentColor }: {
  profileId: string;
  allSessions: AgendaSession[];
  sponsors: SponsorWithTopics[];
  selectedTopicIds: string[];
  onNext: (email: string, matched: boolean, token: string | null) => void;
  onBack: () => void;
  loading: boolean;
  setEmail: (e: string) => void;
  email: string;
  accentColor?: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const topicSet = new Set(selectedTopicIds);
  const publishedSessions = allSessions.filter((s) => s.status === "Published" && s.isPublic);
  // Use real topic-matched count from the topicIds now included on each session
  const matchedSessionCount = selectedTopicIds.length > 0
    ? publishedSessions.filter((s) => ((s as any).topicIds ?? []).some((t: string) => topicSet.has(t))).length
    : publishedSessions.length;
  const matchedSponsorCount = selectedTopicIds.length > 0
    ? sponsors.filter((s) => (s.topicIds ?? []).some((t) => topicSet.has(t))).length
    : sponsors.length;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    setError(""); setSubmitting(true);
    try {
      const data = await apiPatch(`/api/public/pending/${profileId}/email`, { email: email.trim() });
      onNext(email.trim(), !!data.matched, data.token ?? null);
    } catch { setError("Something went wrong. Please try again."); }
    finally { setSubmitting(false); }
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
          Great news — we found your matches!
        </h2>
        <p className="text-muted-foreground text-sm">
          Based on your selections, Concierge has curated sessions and sponsors just for you.
        </p>
      </div>

      {/* Match count teaser */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="rounded-xl border-2 border-border/60 bg-muted/20 p-4 text-center">
          <p className="text-3xl font-bold text-foreground" style={accentColor ? { color: accentColor } : undefined}>
            {matchedSessionCount}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-wider">
            Session{matchedSessionCount !== 1 ? "s" : ""} available
          </p>
        </div>
        <div className="rounded-xl border-2 border-border/60 bg-muted/20 p-4 text-center">
          <p className="text-3xl font-bold text-foreground" style={accentColor ? { color: accentColor } : undefined}>
            {matchedSponsorCount}
          </p>
          <p className="text-xs font-semibold text-muted-foreground mt-1 uppercase tracking-wider">
            Sponsor{matchedSponsorCount !== 1 ? "s" : ""} matched
          </p>
        </div>
      </div>

      <div className="bg-muted/30 border border-border/40 rounded-xl p-4 mb-6 text-sm text-muted-foreground flex items-start gap-2">
        <Sparkles className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" style={accentColor ? { color: accentColor } : undefined} />
        <span>Enter your registration email to save your personalised Concierge plan and receive your recommendations.</span>
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            data-testid="input-email"
            type="email"
            value={email}
            onChange={(e) => { setEmail(e.target.value); setError(""); }}
            placeholder="your@email.com"
            className="w-full pl-10 pr-4 py-3 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent bg-background"
            autoComplete="email"
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button
          type="submit"
          disabled={submitting || loading}
          className="w-full gap-2"
          size="lg"
          data-testid="button-email-submit"
          style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
        >
          {submitting ? "Saving…" : "Continue to My Recommendations"}
          {!submitting && <ChevronRight className="w-4 h-4" />}
        </Button>
      </form>

      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mt-5 mx-auto" data-testid="button-back-topics">
        <ChevronLeft className="w-4 h-4" /> Back to Interests
      </button>
    </div>
  );
}

// ── Card 3: Sessions ──────────────────────────────────────────────────────────

function SessionsCard({ sessions, selectedTopicIds, allTopics, savedIds, onToggle, onNext, onBack, loading, accentColor }: {
  sessions: AgendaSession[];
  selectedTopicIds: string[];
  allTopics: EventInterestTopic[];
  savedIds: string[];
  onToggle: (id: string, saved: boolean) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  accentColor?: string | null;
}) {
  const [toggling, setToggling] = useState<Record<string, boolean>>({});

  const topicSet = new Set(selectedTopicIds);
  const topicLabelMap = new Map(allTopics.map((t) => [t.id, t.topicLabel]));
  const published = sessions.filter((s) => s.status === "Published" && s.isPublic);

  // Filter to sessions with at least one topic overlap; use topicIds injected by the server
  const recommended = selectedTopicIds.length > 0
    ? published
        .map((s) => {
          const sTopicIds: string[] = (s as any).topicIds ?? [];
          const matchedTopics = sTopicIds.filter((t) => topicSet.has(t));
          return { session: s, matchedTopics, score: matchedTopics.length };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score)
    : published.map((s) => ({ session: s, matchedTopics: [] as string[], score: 0 }));

  const hasTopics = selectedTopicIds.length > 0;
  const hasMatches = recommended.length > 0;
  // When topics were selected but nothing matched, show a graceful empty state
  const noMatchState = hasTopics && !hasMatches;

  const displayItems = recommended;
  const byDate: Record<string, typeof recommended> = {};
  for (const item of displayItems) {
    (byDate[item.session.sessionDate] ??= []).push(item);
  }
  const dates = Object.keys(byDate).sort();

  async function handleToggle(id: string) {
    const isSaved = savedIds.includes(id);
    setToggling((p) => ({ ...p, [id]: true }));
    try { await onToggle(id, isSaved); }
    finally { setToggling((p) => ({ ...p, [id]: false })); }
  }

  return (
    <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-6 sm:p-8">
      <div className="flex items-start justify-between mb-2">
        <div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-foreground mb-1">
            {hasTopics ? "Your Recommended Sessions" : "Sessions"}
          </h2>
          <p className="text-muted-foreground text-sm">
            {hasTopics
              ? "Based on your interests, we recommend these sessions. All of our sessions are great — but you shouldn't miss these."
              : "Bookmark sessions to add them to your personalised event plan."}
          </p>
        </div>
        {savedIds.length > 0 && (
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ml-4 shrink-0"
            style={accentColor ? { backgroundColor: `${accentColor}15`, color: accentColor } : { backgroundColor: "hsl(var(--accent)/0.1)", color: "hsl(var(--accent))" }}
          >
            <BookmarkCheck className="w-3.5 h-3.5" /> {savedIds.length} saved
          </div>
        )}
      </div>

      {hasTopics && hasMatches && (
        <div className="flex items-center gap-1.5 mb-4 px-3 py-2 rounded-lg bg-muted/30 border border-border/40 w-fit">
          <Sparkles className="w-3.5 h-3.5 flex-shrink-0" style={accentColor ? { color: accentColor } : undefined} />
          <span className="text-xs text-muted-foreground font-medium">
            {displayItems.length} session{displayItems.length !== 1 ? "s" : ""} matched to your interests
          </span>
        </div>
      )}

      {noMatchState ? (
        <div className="py-10 text-center space-y-3">
          <Sparkles className="h-10 w-10 mx-auto opacity-20" />
          <p className="text-sm font-semibold text-foreground">We are still refining recommendations for your selected topics.</p>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Browse the full agenda to explore more sessions — all published sessions are available below.
          </p>
          <div className="space-y-2 text-left mt-4">
            {published.slice(0, 5).map((s) => (
              <div key={s.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/60 bg-muted/20">
                <Calendar className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground leading-snug">{s.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(s.startTime)}–{formatTime(s.endTime)}{s.locationName ? ` · ${s.locationName}` : ""}</p>
                </div>
              </div>
            ))}
            {published.length > 5 && <p className="text-xs text-muted-foreground text-center pt-1">+ {published.length - 5} more sessions</p>}
          </div>
        </div>
      ) : displayItems.length === 0 ? (
        <p className="text-sm text-muted-foreground italic py-8 text-center">No sessions published yet — check back soon.</p>
      ) : (
        <div className="space-y-6 max-h-[520px] overflow-y-auto pr-1 -mr-1 mb-6 mt-3">
          {dates.map((date) => (
            <div key={date}>
              <p className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-3 sticky top-0 bg-white py-1">
                {format(parseISO(date), "EEEE, MMMM d")}
              </p>
              <div className="space-y-2">
                {(byDate[date] ?? []).sort((a, b) => a.session.startTime.localeCompare(b.session.startTime)).map(({ session: s, matchedTopics }) => {
                  const saved = savedIds.includes(s.id);
                  const busy = toggling[s.id];
                  const matchedLabels = matchedTopics.map((tid) => topicLabelMap.get(tid)).filter(Boolean) as string[];
                  return (
                    <div
                      key={s.id}
                      data-testid={`session-card-${s.id}`}
                      onClick={() => !busy && handleToggle(s.id)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150",
                        saved ? "border-accent/30 bg-accent/5 shadow-sm" : "border-border/60 bg-card hover:border-accent/30 hover:bg-accent/5"
                      )}
                      style={saved && accentColor ? { borderColor: `${accentColor}50`, backgroundColor: `${accentColor}08` } : undefined}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground leading-snug">{s.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          {s.locationName ? ` · ${s.locationName}` : ""}
                        </p>
                        {matchedLabels.length > 0 && (
                          <p className="text-[10px] mt-1.5 flex items-center gap-1 font-medium" style={accentColor ? { color: accentColor } : { color: "hsl(var(--accent))" }}>
                            <Sparkles className="w-2.5 h-2.5 flex-shrink-0" />
                            Relevant to: {matchedLabels.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </div>
                      <div
                        className={cn("flex-shrink-0 p-1.5 rounded-lg transition-all mt-0.5", !accentColor && (saved ? "text-accent bg-accent/10" : "text-muted-foreground/40"), busy && "opacity-40")}
                        style={accentColor && saved ? { color: accentColor, backgroundColor: `${accentColor}18` } : accentColor && !saved ? { color: "#9ca3af" } : undefined}
                      >
                        {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3 mt-2">
        <Button variant="outline" onClick={onBack} className="gap-1.5" data-testid="button-back-email">
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button
          onClick={onNext}
          disabled={loading}
          className="flex-1 gap-2"
          size="lg"
          data-testid="button-sessions-next"
          style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
        >
          {loading ? "Saving…" : "Continue to Sponsors"}
          {!loading && <ChevronRight className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
}

// ── Card 4: Sponsors ──────────────────────────────────────────────────────────

function SponsorsCard({ eventId, eventSlug, attendeeEmail, sponsors, allTopics, selectedTopicIds, meetingRequests, infoRequestedIds, onSchedule, onInfoRequested, onNext, onBack, loading, accentColor }: {
  eventId: string;
  eventSlug: string;
  attendeeEmail: string;
  sponsors: SponsorWithTopics[];
  allTopics: EventInterestTopic[];
  selectedTopicIds: string[];
  meetingRequests: { sponsorId: string; requestType: string }[];
  infoRequestedIds: string[];
  onSchedule: (sponsorId: string, mode: "onsite" | "online") => void;
  onInfoRequested: (sponsorId: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
  accentColor?: string | null;
}) {
  const [requestInfoSponsor, setRequestInfoSponsor] = useState<SponsorWithTopics | null>(null);
  const [schedulingModal, setSchedulingModal] = useState<{ sponsor: SponsorWithTopics; mode: "onsite" | "online" } | null>(null);

  function openScheduling(s: SponsorWithTopics, mode: "onsite" | "online") {
    onSchedule(s.id, mode);
    setSchedulingModal({ sponsor: s, mode });
  }

  const topicMap = new Map<string, string>(allTopics.map((t) => [t.id, t.topicLabel]));
  const attendeeTopicSet = new Set(selectedTopicIds);
  const infoRequestedSet = new Set(infoRequestedIds);

  const sorted = [...sponsors].sort((a, b) => {
    const la = LEVEL_ORDER[getSponsorEventLevel(a, eventId)] ?? 0;
    const lb = LEVEL_ORDER[getSponsorEventLevel(b, eventId)] ?? 0;
    const ra = (a.topicIds ?? []).filter((t) => attendeeTopicSet.has(t)).length;
    const rb = (b.topicIds ?? []).filter((t) => attendeeTopicSet.has(t)).length;
    return lb - la || rb - ra;
  });

  function wasOnsiteScheduled(sponsorId: string) {
    return meetingRequests.some((r) => r.sponsorId === sponsorId && r.requestType === "onsite");
  }
  function wasOnlineScheduled(sponsorId: string) {
    return meetingRequests.some((r) => r.sponsorId === sponsorId && r.requestType === "online");
  }

  function buildScheduleUrl(sponsorId: string, mode: "onsite" | "online") {
    const base = `/event/${eventSlug}?sponsor=${sponsorId}&mode=${mode}`;
    return attendeeEmail ? `${base}&prefillEmail=${encodeURIComponent(attendeeEmail)}` : base;
  }

  return (
    <>
      <div>
        <div className="flex items-end justify-between mb-2">
          <div>
            <h2 className="text-xl font-display font-semibold text-foreground">
              {attendeeTopicSet.size > 0 ? "Sponsors Matching Your Interests" : "Sponsors Available for Meetings"}
            </h2>
          </div>
          {sorted.length > 0 && (
            <span className="text-xs text-muted-foreground shrink-0 ml-3">
              {sorted.length} sponsor{sorted.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
            <Building2 className="h-12 w-12 opacity-20" />
            <p className="text-sm">No sponsors are available for this event yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-6">
            {sorted.map((s) => {
              const level = getSponsorEventLevel(s, eventId);
              const link = getSponsorEventLink(s, eventId);
              const onsiteEnabled = link?.onsiteMeetingEnabled ?? true;
              const onlineEnabled = link?.onlineMeetingEnabled ?? s.allowOnlineMeetings ?? false;
              const infoEnabled   = link?.informationRequestEnabled ?? true;
              const matchingTopics = (s.topicIds ?? []).filter((tid) => attendeeTopicSet.has(tid)).map((tid) => topicMap.get(tid)).filter(Boolean) as string[];

              return (
                <div
                  key={s.id}
                  data-testid={`sponsor-card-${s.id}`}
                  className={cn(
                    "flex flex-col rounded-xl border-2 shadow-sm overflow-hidden",
                    "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                    level && levelBorder[level] ? levelBorder[level] : "border-border bg-card",
                  )}
                >
                  <div className="flex-1 p-3">
                    {/* Logo + badge */}
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="h-8 flex items-center shrink-0">
                        {s.logoUrl ? (
                          <img src={s.logoUrl} alt={s.name} className="h-8 max-w-[90px] object-contain" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-white border border-black/10 shadow-sm flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      {level && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 inline-flex items-center gap-0.5", levelBadge[level] || "bg-muted text-muted-foreground")}>
                          {level === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                          {level}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-display font-bold text-foreground leading-tight mb-1">{s.name}</h3>
                    {s.shortDescription && (
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-1">{s.shortDescription}</p>
                    )}
                    {/* Topic relevance */}
                    {matchingTopics.length > 0 && (
                      <div className="flex items-center gap-1 mb-1">
                        <Sparkles className="h-3 w-3 text-accent flex-shrink-0" />
                        <p className="text-[10px] text-accent font-medium truncate">{matchingTopics.slice(0, 2).join(", ")}</p>
                      </div>
                    )}
                    <Link
                      href={`/event/${eventSlug}/sponsor/${s.id}`}
                      className="text-[11px] text-accent hover:opacity-80 transition-opacity flex items-center gap-1"
                      data-testid={`link-sponsor-profile-${s.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> View Profile
                    </Link>
                  </div>

                  {/* Action buttons — always visible, with ✓ status indicators */}
                  <div className="px-3 pb-3 space-y-1.5">
                    {onsiteEnabled && (
                      <button
                        data-testid={`button-sponsor-onsite-${s.id}`}
                        onClick={() => openScheduling(s, "onsite")}
                        className={cn(
                          "w-full py-1.5 rounded-lg text-xs font-semibold transition-all duration-150 active:scale-[0.98] flex items-center justify-between px-3",
                          levelAccent[level] || "bg-primary hover:bg-primary/90 text-white",
                        )}
                      >
                        <span>Schedule Onsite Meeting</span>
                        {wasOnsiteScheduled(s.id) && (
                          <span className="flex items-center gap-0.5 opacity-90 text-[10px] font-bold ml-2 shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Requested
                          </span>
                        )}
                      </button>
                    )}
                    {onlineEnabled && (
                      <button
                        data-testid={`button-sponsor-online-${s.id}`}
                        onClick={() => openScheduling(s, "online")}
                        className={cn(
                          "w-full py-1 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-[0.98] flex items-center justify-between px-3",
                          levelAccentSecondary[level] || "border-border text-muted-foreground bg-muted/50 hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-1.5"><Video className="h-3 w-3" /> Online Meeting</span>
                        {wasOnlineScheduled(s.id) && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold ml-2 shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Requested
                          </span>
                        )}
                      </button>
                    )}
                    {infoEnabled && (
                      <button
                        onClick={() => setRequestInfoSponsor(s)}
                        data-testid={`button-sponsor-info-${s.id}`}
                        className="w-full py-1 rounded-lg text-xs font-medium border border-border/60 text-muted-foreground bg-transparent hover:bg-muted/50 transition-all duration-150 active:scale-[0.98] flex items-center justify-between px-3"
                      >
                        <span>Request Information</span>
                        {infoRequestedSet.has(s.id) && (
                          <span className="flex items-center gap-0.5 text-[10px] font-bold text-green-600 ml-2 shrink-0">
                            <CheckCircle2 className="h-3 w-3" /> Sent
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="gap-1.5" data-testid="button-back-sessions">
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button
            onClick={onNext}
            disabled={loading}
            className="flex-1 gap-2"
            size="lg"
            data-testid="button-sponsors-next"
            style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
          >
            {loading ? "Finishing…" : "Complete My Setup"}
            {!loading && <CheckCircle className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <RequestInfoModal
        open={!!requestInfoSponsor}
        onClose={() => setRequestInfoSponsor(null)}
        onSuccess={() => { if (requestInfoSponsor) onInfoRequested(requestInfoSponsor.id); }}
        sponsorId={requestInfoSponsor?.id ?? ""}
        sponsorName={requestInfoSponsor?.name ?? ""}
        eventId={eventId}
        prefill={{ email: attendeeEmail || undefined }}
      />

      <Dialog open={!!schedulingModal} onOpenChange={(o) => !o && setSchedulingModal(null)}>
        <DialogContent className="max-w-5xl w-full h-[90vh] p-0 gap-0 overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/60 bg-muted/30 shrink-0">
            {schedulingModal?.mode === "online" ? <Video className="w-4 h-4 text-accent" /> : <MapPin className="w-4 h-4 text-accent" />}
            <span className="text-sm font-semibold text-foreground">
              {schedulingModal?.mode === "online" ? "Online Meeting" : "Schedule Onsite Meeting"}
              {schedulingModal && <span className="font-normal text-muted-foreground ml-1">· {schedulingModal.sponsor.name}</span>}
            </span>
          </div>
          {schedulingModal && (
            <iframe
              key={`${schedulingModal.sponsor.id}-${schedulingModal.mode}`}
              src={buildScheduleUrl(schedulingModal.sponsor.id, schedulingModal.mode)}
              className="w-full flex-1 border-0"
              style={{ height: "calc(90vh - 44px)" }}
              title="Meeting Scheduling"
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Card 5: Complete ──────────────────────────────────────────────────────────

function CompleteCard({ email, sessionCount, meetingCount, eventName, matchedToken, onStartOver, accentColor }: {
  email: string;
  sessionCount: number;
  meetingCount: number;
  eventName: string;
  matchedToken: string | null;
  onStartOver: () => void;
  accentColor?: string | null;
}) {
  const dashboardUrl = matchedToken ? `/attendee-access/${matchedToken}` : null;

  return (
    <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-8 text-center space-y-6">
      <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center ring-8 ring-green-50">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>
      <div>
        <h2 className="text-2xl font-display font-bold text-foreground">Your Concierge is ready!</h2>
        <p className="mt-2 text-muted-foreground text-sm max-w-sm mx-auto">
          Your personalised recommendations for <span className="font-semibold text-foreground">{eventName}</span> have been saved.
        </p>
      </div>
      {(sessionCount > 0 || meetingCount > 0) && (
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          {sessionCount > 0 && (
            <div className="rounded-xl p-4 border" style={accentColor ? { backgroundColor: `${accentColor}0d`, borderColor: `${accentColor}30` } : { backgroundColor: "hsl(var(--accent)/0.05)", borderColor: "hsl(var(--accent)/0.2)" }}>
              <p className="text-3xl font-bold" style={accentColor ? { color: accentColor } : { color: "hsl(var(--accent))" }}>{sessionCount}</p>
              <p className="text-xs mt-1 font-medium text-muted-foreground">Session{sessionCount !== 1 ? "s" : ""} saved</p>
            </div>
          )}
          {meetingCount > 0 && (
            <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
              <p className="text-3xl font-bold text-primary">{meetingCount}</p>
              <p className="text-xs text-primary/80 mt-1 font-medium">Sponsor{meetingCount !== 1 ? "s" : ""} contacted</p>
            </div>
          )}
        </div>
      )}
      {email && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 max-w-sm mx-auto text-left">
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>We'll email your recommendations to <span className="font-semibold">{email}</span> so you can revisit them any time.</p>
          </div>
        </div>
      )}
      <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
        Your recommendations are saved to your registration. Return any time to review sessions, revisit sponsors, or book meetings.
      </p>

      {/* Action buttons */}
      <div className="flex flex-col gap-3 max-w-xs mx-auto w-full pt-2">
        {dashboardUrl && (
          <Link href={dashboardUrl}>
            <Button
              className="w-full gap-2"
              size="lg"
              data-testid="button-complete-dashboard"
              style={accentColor ? { backgroundColor: accentColor, borderColor: accentColor } : undefined}
            >
              See Your Dashboard
              <ChevronRight className="w-4 h-4" />
            </Button>
          </Link>
        )}
        <Button
          variant="outline"
          className="w-full gap-2"
          size="lg"
          data-testid="button-complete-startover"
          onClick={onStartOver}
        >
          Start Over
        </Button>
      </div>
    </div>
  );
}

// ── Main WelcomePage ──────────────────────────────────────────────────────────

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();

  const [step, setStep] = useState<WizardStep>("topics");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<{ sponsorId: string; requestType: string }[]>([]);
  const [infoRequestedIds, setInfoRequestedIds] = useState<string[]>([]);
  const [email, setEmail] = useState("");
  const [matchedToken, setMatchedToken] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  const { data: event } = useQuery<PublicEvent>({
    queryKey: ["/api/public/welcome", slug, "event"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/event`);
      if (!res.ok) throw new Error("Event not found");
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: topics = [] } = useQuery<EventInterestTopic[]>({
    queryKey: ["/api/public/welcome", slug, "topics"],
    queryFn: async () => { const res = await fetch(`/api/public/welcome/${slug}/topics`); if (!res.ok) return []; return res.json(); },
    enabled: !!slug,
  });

  const { data: sessions = [] } = useQuery<AgendaSession[]>({
    queryKey: ["/api/public/welcome", slug, "sessions"],
    queryFn: async () => { const res = await fetch(`/api/public/welcome/${slug}/sessions`); if (!res.ok) return []; return res.json(); },
    enabled: !!slug,
  });

  const { data: sponsors = [] } = useQuery<SponsorWithTopics[]>({
    queryKey: ["/api/public/welcome", slug, "sponsors"],
    queryFn: async () => { const res = await fetch(`/api/public/welcome/${slug}/sponsors`); if (!res.ok) return []; return res.json(); },
    enabled: !!slug,
  });

  useEffect(() => {
    if (!slug) return;
    (async () => {
      try {
        const stored = loadFromStorage(slug);
        if (stored?.profileId) {
          const res = await fetch(`/api/public/pending/${stored.profileId}`);
          if (res.ok) {
            const data = await res.json();
            setProfileId(stored.profileId);
            setTopicIds(data.topics ?? stored.topicIds ?? []);
            setSessionIds(data.sessions ?? stored.sessionIds ?? []);
            setMeetingRequests(data.meetingRequests?.map((r: any) => ({ sponsorId: r.sponsorId, requestType: r.requestType })) ?? stored.meetingRequests ?? []);
            setEmail(stored.email ?? "");
            setMatchedToken(stored.matchedToken ?? null);
            const apiStep = data.profile?.onboardingStep as WizardStep | undefined;
            setStep(["topics","email","sessions","sponsors","complete"].includes(apiStep ?? "") ? (apiStep as WizardStep) : (stored.step ?? "topics"));
            setInitialising(false);
            return;
          }
        }
        const data = await apiPost(`/api/public/welcome/${slug}/start`);
        setProfileId(data.profileId);
        saveToStorage(slug, { profileId: data.profileId, step: "topics" });
      } catch (e) { console.error("[welcome] init error", e); }
      finally { setInitialising(false); }
    })();
  }, [slug]);

  useEffect(() => {
    if (!slug || !profileId) return;
    saveToStorage(slug, { profileId, step, topicIds, sessionIds, meetingRequests, email, matchedToken });
  }, [slug, profileId, step, topicIds, sessionIds, meetingRequests, email, matchedToken]);

  async function handleTopicsNext() {
    if (!profileId) return;
    setActionLoading(true);
    try { await apiPatch(`/api/public/pending/${profileId}/topics`, { topicIds }); }
    catch (e) { console.error("[welcome] topics save error", e); }
    finally { setActionLoading(false); setStep("email"); }
  }

  async function handleEmailNext(submittedEmail: string, matched: boolean, token: string | null) {
    setEmail(submittedEmail); setMatchedToken(token); setStep("sessions");
  }

  async function handleSessionToggle(sessionId: string, isSaved: boolean) {
    if (!profileId) return;
    await apiPatch(`/api/public/pending/${profileId}/sessions`, { sessionId, action: isSaved ? "remove" : "add" });
    if (isSaved) { setSessionIds((p) => p.filter((x) => x !== sessionId)); }
    else { setSessionIds((p) => [...p, sessionId]); }
  }

  function handleSchedule(sponsorId: string, mode: "onsite" | "online") {
    setMeetingRequests((p) => [...p, { sponsorId, requestType: mode }]);
  }

  function handleInfoRequested(sponsorId: string) {
    setInfoRequestedIds((p) => p.includes(sponsorId) ? p : [...p, sponsorId]);
  }

  async function handleSponsorsNext() {
    if (!profileId) return;
    setActionLoading(true);
    try { await apiPost(`/api/public/pending/${profileId}/complete`); }
    catch (e) { console.error("[welcome] complete error", e); }
    finally { setActionLoading(false); setStep("complete"); }
  }

  function handleStartOver() {
    if (!slug) return;
    try { localStorage.removeItem(storageKey(slug)); } catch {}
    setStep("topics");
    setTopicIds([]);
    setSessionIds([]);
    setMeetingRequests([]);
    setInfoRequestedIds([]);
    setEmail("");
    setMatchedToken(null);
    // Start a fresh anonymous profile
    (async () => {
      try {
        const data = await apiPost(`/api/public/welcome/${slug}/start`);
        setProfileId(data.profileId);
        saveToStorage(slug, { profileId: data.profileId, step: "topics" });
      } catch (e) { console.error("[welcome] start-over error", e); }
    })();
  }

  if (initialising || !event) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-muted-foreground">Setting up your experience…</p>
          </div>
        </div>
      </Shell>
    );
  }

  const accentColor = event.buttonColor || event.accentColor || null;
  const uniqueSponsorContacts = new Set([...meetingRequests.map((r) => r.sponsorId), ...infoRequestedIds]).size;

  return (
    <Shell>
      <div className="w-full max-w-5xl mx-auto px-6 pt-2 pb-8">
        {/* Persistent event hero — same structure as EventPage step 0 */}
        <EventHero event={event} step={step} />

        {/* Progress bar — only on steps 1–4 */}
        {step !== "complete" && <StepBar step={step} accentColor={accentColor} />}

        {/* Step content */}
        {step === "topics" && (
          <TopicsCard topics={topics} selected={topicIds} onChange={setTopicIds} onNext={handleTopicsNext} loading={actionLoading} accentColor={accentColor} />
        )}

        {step === "email" && (
          <EmailCard
            profileId={profileId ?? ""}
            allSessions={sessions}
            sponsors={sponsors}
            selectedTopicIds={topicIds}
            onNext={handleEmailNext}
            onBack={() => setStep("topics")}
            loading={actionLoading}
            email={email}
            setEmail={setEmail}
            accentColor={accentColor}
          />
        )}

        {step === "sessions" && (
          <SessionsCard
            sessions={sessions}
            selectedTopicIds={topicIds}
            allTopics={topics}
            savedIds={sessionIds}
            onToggle={handleSessionToggle}
            onNext={() => setStep("sponsors")}
            onBack={() => setStep("email")}
            loading={actionLoading}
            accentColor={accentColor}
          />
        )}

        {step === "sponsors" && (
          <SponsorsCard
            eventId={event.id}
            eventSlug={slug ?? ""}
            attendeeEmail={email}
            sponsors={sponsors}
            allTopics={topics}
            selectedTopicIds={topicIds}
            meetingRequests={meetingRequests}
            infoRequestedIds={infoRequestedIds}
            onSchedule={handleSchedule}
            onInfoRequested={handleInfoRequested}
            onNext={handleSponsorsNext}
            onBack={() => setStep("sessions")}
            loading={actionLoading}
            accentColor={accentColor}
          />
        )}

        {step === "complete" && (
          <CompleteCard
            email={email}
            sessionCount={sessionIds.length}
            meetingCount={uniqueSponsorContacts}
            eventName={event.name}
            matchedToken={matchedToken}
            onStartOver={handleStartOver}
            accentColor={accentColor}
          />
        )}
      </div>
    </Shell>
  );
}
