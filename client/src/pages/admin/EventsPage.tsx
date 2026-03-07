import { useState } from "react";
  import { Plus, Search, Filter } from "lucide-react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { motion } from "framer-motion";
  import { useQuery, useMutation } from "@tanstack/react-query";
  import { Event, InsertEvent } from "@shared/schema";
  import { queryClient, apiRequest } from "@/lib/queryClient";
  import { EventTable } from "@/components/admin/EventTable";
  import { EventFormModal } from "@/components/admin/EventFormModal";
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

  export default function EventsPage() {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEvent, setEditingEvent] = useState<Event | undefined>();
    const [deletingEvent, setDeletingEvent] = useState<Event | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const { toast } = useToast();

    const { data: events = [], isLoading } = useQuery<Event[]>({
      queryKey: ["/api/events"],
    });

    const createMutation = useMutation({
      mutationFn: async (data: InsertEvent) => {
        const res = await apiRequest("POST", "/api/events", data);
        return res.json();
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        toast({ title: "Success", description: "Event created successfully" });
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
        toast({ title: "Success", description: "Event updated successfully" });
        setIsModalOpen(false);
      },
    });

    const deleteMutation = useMutation({
      mutationFn: async (id: string) => {
        await apiRequest("DELETE", `/api/events/${id}`);
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/events"] });
        toast({ title: "Success", description: "Event deleted successfully" });
        setDeletingEvent(null);
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
      updateMutation.mutate({ id: event.id, data: { status: "archived" } });
    };

    const filteredEvents = events.filter(e => 
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.location.toLowerCase().includes(searchQuery.toLowerCase())
    );

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
          <div className="flex w-full sm:w-auto items-center gap-3">
            <Button 
              className="w-full sm:w-auto shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90" 
              onClick={() => {
                setEditingEvent(undefined);
                setIsModalOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add New Event
            </Button>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
          <div className="relative w-full flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search events..." 
              className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button variant="outline" className="w-full sm:w-auto shadow-sm">
            <Filter className="mr-2 h-4 w-4" /> Filters
          </Button>
        </div>

        {isLoading ? (
          <div className="h-64 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
          </div>
        ) : (
          <EventTable 
            events={filteredEvents}
            onEdit={(e) => {
              setEditingEvent(e);
              setIsModalOpen(true);
            }}
            onArchive={handleArchive}
            onDelete={setDeletingEvent}
          />
        )}

        <EventFormModal 
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateOrUpdate}
          event={editingEvent}
        />

        <AlertDialog open={!!deletingEvent} onOpenChange={(open) => !open && setDeletingEvent(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. This will permanently delete the event
                "{deletingEvent?.name}" and all associated data.
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
      </motion.div>
    );
  }