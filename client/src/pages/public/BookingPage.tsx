import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor } from "@shared/schema";
import { Hexagon, Calendar, MapPin, ArrowLeft, CheckCircle, AlertCircle, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Link } from "wouter";
import { format } from "date-fns";

interface AttendeeForm {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  email: string;
  linkedinUrl: string;
}

export default function BookingPage() {
  const { slug, sponsorId } = useParams<{ slug: string; sponsorId: string }>();
  const [, setLocation] = useLocation();

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [], isLoading: sponsorsLoading } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const event = events.find((e) => e.slug === slug);
  const sponsor = sponsors.find((s) => s.id === sponsorId);

  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [attendee, setAttendee] = useState<AttendeeForm>({
    firstName: "", lastName: "", company: "", title: "", email: "", linkedinUrl: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isLoading = eventsLoading || sponsorsLoading;

  const blocks = event?.meetingBlocks || [];
  const locations = event?.meetingLocations || [];
  const availableDates = [...new Set(blocks.map((b) => b.date))].sort();

  const timeSlotsForDate = (date: string) => {
    const dayBlocks = blocks.filter((b) => b.date === date);
    const slots: string[] = [];
    dayBlocks.forEach((block) => {
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

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  const timeSlots = selectedDate ? timeSlotsForDate(selectedDate) : [];

  const handleDateChange = (date: string) => {
    setSelectedDate(date);
    setSelectedTime("");
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !sponsor) return;
    setError("");
    setSubmitting(true);

    try {
      const payload = {
        eventId: event.id,
        sponsorId: sponsor.id,
        date: selectedDate,
        time: selectedTime,
        location: selectedLocation,
        status: "Scheduled",
        manualAttendee: {
          firstName: attendee.firstName,
          lastName: attendee.lastName,
          name: [attendee.firstName, attendee.lastName].filter(Boolean).join(" "),
          company: attendee.company,
          title: attendee.title,
          email: attendee.email,
          linkedinUrl: attendee.linkedinUrl || undefined,
        },
      };

      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const body = await res.json();

      if (res.status === 409) {
        setError(body.message || "This time slot is already booked. Please select a different time.");
        return;
      }

      if (!res.ok) {
        setError(body.message || "Something went wrong. Please try again.");
        return;
      }

      setSuccess(true);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (!event || !sponsor) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Not found</h1>
        <p className="text-muted-foreground">The event or sponsor could not be found.</p>
        <Button onClick={() => setLocation("/")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
        <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-24 flex items-center">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-6 w-6" />
            </div>
            <span className="font-display text-2xl font-bold text-foreground tracking-tight">Converge Concierge</span>
          </Link>
        </header>
        <main className="flex-1 flex items-center justify-center px-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="bg-card rounded-2xl border border-border/60 shadow-xl p-10 max-w-md w-full text-center"
          >
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <h2 className="text-2xl font-display font-bold text-foreground mb-2">Meeting Confirmed!</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Your meeting with <strong>{sponsor.name}</strong> at <strong>{event.slug}</strong> has been scheduled.
            </p>
            <div className="rounded-lg bg-muted/50 border border-border/50 p-4 text-left space-y-2 text-sm mb-6">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4 text-accent shrink-0" />
                <span>{selectedDate} at {formatTime(selectedTime)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground/70 shrink-0" />
                <span>{selectedLocation}</span>
              </div>
            </div>
            <Button onClick={() => setLocation("/")} className="w-full">
              Back to Events
            </Button>
          </motion.div>
        </main>
      </div>
    );
  }

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 disabled:cursor-not-allowed";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">Converge Concierge</span>
        </Link>
        <Button variant="outline" onClick={() => setLocation(`/event/${slug}`)} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back to Sponsors
        </Button>
      </header>

      <main className="flex-1 relative z-10 pb-24">
        {/* Booking header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-2xl mx-auto px-6 pt-10 pb-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-lg bg-card border border-border flex items-center justify-center">
              <Building2 className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-mono font-semibold">{event.slug}</p>
              <p className="text-sm font-semibold text-foreground">{event.name}</p>
            </div>
          </div>

          <h1 className="text-3xl font-display font-bold text-foreground mb-1">
            Book a Meeting with {sponsor.name}
          </h1>
          <p className="text-muted-foreground text-sm flex items-center gap-4 mt-2">
            <span className="flex items-center gap-1.5"><Calendar className="h-3.5 w-3.5 text-accent" />
              {format(new Date(event.startDate), "MMM d")} – {format(new Date(event.endDate), "MMM d, yyyy")}
            </span>
            <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />
              {event.location}
            </span>
          </p>
        </motion.div>

        {/* Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="w-full max-w-2xl mx-auto px-6"
        >
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Time selection */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
              <h2 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Clock className="h-4 w-4 text-accent" /> Select a Time Slot
              </h2>

              {error && (
                <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pub-date">Date</Label>
                  <select id="pub-date" className={selectClass} value={selectedDate}
                    onChange={(e) => handleDateChange(e.target.value)} required
                    data-testid="select-pub-date">
                    <option value="">Select date...</option>
                    {availableDates.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pub-time">Time</Label>
                  <select id="pub-time" className={selectClass} value={selectedTime}
                    onChange={(e) => { setSelectedTime(e.target.value); setError(""); }}
                    required disabled={!selectedDate}
                    data-testid="select-pub-time">
                    <option value="">Select time...</option>
                    {timeSlots.map((t) => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pub-location">Meeting Location</Label>
                <select id="pub-location" className={selectClass} value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)} required
                  data-testid="select-pub-location">
                  <option value="">Select location...</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.name}>{loc.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Attendee details */}
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
              <h2 className="font-display font-semibold text-foreground">Your Details</h2>
              <p className="text-xs text-muted-foreground -mt-3">
                If you're already registered, we'll link this meeting to your existing record automatically.
              </p>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pub-firstname">First Name</Label>
                  <Input id="pub-firstname" value={attendee.firstName}
                    onChange={(e) => setAttendee({ ...attendee, firstName: e.target.value })}
                    required placeholder="Jane"
                    data-testid="input-pub-firstname" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pub-lastname">Last Name</Label>
                  <Input id="pub-lastname" value={attendee.lastName}
                    onChange={(e) => setAttendee({ ...attendee, lastName: e.target.value })}
                    placeholder="Smith"
                    data-testid="input-pub-lastname" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pub-company">Company</Label>
                <Input id="pub-company" value={attendee.company}
                  onChange={(e) => setAttendee({ ...attendee, company: e.target.value })}
                  required placeholder="Acme Financial"
                  data-testid="input-pub-company" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="pub-title">Title</Label>
                  <Input id="pub-title" value={attendee.title}
                    onChange={(e) => setAttendee({ ...attendee, title: e.target.value })}
                    required placeholder="VP of Finance"
                    data-testid="input-pub-title" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pub-email">Email</Label>
                  <Input id="pub-email" type="email" value={attendee.email}
                    onChange={(e) => setAttendee({ ...attendee, email: e.target.value })}
                    required placeholder="jane@company.com"
                    data-testid="input-pub-email" />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="pub-linkedin">LinkedIn URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
                <Input id="pub-linkedin" type="url" value={attendee.linkedinUrl}
                  onChange={(e) => setAttendee({ ...attendee, linkedinUrl: e.target.value })}
                  placeholder="https://linkedin.com/in/..."
                  data-testid="input-pub-linkedin" />
              </div>
            </div>

            <Button type="submit" size="lg" disabled={submitting} className="w-full shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90" data-testid="button-pub-submit">
              {submitting ? "Scheduling..." : "Confirm Meeting"}
            </Button>
          </form>
        </motion.div>
      </main>

      <footer className="w-full border-t border-border/50 bg-white/50 py-6 relative z-10 text-center">
        <p className="text-muted-foreground text-sm">
          &copy; 2026 Converge Events. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
