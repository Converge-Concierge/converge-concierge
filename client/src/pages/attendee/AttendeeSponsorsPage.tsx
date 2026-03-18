import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Sparkles, Calendar, Mail, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  logoUrl: string | null;
  category: string | null;
  shortDescription: string | null;
  overlapTopicLabels: string[];
}

const LEVEL_ORDER = ["Platinum", "Gold", "Silver", "Bronze"];

function SponsorCard({
  sponsor, onView, onRequestMeeting, onRequestInfo, isActing,
}: {
  sponsor: SponsorDetail;
  onView: () => void;
  onRequestMeeting: () => void;
  onRequestInfo: () => void;
  isActing: boolean;
}) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3" data-testid={`card-sponsor-${sponsor.id}`}>
      <div className="flex items-start gap-3">
        {sponsor.logoUrl
          ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-12 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-1" />
          : <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-6 w-6 text-primary" /></div>
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-1">
            <p className="font-semibold text-foreground text-sm leading-snug" data-testid={`text-sponsor-name-${sponsor.id}`}>{sponsor.name}</p>
            {sponsor.level && (
              <Badge variant="outline" className="text-[10px] shrink-0 rounded-full">{sponsor.level}</Badge>
            )}
          </div>
          {sponsor.shortDescription && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sponsor.shortDescription}</p>
          )}
        </div>
      </div>

      {sponsor.overlapTopicLabels.length > 0 && (
        <div className="flex items-start gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary font-medium leading-snug">
            Relevant: {sponsor.overlapTopicLabels.join(", ")}
          </p>
        </div>
      )}

      <div className="space-y-1.5 pt-1 border-t border-border/40">
        <div className="flex items-center gap-2 mb-1">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" onClick={onView} data-testid={`button-view-sponsor-${sponsor.id}`}>
            View <ChevronRight className="h-3 w-3" />
          </Button>
        </div>
        <Button
          variant="default"
          size="sm"
          className="w-full h-8 text-xs gap-1.5 font-semibold"
          disabled={isActing}
          onClick={onRequestMeeting}
          data-testid={`button-schedule-meeting-${sponsor.id}`}
        >
          <Calendar className="h-3.5 w-3.5" /> Schedule Meeting
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          disabled={isActing}
          onClick={onRequestInfo}
          data-testid={`button-request-info-${sponsor.id}`}
        >
          <Mail className="h-3.5 w-3.5" /> Request Information
        </Button>
      </div>
    </div>
  );
}

function RecommendedSponsorCard({
  sponsor, onRequestMeeting, onRequestInfo, isActing,
}: {
  sponsor: RecommendedSponsor;
  onRequestMeeting: () => void;
  onRequestInfo: () => void;
  isActing: boolean;
}) {
  return (
    <div className="bg-card border border-primary/20 rounded-xl p-4 flex flex-col gap-3" data-testid={`card-rec-sponsor-${sponsor.id}`}>
      <div className="flex items-start gap-3">
        {sponsor.logoUrl
          ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-10 w-10 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-1" />
          : <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-5 w-5 text-primary" /></div>
        }
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm leading-snug">{sponsor.name}</p>
          {sponsor.category && <p className="text-xs text-muted-foreground">{sponsor.category}</p>}
          {sponsor.shortDescription && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{sponsor.shortDescription}</p>}
        </div>
      </div>
      {sponsor.overlapTopicLabels.length > 0 && (
        <div className="flex items-start gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary font-medium leading-snug">
            Relevant: {sponsor.overlapTopicLabels.join(", ")}
          </p>
        </div>
      )}
      <div className="space-y-1.5 pt-1 border-t border-border/40">
        <Button
          variant="default"
          size="sm"
          className="w-full h-8 text-xs gap-1.5 font-semibold"
          disabled={isActing}
          onClick={onRequestMeeting}
          data-testid={`button-schedule-meeting-rec-${sponsor.id}`}
        >
          <Calendar className="h-3.5 w-3.5" /> Schedule Meeting
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs gap-1.5"
          disabled={isActing}
          onClick={onRequestInfo}
          data-testid={`button-request-info-rec-${sponsor.id}`}
        >
          <Mail className="h-3.5 w-3.5" /> Request Information
        </Button>
      </div>
    </div>
  );
}

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
                <RecommendedSponsorCard
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

          {/* Search + filters */}
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
