import { useState, useMemo, useEffect, useRef } from "react";
import { Plus, Search, Users as UsersIcon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Attendee, InsertAttendee, Event } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { AttendeesTable } from "@/components/admin/AttendeesTable";
import { AttendeeFormModal } from "@/components/admin/AttendeeFormModal";
import { AttendeeDetailDrawer } from "@/components/admin/AttendeeDetailDrawer";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
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

const CATEGORY_COLORS: Record<string, string> = {
  PRACTITIONER: "#10b981",
  GOVERNMENT_NONPROFIT: "#3b82f6",
  SOLUTION_PROVIDER: "#f59e0b",
  UNCATEGORIZED: "#94a3b8",
};

const CATEGORY_LABELS: Record<string, string> = {
  PRACTITIONER: "Practitioner",
  GOVERNMENT_NONPROFIT: "Gov / Non-Profit",
  SOLUTION_PROVIDER: "Solution Provider",
  UNCATEGORIZED: "Unmapped",
};

export default function AttendeesPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [selectedEventId, setSelectedEventId] = useState("all");
  const hasAutoSelected = useRef(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAttendee, setEditingAttendee] = useState<Attendee | undefined>();
  const [viewingDetailAttendee, setViewingDetailAttendee] = useState<Attendee | null>(null);
  const [deletingAttendee, setDeletingAttendee] = useState<Attendee | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: attendees = [], isLoading } = useQuery<Attendee[]>({ queryKey: ["/api/attendees"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  useEffect(() => {
    if (hasAutoSelected.current || events.length === 0) return;
    hasAutoSelected.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter(e => (e.archiveState ?? "active") === "active" && e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    if (upcoming.length > 0) setSelectedEventId(upcoming[0].id);
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

  const backfillMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/attendees/backfill-categories");
      return res.json();
    },
    onSuccess: (data: { updated: number; skipped: number; unmapped: string[] }) => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      const msg = data.updated > 0
        ? `Updated ${data.updated} attendee(s). ${data.unmapped.length > 0 ? `${data.unmapped.length} unmapped ticket type(s).` : ""}`
        : "No attendees needed backfilling.";
      toast({ title: "Category Backfill Complete", description: msg });
    },
    onError: () => toast({ title: "Error", description: "Failed to backfill categories", variant: "destructive" }),
  });

  const handleSubmit = (data: InsertAttendee) => {
    if (editingAttendee) {
      updateMutation.mutate({ id: editingAttendee.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleArchive = (attendee: Attendee) => {
    updateMutation.mutate({ id: attendee.id, data: { archiveState: "archived", archiveSource: "manual" } });
    toast({ title: "Attendee archived", description: `"${attendee.name}" is now archived for this event. They can still schedule in other events.` });
  };

  const handleReactivate = (attendee: Attendee) => {
    updateMutation.mutate({ id: attendee.id, data: { archiveState: "active", archiveSource: null } });
    toast({ title: "Attendee re-activated", description: `"${attendee.name}" is now active again.` });
  };

  const match = (a: Attendee) =>
    a.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.company.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.email.toLowerCase().includes(searchQuery.toLowerCase());

  const eventFilteredActive = attendees.filter((a) => {
    if ((a.archiveState ?? "active") !== "active") return false;
    if (selectedEventId !== "all" && a.assignedEvent !== selectedEventId) return false;
    return true;
  });

  const activeAttendees = eventFilteredActive.filter(match);
  const archivedAttendees = attendees.filter((a) => a.archiveState === "archived" && match(a));
  const displayedAttendees = tab === "active" ? activeAttendees : archivedAttendees;

  const categoryData = useMemo(() => {
    const counts: Record<string, number> = {
      PRACTITIONER: 0,
      GOVERNMENT_NONPROFIT: 0,
      SOLUTION_PROVIDER: 0,
      UNCATEGORIZED: 0,
    };
    eventFilteredActive.forEach((a) => {
      const cat = a.attendeeCategory;
      if (cat && counts[cat] !== undefined) {
        counts[cat]++;
      } else {
        counts.UNCATEGORIZED++;
      }
    });
    return Object.entries(counts)
      .filter(([_, count]) => count > 0)
      .map(([key, count]) => ({
        name: CATEGORY_LABELS[key] || key,
        value: count,
        color: CATEGORY_COLORS[key] || "#94a3b8",
        key,
      }));
  }, [eventFilteredActive]);

  const totalForChart = categoryData.reduce((sum, d) => sum + d.value, 0);

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
            size="sm"
            onClick={() => backfillMutation.mutate()}
            disabled={backfillMutation.isPending}
            data-testid="button-backfill-categories"
          >
            <RefreshCw className={cn("mr-2 h-4 w-4", backfillMutation.isPending && "animate-spin")} />
            {backfillMutation.isPending ? "Backfilling..." : "Backfill Categories"}
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

      {sortedEventsForSelector.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {sortedEventsForSelector.map((event) => {
              const isActive = selectedEventId === event.id;
              return (
                <button
                  key={event.id}
                  data-testid={`event-tab-${event.id}`}
                  onClick={() => setSelectedEventId(event.id)}
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
              onClick={() => setSelectedEventId("all")}
              className={cn(
                "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                selectedEventId === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              style={selectedEventId === "all" ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
            >
              All Events
            </button>
          </div>
        </div>
      )}

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
              Active <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{eventFilteredActive.length}</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 sm:flex-none" data-testid="tab-attendees-archived">
              Archived <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{attendees.filter((a) => a.archiveState === "archived").length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tab === "active" && totalForChart > 0 && (
        <div className="bg-card rounded-xl border border-border/50 shadow-sm p-5" data-testid="attendee-category-chart">
          <div className="flex items-center gap-2 mb-4">
            <UsersIcon className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Attendee Category Breakdown</h2>
            <span className="text-xs text-muted-foreground ml-auto">
              {selectedEventId === "all" ? "All Events" : events.find(e => e.id === selectedEventId)?.slug ?? ""}
              {" · "}{totalForChart} total
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 flex-1 w-full">
              {categoryData.map((d) => (
                <div key={d.key} className="flex flex-col items-center p-3 rounded-lg bg-muted/30 border border-border/40" data-testid={`stat-category-${d.key}`}>
                  <div className="w-2.5 h-2.5 rounded-full mb-1.5" style={{ backgroundColor: d.color }} />
                  <span className="text-lg font-bold text-foreground">{d.value}</span>
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">{d.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {totalForChart > 0 ? Math.round((d.value / totalForChart) * 100) : 0}%
                  </span>
                </div>
              ))}
            </div>
            <div className="w-48 h-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    innerRadius={40}
                    outerRadius={70}
                    paddingAngle={2}
                    dataKey="value"
                    nameKey="name"
                  >
                    {categoryData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} stroke="transparent" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string) => [`${value} (${totalForChart > 0 ? Math.round((value / totalForChart) * 100) : 0}%)`, name]}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

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
          onView={setViewingDetailAttendee}
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

      <AttendeeDetailDrawer
        attendeeId={viewingDetailAttendee?.id || null}
        open={!!viewingDetailAttendee}
        onClose={() => setViewingDetailAttendee(null)}
      />

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
