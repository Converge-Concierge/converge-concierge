import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Copy, Search, LayoutDashboard, Building2, CheckCircle2, XCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Sponsor, Event } from "@shared/schema";

interface SponsorToken {
  token: string;
  sponsorId: string;
  eventId: string;
  isActive: boolean;
  expiresAt: string;
  createdAt: string;
}

interface SponsorDashboardRow {
  token: SponsorToken;
  sponsor: Sponsor;
  event: Event;
  level: string;
}

export default function SponsorDashboardsAdminPage() {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const hasAutoSelected = useRef(false);

  const { data: tokens = [], isLoading: tokensLoading } = useQuery<SponsorToken[]>({
    queryKey: ["/api/sponsor-tokens"],
  });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const isLoading = tokensLoading;

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

  const sponsorMap = useMemo(() => new Map(sponsors.map(s => [s.id, s])), [sponsors]);
  const eventMap = useMemo(() => new Map(events.map(e => [e.id, e])), [events]);

  const rows = useMemo<SponsorDashboardRow[]>(() => {
    return tokens
      .map((token) => {
        const sponsor = sponsorMap.get(token.sponsorId);
        const event = eventMap.get(token.eventId);
        if (!sponsor || !event) return null;
        const link = (sponsor.assignedEvents ?? []).find(ae => ae.eventId === token.eventId);
        const level = link?.sponsorshipLevel ?? sponsor.level ?? "";
        return { token, sponsor, event, level };
      })
      .filter((r): r is SponsorDashboardRow => r !== null);
  }, [tokens, sponsorMap, eventMap]);

  const filtered = useMemo(() => {
    return rows.filter((row) => {
      if (selectedEventId !== "all" && row.event.id !== selectedEventId) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!row.sponsor.name.toLowerCase().includes(q) && !row.event.name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [rows, selectedEventId, searchQuery]);

  const activeCount = filtered.filter(r => r.token.isActive).length;

  function copyLink(token: string) {
    const url = `${window.location.origin}/sponsor-access/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link copied", description: "Dashboard access link copied to clipboard." });
    });
  }

  function openDashboard(token: string) {
    const url = `/sponsor-access/${token}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Sponsor Dashboards</h1>
          <p className="text-sm text-muted-foreground mt-1">Access and preview sponsor dashboard portals for each event.</p>
        </div>
      </div>

      {/* Event tabs */}
      {sortedEventsForSelector.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {sortedEventsForSelector.map((event) => {
              const isActive = selectedEventId === event.id;
              return (
                <button
                  key={event.id}
                  data-testid={`event-tab-${event.id}`}
                  onClick={() => setSelectedEventId(event.id)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  style={isActive ? { backgroundColor: event.accentColor ?? "#0D9488", color: "#ffffff" } : undefined}
                >
                  {event.slug ?? event.name}
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

      {/* Search + summary */}
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
        <span className="text-sm text-muted-foreground">
          <strong>{activeCount}</strong> active &bull; <strong>{filtered.length}</strong> total
        </span>
      </div>

      {/* Table */}
      <div className="bg-card border border-border/60 rounded-xl shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mx-auto mb-3" />
            <p className="text-sm">Loading dashboards…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <LayoutDashboard className="h-10 w-10 opacity-20 mx-auto mb-3" />
            <p className="text-sm font-medium">No sponsor dashboards found</p>
            <p className="text-xs mt-1">Sponsor access tokens are generated from the Sponsors page.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sponsor</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Event</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Level</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {filtered.map((row) => (
                <tr
                  key={row.token.token}
                  className="hover:bg-muted/20 transition-colors"
                  data-testid={`row-dashboard-${row.token.token.slice(0, 8)}`}
                >
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {row.sponsor.logoUrl ? (
                        <img
                          src={row.sponsor.logoUrl}
                          alt={row.sponsor.name}
                          className="h-8 w-8 rounded object-contain border border-border/40 bg-white p-0.5 shrink-0"
                        />
                      ) : (
                        <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
                          <Building2 className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                      <span className="font-medium text-foreground">{row.sponsor.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: row.event.accentColor ?? "#0D9488" }}
                      />
                      <span className="text-foreground">{row.event.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    {row.level ? (
                      <Badge variant="outline" className="text-xs font-semibold">{row.level}</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">—</span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {row.token.isActive ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
                        <CheckCircle2 className="h-3 w-3" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded-full">
                        <XCircle className="h-3 w-3" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => copyLink(row.token.token)}
                        data-testid={`btn-copy-link-${row.token.token.slice(0, 8)}`}
                        disabled={!row.token.isActive}
                      >
                        <Copy className="h-3.5 w-3.5" /> Copy Link
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 gap-1.5 text-xs"
                        onClick={() => openDashboard(row.token.token)}
                        data-testid={`btn-open-dashboard-${row.token.token.slice(0, 8)}`}
                        disabled={!row.token.isActive}
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> Open Dashboard
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
