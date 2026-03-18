import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar, Clock, MapPin, Building2, CheckCircle2, X, CalendarDays,
  Send, Hourglass, ChevronDown, ChevronUp, ExternalLink, Link2
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
  source: string;
  notes: string | null;
  meetingLink: string | null;
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

function SponsorLogo({ url, name, size = 10 }: { url: string | null; name: string; size?: number }) {
  const cls = `h-${size} w-${size} rounded-lg shrink-0`;
  return url
    ? <img src={url} alt={name} className={`${cls} object-contain border border-border/40 bg-white p-1`} />
    : <div className={`${cls} bg-primary/10 flex items-center justify-center`}><Building2 className="h-4 w-4 text-primary" /></div>;
}

// ── Confirmed Meeting Card ────────────────────────────────────────────────────

function ConfirmedCard({ meeting, onCalendar }: { meeting: AttendeeMeeting; onCalendar: (m: AttendeeMeeting) => void }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-card border border-green-200/60 rounded-xl p-4" data-testid={`card-meeting-confirmed-${meeting.id}`}>
      <div className="flex items-start gap-3">
        <SponsorLogo url={meeting.sponsorLogoUrl} name={meeting.sponsorName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-foreground" data-testid={`text-confirmed-sponsor-${meeting.id}`}>{meeting.sponsorName}</p>
              <p className="text-xs text-muted-foreground">{meeting.meetingType === "online_request" ? "Online Meeting" : "Onsite Meeting"}</p>
            </div>
            <Badge className="text-[10px] bg-green-100 text-green-800 border-green-200 rounded-full shrink-0">Confirmed</Badge>
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{formatDate(meeting.date)}</span>
            {formatTime(meeting.time) && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatTime(meeting.time)}</span>}
            {meeting.location && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{meeting.location}</span>}
          </div>
          {expanded && (
            <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
              {meeting.notes && <p className="text-xs text-muted-foreground">{meeting.notes}</p>}
              {meeting.meetingLink && (
                <a href={meeting.meetingLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline font-medium" data-testid={`link-meeting-link-${meeting.id}`}>
                  <Link2 className="h-3.5 w-3.5" /> Join Meeting
                </a>
              )}
            </div>
          )}
          <div className="flex items-center gap-2 mt-3">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onCalendar(meeting)} data-testid={`button-ics-confirmed-${meeting.id}`}>
              <CalendarDays className="h-3 w-3" /> Add to Calendar
            </Button>
            {(meeting.notes || meeting.meetingLink) && (
              <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid={`button-expand-meeting-${meeting.id}`}>
                {expanded ? <><ChevronUp className="h-3 w-3" /> Less</> : <><ChevronDown className="h-3 w-3" /> Details</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Invitation Card ───────────────────────────────────────────────────────────

function InvitationCard({
  meeting, onAccept, onDecline, isActing,
}: {
  meeting: AttendeeMeeting;
  onAccept: (id: string) => void;
  onDecline: (id: string) => void;
  isActing: boolean;
}) {
  return (
    <div className="bg-card border border-primary/30 rounded-xl p-4" data-testid={`card-meeting-invitation-${meeting.id}`}>
      <div className="flex items-start gap-3">
        <SponsorLogo url={meeting.sponsorLogoUrl} name={meeting.sponsorName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <p className="font-semibold text-sm text-foreground" data-testid={`text-invitation-sponsor-${meeting.id}`}>{meeting.sponsorName}</p>
            <Badge className="text-[10px] bg-primary/10 text-primary border-primary/30 rounded-full shrink-0">Invitation</Badge>
          </div>
          <p className="text-xs text-muted-foreground mb-1">Awaiting Your Response</p>
          {meeting.date && meeting.date !== "TBD" && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 mb-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Calendar className="h-3 w-3" />{formatDate(meeting.date)}</span>
              {formatTime(meeting.time) && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{formatTime(meeting.time)}</span>}
              {meeting.location && <span className="flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{meeting.location}</span>}
            </div>
          )}
          {meeting.notes && <p className="text-xs text-muted-foreground mb-3 italic">{meeting.notes}</p>}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" className="h-7 text-xs gap-1.5 bg-green-600 hover:bg-green-700 text-white border-0" disabled={isActing} onClick={() => onAccept(meeting.id)} data-testid={`button-accept-invitation-${meeting.id}`}>
              <CheckCircle2 className="h-3.5 w-3.5" /> Accept
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5" disabled={isActing} onClick={() => onDecline(meeting.id)} data-testid={`button-decline-invitation-${meeting.id}`}>
              <X className="h-3.5 w-3.5" /> Decline
            </Button>
            <Link href="/attendee/sponsors">
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground" data-testid={`button-view-sponsor-invitation-${meeting.id}`}>
                <ExternalLink className="h-3 w-3" /> View Sponsor
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Pending Request Card ──────────────────────────────────────────────────────

function PendingCard({ meeting }: { meeting: AttendeeMeeting }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4" data-testid={`card-meeting-pending-${meeting.id}`}>
      <div className="flex items-center gap-3">
        <SponsorLogo url={meeting.sponsorLogoUrl} name={meeting.sponsorName} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-sm text-foreground" data-testid={`text-pending-sponsor-${meeting.id}`}>{meeting.sponsorName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">Meeting Requested · Awaiting Sponsor Response</p>
            </div>
            <Badge variant="outline" className="text-[10px] rounded-full bg-yellow-50 text-yellow-800 border-yellow-200 shrink-0">Pending</Badge>
          </div>
        </div>
        <Link href="/attendee/sponsors">
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground shrink-0" data-testid={`button-view-sponsor-pending-${meeting.id}`}>
            <ExternalLink className="h-3 w-3" /> View
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ── Section Header ────────────────────────────────────────────────────────────

function SectionHeader({ icon, label, count }: { icon: React.ReactNode; label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {icon}
      <h2 className="text-sm font-semibold text-foreground">{label}</h2>
      <span className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5 rounded-full">{count}</span>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function AttendeeMeetingsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();

  const meetingsQuery = useQuery<AttendeeMeeting[]>({
    queryKey: ["/api/attendee-portal/meetings"],
    queryFn: () => fetch("/api/attendee-portal/meetings", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/attendee-portal/meetings/${id}/accept`, { method: "POST", headers: { "Content-Type": "application/json", ...headers } }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/meetings"] }),
  });

  const declineMutation = useMutation({
    mutationFn: (id: string) =>
      fetch(`/api/attendee-portal/meetings/${id}/decline`, { method: "POST", headers: { "Content-Type": "application/json", ...headers } }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["/api/attendee-portal/meetings"] }),
  });

  function handleCalendar(meeting: AttendeeMeeting) {
    const t = localStorage.getItem("attendee_token");
    window.open(`/api/attendee-portal/meetings/${meeting.id}/ics?token=${t}`, "_blank");
  }

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;
  const all = meetingsQuery.data ?? [];

  // Categorise
  const invitations = all.filter((m) => m.source === "admin" && m.status === "Scheduled");
  const confirmed = all.filter((m) => ["Confirmed", "Completed"].includes(m.status));
  const pending = all.filter((m) => m.source === "public" && m.status === "Pending");
  const past = all.filter((m) => ["Cancelled", "Declined", "NoShow"].includes(m.status));

  const isActing = acceptMutation.isPending || declineMutation.isPending;
  const totalActive = invitations.length + confirmed.length + pending.length;

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName} accentColor={me?.event.buttonColor || me?.event.accentColor || null}>
      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Calendar className="h-6 w-6 text-primary" /> My Meetings
          </h1>
          {totalActive > 0 && (
            <p className="text-sm text-muted-foreground mt-1" data-testid="text-meetings-count">{totalActive} active meeting{totalActive !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Loading */}
        {meetingsQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {/* Empty state */}
        {!meetingsQuery.isLoading && all.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <Calendar className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="font-medium text-foreground mb-2">No meetings yet</p>
            <p className="text-sm text-muted-foreground mb-5">Request meetings from the Sponsors page to get started.</p>
            <Link href="/attendee/sponsors">
              <Button data-testid="button-explore-sponsors-empty">Explore Sponsors</Button>
            </Link>
          </div>
        )}

        {/* Meeting Invitations */}
        {invitations.length > 0 && (
          <div className="mb-8" data-testid="section-invitations">
            <SectionHeader
              icon={<Send className="h-4 w-4 text-primary" />}
              label="Meeting Invitations"
              count={invitations.length}
            />
            <div className="space-y-3">
              {invitations.map((m) => (
                <InvitationCard
                  key={m.id}
                  meeting={m}
                  onAccept={(id) => acceptMutation.mutate(id)}
                  onDecline={(id) => declineMutation.mutate(id)}
                  isActing={isActing}
                />
              ))}
            </div>
          </div>
        )}

        {/* Confirmed Meetings */}
        {confirmed.length > 0 && (
          <div className="mb-8" data-testid="section-confirmed">
            <SectionHeader
              icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
              label="Confirmed Meetings"
              count={confirmed.length}
            />
            <div className="space-y-3">
              {confirmed.map((m) => (
                <ConfirmedCard key={m.id} meeting={m} onCalendar={handleCalendar} />
              ))}
            </div>
          </div>
        )}

        {/* Pending Requests */}
        {pending.length > 0 && (
          <div className="mb-8" data-testid="section-pending">
            <SectionHeader
              icon={<Hourglass className="h-4 w-4 text-yellow-600" />}
              label="Pending Requests"
              count={pending.length}
            />
            <div className="space-y-3">
              {pending.map((m) => (
                <PendingCard key={m.id} meeting={m} />
              ))}
            </div>
          </div>
        )}

        {/* Past / Dismissed */}
        {past.length > 0 && (
          <div data-testid="section-past">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Cancelled / Declined</p>
            <div className="space-y-2 opacity-60">
              {past.map((m) => {
                const labels: Record<string, string> = { Cancelled: "Cancelled", Declined: "Declined", NoShow: "No Show" };
                return (
                  <div key={m.id} className="bg-card border border-border/40 rounded-xl p-3 flex items-center gap-3" data-testid={`card-meeting-past-${m.id}`}>
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Building2 className="h-3.5 w-3.5 text-muted-foreground" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{m.sponsorName}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(m.date)}</p>
                    </div>
                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border shrink-0">
                      {labels[m.status] ?? m.status}
                    </span>
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
