import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Hexagon, ArrowRight, Calendar, MapPin, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Event } from "@shared/schema";
import { format, parseISO, isAfter, isBefore, isWithinInterval } from "date-fns";

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
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-6 w-6" />
          </div>
          <span className="font-display text-2xl font-bold text-foreground tracking-tight">
            Converge Concierge
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" className="hidden sm:flex font-medium" onClick={() => console.log("Help")}>
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
      <main className="flex-1 relative z-10 flex flex-col pb-24">
        <div className="w-full max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 text-accent font-medium text-sm mb-6 border border-accent/20">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Premium Matchmaking Network
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-display font-bold text-foreground tracking-tight text-balance leading-[1.1]">
              Schedule Your <br className="hidden md:block" />
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">Strategy Meetings</span>
            </h1>
            <p className="mt-6 text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
              Select an event to connect with fintech leaders, solution partners, and peers in an exclusive 1-on-1 environment.
            </p>
          </motion.div>
        </div>

        {/* Events Grid */}
        <div className="w-full max-w-7xl mx-auto px-6">
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
              {activeEvents.map((event, i) => {
                const slots = countSlots(event.meetingBlocks);
                const statusLabel = eventStatusLabel(event);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="group relative bg-card rounded-2xl p-8 border border-border/60 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 flex flex-col cursor-pointer"
                    onClick={() => setLocation(`/event/${event.slug}`)}
                    data-testid={`event-card-${event.slug}`}
                  >
                    <div className="flex justify-between items-start mb-6">
                      <div className="px-3 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-semibold tracking-wide uppercase">
                        {statusLabel}
                      </div>
                      <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors duration-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>

                    <h3 className="text-2xl font-display font-bold text-foreground mb-4 group-hover:text-primary transition-colors leading-tight">
                      {event.name}
                    </h3>

                    <div className="mt-auto space-y-3 pt-6 border-t border-border/50">
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

      <footer className="w-full border-t border-border/50 bg-white/50 py-8 relative z-10 text-center">
        <p className="text-muted-foreground text-sm">
          &copy; {new Date().getFullYear()} Converge Concierge. All rights reserved.
        </p>
      </footer>
    </div>
  );
}
