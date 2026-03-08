import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Globe, ShieldCheck } from "lucide-react";
import { Meeting, Event, Sponsor, Attendee } from "@shared/schema";
import { SortHead, useSortState, sortData } from "@/hooks/use-sort";
import { cn } from "@/lib/utils";

const statusVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  Scheduled: "default",
  Completed: "secondary",
  Cancelled: "destructive",
  NoShow: "outline",
};

const statusOrder: Record<string, number> = { Scheduled: 0, Completed: 1, Cancelled: 2, NoShow: 3 };

interface MeetingsTableProps {
  meetings: Meeting[];
  events: Event[];
  sponsors: Sponsor[];
  attendees: Attendee[];
  onEdit: (meeting: Meeting) => void;
  onDelete: (meeting: Meeting) => void;
}

export function MeetingsTable({ meetings, events, sponsors, attendees, onEdit, onDelete }: MeetingsTableProps) {
  const { sort, toggle } = useSortState("date", "asc");

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

  const getValue = (m: Meeting, key: string): string | number => {
    if (key === "event")   return getEvent(m.eventId)?.slug ?? "";
    if (key === "sponsor") return getSponsor(m.sponsorId)?.name ?? "";
    if (key === "attendee") return getAttendee(m.attendeeId)?.name ?? "";
    if (key === "date")    return m.date;
    if (key === "time")    return m.time;
    if (key === "location") return m.location;
    if (key === "status")  return statusOrder[m.status] ?? 99;
    if (key === "source")  return m.source ?? "admin";
    return "";
  };

  const sorted = sortData(meetings, sort, getValue);

  return (
    <div className="rounded-xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/30 hover:bg-muted/30">
            <SortHead sortKey="event"    sort={sort} onSort={toggle}>Event</SortHead>
            <SortHead sortKey="sponsor"  sort={sort} onSort={toggle}>Sponsor</SortHead>
            <SortHead sortKey="attendee" sort={sort} onSort={toggle}>Attendee</SortHead>
            <SortHead sortKey="date"     sort={sort} onSort={toggle}>Date</SortHead>
            <SortHead sortKey="time"     sort={sort} onSort={toggle}>Time</SortHead>
            <SortHead sortKey="location" sort={sort} onSort={toggle}>Location</SortHead>
            <SortHead sortKey="status"   sort={sort} onSort={toggle}>Status</SortHead>
            <SortHead sortKey="source"   sort={sort} onSort={toggle}>Source</SortHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((meeting) => {
            const ev = getEvent(meeting.eventId);
            const sp = getSponsor(meeting.sponsorId);
            const at = getAttendee(meeting.attendeeId);
            const isPublic = meeting.source === "public";
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
                  <Badge variant={statusVariant[meeting.status] ?? "outline"}>{meeting.status}</Badge>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border",
                      isPublic
                        ? "bg-violet-50 text-violet-700 border-violet-200"
                        : "bg-muted text-muted-foreground border-border",
                    )}
                    data-testid={`source-badge-${meeting.id}`}
                  >
                    {isPublic
                      ? <><Globe className="h-3 w-3" /> Public</>
                      : <><ShieldCheck className="h-3 w-3" /> Admin</>
                    }
                  </span>
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
          {sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                No meetings found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
