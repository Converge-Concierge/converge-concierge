import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AnimatePresence, motion } from "framer-motion";
import { Event, Sponsor, Meeting, SPONSOR_ATTRIBUTES } from "@shared/schema";
import {
  Hexagon, Calendar, MapPin, ArrowLeft, Building2, CheckCircle,
  AlertCircle, ChevronLeft, Clock, User, Video, Download, ExternalLink,
  Filter, X,
} from "lucide-react";
import { ONLINE_PLATFORMS } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { downloadICS, googleCalendarUrl } from "@/lib/ics";

// ── Helpers ─────────────────────────────────────────────────────────────────

const levelBorder: Record<string, string> = {
  Platinum: "border-slate-300 bg-slate-50",
  Gold:     "border-yellow-300 bg-yellow-50",
  Silver:   "border-gray-300 bg-gray-50",
  Bronze:   "border-orange-300 bg-orange-50",
};
const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-200 text-slate-700",
  Gold:     "bg-yellow-100 text-yellow-800",
  Silver:   "bg-gray-100 text-gray-700",
  Bronze:   "bg-orange-100 text-orange-800",
};
const levelAccent: Record<string, string> = {
  Platinum: "bg-slate-600 hover:bg-slate-700",
  Gold:     "bg-yellow-600 hover:bg-yellow-700",
  Silver:   "bg-gray-500 hover:bg-gray-600",
  Bronze:   "bg-orange-600 hover:bg-orange-700",
};

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

// ── Shell ────────────────────────────────────────────────────────────────────

function Shell({
  children, onBack, backLabel, style,
}: { children: React.ReactNode; onBack?: () => void; backLabel?: string; style?: React.CSSProperties }) {
  const [, nav] = useLocation();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col" style={style}>
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between shrink-0">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:block">
            Converge Concierge
          </span>
        </Link>
        {onBack ? (
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 text-muted-foreground">
            <ChevronLeft className="h-4 w-4" />{backLabel ?? "Back"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => nav("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" />All Events
          </Button>
        )}
      </header>
      <main className="flex-1 relative z-10 pb-20">{children}</main>
      <footer className="w-full border-t border-border/50 bg-white/50 py-5 relative z-10 text-center shrink-0">
        <p className="text-muted-foreground text-xs">
          &copy; 2026 Converge Events. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ── StepBar ──────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Sponsor", "Date", "Time", "Your Details"];

function StepBar({ current, slug, name }: { current: number; slug: string; name: string }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="font-mono text-xs font-semibold text-accent border border-accent/30 bg-accent/10 px-2 py-0.5 rounded-full">
          {slug}
        </span>
        <span className="text-sm text-muted-foreground truncate">{name}</span>
      </div>
      <div className="flex items-center">
        {STEP_LABELS.map((label, i) => {
          const done = i < current;
          const active = i === current;
          return (
            <div key={i} className={cn("flex items-center", i < STEP_LABELS.length - 1 ? "flex-1" : "")}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className={cn(
                  "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-all duration-200",
                  done   ? "bg-accent text-accent-foreground scale-90"
                  : active ? "bg-primary text-primary-foreground ring-4 ring-primary/20"
                  :          "bg-muted text-muted-foreground",
                )}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn(
                  "text-[10px] font-medium whitespace-nowrap",
                  active ? "text-foreground" : "text-muted-foreground",
                )}>{label}</span>
              </div>
              {i < STEP_LABELS.length - 1 && (
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
  sponsor, date, time, onChangeSponsor, onChangeDate,
}: { sponsor?: Sponsor | null; date?: string; time?: string; onChangeSponsor?: () => void; onChangeDate?: () => void }) {
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

type AttendeeForm = { firstName: string; lastName: string; company: string; title: string; email: string; linkedinUrl: string };
type OnlineForm = { date: string; time: string; timezone: string; platform: string };

const TIMEZONES = ["Central (CT)", "Eastern (ET)", "Mountain (MT)", "Pacific (PT)"];

function onlineSlots(): string[] {
  const slots: string[] = [];
  let cur = 10 * 60;
  while (cur < 16 * 60) {
    slots.push(`${String(Math.floor(cur / 60)).padStart(2, "0")}:${String(cur % 60).padStart(2, "0")}`);
    cur += 30;
  }
  return slots;
}
const ONLINE_SLOTS = onlineSlots();

// ── Component ─────────────────────────────────────────────────────────────────

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, nav] = useLocation();

  const { data: events   = [], isLoading: evL } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [], isLoading: spL } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: meetings = [] }                 = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });

  // step 0=sponsor 1=date 2=time 3=form 4=success
  const [step, setStep] = useState(0);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [selectedDate,    setSelectedDate]    = useState("");
  const [selectedTime,    setSelectedTime]    = useState("");
  const [selectedLoc,     setSelectedLoc]     = useState("");
  const [attendee, setAttendee] = useState<AttendeeForm>({ firstName: "", lastName: "", company: "", title: "", email: "", linkedinUrl: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // ── Online meeting state ──────────────────────────────────────────────────
  const [meetingMode, setMeetingMode] = useState<"onsite" | "online">("onsite");
  const [onlineForm, setOnlineForm] = useState<OnlineForm>({ date: "", time: "", timezone: "Central (CT)", platform: "" });
  const [createdMeetingId, setCreatedMeetingId] = useState<string | null>(null);

  const event = events.find((e) => e.slug === slug);
  const eventSponsors = event
    ? sponsors.filter((s) => (s.archiveState ?? "active") === "active" && (s.assignedEvents ?? []).some((ae) => ae.eventId === event.id && (ae.archiveState ?? "active") === "active"))
    : [];

  const attributesInUse = useMemo(
    () => SPONSOR_ATTRIBUTES.filter((a) => eventSponsors.some((s) => (s.attributes ?? []).includes(a))),
    [eventSponsors],
  );

  const filteredSponsors = useMemo(() => {
    if (activeFilters.length === 0) return eventSponsors;
    return eventSponsors.filter((s) => activeFilters.some((f) => (s.attributes ?? []).includes(f)));
  }, [eventSponsors, activeFilters]);

  const eventColorStyle = useMemo((): React.CSSProperties => {
    if (!event) return {};
    const vars: Record<string, string> = {};
    if (event.primaryColor)   vars["--event-primary"]    = event.primaryColor;
    if (event.secondaryColor) vars["--event-secondary"]  = event.secondaryColor;
    if (event.accentColor)    vars["--event-accent"]     = event.accentColor;
    if (event.buttonColor)    vars["--event-button"]     = event.buttonColor;
    if (event.bgAccentColor)  vars["--event-bg-accent"]  = event.bgAccentColor;
    return vars as React.CSSProperties;
  }, [event]);

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

  const availableDates = useMemo(
    () => [...new Set((event?.meetingBlocks ?? []).map((b) => b.date))].sort(),
    [event],
  );

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
    setOnlineForm({ date: "", time: "", timezone: "Central (CT)", platform: "" });
    setAttendee({ firstName: "", lastName: "", company: "", title: "", email: "", linkedinUrl: "" });
    setError("");
    go(3);
  }

  function pickDate(d: string) {
    setSelectedDate(d); setSelectedTime(""); setError(""); go(2);
  }
  function pickTime(t: string) {
    setSelectedTime(t); setError(""); go(3);
  }

  async function handleOnlineSubmit(e: React.FormEvent) {
    e.preventDefault();
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
          date:              onlineForm.date,
          time:              onlineForm.time,
          location:          "Online",
          platform:          onlineForm.platform || null,
          preferredTimezone: onlineForm.timezone,
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
      go(4);
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
      go(4);
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

  // ── STEP 4: SUCCESS ───────────────────────────────────────────────────────
  if (step === 4) {
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
                  Your online meeting request has been submitted. The sponsor will contact you to confirm the meeting time and send the meeting link.
                </p>
                <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-left space-y-3 text-sm mb-6">
                  <div className="flex items-center gap-2.5">
                    <Building2 className="h-4 w-4 text-accent shrink-0" />
                    <span className="font-semibold text-foreground">{selectedSponsor?.name}</span>
                    <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto", levelBadge[selectedSponsor?.level ?? ""] || "")}>
                      {selectedSponsor?.level}
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Calendar className="h-4 w-4 text-accent shrink-0" />
                    <span>Preferred: {format(parseISO(onlineForm.date), "EEEE, MMMM d, yyyy")}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Clock className="h-4 w-4 text-accent shrink-0" />
                    <span>{fmt12(onlineForm.time)} {onlineForm.timezone}</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-muted-foreground">
                    <Video className="h-4 w-4 shrink-0" />
                    <span>{onlineForm.platform || "No platform preference"}</span>
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
                    <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto", levelBadge[selectedSponsor?.level ?? ""] || "")}>
                      {selectedSponsor?.level}
                    </span>
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
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 text-xs"
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
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1"
                  data-testid="link-add-google-calendar"
                >
                  <Button variant="outline" size="sm" className="w-full gap-2 text-xs">
                    <ExternalLink className="h-3.5 w-3.5" /> Add to Google Calendar
                  </Button>
                </a>
              </div>
            )}
            <Button onClick={() => nav(`/event/${event.slug}`)} className="w-full" data-testid="button-success-home">
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
        <motion.div {...slide} className="w-full max-w-5xl mx-auto px-6 pt-10 pb-12">
          {/* Event header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent font-mono text-sm font-semibold mb-4 border border-accent/20">
              {event.slug}
            </div>
            <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight leading-tight mb-4">
              {event.name}
            </h1>
            <div className="flex flex-wrap items-center justify-center gap-5 text-muted-foreground text-sm font-medium">
              <span className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" />
                {format(parseISO(event.startDate as unknown as string), "MMMM d")}
                {" – "}
                {format(parseISO(event.endDate as unknown as string), "MMMM d, yyyy")}
              </span>
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground/70" />
                {event.location}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              <h2 className="text-2xl font-display font-semibold text-foreground mb-1">Select a Sponsor</h2>
              <p className="text-muted-foreground text-sm">
                Choose who you'd like to meet with. Each 1-on-1 is a private 30-minute strategy session.
              </p>
            </div>
            {eventSponsors.length > 0 && (
              <span className="text-xs text-muted-foreground shrink-0">
                {filteredSponsors.length} of {eventSponsors.length} sponsor{eventSponsors.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {/* Attribute filter bar */}
          {attributesInUse.length > 0 && (
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex items-center gap-1.5 flex-wrap">
                {attributesInUse.map((attr) => {
                  const active = activeFilters.includes(attr);
                  return (
                    <button
                      key={attr}
                      onClick={() => setActiveFilters((prev) => active ? prev.filter((f) => f !== attr) : [...prev, attr])}
                      data-testid={`filter-${attr.toLowerCase().replace(/\s+/g, "-")}`}
                      className={cn(
                        "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                        active
                          ? "bg-accent text-accent-foreground border-accent"
                          : "bg-card text-muted-foreground border-border hover:border-accent/50 hover:text-foreground",
                      )}
                    >
                      {attr}
                    </button>
                  );
                })}
                {activeFilters.length > 0 && (
                  <button
                    onClick={() => setActiveFilters([])}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs text-muted-foreground hover:text-destructive transition-colors"
                    data-testid="filter-clear"
                  >
                    <X className="h-3 w-3" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}

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
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredSponsors.map((sponsor, i) => (
                <motion.div
                  key={sponsor.id}
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.04 + i * 0.07 }}
                  className={cn(
                    "flex flex-col rounded-2xl border-2 shadow-sm overflow-hidden",
                    "hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200",
                    levelBorder[sponsor.level] || "border-border bg-card",
                  )}
                  data-testid={`sponsor-card-${sponsor.id}`}
                >
                  {/* Card body */}
                  <div className="flex-1 p-6">
                    {/* Level badge */}
                    <div className="mb-4">
                      <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-full", levelBadge[sponsor.level] || "bg-muted text-muted-foreground")}>
                        {sponsor.level} Sponsor
                      </span>
                    </div>

                    {/* Logo / Icon */}
                    <div className="mb-4 h-14 flex items-center">
                      {sponsor.logoUrl ? (
                        <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 max-w-[120px] object-contain" />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-white border border-black/10 shadow-sm flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground/60" />
                        </div>
                      )}
                    </div>

                    {/* Name */}
                    <h3 className="text-lg font-display font-bold text-foreground leading-tight">
                      {sponsor.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-muted-foreground">30-minute 1-on-1 session available</p>
                      <Link
                        href={`/event/${event.slug}/sponsor/${sponsor.id}`}
                        className="text-xs text-accent underline underline-offset-2 hover:opacity-80 transition-opacity flex items-center gap-1"
                        data-testid={`link-sponsor-profile-${sponsor.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-3 w-3" /> View Profile
                      </Link>
                    </div>
                  </div>

                  {/* CTA buttons pinned to bottom */}
                  <div className="px-6 pb-6 space-y-2">
                    <button
                      onClick={() => pickSponsor(sponsor)}
                      data-testid={`btn-meet-${sponsor.id}`}
                      className={cn(
                        "w-full py-2.5 rounded-xl text-white text-sm font-semibold transition-all duration-150 active:scale-[0.98]",
                        levelAccent[sponsor.level] || "bg-primary hover:bg-primary/90",
                      )}
                    >
                      Schedule Onsite Meeting
                    </button>
                    {sponsor.allowOnlineMeetings && (
                      <button
                        onClick={() => pickOnlineMeeting(sponsor)}
                        data-testid={`btn-online-${sponsor.id}`}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold border-2 border-violet-300 text-violet-700 bg-violet-50 hover:bg-violet-100 transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Video className="h-4 w-4" /> Request Online Meeting
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </Shell>
    );
  }

  // ── STEP 1: DATE SELECTION ────────────────────────────────────────────────
  if (step === 1) {
    return (
      <Shell onBack={() => go(0)} backLabel="Sponsors">
        <StepBar current={1} slug={event.slug} name={event.name} />
        <AnimatePresence mode="wait">
          <motion.div key="step-date" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-7">
            <RecapChip sponsor={selectedSponsor} onChangeSponsor={() => go(0)} />

            <div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-1 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-accent" /> Choose a Date
              </h2>
              <p className="text-sm text-muted-foreground mb-5">Select a day to view available time slots.</p>

              <div className="flex flex-wrap gap-3">
                {availableDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => pickDate(d)}
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
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ── STEP 2: TIME SELECTION ────────────────────────────────────────────────
  if (step === 2) {
    const slots = generateSlots(event.meetingBlocks ?? [], selectedDate);
    const allBooked = slots.length > 0 && slots.every((t) => bookedSlots.has(`${selectedSponsor?.id}|${selectedDate}|${t}`));

    return (
      <Shell onBack={() => go(1)} backLabel="Date">
        <StepBar current={2} slug={event.slug} name={event.name} />
        <AnimatePresence mode="wait">
          <motion.div key="step-time" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-7">
            <RecapChip sponsor={selectedSponsor} date={selectedDate} onChangeSponsor={() => go(0)} onChangeDate={() => go(1)} />

            <div>
              <h2 className="text-xl font-display font-semibold text-foreground mb-1 flex items-center gap-2">
                <Clock className="h-5 w-5 text-accent" /> Choose a Time
              </h2>
              <p className="text-sm text-muted-foreground mb-5">
                Greyed-out slots are already taken. Each session is 30 minutes.
              </p>

              {slots.length === 0 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">No time slots configured for this date.</p>
              ) : allBooked ? (
                <div className="flex flex-col items-center gap-3 py-10 text-muted-foreground">
                  <Clock className="h-8 w-8 opacity-30" />
                  <p className="text-sm">All time slots on this date are fully booked.</p>
                  <Button variant="outline" size="sm" onClick={() => go(1)}>Choose a different date</Button>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                  {slots.map((t) => {
                    const booked = bookedSlots.has(`${selectedSponsor?.id}|${selectedDate}|${t}`);
                    const active = selectedTime === t;
                    return (
                      <button
                        key={t}
                        disabled={booked}
                        onClick={() => pickTime(t)}
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
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ── STEP 3: ATTENDEE DETAILS (Onsite) / ONLINE MEETING FORM ─────────────
  const allLocations = event.meetingLocations ?? [];
  const selectedBlock = (event.meetingBlocks ?? []).find((b) => b.date === selectedDate && toMins(b.startTime) <= toMins(selectedTime) && toMins(selectedTime) < toMins(b.endTime));
  const blockLocationIds = selectedBlock?.locationIds ?? [];
  const locations = blockLocationIds.length > 0
    ? allLocations.filter((loc) => blockLocationIds.includes(loc.id))
    : allLocations;

  // Online meeting request form
  if (meetingMode === "online") {
    const selectCls = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";
    return (
      <Shell onBack={() => { setMeetingMode("onsite"); go(0); }} backLabel="Sponsors">
        <AnimatePresence mode="wait">
          <motion.div key="online-form" {...slide} className="w-full max-w-2xl mx-auto px-6 pt-8 pb-16 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                <Video className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <h2 className="text-xl font-display font-semibold text-foreground">Request an Online Meeting</h2>
                <p className="text-sm text-muted-foreground">with <strong>{selectedSponsor?.name}</strong></p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground rounded-xl bg-violet-50 border border-violet-200 px-4 py-3">
              Submit your preferred time and the sponsor will reach out to confirm the meeting and send a link.
            </p>

            <form onSubmit={handleOnlineSubmit} className="space-y-5">
              {error && (
                <div className="flex items-start gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" /><span>{error}</span>
                </div>
              )}

              {/* Meeting request details */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground">Meeting Request Details</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="on-date" className="text-xs font-medium">Preferred Date</Label>
                    <Input id="on-date" type="date" value={onlineForm.date}
                      onChange={(e) => setOnlineForm({ ...onlineForm, date: e.target.value })}
                      required className="h-9 text-sm" data-testid="input-online-date" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-time" className="text-xs font-medium">Preferred Time</Label>
                    <select id="on-time" className={selectCls} value={onlineForm.time}
                      onChange={(e) => setOnlineForm({ ...onlineForm, time: e.target.value })}
                      required data-testid="select-online-time">
                      <option value="">Select time...</option>
                      {ONLINE_SLOTS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-tz" className="text-xs font-medium">Time Zone</Label>
                    <select id="on-tz" className={selectCls} value={onlineForm.timezone}
                      onChange={(e) => setOnlineForm({ ...onlineForm, timezone: e.target.value })}
                      data-testid="select-online-timezone">
                      {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-platform" className="text-xs font-medium">
                      Platform <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <select id="on-platform" className={selectCls} value={onlineForm.platform}
                      onChange={(e) => setOnlineForm({ ...onlineForm, platform: e.target.value })}
                      data-testid="select-online-platform">
                      {ONLINE_PLATFORMS.map((p) => (
                        <option key={p} value={p === "No Preference" ? "" : p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Attendee details */}
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <User className="h-4 w-4 text-accent" /> Your Details
                </h3>
                <p className="text-xs text-muted-foreground -mt-2">
                  Already registered for this event? Enter your email and we'll link the request to your record.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="on-firstname" className="text-xs font-medium">First Name</Label>
                    <Input id="on-firstname" value={attendee.firstName}
                      onChange={(e) => setAttendee({ ...attendee, firstName: e.target.value })}
                      required placeholder="Jane" className="h-9 text-sm" data-testid="input-online-firstname" />
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
                      required placeholder="Acme Financial" className="h-9 text-sm" data-testid="input-online-company" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-title" className="text-xs font-medium">Title</Label>
                    <Input id="on-title" value={attendee.title}
                      onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                      required placeholder="VP of Finance" className="h-9 text-sm" data-testid="input-online-title" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="on-email" className="text-xs font-medium">Email</Label>
                    <Input id="on-email" type="email" value={attendee.email}
                      onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                      required placeholder="jane@company.com" className="h-9 text-sm" data-testid="input-online-email" />
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

              <Button
                type="submit"
                size="lg"
                disabled={submitting}
                className="w-full bg-violet-600 text-white hover:bg-violet-700 shadow-md shadow-violet-200"
                data-testid="button-online-submit"
              >
                {submitting ? "Submitting…" : "Submit Online Meeting Request"}
              </Button>
            </form>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  return (
    <Shell onBack={() => go(2)} backLabel="Time">
      <StepBar current={3} slug={event.slug} name={event.name} />
      <AnimatePresence mode="wait">
        <motion.div key="step-form" {...slide} className="w-full max-w-2xl mx-auto px-6 space-y-6">
          <RecapChip sponsor={selectedSponsor} date={selectedDate} time={selectedTime}
            onChangeSponsor={() => go(0)} onChangeDate={() => go(1)} />

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Location */}
            {locations.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-accent" /> Meeting Location
                </h3>
                <div className="flex flex-wrap gap-2">
                  {locations.map((loc) => (
                    <button
                      type="button"
                      key={loc.id}
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

            {/* Attendee fields */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-accent" /> Your Details
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">
                Already registered for this event? Enter your email and we'll link the meeting to your record.
              </p>

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
                    required placeholder="Jane" data-testid="input-pub-firstname" className="h-9 text-sm" />
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
                    required placeholder="Acme Financial" data-testid="input-pub-company" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-title" className="text-xs font-medium">Title</Label>
                  <Input id="pub-title" value={attendee.title}
                    onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                    required placeholder="VP of Finance" data-testid="input-pub-title" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-email" className="text-xs font-medium">Email</Label>
                  <Input id="pub-email" type="email" value={attendee.email}
                    onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                    required placeholder="jane@company.com" data-testid="input-pub-email" className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pub-linkedin" className="text-xs font-medium">
                  LinkedIn Profile <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input id="pub-linkedin" type="url" value={attendee.linkedinUrl}
                  onChange={(e) => setAttendee({ ...attendee, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..." data-testid="input-pub-linkedin" className="h-9 text-sm" />
              </div>
            </div>

            <Button
              type="submit"
              size="lg"
              disabled={submitting || (locations.length > 0 && !selectedLoc)}
              className="w-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20"
              data-testid="button-pub-submit"
            >
              {submitting ? "Confirming…" : "Confirm Meeting"}
            </Button>
          </form>
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
