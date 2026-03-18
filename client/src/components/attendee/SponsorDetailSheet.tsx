import { useState } from "react";
import { X, ExternalLink, Linkedin, Building2, Calendar, Video, Mail, Sparkles, Gem } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";
import { cn } from "@/lib/utils";
import MeetingSchedulerDialog from "@/components/attendee/MeetingSchedulerDialog";
import { RequestInfoModal } from "@/components/RequestInfoModal";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SponsorDetail {
  id: string;
  name: string;
  logoUrl: string | null;
  level: string | null;
  shortDescription: string | null;
  websiteUrl: string | null;
  linkedinUrl: string | null;
  solutionsSummary: string | null;
  overlapScore: number;
  overlapTopicLabels: string[];
  topicLabels: { id: string; label: string }[];
  onsiteMeetingEnabled?: boolean;
  onlineMeetingEnabled?: boolean;
  informationRequestEnabled?: boolean;
}

interface SponsorDetailSheetProps {
  sponsor: SponsorDetail;
  interaction?: { meetingStatus?: string; infoStatus?: string };
  onClose: () => void;
  onInteractionChange: () => void;
}

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold:     "bg-amber-100 text-amber-900 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-700 border-orange-300",
};

export function SponsorLevelBadge({ level }: { level: string | null }) {
  if (!level) return null;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit", LEVEL_COLORS[level] ?? "bg-muted text-muted-foreground border-border")}>
      {level === "Platinum" && <Gem className="h-3 w-3 mr-0.5" />}
      {level}
    </span>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function SponsorDetailSheet({ sponsor, onClose, onInteractionChange }: SponsorDetailSheetProps) {
  const { headers, meQuery } = useAttendeeAuth();
  const me = meQuery.data;

  const [schedulerMode, setSchedulerMode] = useState<"onsite" | "online" | null>(null);
  const [showInfoModal, setShowInfoModal] = useState(false);

  const summaryLines = sponsor.solutionsSummary?.split("\n").filter(Boolean) ?? [];

  const hasOnsite = !!sponsor.onsiteMeetingEnabled;
  const hasOnline = !!sponsor.onlineMeetingEnabled;
  const hasInfo   = !!sponsor.informationRequestEnabled;

  const hasAnyAction = hasOnsite || hasOnline || hasInfo;

  const ac = me?.event?.buttonColor || me?.event?.accentColor || null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

        {/* Sheet */}
        <div className="relative w-full max-w-lg bg-background shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300" data-testid="sheet-sponsor-detail">
          {/* Header */}
          <div className="flex items-start gap-4 p-6 border-b border-border/60 shrink-0">
            {sponsor.logoUrl
              ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-14 w-14 rounded-xl object-contain border border-border/40 bg-white p-1.5 shrink-0" />
              : <div className="h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-7 w-7 text-primary" /></div>
            }
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h2 className="font-display font-bold text-lg leading-tight text-foreground" data-testid="text-sponsor-detail-name">{sponsor.name}</h2>
                  {sponsor.level && (
                    <div className="mt-1"><SponsorLevelBadge level={sponsor.level} /></div>
                  )}
                </div>
                <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted transition-colors shrink-0" data-testid="button-close-sponsor-sheet">
                  <X className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Relevance */}
            {sponsor.overlapTopicLabels.length > 0 && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5 mb-2">
                  <Sparkles className="h-3.5 w-3.5" /> Relevant to your interests
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {sponsor.overlapTopicLabels.map((label) => (
                    <Badge key={label} className="text-xs rounded-full bg-primary/10 text-primary border-primary/20 hover:bg-primary/10">{label}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Description */}
            {sponsor.shortDescription && (
              <p className="text-sm text-foreground leading-relaxed">{sponsor.shortDescription}</p>
            )}

            {/* Links */}
            {(sponsor.websiteUrl || sponsor.linkedinUrl) && (
              <div className="flex flex-wrap gap-2">
                {sponsor.websiteUrl && (
                  <a href={sponsor.websiteUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium"
                    data-testid="link-sponsor-website">
                    <ExternalLink className="h-3.5 w-3.5" /> Visit Website
                  </a>
                )}
                {sponsor.linkedinUrl && (
                  <a href={sponsor.linkedinUrl} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:underline font-medium"
                    data-testid="link-sponsor-linkedin">
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                  </a>
                )}
              </div>
            )}

            {/* Meeting action block — matches BookingPage layout */}
            {hasAnyAction && me && (
              <div className="border border-border/60 rounded-xl p-5 bg-card/50 space-y-4">
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    Meeting with {sponsor.name}{me.event?.name ? ` at ${me.event.name}` : ""}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Schedule a 30-minute 1-on-1 meeting at the event{hasOnline ? ", or request an online call." : "."}
                  </p>
                </div>

                <div className="flex flex-col gap-2">
                  {(hasOnsite || hasOnline) && (
                    <div className={cn("grid gap-2", hasOnsite && hasOnline ? "grid-cols-2" : "grid-cols-1")}>
                      {hasOnsite && (
                        <Button
                          className="gap-2 w-full"
                          style={ac ? { backgroundColor: ac, borderColor: ac } : undefined}
                          onClick={() => setSchedulerMode("onsite")}
                          data-testid="button-schedule-onsite-sheet"
                        >
                          <Calendar className="h-4 w-4" />
                          Schedule Onsite Meeting
                        </Button>
                      )}
                      {hasOnline && (
                        <Button
                          variant="outline"
                          className="gap-2 w-full"
                          onClick={() => setSchedulerMode("online")}
                          data-testid="button-schedule-online-sheet"
                        >
                          <Video className="h-4 w-4" />
                          Request Online Meeting
                        </Button>
                      )}
                    </div>
                  )}
                  {hasInfo && (
                    <Button
                      variant="outline"
                      className="gap-2 w-full"
                      onClick={() => setShowInfoModal(true)}
                      data-testid="button-request-info-sheet"
                    >
                      <Mail className="h-4 w-4" />
                      Request Information
                    </Button>
                  )}
                </div>
              </div>
            )}

            {/* Solutions summary */}
            {summaryLines.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">About</p>
                <div className="text-sm text-muted-foreground leading-relaxed space-y-1.5">
                  {summaryLines.map((line, i) => <p key={i}>{line}</p>)}
                </div>
              </div>
            )}

            {/* Topics */}
            {sponsor.topicLabels.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Areas of Focus</p>
                <div className="flex flex-wrap gap-1.5">
                  {sponsor.topicLabels.map((t) => (
                    <Badge key={t.id} variant="outline" className={`text-xs rounded-full ${sponsor.overlapTopicLabels.includes(t.label) ? "border-primary/30 text-primary" : ""}`}>{t.label}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Meeting scheduler dialog */}
      {schedulerMode && me && (
        <MeetingSchedulerDialog
          open={!!schedulerMode}
          onClose={() => setSchedulerMode(null)}
          sponsorId={sponsor.id}
          sponsorName={sponsor.name}
          mode={schedulerMode}
          me={me}
          headers={headers}
          onSuccess={() => {
            setSchedulerMode(null);
            onInteractionChange();
          }}
        />
      )}

      {/* Request information modal */}
      {showInfoModal && me && (
        <RequestInfoModal
          open={showInfoModal}
          onClose={() => setShowInfoModal(false)}
          onSuccess={() => {
            setShowInfoModal(false);
            onInteractionChange();
          }}
          sponsorId={sponsor.id}
          sponsorName={sponsor.name}
          eventId={me.event?.id}
          prefill={{
            email: me.attendee?.email,
            firstName: me.attendee?.firstName,
            lastName: me.attendee?.lastName,
            company: me.attendee?.company ?? undefined,
            title: me.attendee?.title ?? undefined,
          }}
        />
      )}
    </>
  );
}
