import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { Event, Sponsor, Attendee } from "@shared/schema";

export interface MeetingFilterState {
  eventId: string;
  sponsorId: string;
  attendeeId: string;
  dateFrom: string;
  dateTo: string;
  meetingType: string;
}

interface MeetingFiltersProps {
  filters: MeetingFilterState;
  onChange: (filters: MeetingFilterState) => void;
  events: Event[];
  sponsors: Sponsor[];
  attendees: Attendee[];
}

const selectClass = "h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-w-[150px]";

export function MeetingFilters({ filters, onChange, events, sponsors, attendees }: MeetingFiltersProps) {
  const update = (patch: Partial<MeetingFilterState>) => onChange({ ...filters, ...patch });

  const hasFilters = filters.eventId || filters.sponsorId || filters.attendeeId || filters.dateFrom || filters.dateTo || filters.meetingType;

  const clear = () => onChange({ eventId: "", sponsorId: "", attendeeId: "", dateFrom: "", dateTo: "", meetingType: "" });

  const filteredSponsors = filters.eventId
    ? sponsors.filter((s) => (s.assignedEvents || []).some((ae) => ae.eventId === filters.eventId))
    : sponsors;

  const filteredAttendees = filters.eventId
    ? attendees.filter((a) => a.assignedEvent === filters.eventId)
    : attendees;

  return (
    <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-xl shadow-sm border border-border/50">
      <select
        className={selectClass}
        value={filters.eventId}
        onChange={(e) => update({ eventId: e.target.value, sponsorId: "", attendeeId: "" })}
        data-testid="filter-event"
      >
        <option value="">All Events</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>[{ev.slug}] {ev.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.sponsorId}
        onChange={(e) => update({ sponsorId: e.target.value })}
        data-testid="filter-sponsor"
      >
        <option value="">All Sponsors</option>
        {filteredSponsors.map((s) => (
          <option key={s.id} value={s.id}>{s.name}</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.attendeeId}
        onChange={(e) => update({ attendeeId: e.target.value })}
        data-testid="filter-attendee"
      >
        <option value="">All Attendees</option>
        {filteredAttendees.map((a) => (
          <option key={a.id} value={a.id}>{a.name} ({a.company})</option>
        ))}
      </select>

      <select
        className={selectClass}
        value={filters.meetingType}
        onChange={(e) => update({ meetingType: e.target.value })}
        data-testid="filter-meeting-type"
      >
        <option value="">All Types</option>
        <option value="onsite">Onsite</option>
        <option value="online_request">Online Meeting</option>
      </select>

      <div className="flex items-center gap-2">
        <Input
          type="date"
          className="h-9 text-sm w-36"
          value={filters.dateFrom}
          onChange={(e) => update({ dateFrom: e.target.value })}
          data-testid="filter-date-from"
          placeholder="From"
        />
        <span className="text-muted-foreground text-sm">–</span>
        <Input
          type="date"
          className="h-9 text-sm w-36"
          value={filters.dateTo}
          onChange={(e) => update({ dateTo: e.target.value })}
          data-testid="filter-date-to"
          placeholder="To"
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clear} className="text-muted-foreground hover:text-foreground" data-testid="button-clear-filters">
          <X className="h-3.5 w-3.5 mr-1" /> Clear
        </Button>
      )}
    </div>
  );
}
