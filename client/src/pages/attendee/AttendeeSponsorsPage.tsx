import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Search, Sparkles, Calendar, Mail, CheckCircle2, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import SponsorDetailSheet, { type SponsorDetail } from "@/components/attendee/SponsorDetailSheet";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface InteractionMap {
  meetings: Record<string, { status: string; meetingId: string }>;
  infoRequests: Record<string, { status: string; requestId: string }>;
}

const LEVEL_ORDER = ["Platinum", "Gold", "Silver", "Bronze"];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMeetingLabel(status?: string) {
  if (!status) return null;
  if (status === "Pending") return "Meeting Requested";
  if (status === "Confirmed") return "Meeting Confirmed";
  if (status === "Scheduled") return "Meeting Scheduled";
  if (status === "Completed") return "Meeting Completed";
  return `Meeting ${status}`;
}

// ── Sponsor Card ──────────────────────────────────────────────────────────────

function SponsorCard({
  sponsor, interaction, onView, onRequestMeeting, onRequestInfo, isActing,
}: {
  sponsor: SponsorDetail;
  interaction: { meetingStatus?: string; infoStatus?: string };
  onView: () => void;
  onRequestMeeting: () => void;
  onRequestInfo: () => void;
  isActing: boolean;
}) {
  const hasMeeting = !!interaction.meetingStatus;
  const hasInfo = !!interaction.infoStatus;
  const meetingLabel = getMeetingLabel(interaction.meetingStatus);

  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 flex flex-col gap-3" data-testid={`card-sponsor-${sponsor.id}`}>
      {/* Header row */}
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

      {/* Relevance */}
      {sponsor.overlapTopicLabels.length > 0 && (
        <div className="flex items-start gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-primary font-medium leading-snug">
            Relevant: {sponsor.overlapTopicLabels.join(", ")}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 px-2" onClick={onView} data-testid={`button-view-sponsor-${sponsor.id}`}>
          View <ChevronRight className="h-3 w-3" />
        </Button>

        {hasMeeting ? (
          <div className="flex items-center gap-1 text-xs text-primary font-medium" data-testid={`status-meeting-${sponsor.id}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> {meetingLabel}
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" disabled={isActing} onClick={onRequestMeeting} data-testid={`button-request-meeting-${sponsor.id}`}>
            <Calendar className="h-3 w-3" /> Request Meeting
          </Button>
        )}

        {hasInfo ? (
          <div className="flex items-center gap-1 text-xs text-accent font-medium" data-testid={`status-info-${sponsor.id}`}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Info Requested
          </div>
        ) : (
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" disabled={isActing} onClick={onRequestInfo} data-testid={`button-request-info-${sponsor.id}`}>
            <Mail className="h-3 w-3" /> Request Info
          </Button>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeSponsorsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [topicFilter, setTopicFilter] = useState<string | null>(null);
  const [detailSponsor, setDetailSponsor] = useState<SponsorDetail | null>(null);
  const [actingFor, setActingFor] = useState<string | null>(null);

  const sponsorsQuery = useQuery<SponsorDetail[]>({
    queryKey: ["/api/attendee-portal/sponsors"],
    queryFn: () => fetch("/api/attendee-portal/sponsors", { headers }).then((r) => r.json()),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] }),
  });

  const requestInfoMutation = useMutation({
    mutationFn: (sponsorId: string) =>
      fetch("/api/attendee-portal/request-info", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId }),
      }).then((r) => r.json()),
    onMutate: (sponsorId) => setActingFor(sponsorId),
    onSettled: () => setActingFor(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] }),
  });

  const sponsors = sponsorsQuery.data ?? [];
  const interactions = interactionsQuery.data ?? { meetings: {}, infoRequests: {} };

  // Collect all unique topic labels for filter chips
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
      <div className="max-w-4xl mx-auto px-4 py-6">
        {/* Page header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" /> Sponsors
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
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

        {/* Topic filter chips */}
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

        {/* Loading */}
        {sponsorsQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Empty state */}
        {!sponsorsQuery.isLoading && filtered.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            {sponsors.length === 0
              ? <p className="text-muted-foreground">Sponsors will appear here once event sponsors are available.</p>
              : <p className="text-muted-foreground">No sponsors match your search.</p>
            }
          </div>
        )}

        {/* Sponsor grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="sponsors-grid">
          {filtered.map((sponsor) => {
            const mtg = interactions.meetings[sponsor.id];
            const info = interactions.infoRequests[sponsor.id];
            return (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                interaction={{ meetingStatus: mtg?.status, infoStatus: info?.status }}
                onView={() => setDetailSponsor(sponsor)}
                onRequestMeeting={() => requestMeetingMutation.mutate(sponsor.id)}
                onRequestInfo={() => requestInfoMutation.mutate(sponsor.id)}
                isActing={actingFor === sponsor.id}
              />
            );
          })}
        </div>
      </div>

      {/* Sponsor detail slide-over */}
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
