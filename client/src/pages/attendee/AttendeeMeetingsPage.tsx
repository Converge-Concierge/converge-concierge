import { useQuery } from "@tanstack/react-query";
import { Calendar, Clock, MapPin, Building2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttendeeMeeting {
  id: string;
  sponsorId: string;
  sponsorName: string;
  sponsorLogoUrl: string | null;
  date: string;
  time: string;
  location: string;
  meetingType: string;
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(d: string) {
  if (!d || d === "TBD") return "Date TBD";
  const dt = new Date(d + "T00:00:00");
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}
function formatTime(t: string) {
  if (!t || t === "00:00") return "";
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  Pending: { label: "Requested", className: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  Confirmed: { label: "Confirmed", className: "bg-green-100 text-green-800 border-green-200" },
  Scheduled: { label: "Scheduled", className: "bg-blue-100 text-blue-800 border-blue-200" },
  Completed: { label: "Completed", className: "bg-slate-100 text-slate-600 border-slate-200" },
  Cancelled: { label: "Cancelled", className: "bg-red-100 text-red-700 border-red-200" },
  Declined: { label: "Declined", className: "bg-red-100 text-red-700 border-red-200" },
  NoShow: { label: "No Show", className: "bg-orange-100 text-orange-700 border-orange-200" },
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeMeetingsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();

  const meetingsQuery = useQuery<AttendeeMeeting[]>({
    queryKey: ["/api/attendee-portal/meetings"],
    queryFn: () => fetch("/api/attendee-portal/meetings", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;
  const meetings = meetingsQuery.data ?? [];
  const activeMeetings = meetings.filter((m) => !["Cancelled", "Declined"].includes(m.status));
  const pastMeetings = meetings.filter((m) => ["Cancelled", "Declined"].includes(m.status));

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> My Meetings
          </h1>
          {meetings.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">{activeMeetings.length} active meeting{activeMeetings.length !== 1 ? "s" : ""}</p>
          )}
        </div>

        {meetingsQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!meetingsQuery.isLoading && meetings.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-foreground mb-2">No meetings yet</p>
            <p className="text-sm text-muted-foreground">Request meetings from the Sponsors page to get started.</p>
          </div>
        )}

        {activeMeetings.length > 0 && (
          <div className="space-y-3 mb-8" data-testid="meetings-list-active">
            {activeMeetings.map((meeting) => {
              const cfg = STATUS_CONFIG[meeting.status] ?? { label: meeting.status, className: "bg-muted text-muted-foreground border-border" };
              return (
                <div key={meeting.id} className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-meeting-${meeting.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3">
                      {meeting.sponsorLogoUrl
                        ? <img src={meeting.sponsorLogoUrl} alt={meeting.sponsorName} className="h-9 w-9 rounded-lg object-contain border border-border/40 bg-white p-0.5 shrink-0" />
                        : <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Building2 className="h-4 w-4 text-primary" /></div>
                      }
                      <div>
                        <p className="font-semibold text-sm text-foreground" data-testid={`text-meeting-sponsor-${meeting.id}`}>{meeting.sponsorName}</p>
                        <p className="text-xs text-muted-foreground">{meeting.meetingType === "online_request" ? "Online Meeting" : "Onsite Meeting"}</p>
                      </div>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.className}`} data-testid={`badge-meeting-status-${meeting.id}`}>
                      {cfg.label}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 pl-12">
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" /> {formatDate(meeting.date)}
                    </span>
                    {formatTime(meeting.time) && (
                      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {formatTime(meeting.time)}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" /> {meeting.location}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {pastMeetings.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cancelled / Declined</p>
            <div className="space-y-2 opacity-60" data-testid="meetings-list-past">
              {pastMeetings.map((meeting) => {
                const cfg = STATUS_CONFIG[meeting.status] ?? { label: meeting.status, className: "" };
                return (
                  <div key={meeting.id} className="bg-card border border-border/40 rounded-xl p-3 flex items-center gap-3" data-testid={`card-meeting-cancelled-${meeting.id}`}>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{meeting.sponsorName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(meeting.date)}</p>
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${cfg.className}`}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </AttendeeShell>
  );
}
