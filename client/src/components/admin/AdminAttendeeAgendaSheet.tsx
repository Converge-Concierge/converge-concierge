import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Clock, MapPin, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Attendee } from "@shared/schema";

interface SavedSessionItem {
  id: string;
  title: string;
  sessionDate: string;
  startTime: string;
  endTime: string;
  locationName: string | null;
  locationDetails: string | null;
  sessionTypeLabel: string;
  savedAt: string;
}

interface AdminAttendeeAgendaSheetProps {
  attendee: Attendee | null;
  open: boolean;
  onClose: () => void;
}

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTime(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

export function AdminAttendeeAgendaSheet({ attendee, open, onClose }: AdminAttendeeAgendaSheetProps) {
  const sessionsQuery = useQuery<SavedSessionItem[]>({
    queryKey: ["/api/admin/attendees", attendee?.id, "saved-sessions"],
    queryFn: () => fetch(`/api/admin/attendees/${attendee!.id}/saved-sessions`).then((r) => r.json()),
    enabled: !!attendee && open,
  });

  const sessions = sessionsQuery.data ?? [];

  // Group by date
  const grouped = sessions.reduce<Record<string, SavedSessionItem[]>>((acc, s) => {
    if (!acc[s.sessionDate]) acc[s.sessionDate] = [];
    acc[s.sessionDate].push(s);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort();

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto" data-testid="sheet-admin-agenda">
        <SheetHeader className="mb-4">
          <div className="flex items-start justify-between gap-2">
            <div>
              <SheetTitle className="flex items-center gap-2 text-lg">
                <CalendarDays className="h-5 w-5 text-accent shrink-0" />
                {attendee?.firstName || attendee?.name?.split(" ")[0] || attendee?.name}&rsquo;s Agenda
              </SheetTitle>
              {attendee && (
                <p className="text-xs text-muted-foreground mt-1">{attendee.name} · {attendee.company}</p>
              )}
            </div>
          </div>
        </SheetHeader>

        {sessionsQuery.isLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-accent" />
          </div>
        )}

        {!sessionsQuery.isLoading && sessions.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <CalendarDays className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No sessions saved yet.</p>
          </div>
        )}

        {sessions.length > 0 && (
          <div className="space-y-6">
            {sortedDates.map((date) => (
              <div key={date}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{formatDate(date)}</p>
                <div className="space-y-2">
                  {grouped[date].map((s) => {
                    const location = [s.locationName, s.locationDetails].filter(Boolean).join(" — ");
                    return (
                      <div key={s.id} className="bg-muted/30 border border-border/60 rounded-lg p-3" data-testid={`admin-saved-session-${s.id}`}>
                        <Badge variant="outline" className="text-[10px] rounded-full mb-1">{s.sessionTypeLabel}</Badge>
                        <p className="font-medium text-sm leading-snug">{s.title}</p>
                        <div className="flex flex-wrap gap-x-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />{formatTime(s.startTime)} – {formatTime(s.endTime)}
                          </span>
                          {location && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3" />{location}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
