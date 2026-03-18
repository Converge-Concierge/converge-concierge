import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { format, parseISO, addDays } from "date-fns";
import { ChevronLeft, ChevronRight, Check, Calendar, Video, Monitor } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

type Mode = "onsite" | "online";

interface MeetingLocation {
  id: string;
  name: string;
  allowedSponsorLevels: string[];
}

interface AttendeeMe {
  attendee: {
    firstName: string;
    lastName: string;
    email: string;
    company?: string | null;
    title?: string | null;
  };
  event: {
    id: string;
    slug: string;
    name: string;
    startDate: string;
    endDate: string;
    buttonColor?: string | null;
    accentColor?: string | null;
    meetingLocations?: MeetingLocation[];
  };
}

interface Props {
  open: boolean;
  onClose: () => void;
  sponsorId: string;
  sponsorName: string;
  mode: Mode;
  me: AttendeeMe;
  headers: Record<string, string>;
  onSuccess: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const ONSITE_STEPS = ["Sponsor", "Date", "Time", "Your Info", "Confirm"];
const ONLINE_STEPS = ["Sponsor", "Date", "Time", "Platform", "Your Info", "Confirm"];

const TIME_SLOTS = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM",
  "12:00 PM", "12:30 PM", "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM", "5:00 PM",
];

const PLATFORMS = [
  { id: "zoom", label: "Zoom" },
  { id: "teams", label: "Microsoft Teams" },
  { id: "google_meet", label: "Google Meet" },
  { id: "other", label: "Other / To Be Decided" },
];

function timeToHHMM(slot: string): string {
  const [timePart, meridiem] = slot.split(" ");
  let [h, m] = timePart.split(":").map(Number);
  if (meridiem === "PM" && h !== 12) h += 12;
  if (meridiem === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function getEventDays(startDate: string, endDate: string): Date[] {
  const days: Date[] = [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  let cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur = addDays(cur, 1);
  }
  return days;
}

// ── Progress Bar ──────────────────────────────────────────────────────────────

function StepBar({ steps, current }: { steps: string[]; current: number }) {
  return (
    <div className="flex items-start gap-0 w-full px-2">
      {steps.map((label, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <div key={label} className="flex-1 flex flex-col items-center gap-1 relative">
            {/* connector line */}
            {i > 0 && (
              <div
                className={cn(
                  "absolute top-[14px] right-1/2 left-0 h-[2px] -translate-y-1/2",
                  done || active ? "bg-primary" : "bg-muted-foreground/20"
                )}
                style={{ right: "calc(50%)", left: 0 }}
              />
            )}
            <div
              className={cn(
                "relative z-10 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all",
                done
                  ? "bg-primary border-primary text-white"
                  : active
                  ? "bg-foreground border-foreground text-background"
                  : "bg-background border-muted-foreground/30 text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={cn(
                "text-[10px] font-medium text-center leading-tight",
                active ? "text-foreground" : done ? "text-primary" : "text-muted-foreground"
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function MeetingSchedulerDialog({
  open, onClose, sponsorId, sponsorName, mode, me, headers, onSuccess,
}: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const steps = mode === "onsite" ? ONSITE_STEPS : ONLINE_STEPS;
  // step 0 = Sponsor (already done), we start at 1
  const [step, setStep] = useState(1);

  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedPlatform, setSelectedPlatform] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [info, setInfo] = useState({
    firstName: me.attendee.firstName ?? "",
    lastName: me.attendee.lastName ?? "",
    email: me.attendee.email ?? "",
    company: me.attendee.company ?? "",
    title: me.attendee.title ?? "",
  });

  const eventDays = getEventDays(me.event.startDate, me.event.endDate);
  const ac = me.event.buttonColor || me.event.accentColor || null;

  const confirmStep = mode === "onsite" ? 4 : 5;
  const infoStep = mode === "onsite" ? 3 : 4;
  const platformStep = mode === "online" ? 3 : -1;

  const requestMeetingMutation = useMutation({
    mutationFn: () =>
      fetch("/api/attendee-portal/request-meeting", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({
          sponsorId,
          requestType: mode,
          date: selectedDate,
          time: selectedTime ? timeToHHMM(selectedTime) : "09:00",
          platform: selectedPlatform || undefined,
          locationName: selectedLocation || undefined,
          firstName: info.firstName,
          lastName: info.lastName,
          email: info.email,
          company: info.company,
          title: info.title,
        }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/suggested-meetings"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sponsors"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/meetings"] });
      toast({ title: "Meeting request sent!", description: `We'll connect you with ${sponsorName}.` });
      onSuccess();
      handleClose();
    },
  });

  function handleClose() {
    setStep(1);
    setSelectedDate("");
    setSelectedTime("");
    setSelectedPlatform("");
    setSelectedLocation("");
    onClose();
  }

  function canAdvance() {
    if (step === 1) return !!selectedDate;
    if (step === 2) return !!selectedTime;
    if (step === platformStep) return !!selectedPlatform;
    if (step === infoStep) return !!(info.firstName && info.lastName && info.email);
    return true;
  }

  function handleNext() {
    if (step < steps.length - 1) setStep(step + 1);
  }
  function handleBack() {
    if (step > 1) setStep(step - 1);
  }

  const modalTitle = mode === "onsite"
    ? `Schedule Onsite Meeting · ${sponsorName}`
    : `Online Meeting · ${sponsorName}`;

  const TitleIcon = mode === "onsite" ? Calendar : Video;

  // ── Step content renderers ─────────────────────────────────────────────────

  function renderDateStep() {
    if (mode === "onsite") {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" /> Choose a Date
            </h2>
            <p className="text-sm text-muted-foreground mt-1">Select a day to view available time slots.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {eventDays.map((day) => {
              const iso = format(day, "yyyy-MM-dd");
              const isSelected = selectedDate === iso;
              return (
                <button
                  key={iso}
                  onClick={() => setSelectedDate(iso)}
                  data-testid={`date-tile-${iso}`}
                  className={cn(
                    "flex flex-col items-center justify-center w-20 h-20 rounded-2xl border-2 font-semibold transition-all",
                    isSelected
                      ? "bg-foreground border-foreground text-background"
                      : "bg-card border-border hover:border-foreground/40 text-foreground"
                  )}
                  style={isSelected && ac ? { backgroundColor: ac, borderColor: ac } : undefined}
                >
                  <span className="text-2xl font-bold leading-none">{format(day, "d")}</span>
                  <span className="text-[11px] mt-0.5 font-medium opacity-80">{format(day, "EEE, MMM")}</span>
                </button>
              );
            })}
          </div>
        </div>
      );
    } else {
      return (
        <div className="space-y-5">
          <div>
            <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Calendar className="h-6 w-6 text-primary" /> Preferred Date
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Choose any date for your online meeting — it doesn't have to be an event day.
            </p>
          </div>
          <div className="max-w-xs">
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="rounded-xl"
              data-testid="input-preferred-date"
              min={format(new Date(), "yyyy-MM-dd")}
            />
          </div>
        </div>
      );
    }
  }

  function renderTimeStep() {
    const heading = mode === "onsite"
      ? { title: "Choose a Time", subtitle: selectedDate ? `Available slots for ${format(parseISO(selectedDate), "MMMM d")}` : "Available time slots" }
      : { title: "Preferred Time", subtitle: "Choose a time that works for you." };
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> {heading.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{heading.subtitle}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {TIME_SLOTS.map((slot) => {
            const isSelected = selectedTime === slot;
            return (
              <button
                key={slot}
                onClick={() => setSelectedTime(slot)}
                data-testid={`time-slot-${slot}`}
                className={cn(
                  "px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                  isSelected
                    ? "bg-foreground border-foreground text-background"
                    : "bg-card border-border hover:border-foreground/40 text-foreground"
                )}
                style={isSelected && ac ? { backgroundColor: ac, borderColor: ac } : undefined}
              >
                {slot}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderPlatformStep() {
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Monitor className="h-6 w-6 text-primary" /> Preferred Platform
          </h2>
          <p className="text-sm text-muted-foreground mt-1">How would you like to meet online?</p>
        </div>
        <div className="space-y-2">
          {PLATFORMS.map((p) => {
            const isSelected = selectedPlatform === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setSelectedPlatform(p.id)}
                data-testid={`platform-${p.id}`}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3.5 rounded-xl border-2 text-sm font-semibold transition-all text-left",
                  isSelected
                    ? "bg-foreground border-foreground text-background"
                    : "bg-card border-border hover:border-foreground/40 text-foreground"
                )}
                style={isSelected && ac ? { backgroundColor: ac, borderColor: ac } : undefined}
              >
                {isSelected ? <Check className="h-4 w-4 shrink-0" /> : <div className="h-4 w-4 shrink-0" />}
                {p.label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderInfoStep() {
    const locations = mode === "onsite" ? (me.event.meetingLocations ?? []) : [];
    return (
      <div className="space-y-6">
        {locations.length > 0 && (
          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-bold text-foreground">Meeting Location</h2>
              <p className="text-sm text-muted-foreground mt-0.5">Choose your preferred onsite meeting spot.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {locations.map((loc) => {
                const isSelected = selectedLocation === loc.name;
                return (
                  <button
                    key={loc.id}
                    onClick={() => setSelectedLocation(isSelected ? "" : loc.name)}
                    data-testid={`location-${loc.id}`}
                    className={cn(
                      "px-4 py-2.5 rounded-xl border-2 text-sm font-semibold transition-all",
                      isSelected
                        ? "bg-foreground border-foreground text-background"
                        : "bg-card border-border hover:border-foreground/40 text-foreground"
                    )}
                    style={isSelected && ac ? { backgroundColor: ac, borderColor: ac } : undefined}
                  >
                    {loc.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        <div>
          <h2 className="text-2xl font-bold text-foreground">Your Information</h2>
          <p className="text-sm text-muted-foreground mt-1">Confirm your details so the sponsor can reach you.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sched-first" className="text-xs font-semibold">First Name *</Label>
            <Input
              id="sched-first"
              value={info.firstName}
              onChange={(e) => setInfo({ ...info, firstName: e.target.value })}
              className="rounded-xl"
              data-testid="input-first-name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-last" className="text-xs font-semibold">Last Name *</Label>
            <Input
              id="sched-last"
              value={info.lastName}
              onChange={(e) => setInfo({ ...info, lastName: e.target.value })}
              className="rounded-xl"
              data-testid="input-last-name"
            />
          </div>
          <div className="space-y-1.5 col-span-2">
            <Label htmlFor="sched-email" className="text-xs font-semibold">Email *</Label>
            <Input
              id="sched-email"
              type="email"
              value={info.email}
              onChange={(e) => setInfo({ ...info, email: e.target.value })}
              className="rounded-xl"
              data-testid="input-email"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-company" className="text-xs font-semibold">Company</Label>
            <Input
              id="sched-company"
              value={info.company}
              onChange={(e) => setInfo({ ...info, company: e.target.value })}
              className="rounded-xl"
              data-testid="input-company"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sched-title" className="text-xs font-semibold">Title / Role</Label>
            <Input
              id="sched-title"
              value={info.title}
              onChange={(e) => setInfo({ ...info, title: e.target.value })}
              className="rounded-xl"
              data-testid="input-title"
            />
          </div>
        </div>
      </div>
    );
  }

  function renderConfirmStep() {
    const formattedDate = selectedDate ? format(parseISO(selectedDate), "EEEE, MMMM d, yyyy") : "—";
    const platformLabel = PLATFORMS.find((p) => p.id === selectedPlatform)?.label;
    return (
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Confirm Request</h2>
          <p className="text-sm text-muted-foreground mt-1">Review your meeting details before submitting.</p>
        </div>
        <div className="bg-muted/40 rounded-2xl p-4 space-y-3 text-sm">
          <Row label="Sponsor" value={sponsorName} />
          <Row label="Type" value={mode === "onsite" ? "Onsite Meeting" : "Online Meeting"} />
          <Row label="Date" value={formattedDate} />
          <Row label="Time" value={selectedTime || "—"} />
          {mode === "online" && platformLabel && <Row label="Platform" value={platformLabel} />}
          {mode === "onsite" && selectedLocation && <Row label="Location" value={selectedLocation} />}
          <Row label="Name" value={`${info.firstName} ${info.lastName}`} />
          <Row label="Email" value={info.email} />
          {info.company && <Row label="Company" value={info.company} />}
          {info.title && <Row label="Title" value={info.title} />}
        </div>
      </div>
    );
  }

  function renderStep() {
    if (step === 1) return renderDateStep();
    if (step === 2) return renderTimeStep();
    if (mode === "online" && step === platformStep) return renderPlatformStep();
    if (step === infoStep) return renderInfoStep();
    if (step === confirmStep) return renderConfirmStep();
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col gap-0 max-h-[92vh]">
        {/* ── Gradient header area ────────────────────────────────────────── */}
        <div
          className="relative px-6 pt-6 pb-5 flex flex-col gap-4"
          style={{ background: "linear-gradient(160deg, #eef4fb 0%, #f8fafc 100%)" }}
        >
          {/* Top bar: logo + back link */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center font-black text-white text-base"
                style={{ background: ac ?? "#0f172a" }}
              >
                C
              </div>
              <span className="font-bold text-base text-foreground">Converge Concierge</span>
            </div>
            <button
              onClick={handleClose}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
              data-testid="button-back-to-sponsors"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Sponsors
            </button>
          </div>

          {/* Modal title (type + sponsor) */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
            <TitleIcon className="h-4 w-4 text-primary" />
            <span>{modalTitle}</span>
          </div>

          {/* Event badge row */}
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white uppercase tracking-wide"
              style={{ background: ac ?? "#0f172a" }}
            >
              {me.event.slug}
            </span>
            <span className="text-xs text-muted-foreground truncate">{me.event.name}</span>
          </div>

          {/* Progress steps */}
          <StepBar steps={steps} current={step} />
        </div>

        {/* ── Sponsor name + change ────────────────────────────────────────── */}
        <div className="px-6 py-3 border-b border-border/40 flex items-center gap-2">
          <span className="font-semibold text-sm text-foreground">{sponsorName}</span>
          <button
            onClick={handleClose}
            className="text-xs text-primary hover:underline"
            data-testid="button-change-sponsor"
          >
            Change
          </button>
        </div>

        {/* ── Step content ─────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 py-6 min-h-0">
          {renderStep()}
        </div>

        {/* ── Footer nav ───────────────────────────────────────────────────── */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBack}
            disabled={step <= 1}
            className="flex items-center gap-1.5 rounded-xl"
            data-testid="button-back"
          >
            <ChevronLeft className="h-4 w-4" /> Back
          </Button>

          {step < confirmStep ? (
            <Button
              size="sm"
              onClick={handleNext}
              disabled={!canAdvance()}
              className="flex items-center gap-1.5 rounded-xl"
              style={ac ? { backgroundColor: ac, borderColor: ac } : undefined}
              data-testid="button-continue"
            >
              Continue <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => requestMeetingMutation.mutate()}
              disabled={requestMeetingMutation.isPending}
              className="flex items-center gap-1.5 rounded-xl"
              style={ac ? { backgroundColor: ac, borderColor: ac } : undefined}
              data-testid="button-submit"
            >
              {requestMeetingMutation.isPending ? "Submitting…" : "Submit Request"}
              <Check className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* ── Copyright footer ──────────────────────────────────────────────── */}
        <div className="px-6 py-3 border-t border-border/20 bg-muted/20 text-center">
          <p className="text-[10px] text-muted-foreground">
            © {new Date().getFullYear()} Converge Events. All rights reserved.
            <span className="mx-2">|</span>Terms of Use
            <span className="mx-2">|</span>Privacy Policy
            <span className="mx-2">|</span>Contact
            <span className="mx-2">|</span>ConvergeEvents.com
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-muted-foreground w-20 shrink-0">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
