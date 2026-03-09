import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AnimatePresence, motion } from "framer-motion";
import { Event, Sponsor, Meeting, AppBranding } from "@shared/schema";
import {
  Hexagon, Calendar, MapPin, ArrowLeft, Building2, CheckCircle,
  AlertCircle, ChevronLeft, ChevronRight, ChevronDown, Clock, User, Video, Download, ExternalLink,
  Filter, X, Gem, Linkedin, MonitorPlay,
} from "lucide-react";
import { SiZoom, SiGooglemeet } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadICS, googleCalendarUrl } from "@/lib/ics";
import PublicFooter from "@/components/PublicFooter";
import LegalAcknowledgment from "@/components/LegalAcknowledgment";

// ── Event domain mapping ─────────────────────────────────────────────────────
const eventDomainMap: Record<string, string> = {
  CUGI:  "https://CUGrowthSummit.com",
  FRC:   "https://FintechRiskandCompliance.com",
  TLS:   "https://TreasuryLeadership.com",
  USBT:  "https://USBankTechSummit.com",
};

function getEventWebsite(slug: string, storedUrl?: string | null): string | null {
  if (storedUrl) return storedUrl;
  const prefix = slug.replace(/\d+$/, "").toUpperCase();
  return eventDomainMap[prefix] ?? null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

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
  Platinum: "bg-slate-800 hover:bg-slate-900",
  Gold:     "bg-amber-600 hover:bg-amber-700",
  Silver:   "bg-gray-500 hover:bg-gray-600",
  Bronze:   "bg-orange-600 hover:bg-orange-700",
};
const levelAccentSecondary: Record<string, string> = {
  Platinum: "border-slate-400 text-slate-700 bg-slate-50/60 hover:bg-slate-100",
  Gold:     "border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100",
  Silver:   "border-gray-300 text-gray-600 bg-gray-50/60 hover:bg-gray-100",
  Bronze:   "border-orange-300 text-orange-700 bg-orange-50/60 hover:bg-orange-100",
};

const LEVEL_ORDER: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2, Bronze: 3 };

function getSponsorEventLevel(sponsor: Sponsor, eventId: string): string {
  const link = (sponsor.assignedEvents ?? []).find((ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active");
  return link?.sponsorshipLevel ?? "";
}

function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMins(n: number) {
  return `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
}
function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
function generateSlots(blocks: Event["meetingBlocks"], date: string): string[] {
  const slots: string[] = [];
  (blocks ?? []).filter((b) => b.date === date).forEach((b) => {
    let cur = toMins(b.startTime);
    const end = toMins(b.endTime);
    while (cur < end) { slots.push(fromMins(cur)); cur += 30; }
  });
  return slots;
}

function detectTimezone(): string {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const map: Record<string, string> = {
      "America/Chicago":     "Central (CT)",
      "America/New_York":    "Eastern (ET)",
      "America/Denver":      "Mountain (MT)",
      "America/Los_Angeles": "Pacific (PT)",
    };
    return map[tz] || "Central (CT)";
  } catch {
    return "Central (CT)";
  }
}

// ── Shell ────────────────────────────────────────────────────────────────────

function Shell({
  children, onBack, backLabel, style,
}: { children: React.ReactNode; onBack?: () => void; backLabel?: string; style?: React.CSSProperties }) {
  const { data: branding } = useQuery<AppBranding>({ queryKey: ["/api/branding-public"] });
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col" style={style}>
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          {branding?.appLogoUrl ? (
            <img
              src={branding.appLogoUrl}
              alt={branding.appName || "Converge Concierge"}
              className="h-8 max-w-[140px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-5 w-5" />
            </div>
          )}
          <span className="font-display text-xl font-bold text-foreground tracking-tight">
            {branding?.appName || "Converge Concierge"}
          </span>
        </Link>
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />{backLabel ?? "Back"}
          </Button>
        )}
      </header>
      <main className="flex-1 relative z-10 pb-20">{children}</main>
      <PublicFooter />
    </div>
  );
}

// ── StepBar ──────────────────────────────────────────────────────────────────

const ONSITE_STEPS = ["Sponsor", "Date", "Time", "Your Info", "Confirm"];
const ONLINE_STEPS = ["Sponsor", "Date", "Time", "Platform", "Your Info", "Confirm"];

function StepBar({ current, slug, name, accentColor, labels }: {
  current: number; slug: string; name: string; accentColor?: string | null; labels?: string[];
}) {
  const stepLabels = labels ?? ONSITE_STEPS;
  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-5">
        <span
          className="font-mono text-xs font-semibold text-accent border border-accent/30 bg-accent/10 px-2 py-0.5 rounded-full"
          style={accentColor ? { color: accentColor, borderColor: accentColor + "33", backgroundColor: accentColor + "1A" } : undefined}
        >
          {slug}
        </span>
        <span className="text-sm text-muted-foreground truncate">{name}</span>
      </div>
      <div className="flex items-center">
        {stepLabels.map((label, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={i} className={cn("flex items-center", i < stepLabels.length - 1 ? "flex-1" : "")}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div
                  className={cn(
                    "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-200",
                    done   ? "bg-accent text-accent-foreground scale-90"
                    : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                    :          "bg-muted text-muted-foreground",
                  )}
                  style={accentColor && done ? { backgroundColor: accentColor, color: "#fff" } : undefined}
                >
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground",
                )}>{label}</span>
              </div>
              {i < stepLabels.length - 1 && (
                <div className={cn("h-px flex-1 mx-1.5 mb-3 transition-colors duration-300", done ? "bg-accent" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Recap chip ────────────────────────────────────────────────────────────────

function RecapChip({
  sponsor, date, time, platform, onChangeSponsor, onChangeDate,
}: {
  sponsor?: Sponsor | null;
  date?: string;
  time?: string;
  platform?: string;
  onChangeSponsor?: () => void;
  onChangeDate?: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 rounded-xl bg-muted/50 border border-border/50 text-sm">
      {sponsor && (
        <>
          <span className="font-semibold text-foreground">{sponsor.name}</span>
          {onChangeSponsor && <button onClick={onChangeSponsor} className="text-xs text-accent underline underline-offset-2">Change</button>}
        </>
      )}
      {date && (
        <>
          <span className="text-muted-foreground/50 hidden sm:inline">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5 text-accent" />{format(parseISO(date), "EEE, MMM d")}
          </span>
          {onChangeDate && <button onClick={onChangeDate} className="text-xs text-accent underline underline-offset-2">Change</button>}
        </>
      )}
      {time && (
        <>
          <span className="text-muted-foreground/50 hidden sm:inline">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Clock className="h-3.5 w-3.5 text-accent" />{fmt12(time)}
          </span>
        </>
      )}
      {platform && (
        <>
          <span className="text-muted-foreground/50 hidden sm:inline">·</span>
          <span className="flex items-center gap-1 text-muted-foreground">
            <Video className="h-3.5 w-3.5" />{platform}
          </span>
        </>
      )}
    </div>
  );
}

// ── Slide animation ───────────────────────────────────────────────────────────

const slide = {
  initial: { opacity: 0, x: 32 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -32 },
  transition: { duration: 0.22, ease: "easeOut" },
};

// ── Types ─────────────────────────────────────────────────────────────────────

type AttendeeForm = {
  firstName: string; lastName: string; company: string;
  title: string; email: string; linkedinUrl: string;
};

// Online meeting time slots: 9:00 AM – 4:00 PM in 30-min increments
function buildOnlineSlots(): string[] {
  const slots: string[] = [];
  let cur = 9 * 60;
  while (cur <= 16 * 60) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += 30;
  }
  return slots;
}
const ONLINE_TIME_SLOTS = buildOnlineSlots();

// Platform display config
const TeamsIcon = () => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
    <rect x="2" y="2" width="20" height="20" rx="4" fill="#6264A7" />
    <text x="12" y="17" textAnchor="middle" fontSize="13" fontWeight="bold" fill="white" fontFamily="sans-serif">T</text>
  </svg>
);

const PLATFORM_CONFIG: { id: string; label: string; icon: React.ReactNode }[] = [
  { id: "Zoom",            label: "Zoom",            icon: <SiZoom className="h-6 w-6" style={{ color: "#2D8CFF" }} /> },
  { id: "Microsoft Teams", label: "Microsoft Teams", icon: <TeamsIcon /> },
  { id: "Google Meet",     label: "Google Meet",     icon: <SiGooglemeet className="h-6 w-6" style={{ color: "#00897B" }} /> },
  { id: "",                label: "No Preference",   icon: <MonitorPlay className="h-6 w-6 text-muted-foreground" /> },
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, nav] = useLocation();

  const { data: events   = [], isLoading: evL } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [], isLoading: spL } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: meetings = [] }                 = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });

  // step 0=sponsor, 1=date, 2=time
  // onsite:  3=info, 4=confirm
  // online:  3=platform, 4=info, 5=confirm
  const [step,         setStep]         = useState(0);
  const [showSuccess,  setShowSuccess]  = useState(false);
  const [meetingMode,  setMeetingMode]  = useState<"onsite" | "online">("onsite");
  const [activeFilters,   setActiveFilters]   = useState<string[]>([]);
  const [showAllFilters,  setShowAllFilters]  = useState(false);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [selectedDate,    setSelectedDate]    = useState("");
  const [selectedTime,    setSelectedTime]    = useState("");
  const [selectedLoc,     setSelectedLoc]     = useState("");
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [timezone,        setTimezone]        = useState("Central (CT)");
  const [attendee, setAttendee] = useState<AttendeeForm>({
    firstName: "", lastName: "", company: "", title: "", email: "", linkedinUrl: "",
  });
  const [submitting,    setSubmitting]    = useState(false);
  const [error,         setError]         = useState("");
  const [agreeToTerms,  setAgreeToTerms]  = useState(false);
  const [showLinkedIn,  setShowLinkedIn]  = useState(false);
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);

  // ── Deep-link: pre-select sponsor + mode from URL query params ────────────
  const hasAppliedDeepLink = useRef(false);
  useEffect(() => {
    if (hasAppliedDeepLink.current || sponsors.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const sponsorParam = params.get("sponsor");
    const modeParam = params.get("mode");
    if (!sponsorParam) return;
    const found = sponsors.find((s) => s.id === sponsorParam);
    if (!found) return;
    hasAppliedDeepLink.current = true;
    setSelectedSponsor(found);
    setMeetingMode(modeParam === "online" ? "online" : "onsite");
    setStep(1);
  }, [sponsors]);

  const event = events.find((e) => e.slug === slug);
  const eventSponsors = event
    ? sponsors
        .filter((s) =>
          (s.archiveState ?? "active") === "active" &&
          (s.assignedEvents ?? []).some((ae) =>
            ae.eventId === event.id &&
            (ae.archiveState ?? "active") === "active" &&
            !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
          )
        )
        .sort((a, b) => {
          const la = LEVEL_ORDER[getSponsorEventLevel(a, event.id)] ?? 99;
          const lb = LEVEL_ORDER[getSponsorEventLevel(b, event.id)] ?? 99;
          if (la !== lb) return la - lb;
          return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
        })
    : [];

  const attributesInUse = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    eventSponsors.forEach((s) => {
      (s.attributes ?? []).forEach((a) => {
        const trimmed = a.trim();
        const key = trimmed.toLowerCase();
        if (trimmed && !seen.has(key)) { seen.add(key); result.push(trimmed); }
      });
    });
    return result;
  }, [eventSponsors]);

  const filteredSponsors = useMemo(() => {
    if (activeFilters.length === 0) return eventSponsors;
    const filterKeys = activeFilters.map((f) => f.toLowerCase());
    return eventSponsors.filter((s) =>
      filterKeys.some((fk) => (s.attributes ?? []).some((a) => a.trim().toLowerCase() === fk))
    );
  }, [eventSponsors, activeFilters]);

  const eventColorStyle = useMemo((): React.CSSProperties => {
    if (!event) return {};
    const vars: Record<string, string> = {};
    if (event.primaryColor)   vars["--event-primary"]   = event.primaryColor;
    if (event.secondaryColor) vars["--event-secondary"] = event.secondaryColor;
    if (event.accentColor)    vars["--event-accent"]    = event.accentColor;
    if (event.buttonColor)    vars["--event-button"]    = event.buttonColor;
    if (event.bgAccentColor)  vars["--event-bg-accent"] = event.bgAccentColor;
    return vars as React.CSSProperties;
  }, [event]);

  const evAccent = event?.accentColor ?? null;
  const evButton = event?.buttonColor ?? evAccent;

  const bookedSlots = useMemo(() => {
    if (!event) return new Set<string>();
    return new Set(
      meetings
        .filter((m) =>
          m.eventId === event.id &&
          (m.meetingType ?? "onsite") !== "online_request" &&
          m.status !== "Cancelled" && m.status !== "NoShow" &&
          (m.archiveState ?? "active") !== "archived"
        )
        .map((m) => `${m.sponsorId}|${m.date}|${m.time}`)
    );
  }, [meetings, event]);

  const eventEnded = useMemo(() => {
    if (!event?.endDate) return false;
    const endDate = parseISO(event.endDate as unknown as string);
    const startOfToday = new Date(); startOfToday.setHours(0, 0, 0, 0);
    return endDate < startOfToday;
  }, [event?.endDate]);

  const schedulingDisabled = useMemo(() => {
    if (!event) return false;
    if (event.schedulingEnabled === false) return true;
    if (event.schedulingShutoffAt) {
      return new Date() > new Date(event.schedulingShutoffAt as unknown as string);
    }
    return false;
  }, [event?.schedulingEnabled, event?.schedulingShutoffAt]);

  const hasExternalLink       = !!event?.externalSchedulingUrl;
  const showExternalHandoff   = schedulingDisabled && hasExternalLink;
  const showSchedulingClosed  = (eventEnded || schedulingDisabled) && !hasExternalLink;

  const availableDates = useMemo(() => {
    if (!event) return [];
    const evStart = parseISO(event.startDate as unknown as string);
    const evEnd   = parseISO(event.endDate   as unknown as string);
    evStart.setHours(0, 0, 0, 0); evEnd.setHours(23, 59, 59, 999);
    return [...new Set(
      (event.meetingBlocks ?? [])
        .filter((b) => {
          const blockDate = new Date(b.date + "T00:00:00");
          return blockDate >= evStart && blockDate <= evEnd;
        })
        .map((b) => b.date)
    )].sort();
  }, [event]);

  function go(s: number) { setError(""); setStep(s); }

  function pickSponsor(s: Sponsor) {
    setSelectedSponsor(s);
    setMeetingMode("onsite");
    setSelectedDate(""); setSelectedTime(""); setSelectedLoc(""); setError("");
    go(1);
  }

  function pickOnlineMeeting(s: Sponsor) {
    setSelectedSponsor(s);
    setMeetingMode("online");
    setSelectedDate(""); setSelectedTime(""); setSelectedPlatform("");
    setTimezone(detectTimezone());
    setAttendee({ firstName: "", lastName: "", company: "", title: "", email: "", linkedinUrl: "" });
    setAgreeToTerms(false);
    setError("");
    go(1);
  }

  async function handleOnlineSubmit() {
    if (!event || !selectedSponsor) return;
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId:           event.id,
          sponsorId:         selectedSponsor.id,
          meetingType:       "online_request",
          date:              selectedDate,
          time:              selectedTime,
          location:          "Online",
          platform:          selectedPlatform || null,
          preferredTimezone: timezone,
          status:            "Pending",
          source:            "public",
          manualAttendee: {
            firstName:   attendee.firstName,
            lastName:    attendee.lastName,
            name:        [attendee.firstName, attendee.lastName].filter(Boolean).join(" "),
            company:     attendee.company,
            title:       attendee.title,
            email:       attendee.email,
            linkedinUrl: attendee.linkedinUrl || undefined,
          },
        }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body.message || "Something went wrong. Please try again."); return; }
      await queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setCreatedMeetingId(body.id ?? null);
      setShowSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!event || !selectedSponsor) return;
    setError(""); setSubmitting(true);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId:   event.id,
          sponsorId: selectedSponsor.id,
          date:      selectedDate,
          time:      selectedTime,
          location:  selectedLoc || (event.meetingLocations?.[0]?.name ?? "TBD"),
          status:    "Scheduled",
          source:    "public",
          manualAttendee: {
            firstName:   attendee.firstName,
            lastName:    attendee.lastName,
            name:        [attendee.firstName, attendee.lastName].filter(Boolean).join(" "),
            company:     attendee.company,
            title:       attendee.title,
            email:       attendee.email,
            linkedinUrl: attendee.linkedinUrl || undefined,
          },
        }),
      });
      const body = await res.json();
      if (res.status === 409) { setError(body.message || "This time slot is already booked."); return; }
      if (!res.ok) { setError(body.message || "Something went wrong. Please try again."); return; }
      await queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      setCreatedMeetingId(body.id ?? null);
      setShowSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // Loading
  if (evL || spL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  // Not found
  if (!event) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-40 gap-4 px-6 text-center">
          <h1 className="text-2xl font-display font-bold text-foreground">Event not found</h1>
          <p className="text-muted-foreground text-sm">"{slug}" doesn't match any active event.</p>
          <Button onClick={() => nav("/")} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" />Back to Events</Button>
        </div>
      </Shell>
    );
  }

  // ── SUCCESS ───────────────────────────────────────────────────────────────
  if (showSuccess) {
    const isOnlineSuccess = meetingMode === "online";
    return (
      <Shell style={eventColorStyle}>
        <div className="flex items-center justify-center min-h-[75vh] px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.35 }}
            className="bg-card rounded-2xl border border-border/60 shadow-xl p-10 max-w-md w-full text-center"
          >
            <div className="flex justify-center mb-5">
              <div className={cn("h-16 w-16 rounded-full flex items-center justify-center", isOnlineSuccess ? "bg-violet-100" : "bg-green-100")}>
                {isOnlineSuccess
                  ? <Video className="h-9 w-9 text-violet-600" />
                  : <CheckCircle className="h-9 w-9 text-green-600" />
                }
              </div>
            </div>

            {isOnlineSuccess ? (
              <>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Online Meeting Request Sent</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your online meeting request has been submitted. The sponsor will contact you to confirm the meeting time and send a link.
                </p>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-left space-y-3 text-sm mb-6">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-semibold text-foreground">{selectedSponsor?.name}</span>
                    {selectedSponsor && getSponsorEventLevel(selectedSponsor, event?.id ?? "") && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto inline-flex items-center gap-0.5", levelBadge[getSponsorEventLevel(selectedSponsor, event?.id ?? "")] || "")}>
                        {getSponsorEventLevel(selectedSponsor, event?.id ?? "") === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                        {getSponsorEventLevel(selectedSponsor, event?.id ?? "")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-accent shrink-0" />
                    <span>Preferred: {selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM d, yyyy") : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 text-accent shrink-0" />
                    <span>{selectedTime ? `${fmt12(selectedTime)} ${timezone}` : "—"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Video className="h-4 w-4 shrink-0" />
                    <span>{selectedPlatform || "No platform preference"}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground border-t border-border/50 pt-3">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{[attendee.firstName, attendee.lastName].filter(Boolean).join(" ") || "—"} · {attendee.company}</span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-display font-bold text-foreground mb-2">Meeting Confirmed!</h2>
                <p className="text-muted-foreground text-sm mb-6">
                  Your 1-on-1 with <strong>{selectedSponsor?.name}</strong> is all set.
                </p>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-left space-y-3 text-sm mb-6">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-semibold text-foreground">{selectedSponsor?.name}</span>
                    {selectedSponsor && getSponsorEventLevel(selectedSponsor, event?.id ?? "") && (
                      <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto inline-flex items-center gap-0.5", levelBadge[getSponsorEventLevel(selectedSponsor, event?.id ?? "")] || "")}>
                        {getSponsorEventLevel(selectedSponsor, event?.id ?? "") === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                        {getSponsorEventLevel(selectedSponsor, event?.id ?? "")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-accent shrink-0" />
                    <span>{format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 text-accent shrink-0" />
                    <span>{fmt12(selectedTime)}</span>
                  </div>
                  {selectedLoc && (
                    <div className="flex items-center gap-2.5 text-muted-foreground">
                      <MapPin className="h-4 w-4 shrink-0" />
                      <span>{selectedLoc}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2.5 text-muted-foreground border-t border-border/50 pt-3">
                    <User className="h-4 w-4 shrink-0" />
                    <span>{[attendee.firstName, attendee.lastName].filter(Boolean).join(" ") || "—"} · {attendee.company}</span>
                  </div>
                </div>
              </>
            )}

            {!isOnlineSuccess && createdMeetingId && event && selectedSponsor && (
              <div className="flex flex-col sm:flex-row gap-2 mb-3">
                <Button
                  variant="outline" size="sm" className="flex-1 gap-2 text-xs"
                  onClick={() => downloadICS({
                    meetingId:    createdMeetingId,
                    sponsorName:  selectedSponsor.name,
                    attendeeName: [attendee.firstName, attendee.lastName].filter(Boolean).join(" "),
                    eventName:    event.name,
                    eventSlug:    event.slug,
                    date:         selectedDate,
                    time:         selectedTime,
                    location:     selectedLoc || "TBD",
                    meetingType:  "onsite",
                  })}
                  data-testid="button-download-ics"
                >
                  <Download className="h-3.5 w-3.5" /> Download .ics
                </Button>
                <a
                  href={googleCalendarUrl({
                    meetingId:    createdMeetingId,
                    sponsorName:  selectedSponsor.name,
                    attendeeName: [attendee.firstName, attendee.lastName].filter(Boolean).join(" "),
                    eventName:    event.name,
                    eventSlug:    event.slug,
                    date:         selectedDate,
                    time:         selectedTime,
                    location:     selectedLoc || "TBD",
                    meetingType:  "onsite",
                  })}
                  target="_blank" rel="noopener noreferrer" className="flex-1"
                  data-testid="link-add-google-calendar"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> Add to Google Calendar
                  </Button>
                </a>
              </div>
            )}
            <Button
              onClick={() => {
                setShowSuccess(false);
                setStep(0);
                setSelectedSponsor(null);
                setSelectedDate("");
                setSelectedTime("");
                setSelectedLoc("");
                setCreatedMeetingId(null);
                setError("");
              }}
              className="w-full"
              data-testid="button-success-home"
            >
              Back to Event
            </Button>
          </motion.div>
        </div>
      </Shell>
    );
  }

  // ── STEP 0: SPONSOR SELECTION ─────────────────────────────────────────────
  if (step === 0) {
    return (
      <Shell style={eventColorStyle}>
        <motion.div {...slide} className="w-full max-w-5xl mx-auto px-6 pt-5 pb-8">
          {/* Event header */}
          <div className="text-center mb-5">
            {event.logoUrl && (
              <div className="flex justify-center mb-5">
                <img
                  src={event.logoUrl} alt={event.name}
                  className="h-20 sm:h-24 max-w-[280px] sm:max-w-[340px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  data-testid="img-event-logo"
                />
              </div>
            )}
            <h1 className="text-3xl md:text-4xl font-display font-bold text-foreground tracking-tight leading-tight mb-2">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                {format(parseISO(event.startDate as unknown as string), "MMMM d")}
                {" – "}
                {format(parseISO(event.endDate as unknown as string), "MMMM d, yyyy")}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/70" />
                {event.location}
              </span>
              {getEventWebsite(event.slug, event.websiteUrl) && (
                <a
                  href={getEventWebsite(event.slug, event.websiteUrl)!}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-accent hover:opacity-80 transition-opacity font-medium"
                  data-testid="link-event-website"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Event Website
                </a>
              )}
            </div>
          </div>

          {showExternalHandoff && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 mb-5" data-testid="banner-external-scheduling">
              <div className="flex items-start gap-3 mb-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-blue-600 mt-0.5" />
                <p className="text-sm font-medium text-blue-800">
                  {event?.externalSchedulingMessage || "Meeting scheduling for this event has moved to the event app."}
                </p>
              </div>
              <a
                href={event?.externalSchedulingUrl ?? "#"} target="_blank" rel="noopener noreferrer"
                data-testid="btn-open-event-app"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {event?.externalSchedulingLabel || "Open Event App"}
              </a>
            </div>
          )}

          {showSchedulingClosed && !showExternalHandoff && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 mb-5 text-amber-800" data-testid="banner-scheduling-closed">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <p className="text-sm font-medium">Meeting scheduling is no longer available for this event.</p>
            </div>
          )}

          {/* Section header — only when event ended, disabled, or external handoff */}
          {(eventEnded || schedulingDisabled || showExternalHandoff) && (
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
              <div>
                <h2 className="text-2xl font-display font-semibold text-foreground mb-1">
                  Event Sponsors
                </h2>
                {eventEnded && (
                  <p className="text-muted-foreground text-sm">This event has concluded. Browse the sponsors who participated.</p>
                )}
                {!eventEnded && schedulingDisabled && (
                  <p className="text-muted-foreground text-sm">Concierge scheduling is currently unavailable for this event.</p>
                )}
                {showExternalHandoff && !eventEnded && !schedulingDisabled && (
                  <p className="text-muted-foreground text-sm">Browse the sponsors participating in this event.</p>
                )}
              </div>
              {eventSponsors.length > 0 && (
                <span className="text-xs text-muted-foreground shrink-0">
                  {filteredSponsors.length} of {eventSponsors.length} sponsor{eventSponsors.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          )}

          {/* Interest filter — becomes the primary heading when scheduling is active */}
          {attributesInUse.length > 0 && (() => {
            const allOptions = attributesInUse;
            const SHOW_LIMIT = 7;
            const visibleOptions = showAllFilters ? allOptions : allOptions.slice(0, SHOW_LIMIT);
            const hasMore = allOptions.length > SHOW_LIMIT;
            return (
              <div className="mb-6 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <h2 className="text-2xl font-display font-semibold text-foreground">
                    What are you interested in?
                  </h2>
                  {eventSponsors.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {filteredSponsors.length} of {eventSponsors.length} sponsor{eventSponsors.length !== 1 ? "s" : ""}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5 items-center">
                  {visibleOptions.map((attr) => {
                    const active = activeFilters.some((f) => f.toLowerCase() === attr.toLowerCase());
                    return (
                      <button
                        key={attr}
                        onClick={() => setActiveFilters((prev) =>
                          active ? prev.filter((f) => f.toLowerCase() !== attr.toLowerCase()) : [...prev, attr]
                        )}
                        data-testid={`filter-${attr.toLowerCase().replace(/\s+/g, "-")}`}
                        className={cn(
                          "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                          active
                            ? "bg-accent text-accent-foreground border-accent"
                            : "bg-card text-foreground/70 border-border hover:border-accent/60 hover:text-foreground hover:bg-accent/5",
                        )}
                        style={(active && evAccent) ? { backgroundColor: evAccent, color: "#fff", borderColor: evAccent } : undefined}
                      >
                        {attr}
                      </button>
                    );
                  })}
                  {hasMore && (
                    <button
                      onClick={() => setShowAllFilters((v) => !v)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium text-accent border border-accent/40 hover:bg-accent/10 transition-all"
                      data-testid="filter-show-more"
                    >
                      {showAllFilters ? "Show Less" : `+${allOptions.length - SHOW_LIMIT} More`}
                    </button>
                  )}
                  {activeFilters.length > 0 && (
                    <button
                      onClick={() => setActiveFilters([])}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm text-muted-foreground hover:text-destructive transition-colors"
                      data-testid="filter-clear"
                    >
                      <X className="h-3.5 w-3.5" /> Clear
                    </button>
                  )}
                </div>
              </div>
            );
          })()}

          {eventSponsors.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Building2 className="h-12 w-12 opacity-20" />
              <p className="text-sm">No sponsors are available for this event yet.</p>
            </div>
          ) : filteredSponsors.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
              <Filter className="h-10 w-10 opacity-20" />
              <p className="text-sm">No sponsors match the selected filters.</p>
              <button onClick={() => setActiveFilters([])} className="text-xs text-accent underline underline-offset-2">Clear filters</button>
            </div>
          ) : (
            <>
              {activeFilters.length > 0 && (
                <p className="text-xs font-medium text-muted-foreground mb-3" data-testid="text-filtered-label">
                  Sponsors matching your interests
                </p>
              )}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredSponsors.map((sponsor, i) => (
                <motion.div
                  key={sponsor.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.4) }}
                  className={cn(
                    "flex flex-col rounded-xl border-2 shadow-sm overflow-hidden",
                    "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                    levelBorder[getSponsorEventLevel(sponsor, event.id)] || "border-border bg-card",
                  )}
                  data-testid={`sponsor-card-${sponsor.id}`}
                >
                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="h-9 flex items-center shrink-0">
                        {sponsor.logoUrl ? (
                          <img src={sponsor.logoUrl} alt={sponsor.name} className="h-8 max-w-[90px] object-contain" />
                        ) : (
                          <div className="h-9 w-9 rounded-lg bg-white border border-black/10 shadow-sm flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      {getSponsorEventLevel(sponsor, event.id) && (
                        <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 inline-flex items-center gap-0.5", levelBadge[getSponsorEventLevel(sponsor, event.id)] || "bg-muted text-muted-foreground")}>
                          {getSponsorEventLevel(sponsor, event.id) === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                          {getSponsorEventLevel(sponsor, event.id)}
                        </span>
                      )}
                    </div>
                    <h3 className="text-sm font-display font-bold text-foreground leading-tight mb-1">{sponsor.name}</h3>
                    {sponsor.shortDescription && (
                      <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-1">{sponsor.shortDescription}</p>
                    )}
                    <Link
                      href={`/event/${event.slug}/sponsor/${sponsor.id}`}
                      className="text-[11px] text-accent hover:opacity-80 transition-opacity flex items-center gap-1"
                      data-testid={`link-sponsor-profile-${sponsor.id}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="h-2.5 w-2.5" /> View Profile
                    </Link>
                  </div>
                  <div className="px-4 pb-4 space-y-1.5">
                    {(eventEnded || schedulingDisabled) ? (
                      <div className="w-full py-2 rounded-lg bg-muted text-muted-foreground text-xs font-medium text-center border border-border/60" data-testid={`text-scheduling-closed-${sponsor.id}`}>
                        Scheduling Closed
                      </div>
                    ) : (
                      <>
                        <button
                          onClick={() => pickSponsor(sponsor)}
                          data-testid={`btn-meet-${sponsor.id}`}
                          className={cn(
                            "w-full py-2 rounded-lg text-white text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
                            levelAccent[getSponsorEventLevel(sponsor, event.id)] || "bg-primary hover:bg-primary/90",
                          )}
                        >
                          Schedule Onsite Meeting
                        </button>
                        {sponsor.allowOnlineMeetings && (
                          <button
                            onClick={() => pickOnlineMeeting(sponsor)}
                            data-testid={`btn-online-${sponsor.id}`}
                            className={cn(
                              "w-full py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5",
                              levelAccentSecondary[getSponsorEventLevel(sponsor, event.id)] || "border-border text-muted-foreground bg-muted/50 hover:bg-muted",
                            )}
                          >
                            <Video className="h-3 w-3" /> Online Meeting
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
            </>
          )}
        </motion.div>
      </Shell>
    );
  }

  // ── STEP 1: DATE SELECTION (onsite = event date cards | online = free-form) ──
  if (step === 1) {
    const stepLabels = meetingMode === "online" ? ONLINE_STEPS : ONSITE_STEPS;
    return (
      <Shell onBack={() => go(0)} backLabel="Sponsors" style={eventColorStyle}>
        <StepBar current={1} slug={event.slug} name={event.name} accentColor={evAccent} labels={stepLabels} />
        <AnimatePresence mode="wait">
          <motion.div key="step-date" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-7">
            <RecapChip sponsor={selectedSponsor} onChangeSponsor={() => go(0)} />

            <div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-1 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                {meetingMode === "online" ? "Preferred Date" : "Choose a Date"}
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                {meetingMode === "online"
                  ? "Choose any date for your online meeting — it doesn't have to be an event day."
                  : "Select a day to view available time slots."}
              </p>

              {meetingMode === "online" ? (
                <div className="space-y-4">
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => { setSelectedDate(e.target.value); setSelectedTime(""); setError(""); }}
                    data-testid="input-online-date"
                    className="block w-full max-w-xs h-11 rounded-xl border-2 border-border px-3 text-sm font-medium bg-card text-foreground focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {availableDates.map((d) => (
                    <button
                      key={d}
                      onClick={() => { setSelectedDate(d); setSelectedTime(""); setSelectedLoc(""); setError(""); go(2); }}
                      data-testid={`date-btn-${d}`}
                      className={cn(
                        "px-5 py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 active:scale-[0.97]",
                        selectedDate === d
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                          : "bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted/60",
                      )}
                    >
                      <span className="block text-base font-bold">{format(parseISO(d), "d")}</span>
                      <span className="block text-[11px] font-medium opacity-80">{format(parseISO(d), "EEE, MMM")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pb-2">
              <Button
                type="button" variant="outline" onClick={() => go(0)}
                className="shrink-0" data-testid="button-date-back"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              {meetingMode === "online" && (
                <Button
                  type="button"
                  disabled={!selectedDate}
                  onClick={() => { setError(""); go(2); }}
                  data-testid="button-date-continue"
                >
                  Continue <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ── STEP 2: TIME SELECTION (onsite = slot cards | online = free-form picker) ─
  if (step === 2) {
    const stepLabels = meetingMode === "online" ? ONLINE_STEPS : ONSITE_STEPS;
    const slots = generateSlots(event.meetingBlocks ?? [], selectedDate);
    const allBooked = meetingMode === "onsite" && slots.length > 0 &&
      slots.every((t) => bookedSlots.has(`${selectedSponsor?.id}|${selectedDate}|${t}`));

    return (
      <Shell onBack={() => go(1)} backLabel="Date" style={eventColorStyle}>
        <StepBar current={2} slug={event.slug} name={event.name} accentColor={evAccent} labels={stepLabels} />
        <AnimatePresence mode="wait">
          <motion.div key="step-time" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-7">
            <RecapChip
              sponsor={selectedSponsor} date={selectedDate}
              onChangeSponsor={() => go(0)} onChangeDate={() => go(1)}
            />

            <div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                {meetingMode === "online" ? "Preferred Time" : "Choose a Time"}
              </h2>
              {meetingMode === "online" && (
                <p className="text-sm text-muted-foreground mb-1">
                  Timezone: <span className="font-medium">{timezone}</span>
                </p>
              )}
              <p className="text-sm text-muted-foreground mb-5">
                {meetingMode === "online"
                  ? "Choose any time that works for you. The sponsor will confirm the details."
                  : "30-minute sessions. Strikethrough = already booked."}
              </p>

              {meetingMode === "online" ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {ONLINE_TIME_SLOTS.map((t) => {
                    const active = selectedTime === t;
                    return (
                      <button
                        key={t}
                        onClick={() => { setSelectedTime(t); setError(""); go(3); }}
                        data-testid={`time-btn-${t}`}
                        className={cn(
                          "py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 text-center active:scale-[0.97]",
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                            : "bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted/60",
                        )}
                      >
                        {fmt12(t)}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <>
                  {allBooked && (
                    <div className="flex items-center gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 mb-4 text-amber-800 text-sm">
                      <AlertCircle className="h-4 w-4 shrink-0" />
                      All time slots for this sponsor on this date are fully booked. Please choose a different date.
                    </div>
                  )}

                  {slots.length === 0 ? (
                    <p className="text-sm text-muted-foreground italic">No time slots available for this date.</p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {slots.map((t) => {
                        const booked = bookedSlots.has(`${selectedSponsor?.id}|${selectedDate}|${t}`);
                        const active = selectedTime === t;
                        return (
                          <button
                            key={t}
                            disabled={booked}
                            onClick={() => { setSelectedTime(t); setSelectedLoc(""); setError(""); go(3); }}
                            data-testid={`time-btn-${t}`}
                            title={booked ? "Already booked" : fmt12(t)}
                            className={cn(
                              "py-3 rounded-xl text-sm font-semibold border-2 transition-all duration-150 text-center active:scale-[0.97]",
                              booked
                                ? "bg-muted/60 text-muted-foreground/30 border-muted cursor-not-allowed line-through"
                                : active
                                ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                                : "bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted/60",
                            )}
                          >
                            {fmt12(t)}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Navigation */}
            <div className="flex gap-3 pb-2">
              <Button
                type="button" variant="outline" onClick={() => go(1)}
                className="shrink-0" data-testid="button-time-back"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ── ONLINE STEPS (3: Platform, 4: Your Info, 5: Confirm) ─────────────────

  if (meetingMode === "online") {

    // ── ONLINE STEP 3: PLATFORM ─────────────────────────────────────────────
    if (step === 3) {
      return (
        <Shell onBack={() => go(2)} backLabel="Time" style={eventColorStyle}>
          <StepBar current={3} slug={event.slug} name={event.name} accentColor={evAccent} labels={ONLINE_STEPS} />
          <AnimatePresence mode="wait">
            <motion.div key="online-platform" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-7">
              <RecapChip
                sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
                onChangeSponsor={() => go(0)} onChangeDate={() => go(1)}
              />

              <div>
                <h2 className="text-xl font-display font-semibold text-foreground mb-1 flex items-center gap-2">
                  <Video className="h-5 w-5 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                  Choose Online Meeting Platform
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  How would you prefer to connect? The sponsor will send the link once confirmed.
                </p>

                <div className="grid grid-cols-2 gap-3">
                  {PLATFORM_CONFIG.map(({ id, label, icon }) => {
                    const active = selectedPlatform === id;
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setSelectedPlatform(id)}
                        data-testid={`platform-btn-${label.toLowerCase().replace(/\s+/g, "-")}`}
                        className={cn(
                          "flex flex-col items-center gap-3 px-4 py-5 rounded-xl border-2 font-semibold text-sm transition-all duration-150 active:scale-[0.97]",
                          active
                            ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/25"
                            : "bg-card text-foreground border-border hover:border-primary/60 hover:bg-muted/60",
                        )}
                        style={active && evButton ? { backgroundColor: evButton, borderColor: evButton, boxShadow: `0 4px 14px ${evButton}30` } : undefined}
                      >
                        <span className={cn("transition-all", active ? "opacity-80 invert" : "")}>{icon}</span>
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3 pb-2">
                <Button
                  type="button" variant="outline" onClick={() => go(2)}
                  className="shrink-0" data-testid="button-platform-back"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  type="button"
                  className="flex-1 shadow-md"
                  style={evButton ? { backgroundColor: evButton, boxShadow: `0 4px 14px ${evButton}40` } : undefined}
                  onClick={() => go(4)}
                  data-testid="button-platform-continue"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Shell>
      );
    }

    // ── ONLINE STEP 4: YOUR INFO ────────────────────────────────────────────
    if (step === 4) {
      function validateOnlineInfo(): string {
        if (!attendee.firstName.trim()) return "First name is required.";
        if (!attendee.company.trim())   return "Company is required.";
        if (!attendee.title.trim())     return "Title is required.";
        if (!attendee.email.trim())     return "Email is required.";
        if (!/\S+@\S+\.\S+/.test(attendee.email)) return "Please enter a valid email address.";
        return "";
      }
      return (
        <Shell onBack={() => go(3)} backLabel="Platform" style={eventColorStyle}>
          <StepBar current={4} slug={event.slug} name={event.name} accentColor={evAccent} labels={ONLINE_STEPS} />
          <AnimatePresence mode="wait">
            <motion.div key="online-info" {...slide} className="w-full max-w-2xl mx-auto px-6 pb-12 space-y-4">
              <RecapChip
                sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
                platform={selectedPlatform || "No Preference"}
                onChangeSponsor={() => go(0)} onChangeDate={() => go(1)}
              />

              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <User className="h-4 w-4 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                    Your Info
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Already registered for this event? Enter your email to link to your record.
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="on-firstname" className="text-xs font-medium">First Name</Label>
                    <Input id="on-firstname" value={attendee.firstName}
                      onChange={(e) => setAttendee({ ...attendee, firstName: e.target.value })}
                      placeholder="Jane" className="h-9 text-sm" data-testid="input-online-firstname" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-lastname" className="text-xs font-medium">Last Name</Label>
                    <Input id="on-lastname" value={attendee.lastName}
                      onChange={(e) => setAttendee({ ...attendee, lastName: e.target.value })}
                      placeholder="Smith" className="h-9 text-sm" data-testid="input-online-lastname" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-company" className="text-xs font-medium">Company</Label>
                    <Input id="on-company" value={attendee.company}
                      onChange={(e) => setAttendee({ ...attendee, company: e.target.value })}
                      placeholder="Acme Financial" className="h-9 text-sm" data-testid="input-online-company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-title" className="text-xs font-medium">Title</Label>
                    <Input id="on-title" value={attendee.title}
                      onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                      placeholder="VP of Finance" className="h-9 text-sm" data-testid="input-online-title" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="on-email" className="text-xs font-medium">Email</Label>
                    <Input id="on-email" type="email" value={attendee.email}
                      onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                      placeholder="jane@company.com" className="h-9 text-sm" data-testid="input-online-email" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="on-linkedin" className="text-xs font-medium">
                    LinkedIn Profile <span className="text-muted-foreground font-normal">(optional)</span>
                  </Label>
                  <Input id="on-linkedin" type="url" value={attendee.linkedinUrl}
                    onChange={(e) => setAttendee({ ...attendee, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..." className="h-9 text-sm" data-testid="input-online-linkedin" />
                </div>
              </div>

              {/* Navigation */}
              <div className="flex gap-3">
                <Button
                  type="button" variant="outline" onClick={() => { setError(""); go(3); }}
                  className="shrink-0" data-testid="button-online-info-back"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  type="button"
                  className="flex-1 shadow-md"
                  style={evButton ? { backgroundColor: evButton, boxShadow: `0 4px 14px ${evButton}40` } : undefined}
                  onClick={() => {
                    const err = validateOnlineInfo();
                    setError(err);
                    if (!err) { setError(""); go(5); }
                  }}
                  data-testid="button-online-info-continue"
                >
                  Continue
                </Button>
              </div>
            </motion.div>
          </AnimatePresence>
        </Shell>
      );
    }

    // ── ONLINE STEP 5: CONFIRM ──────────────────────────────────────────────
    if (step === 5) {
      const displayName = [attendee.firstName, attendee.lastName].filter(Boolean).join(" ");
      return (
        <Shell onBack={() => { setError(""); setAgreeToTerms(false); go(4); }} backLabel="Your Info" style={eventColorStyle}>
          <StepBar current={5} slug={event.slug} name={event.name} accentColor={evAccent} labels={ONLINE_STEPS} />
          <AnimatePresence mode="wait">
            <motion.div key="online-confirm" {...slide} className="w-full max-w-2xl mx-auto px-6 pb-12 space-y-4">
              <RecapChip
                sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
                platform={selectedPlatform || "No Preference"}
                onChangeSponsor={() => go(0)} onChangeDate={() => go(1)}
              />

              {/* Summary card */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-0">
                <h3 className="text-sm font-semibold text-foreground mb-4">Review Your Request</h3>
                <dl className="divide-y divide-border/40 text-sm">
                  <div className="flex items-center gap-3 py-2.5">
                    <Building2 className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                    <dt className="w-24 shrink-0 text-xs text-muted-foreground">Sponsor</dt>
                    <dd className="font-medium text-foreground flex items-center gap-1.5">
                      {selectedSponsor?.name}
                      {selectedSponsor && getSponsorEventLevel(selectedSponsor, event?.id ?? "") && (
                        <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5", levelBadge[getSponsorEventLevel(selectedSponsor, event?.id ?? "")] || "bg-muted text-muted-foreground")}>
                          {getSponsorEventLevel(selectedSponsor, event?.id ?? "") === "Platinum" && <Gem className="h-2 w-2" />}
                          {getSponsorEventLevel(selectedSponsor, event?.id ?? "")}
                        </span>
                      )}
                    </dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <Calendar className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                    <dt className="w-24 shrink-0 text-xs text-muted-foreground">Preferred Date</dt>
                    <dd className="font-medium text-foreground">{selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM d, yyyy") : "—"}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <Clock className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                    <dt className="w-24 shrink-0 text-xs text-muted-foreground">Preferred Time</dt>
                    <dd className="font-medium text-foreground">{selectedTime ? `${fmt12(selectedTime)} ${timezone}` : "—"}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <Video className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                    <dt className="w-24 shrink-0 text-xs text-muted-foreground">Platform</dt>
                    <dd className="font-medium text-foreground">{selectedPlatform || "No Preference"}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Meeting Type</dt>
                    <dd className="text-foreground">Online</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <User className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                    <dt className="w-24 shrink-0 text-xs text-muted-foreground">Name</dt>
                    <dd className="font-medium text-foreground">{displayName || "—"}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Company</dt>
                    <dd className="text-foreground">{attendee.company}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Title</dt>
                    <dd className="text-foreground">{attendee.title}</dd>
                  </div>
                  <div className="flex items-center gap-3 py-2.5">
                    <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Email</dt>
                    <dd className="text-foreground">{attendee.email}</dd>
                  </div>
                </dl>
              </div>

              <div className="space-y-4">
                <LegalAcknowledgment checked={agreeToTerms} onChange={setAgreeToTerms} id="agree-online" />

                {error && (
                  <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="button" variant="outline"
                    onClick={() => { setError(""); setAgreeToTerms(false); go(4); }}
                    className="shrink-0" data-testid="button-online-confirm-back"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" /> Back
                  </Button>
                  <Button
                    type="button"
                    size="lg"
                    disabled={submitting || !agreeToTerms}
                    className="flex-1 shadow-md"
                    style={evButton ? { backgroundColor: evButton, boxShadow: `0 4px 14px ${evButton}40` } : undefined}
                    onClick={handleOnlineSubmit}
                    data-testid="button-online-submit"
                  >
                    {submitting ? "Submitting…" : "Submit Online Meeting Request"}
                  </Button>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Shell>
      );
    }
  }

  // ── LOCATION HELPERS (onsite, steps 3+) ───────────────────────────────────
  const allLocations = event.meetingLocations ?? [];
  const selectedBlock = (event.meetingBlocks ?? []).find(
    (b) => b.date === selectedDate && toMins(b.startTime) <= toMins(selectedTime) && toMins(selectedTime) < toMins(b.endTime)
  );
  const blockLocationIds = selectedBlock?.locationIds ?? [];
  const blockFilteredLocs = blockLocationIds.length > 0
    ? allLocations.filter((loc) => blockLocationIds.includes(loc.id))
    : allLocations;
  const sponsorTier = selectedSponsor ? getSponsorEventLevel(selectedSponsor, event.id) : "";
  const locations = blockFilteredLocs.filter((loc) => {
    const allowed = loc.allowedSponsorLevels ?? [];
    if (allowed.length === 0) return true;
    if (!sponsorTier) return false;
    return (allowed as string[]).includes(sponsorTier);
  });

  function validateInfo(): string {
    if (!attendee.firstName.trim()) return "First name is required.";
    if (!attendee.company.trim())   return "Company is required.";
    if (!attendee.title.trim())     return "Title is required.";
    if (!attendee.email.trim())     return "Email is required.";
    if (!/\S+@\S+\.\S+/.test(attendee.email)) return "Please enter a valid email address.";
    if (locations.length > 0 && !selectedLoc) return "Please select a meeting location.";
    return "";
  }

  // ── STEP 3: YOUR INFO (onsite) ────────────────────────────────────────────
  if (step === 3) {
    return (
      <Shell onBack={() => go(2)} backLabel="Time" style={eventColorStyle}>
        <StepBar current={3} slug={event.slug} name={event.name} accentColor={evAccent} labels={ONSITE_STEPS} />
        <AnimatePresence mode="wait">
          <motion.div key="step-info" {...slide} className="w-full max-w-2xl mx-auto px-6 pb-12 space-y-4">
            <RecapChip sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
              onChangeSponsor={() => go(0)} onChangeDate={() => go(1)} />

            {/* Location picker */}
            {locations.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                  Meeting Location
                </h3>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => (
                    <button
                      type="button" key={loc.id}
                      onClick={() => { setSelectedLoc(loc.name); setError(""); }}
                      data-testid={`loc-btn-${loc.id}`}
                      className={cn(
                        "px-4 py-2 rounded-xl text-sm font-medium border-2 transition-all duration-150 active:scale-[0.97]",
                        selectedLoc === loc.name
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted/60",
                      )}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Info card */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-accent" style={evAccent ? { color: evAccent } : undefined} />
                  Your Info
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Already registered for this event? Enter your email to link to your record.
                </p>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-firstname" className="text-xs font-medium">First Name</Label>
                  <Input id="pub-firstname" value={attendee.firstName}
                    onChange={(e) => setAttendee({ ...attendee, firstName: e.target.value })}
                    placeholder="Jane" data-testid="input-pub-firstname" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-lastname" className="text-xs font-medium">Last Name</Label>
                  <Input id="pub-lastname" value={attendee.lastName}
                    onChange={(e) => setAttendee({ ...attendee, lastName: e.target.value })}
                    placeholder="Smith" data-testid="input-pub-lastname" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-company" className="text-xs font-medium">Company</Label>
                  <Input id="pub-company" value={attendee.company}
                    onChange={(e) => setAttendee({ ...attendee, company: e.target.value })}
                    placeholder="Acme Financial" data-testid="input-pub-company" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-title" className="text-xs font-medium">Title</Label>
                  <Input id="pub-title" value={attendee.title}
                    onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                    placeholder="VP of Finance" data-testid="input-pub-title" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="pub-email" className="text-xs font-medium">Email</Label>
                  <Input id="pub-email" type="email" value={attendee.email}
                    onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                    placeholder="jane@company.com" data-testid="input-pub-email" className="h-9 text-sm" />
                </div>
              </div>

              {/* Collapsible LinkedIn */}
              <div>
                <button
                  type="button"
                  onClick={() => setShowLinkedIn((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="btn-toggle-linkedin"
                >
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", showLinkedIn && "rotate-180")} />
                  Optional Details
                </button>
                {showLinkedIn && (
                  <div className="mt-3 space-y-1.5">
                    <Label htmlFor="pub-linkedin" className="text-xs font-medium">
                      LinkedIn Profile <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input id="pub-linkedin" type="url" value={attendee.linkedinUrl}
                      onChange={(e) => setAttendee({ ...attendee, linkedinUrl: e.target.value })}
                      placeholder="https://linkedin.com/in/..." data-testid="input-pub-linkedin" className="h-9 text-sm" />
                  </div>
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={() => go(2)} className="shrink-0" data-testid="button-info-back">
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                type="button"
                className="flex-1 shadow-md"
                style={evButton ? { backgroundColor: evButton, boxShadow: `0 4px 14px ${evButton}40` } : undefined}
                onClick={() => {
                  const err = validateInfo();
                  setError(err);
                  if (!err) { setError(""); go(4); }
                }}
                data-testid="button-info-continue"
              >
                Continue
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ── STEP 4: CONFIRM (onsite) ──────────────────────────────────────────────
  const displayName = [attendee.firstName, attendee.lastName].filter(Boolean).join(" ");
  const displayLoc  = selectedLoc || (locations[0]?.name ?? "TBD");

  return (
    <Shell onBack={() => { setError(""); setAgreeToTerms(false); go(3); }} backLabel="Your Info" style={eventColorStyle}>
      <StepBar current={4} slug={event.slug} name={event.name} accentColor={evAccent} labels={ONSITE_STEPS} />
      <AnimatePresence mode="wait">
        <motion.div key="step-confirm" {...slide} className="w-full max-w-2xl mx-auto px-6 pb-12 space-y-4">
          <RecapChip sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
            onChangeSponsor={() => go(0)} onChangeDate={() => go(1)} />

          {/* Summary card */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-0">
            <h3 className="text-sm font-semibold text-foreground mb-4">Review Your Meeting</h3>
            <dl className="divide-y divide-border/40 text-sm">
              <div className="flex items-center gap-3 py-2.5">
                <Building2 className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Sponsor</dt>
                <dd className="font-medium text-foreground flex items-center gap-1.5">
                  {selectedSponsor?.name}
                  {selectedSponsor && getSponsorEventLevel(selectedSponsor, event?.id ?? "") && (
                    <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5", levelBadge[getSponsorEventLevel(selectedSponsor, event?.id ?? "")] || "bg-muted text-muted-foreground")}>
                      {getSponsorEventLevel(selectedSponsor, event?.id ?? "") === "Platinum" && <Gem className="h-2 w-2" />}
                      {getSponsorEventLevel(selectedSponsor, event?.id ?? "")}
                    </span>
                  )}
                </dd>
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <Calendar className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Date</dt>
                <dd className="font-medium text-foreground">{format(parseISO(selectedDate), "EEEE, MMMM d, yyyy")}</dd>
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <Clock className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Time</dt>
                <dd className="font-medium text-foreground">{fmt12(selectedTime)}</dd>
              </div>
              {displayLoc && (
                <div className="flex items-center gap-3 py-2.5">
                  <MapPin className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">Location</dt>
                  <dd className="font-medium text-foreground">{displayLoc}</dd>
                </div>
              )}
              <div className="flex items-center gap-3 py-2.5">
                <User className="h-4 w-4 text-accent shrink-0" style={evAccent ? { color: evAccent } : undefined} />
                <dt className="w-24 shrink-0 text-xs text-muted-foreground">Name</dt>
                <dd className="font-medium text-foreground">{displayName || "—"}</dd>
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Company</dt>
                <dd className="text-foreground">{attendee.company}</dd>
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Title</dt>
                <dd className="text-foreground">{attendee.title}</dd>
              </div>
              <div className="flex items-center gap-3 py-2.5">
                <dt className="w-24 shrink-0 ml-7 text-xs text-muted-foreground">Email</dt>
                <dd className="text-foreground">{attendee.email}</dd>
              </div>
              {attendee.linkedinUrl && (
                <div className="flex items-center gap-3 py-2.5">
                  <Linkedin className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <dt className="w-24 shrink-0 text-xs text-muted-foreground">LinkedIn</dt>
                  <dd className="text-accent text-xs truncate">{attendee.linkedinUrl}</dd>
                </div>
              )}
            </dl>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <LegalAcknowledgment checked={agreeToTerms} onChange={setAgreeToTerms} id="agree-onsite" />

            {error && (
              <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
              </div>
            )}

            <div className="flex gap-3">
              <Button
                type="button" variant="outline"
                onClick={() => { setError(""); setAgreeToTerms(false); go(3); }}
                className="shrink-0" data-testid="button-confirm-back"
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Back
              </Button>
              <Button
                type="submit"
                size="lg"
                disabled={submitting || !agreeToTerms}
                className="flex-1 shadow-md"
                style={evButton ? { backgroundColor: evButton, boxShadow: `0 4px 14px ${evButton}40` } : undefined}
                data-testid="button-pub-submit"
              >
                {submitting ? "Confirming…" : "Confirm Meeting"}
              </Button>
            </div>
          </form>
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
