import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Event, InsertEvent } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { EventTable } from "@/components/admin/EventTable";
import { EventFormModal } from "@/components/admin/EventFormModal";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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

export default function EventsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | undefined>();
  const [viewingEvent, setViewingEvent] = useState<Event | undefined>();
  const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
  const [copyingEvent, setCopyingEvent] = useState<Event | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: events = [], isLoading } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: meetings = [] } = useQuery<any[]>({ queryKey: ["/api/meetings"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertEvent) => {
      const res = await apiRequest("POST", "/api/events", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event created successfully" });
      setIsModalOpen(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertEvent> }) => {
      const res = await apiRequest("PATCH", `/api/events/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/meetings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      toast({ title: "Event updated successfully" });
      setIsModalOpen(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/events/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({ title: "Event deleted" });
      setDeletingEvent(null);
    },
  });

  const copyMutation = useMutation({
    mutationFn: async ({ id, copySponsors }: { id: string; copySponsors: boolean }) => {
      const res = await apiRequest("POST", `/api/events/${id}/copy`, { copySponsors });
      return res.json() as Promise<Event>;
    },
    onSuccess: (newEvent) => {
      queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      toast({ title: "Event copied", description: `"${newEvent.name}" created. Update the details below.` });
      setCopyingEvent(null);
      setEditingEvent(newEvent);
      setIsModalOpen(true);
    },
    onError: () => {
      toast({ title: "Copy failed", description: "Could not copy event. Please try again.", variant: "destructive" });
      setCopyingEvent(null);
    },
  });

  const handleCreateOrUpdate = (data: InsertEvent) => {
    if (editingEvent) {
      updateMutation.mutate({ id: editingEvent.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleArchive = (event: Event) => {
    updateMutation.mutate({ id: event.id, data: { archiveState: "archived", archiveSource: "manual" } });
    toast({ title: "Event archived", description: `"${event.name}" is now archived and read-only.` });
  };

  const handleReactivate = (event: Event) => {
    updateMutation.mutate({ id: event.id, data: { archiveState: "active", archiveSource: null } });
    toast({ title: "Event re-activated", description: `"${event.name}" is now active.` });
  };

  const hasMeetings = deletingEvent ? meetings.some((m) => m.eventId === deletingEvent.id) : false;

  const activeEvents = events
    .filter((e) => (e.archiveState ?? "active") === "active" && (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.location.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const archivedEvents = events
    .filter((e) => e.archiveState === "archived" && (e.name.toLowerCase().includes(searchQuery.toLowerCase()) || e.location.toLowerCase().includes(searchQuery.toLowerCase())))
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

  const displayedEvents = tab === "active" ? activeEvents : archivedEvents;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto p-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Events</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your fintech summit configurations and schedules.</p>
        </div>
        <Button
          className="w-full sm:w-auto shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => { setEditingEvent(undefined); setIsModalOpen(true); }}
        >
          <Plus className="mr-2 h-4 w-4" /> Add New Event
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search events…"
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-none" data-testid="tab-events-active">
              Active <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{events.filter((e) => (e.archiveState ?? "active") === "active").length}</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 sm:flex-none" data-testid="tab-events-archived">
              Archived <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{events.filter((e) => e.archiveState === "archived").length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <EventTable
          events={displayedEvents}
          tab={tab}
          isAdmin={isAdmin}
          onEdit={(e) => { setEditingEvent(e); setIsModalOpen(true); }}
          onView={(e) => setViewingEvent(e)}
          onArchive={handleArchive}
          onReactivate={handleReactivate}
          onDelete={setDeletingEvent}
          onCopy={(e) => setCopyingEvent(e)}
        />
      )}

      {/* Edit / Create modal */}
      <EventFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleCreateOrUpdate}
        event={editingEvent}
      />

      {/* View (read-only) modal */}
      <EventFormModal
        isOpen={!!viewingEvent}
        onClose={() => setViewingEvent(undefined)}
        onSubmit={() => {}}
        event={viewingEvent}
        readOnly
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              {hasMeetings && (
                <span className="block text-destructive font-bold mb-2">
                  WARNING: This event has scheduled meetings. Deleting it will remove all associated meeting records.
                </span>
              )}
              This action cannot be undone. This will permanently delete "{deletingEvent?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingEvent && deleteMutation.mutate(deletingEvent.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Copy event confirmation */}
      <AlertDialog open={!!copyingEvent} onOpenChange={(open) => !open && setCopyingEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Copy "{copyingEvent?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new event with the same name, location, branding, meeting locations, time blocks, and scheduling settings.
              Meetings and attendee bookings will not be copied.
              <br /><br />
              Would you like to also copy the sponsor assignments to the new event?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={copyMutation.isPending}>Cancel</AlertDialogCancel>
            <Button
              variant="outline"
              disabled={copyMutation.isPending}
              onClick={() => copyingEvent && copyMutation.mutate({ id: copyingEvent.id, copySponsors: false })}
              data-testid="btn-copy-without-sponsors"
            >
              Copy without sponsors
            </Button>
            <Button
              disabled={copyMutation.isPending}
              onClick={() => copyingEvent && copyMutation.mutate({ id: copyingEvent.id, copySponsors: true })}
              data-testid="btn-copy-with-sponsors"
            >
              {copyMutation.isPending ? "Copying…" : "Copy with sponsors"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
