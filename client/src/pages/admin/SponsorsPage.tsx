import { useState } from "react";
import { Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sponsor, InsertSponsor, Event } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SponsorsTable } from "@/components/admin/SponsorsTable";
import { SponsorFormModal } from "@/components/admin/SponsorFormModal";
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

export default function SponsorsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | undefined>();
  const [viewingSponsor, setViewingSponsor] = useState<Sponsor | undefined>();
  const [deletingSponsor, setDeletingSponsor] = useState<Sponsor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const { data: sponsors = [], isLoading } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const createMutation = useMutation({
    mutationFn: async (data: InsertSponsor) => {
      const res = await apiRequest("POST", "/api/sponsors", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      toast({ title: "Sponsor added successfully" });
      setIsModalOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to add sponsor", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertSponsor> }) => {
      const res = await apiRequest("PATCH", `/api/sponsors/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      toast({ title: "Sponsor updated successfully" });
      setIsModalOpen(false);
    },
    onError: () => toast({ title: "Error", description: "Failed to update sponsor", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/sponsors/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      toast({ title: "Sponsor deleted" });
      setDeletingSponsor(null);
    },
  });

  const handleSubmit = (data: InsertSponsor) => {
    if (editingSponsor) {
      updateMutation.mutate({ id: editingSponsor.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleArchive = (sponsor: Sponsor) => {
    updateMutation.mutate({ id: sponsor.id, data: { archiveState: "archived", archiveSource: "manual" } });
    toast({ title: "Sponsor archived", description: `"${sponsor.name}" is now archived and read-only.` });
  };

  const handleReactivate = (sponsor: Sponsor) => {
    updateMutation.mutate({ id: sponsor.id, data: { archiveState: "active", archiveSource: null } });
    toast({ title: "Sponsor re-activated", description: `"${sponsor.name}" is now active.` });
  };

  const match = (s: Sponsor) => s.name.toLowerCase().includes(searchQuery.toLowerCase());

  const activeSponsors = sponsors.filter((s) => (s.archiveState ?? "active") === "active" && match(s));
  const archivedSponsors = sponsors.filter((s) => s.archiveState === "archived" && match(s));
  const displayedSponsors = tab === "active" ? activeSponsors : archivedSponsors;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-7xl mx-auto p-6"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Sponsors</h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">Manage your event sponsors and partnership tiers.</p>
        </div>
        <Button
          className="w-full sm:w-auto shadow-md shadow-accent/20 bg-accent text-accent-foreground hover:bg-accent/90"
          onClick={() => { setEditingSponsor(undefined); setIsModalOpen(true); }}
          data-testid="button-add-sponsor"
        >
          <Plus className="mr-2 h-4 w-4" /> Add Sponsor
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 bg-card p-4 rounded-xl shadow-sm border border-border/50">
        <div className="relative w-full flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sponsors…"
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-sponsors"
          />
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "active" | "archived")} className="w-full sm:w-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="active" className="flex-1 sm:flex-none" data-testid="tab-sponsors-active">
              Active <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sponsors.filter((s) => (s.archiveState ?? "active") === "active").length}</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex-1 sm:flex-none" data-testid="tab-sponsors-archived">
              Archived <span className="ml-1.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">{sponsors.filter((s) => s.archiveState === "archived").length}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="h-64 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
        </div>
      ) : (
        <SponsorsTable
          sponsors={displayedSponsors}
          events={events}
          tab={tab}
          isAdmin={isAdmin}
          onEdit={(s) => { setEditingSponsor(s); setIsModalOpen(true); }}
          onView={(s) => setViewingSponsor(s)}
          onArchive={handleArchive}
          onReactivate={handleReactivate}
          onDelete={setDeletingSponsor}
        />
      )}

      {/* Edit / Create modal */}
      <SponsorFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        sponsor={editingSponsor}
        events={events}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

      {/* View (read-only) modal */}
      <SponsorFormModal
        isOpen={!!viewingSponsor}
        onClose={() => setViewingSponsor(undefined)}
        onSubmit={() => {}}
        sponsor={viewingSponsor}
        events={events}
        readOnly
      />

      <AlertDialog open={!!deletingSponsor} onOpenChange={(open) => !open && setDeletingSponsor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sponsor?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete "{deletingSponsor?.name}". This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSponsor && deleteMutation.mutate(deletingSponsor.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-sponsor"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
