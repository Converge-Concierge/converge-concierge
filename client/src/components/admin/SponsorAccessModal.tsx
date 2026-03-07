import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Sponsor, Event, SponsorToken } from "@shared/schema";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Link2, Copy, ShieldOff, RefreshCw, Plus, CheckCircle2, XCircle, Clock } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface Props {
  sponsor: Sponsor;
  events: Event[];
  isOpen: boolean;
  onClose: () => void;
}

function invalidateTokens(sponsorId: string) {
  queryClient.invalidateQueries({ queryKey: ["/api/sponsor-tokens/sponsor", sponsorId] });
  queryClient.invalidateQueries({ queryKey: ["/api/sponsor-tokens"] });
}

export function SponsorAccessModal({ sponsor, events, isOpen, onClose }: Props) {
  const { toast } = useToast();
  const [copiedToken, setCopiedToken] = useState<string>("");

  const assignedEvents = events.filter((e) => (sponsor.assignedEvents ?? []).includes(e.id));

  const { data: tokens = [], isLoading } = useQuery<SponsorToken[]>({
    queryKey: ["/api/sponsor-tokens/sponsor", sponsor.id],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/sponsor-tokens/sponsor/${sponsor.id}`);
      return res.json();
    },
    enabled: isOpen,
  });

  const generateMutation = useMutation({
    mutationFn: async ({ sponsorId, eventId }: { sponsorId: string; eventId: string }) => {
      const res = await apiRequest("POST", "/api/sponsor-tokens", { sponsorId, eventId });
      return res.json();
    },
    onSuccess: () => {
      invalidateTokens(sponsor.id);
      toast({ title: "Access link generated", description: "Share this link with your sponsor contact." });
    },
    onError: () => toast({ title: "Error", description: "Failed to generate access link.", variant: "destructive" }),
  });

  const revokeMutation = useMutation({
    mutationFn: async (token: string) => {
      await apiRequest("DELETE", `/api/sponsor-tokens/${token}`);
    },
    onSuccess: () => {
      invalidateTokens(sponsor.id);
      toast({ title: "Access revoked", description: "The link is now inactive." });
    },
    onError: () => toast({ title: "Error", description: "Failed to revoke access.", variant: "destructive" }),
  });

  const regenerateMutation = useMutation({
    mutationFn: async (token: string) => {
      const res = await apiRequest("POST", `/api/sponsor-tokens/${token}/regenerate`);
      return res.json();
    },
    onSuccess: () => {
      invalidateTokens(sponsor.id);
      toast({ title: "Access link regenerated", description: "Old link is now invalid. Share the new link." });
    },
    onError: () => toast({ title: "Error", description: "Failed to regenerate.", variant: "destructive" }),
  });

  function copyLink(token: string) {
    const url = `${window.location.origin}/sponsor-access/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiedToken(token);
      toast({ title: "Copied!", description: "Access link copied to clipboard." });
      setTimeout(() => setCopiedToken(""), 2000);
    });
  }

  function getTokenForEvent(eventId: string): SponsorToken | undefined {
    return tokens.find((t) => t.eventId === eventId);
  }

  const isPending = generateMutation.isPending || revokeMutation.isPending || regenerateMutation.isPending;

  return (
    <Dialog open={isOpen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-accent" />
            Access Links — {sponsor.name}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground -mt-1">
          Secure links for your sponsor contact to view their private meeting dashboard. Each link is unique per event.
        </p>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-accent" />
          </div>
        ) : assignedEvents.length === 0 ? (
          <div className="rounded-xl bg-muted/50 border border-border/50 px-4 py-6 text-center text-sm text-muted-foreground">
            This sponsor has no assigned events yet. Assign events first before generating access links.
          </div>
        ) : (
          <div className="space-y-3 mt-1">
            {assignedEvents.map((event) => {
              const tokenRecord = getTokenForEvent(event.id);
              const isExpired = tokenRecord ? new Date(tokenRecord.expiresAt) < new Date() : false;
              const isActive = tokenRecord?.isActive && !isExpired;
              const isRevoked = tokenRecord && !tokenRecord.isActive;

              const statusLabel = isExpired ? "Expired" : isActive ? "Active" : isRevoked ? "Revoked" : null;
              const statusClass = isExpired
                ? "border-red-300 text-red-600 bg-red-50"
                : isActive
                ? "border-green-300 text-green-700 bg-green-50"
                : "border-gray-300 text-gray-500 bg-gray-50";
              const StatusIcon = isExpired ? XCircle : isActive ? CheckCircle2 : Clock;

              return (
                <div
                  key={event.id}
                  className="rounded-xl border border-border/60 bg-card overflow-hidden"
                  data-testid={`token-section-${event.id}`}
                >
                  {/* Card header */}
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border/50 bg-muted/20 gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs font-bold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded shrink-0">
                        {event.slug}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">{event.name}</span>
                    </div>
                    {statusLabel && (
                      <span className={cn(
                        "flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0",
                        statusClass,
                      )}>
                        <StatusIcon className="h-3 w-3" />
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  {/* Card body */}
                  <div className="px-4 py-3 space-y-3">
                    {!tokenRecord ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full gap-2 h-9"
                        disabled={isPending}
                        onClick={() => generateMutation.mutate({ sponsorId: sponsor.id, eventId: event.id })}
                        data-testid={`btn-generate-${event.id}`}
                      >
                        <Plus className="h-3.5 w-3.5" /> Generate Access Link
                      </Button>
                    ) : (
                      <>
                        {/* URL row */}
                        <div className="flex items-center gap-2 rounded-lg bg-muted/60 border border-border/50 px-3 py-2 min-w-0">
                          <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="text-xs font-mono text-muted-foreground min-w-0 truncate">
                            {window.location.origin}/sponsor-access/{tokenRecord.token.slice(0, 16)}…
                          </span>
                        </div>

                        {/* Expiry */}
                        <p className="text-[11px] text-muted-foreground">
                          Expires {format(new Date(tokenRecord.expiresAt), "MMM d, yyyy")}
                        </p>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {isActive && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs h-8"
                              onClick={() => copyLink(tokenRecord.token)}
                              data-testid={`btn-copy-${event.id}`}
                            >
                              {copiedToken === tokenRecord.token
                                ? <CheckCircle2 className="h-3 w-3 text-green-600" />
                                : <Copy className="h-3 w-3" />}
                              {copiedToken === tokenRecord.token ? "Copied!" : "Copy Link"}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-xs h-8"
                            disabled={isPending}
                            onClick={() => regenerateMutation.mutate(tokenRecord.token)}
                            data-testid={`btn-regenerate-${event.id}`}
                          >
                            <RefreshCw className="h-3 w-3" /> Regenerate
                          </Button>
                          {isActive && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="gap-1.5 text-xs h-8 text-destructive hover:text-destructive ml-auto"
                              disabled={isPending}
                              onClick={() => revokeMutation.mutate(tokenRecord.token)}
                              data-testid={`btn-revoke-${event.id}`}
                            >
                              <ShieldOff className="h-3 w-3" /> Revoke
                            </Button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
