import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CheckCircle, ChevronRight, ChevronLeft, Mail, Calendar, Building2,
  Bookmark, BookmarkCheck, Info, Users, Laptop, MapPin, Sparkles, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgendaSession, EventInterestTopic, Sponsor, EventSponsorLink } from "@shared/schema";

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = "topics" | "email" | "sessions" | "sponsors" | "complete";

interface PendingState {
  profileId: string;
  step: WizardStep;
  topicIds: string[];
  sessionIds: string[];
  meetingRequests: { sponsorId: string; requestType: string }[];
  email: string;
  matchedToken: string | null;
}

interface PublicEvent {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  venue: string | null;
  logoUrl: string | null;
}

interface SponsorWithTopics extends Sponsor {
  topicIds: string[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ["topics", "email", "sessions", "sponsors", "complete"];
const STEP_LABELS = ["Interests", "Your Email", "Sessions", "Sponsors", "Complete"];

function storageKey(slug: string) {
  return `pending_concierge_${slug}`;
}

function loadFromStorage(slug: string): Partial<PendingState> | null {
  try {
    const raw = localStorage.getItem(storageKey(slug));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveToStorage(slug: string, state: Partial<PendingState>) {
  try {
    const existing = loadFromStorage(slug) ?? {};
    localStorage.setItem(storageKey(slug), JSON.stringify({ ...existing, ...state }));
  } catch {}
}

function getSponsorLevel(sponsor: Sponsor, eventId: string): string {
  const ae = (sponsor.assignedEvents ?? []).find((e: EventSponsorLink) => e.eventId === eventId);
  return (ae?.sponsorshipLevel && ae.sponsorshipLevel !== "None") ? ae.sponsorshipLevel : "";
}

const LEVEL_ORDER: Record<string, number> = { Platinum: 4, Gold: 3, Silver: 2, Bronze: 1 };
const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700 border-slate-300",
  Gold: "bg-amber-50 text-amber-700 border-amber-300",
  Silver: "bg-gray-100 text-gray-600 border-gray-300",
  Bronze: "bg-orange-50 text-orange-700 border-orange-300",
};

function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${m.toString().padStart(2, "0")} ${ampm}`;
}

// ── API helpers ───────────────────────────────────────────────────────────────

async function apiPost(url: string, body?: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

async function apiPatch(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${res.status}`);
  return res.json();
}

// ── Step Progress Bar ─────────────────────────────────────────────────────────

function StepBar({ step }: { step: WizardStep }) {
  const idx = STEP_ORDER.indexOf(step);
  return (
    <div className="flex items-start gap-1.5 mb-8">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-1.5">
          <div
            className={cn(
              "h-1.5 w-full rounded-full transition-all duration-500",
              i < idx ? "bg-blue-600" : i === idx ? "bg-blue-500" : "bg-gray-200"
            )}
          />
          <span className={cn(
            "text-[10px] font-semibold hidden sm:block tracking-wide",
            i < idx ? "text-blue-500" : i === idx ? "text-blue-700" : "text-gray-400"
          )}>
            {STEP_LABELS[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Card 1: Topics ────────────────────────────────────────────────────────────

function TopicsCard({
  event,
  topics,
  selected,
  onChange,
  onNext,
  loading,
}: {
  event: PublicEvent | undefined;
  topics: EventInterestTopic[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onNext: () => void;
  loading: boolean;
}) {
  function toggle(id: string) {
    if (selected.includes(id)) {
      onChange(selected.filter((x) => x !== id));
    } else {
      onChange([...selected, id]);
    }
  }

  const active = topics.filter((t) => t.isActive && t.status === "APPROVED")
    .sort((a, b) => a.displayOrder - b.displayOrder);

  return (
    <div className="space-y-8">
      {/* Registration Confirmed banner */}
      <div className="text-center space-y-4 pb-6 border-b border-gray-100">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-full">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500" />
          </span>
          <span className="text-sm font-semibold text-green-700">Registration Confirmed</span>
        </div>

        {event && (
          <div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">You're registered for</p>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 leading-tight">{event.name}</h1>
            {event.venue && (
              <p className="mt-1 text-sm text-gray-500 flex items-center justify-center gap-1">
                <MapPin className="w-3.5 h-3.5" />{event.venue}
              </p>
            )}
          </div>
        )}

        <p className="text-sm text-gray-600 max-w-lg mx-auto">
          Now let's personalise your event experience in about 60 seconds.
        </p>
      </div>

      {/* Next Steps framing */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
        <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-3">What happens next</p>
        <ol className="space-y-2">
          {[
            "Tell us which topics interest you",
            "We'll show you recommended sessions",
            "We'll suggest sponsors worth meeting",
            "We'll send you your personalised event plan",
          ].map((step, i) => (
            <li key={i} className="flex items-start gap-2.5 text-sm text-blue-900">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold mt-0.5">
                {i + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>

      {/* Topic selection */}
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">What topics interest you?</h2>
          <p className="mt-1 text-sm text-gray-500">
            Select the topics most relevant to you so Concierge can personalise your sessions, sponsors, and meeting suggestions.
          </p>
        </div>

        {active.length === 0 ? (
          <p className="text-gray-400 text-sm italic">No topics available yet — we'll show all sessions and sponsors.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {active.map((t) => {
              const on = selected.includes(t.id);
              return (
                <button
                  key={t.id}
                  data-testid={`topic-chip-${t.id}`}
                  onClick={() => toggle(t.id)}
                  className={cn(
                    "px-3.5 py-2 rounded-full text-sm font-medium border transition-all duration-150",
                    on
                      ? "bg-blue-600 border-blue-600 text-white shadow-sm scale-[1.02]"
                      : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50"
                  )}
                >
                  {on && <CheckCircle className="inline-block w-3.5 h-3.5 mr-1.5 -mt-0.5" />}
                  {t.topicLabel}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        data-testid="button-topics-next"
        onClick={onNext}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
      >
        {loading ? "Saving…" : selected.length > 0 ? `Personalise My Experience (${selected.length} topic${selected.length !== 1 ? "s" : ""} selected)` : "Continue Without Topics"}
        {!loading && <ChevronRight className="w-4 h-4" />}
      </button>
    </div>
  );
}

// ── Card 2: Email + Match Preview ─────────────────────────────────────────────

function EmailCard({
  profileId,
  allSessions,
  onNext,
  onBack,
  loading,
  setEmail,
  email,
}: {
  profileId: string;
  allSessions: AgendaSession[];
  onNext: (email: string, matched: boolean, token: string | null) => void;
  onBack: () => void;
  loading: boolean;
  setEmail: (e: string) => void;
  email: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const preview = allSessions.filter((s) => s.status === "Published" && s.isPublic).slice(0, 3);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError("Please enter a valid email address."); return; }
    setError("");
    setSubmitting(true);
    try {
      const data = await apiPatch(`/api/public/pending/${profileId}/email`, { email: email.trim() });
      onNext(email.trim(), !!data.matched, data.token ?? null);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">A glimpse of what awaits you</h2>
        <p className="mt-1 text-gray-500 text-sm">Based on your interests — you'll customise your full agenda on the next step.</p>
      </div>

      {preview.length > 0 && (
        <div className="space-y-2">
          {preview.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-3.5 rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors">
              <Calendar className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.sessionDate ? new Date(s.sessionDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                  {s.startTime ? ` · ${formatTime(s.startTime)}` : ""}
                  {s.locationName ? ` · ${s.locationName}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t border-gray-100 pt-6">
        <h3 className="text-base font-bold text-gray-900 mb-1">Save your personalised plan</h3>
        <p className="text-sm text-gray-500 mb-4">
          Enter your registration email so we can match your selections to your account and send you your personalised agenda.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="input-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="your@email.com"
              className="w-full pl-10 pr-4 py-3.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoComplete="email"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            data-testid="button-email-submit"
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3.5 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
          >
            {submitting ? "Saving…" : "Save & Build My Agenda"}
            {!submitting && <ChevronRight className="w-4 h-4" />}
          </button>
        </form>
      </div>

      <button
        data-testid="button-back-topics"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mx-auto"
      >
        <ChevronLeft className="w-4 h-4" /> Back to Interests
      </button>
    </div>
  );
}

// ── Card 3: Sessions ──────────────────────────────────────────────────────────

function SessionsCard({
  sessions,
  savedIds,
  onToggle,
  onNext,
  onBack,
  loading,
}: {
  sessions: AgendaSession[];
  savedIds: string[];
  onToggle: (id: string, saved: boolean) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const published = sessions.filter((s) => s.status === "Published" && s.isPublic);

  const byDate: Record<string, AgendaSession[]> = {};
  for (const s of published) {
    (byDate[s.sessionDate] ??= []).push(s);
  }
  const dates = Object.keys(byDate).sort();

  async function handleToggle(id: string) {
    const isSaved = savedIds.includes(id);
    setToggling((p) => ({ ...p, [id]: true }));
    try {
      await onToggle(id, isSaved);
    } finally {
      setToggling((p) => ({ ...p, [id]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Build your agenda</h2>
        <p className="mt-1 text-gray-500 text-sm">Bookmark the sessions you want to attend. You can always update your selections later.</p>
      </div>

      {savedIds.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg">
          <BookmarkCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
          <p className="text-xs font-semibold text-blue-700">{savedIds.length} session{savedIds.length !== 1 ? "s" : ""} saved to your agenda</p>
        </div>
      )}

      {published.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">No sessions published yet — check back soon.</p>
      ) : (
        <div className="space-y-6 max-h-[460px] overflow-y-auto pr-1 -mr-1">
          {dates.map((date) => (
            <div key={date}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 sticky top-0 bg-white py-1">
                {new Date(date + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
              </p>
              <div className="space-y-2">
                {(byDate[date] ?? []).sort((a, b) => a.startTime.localeCompare(b.startTime)).map((s) => {
                  const saved = savedIds.includes(s.id);
                  const busy = toggling[s.id];
                  return (
                    <div
                      key={s.id}
                      data-testid={`session-card-${s.id}`}
                      onClick={() => !busy && handleToggle(s.id)}
                      className={cn(
                        "flex items-start gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-150",
                        saved
                          ? "border-blue-200 bg-blue-50 shadow-sm"
                          : "border-gray-100 bg-white hover:border-blue-200 hover:bg-blue-50/40"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-snug">{s.title}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          {s.locationName ? ` · ${s.locationName}` : ""}
                        </p>
                      </div>
                      <div
                        className={cn(
                          "flex-shrink-0 p-1.5 rounded-lg transition-all mt-0.5",
                          saved ? "text-blue-600 bg-blue-100" : "text-gray-300",
                          busy && "opacity-40"
                        )}
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

      <div className="flex gap-3 pt-1">
        <button
          data-testid="button-back-email"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          data-testid="button-sessions-next"
          onClick={onNext}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
        >
          {loading ? "Saving…" : "Continue to Sponsors"}
          {!loading && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Card 4: Sponsors ──────────────────────────────────────────────────────────

function SponsorsCard({
  eventId,
  eventSlug,
  attendeeEmail,
  sponsors,
  allTopics,
  selectedTopicIds,
  meetingRequests,
  onSchedule,
  onInfoRequest,
  onNext,
  onBack,
  loading,
}: {
  eventId: string;
  eventSlug: string;
  attendeeEmail: string;
  sponsors: SponsorWithTopics[];
  allTopics: EventInterestTopic[];
  selectedTopicIds: string[];
  meetingRequests: { sponsorId: string; requestType: string }[];
  onSchedule: (sponsorId: string, mode: "onsite" | "online") => void;
  onInfoRequest: (sponsorId: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [infoBusy, setInfoBusy] = useState<Record<string, boolean>>({});

  // Build topic label map
  const topicMap = new Map<string, string>(allTopics.map((t) => [t.id, t.topicLabel]));
  const attendeeTopicSet = new Set(selectedTopicIds);

  const sorted = [...sponsors].sort((a, b) => {
    const la = LEVEL_ORDER[getSponsorLevel(a, eventId)] ?? 0;
    const lb = LEVEL_ORDER[getSponsorLevel(b, eventId)] ?? 0;
    const ra = (a.topicIds ?? []).filter((t) => attendeeTopicSet.has(t)).length;
    const rb = (b.topicIds ?? []).filter((t) => attendeeTopicSet.has(t)).length;
    return lb - la || rb - ra;
  });

  function scheduledMode(sponsorId: string): "onsite" | "online" | null {
    const r = meetingRequests.find((r) => r.sponsorId === sponsorId && (r.requestType === "onsite" || r.requestType === "online" || r.requestType === "meeting"));
    if (!r) return null;
    return r.requestType === "online" ? "online" : "onsite";
  }

  function hasInfoRequest(sponsorId: string) {
    return meetingRequests.some((r) => r.sponsorId === sponsorId && r.requestType === "info");
  }

  async function handleInfo(sponsorId: string) {
    if (infoBusy[sponsorId]) return;
    setInfoBusy((p) => ({ ...p, [sponsorId]: true }));
    try {
      await onInfoRequest(sponsorId);
    } finally {
      setInfoBusy((p) => ({ ...p, [sponsorId]: false }));
    }
  }

  function buildScheduleUrl(sponsorId: string, mode: "onsite" | "online") {
    const base = `/event/${eventSlug}?sponsor=${sponsorId}&mode=${mode}`;
    return attendeeEmail ? `${base}&prefillEmail=${encodeURIComponent(attendeeEmail)}` : base;
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Sponsors You May Want to Meet</h2>
        <p className="mt-1 text-gray-500 text-sm">
          Choose a sponsor and schedule a meeting directly.
        </p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-8 text-center">No sponsors to show yet.</p>
      ) : (
        <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 -mr-1">
          {sorted.map((s) => {
            const level = getSponsorLevel(s, eventId);
            const levelColor = LEVEL_COLORS[level] ?? "";

            // Matching topics
            const matchingTopics = (s.topicIds ?? [])
              .filter((tid) => attendeeTopicSet.has(tid))
              .map((tid) => topicMap.get(tid))
              .filter(Boolean) as string[];

            // Meeting states
            const booked = scheduledMode(s.id);
            const infoDone = hasInfoRequest(s.id);
            const supportsOnline = !!s.allowOnlineMeetings;

            return (
              <div
                key={s.id}
                data-testid={`sponsor-card-${s.id}`}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  matchingTopics.length > 0 ? "border-blue-100 bg-blue-50/30" : "border-gray-100 bg-white hover:border-gray-200"
                )}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="w-11 h-11 object-contain rounded-lg border border-gray-100 bg-white p-0.5 flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 mb-0.5">
                      <p className="text-sm font-bold text-gray-900">{s.name}</p>
                      {level && (
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full border font-semibold flex-shrink-0", levelColor)}>
                          {level}
                        </span>
                      )}
                    </div>
                    {s.shortDescription && (
                      <p className="text-xs text-gray-500 line-clamp-2">{s.shortDescription}</p>
                    )}
                  </div>
                </div>

                {/* Topic relevance */}
                {matchingTopics.length > 0 && (
                  <div className="flex items-start gap-1.5 mb-3 p-2 bg-blue-50 rounded-lg border border-blue-100">
                    <Sparkles className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700">
                      <span className="font-semibold">Relevant to your interests: </span>
                      {matchingTopics.join(", ")}
                    </p>
                  </div>
                )}

                {/* Meeting CTAs */}
                <div className="space-y-2">
                  {booked ? (
                    /* ── Already initiated scheduling ── */
                    <div className="flex items-center gap-2 py-2.5 px-3 rounded-lg bg-green-50 border border-green-200 text-green-700 text-xs font-semibold">
                      <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        {booked === "online" ? "Online" : "Onsite"} Meeting Scheduling Opened
                      </span>
                      <a
                        href={buildScheduleUrl(s.id, booked)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-auto flex items-center gap-1 text-green-600 hover:text-green-800 underline underline-offset-2"
                        data-testid={`link-sponsor-reschedule-${s.id}`}
                      >
                        Open again <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : (
                    /* ── Primary scheduling actions ── */
                    <div className={cn("grid gap-2", supportsOnline ? "grid-cols-2" : "grid-cols-1")}>
                      {/* Onsite Meeting */}
                      <a
                        href={buildScheduleUrl(s.id, "onsite")}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={`button-sponsor-onsite-${s.id}`}
                        onClick={() => onSchedule(s.id, "onsite")}
                        className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border bg-blue-600 border-blue-600 text-white hover:bg-blue-700 transition-all"
                      >
                        <MapPin className="w-3.5 h-3.5" /> Schedule Onsite Meeting
                        <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                      </a>

                      {/* Online Meeting */}
                      {supportsOnline && (
                        <a
                          href={buildScheduleUrl(s.id, "online")}
                          target="_blank"
                          rel="noopener noreferrer"
                          data-testid={`button-sponsor-online-${s.id}`}
                          onClick={() => onSchedule(s.id, "online")}
                          className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-semibold border bg-white border-blue-400 text-blue-700 hover:bg-blue-50 transition-all"
                        >
                          <Laptop className="w-3.5 h-3.5" /> Schedule Online Meeting
                          <ExternalLink className="w-3 h-3 opacity-60 ml-0.5" />
                        </a>
                      )}
                    </div>
                  )}

                  {/* Secondary: Request Information */}
                  <button
                    data-testid={`button-sponsor-info-${s.id}`}
                    onClick={() => handleInfo(s.id)}
                    disabled={infoDone || !!infoBusy[s.id]}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-all",
                      infoDone
                        ? "bg-gray-50 border-gray-200 text-gray-500"
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:text-gray-800 disabled:opacity-50"
                    )}
                  >
                    {infoDone
                      ? <><CheckCircle className="w-3.5 h-3.5" /> Information Requested</>
                      : infoBusy[s.id] ? "…"
                        : <><Info className="w-3.5 h-3.5" /> Request Information</>
                    }
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          data-testid="button-back-sessions"
          onClick={onBack}
          className="flex items-center gap-1.5 px-4 py-3 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          data-testid="button-sponsors-next"
          onClick={onNext}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60 shadow-sm"
        >
          {loading ? "Finishing…" : "Complete My Setup"}
          {!loading && <CheckCircle className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Card 5: Complete ──────────────────────────────────────────────────────────

function CompleteCard({
  email,
  sessionCount,
  meetingCount,
  eventName,
}: {
  email: string;
  sessionCount: number;
  meetingCount: number;
  eventName: string;
}) {
  return (
    <div className="text-center space-y-7 py-4">
      <div className="mx-auto w-20 h-20 bg-green-100 rounded-full flex items-center justify-center ring-8 ring-green-50">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
        <p className="mt-2 text-gray-500 text-sm max-w-sm mx-auto">
          Your personalised plan for <span className="font-semibold text-gray-700">{eventName}</span> has been saved.
        </p>
      </div>

      {(sessionCount > 0 || meetingCount > 0) && (
        <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
          {sessionCount > 0 && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-3xl font-bold text-blue-600">{sessionCount}</p>
              <p className="text-xs text-blue-700 mt-1 font-medium">Session{sessionCount !== 1 ? "s" : ""} saved</p>
            </div>
          )}
          {meetingCount > 0 && (
            <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
              <p className="text-3xl font-bold text-purple-600">{meetingCount}</p>
              <p className="text-xs text-purple-700 mt-1 font-medium">Sponsor{meetingCount !== 1 ? "s" : ""} contacted</p>
            </div>
          )}
        </div>
      )}

      {email && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 max-w-sm mx-auto text-left">
          <div className="flex items-start gap-2">
            <Mail className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <p>
              We'll send your personalised agenda to <span className="font-semibold">{email}</span> once your registration is confirmed.
            </p>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 max-w-sm mx-auto leading-relaxed">
        Your selections are linked to your registration. Return to this page any time to update your agenda or add more sponsor meetings.
      </p>
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
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/topics`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: sessions = [] } = useQuery<AgendaSession[]>({
    queryKey: ["/api/public/welcome", slug, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/sessions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
  });

  const { data: sponsors = [] } = useQuery<SponsorWithTopics[]>({
    queryKey: ["/api/public/welcome", slug, "sponsors"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/sponsors`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
  });

  // Initialise: check localStorage for existing profile
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
            setMeetingRequests(
              data.meetingRequests?.map((r: any) => ({ sponsorId: r.sponsorId, requestType: r.requestType }))
              ?? stored.meetingRequests ?? []
            );
            setEmail(stored.email ?? "");
            setMatchedToken(stored.matchedToken ?? null);
            const apiStep = data.profile?.onboardingStep as WizardStep | undefined;
            setStep(apiStep === "complete" || apiStep === "sponsors" || apiStep === "sessions" || apiStep === "email" || apiStep === "topics" ? apiStep : stored.step ?? "topics");
            setInitialising(false);
            return;
          }
        }
        const data = await apiPost(`/api/public/welcome/${slug}/start`);
        setProfileId(data.profileId);
        saveToStorage(slug, { profileId: data.profileId, step: "topics" });
      } catch (e) {
        console.error("[welcome] init error", e);
      } finally {
        setInitialising(false);
      }
    })();
  }, [slug]);

  useEffect(() => {
    if (!slug || !profileId) return;
    saveToStorage(slug, { profileId, step, topicIds, sessionIds, meetingRequests, email, matchedToken });
  }, [slug, profileId, step, topicIds, sessionIds, meetingRequests, email, matchedToken]);

  // ── Handlers ────────────────────────────────────────────────────────────────

  async function handleTopicsNext() {
    if (!profileId) return;
    setActionLoading(true);
    try {
      await apiPatch(`/api/public/pending/${profileId}/topics`, { topicIds });
    } catch (e) {
      console.error("[welcome] topics save error", e);
    } finally {
      setActionLoading(false);
      setStep("email");
    }
  }

  async function handleEmailNext(submittedEmail: string, matched: boolean, token: string | null) {
    setEmail(submittedEmail);
    setMatchedToken(token);
    setStep("sessions");
  }

  async function handleSessionToggle(sessionId: string, isSaved: boolean) {
    if (!profileId) return;
    await apiPatch(`/api/public/pending/${profileId}/sessions`, { sessionId, action: isSaved ? "remove" : "add" });
    if (isSaved) {
      setSessionIds((p) => p.filter((x) => x !== sessionId));
    } else {
      setSessionIds((p) => [...p, sessionId]);
    }
  }

  function handleSchedule(sponsorId: string, mode: "onsite" | "online") {
    // Mark locally so the card shows "Scheduling Opened" state; no API call needed
    // (the real meeting is created on the EventPage via /api/meetings)
    setMeetingRequests((p) => [...p, { sponsorId, requestType: mode }]);
  }

  async function handleInfoRequest(sponsorId: string) {
    if (!profileId) return;
    await apiPost(`/api/public/pending/${profileId}/meeting-request`, { sponsorId, requestType: "info" });
    setMeetingRequests((p) => [...p, { sponsorId, requestType: "info" }]);
  }

  async function handleSponsorsNext() {
    if (!profileId) return;
    setActionLoading(true);
    try {
      await apiPost(`/api/public/pending/${profileId}/complete`);
    } catch (e) {
      console.error("[welcome] complete error", e);
    } finally {
      setActionLoading(false);
      setStep("complete");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  if (initialising) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Setting up your experience…</p>
        </div>
      </div>
    );
  }

  // Unique sponsor contacts for complete card
  const uniqueSponsorContacts = new Set(meetingRequests.map((r) => r.sponsorId)).size;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        {/* Logo only (event name shown inside Card 1) */}
        {event?.logoUrl && step === "topics" && (
          <div className="text-center mb-6">
            <img src={event.logoUrl} alt={event.name} className="h-10 object-contain mx-auto" />
          </div>
        )}

        {/* Compact event header on steps 2–4 */}
        {event && step !== "topics" && step !== "complete" && (
          <div className="text-center mb-6">
            {event.logoUrl && <img src={event.logoUrl} alt={event.name} className="h-8 object-contain mx-auto mb-2" />}
            <p className="text-sm font-semibold text-gray-700">{event.name}</p>
          </div>
        )}

        {/* Wizard card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-10">
          {step !== "complete" && <StepBar step={step} />}

          {step === "topics" && (
            <TopicsCard
              event={event}
              topics={topics}
              selected={topicIds}
              onChange={setTopicIds}
              onNext={handleTopicsNext}
              loading={actionLoading}
            />
          )}

          {step === "email" && (
            <EmailCard
              profileId={profileId ?? ""}
              allSessions={sessions}
              onNext={handleEmailNext}
              onBack={() => setStep("topics")}
              loading={actionLoading}
              email={email}
              setEmail={setEmail}
            />
          )}

          {step === "sessions" && (
            <SessionsCard
              sessions={sessions}
              savedIds={sessionIds}
              onToggle={handleSessionToggle}
              onNext={() => setStep("sponsors")}
              onBack={() => setStep("email")}
              loading={actionLoading}
            />
          )}

          {step === "sponsors" && event && (
            <SponsorsCard
              eventId={event.id}
              eventSlug={slug ?? ""}
              attendeeEmail={email}
              sponsors={sponsors}
              allTopics={topics}
              selectedTopicIds={topicIds}
              meetingRequests={meetingRequests}
              onSchedule={handleSchedule}
              onInfoRequest={handleInfoRequest}
              onNext={handleSponsorsNext}
              onBack={() => setStep("sessions")}
              loading={actionLoading}
            />
          )}

          {step === "complete" && (
            <CompleteCard
              email={email}
              sessionCount={sessionIds.length}
              meetingCount={uniqueSponsorContacts}
              eventName={event?.name ?? "the event"}
            />
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Powered by Converge Concierge · Your data is never shared without your consent.
        </p>
      </div>
    </div>
  );
}
