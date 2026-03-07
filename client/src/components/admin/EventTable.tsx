import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Archive, Trash2, Eye, RotateCcw } from "lucide-react";
import { Event } from "@shared/schema";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { SortHead, useSortState, sortData } from "@/hooks/use-sort";

interface EventTableProps {
  events: Event[];
  tab: "active" | "archived";
  isAdmin: boolean;
  onEdit: (event: Event) => void;
  onView: (event: Event) => void;
  onArchive: (event: Event) => void;
  onReactivate: (event: Event) => void;
  onDelete: (event: Event) => void;
}

export function EventTable({ events, tab, isAdmin, onEdit, onView, onArchive, onReactivate, onDelete }: EventTableProps) {
  const { sort, toggle } = useSortState("startDate", "asc");

  const getValue = (e: Event, key: string): string | number => {
    if (key === "name") return e.name;
    if (key === "location") return e.location;
    if (key === "startDate") return new Date(e.startDate).getTime();
    if (key === "status") return e.status;
    return "";
  };

  const sorted = sortData(events, sort, getValue);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <SortHead sortKey="name" sort={sort} onSort={toggle}>Event Name</SortHead>
            <SortHead sortKey="location" sort={sort} onSort={toggle}>Location</SortHead>
            <SortHead sortKey="startDate" sort={sort} onSort={toggle}>Dates</SortHead>
            <SortHead sortKey="status" sort={sort} onSort={toggle}>Status</SortHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((event) => (
            <TableRow key={event.id} className={cn(tab === "archived" ? "opacity-70" : "")}>
              <TableCell className="font-medium py-3">{event.name}</TableCell>
              <TableCell className="text-muted-foreground py-3">{event.location}</TableCell>
              <TableCell className="py-3">
                {format(new Date(event.startDate), "MMM d")} – {format(new Date(event.endDate), "MMM d, yyyy")}
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
                      <Button variant="ghost" size="icon" title="Edit event" onClick={() => onEdit(event)} data-testid={`edit-event-${event.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Archive event" onClick={() => onArchive(event)} data-testid={`archive-event-${event.id}`}>
                        <Archive className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete event" onClick={() => onDelete(event)} data-testid={`delete-event-${event.id}`}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </>
                  ) : (
                    <>
                      <Button variant="ghost" size="icon" title="View event details" onClick={() => onView(event)} data-testid={`view-event-${event.id}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" title="Re-activate event" onClick={() => onReactivate(event)} className="text-green-600 hover:text-green-700" data-testid={`reactivate-event-${event.id}`}>
                            <RotateCcw className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete event" onClick={() => onDelete(event)} data-testid={`delete-event-archived-${event.id}`}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </>
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="h-28 text-center text-muted-foreground">
                <p className="text-sm">{tab === "active" ? "No active events." : "No archived events."}</p>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
