import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Hexagon, Calendar, MapPin, Users, Building2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { Event, Sponsor, AppBranding } from "@shared/schema";
import { format, parseISO, isWithinInterval } from "date-fns";
import PublicFooter from "@/components/PublicFooter";
import { cn } from "@/lib/utils";

const isDev = import.meta.env.DEV;

function eventStatusLabel(event: Event): string {
  const now = new Date();
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  if (isWithinInterval(now, { start, end })) return "In Progress";
  return "Upcoming";
}

function countActiveSponsors(event: Event, sponsors: Sponsor[]): number {
  return sponsors.filter(
    (s) =>
      (s.archiveState ?? "active") === "active" &&
      (s.assignedEvents ?? []).some(
        (ae) =>
          ae.eventId === event.id &&
          (ae.archiveState ?? "active") === "active"
      )
  ).length;
}

function isSchedulingOff(event: Event): boolean {
  if (event.schedulingEnabled === false) return true;
  if (event.schedulingShutoffAt) {
    return new Date() > new Date(event.schedulingShutoffAt as unknown as string);
  }
  return false;
}

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const { data: allEvents = [], isLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: branding } = useQuery<AppBranding>({ queryKey: ["/api/branding-public"] });

  const activeEvents = allEvents
    .filter((e) => {
      if (e.archiveState !== "active") return false;
      if (isDev && e.name.includes("(Copy)")) return false;
      return true;
    })
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />
      <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {branding?.appLogoUrl ? (
            <img
              src={branding.appLogoUrl}
              alt={branding.appName || "Converge Concierge"}
              className="h-9 max-w-[160px] object-contain"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              data-testid="img-app-logo"
            />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-6 w-6" />
            </div>
          )}
          <span className="font-display text-2xl font-bold text-foreground tracking-tight" data-testid="text-app-name">
            {branding?.appName || "Converge Concierge"}
          </span>
        </div>
        <nav className="flex items-center gap-4">
          <Button variant="ghost" className="hidden sm:flex font-medium" onClick={() => setLocation("/help")}>
            Help Center
          </Button>
          <Button
            className="rounded-full px-6 shadow-md hover:shadow-lg transition-all"
            onClick={() => setLocation("/login")}
            data-testid="button-admin-login"
          >
            Admin Login
          </Button>
        </nav>
      </header>

      {/* Hero + Events */}
      <main className="flex-1 relative z-10 flex flex-col pb-12">
        {/* Hero text */}
        <div className="w-full max-w-4xl mx-auto px-6 pt-6 pb-8 text-center">
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
            <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
              Connect with solution partners through curated 1-on-1 meetings.
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
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {activeEvents.map((event, i) => {
                const sponsorCount = countActiveSponsors(event, sponsors);
                const hasSponsors = sponsorCount > 0;
                const schedulingOff = isSchedulingOff(event);
                const isComingSoon = !hasSponsors;
                const isClickable = hasSponsors || schedulingOff;

                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className={cn(
                      "group relative bg-card rounded-2xl p-6 border border-border/60 shadow-sm transition-all duration-300 flex flex-col",
                      isClickable
                        ? "hover:shadow-xl hover:-translate-y-1 cursor-pointer"
                        : "cursor-not-allowed opacity-70"
                    )}
                    onClick={() => isClickable && setLocation(`/event/${event.slug}`)}
                    data-testid={`event-card-${event.slug}`}
                  >
                    {/* Coming Soon badge */}
                    {isComingSoon && (
                      <div className="absolute top-3 right-3 flex items-center gap-1 px-2 py-1 rounded-full bg-muted border border-border text-[10px] font-semibold text-muted-foreground" data-testid={`badge-coming-soon-${event.slug}`}>
                        <Clock className="h-3 w-3" />
                        Coming Soon
                      </div>
                    )}

                    {/* Event logo — 100% larger */}
                    <div className="flex justify-center mb-4">
                      {event.logoUrl ? (
                        <img
                          src={event.logoUrl}
                          alt={event.name}
                          className="h-24 max-w-[200px] object-contain"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                        />
                      ) : (
                        <div className="h-24 w-24 rounded-xl bg-muted flex items-center justify-center">
                          <Building2 className="h-10 w-10 text-muted-foreground/40" />
                        </div>
                      )}
                    </div>

                    <h3 className={cn(
                      "text-xl font-display font-bold text-foreground mb-4 transition-colors leading-tight text-center",
                      isClickable && "group-hover:text-primary"
                    )}>
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
                        {sponsorCount > 0 && (
                          <div className="flex items-center text-muted-foreground" data-testid={`text-sponsor-count-${event.slug}`}>
                            <Users className="mr-3 h-4 w-4 text-muted-foreground/70" />
                            {sponsorCount} sponsor{sponsorCount !== 1 ? "s" : ""}
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
