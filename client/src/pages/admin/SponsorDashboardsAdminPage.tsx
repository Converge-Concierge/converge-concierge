import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ExternalLink, Copy, Search, LayoutDashboard, Building2,
  CheckCircle2, XCircle, Send, AlertCircle, Clock, UserCheck,
  Mail, RefreshCw,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Event } from "@shared/schema";

interface DashboardRow {
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl: string | null;
  eventId: string;
  eventName: string;
  eventSlug: string;
  eventAccentColor: string | null;
  sponsorshipLevel: string;
  primaryContact: { name: string; email: string } | null;
  status: string;
  tokenIsActive: boolean;
  hasToken: boolean;
  tokenValue: string | null;
  lastAccessSent: string | null;
  lastLogin: string | null;
}

const STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; label: string; classes: string }> = {
  Active: { icon: CheckCircle2, label: "Active", classes: "text-green-700 bg-green-50 border-green-200" },
  "Access Sent": { icon: Send, label: "Access Sent", classes: "text-blue-700 bg-blue-50 border-blue-200" },
  Ready: { icon: Clock, label: "Ready", classes: "text-amber-700 bg-amber-50 border-amber-200" },
  "No Contact Assigned": { icon: AlertCircle, label: "No Contact", classes: "text-red-700 bg-red-50 border-red-200" },
  Inactive: { icon: XCircle, label: "Inactive", classes: "text-gray-500 bg-gray-100 border-gray-200" },
};

function fmtDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function SponsorDashboardsAdminPage() {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmSendRow, setConfirmSendRow] = useState<DashboardRow | null>(null);
  const hasAutoSelected = useRef(false);

  const { data: rows = [], isLoading } = useQuery<DashboardRow[]>({
    queryKey: ["/api/admin/sponsor-dashboards"],
  });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  useEffect(() => {
    if (hasAutoSelected.current || events.length === 0) return;
    hasAutoSelected.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter(e => (e.archiveState ?? "active") === "active" && e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    if (upcoming.length > 0) setSelectedEventId(upcoming[0].id);
  }, [events]);

  const sortedEventsForSelector = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active.filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active.filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  const eventIds = useMemo(() => new Set(rows.map(r => r.eventId)), [rows]);
  const eventsWithSponsors = useMemo(() => sortedEventsForSelector.filter(e => eventIds.has(e.id)), [sortedEventsForSelector, eventIds]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedEventId !== "all" && row.eventId !== selectedEventId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!row.sponsorName.toLowerCase().includes(q) && !row.eventName.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, selectedEventId, searchQuery]);

  const activeCount = filtered.filter(r => r.status === "Active" || r.status === "Access Sent").length;

  const sendAccessMutation = useMutation({
    mutationFn: async (args: { sponsorId: string; eventId: string }) => {
      const res = await apiRequest("POST", "/api/admin/sponsor-dashboards/send-access", args);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Dashboard access sent", description: data.message ?? "Magic login link sent to primary contact." });
      setConfirmSendRow(null);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsor-dashboards"] });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to send access", description: err.message, variant: "destructive" });
    },
  });

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/sponsor-dashboards/backfill", {});
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Backfill complete", description: data.message });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsor-dashboards"] });
    },
    onError: (err: Error) => {
      toast({ title: "Backfill failed", description: err.message, variant: "destructive" });
    },
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground" data-testid="heading-sponsor-dashboards">Sponsor Dashboards</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage sponsor dashboard access and readiness for each event.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => backfillMutation.mutate()}
          disabled={backfillMutation.isPending}
          data-testid="button-backfill-contacts"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", backfillMutation.isPending && "animate-spin")} />
          {backfillMutation.isPending ? "Backfilling…" : "Backfill Contacts"}
        </Button>
      </div>

      {eventsWithSponsors.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {eventsWithSponsors.map((event) => {
              const isActive = selectedEventId === event.id;
              const count = rows.filter(r => r.eventId === event.id).length;
              return (
                <button
                  key={event.id}
                  data-testid={`event-tab-${event.id}`}
                  onClick={() => setSelectedEventId(event.id)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  style={isActive ? { backgroundColor: event.accentColor ?? event.primaryColor ?? "#0D9488", color: "#ffffff" } : undefined}
                >
                  {event.slug ?? event.name} ({count})
                </button>
              );
            })}
            <button
              data-testid="event-tab-all"
              onClick={() => setSelectedEventId("all")}
              className={cn(
                "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                selectedEventId === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              style={selectedEventId === "all" ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
            >
              All Events
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by sponsor or event…"
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-dashboards"
          />
        </div>
        <span className="text-sm text-muted-foreground" data-testid="text-dashboard-counts">
          <strong>{activeCount}</strong> active &bull; <strong>{filtered.length}</strong> total
        </span>
      </div>

      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3" />
            <p className="text-sm">Loading dashboards…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <LayoutDashboard className="h-10 w-10 opacity-20 mx-auto mb-3" />
            <p className="text-sm font-medium" data-testid="text-empty-dashboards">No sponsor dashboards found</p>
            <p className="text-xs mt-1">No sponsors are assigned to {selectedEventId === "all" ? "any event" : "this event"} with an active sponsorship level.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sponsor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Level</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Primary Contact</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Last Access</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((row) => {
                const cfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG["Ready"];
                const StatusIcon = cfg.icon;
                return (
                  <tr
                    key={`${row.sponsorId}-${row.eventId}`}
                    className="hover:bg-muted/20 transition-colors"
                    data-testid={`row-dashboard-${row.sponsorId}-${row.eventId}`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {row.sponsorLogoUrl ? (
                          <img
                            src={row.sponsorLogoUrl}
                            alt={row.sponsorName}
                            className="h-8 w-8 rounded object-contain border border-border/40 bg-white p-0.5 shrink-0"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                            <Building2 className="h-4 w-4 text-muted-foreground/50" />
                          </div>
                        )}
                        <span className="font-medium text-foreground" data-testid={`text-sponsor-name-${row.sponsorId}`}>{row.sponsorName}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: row.eventAccentColor ?? "#0D9488" }}
                        />
                        <span className="text-foreground">{row.eventSlug}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      {row.sponsorshipLevel ? (
                        <Badge variant="outline" className="text-xs font-semibold">{row.sponsorshipLevel}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {row.primaryContact ? (
                        <div>
                          <p className="text-sm font-medium text-foreground" data-testid={`text-contact-name-${row.sponsorId}`}>{row.primaryContact.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{row.primaryContact.email}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-red-500 italic" data-testid={`text-no-contact-${row.sponsorId}`}>No contact assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <span className={cn("inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full border", cfg.classes)} data-testid={`badge-status-${row.sponsorId}-${row.eventId}`}>
                        <StatusIcon className="h-3 w-3" /> {cfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(row.lastAccessSent)}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 gap-1.5 text-xs"
                          onClick={() => setConfirmSendRow(row)}
                          disabled={!row.primaryContact}
                          data-testid={`btn-send-access-${row.sponsorId}-${row.eventId}`}
                          title={!row.primaryContact ? "No contact assigned" : row.hasToken ? "Resend dashboard access" : "Send dashboard access"}
                        >
                          <Send className="h-3.5 w-3.5" /> {row.hasToken ? "Resend" : "Send Access"}
                        </Button>
                        {row.tokenIsActive && row.tokenValue && (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => {
                                navigator.clipboard.writeText(`${window.location.origin}/sponsor-access/${row.tokenValue}`);
                                toast({ title: "Link copied" });
                              }}
                              data-testid={`btn-copy-link-${row.sponsorId}-${row.eventId}`}
                            >
                              <Copy className="h-3.5 w-3.5" /> Copy
                            </Button>
                            <Button
                              size="sm"
                              className="h-8 gap-1.5 text-xs"
                              onClick={() => window.open(`/sponsor-access/${row.tokenValue}`, "_blank")}
                              data-testid={`btn-open-dashboard-${row.sponsorId}-${row.eventId}`}
                            >
                              <ExternalLink className="h-3.5 w-3.5" /> Open
                            </Button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={!!confirmSendRow} onOpenChange={(open) => { if (!open) setConfirmSendRow(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-accent" />
              {confirmSendRow?.hasToken ? "Resend Dashboard Access" : "Send Dashboard Access"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">
              {confirmSendRow?.hasToken
                ? "This will generate a new access token and send a magic login link to the primary contact."
                : "This will generate a dashboard access token and send a magic login link to the primary contact."}
            </p>
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3 space-y-1">
              <p className="text-sm font-medium">{confirmSendRow?.sponsorName}</p>
              <p className="text-xs text-muted-foreground">{confirmSendRow?.eventName}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
                <Mail className="h-3 w-3" />
                {confirmSendRow?.primaryContact?.email ?? "No contact"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setConfirmSendRow(null)}>Cancel</Button>
            <Button
              size="sm"
              disabled={sendAccessMutation.isPending}
              onClick={() => confirmSendRow && sendAccessMutation.mutate({ sponsorId: confirmSendRow.sponsorId, eventId: confirmSendRow.eventId })}
              className="gap-2"
              data-testid="button-confirm-send-access"
            >
              <Send className="h-3.5 w-3.5" /> {sendAccessMutation.isPending ? "Sending…" : "Send Access"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
