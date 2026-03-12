import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Archive, Trash2, Building2, Eye, RotateCcw, Gem, Copy, Users, CalendarDays } from "lucide-react";
import { Sponsor, Event, EventSponsorLink } from "@shared/schema";
import { SortHead, useSortState, sortData } from "@/hooks/use-sort";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

const levelColors: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold:     "bg-amber-100 text-amber-900 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-700 border-orange-300",
};

const levelOrder: Record<string, number> = { Platinum: 0, Gold: 1, Silver: 2, Bronze: 3 };

function getBestLevel(sponsor: Sponsor): string {
  const active = (sponsor.assignedEvents ?? []).filter((ae) => (ae.archiveState ?? "active") === "active");
  for (const l of ["Platinum", "Gold", "Silver", "Bronze"] as const) {
    if (active.some((ae) => ae.sponsorshipLevel === l)) return l;
  }
  return sponsor.level ?? "";
}

function getLevelForEvent(sponsor: Sponsor, eventId: string): string {
  const ae = (sponsor.assignedEvents ?? []).find((ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active");
  return ae?.sponsorshipLevel ?? "";
}

interface SponsorsTableProps {
  sponsors: Sponsor[];
  events: Event[];
  tab: "active" | "archived";
  selectedEventId: string;
  isAdmin: boolean;
  onEdit: (sponsor: Sponsor) => void;
  onView: (sponsor: Sponsor) => void;
  onArchive: (sponsor: Sponsor) => void;
  onReactivate: (sponsor: Sponsor) => void;
  onDelete: (sponsor: Sponsor) => void;
  onCopy?: (sponsor: Sponsor) => void;
  onManageUsers: (sponsor: Sponsor) => void;
  copyingId?: string | null;
}

function SponsorLogo({ name, logoUrl }: { name: string; logoUrl?: string | null }) {
  const [error, setError] = useState(false);
  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (logoUrl && !error) {
    return (
      <div className="h-9 w-9 rounded-lg border border-border/60 bg-white flex items-center justify-center overflow-hidden shrink-0">
        <img src={logoUrl} alt={name} className="h-full w-full object-contain p-0.5" onError={() => setError(true)} />
      </div>
    );
  }
  return (
    <div className="h-9 w-9 rounded-lg border border-border/60 bg-muted flex items-center justify-center shrink-0">
      {initials ? <span className="text-xs font-bold text-muted-foreground">{initials}</span> : <Building2 className="h-4 w-4 text-muted-foreground/50" />}
    </div>
  );
}

function LevelBadge({ level }: { level: string }) {
  if (!level) return <span className="text-muted-foreground italic text-xs">None</span>;
  return (
    <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit", levelColors[level] ?? "")}>
      {level === "Platinum" && <Gem className="h-3 w-3" />}
      {level}
    </span>
  );
}

function MultiEventIndicator({ sponsor, currentEventId, events }: { sponsor: Sponsor; currentEventId: string; events: Event[] }) {
  const activeAssignments = (sponsor.assignedEvents ?? []).filter(
    (ae) => (ae.archiveState ?? "active") === "active" && ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
  );
  const otherAssignments = activeAssignments.filter((ae) => ae.eventId !== currentEventId);
  if (otherAssignments.length === 0) return null;

  const otherEventSlugs = otherAssignments.map((ae) => {
    const ev = events.find((e) => e.id === ae.eventId);
    return ev ? `${ev.slug} (${ae.sponsorshipLevel})` : ae.eventId;
  });

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800 px-2 py-0.5 text-[10px] font-medium text-blue-700 dark:text-blue-300 cursor-default select-none">
            <CalendarDays className="h-2.5 w-2.5" />
            Multi-Event
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px]">
          <p className="font-semibold text-xs mb-1">Also sponsored:</p>
          {otherEventSlugs.map((s) => (
            <p key={s} className="text-xs">{s}</p>
          ))}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function SponsorsTable({ sponsors, events, tab, selectedEventId, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete, onCopy, onManageUsers, copyingId }: SponsorsTableProps) {
  const { sort, toggle } = useSortState("level", "asc");
  const isAllEvents = selectedEventId === "all";

  const getEventBadgesAll = (links: EventSponsorLink[]) => {
    if (!links || links.length === 0) return <span className="text-muted-foreground italic text-xs">None</span>;
    const activeLinks = links.filter((ae) => (ae.archiveState ?? "active") === "active" && !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None");
    return activeLinks.length > 0 ? (
      <>
        {activeLinks.map((ae) => {
          const ev = events.find((e) => e.id === ae.eventId);
          return ev ? <Badge key={ae.eventId} variant="outline" className="mr-1 text-xs font-mono">{ev.slug}</Badge> : null;
        })}
      </>
    ) : <span className="text-muted-foreground italic text-xs">None</span>;
  };

  const getValue = (s: Sponsor, key: string): string | number => {
    if (key === "name") return s.name;
    if (key === "level") {
      if (!isAllEvents) return levelOrder[getLevelForEvent(s, selectedEventId)] ?? 99;
      return levelOrder[getBestLevel(s)] ?? 99;
    }
    if (key === "archiveState") return s.archiveState;
    return "";
  };

  const sorted = sortData(sponsors, sort, getValue);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <TableHead className="w-12" />
            <SortHead sortKey="name" sort={sort} onSort={toggle}>Sponsor</SortHead>
            <SortHead sortKey="level" sort={sort} onSort={toggle}>Level</SortHead>
            <TableHead>Events</TableHead>
            <SortHead sortKey="archiveState" sort={sort} onSort={toggle}>Status</SortHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((sponsor) => {
            return (
              <TableRow key={sponsor.id} data-testid={`row-sponsor-${sponsor.id}`} className={cn(tab === "archived" ? "opacity-70" : "")}>
                <TableCell className="py-3"><SponsorLogo name={sponsor.name} logoUrl={sponsor.logoUrl} /></TableCell>
                <TableCell className="font-semibold text-foreground py-3">{sponsor.name}</TableCell>

                {/* Level — event-scoped when a specific event tab is active */}
                <TableCell className="py-3">
                  {isAllEvents ? (
                    (() => {
                      const activeLinks = (sponsor.assignedEvents ?? []).filter((ae) => (ae.archiveState ?? "active") === "active" && !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None");
                      const uniqueLevels = new Set(activeLinks.map((ae) => ae.sponsorshipLevel).filter(Boolean));
                      if (activeLinks.length === 0) return <span className="text-muted-foreground italic text-xs">None</span>;
                      if (uniqueLevels.size <= 1) return <LevelBadge level={getBestLevel(sponsor)} />;
                      return (
                        <div className="flex flex-col gap-1.5">
                          {activeLinks.map((ae) => {
                            const ev = events.find((e) => e.id === ae.eventId);
                            const lvl = ae.sponsorshipLevel ?? "";
                            return ev ? (
                              <div key={ae.eventId} className="flex items-center justify-between gap-3 min-w-0">
                                <span className="text-xs font-mono font-medium text-foreground/70 shrink-0">{ev.slug}</span>
                                <LevelBadge level={lvl} />
                              </div>
                            ) : null;
                          })}
                        </div>
                      );
                    })()
                  ) : (
                    <LevelBadge level={getLevelForEvent(sponsor, selectedEventId)} />
                  )}
                </TableCell>

                {/* Events — show all for "all" tab, or scoped event + multi-event indicator */}
                <TableCell className="py-3">
                  {isAllEvents ? (
                    getEventBadgesAll(sponsor.assignedEvents || [])
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(() => {
                        const ev = events.find((e) => e.id === selectedEventId);
                        return ev ? <Badge variant="outline" className="text-xs font-mono">{ev.slug}</Badge> : null;
                      })()}
                      <MultiEventIndicator sponsor={sponsor} currentEventId={selectedEventId} events={events} />
                    </div>
                  )}
                </TableCell>

                <TableCell className="py-3">
                  {tab === "archived" ? (
                    <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300">
                      Archived / Read Only
                    </Badge>
                  ) : (
                    <Badge variant="default">Active</Badge>
                  )}
                </TableCell>

                <TableCell className="text-right py-3">
                  <div className="flex justify-end items-center gap-1">
                    {tab === "active" ? (
                      <>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => onManageUsers(sponsor)}
                                data-testid={`btn-sponsor-users-${sponsor.id}`}
                              >
                                <Users className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Manage Users</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                        <Button variant="ghost" size="icon" title="Edit sponsor" onClick={() => onEdit(sponsor)} data-testid={`edit-sponsor-${sponsor.id}`}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        {onCopy && (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Copy sponsor"
                            onClick={() => onCopy(sponsor)}
                            disabled={copyingId === sponsor.id}
                            data-testid={`copy-sponsor-${sponsor.id}`}
                          >
                            {copyingId === sponsor.id ? (
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" title="Archive sponsor" onClick={() => onArchive(sponsor)} data-testid={`archive-sponsor-${sponsor.id}`}>
                          <Archive className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete sponsor" onClick={() => onDelete(sponsor)} data-testid={`delete-sponsor-${sponsor.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    ) : (
                      <>
                        <Button variant="ghost" size="icon" title="View sponsor details" onClick={() => onView(sponsor)} data-testid={`view-sponsor-${sponsor.id}`}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        {isAdmin && (
                          <>
                            <Button variant="ghost" size="icon" title="Re-activate sponsor" onClick={() => onReactivate(sponsor)} className="text-green-600 hover:text-green-700" data-testid={`reactivate-sponsor-${sponsor.id}`}>
                              <RotateCcw className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete sponsor" onClick={() => onDelete(sponsor)} data-testid={`delete-sponsor-archived-${sponsor.id}`}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-28 text-center text-muted-foreground">
                <div className="flex flex-col items-center gap-2">
                  <Building2 className="h-6 w-6 opacity-30" />
                  <p className="text-sm">{tab === "active" ? "No active sponsors." : "No archived sponsors."}</p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
