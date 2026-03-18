import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ExternalLink, Linkedin, Building2, Calendar, Mail, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";
import { useToast } from "@/hooks/use-toast";

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
  Platinum: "bg-purple-100 text-purple-700 border-purple-200",
  Gold: "bg-yellow-100 text-yellow-700 border-yellow-200",
  Silver: "bg-slate-100 text-slate-600 border-slate-200",
  Bronze: "bg-orange-100 text-orange-700 border-orange-200",
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function SponsorDetailSheet({ sponsor, onClose, onInteractionChange }: SponsorDetailSheetProps) {
  const { headers } = useAttendeeAuth();
  const qc = useQueryClient();
  const { toast } = useToast();

  const requestMeetingMutation = useMutation({
    mutationFn: () =>
      fetch("/api/attendee-portal/request-meeting", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId: sponsor.id }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      onInteractionChange();
      toast({ title: "Meeting request sent", description: `We'll connect you with ${sponsor.name}.` });
    },
  });

  const requestInfoMutation = useMutation({
    mutationFn: () =>
      fetch("/api/attendee-portal/request-info", {
        method: "POST", headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ sponsorId: sponsor.id }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/sponsor-interactions"] });
      onInteractionChange();
      toast({ title: "Information requested", description: `${sponsor.name} will be in touch with more details.` });
    },
  });

  const summaryLines = sponsor.solutionsSummary?.split("\n").filter(Boolean) ?? [];

  return (
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
                  <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[sponsor.level] ?? "bg-muted text-muted-foreground border-border"}`}>
                    {sponsor.level} Sponsor
                  </span>
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
                  <ExternalLink className="h-3.5 w-3.5" /> Website
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

        {/* Action footer */}
        <div className="border-t border-border/60 p-4 bg-card/50 shrink-0">
          <div className="grid grid-cols-2 gap-3">
            <Button variant="default" className="gap-2 w-full" disabled={requestMeetingMutation.isPending}
              onClick={() => requestMeetingMutation.mutate()} data-testid="button-request-meeting-sheet">
              <Calendar className="h-4 w-4" />
              {requestMeetingMutation.isPending ? "Requesting…" : "Request Meeting"}
            </Button>
            <Button variant="outline" className="gap-2 w-full" disabled={requestInfoMutation.isPending}
              onClick={() => requestInfoMutation.mutate()} data-testid="button-request-info-sheet">
              <Mail className="h-4 w-4" />
              {requestInfoMutation.isPending ? "Requesting…" : "Request Info"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
