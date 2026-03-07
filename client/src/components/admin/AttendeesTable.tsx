import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { Attendee, Event } from "@shared/schema";

interface AttendeesTableProps {
  attendees: Attendee[];
  events: Event[];
  onEdit: (attendee: Attendee) => void;
  onDelete: (attendee: Attendee) => void;
}

export function AttendeesTable({ attendees, events, onEdit, onDelete }: AttendeesTableProps) {
  const getEventCode = (eventId: string) => {
    const ev = events.find((e) => e.id === eventId);
    return ev ? (
      <Badge variant="outline" className="text-xs font-mono">{ev.slug}</Badge>
    ) : (
      <span className="text-muted-foreground italic text-xs">Unknown</span>
    );
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Company</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Assigned Event</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {attendees.map((attendee) => (
            <TableRow key={attendee.id} data-testid={`row-attendee-${attendee.id}`}>
              <TableCell className="font-medium">{attendee.name}</TableCell>
              <TableCell>{attendee.company}</TableCell>
              <TableCell>{attendee.title}</TableCell>
              <TableCell className="text-muted-foreground text-sm">{attendee.email}</TableCell>
              <TableCell>{getEventCode(attendee.assignedEvent)}</TableCell>
              <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="icon" onClick={() => onEdit(attendee)} data-testid={`edit-attendee-${attendee.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(attendee)} data-testid={`delete-attendee-${attendee.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
          {attendees.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                No attendees found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
