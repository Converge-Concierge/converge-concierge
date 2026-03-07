import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Archive, Trash2, Link2, Building2, Eye, RotateCcw } from "lucide-react";
import { Sponsor, Event, SponsorToken } from "@shared/schema";
import { SponsorAccessModal } from "./SponsorAccessModal";
import { cn } from "@/lib/utils";

const levelColors: Record<string, string> = {
  Platinum: "bg-slate-200 text-slate-800 border-slate-300",
  Gold:     "bg-yellow-100 text-yellow-800 border-yellow-300",
  Silver:   "bg-gray-100 text-gray-700 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-800 border-orange-300",
};

interface SponsorsTableProps {
  sponsors: Sponsor[];
  events: Event[];
  tab: "active" | "archived";
  isAdmin: boolean;
  onEdit: (sponsor: Sponsor) => void;
  onView: (sponsor: Sponsor) => void;
  onArchive: (sponsor: Sponsor) => void;
  onReactivate: (sponsor: Sponsor) => void;
  onDelete: (sponsor: Sponsor) => void;
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

function getSponsorLinkStatus(sponsorId: string, tokens: SponsorToken[]): "active" | "revoked" | "none" {
  const sponsorTokens = tokens.filter((t) => t.sponsorId === sponsorId);
  if (sponsorTokens.length === 0) return "none";
  const hasActive = sponsorTokens.some((t) => t.isActive && new Date(t.expiresAt) > new Date());
  return hasActive ? "active" : "revoked";
}

export function SponsorsTable({ sponsors, events, tab, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete }: SponsorsTableProps) {
  const [accessSponsor, setAccessSponsor] = useState<Sponsor | null>(null);

  const { data: allTokens = [] } = useQuery<SponsorToken[]>({ queryKey: ["/api/sponsor-tokens"] });

  const getEventBadges = (eventIds: string[]) => {
    if (!eventIds || eventIds.length === 0) return <span className="text-muted-foreground italic text-xs">None</span>;
    return eventIds.map((id) => {
      const ev = events.find((e) => e.id === id);
      return ev ? <Badge key={id} variant="outline" className="mr-1 text-xs font-mono">{ev.slug}</Badge> : null;
    });
  };

  const sorted = [...sponsors].sort((a, b) => {
    const order = ["Platinum", "Gold", "Silver", "Bronze"];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });

  return (
    <>
      <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-12" />
              <TableHead>Sponsor</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Assigned Event(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((sponsor) => {
              const linkStatus = getSponsorLinkStatus(sponsor.id, allTokens);
              const linkIconColor =
                linkStatus === "active"  ? "text-green-600 hover:text-green-700" :
                linkStatus === "revoked" ? "text-red-500 hover:text-red-600"     :
                                           "text-muted-foreground";

              return (
                <TableRow key={sponsor.id} data-testid={`row-sponsor-${sponsor.id}`} className={cn(tab === "archived" ? "opacity-70" : "")}>
                  <TableCell className="py-3">
                    <SponsorLogo name={sponsor.name} logoUrl={sponsor.logoUrl} />
                  </TableCell>
                  <TableCell className="font-semibold text-foreground py-3">{sponsor.name}</TableCell>
                  <TableCell className="py-3">
                    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold", levelColors[sponsor.level] ?? "")}>
                      {sponsor.level}
                    </span>
                  </TableCell>
                  <TableCell className="py-3">{getEventBadges(sponsor.assignedEvents || [])}</TableCell>
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
                          <Button variant="ghost" size="icon" title="Manage access links" onClick={() => setAccessSponsor(sponsor)} data-testid={`access-links-${sponsor.id}`} className={linkIconColor}>
                            <Link2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" title="Edit sponsor" onClick={() => onEdit(sponsor)} data-testid={`edit-sponsor-${sponsor.id}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
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

      {accessSponsor && (
        <SponsorAccessModal sponsor={accessSponsor} events={events} isOpen={true} onClose={() => setAccessSponsor(null)} />
      )}
    </>
  );
}
