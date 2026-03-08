import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Hexagon, Calendar, MapPin, Clock, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, isWithinInterval } from "date-fns";
import PublicFooter from "@/components/PublicFooter";

function eventStatusLabel(event: Event): string {
  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (isWithinInterval(now, { start, end })) return "In Progress";
  if (isAfter(start, now)) return "Upcoming";
  return "Registration Open";
}

function countSlots(blocks: Event["meetingBlocks"]): number {
  return (blocks ?? []).reduce((sum, b) => {
    const [sh, sm] = b.startTime.split(":").map(Number);
    const [eh, em] = b.endTime.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return sum + Math.floor((endMins - startMins) / 30);
  }, 0);
}

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const { data: allEvents = [], isLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const activeEvents = allEvents.filter((e) => e.archiveState === "active");

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      {/* Abstract Background Elements */}
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">
            Converge Concierge
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" className="hidden sm:flex font-medium" onClick={() => setLocation("/help")}>
            Help Center
          </Button>
          <Button
            className="rounded-full px-6 shadow-md hover:shadow-lg transition-all"
            onClick={() => setLocation("/login")}
          >
            Admin Login
          </Button>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="flex-1 relative z-10 flex flex-col pb-16">
        <div className="w-full max-w-4xl mx-auto px-6 pt-5 pb-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-accent/10 text-accent font-medium text-xs mb-4 border border-accent/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Premium Matchmaking Network
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-display font-bold text-foreground tracking-tight text-balance leading-[1.1]">
              Schedule Your{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Strategy Meetings</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Connect with solution partners through curated 1-on-1 meetings.
            </p>
          </motion.div>
        </div>

        {/* Events Grid */}
        <div className="w-full max-w-7xl mx-auto px-6 mb-10">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl border border-border/60 bg-card animate-pulse" />
              ))}
            </div>
          ) : activeEvents.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <p className="text-lg font-medium">No events available yet.</p>
              <p className="text-sm mt-2">Check back soon for upcoming events.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {activeEvents.map((event, i) => {
                const slots = countSlots(event.meetingBlocks);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group relative bg-card rounded-2xl p-6 border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
                    onClick={() => setLocation(`/event/${event.slug}`)}
                    data-testid={`event-card-${event.slug}`}
                  >
                    {/* Event logo */}
                    <div className="flex justify-center mb-4">
                      {event.logoUrl ? (
                        <img
                          src={event.logoUrl}
                          alt={event.name}
                          className="h-12 max-w-[140px] object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; (e.target as HTMLImageElement).nextElementSibling?.classList.remove("hidden"); }}
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center">
                          <Building2 className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <h3 className="text-xl font-display font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight text-center">
                      {event.name}
                    </h3>

                    <div className="mt-auto space-y-3 pt-5 border-t border-border/50">
                      <div className="flex items-center text-muted-foreground text-sm font-medium">
                        <Calendar className="mr-3 h-4 w-4 text-accent" />
                        {format(parseISO(event.startDate as unknown as string), "MMMM d")}
                        {" – "}
                        {format(parseISO(event.endDate as unknown as string), "MMMM d, yyyy")}
                      </div>
                      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 text-sm font-medium">
                        <div className="flex items-center text-muted-foreground">
                          <MapPin className="mr-3 h-4 w-4 text-muted-foreground/70" />
                          {event.location}
                        </div>
                        {slots > 0 && (
                          <div className="flex items-center text-muted-foreground">
                            <Clock className="mr-3 h-4 w-4 text-muted-foreground/70" />
                            {slots} session{slots !== 1 ? "s" : ""} available
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
