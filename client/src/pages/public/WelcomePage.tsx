import { useState, useEffect, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle, ChevronRight, ChevronLeft, Mail, Calendar, Building2, Bookmark, BookmarkCheck, Info, Video, Users } from "lucide-react";
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const STEP_ORDER: WizardStep[] = ["topics", "email", "sessions", "sponsors", "complete"];
const STEP_LABELS = ["Interests", "Your Info", "Sessions", "Sponsors", "Done"];

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
    <div className="flex items-center gap-1 mb-8">
      {STEP_ORDER.map((s, i) => (
        <div key={s} className="flex-1 flex flex-col items-center gap-1">
          <div
            className={cn(
              "h-1.5 w-full rounded-full transition-all duration-300",
              i <= idx ? "bg-blue-600" : "bg-gray-200"
            )}
          />
          <span className={cn("text-[10px] font-medium hidden sm:block", i <= idx ? "text-blue-600" : "text-gray-400")}>
            {STEP_LABELS[i]}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Card 1: Topics ────────────────────────────────────────────────────────────

function TopicsCard({
  topics,
  selected,
  onChange,
  onNext,
  loading,
}: {
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

  const active = topics.filter((t) => t.isActive && t.status === "APPROVED");

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">What topics interest you?</h2>
        <p className="mt-1 text-gray-500 text-sm">Select all that apply. We'll personalise your agenda and sponsor recommendations.</p>
      </div>

      {active.length === 0 ? (
        <p className="text-gray-400 text-sm italic">No topics available yet.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {active.sort((a, b) => a.displayOrder - b.displayOrder).map((t) => {
            const on = selected.includes(t.id);
            return (
              <button
                key={t.id}
                data-testid={`topic-chip-${t.id}`}
                onClick={() => toggle(t.id)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                  on
                    ? "bg-blue-600 border-blue-600 text-white shadow-sm"
                    : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600"
                )}
              >
                {on && <CheckCircle className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" />}
                {t.topicLabel}
              </button>
            );
          })}
        </div>
      )}

      <button
        data-testid="button-topics-next"
        onClick={onNext}
        disabled={loading}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {loading ? "Saving…" : "Continue"}
        {!loading && <ChevronRight className="w-4 h-4" />}
      </button>

      {selected.length === 0 && (
        <p className="text-center text-xs text-gray-400">You can skip topic selection and browse everything.</p>
      )}
    </div>
  );
}

// ── Card 2: Email + Match Preview ─────────────────────────────────────────────

function EmailCard({
  slug,
  profileId,
  topicIds,
  allTopics,
  allSessions,
  onNext,
  onBack,
  loading,
  setEmail,
  email,
}: {
  slug: string;
  profileId: string;
  topicIds: string[];
  allTopics: EventInterestTopic[];
  allSessions: AgendaSession[];
  onNext: (email: string, matched: boolean, token: string | null) => void;
  onBack: () => void;
  loading: boolean;
  setEmail: (e: string) => void;
  email: string;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Compute recommended sessions locally from topic IDs
  const topicSet = new Set(topicIds);
  const recommended = allSessions
    .filter((s) => s.status === "Published" && s.isPublic)
    .slice(0, 3);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setError("Please enter your email."); return; }
    const emailRx = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRx.test(email.trim())) { setError("Please enter a valid email address."); return; }
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
        <h2 className="text-2xl font-bold text-gray-900">A few sessions picked for you</h2>
        <p className="mt-1 text-gray-500 text-sm">Based on your interests — you'll customise your full agenda next.</p>
      </div>

      {recommended.length > 0 && (
        <div className="space-y-2">
          {recommended.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 bg-gray-50">
              <Calendar className="w-4 h-4 mt-0.5 text-blue-500 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-gray-900">{s.title}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {s.sessionDate ? new Date(s.sessionDate).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }) : ""}
                  {s.startTime ? ` · ${formatTime(s.startTime)}` : ""}
                  {s.locationName ? ` · ${s.locationName}` : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="border-t pt-5">
        <h3 className="text-base font-semibold text-gray-900 mb-1">Save your personalised plan</h3>
        <p className="text-sm text-gray-500 mb-4">Enter your email so we can match your selections to your registration and send your personalised agenda.</p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              data-testid="input-email"
              type="email"
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(""); }}
              placeholder="your@email.com"
              className="w-full pl-9 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            data-testid="button-email-submit"
            type="submit"
            disabled={submitting || loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Continue"}
            {!submitting && <ChevronRight className="w-4 h-4" />}
          </button>
        </form>
      </div>

      <button
        data-testid="button-back-topics"
        onClick={onBack}
        className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mx-auto"
      >
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
    </div>
  );
}

// ── Card 3: Sessions ──────────────────────────────────────────────────────────

function SessionsCard({
  profileId,
  sessions,
  savedIds,
  onToggle,
  onNext,
  onBack,
  loading,
}: {
  profileId: string;
  sessions: AgendaSession[];
  savedIds: string[];
  onToggle: (id: string, saved: boolean) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [toggling, setToggling] = useState<Record<string, boolean>>({});
  const published = sessions.filter((s) => s.status === "Published" && s.isPublic);

  // Group by date
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
        <h2 className="text-2xl font-bold text-gray-900">Build your agenda</h2>
        <p className="mt-1 text-gray-500 text-sm">Bookmark the sessions you want to attend. You can always update this later.</p>
      </div>

      {published.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No sessions published yet.</p>
      ) : (
        <div className="space-y-6 max-h-[420px] overflow-y-auto pr-1">
          {dates.map((date) => (
            <div key={date}>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
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
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-all",
                        saved ? "border-blue-200 bg-blue-50" : "border-gray-100 bg-white hover:border-gray-200"
                      )}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 leading-snug">{s.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatTime(s.startTime)}–{formatTime(s.endTime)}
                          {s.locationName ? ` · ${s.locationName}` : ""}
                        </p>
                      </div>
                      <button
                        data-testid={`button-session-save-${s.id}`}
                        onClick={() => handleToggle(s.id)}
                        disabled={busy}
                        className={cn(
                          "flex-shrink-0 p-1.5 rounded-lg transition-colors",
                          saved ? "text-blue-600 bg-blue-100 hover:bg-blue-200" : "text-gray-400 hover:text-blue-500 hover:bg-blue-50",
                          busy && "opacity-40"
                        )}
                      >
                        {saved ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button
          data-testid="button-back-email"
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          data-testid="button-sessions-next"
          onClick={onNext}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? "Saving…" : "Continue"}
          {!loading && <ChevronRight className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

// ── Card 4: Sponsors ──────────────────────────────────────────────────────────

function SponsorsCard({
  eventId,
  sponsors,
  meetingRequests,
  onRequest,
  onNext,
  onBack,
  loading,
}: {
  eventId: string;
  sponsors: Sponsor[];
  meetingRequests: { sponsorId: string; requestType: string }[];
  onRequest: (sponsorId: string, requestType: string) => Promise<void>;
  onNext: () => void;
  onBack: () => void;
  loading: boolean;
}) {
  const [requesting, setRequesting] = useState<Record<string, boolean>>({});

  const sorted = [...sponsors].sort((a, b) => {
    const la = LEVEL_ORDER[getSponsorLevel(a, eventId)] ?? 0;
    const lb = LEVEL_ORDER[getSponsorLevel(b, eventId)] ?? 0;
    return lb - la;
  });

  function hasRequest(sponsorId: string, type: string) {
    return meetingRequests.some((r) => r.sponsorId === sponsorId && r.requestType === type);
  }

  async function handleRequest(sponsorId: string, requestType: string) {
    if (hasRequest(sponsorId, requestType)) return;
    setRequesting((p) => ({ ...p, [`${sponsorId}_${requestType}`]: true }));
    try {
      await onRequest(sponsorId, requestType);
    } finally {
      setRequesting((p) => ({ ...p, [`${sponsorId}_${requestType}`]: false }));
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Meet our sponsors</h2>
        <p className="mt-1 text-gray-500 text-sm">Request a meeting or more information from sponsors you'd like to connect with.</p>
      </div>

      {sorted.length === 0 ? (
        <p className="text-sm text-gray-400 italic">No sponsors available yet.</p>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {sorted.map((s) => {
            const level = getSponsorLevel(s, eventId);
            const meetingDone = hasRequest(s.id, "meeting");
            const infoDone = hasRequest(s.id, "info");
            const meetBusy = requesting[`${s.id}_meeting`];
            const infoBusy = requesting[`${s.id}_info`];
            return (
              <div
                key={s.id}
                data-testid={`sponsor-card-${s.id}`}
                className="p-4 rounded-xl border border-gray-100 bg-white hover:border-gray-200 transition-all"
              >
                <div className="flex items-start gap-3">
                  {s.logoUrl ? (
                    <img src={s.logoUrl} alt={s.name} className="w-10 h-10 object-contain rounded" />
                  ) : (
                    <div className="w-10 h-10 rounded bg-gray-100 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-gray-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.name}</p>
                      {level && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 flex-shrink-0">
                          {level}
                        </span>
                      )}
                    </div>
                    {s.shortDescription && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{s.shortDescription}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <button
                    data-testid={`button-sponsor-meeting-${s.id}`}
                    onClick={() => handleRequest(s.id, "meeting")}
                    disabled={meetingDone || !!meetBusy}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors",
                      meetingDone
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                    )}
                  >
                    {meetingDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Users className="w-3.5 h-3.5" />}
                    {meetingDone ? "Meeting Requested" : meetBusy ? "…" : "Request Meeting"}
                  </button>
                  <button
                    data-testid={`button-sponsor-info-${s.id}`}
                    onClick={() => handleRequest(s.id, "info")}
                    disabled={infoDone || !!infoBusy}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium border transition-colors",
                      infoDone
                        ? "bg-green-50 border-green-200 text-green-700"
                        : "bg-white border-gray-300 text-gray-700 hover:border-blue-400 hover:text-blue-600 disabled:opacity-50"
                    )}
                  >
                    {infoDone ? <CheckCircle className="w-3.5 h-3.5" /> : <Info className="w-3.5 h-3.5" />}
                    {infoDone ? "Info Requested" : infoBusy ? "…" : "Request Info"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-3">
        <button
          data-testid="button-back-sessions"
          onClick={onBack}
          className="flex items-center gap-1 px-4 py-3 rounded-xl border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" /> Back
        </button>
        <button
          data-testid="button-sponsors-next"
          onClick={onNext}
          disabled={loading}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {loading ? "Finishing…" : "Complete Setup"}
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
  slug,
}: {
  email: string;
  sessionCount: number;
  meetingCount: number;
  eventName: string;
  slug: string;
}) {
  const [, navigate] = useLocation();

  return (
    <div className="text-center space-y-6 py-4">
      <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
        <CheckCircle className="w-9 h-9 text-green-600" />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900">You're all set!</h2>
        <p className="mt-2 text-gray-500 text-sm max-w-sm mx-auto">
          Your personalised plan for <span className="font-medium text-gray-700">{eventName}</span> has been saved.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 max-w-xs mx-auto">
        {sessionCount > 0 && (
          <div className="bg-blue-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-blue-600">{sessionCount}</p>
            <p className="text-xs text-blue-700 mt-0.5">Session{sessionCount !== 1 ? "s" : ""} saved</p>
          </div>
        )}
        {meetingCount > 0 && (
          <div className="bg-purple-50 rounded-xl p-3">
            <p className="text-2xl font-bold text-purple-600">{meetingCount}</p>
            <p className="text-xs text-purple-700 mt-0.5">Request{meetingCount !== 1 ? "s" : ""} sent</p>
          </div>
        )}
      </div>

      {email && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800 max-w-sm mx-auto">
          <Mail className="inline-block w-4 h-4 mr-1.5 -mt-0.5" />
          We'll send your personalised agenda to <span className="font-semibold">{email}</span> once your registration is confirmed.
        </div>
      )}

      <p className="text-xs text-gray-400 max-w-sm mx-auto">
        Your selections have been linked to your registration. You can update your agenda anytime by returning to this page.
      </p>
    </div>
  );
}

// ── Main WelcomePage ──────────────────────────────────────────────────────────

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();

  // Core wizard state
  const [step, setStep] = useState<WizardStep>("topics");
  const [profileId, setProfileId] = useState<string | null>(null);
  const [topicIds, setTopicIds] = useState<string[]>([]);
  const [sessionIds, setSessionIds] = useState<string[]>([]);
  const [meetingRequests, setMeetingRequests] = useState<{ sponsorId: string; requestType: string }[]>([]);
  const [email, setEmail] = useState("");
  const [matchedToken, setMatchedToken] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [initialising, setInitialising] = useState(true);

  // Fetch public event data
  const { data: event } = useQuery<PublicEvent>({
    queryKey: ["/api/public/welcome", slug, "event"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/event`);
      if (!res.ok) throw new Error("Event not found");
      return res.json();
    },
    enabled: !!slug,
  });

  // Fetch topics
  const { data: topics = [] } = useQuery<EventInterestTopic[]>({
    queryKey: ["/api/public/welcome", slug, "topics"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/topics`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
  });

  // Fetch sessions
  const { data: sessions = [] } = useQuery<AgendaSession[]>({
    queryKey: ["/api/public/welcome", slug, "sessions"],
    queryFn: async () => {
      const res = await fetch(`/api/public/welcome/${slug}/sessions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!slug,
  });

  // Fetch sponsors
  const { data: sponsors = [] } = useQuery<Sponsor[]>({
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
          // Verify profile still exists
          const res = await fetch(`/api/public/pending/${stored.profileId}`);
          if (res.ok) {
            const data = await res.json();
            setProfileId(stored.profileId);
            setTopicIds(data.topics ?? stored.topicIds ?? []);
            setSessionIds(data.sessions ?? stored.sessionIds ?? []);
            setMeetingRequests(data.meetingRequests?.map((r: any) => ({ sponsorId: r.sponsorId, requestType: r.requestType })) ?? stored.meetingRequests ?? []);
            setEmail(stored.email ?? "");
            setMatchedToken(stored.matchedToken ?? null);
            // Restore step from API or storage
            const apiStep = data.profile?.onboardingStep as WizardStep | undefined;
            const storedStep = stored.step;
            setStep(apiStep ?? storedStep ?? "topics");
            setInitialising(false);
            return;
          }
        }
        // Create a new profile
        if (!slug) { setInitialising(false); return; }
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

  // Sync local state to storage on changes
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
      setStep("email");
    } catch (e) {
      console.error("[welcome] topics save error", e);
      setStep("email"); // advance anyway
    } finally {
      setActionLoading(false);
    }
  }

  async function handleEmailNext(submittedEmail: string, matched: boolean, token: string | null) {
    setEmail(submittedEmail);
    setMatchedToken(token);
    if (matched && token) {
      // Real attendee found — could redirect to portal; for now continue to sessions
    }
    setStep("sessions");
  }

  async function handleSessionToggle(sessionId: string, isSaved: boolean) {
    if (!profileId) return;
    const action = isSaved ? "remove" : "add";
    await apiPatch(`/api/public/pending/${profileId}/sessions`, { sessionId, action });
    if (isSaved) {
      setSessionIds((p) => p.filter((x) => x !== sessionId));
    } else {
      setSessionIds((p) => [...p, sessionId]);
    }
  }

  async function handleSessionsNext() {
    setStep("sponsors");
  }

  async function handleMeetingRequest(sponsorId: string, requestType: string) {
    if (!profileId) return;
    await apiPost(`/api/public/pending/${profileId}/meeting-request`, { sponsorId, requestType });
    setMeetingRequests((p) => [...p, { sponsorId, requestType }]);
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500">Setting up your experience…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-white">
      <div className="max-w-lg mx-auto px-4 py-10">
        {/* Event header */}
        {event && (
          <div className="text-center mb-8">
            {event.logoUrl && (
              <img src={event.logoUrl} alt={event.name} className="h-10 object-contain mx-auto mb-3" />
            )}
            <h1 className="text-lg font-bold text-gray-900">{event.name}</h1>
            {event.venue && <p className="text-sm text-gray-500 mt-0.5">{event.venue}</p>}
          </div>
        )}

        {/* Wizard card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8">
          {step !== "complete" && <StepBar step={step} />}

          {step === "topics" && (
            <TopicsCard
              topics={topics}
              selected={topicIds}
              onChange={setTopicIds}
              onNext={handleTopicsNext}
              loading={actionLoading}
            />
          )}

          {step === "email" && (
            <EmailCard
              slug={slug ?? ""}
              profileId={profileId ?? ""}
              topicIds={topicIds}
              allTopics={topics}
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
              profileId={profileId ?? ""}
              sessions={sessions}
              savedIds={sessionIds}
              onToggle={handleSessionToggle}
              onNext={handleSessionsNext}
              onBack={() => setStep("email")}
              loading={actionLoading}
            />
          )}

          {step === "sponsors" && event && (
            <SponsorsCard
              eventId={event.id}
              sponsors={sponsors}
              meetingRequests={meetingRequests}
              onRequest={handleMeetingRequest}
              onNext={handleSponsorsNext}
              onBack={() => setStep("sessions")}
              loading={actionLoading}
            />
          )}

          {step === "complete" && (
            <CompleteCard
              email={email}
              sessionCount={sessionIds.length}
              meetingCount={meetingRequests.length}
              eventName={event?.name ?? "the event"}
              slug={slug ?? ""}
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
