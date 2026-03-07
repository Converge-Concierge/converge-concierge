import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { AnimatePresence, motion } from "framer-motion";
import { Event, Sponsor, Meeting } from "@shared/schema";
import {
  Hexagon, Calendar, MapPin, ArrowLeft, Building2, CheckCircle,
  AlertCircle, ChevronLeft, Clock, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

// ── helpers ────────────────────────────────────────────────────────────────

const levelBorder: Record<string, string> = {
  Platinum: "border-slate-300 bg-slate-50 dark:bg-slate-900/40",
  Gold:     "border-yellow-300 bg-yellow-50 dark:bg-yellow-900/20",
  Silver:   "border-gray-300 bg-gray-50 dark:bg-gray-800/40",
  Bronze:   "border-orange-300 bg-orange-50 dark:bg-orange-900/20",
};
const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-200 text-slate-700",
  Gold:     "bg-yellow-100 text-yellow-800",
  Silver:   "bg-gray-100 text-gray-700",
  Bronze:   "bg-orange-100 text-orange-800",
};

function generateSlots(blocks: Event["meetingBlocks"], date: string): string[] {
  const slots: string[] = [];
  (blocks ?? []).filter((b) => b.date === date).forEach((b) => {
    let cur = toMins(b.startTime);
    const end = toMins(b.endTime);
    while (cur < end) {
      slots.push(fromMins(cur));
      cur += 30;
    }
  });
  return slots;
}
function toMins(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function fromMins(m: number) {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

// ── layout shell ───────────────────────────────────────────────────────────

function Shell({ children, onBack, backLabel }: { children: React.ReactNode; onBack?: () => void; backLabel?: string }) {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
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
            <ChevronLeft className="h-4 w-4" /> {backLabel ?? "Back"}
          </Button>
        ) : (
          <Button variant="outline" size="sm" onClick={() => setLocation("/")} className="gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All Events
          </Button>
        )}
      </header>
      <main className="flex-1 relative z-10 pb-20">
        {children}
      </main>
      <footer className="w-full border-t border-border/50 bg-white/50 py-5 relative z-10 text-center shrink-0">
        <p className="text-muted-foreground text-xs">
          &copy; {new Date().getFullYear()} Converge Concierge. All rights reserved.
        </p>
      </footer>
    </div>
  );
}

// ── step progress strip ────────────────────────────────────────────────────

const STEPS = ["Sponsor", "Date & Time", "Your Details"];

function StepBar({ current, eventSlug, eventName }: { current: number; eventSlug: string; eventName: string }) {
  return (
    <div className="w-full max-w-2xl mx-auto px-6 pt-6 pb-8">
      <div className="flex items-center gap-2 mb-5">
        <span className="font-mono text-xs font-semibold text-accent border border-accent/30 bg-accent/10 px-2 py-0.5 rounded-full">{eventSlug}</span>
        <span className="text-sm text-muted-foreground truncate">{eventName}</span>
      </div>
      <div className="flex items-center gap-0">
        {STEPS.map((label, i) => {
          const done   = i < current;
          const active = i === current;
          return (
            <div key={i} className="flex items-center gap-0 flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "h-6 w-6 rounded-full text-[10px] font-bold flex items-center justify-center transition-colors",
                  done   ? "bg-accent text-accent-foreground" :
                  active ? "bg-primary text-primary-foreground" :
                           "bg-muted text-muted-foreground"
                )}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={cn("text-[10px] font-medium whitespace-nowrap", active ? "text-foreground" : "text-muted-foreground")}>
                  {label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 mx-2 mb-3", done ? "bg-accent" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── main component ─────────────────────────────────────────────────────────

type AttendeeForm = { name: string; company: string; title: string; email: string; linkedinUrl: string };

const slideIn = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -40 },
  transition: { duration: 0.25 },
};

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: events  = [], isLoading: evL } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [], isLoading: spL } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: meetings = [] }                 = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });

  // ── wizard state ──
  const [step, setStep]   = useState(0);   // 0 sponsor | 1 date/time | 2 form | 3 success
  const [selectedSponsor, setSelectedSponsor] = useState<Sponsor | null>(null);
  const [selectedDate,   setSelectedDate]     = useState("");
  const [selectedTime,   setSelectedTime]     = useState("");
  const [selectedLoc,    setSelectedLoc]      = useState("");
  const [attendee, setAttendee] = useState<AttendeeForm>({ name:"", company:"", title:"", email:"", linkedinUrl:"" });
  const [submitting, setSubmitting] = useState(false);
  const [error,  setError]  = useState("");

  const event = events.find((e) => e.slug === slug);
  const eventSponsors = event
    ? sponsors.filter((s) => s.status === "active" && (s.assignedEvents ?? []).includes(event.id))
    : [];

  // Which date+time slots already have a meeting for this event?
  const bookedSlots = useMemo(() => {
    if (!event) return new Set<string>();
    return new Set(
      meetings.filter((m) => m.eventId === event.id).map((m) => `${m.date}|${m.time}`)
    );
  }, [meetings, event]);

  const availableDates = useMemo(() => {
    const dates = [...new Set((event?.meetingBlocks ?? []).map((b) => b.date))].sort();
    return dates;
  }, [event]);

  const slotsForDate = (date: string) => generateSlots(event?.meetingBlocks ?? [], date);

  // ── handlers ──
  function pickSponsor(s: Sponsor) {
    setSelectedSponsor(s);
    setSelectedDate(""); setSelectedTime(""); setSelectedLoc(""); setError("");
    setStep(1);
  }
  function pickDate(d: string) {
    setSelectedDate(d); setSelectedTime(""); setError("");
  }
  function pickTime(t: string) {
    setSelectedTime(t); setError("");
  }
  function proceedToForm() {
    if (!selectedDate || !selectedTime) return;
    setStep(2);
  }
  function backTo(s: number) {
    setError("");
    setStep(s);
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
          location:  selectedLoc,
          status:    "Scheduled",
          manualAttendee: {
            name:        attendee.name,
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
      setStep(3);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  // ── loading / not found ──
  if (evL || spL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }
  if (!event) {
    return (
      <Shell>
        <div className="flex flex-col items-center justify-center py-40 gap-4 px-6">
          <h1 className="text-2xl font-display font-bold text-foreground">Event not found</h1>
          <p className="text-muted-foreground text-sm">The event code "{slug}" does not match any active event.</p>
          <Button onClick={() => setLocation("/")} variant="outline"><ArrowLeft className="mr-2 h-4 w-4" /> Back to Events</Button>
        </div>
      </Shell>
    );
  }

  // ══════════════════════════════════════════════
  // STEP 3 — SUCCESS
  // ══════════════════════════════════════════════
  if (step === 3) {
    return (
      <Shell>
        <div className="flex items-center justify-center min-h-[70vh] px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}
            className="bg-card rounded-2xl border border-border/60 shadow-xl p-10 max-w-md w-full text-center"
          >
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-9 w-9 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Meeting Confirmed!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your 1-on-1 with <strong>{selectedSponsor?.name}</strong> has been scheduled.
            </p>
            <div className="rounded-xl bg-muted/50 border border-border/50 p-4 text-left space-y-2.5 text-sm mb-6">
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Building2 className="h-4 w-4 text-accent shrink-0" />
                <span className="font-medium text-foreground">{selectedSponsor?.name}</span>
                <span className={cn("text-xs px-2 py-0.5 rounded-full ml-auto", levelBadge[selectedSponsor?.level ?? ""] || "")}>{selectedSponsor?.level}</span>
              </div>
              <div className="flex items-center gap-2.5 text-muted-foreground">
                <Calendar className="h-4 w-4 text-accent shrink-0" />
                <span>{selectedDate} at {fmt12(selectedTime)}</span>
              </div>
              {selectedLoc && (
                <div className="flex items-center gap-2.5 text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>{selectedLoc}</span>
                </div>
              )}
              <div className="flex items-center gap-2.5 text-muted-foreground pt-1 border-t border-border/50">
                <User className="h-4 w-4 shrink-0" />
                <span>{attendee.name} · {attendee.company}</span>
              </div>
            </div>
            <Button onClick={() => setLocation("/")} className="w-full" data-testid="button-success-home">Back to Events</Button>
          </motion.div>
        </div>
      </Shell>
    );
  }

  // ══════════════════════════════════════════════
  // STEP 0 — SPONSOR SELECTION
  // ══════════════════════════════════════════════
  if (step === 0) {
    return (
      <Shell>
        <motion.div {...slideIn} className="w-full max-w-4xl mx-auto px-6 pt-10 pb-8 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent font-mono text-sm font-semibold mb-4 border border-accent/20">
            {event.slug}
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight leading-tight mb-4">
            {event.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-5 text-muted-foreground text-sm font-medium mb-10">
            <span className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              {format(parseISO(event.startDate as unknown as string), "MMMM d")} – {format(parseISO(event.endDate as unknown as string), "MMMM d, yyyy")}
            </span>
            <span className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground/70" />
              {event.location}
            </span>
          </div>

          <h2 className="text-xl font-display font-semibold text-foreground mb-2">Select a Sponsor</h2>
          <p className="text-muted-foreground text-sm mb-8">Choose a sponsor to view available time slots and book your 1-on-1 strategy session.</p>

          {eventSponsors.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No sponsors are available for this event yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
              {eventSponsors.map((sponsor, i) => (
                <motion.button
                  key={sponsor.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05 + i * 0.07 }}
                  className={cn(
                    "group relative rounded-2xl p-5 border-2 shadow-sm text-left",
                    "hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98] transition-all duration-200 cursor-pointer w-full",
                    levelBorder[sponsor.level] || "border-border bg-card"
                  )}
                  onClick={() => pickSponsor(sponsor)}
                  data-testid={`sponsor-card-${sponsor.id}`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <span className={cn("text-[11px] font-bold px-2.5 py-0.5 rounded-full", levelBadge[sponsor.level] || "")}>
                      {sponsor.level}
                    </span>
                  </div>
                  <div className="mb-3">
                    {sponsor.logoUrl ? (
                      <img src={sponsor.logoUrl} alt={sponsor.name} className="h-9 object-contain" />
                    ) : (
                      <div className="h-9 w-9 rounded-lg bg-white/80 border border-black/10 flex items-center justify-center">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <p className="font-display font-bold text-foreground group-hover:text-primary transition-colors text-base leading-tight">
                    {sponsor.name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">View available slots →</p>
                </motion.button>
              ))}
            </div>
          )}
        </motion.div>
      </Shell>
    );
  }

  // ══════════════════════════════════════════════
  // STEP 1 — DATE & TIME SELECTION
  // ══════════════════════════════════════════════
  if (step === 1) {
    const slots = selectedDate ? slotsForDate(selectedDate) : [];
    const canProceed = !!selectedDate && !!selectedTime;

    return (
      <Shell onBack={() => backTo(0)} backLabel="Sponsors">
        <StepBar current={1} eventSlug={event.slug} eventName={event.name} />

        <AnimatePresence mode="wait">
          <motion.div key="step1" {...slideIn} className="w-full max-w-2xl mx-auto px-6 space-y-8">

            {/* Sponsor recap */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50">
              <div className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0">
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{selectedSponsor?.name}</p>
                <p className="text-xs text-muted-foreground">{selectedSponsor?.level} Sponsor</p>
              </div>
              <button onClick={() => backTo(0)} className="ml-auto text-xs text-accent underline underline-offset-2">Change</button>
            </div>

            {/* Date buttons */}
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent" /> Select a Date
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableDates.map((d) => (
                  <button
                    key={d}
                    onClick={() => pickDate(d)}
                    data-testid={`date-btn-${d}`}
                    className={cn(
                      "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
                      selectedDate === d
                        ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                        : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted"
                    )}
                  >
                    {format(parseISO(d), "EEE, MMM d")}
                  </button>
                ))}
              </div>
            </div>

            {/* Time grid */}
            {selectedDate && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-accent" /> Select a Time
                </h3>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No time slots available for this date.</p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                    {slots.map((t) => {
                      const booked = bookedSlots.has(`${selectedDate}|${t}`);
                      const active = selectedTime === t;
                      return (
                        <button
                          key={t}
                          disabled={booked}
                          onClick={() => pickTime(t)}
                          data-testid={`time-btn-${t}`}
                          title={booked ? "Already booked" : fmt12(t)}
                          className={cn(
                            "py-2 rounded-lg text-xs font-medium border transition-all duration-150 text-center",
                            booked
                              ? "bg-muted text-muted-foreground/40 border-muted cursor-not-allowed line-through"
                              : active
                              ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                              : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted"
                          )}
                        >
                          {fmt12(t)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </motion.div>
            )}

            <div className="pt-2">
              <Button
                onClick={proceedToForm}
                disabled={!canProceed}
                className="w-full shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="button-proceed-to-form"
              >
                Continue to Your Details
              </Button>
            </div>
          </motion.div>
        </AnimatePresence>
      </Shell>
    );
  }

  // ══════════════════════════════════════════════
  // STEP 2 — LOCATION + ATTENDEE FORM
  // ══════════════════════════════════════════════
  const locations = event.meetingLocations ?? [];

  return (
    <Shell onBack={() => backTo(1)} backLabel="Date & Time">
      <StepBar current={2} eventSlug={event.slug} eventName={event.name} />

      <AnimatePresence mode="wait">
        <motion.div key="step2" {...slideIn} className="w-full max-w-2xl mx-auto px-6 space-y-6">

          {/* Recap bar */}
          <div className="flex flex-wrap items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border/50 text-sm">
            <span className="font-semibold text-foreground">{selectedSponsor?.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5 text-accent" />{selectedDate}
            </span>
            <span className="text-muted-foreground">·</span>
            <span className="flex items-center gap-1 text-muted-foreground">
              <Clock className="h-3.5 w-3.5 text-accent" />{fmt12(selectedTime)}
            </span>
            <button onClick={() => backTo(1)} className="ml-auto text-xs text-accent underline underline-offset-2 shrink-0">Change</button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">

            {/* Location buttons */}
            {locations.length > 0 && (
              <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
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
                        "px-4 py-2 rounded-xl text-sm font-medium border transition-all duration-150",
                        selectedLoc === loc.name
                          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
                          : "bg-card text-foreground border-border hover:border-primary/50 hover:bg-muted"
                      )}
                    >
                      {loc.name}
                    </button>
                  ))}
                </div>
                {!selectedLoc && (
                  <p className="text-xs text-muted-foreground">Please select a meeting location.</p>
                )}
              </div>
            )}

            {/* Attendee details */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4 text-accent" /> Your Details
              </h3>
              <p className="text-xs text-muted-foreground -mt-2">
                Already registered? Enter your email and we'll link this meeting to your existing record.
              </p>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2.5 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="pub-name" className="text-xs">Full Name</Label>
                  <Input id="pub-name" value={attendee.name}
                    onChange={(e) => setAttendee({ ...attendee, name: e.target.value })}
                    required placeholder="Jane Smith" data-testid="input-pub-name" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-company" className="text-xs">Company</Label>
                  <Input id="pub-company" value={attendee.company}
                    onChange={(e) => setAttendee({ ...attendee, company: e.target.value })}
                    required placeholder="Acme Financial" data-testid="input-pub-company" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-title" className="text-xs">Title</Label>
                  <Input id="pub-title" value={attendee.title}
                    onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                    required placeholder="VP of Finance" data-testid="input-pub-title" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pub-email" className="text-xs">Email</Label>
                  <Input id="pub-email" type="email" value={attendee.email}
                    onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                    required placeholder="jane@company.com" data-testid="input-pub-email" className="h-9 text-sm" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="pub-linkedin" className="text-xs">
                  LinkedIn URL <span className="text-muted-foreground font-normal">(optional)</span>
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
              className="w-full shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
              data-testid="button-pub-submit"
            >
              {submitting ? "Scheduling…" : "Confirm Meeting"}
            </Button>
          </form>
        </motion.div>
      </AnimatePresence>
    </Shell>
  );
}
