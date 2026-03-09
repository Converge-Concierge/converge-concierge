import { useParams, useLocation } from "wouter";
import PublicFooter from "@/components/PublicFooter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Hexagon, Building2, ArrowLeft, Globe, Linkedin, Calendar, Video,
  FileText, ChevronRight, Tag, Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Event, Sponsor } from "@shared/schema";
import { cn } from "@/lib/utils";

const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold:     "bg-amber-100 text-amber-900 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-700 border-orange-300",
};

export default function SponsorProfilePage() {
  const { slug, sponsorId } = useParams<{ slug: string; sponsorId: string }>();
  const [, nav] = useLocation();

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsor, isLoading, isError } = useQuery<Sponsor>({
    queryKey: ["/api/sponsors", sponsorId],
    queryFn: async () => {
      const res = await fetch(`/api/sponsors/${sponsorId}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!sponsorId,
    retry: false,
  });

  const event = events.find((e) => e.slug === slug);
  const eventLink = event ? (sponsor?.assignedEvents ?? []).find((ae) => ae.eventId === event.id && (ae.archiveState ?? "active") === "active") : null;
  const sponsorLevel = eventLink?.sponsorshipLevel ?? sponsor?.level ?? "";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (isError || !sponsor) {
    return (
      <div className="min-h-screen flex flex-col bg-background">
        <header className="w-full max-w-6xl mx-auto px-6 h-18 flex items-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
        </header>
        <main className="flex-1 flex flex-col items-center justify-center gap-4 px-6 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30" />
          <h1 className="text-xl font-display font-bold text-foreground">Sponsor not found</h1>
          <p className="text-sm text-muted-foreground">This sponsor profile isn't available.</p>
          <Button variant="outline" onClick={() => nav(slug ? `/event/${slug}` : "/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Back to Event
          </Button>
        </main>
      </div>
    );
  }

  const hasProfile = !!(sponsor.shortDescription || sponsor.websiteUrl || sponsor.linkedinUrl || sponsor.solutionsSummary);

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      {/* Header */}
      <header className="relative z-10 w-full max-w-6xl mx-auto px-6 h-18 flex items-center justify-between py-5">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold text-foreground tracking-tight">Converge Concierge</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-muted-foreground hover:text-foreground"
          onClick={() => nav(slug ? `/event/${slug}` : "/")}
          data-testid="button-back-to-event"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Event</span>
        </Button>
      </header>

      <main className="relative z-10 flex-1 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-3xl mx-auto px-6 pt-8 space-y-6"
        >
          {/* Breadcrumb */}
          {event && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <button onClick={() => nav(`/event/${slug}`)} className="hover:text-foreground transition-colors">{event.name}</button>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{sponsor.name}</span>
            </div>
          )}

          {/* Sponsor hero card */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-8">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Logo */}
              <div className="h-20 w-20 rounded-2xl border border-border bg-muted flex items-center justify-center shrink-0">
                {sponsor.logoUrl ? (
                  <img src={sponsor.logoUrl} alt={sponsor.name} className="h-14 max-w-[68px] object-contain" />
                ) : (
                  <Building2 className="h-8 w-8 text-muted-foreground/40" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1
                    className="text-3xl font-display font-bold text-foreground"
                    data-testid="text-sponsor-profile-name"
                  >
                    {sponsor.name}
                  </h1>
                  {sponsorLevel && (
                    <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border inline-flex items-center gap-1", levelBadge[sponsorLevel] || "bg-muted text-muted-foreground border-border")}>
                      {sponsorLevel === "Platinum" && <Gem className="h-3 w-3" />}
                      {sponsorLevel} Sponsor
                    </span>
                  )}
                </div>

                {sponsor.shortDescription && (
                  <p className="text-muted-foreground mt-1 leading-relaxed" data-testid="text-sponsor-short-desc">
                    {sponsor.shortDescription}
                  </p>
                )}

                {/* Links */}
                {(sponsor.websiteUrl || sponsor.linkedinUrl) && (
                  <div className="flex flex-wrap items-center gap-3 mt-4">
                    {sponsor.websiteUrl && (
                      <a
                        href={sponsor.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-accent hover:underline font-medium"
                        data-testid="link-sponsor-website"
                      >
                        <Globe className="h-4 w-4" />
                        Visit Website
                      </a>
                    )}
                    {sponsor.linkedinUrl && (
                      <a
                        href={sponsor.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-sm text-[#0077B5] hover:underline font-medium"
                        data-testid="link-sponsor-linkedin"
                      >
                        <Linkedin className="h-4 w-4" />
                        LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* CTA block — second position, right below the name card */}
          {slug && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-foreground mb-1">
                Meeting with {sponsor.name}{event ? ` at ${event.name}` : ""}
              </h2>
              <p className="text-xs text-muted-foreground mb-4">Schedule a 30-minute 1-on-1 meeting at the event, or request an online call.</p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => nav(`/event/${slug}?sponsor=${sponsor.id}&mode=onsite`)}
                  className="gap-2 flex-1"
                  data-testid="button-schedule-onsite"
                >
                  <Calendar className="h-4 w-4" />
                  Schedule Onsite Meeting
                </Button>
                {(sponsor.allowOnlineMeetings) && (
                  <Button
                    variant="outline"
                    onClick={() => nav(`/event/${slug}?sponsor=${sponsor.id}&mode=online`)}
                    className="gap-2 flex-1"
                    data-testid="button-request-online"
                  >
                    <Video className="h-4 w-4" />
                    Request Online Meeting
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Solution Types */}
          {(sponsor.attributes ?? []).length > 0 && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <Tag className="h-4 w-4 text-accent" /> Solution Types
              </h2>
              <div className="flex flex-wrap gap-2" data-testid="sponsor-solution-types">
                {(sponsor.attributes ?? []).map((attr) => (
                  <span key={attr} className="px-3 py-1 rounded-full text-xs font-medium bg-accent/10 text-accent border border-accent/20">
                    {attr}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Solutions Summary */}
          {sponsor.solutionsSummary && (
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-3">
                <FileText className="h-4 w-4 text-accent" /> Solutions & Services
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line" data-testid="text-sponsor-solutions">
                {sponsor.solutionsSummary}
              </p>
            </div>
          )}

          {/* No profile data fallback */}
          {!hasProfile && (
            <div className="rounded-2xl border border-dashed border-border/60 bg-muted/20 p-8 text-center">
              <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No additional profile information available yet.</p>
            </div>
          )}

        </motion.div>
      </main>

      <PublicFooter />
    </div>
  );
}
