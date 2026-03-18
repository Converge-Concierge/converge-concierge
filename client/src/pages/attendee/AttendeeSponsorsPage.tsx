import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Sparkles, Calendar, Video, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import MeetingSchedulerDialog from "@/components/attendee/MeetingSchedulerDialog";
import SponsorDetailSheet, { type SponsorDetail } from "@/components/attendee/SponsorDetailSheet";
import { RequestInfoModal } from "@/components/RequestInfoModal";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

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

// ── Shared sponsor card ───────────────────────────────────────────────────────

function SponsorCard({
  sponsor,
  onView,
  onScheduleOnsite,
  onScheduleOnline,
  onRequestInfo,
  showViewProfile = true,
}: {
  sponsor: SponsorDetail | RecommendedSponsor;
  onView?: () => void;
  onScheduleOnsite: () => void;
  onScheduleOnline: () => void;
  onRequestInfo: () => void;
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
              className="w-full py-2 rounded-xl text-xs font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 bg-foreground text-background hover:bg-foreground/90"
              onClick={onScheduleOnsite}
              data-testid={`button-onsite-meeting-${sponsor.id}`}
            >
              <Calendar className="h-3.5 w-3.5" /> Schedule Onsite Meeting
            </button>
          )}
          {sponsor.onlineMeetingEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-semibold border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
              onClick={onScheduleOnline}
              data-testid={`button-online-meeting-${sponsor.id}`}
            >
              <Video className="h-3.5 w-3.5" /> Online Meeting
            </button>
          )}
          {sponsor.informationRequestEnabled && (
            <button
              className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-[0.98] flex items-center justify-center"
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
  const [detailSponsor, setDetailSponsor] = useState<SponsorDetail | null>(null);
  const [schedulerModal, setSchedulerModal] = useState<{ sponsorId: string; sponsorName: string; mode: "onsite" | "online" } | null>(null);
  const [requestInfoSponsor, setRequestInfoSponsor] = useState<{ id: string; name: string } | null>(null);

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

  const sponsors = sponsorsQuery.data ?? [];
  const recommended = recommendedQuery.data ?? [];
  const me = meQuery.data;
  const ac = me?.event.buttonColor || me?.event.accentColor || null;

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName} accentColor={ac}>
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
                  onScheduleOnsite={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "onsite" })}
                  onScheduleOnline={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "online" })}
                  onRequestInfo={() => setRequestInfoSponsor({ id: sponsor.id, name: sponsor.name })}
                />
              ))}
            </div>
          </div>
        )}

        {/* ── All Sponsors ──────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-4">All Sponsors</h2>

          {sponsorsQuery.isLoading && (
            <div className="flex items-center justify-center py-20">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!sponsorsQuery.isLoading && sponsors.length === 0 && (
            <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
              <Building2 className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
              <p className="text-muted-foreground">Sponsors will appear here once event sponsors are available.</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="sponsors-grid">
            {sponsors.map((sponsor) => (
              <SponsorCard
                key={sponsor.id}
                sponsor={sponsor}
                onView={() => setDetailSponsor(sponsor)}
                onScheduleOnsite={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "onsite" })}
                onScheduleOnline={() => setSchedulerModal({ sponsorId: sponsor.id, sponsorName: sponsor.name, mode: "online" })}
                onRequestInfo={() => setRequestInfoSponsor({ id: sponsor.id, name: sponsor.name })}
              />
            ))}
          </div>
        </div>
      </div>

      {detailSponsor && (
        <SponsorDetailSheet
          sponsor={detailSponsor}
          interaction={{}}
          onClose={() => setDetailSponsor(null)}
          onInteractionChange={() => {}}
        />
      )}

      {/* Meeting scheduler wizard */}
      {schedulerModal && me && (
        <MeetingSchedulerDialog
          open={!!schedulerModal}
          onClose={() => setSchedulerModal(null)}
          sponsorId={schedulerModal.sponsorId}
          sponsorName={schedulerModal.sponsorName}
          mode={schedulerModal.mode}
          me={me}
          headers={headers}
          onSuccess={() => setSchedulerModal(null)}
        />
      )}

      {/* Request Information modal */}
      {requestInfoSponsor && (
        <RequestInfoModal
          open={!!requestInfoSponsor}
          onClose={() => setRequestInfoSponsor(null)}
          onSuccess={() => setRequestInfoSponsor(null)}
          sponsorId={requestInfoSponsor.id}
          sponsorName={requestInfoSponsor.name}
          eventId={me?.event.id}
          prefill={{
            email: me?.attendee.email,
            firstName: me?.attendee.firstName,
            lastName: me?.attendee.lastName,
            company: me?.attendee.company,
            title: me?.attendee.title,
          }}
        />
      )}
    </AttendeeShell>
  );
}
