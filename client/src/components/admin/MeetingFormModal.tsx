import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Meeting, InsertMeeting, Event, Sponsor, Attendee, ONLINE_PLATFORMS } from "@shared/schema";
import { AlertCircle, Users, UserPlus, MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ManualAttendee {
  name: string;
  company: string;
  title: string;
  email: string;
  linkedinUrl?: string;
}

export type MeetingFormPayload = Omit<InsertMeeting, "attendeeId"> & {
  attendeeId?: string;
  manualAttendee?: ManualAttendee;
};

interface MeetingFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: MeetingFormPayload) => Promise<{ conflict?: boolean; message?: string } | void>;
  meeting?: Meeting;
  events: Event[];
  sponsors: Sponsor[];
  attendees: Attendee[];
}

const ONSITE_STATUSES  = ["Scheduled", "Completed", "Cancelled", "NoShow"]  as const;
const ONLINE_STATUSES  = ["Pending", "Confirmed", "Completed", "Cancelled"] as const;

const TIMEZONES = ["Central (CT)", "Eastern (ET)", "Mountain (MT)", "Pacific (PT)"];

const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

function onlineTimeSlots(): string[] {
  const slots: string[] = [];
  let cur = 10 * 60; // 10:00 AM
  const end = 16 * 60; // 4:00 PM
  while (cur < end) {
    const h = Math.floor(cur / 60).toString().padStart(2, "0");
    const m = (cur % 60).toString().padStart(2, "0");
    slots.push(`${h}:${m}`);
    cur += 30;
  }
  return slots;
}

const ONLINE_SLOTS = onlineTimeSlots();

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function MeetingFormModal({ isOpen, onClose, onSubmit, meeting, events, sponsors, attendees }: MeetingFormModalProps) {
  const [attendeeMode, setAttendeeMode] = useState<"existing" | "manual">("existing");
  const [formData, setFormData] = useState<Partial<InsertMeeting>>({
    eventId: "", sponsorId: "", attendeeId: "",
    meetingType: "onsite",
    date: "", time: "", location: "", status: "Scheduled",
    platform: "", preferredTimezone: "Central (CT)", notes: "",
  });
  const [manualAttendee, setManualAttendee] = useState<ManualAttendee>({
    name: "", company: "", title: "", email: "", linkedinUrl: "",
  });
  const [conflictError, setConflictError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (meeting) {
      setFormData({ ...meeting, platform: meeting.platform ?? "", preferredTimezone: meeting.preferredTimezone ?? "Central (CT)" });
      setAttendeeMode("existing");
    } else {
      setFormData({ eventId: "", sponsorId: "", attendeeId: "", meetingType: "onsite", date: "", time: "", location: "", status: "Scheduled", platform: "", preferredTimezone: "Central (CT)", notes: "" });
      setManualAttendee({ name: "", company: "", title: "", email: "", linkedinUrl: "" });
      setAttendeeMode("existing");
    }
    setConflictError("");
  }, [meeting, isOpen]);

  const isOnline = formData.meetingType === "online_request";

  const selectedEvent  = events.find((e) => e.id === formData.eventId);
  const availableSponsors = formData.eventId
    ? sponsors.filter((s) => (s.archiveState ?? "active") === "active" && (s.assignedEvents || []).some((ae) => ae.eventId === formData.eventId && (ae.archiveState ?? "active") === "active"))
    : [];
  const availableAttendees = formData.eventId
    ? attendees.filter((a) => a.assignedEvent === formData.eventId)
    : [];
  const availableBlocks   = selectedEvent?.meetingBlocks || [];
  const availableLocations = selectedEvent?.meetingLocations || [];
  const availableDates     = [...new Set(availableBlocks.map((b) => b.date))].sort();

  const timeSlotsForDate = (date: string) => {
    const blocks = availableBlocks.filter((b) => b.date === date);
    const slots: string[] = [];
    blocks.forEach((block) => {
      const [sh, sm] = block.startTime.split(":").map(Number);
      const [eh, em] = block.endTime.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur < end) {
        const h = Math.floor(cur / 60).toString().padStart(2, "0");
        const m = (cur % 60).toString().padStart(2, "0");
        slots.push(`${h}:${m}`);
        cur += 30;
      }
    });
    return slots;
  };

  function handleEventChange(eventId: string) {
    setFormData({ ...formData, eventId, sponsorId: "", attendeeId: "", date: "", time: "", location: "" });
    setConflictError("");
  }

  function handleTypeChange(type: "onsite" | "online_request") {
    setFormData({
      ...formData,
      meetingType: type,
      date: "",
      time: "",
      location: "",
      status: type === "onsite" ? "Scheduled" : "Pending",
    });
    setConflictError("");
  }

  function handleModeSwitch(mode: "existing" | "manual") {
    setAttendeeMode(mode);
    setFormData({ ...formData, attendeeId: "" });
    setConflictError("");
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConflictError("");
    setSubmitting(true);

    const payload: MeetingFormPayload = {
      eventId:           formData.eventId!,
      sponsorId:         formData.sponsorId!,
      meetingType:       formData.meetingType as "onsite" | "online_request",
      date:              formData.date!,
      time:              formData.time!,
      location:          isOnline ? "Online" : formData.location!,
      status:            formData.status as InsertMeeting["status"],
      platform:          isOnline ? (formData.platform || null) : null,
      preferredTimezone: isOnline ? (formData.preferredTimezone || null) : null,
      notes:             formData.notes || undefined,
    };

    if (attendeeMode === "existing") {
      payload.attendeeId = formData.attendeeId!;
    } else {
      payload.manualAttendee = {
        name:        manualAttendee.name,
        company:     manualAttendee.company,
        title:       manualAttendee.title,
        email:       manualAttendee.email,
        linkedinUrl: manualAttendee.linkedinUrl || undefined,
      };
    }

    try {
      const result = await onSubmit(payload);
      if (result && result.conflict) {
        setConflictError(result.message || "A meeting already exists at this event, date, and time.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const timeSlots = formData.date ? timeSlotsForDate(formData.date) : [];
  const statusOptions = isOnline ? ONLINE_STATUSES : ONSITE_STATUSES;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{meeting ? "Edit Meeting" : "Schedule Meeting"}</DialogTitle>
        </DialogHeader>
        <form id="meeting-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {conflictError && (
            <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{conflictError}</span>
            </div>
          )}

          {/* Meeting Type */}
          {!meeting && (
            <div className="space-y-2">
              <Label>Meeting Type</Label>
              <div className="flex rounded-lg border border-input overflow-hidden text-sm w-fit">
                <button
                  type="button"
                  onClick={() => handleTypeChange("onsite")}
                  className={cn("flex items-center gap-2 px-4 py-2 font-medium transition-colors", !isOnline ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
                  data-testid="type-onsite"
                >
                  <MapPin className="h-3.5 w-3.5" /> Onsite
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange("online_request")}
                  className={cn("flex items-center gap-2 px-4 py-2 font-medium transition-colors border-l border-input", isOnline ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
                  data-testid="type-online"
                >
                  <Video className="h-3.5 w-3.5" /> Online Meeting
                </button>
              </div>
              {isOnline && (
                <p className="text-xs text-muted-foreground">This is a request — the sponsor will contact the attendee to confirm.</p>
              )}
            </div>
          )}

          {/* Event */}
          <div className="space-y-2">
            <Label htmlFor="mt-event">Event</Label>
            <select id="mt-event" className={selectClass} value={formData.eventId}
              onChange={(e) => handleEventChange(e.target.value)} required data-testid="select-meeting-event">
              <option value="">Select an event...</option>
              {events.filter((e) => (e.archiveState ?? "active") === "active").map((ev) => (
                <option key={ev.id} value={ev.id}>[{ev.slug}] {ev.name}</option>
              ))}
            </select>
          </div>

          {/* Sponsor */}
          <div className="space-y-2">
            <Label htmlFor="mt-sponsor">Sponsor</Label>
            <select id="mt-sponsor" className={selectClass} value={formData.sponsorId}
              onChange={(e) => setFormData({ ...formData, sponsorId: e.target.value })}
              required disabled={!formData.eventId} data-testid="select-meeting-sponsor">
              <option value="">Select sponsor...</option>
              {availableSponsors.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {formData.eventId && availableSponsors.length === 0 && (
              <p className="text-xs text-muted-foreground">No sponsors assigned to this event.</p>
            )}
          </div>

          {/* Attendee */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Attendee</Label>
              {!meeting && (
                <div className="flex rounded-md border border-input overflow-hidden text-xs">
                  <button type="button" onClick={() => handleModeSwitch("existing")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${attendeeMode === "existing" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    data-testid="mode-select-existing">
                    <Users className="h-3 w-3" /> Select existing
                  </button>
                  <button type="button" onClick={() => handleModeSwitch("manual")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors border-l border-input ${attendeeMode === "manual" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
                    data-testid="mode-enter-manually">
                    <UserPlus className="h-3 w-3" /> Enter manually
                  </button>
                </div>
              )}
            </div>

            {attendeeMode === "existing" ? (
              <div>
                <select id="mt-attendee" className={selectClass} value={formData.attendeeId}
                  onChange={(e) => setFormData({ ...formData, attendeeId: e.target.value })}
                  required disabled={!formData.eventId} data-testid="select-meeting-attendee">
                  <option value="">Select attendee...</option>
                  {availableAttendees.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} — {a.company}</option>
                  ))}
                </select>
                {formData.eventId && availableAttendees.length === 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    No pre-registered attendees for this event.{" "}
                    <button type="button" className="underline text-accent" onClick={() => handleModeSwitch("manual")}>
                      Enter manually instead.
                    </button>
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-accent/40 bg-accent/5 p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  If this email matches an existing attendee, the meeting will be linked to their record automatically.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="ma-name" className="text-xs">Name</Label>
                    <Input id="ma-name" value={manualAttendee.name}
                      onChange={(e) => setManualAttendee({ ...manualAttendee, name: e.target.value })}
                      required={attendeeMode === "manual"} className="h-8 text-sm" data-testid="input-manual-name" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ma-company" className="text-xs">Company</Label>
                    <Input id="ma-company" value={manualAttendee.company}
                      onChange={(e) => setManualAttendee({ ...manualAttendee, company: e.target.value })}
                      required={attendeeMode === "manual"} className="h-8 text-sm" data-testid="input-manual-company" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ma-title" className="text-xs">Title</Label>
                    <Input id="ma-title" value={manualAttendee.title}
                      onChange={(e) => setManualAttendee({ ...manualAttendee, title: e.target.value })}
                      required={attendeeMode === "manual"} className="h-8 text-sm" data-testid="input-manual-title" />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="ma-email" className="text-xs">Email</Label>
                    <Input id="ma-email" type="email" value={manualAttendee.email}
                      onChange={(e) => setManualAttendee({ ...manualAttendee, email: e.target.value })}
                      required={attendeeMode === "manual"} className="h-8 text-sm" data-testid="input-manual-email" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="ma-linkedin" className="text-xs">LinkedIn URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                  <Input id="ma-linkedin" type="url" value={manualAttendee.linkedinUrl || ""}
                    onChange={(e) => setManualAttendee({ ...manualAttendee, linkedinUrl: e.target.value })}
                    placeholder="https://linkedin.com/in/..." className="h-8 text-sm" data-testid="input-manual-linkedin" />
                </div>
              </div>
            )}
          </div>

          {/* ── Onsite fields ── */}
          {!isOnline && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mt-date">Date</Label>
                  <select id="mt-date" className={selectClass} value={formData.date}
                    onChange={(e) => { setFormData({ ...formData, date: e.target.value, time: "" }); setConflictError(""); }}
                    required disabled={!formData.eventId} data-testid="select-meeting-date">
                    <option value="">Select date...</option>
                    {availableDates.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mt-time">Time Slot</Label>
                  <select id="mt-time" className={selectClass} value={formData.time}
                    onChange={(e) => { setFormData({ ...formData, time: e.target.value }); setConflictError(""); }}
                    required disabled={!formData.date} data-testid="select-meeting-time">
                    <option value="">Select time...</option>
                    {timeSlots.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                  </select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="mt-location">Location</Label>
                <select id="mt-location" className={selectClass} value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  required disabled={!formData.eventId} data-testid="select-meeting-location">
                  <option value="">Select location...</option>
                  {availableLocations.map((loc) => <option key={loc.id} value={loc.name}>{loc.name}</option>)}
                </select>
              </div>
            </>
          )}

          {/* ── Online Request fields ── */}
          {isOnline && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mt-pref-date">Preferred Date</Label>
                  <Input id="mt-pref-date" type="date" value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required data-testid="input-online-date" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mt-pref-time">Preferred Time</Label>
                  <select id="mt-pref-time" className={selectClass} value={formData.time}
                    onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                    required data-testid="select-online-time">
                    <option value="">Select time...</option>
                    {ONLINE_SLOTS.map((t) => <option key={t} value={t}>{fmt12(t)}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="mt-timezone">Time Zone</Label>
                  <select id="mt-timezone" className={selectClass} value={formData.preferredTimezone ?? "Central (CT)"}
                    onChange={(e) => setFormData({ ...formData, preferredTimezone: e.target.value })}
                    data-testid="select-online-timezone">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mt-platform">Platform <span className="text-muted-foreground font-normal text-xs">(optional)</span></Label>
                  <select id="mt-platform" className={selectClass} value={formData.platform ?? ""}
                    onChange={(e) => setFormData({ ...formData, platform: e.target.value })}
                    data-testid="select-online-platform">
                    {ONLINE_PLATFORMS.map((p) => <option key={p} value={p === "No Preference" ? "" : p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Status */}
          <div className="space-y-2">
            <Label htmlFor="mt-status">Status</Label>
            <select id="mt-status" className={selectClass} value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as InsertMeeting["status"] })}
              data-testid="select-meeting-status">
              {statusOptions.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="mt-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Textarea id="mt-notes" value={formData.notes || ""}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3} placeholder="Add any notes about this meeting..."
              data-testid="textarea-meeting-notes" />
          </div>
        </form>
        <DialogFooter className="p-6 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="meeting-form" disabled={submitting} data-testid="button-submit-meeting">
            {submitting ? "Saving..." : meeting ? "Update Meeting" : isOnline ? "Submit Request" : "Schedule Meeting"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
