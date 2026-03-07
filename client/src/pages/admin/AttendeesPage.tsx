import { useState } from "react";
import { Plus, Search, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Attendee, InsertAttendee, Event } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AttendeesTable } from "@/components/admin/AttendeesTable";
import { AttendeeFormModal } from "@/components/admin/AttendeeFormModal";
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

export default function AttendeesPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | undefined>();
  const [viewingAttendee, setViewingAttendee] = useState<Attendee | undefined>();
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: attendees = [], isLoading } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertAttendee) => {
      const res = await apiRequest("POST", "/api/attendees", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      toast({ title: "Attendee added successfully" });
      setIsModalOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add attendee", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertAttendee> }) => {
      const res = await apiRequest("PATCH", `/api/attendees/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      toast({ title: "Attendee updated successfully" });
      setIsModalOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update attendee", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/attendees/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      toast({ title: "Attendee deleted" });
      setDeletingAttendee(null);
    },
  });

  const handleSubmit = (data: InsertAttendee) => {
    if (editingAttendee) {
      updateMutation.mutate({ id: editingAttendee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleArchive = (attendee: Attendee) => {
    updateMutation.mutate({ id: attendee.id, data: { status: "archived" } });
    toast({ title: "Attendee archived", description: `"${attendee.name}" is now archived for this event. They can still schedule in other events.` });
  };

  const handleReactivate = (attendee: Attendee) => {
    updateMutation.mutate({ id: attendee.id, data: { status: "active" } });
    toast({ title: "Attendee re-activated", description: `"${attendee.name}" is now active again.` });
  };

  const match = (a: Attendee) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase());

  const activeAttendees = attendees.filter((a) => (a.status ?? "active") === "active" && match(a));
  const archivedAttendees = attendees.filter((a) => a.status === "archived" && match(a));
  const displayedAttendees = tab === "active" ? activeAttendees : archivedAttendees;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto p-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Attendees</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">View and manage all registered event attendees.</p>
        </div>
        <div className="flex gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => toast({ title: "Coming soon", description: "Bulk CSV import will be available in a future update." })}
            data-testid="button-bulk-import"
          >
            <Upload className="h-4 w-4" /> Bulk Import
          </Button>
          <Button
            className="shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
            onClick={() => { setEditingAttendee(undefined); setIsModalOpen(true); }}
            data-testid="button-add-attendee"
          >
            <Plus className="mr-2 h-4 w-4" /> Add Attendee
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, or email…"
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-attendees"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-none" data-testid="tab-attendees-active">
              Active <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{attendees.filter((a) => (a.status ?? "active") === "active").length}</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 sm:flex-none" data-testid="tab-attendees-archived">
              Archived <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{attendees.filter((a) => a.status === "archived").length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <AttendeesTable
          attendees={displayedAttendees}
          events={events}
          tab={tab}
          isAdmin={isAdmin}
          onEdit={(a) => { setEditingAttendee(a); setIsModalOpen(true); }}
          onView={setViewingAttendee}
          onArchive={handleArchive}
          onReactivate={handleReactivate}
          onDelete={setDeletingAttendee}
        />
      )}

      <AttendeeFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        attendee={editingAttendee}
        events={events}
      />

      {viewingAttendee && (
        <AttendeeFormModal
          isOpen={true}
          onClose={() => setViewingAttendee(undefined)}
          onSubmit={() => {}}
          attendee={viewingAttendee}
          events={events}
          readOnly
        />
      )}

      <AlertDialog open={!!deletingAttendee} onOpenChange={(open) => !open && setDeletingAttendee(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Attendee?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingAttendee?.name}" from {deletingAttendee?.company}. Their meeting history will remain in reports. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingAttendee && deleteMutation.mutate(deletingAttendee.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-attendee"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
