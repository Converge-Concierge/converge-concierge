import { useState, useMemo, useEffect, useRef } from "react";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Meeting, Event, Sponsor, Attendee } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { MeetingsTable } from "@/components/admin/MeetingsTable";
import { MeetingFormModal, MeetingFormPayload } from "@/components/admin/MeetingFormModal";
import { MeetingFilters, MeetingFilterState } from "@/components/admin/MeetingFilters";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function MeetingsPage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<Meeting | undefined>();
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);
  const [filters, setFilters] = useState<MeetingFilterState>({
    eventId: "", sponsorId: "", attendeeId: "", dateFrom: "", dateTo: "", meetingType: "",
  });
  const hasAutoSelected = useRef(false);
  const { toast } = useToast();

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({ queryKey: ["/api/meetings"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: attendees = [] } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });

  useEffect(() => {
    if (hasAutoSelected.current || events.length === 0) return;
    hasAutoSelected.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter(e => (e.archiveState ?? "active") === "active" && e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    if (upcoming.length > 0) setFilters(f => ({ ...f, eventId: upcoming[0].id }));
  }, [events]);

  const sortedEventsForSelector = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active.filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active.filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  const createMutation = useMutation({
    mutationFn: async (data: MeetingFormPayload) => {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (res.status === 409) return { conflict: true, message: body.message };
      if (!res.ok) throw new Error(body.message || "Failed to schedule meeting");
      return { conflict: false };
    },
    onSuccess: (result) => {
      if (!result.conflict) {
        queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
        toast({ title: "Success", description: "Meeting scheduled successfully" });
        setIsModalOpen(false);
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to schedule meeting", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<MeetingFormPayload> }) => {
      const res = await fetch(`/api/meetings/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      const body = await res.json();
      if (res.status === 409) return { conflict: true, message: body.message };
      if (!res.ok) throw new Error(body.message || "Failed to update meeting");
      return { conflict: false };
    },
    onSuccess: (result) => {
      if (!result.conflict) {
        queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
        toast({ title: "Success", description: "Meeting updated successfully" });
        setIsModalOpen(false);
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to update meeting", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/meetings/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      toast({ title: "Success", description: "Meeting deleted" });
      setDeletingMeeting(null);
    },
  });

  const handleSubmit = async (data: MeetingFormPayload): Promise<{ conflict?: boolean; message?: string } | void> => {
    if (editingMeeting) {
      const result = await updateMutation.mutateAsync({ id: editingMeeting.id, data });
      return result;
    } else {
      const result = await createMutation.mutateAsync(data);
      return result;
    }
  };

  const operationalMeetings = meetings.filter((m) => (m.archiveState ?? "active") !== "archived");

  const filtered = operationalMeetings.filter((m) => {
    if (filters.eventId && m.eventId !== filters.eventId) return false;
    if (filters.sponsorId && m.sponsorId !== filters.sponsorId) return false;
    if (filters.attendeeId && m.attendeeId !== filters.attendeeId) return false;
    if (filters.dateFrom && m.date < filters.dateFrom) return false;
    if (filters.dateTo && m.date > filters.dateTo) return false;
    if (filters.meetingType && (m.meetingType ?? "onsite") !== filters.meetingType) return false;
    return true;
  });

  const getSponsorName = (id: string) => sponsors.find((s) => s.id === id)?.name ?? "—";
  const getAttendeeName = (id: string) => attendees.find((a) => a.id === id)?.name ?? "—";
  const getEventCode = (id: string) => events.find((e) => e.id === id)?.slug ?? "—";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto p-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Meetings</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Schedule and manage 1-on-1 sponsor meetings.</p>
        </div>
        <Button
          className="w-full sm:w-auto shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => { setEditingMeeting(undefined); setIsModalOpen(true); }}
          data-testid="button-schedule-meeting"
        >
          <Plus className="mr-2 h-4 w-4" /> Schedule Meeting
        </Button>
      </div>

      {/* Event tabs */}
      {sortedEventsForSelector.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {sortedEventsForSelector.map((event) => {
              const isActive = filters.eventId === event.id;
              return (
                <button
                  key={event.id}
                  data-testid={`event-tab-${event.id}`}
                  onClick={() => setFilters(f => ({ ...f, eventId: event.id }))}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  style={isActive ? { backgroundColor: event.accentColor ?? "#0D9488", color: "#ffffff" } : undefined}
                >
                  {event.slug ?? event.name}
                </button>
              );
            })}
            <button
              data-testid="event-tab-all"
              onClick={() => setFilters(f => ({ ...f, eventId: "" }))}
              className={cn(
                "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                !filters.eventId ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              style={!filters.eventId ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
            >
              All Events
            </button>
          </div>
        </div>
      )}

      <MeetingFilters
        filters={filters}
        onChange={setFilters}
        events={events}
        sponsors={sponsors}
        attendees={attendees}
      />

      <div className="flex items-center justify-between text-sm text-muted-foreground px-1">
        <span>
          Showing <strong>{filtered.length}</strong> of <strong>{operationalMeetings.length}</strong> meetings
        </span>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <MeetingsTable
          meetings={filtered}
          events={events}
          sponsors={sponsors}
          attendees={attendees}
          onEdit={(m) => { setEditingMeeting(m); setIsModalOpen(true); }}
          onDelete={setDeletingMeeting}
        />
      )}

      <MeetingFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        meeting={editingMeeting}
        events={events}
        sponsors={sponsors}
        attendees={attendees}
      />

      <AlertDialog open={!!deletingMeeting} onOpenChange={(open) => !open && setDeletingMeeting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the meeting between{" "}
              <strong>{deletingMeeting ? getSponsorName(deletingMeeting.sponsorId) : ""}</strong> and{" "}
              <strong>{deletingMeeting ? getAttendeeName(deletingMeeting.attendeeId) : ""}</strong>{" "}
              at event <strong>{deletingMeeting ? getEventCode(deletingMeeting.eventId) : ""}</strong>.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingMeeting && deleteMutation.mutate(deletingMeeting.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-meeting"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
