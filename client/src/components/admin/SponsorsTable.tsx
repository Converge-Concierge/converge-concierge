import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Archive, Trash2, Link2 } from "lucide-react";
import { Sponsor, Event } from "@shared/schema";
import { SponsorAccessModal } from "./SponsorAccessModal";

const levelColors: Record<string, string> = {
  Platinum: "bg-slate-200 text-slate-800 border-slate-300",
  Gold: "bg-yellow-100 text-yellow-800 border-yellow-300",
  Silver: "bg-gray-100 text-gray-700 border-gray-300",
  Bronze: "bg-orange-100 text-orange-800 border-orange-300",
};

interface SponsorsTableProps {
  sponsors: Sponsor[];
  events: Event[];
  onEdit: (sponsor: Sponsor) => void;
  onArchive: (sponsor: Sponsor) => void;
  onDelete: (sponsor: Sponsor) => void;
}

export function SponsorsTable({ sponsors, events, onEdit, onArchive, onDelete }: SponsorsTableProps) {
  const [accessSponsor, setAccessSponsor] = useState<Sponsor | null>(null);

  const getEventNames = (eventIds: string[]) => {
    if (!eventIds || eventIds.length === 0) return <span className="text-muted-foreground italic text-xs">None</span>;
    return eventIds.map((id) => {
      const ev = events.find((e) => e.id === id);
      return ev ? (
        <Badge key={id} variant="outline" className="mr-1 text-xs font-mono">
          {ev.slug}
        </Badge>
      ) : null;
    });
  };

  const sorted = [...sponsors].sort((a, b) => {
    if (a.status === "active" && b.status === "archived") return -1;
    if (a.status === "archived" && b.status === "active") return 1;
    const order = ["Platinum", "Gold", "Silver", "Bronze"];
    return order.indexOf(a.level) - order.indexOf(b.level);
  });

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Sponsor Name</TableHead>
              <TableHead>Level</TableHead>
              <TableHead>Assigned Event(s)</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((sponsor) => (
              <TableRow key={sponsor.id} data-testid={`row-sponsor-${sponsor.id}`}>
                <TableCell className="font-medium">{sponsor.name}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${levelColors[sponsor.level] || ""}`}>
                    {sponsor.level}
                  </span>
                </TableCell>
                <TableCell>{getEventNames(sponsor.assignedEvents || [])}</TableCell>
                <TableCell>
                  <Badge variant={sponsor.status === "active" ? "default" : "secondary"}>
                    {sponsor.status.charAt(0).toUpperCase() + sponsor.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Access Links"
                      onClick={() => setAccessSponsor(sponsor)}
                      data-testid={`access-links-${sponsor.id}`}
                    >
                      <Link2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => onEdit(sponsor)} data-testid={`edit-sponsor-${sponsor.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {sponsor.status === "active" && (
                      <Button variant="ghost" size="icon" onClick={() => onArchive(sponsor)} data-testid={`archive-sponsor-${sponsor.id}`}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(sponsor)} data-testid={`delete-sponsor-${sponsor.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sorted.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                  No sponsors found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {accessSponsor && (
        <SponsorAccessModal
          sponsor={accessSponsor}
          events={events}
          isOpen={true}
          onClose={() => setAccessSponsor(null)}
        />
      )}
    </>
  );
}
