import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Sparkles, Calendar, Video, ExternalLink } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import SponsorDetailSheet, { type SponsorDetail } from "@/components/attendee/SponsorDetailSheet";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";
import { useToast } from "@/hooks/use-toast";

interface InteractionMap {
  meetings: Record<string, { status: string; meetingId: string }>;
  infoRequests: Record<string, { status: string; requestId: string }>;
}

interface RecommendedSponsor {
  id: string;
  name: string;
  level: string | null;
  logoUrl: string | null;
  category: string | null;
  shortDescription: string | null;
  websiteUrl: string | null;
  overlapTopicLabels: string[];
  onsiteMeetingEnabled: boolean;
  onlineMeetingEnabled: boolean;
  informationRequestEnabled: boolean;
}

// ── Shared sponsor card (used for both all-sponsors and recommended) ───────────

function SponsorCard({
  sponsor, onView, onRequestMeeting, onRequestInfo, isActing,
  showViewProfile = true,
}: {
  sponsor: SponsorDetail | RecommendedSponsor;
  onView?: () => void;
  onRequestMeeting: () => void;
  onRequestInfo: () => void;
  isActing: boolean;
  showViewProfile?: boolean;
}) {
  const hasActions = sponsor.onsiteMeetingEnabled || sponsor.onlineMeetingEnabled || sponsor.informationRequestEnabled;
  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3" data-testid={`card-sponsor-${sponsor.id}`}>
      {/* Logo + level badge */}
      <div className="flex items-start justify-between gap-2">
        {sponsor.logoUrl
          ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-12 rounded-xl object-contain shrink-0 border border-border/40 bg-white p-1" />
          : <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-6 w-6 text-primary" /></div>
        }
        {sponsor.level && (
          <Badge variant="secondary" className="rounded-full text-[10px] shrink-0 font-semibold px-2.5">
            {sponsor.level}
          </Badge>
        )}
      </div>

      {/* Name, description, relevance, view profile */}
      <div className="space-y-1 min-w-0">
        <p className="font-bold text-sm text-foreground leading-snug" data-testid={`text-sponsor-name-${sponsor.id}`}>{sponsor.name}</p>
        {sponsor.shortDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{sponsor.shortDescription}</p>
        )}
        {sponsor.overlapTopicLabels.length > 0 && (
          <div className="flex items-center gap-1 pt-0.5">
            <Sparkles className="h-3 w-3 text-primary shrink-0" />
            <p className="text-xs text-primary font-medium truncate">{sponsor.overlapTopicLabels.join(", ")}</p>
          </div>
        )}
        {showViewProfile && sponsor.websiteUrl && (
          <a
            href={sponsor.websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid={`link-view-profile-${sponsor.id}`}
          >
            <ExternalLink className="h-3 w-3" /> View Profile
          </a>
        )}
        {showViewProfile && !sponsor.websiteUrl && onView && (
          <button
            onClick={onView}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
            data-testid={`button-view-sponsor-${sponsor.id}`}
          >
            <ExternalLink className="h-3 w-3" /> View Profile
          </button>
        )}
      </div>

      {/* Action buttons */}
      {hasActions && (
        <div className="space-y-1.5 pt-2 border-t border-border/40">
          {sponsor.onsiteMeetingEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 bg-foreground text-background hover:bg-foreground/90 disabled:opacity-50"
              disabled={isActing}
              onClick={onRequestMeeting}
              data-testid={`button-onsite-meeting-${sponsor.id}`}
            >
              <Calendar className="h-3.5 w-3.5" /> Schedule Onsite Meeting
            </button>
          )}
          {sponsor.onlineMeetingEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-semibold border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 disabled:opacity-50"
              disabled={isActing}
              onClick={onRequestMeeting}
              data-testid={`button-online-meeting-${sponsor.id}`}
            >
              <Video className="h-3.5 w-3.5" /> Online Meeting
            </button>
          )}
          {sponsor.informationRequestEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-[0.98] flex items-center justify-center disabled:opacity-50"
              disabled={isActing}
              onClick={onRequestInfo}
              data-testid={`button-request-info-${sponsor.id}`}
            >
              Request Information
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeSponsorsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [detailSponsor, setDetailSponsor] = useState<SponsorDetail | null>(null);
  const [actingFor, setActingFor] = useState<string | null>(null);

  const sponsorsQuery = useQuery<SponsorDetail[]>({
    queryKey: ["/api/attendee-portal/sponsors"],
    queryFn: () => fetch("/api/attendee-portal/sponsors", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const recommendedQuery = useQuery<RecommendedSponsor[]>({
    queryKey: ["/api/attendee-portal/recommended-sponsors"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sponsors", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const interactionsQuery = useQuery<InteractionMap>({
    queryKey: ["/api/attendee-portal/sponsor-interactions"],
    queryFn: () => fetch("/api/attendee-portal/sponsor-interactions", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const requestMeetingMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-meeting", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (sponsorId) => setActingFor(sponsorId),
    onSettled: () => setActingFor(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      toast({ title: "Meeting request sent", description: "We'll connect you with this sponsor." });
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-info", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (sponsorId) => setActingFor(sponsorId),
    onSettled: () => setActingFor(null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      toast({ title: "Information requested", description: "This sponsor will be in touch with more details." });
    },
  });

  const sponsors = sponsorsQuery.data ?? [];
  const recommended = recommendedQuery.data ?? [];
  const interactions = interactionsQuery.data ?? { meetings: {}, infoRequests: {} };

  const allTopicLabels = useMemo(() => {
    const seen = new Set<string>();
    const labels: string[] = [];
    for (const s of sponsors) {
      for (const t of s.topicLabels) {
        if (!seen.has(t.label)) { seen.add(t.label); labels.push(t.label); }
      }
    }
    return labels.sort();
  }, [sponsors]);

  const filtered = useMemo(() => {
    let list = sponsors;
    if (search) list = list.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()) || (s.shortDescription?.toLowerCase().includes(search.toLowerCase())));
    if (topicFilter) list = list.filter((s) => s.topicLabels.some((t) => t.label === topicFilter));
    return list;
  }, [sponsors, search, topicFilter]);

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName}>
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Sponsors
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
        </div>

        {/* ── Recommended Sponsors ──────────────────────────────────────── */}
        {recommended.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" /> Recommended for You
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="recommended-sponsors-grid">
              {recommended.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  onRequestMeeting={() => requestMeetingMutation.mutate(sponsor.id)}
                  onRequestInfo={() => requestInfoMutation.mutate(sponsor.id)}
                  isActing={actingFor === sponsor.id}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── All Sponsors ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">All Sponsors</h2>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search sponsors…"
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                data-testid="input-sponsor-search"
              />
            </div>
          </div>

          {allTopicLabels.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-5" data-testid="topic-filter-chips">
              <button
                onClick={() => setTopicFilter(null)}
                className={`text-xs px-3 py-1 rounded-full border transition-colors ${!topicFilter ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"}`}
                data-testid="filter-chip-all"
              >
                All
              </button>
              {allTopicLabels.map((label) => (
                <button
                  key={label}
                  onClick={() => setTopicFilter(topicFilter === label ? null : label)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${topicFilter === label ? "bg-primary text-primary-foreground border-primary" : "border-border/60 text-muted-foreground hover:border-primary/40"}`}
                  data-testid={`filter-chip-${label.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {sponsorsQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!sponsorsQuery.isLoading && filtered.length === 0 && (
            <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              {sponsors.length === 0
                ? <p className="text-muted-foreground">Sponsors will appear here once event sponsors are available.</p>
                : <p className="text-muted-foreground">No sponsors match your search.</p>
              }
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="sponsors-grid">
            {filtered.map((sponsor) => (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                onView={() => setDetailSponsor(sponsor)}
                onRequestMeeting={() => requestMeetingMutation.mutate(sponsor.id)}
                onRequestInfo={() => requestInfoMutation.mutate(sponsor.id)}
                isActing={actingFor === sponsor.id}
              />
            ))}
          </div>
        </div>
      </div>

      {detailSponsor && (
        <SponsorDetailSheet
          sponsor={detailSponsor}
          interaction={{
            meetingStatus: interactions.meetings[detailSponsor.id]?.status,
            infoStatus: interactions.infoRequests[detailSponsor.id]?.status,
          }}
          onClose={() => setDetailSponsor(null)}
          onInteractionChange={() => {}}
        />
      )}
    </AttendeeShell>
  );
}
