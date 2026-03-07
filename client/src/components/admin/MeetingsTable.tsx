import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2 } from "lucide-react";
import { Meeting, Event, Sponsor, Attendee } from "@shared/schema";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Scheduled: "default",
  Completed: "secondary",
  Cancelled: "destructive",
  NoShow: "outline",
};

interface MeetingsTableProps {
  meetings: Meeting[];
  events: Event[];
  sponsors: Sponsor[];
  attendees: Attendee[];
  onEdit: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
}

export function MeetingsTable({ meetings, events, sponsors, attendees, onEdit, onDelete }: MeetingsTableProps) {
  const getEvent = (id: string) => events.find((e) => e.id === id);
  const getSponsor = (id: string) => sponsors.find((s) => s.id === id);
  const getAttendee = (id: string) => attendees.find((a) => a.id === id);

  const formatTime = (t: string) => {
    const [h, m] = t.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const h12 = hour % 12 || 12;
    return `${h12}:${m} ${ampm}`;
  };

  return (
    <div className="rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Event</TableHead>
            <TableHead>Sponsor</TableHead>
            <TableHead>Attendee</TableHead>
            <TableHead>Date</TableHead>
            <TableHead>Time</TableHead>
            <TableHead>Location</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {meetings.map((meeting) => {
            const ev = getEvent(meeting.eventId);
            const sp = getSponsor(meeting.sponsorId);
            const at = getAttendee(meeting.attendeeId);
            return (
              <TableRow key={meeting.id} data-testid={`row-meeting-${meeting.id}`}>
                <TableCell>
                  <Badge variant="outline" className="text-xs font-mono">{ev?.slug ?? "—"}</Badge>
                </TableCell>
                <TableCell className="font-medium">{sp?.name ?? "—"}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{at?.name ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{at?.company ?? ""}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{meeting.date}</TableCell>
                <TableCell className="text-sm">{formatTime(meeting.time)}</TableCell>
                <TableCell className="text-sm">{meeting.location}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[meeting.status] ?? "outline"}>
                    {meeting.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" size="icon" onClick={() => onEdit(meeting)} data-testid={`edit-meeting-${meeting.id}`}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => onDelete(meeting)} data-testid={`delete-meeting-${meeting.id}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
          {meetings.length === 0 && (
            <TableRow>
              <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                No meetings found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
