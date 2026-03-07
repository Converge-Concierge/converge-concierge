import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor } from "@shared/schema";
import { Hexagon, Calendar, MapPin, ArrowRight, ArrowLeft, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";

const levelColors: Record<string, string> = {
  Platinum: "border-slate-300 bg-slate-50",
  Gold: "border-yellow-300 bg-yellow-50",
  Silver: "border-gray-300 bg-gray-50",
  Bronze: "border-orange-300 bg-orange-50",
};

const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-200 text-slate-700",
  Gold: "bg-yellow-100 text-yellow-800",
  Silver: "bg-gray-100 text-gray-700",
  Bronze: "bg-orange-100 text-orange-800",
};

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, setLocation] = useLocation();

  const { data: events = [], isLoading: eventsLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [], isLoading: sponsorsLoading } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const event = events.find((e) => e.slug === slug);
  const eventSponsors = event
    ? sponsors.filter((s) => s.status === "active" && (s.assignedEvents || []).includes(event.id))
    : [];

  const isLoading = eventsLoading || sponsorsLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <h1 className="text-2xl font-display font-bold text-foreground">Event not found</h1>
        <p className="text-muted-foreground">The event code "{slug}" does not match any active event.</p>
        <Button onClick={() => setLocation("/")} variant="outline">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Events
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">
            Converge Concierge
          </span>
        </Link>
        <Button variant="outline" onClick={() => setLocation("/")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> All Events
        </Button>
      </header>

      <main className="flex-1 relative z-10 flex flex-col pb-24">
        {/* Event Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-4xl mx-auto px-6 pt-12 pb-10 text-center"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent font-mono text-sm font-semibold mb-5 border border-accent/20">
            {event.slug}
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-bold text-foreground tracking-tight leading-tight mb-5">
            {event.name}
          </h1>
          <div className="flex flex-wrap items-center justify-center gap-6 text-muted-foreground text-sm font-medium">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-accent" />
              {format(new Date(event.startDate), "MMMM d")} – {format(new Date(event.endDate), "MMMM d, yyyy")}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground/70" />
              {event.location}
            </div>
          </div>
        </motion.div>

        {/* Sponsors Section */}
        <div className="w-full max-w-5xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="mb-8 text-center"
          >
            <h2 className="text-2xl font-display font-semibold text-foreground mb-2">
              Select a Sponsor to Schedule a Meeting
            </h2>
            <p className="text-muted-foreground text-sm">
              Choose a sponsor below to view their available time slots and book your 1-on-1 strategy session.
            </p>
          </motion.div>

          {eventSponsors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground gap-3">
              <Building2 className="h-10 w-10 opacity-30" />
              <p className="text-sm">No sponsors available for this event yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {eventSponsors.map((sponsor, i) => (
                <motion.div
                  key={sponsor.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.15 + i * 0.08 }}
                  className={`group relative rounded-2xl p-6 border-2 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer ${levelColors[sponsor.level] || "border-border bg-card"}`}
                  onClick={() => setLocation(`/event/${slug}/book/${sponsor.id}`)}
                  data-testid={`sponsor-card-${sponsor.id}`}
                >
                  <div className="flex justify-between items-start mb-4">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${levelBadge[sponsor.level] || ""}`}>
                      {sponsor.level}
                    </span>
                    <div className="h-8 w-8 rounded-full bg-white/60 flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300 border border-black/10">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>

                  {sponsor.logoUrl ? (
                    <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 object-contain mb-3" />
                  ) : (
                    <div className="h-10 w-10 rounded-lg bg-white/80 border border-black/10 flex items-center justify-center mb-3">
                      <Building2 className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}

                  <h3 className="text-lg font-display font-bold text-foreground group-hover:text-primary transition-colors">
                    {sponsor.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">Click to view available meeting slots</p>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="w-full border-t border-border/50 bg-white/50 py-6 relative z-10 text-center">
        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Converge Concierge. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
