import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Building2, Sparkles, Calendar, Video, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import MeetingSchedulerDialog from "@/components/attendee/MeetingSchedulerDialog";
import SponsorDetailSheet, { type SponsorDetail, SponsorLevelBadge } from "@/components/attendee/SponsorDetailSheet";
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

// ── Sponsor Card (mirrors Card 4 of the onboarding wizard) ────────────────────

function SponsorCard({
  sponsor,
  onView,
  onScheduleOnsite,
  onScheduleOnline,
  onRequestInfo,
  accentColor,
}: {
  sponsor: SponsorDetail | RecommendedSponsor;
  onView?: () => void;
  onScheduleOnsite: () => void;
  onScheduleOnline: () => void;
  onRequestInfo: () => void;
  accentColor?: string | null;
}) {
  const ac = accentColor ?? null;
  const acColor = ac ? { color: ac } : undefined;
  const acBg = ac ? { backgroundColor: `${ac}18` } : undefined;
  const hasActions = sponsor.onsiteMeetingEnabled || sponsor.onlineMeetingEnabled || sponsor.informationRequestEnabled;

  return (
    <div className="bg-card border border-border/60 rounded-2xl p-4 flex flex-col gap-3" data-testid={`card-sponsor-${sponsor.id}`}>
      {/* Logo + level badge */}
      <div className="flex items-start justify-between gap-2">
        {sponsor.logoUrl
          ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-12 rounded-xl object-contain shrink-0 border border-border/40 bg-white p-1" />
          : (
            <div className="h-12 w-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/10" style={acBg}>
              <Building2 className="h-6 w-6 text-primary" style={acColor} />
            </div>
          )
        }
        <SponsorLevelBadge level={sponsor.level ?? null} />
      </div>

      {/* Name, description, relevance, profile link */}
      <div className="space-y-1 min-w-0">
        <p className="font-bold text-sm text-foreground leading-snug" data-testid={`text-sponsor-name-${sponsor.id}`}>
          {sponsor.name}
        </p>
        {sponsor.shortDescription && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{sponsor.shortDescription}</p>
        )}
        {sponsor.overlapTopicLabels.length > 0 && (
          <div className="flex items-start gap-1 pt-0.5">
            <Sparkles className="h-3 w-3 text-primary shrink-0 mt-0.5" style={acColor} />
            <p className="text-xs text-primary font-medium leading-snug" style={acColor}>
              Relevant to your interests: {sponsor.overlapTopicLabels.join(", ")}
            </p>
          </div>
        )}
        {onView && (
          <button
            onClick={onView}
            className="flex items-center gap-1 text-xs text-primary hover:underline font-medium"
            style={acColor}
            data-testid={`button-view-sponsor-${sponsor.id}`}
          >
            View Profile
          </button>
        )}
      </div>

      {/* Action buttons — same order/style as onboarding Card 4 */}
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
              className="w-full py-2 rounded-xl text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-all active:scale-[0.98] flex items-center justify-center border border-border/60"
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
  const acColor = ac ? { color: ac } : undefined;
  const acBg = ac ? { backgroundColor: `${ac}18` } : undefined;

  const hasInterests = recommended !== undefined;

  const openDetailForRecommended = (rec: RecommendedSponsor) => {
    const full = sponsors.find((s) => s.id === rec.id);
    if (full) {
      setDetailSponsor(full);
    } else {
      setDetailSponsor({
        id: rec.id,
        name: rec.name,
        logoUrl: rec.logoUrl,
        level: rec.level,
        shortDescription: rec.shortDescription ?? null,
        websiteUrl: rec.websiteUrl ?? null,
        linkedinUrl: null,
        solutionsSummary: null,
        overlapScore: rec.overlapScore,
        overlapTopicLabels: rec.overlapTopicLabels,
        topicLabels: [],
        onsiteMeetingEnabled: rec.onsiteMeetingEnabled,
        onlineMeetingEnabled: rec.onlineMeetingEnabled,
        informationRequestEnabled: rec.informationRequestEnabled,
      });
    }
  };

  if (!token || meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  const openScheduler = (id: string, name: string, mode: "onsite" | "online") =>
    setSchedulerModal({ sponsorId: id, sponsorName: name, mode });
  const openInfo = (id: string, name: string) =>
    setRequestInfoSponsor({ id, name });

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName} accentColor={ac}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6" style={acColor ?? { color: "hsl(var(--primary))" }} />
            Sponsors
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
          <p className="text-xs text-muted-foreground mt-0.5">
            Discover sponsors, schedule meetings, and request information.
          </p>
        </div>

        {/* ── Recommended Sponsors ───────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4" style={acColor ?? { color: "hsl(var(--primary))" }} />
              Recommended for You
            </h2>
            <Link href="/attendee/interests">
              <Button variant="ghost" size="sm" className="gap-1 text-xs text-muted-foreground" data-testid="link-edit-interests">
                Edit Interests <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>

          {recommendedQuery.isLoading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!recommendedQuery.isLoading && recommended.length === 0 && (
            <div className="bg-card border border-border/60 rounded-2xl p-8 text-center space-y-2">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto" style={acBg}>
                <Sparkles className="h-6 w-6 text-primary" style={acColor} />
              </div>
              <p className="text-sm font-medium text-foreground">No matches for your current interests yet</p>
              <p className="text-xs text-muted-foreground leading-relaxed max-w-xs mx-auto">
                We don't have sponsor matches for your current interests yet. Browse all sponsors below, or{" "}
                <Link href="/attendee/interests">
                  <span className="text-primary underline cursor-pointer" style={acColor}>update your interests</span>
                </Link>{" "}
                to improve recommendations.
              </p>
            </div>
          )}

          {!recommendedQuery.isLoading && recommended.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="recommended-sponsors-grid">
              {recommended.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  accentColor={ac}
                  onView={() => openDetailForRecommended(sponsor)}
                  onScheduleOnsite={() => openScheduler(sponsor.id, sponsor.name, "onsite")}
                  onScheduleOnline={() => openScheduler(sponsor.id, sponsor.name, "online")}
                  onRequestInfo={() => openInfo(sponsor.id, sponsor.name)}
                />
              ))}
            </div>
          )}
        </div>

        {/* ── All Sponsors ───────────────────────────────────────────────── */}
        <div>
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Building2 className="h-4 w-4" style={acColor ?? { color: "hsl(var(--primary))" }} />
            All Sponsors
          </h2>

          {sponsorsQuery.isLoading && (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}

          {!sponsorsQuery.isLoading && sponsors.length === 0 && (
            <div className="bg-card border border-border/60 rounded-2xl p-8 text-center space-y-2">
              <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm text-muted-foreground">
                Sponsors will appear here once event sponsors are confirmed.
              </p>
            </div>
          )}

          {!sponsorsQuery.isLoading && sponsors.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="sponsors-grid">
              {sponsors.map((sponsor) => (
                <SponsorCard
                  key={sponsor.id}
                  sponsor={sponsor}
                  accentColor={ac}
                  onView={() => setDetailSponsor(sponsor)}
                  onScheduleOnsite={() => openScheduler(sponsor.id, sponsor.name, "onsite")}
                  onScheduleOnline={() => openScheduler(sponsor.id, sponsor.name, "online")}
                  onRequestInfo={() => openInfo(sponsor.id, sponsor.name)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sponsor detail sheet */}
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
