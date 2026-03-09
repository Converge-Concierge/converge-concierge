import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor } from "@shared/schema";
import {
  Calendar, MapPin, ExternalLink, Building2, CheckCircle,
  Video, Gem, X,
} from "lucide-react";
import { Link } from "wouter";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import PublicFooter from "@/components/PublicFooter";

// ── Constants / helpers ──────────────────────────────────────────────────────

const eventDomainMap: Record<string, string> = {
  CUGI: "https://CUGrowthSummit.com",
  FRC:  "https://FintechRiskandCompliance.com",
  TLS:  "https://TreasuryLeadership.com",
  USBT: "https://USBankTechSummit.com",
};

function getEventWebsite(slug: string, storedUrl?: string | null): string | null {
  if (storedUrl) return storedUrl;
  const prefix = slug.replace(/\d+$/, "").toUpperCase();
  return eventDomainMap[prefix] ?? null;
}

function getSponsorEventLevel(sponsor: Sponsor, eventId: string): string {
  const ae = (sponsor.assignedEvents ?? []).find((e) => e.eventId === eventId);
  return (ae?.sponsorshipLevel && ae.sponsorshipLevel !== "None") ? ae.sponsorshipLevel : "";
}

const levelBorder: Record<string, string> = {
  Platinum: "border-slate-500 bg-slate-50",
  Gold:     "border-amber-300 bg-amber-50/40",
  Silver:   "border-gray-300 bg-gray-50",
  Bronze:   "border-orange-300 bg-orange-50",
};
const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-800 text-white",
  Gold:     "bg-amber-100 text-amber-900",
  Silver:   "bg-gray-100 text-gray-600",
  Bronze:   "bg-orange-100 text-orange-700",
};
const levelAccent: Record<string, string> = {
  Platinum: "bg-slate-800 hover:bg-slate-900",
  Gold:     "bg-amber-600 hover:bg-amber-700",
  Silver:   "bg-gray-500 hover:bg-gray-600",
  Bronze:   "bg-orange-600 hover:bg-orange-700",
};
const levelAccentSecondary: Record<string, string> = {
  Platinum: "border-slate-400 text-slate-700 bg-slate-50/60 hover:bg-slate-100",
  Gold:     "border-amber-300 text-amber-800 bg-amber-50/60 hover:bg-amber-100",
  Silver:   "border-gray-300 text-gray-600 bg-gray-50/60 hover:bg-gray-100",
  Bronze:   "border-orange-300 text-orange-700 bg-orange-50/60 hover:bg-orange-100",
};

const slide = {
  initial:  { opacity: 0, y: 16 },
  animate:  { opacity: 1, y: 0 },
  transition: { duration: 0.3 },
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, nav] = useLocation();

  const { data: events   = [], isLoading: evL } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [], isLoading: spL } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const [activeFilters,  setActiveFilters]  = useState<string[]>([]);
  const [showAllFilters, setShowAllFilters] = useState(false);

  const FILTER_LIMIT = 8;

  const event = events.find((e) => e.slug === slug);

  const eventSponsors = useMemo(() => {
    if (!event) return [];
    return sponsors.filter((s) =>
      s.archiveState === "active" &&
      (s.assignedEvents ?? []).some((ae) => ae.eventId === event.id && ae.archiveState === "active")
    );
  }, [event, sponsors]);

  const attributesInUse = useMemo(() => {
    const set = new Set<string>();
    eventSponsors.forEach((s) => {
      (s.attributes ?? []).forEach((a) => {
        if (a.trim()) set.add(a.trim());
      });
    });
    return Array.from(set).sort();
  }, [eventSponsors]);

  const filteredSponsors = useMemo(() => {
    if (activeFilters.length === 0) return eventSponsors;
    const fk = activeFilters.map((f) => f.toLowerCase());
    return eventSponsors.filter((s) =>
      fk.some((k) => (s.attributes ?? []).some((a) => a.trim().toLowerCase() === k))
    );
  }, [eventSponsors, activeFilters]);

  if (evL || spL) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-8 w-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
          <p className="text-sm">Loading event…</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <p className="text-lg font-semibold text-foreground">Event not found</p>
          <p className="text-sm text-muted-foreground">This event doesn't exist or may have moved.</p>
        </div>
      </div>
    );
  }

  const eventWebsite = getEventWebsite(event.slug, event.websiteUrl);
  const startFmt = format(parseISO(event.startDate as unknown as string), "MMMM d");
  const endFmt   = format(parseISO(event.endDate   as unknown as string), "MMMM d, yyyy");

  const visibleFilters = showAllFilters ? attributesInUse : attributesInUse.slice(0, FILTER_LIMIT);
  const hasMoreFilters = attributesInUse.length > FILTER_LIMIT;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Hero / Confirmation Banner ─────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-10 sm:py-14">
          <motion.div {...slide} className="flex flex-col items-center text-center gap-5">
            {event.logoUrl ? (
              <div className="bg-white rounded-lg p-3 sm:p-4 border border-border/60 shadow-sm" data-testid="img-event-logo-welcome">
                <img
                  src={event.logoUrl}
                  alt={event.name}
                  className="h-14 sm:h-18 max-w-[220px] object-contain"
                  onError={(e) => { (e.target as HTMLImageElement).parentElement!.style.display = "none"; }}
                />
              </div>
            ) : null}

            <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-3 py-1.5 rounded-full" data-testid="badge-registered">
              <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
              Registration Confirmed
            </div>

            <div>
              <h1 className="text-3xl sm:text-4xl font-display font-bold text-foreground leading-tight mb-2" data-testid="heading-event-name">
                You're Registered for<br />{event.name}
              </h1>
              <p className="text-muted-foreground text-sm sm:text-base max-w-lg mx-auto">
                Your registration is confirmed. You can now schedule private 1-on-1 meetings with event sponsors.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-muted-foreground text-sm">
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-accent" />
                {startFmt} – {endFmt}
              </span>
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground/60" />
                {event.location}
              </span>
              {eventWebsite && (
                <a
                  href={eventWebsite}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-accent hover:opacity-80 transition-opacity font-medium"
                  data-testid="link-event-website-hero"
                >
                  <ExternalLink className="h-3.5 w-3.5" /> Event Website
                </a>
              )}
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── Sponsor Discovery ─────────────────────────────────────────────── */}
      <div id="sponsor-grid" className="flex-1 max-w-5xl mx-auto w-full px-6 py-8 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
        >
          {/* Interest filter — primary discovery heading */}
          {attributesInUse.length > 0 && (
            <div className="mb-8 space-y-4">
              <h2 className="text-2xl font-display font-semibold text-foreground">
                What are you interested in?
              </h2>
              <div className="flex flex-wrap gap-2 items-center">
                {visibleFilters.map((attr) => {
                  const active = activeFilters.some((f) => f.toLowerCase() === attr.toLowerCase());
                  return (
                    <button
                      key={attr}
                      onClick={() => setActiveFilters((prev) =>
                        active ? prev.filter((f) => f.toLowerCase() !== attr.toLowerCase()) : [...prev, attr]
                      )}
                      data-testid={`filter-${attr.toLowerCase().replace(/\s+/g, "-")}`}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                        active
                          ? "bg-accent text-white border-accent shadow-sm"
                          : "bg-white text-foreground/70 border-border hover:border-accent/60 hover:text-foreground hover:bg-accent/5",
                      )}
                    >
                      {attr}
                    </button>
                  );
                })}
                {hasMoreFilters && (
                  <button
                    onClick={() => setShowAllFilters((v) => !v)}
                    className="px-3 py-1.5 rounded-full text-sm font-medium text-accent border border-accent/40 hover:bg-accent/10 transition-all"
                    data-testid="filter-show-more"
                  >
                    {showAllFilters ? "Show Less" : `+${attributesInUse.length - FILTER_LIMIT} More`}
                  </button>
                )}
                {activeFilters.length > 0 && (
                  <button
                    onClick={() => setActiveFilters([])}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm text-muted-foreground hover:text-destructive transition-colors"
                    data-testid="filter-clear"
                  >
                    <X className="h-3.5 w-3.5" /> Clear
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Grid header */}
          <div className="flex items-end justify-between mb-4">
            <div>
              <h2 className="text-xl font-display font-semibold text-foreground">
                {activeFilters.length > 0 ? "Sponsors Matching Your Interests" : "Meet With Our Sponsors"}
              </h2>
              {eventSponsors.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {filteredSponsors.length === eventSponsors.length
                    ? `${eventSponsors.length} sponsor${eventSponsors.length !== 1 ? "s" : ""} participating`
                    : `${filteredSponsors.length} of ${eventSponsors.length} sponsors`}
                </p>
              )}
            </div>
          </div>

          {/* Sponsor cards */}
          {eventSponsors.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Building2 className="h-12 w-12 opacity-20" />
              <p className="text-sm">No sponsors are available for this event yet.</p>
            </div>
          ) : filteredSponsors.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-muted-foreground gap-3">
              <X className="h-10 w-10 opacity-20" />
              <p className="text-sm">No sponsors match the selected topics.</p>
              <button onClick={() => setActiveFilters([])} className="text-xs text-accent underline underline-offset-2">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {filteredSponsors.map((sponsor, i) => {
                const level = getSponsorEventLevel(sponsor, event.id);
                return (
                  <motion.div
                    key={sponsor.id}
                    initial={{ opacity: 0, y: 14 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.4) }}
                    className={cn(
                      "flex flex-col rounded-xl border-2 shadow-sm overflow-hidden",
                      "hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
                      levelBorder[level] || "border-border bg-card",
                    )}
                    data-testid={`sponsor-card-${sponsor.id}`}
                  >
                    <div className="flex-1 p-4">
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="h-9 flex items-center shrink-0">
                          {sponsor.logoUrl ? (
                            <img src={sponsor.logoUrl} alt={sponsor.name} className="h-8 max-w-[90px] object-contain" />
                          ) : (
                            <div className="h-9 w-9 rounded-lg bg-white border border-black/10 shadow-sm flex items-center justify-center">
                              <Building2 className="h-4 w-4 text-muted-foreground/60" />
                            </div>
                          )}
                        </div>
                        {level && (
                          <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 inline-flex items-center gap-0.5", levelBadge[level] || "bg-muted text-muted-foreground")}>
                            {level === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                            {level}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-display font-bold text-foreground leading-tight mb-1">{sponsor.name}</h3>
                      {sponsor.shortDescription && (
                        <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2 mb-1">{sponsor.shortDescription}</p>
                      )}
                      <Link
                        href={`/event/${event.slug}/sponsor/${sponsor.id}`}
                        className="text-[11px] text-accent hover:opacity-80 transition-opacity flex items-center gap-1"
                        data-testid={`link-sponsor-profile-${sponsor.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ExternalLink className="h-2.5 w-2.5" /> View Profile
                      </Link>
                    </div>
                    <div className="px-4 pb-4 space-y-1.5">
                      <button
                        onClick={() => nav(`/event/${event.slug}?sponsor=${sponsor.id}&mode=onsite`)}
                        data-testid={`btn-meet-${sponsor.id}`}
                        className={cn(
                          "w-full py-2 rounded-lg text-white text-xs font-semibold transition-all duration-150 active:scale-[0.98]",
                          levelAccent[level] || "bg-primary hover:bg-primary/90",
                        )}
                      >
                        Schedule Onsite Meeting
                      </button>
                      {sponsor.allowOnlineMeetings && (
                        <button
                          onClick={() => nav(`/event/${event.slug}?sponsor=${sponsor.id}&mode=online`)}
                          data-testid={`btn-online-${sponsor.id}`}
                          className={cn(
                            "w-full py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5",
                            levelAccentSecondary[level] || "border-border text-muted-foreground bg-muted/50 hover:bg-muted",
                          )}
                        >
                          <Video className="h-3 w-3" /> Online Meeting
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {eventWebsite && (
        <div className="border-t border-border py-6 text-center">
          <a
            href={eventWebsite}
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 justify-center"
            data-testid="link-event-website-footer"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Return to event website
          </a>
        </div>
      )}
      <PublicFooter />
    </div>
  );
}
