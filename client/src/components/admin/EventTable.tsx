import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
  import { Button } from "@/components/ui/button";
  import { Badge } from "@/components/ui/badge";
  import { Edit, Archive, Trash2 } from "lucide-react";
  import { Event } from "@shared/schema";
  import { format } from "date-fns";

  interface EventTableProps {
    events: Event[];
    onEdit: (event: Event) => void;
    onArchive: (event: Event) => void;
    onDelete: (event: Event) => void;
  }

  export function EventTable({ events, onEdit, onArchive, onDelete }: EventTableProps) {
    const sortedEvents = [...events].sort((a, b) => {
      if (a.status === "active" && b.status === "archived") return -1;
      if (a.status === "archived" && b.status === "active") return 1;
      return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
    });

    return (
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Event Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Dates</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedEvents.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>{event.location}</TableCell>
                <TableCell>
                  {format(new Date(event.startDate), "MMM d")} - {format(new Date(event.endDate), "MMM d, yyyy")}
                </TableCell>
                <TableCell>
                  <Badge variant={event.status === "active" ? "default" : "secondary"}>
                    {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(event)} data-testid={`edit-event-${event.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    {event.status === "active" && (
                      <Button variant="ghost" size="icon" onClick={() => onArchive(event)} data-testid={`archive-event-${event.id}`}>
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(event)} data-testid={`delete-event-${event.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {sortedEvents.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No events found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    );
  }