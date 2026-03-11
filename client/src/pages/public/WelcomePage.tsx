import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Event, Sponsor, EventSponsorLink } from "@shared/schema";
import {
  ExternalLink, Building2, CheckCircle, Video, Gem, X, MessageSquare,
} from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import PublicFooter from "@/components/PublicFooter";
import { RequestInfoModal } from "@/components/RequestInfoModal";

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

function getSponsorEventLink(sponsor: Sponsor, eventId: string): EventSponsorLink | undefined {
  return (sponsor.assignedEvents ?? []).find((e) => e.eventId === eventId);
}

const levelPriority: Record<string, number> = {
  Platinum: 4,
  Gold:     3,
  Silver:   2,
  Bronze:   1,
};

function sortByLevel(list: Sponsor[], eventId: string): Sponsor[] {
  return [...list].sort((a, b) => {
    const la = levelPriority[getSponsorEventLevel(a, eventId)] ?? 0;
    const lb = levelPriority[getSponsorEventLevel(b, eventId)] ?? 0;
    return lb - la;
  });
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function WelcomePage() {
  const { slug } = useParams<{ slug: string }>();
  const [, nav] = useLocation();

  const { data: events   = [], isLoading: evL } = useQuery<Event[]>  ({ queryKey: ["/api/events"]   });
  const { data: sponsors = [], isLoading: spL } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const [activeFilters,  setActiveFilters]  = useState<string[]>([]);
  const [showAllFilters, setShowAllFilters] = useState(false);
  const [requestInfoSponsor, setRequestInfoSponsor] = useState<Sponsor | null>(null);

  const FILTER_LIMIT = 10;

  const event = events.find((e) => e.slug === slug);

  const eventSponsors = useMemo(() => {
    if (!event) return [];
    const base = sponsors.filter((s) =>
      s.archiveState === "active" &&
      (s.assignedEvents ?? []).some((ae) => ae.eventId === event.id && ae.archiveState === "active")
    );
    return sortByLevel(base, event.id);
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
    const filtered = eventSponsors.filter((s) =>
      fk.some((k) => (s.attributes ?? []).some((a) => a.trim().toLowerCase() === k))
    );
    return filtered;
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
  const visibleFilters = showAllFilters ? attributesInUse : attributesInUse.slice(0, FILTER_LIMIT);
  const hasMoreFilters = attributesInUse.length > FILTER_LIMIT;

  return (
    <div className="min-h-screen bg-background flex flex-col">

      {/* ── Hero — horizontal layout ──────────────────────────────────────── */}
      <div className="bg-white border-b border-border">
        <div className="max-w-5xl mx-auto px-6 py-5 sm:py-6">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="flex items-center gap-6 sm:gap-8"
          >
            {event.logoUrl ? (
              <div
                className="flex-shrink-0 bg-white rounded-lg p-3 border border-border/60 shadow-sm"
                data-testid="img-event-logo-welcome"
              >
                <img
                  src={event.logoUrl}
                  alt={event.name}
                  className="h-28 sm:h-32 max-w-[260px] object-contain"
                  onError={(e) => {
                    const parent = (e.target as HTMLImageElement).parentElement;
                    if (parent) parent.style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div className="flex-shrink-0 h-20 w-20 rounded-xl bg-muted flex items-center justify-center" data-testid="img-event-logo-welcome">
                <Building2 className="h-8 w-8 text-muted-foreground/40" />
              </div>
            )}

            <div className="min-w-0 flex-1">
              <div
                className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-700 border border-emerald-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-3 animate-pulse"
                style={{ animationDuration: "2.5s" }}
                data-testid="badge-registered"
              >
                <CheckCircle className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                Registration Confirmation
              </div>
              <h1
                className="text-2xl sm:text-3xl font-display font-bold text-foreground leading-tight"
                data-testid="heading-event-name"
              >
                You're Registered for<br className="hidden sm:block" />{" "}
                <span className="text-foreground">{event.name}!</span>
              </h1>
            </div>
          </motion.div>
        </div>
      </div>

      {/* ── CTA message + Topic Selection ─────────────────────────────────── */}
      <div className="border-b border-border bg-muted/20">
        <div className="max-w-5xl mx-auto px-6 py-6 sm:py-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.25, delay: 0.05 }}
            className="space-y-4"
          >
            <p className="text-xs font-black uppercase tracking-widest text-accent">
              Next Step
            </p>
            <p className="text-xl sm:text-2xl font-display font-bold text-foreground">
              Make the most of your time at the conference. What topics interest you?
            </p>

            {attributesInUse.length > 0 && (
              <div className="flex flex-wrap gap-2 items-center pt-1">
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
            )}
          </motion.div>
        </div>
      </div>

      {/* ── Sponsor Discovery ─────────────────────────────────────────────── */}
      <div id="sponsor-grid" className="flex-1 max-w-5xl mx-auto w-full px-6 py-5 sm:py-6">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, delay: 0.08 }}
        >
          {/* Grid header */}
          <div className="flex items-end justify-between mb-3">
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
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.22, delay: Math.min(i * 0.04, 0.35) }}
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
                    {(() => {
                      const link = getSponsorEventLink(sponsor, event.id);
                      const onsiteEnabled = link?.onsiteMeetingEnabled ?? true;
                      const onlineEnabled = link?.onlineMeetingEnabled ?? true;
                      const infoEnabled = link?.informationRequestEnabled ?? true;
                      return (
                        <div className="px-4 pb-4 space-y-1.5">
                          {onsiteEnabled && (
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
                          )}
                          {onlineEnabled && sponsor.allowOnlineMeetings && (
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
                          {infoEnabled && (
                            <button
                              onClick={() => setRequestInfoSponsor(sponsor)}
                              data-testid={`btn-info-${sponsor.id}`}
                              className="w-full py-1.5 rounded-lg text-xs font-semibold border border-border text-muted-foreground bg-muted/30 hover:bg-muted transition-all duration-150 active:scale-[0.98] flex items-center justify-center gap-1.5"
                            >
                              <MessageSquare className="h-3 w-3" /> Request Information
                            </button>
                          )}
                        </div>
                      );
                    })()}
                  </motion.div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      <RequestInfoModal
        open={!!requestInfoSponsor}
        onClose={() => setRequestInfoSponsor(null)}
        sponsorId={requestInfoSponsor?.id ?? ""}
        sponsorName={requestInfoSponsor?.name ?? ""}
        eventId={event.id}
      />

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      {eventWebsite && (
        <div className="border-t border-border py-5 text-center">
          <a
            href={eventWebsite}
            target="_blank" rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5"
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
