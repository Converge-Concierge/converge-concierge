import { useState } from "react";
import { Plus, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useSearch, useLocation } from "wouter";
import { Sponsor, InsertSponsor, Event } from "@shared/schema";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { SponsorsTable } from "@/components/admin/SponsorsTable";
import { SponsorFormModal } from "@/components/admin/SponsorFormModal";
import { SponsorUsersModal } from "@/components/admin/SponsorUsersModal";
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

interface Meeting { sponsorId: string; }

export default function SponsorsPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState<"active" | "archived">("active");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | undefined>();
  const [viewingSponsor, setViewingSponsor] = useState<Sponsor | undefined>();
  const [deletingSponsor, setDeletingSponsor] = useState<Sponsor | null>(null);
  const [usersModalSponsor, setUsersModalSponsor] = useState<Sponsor | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [copyingId, setCopyingId] = useState<string | null>(null);
  const { toast } = useToast();
  const search = useSearch();
  const [, nav] = useLocation();

  const searchParams = new URLSearchParams(search);
  const attentionFilter = searchParams.get("attention");
  const isNoMeetingsFilter = attentionFilter === "no-meetings";

  const { data: sponsors = [], isLoading } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: meetings = [] } = useQuery<Meeting[]>({
    queryKey: ["/api/meetings"],
    enabled: isNoMeetingsFilter,
  });

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

  const copyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/sponsors/${id}/copy`);
      return res.json() as Promise<Sponsor>;
    },
    onSuccess: (newSponsor) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sponsors"] });
      setCopyingId(null);
      toast({ title: "Sponsor copied", description: `"${newSponsor.name}" created — now open in edit mode.` });
      setEditingSponsor(newSponsor);
      setIsModalOpen(true);
    },
    onError: () => {
      setCopyingId(null);
      toast({ title: "Error", description: "Failed to copy sponsor", variant: "destructive" });
    },
  });

  const handleCopy = (sponsor: Sponsor) => {
    setCopyingId(sponsor.id);
    copyMutation.mutate(sponsor.id);
  };

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

  const clearAttentionFilter = () => {
    nav("/admin/sponsors");
  };

  const match = (s: Sponsor) => s.name.toLowerCase().includes(searchQuery.toLowerCase());

  const sponsorsWithMeetings = new Set(meetings.map((m) => m.sponsorId));

  const activeSponsors = sponsors.filter((s) => {
    if ((s.archiveState ?? "active") !== "active") return false;
    if (!match(s)) return false;
    if (isNoMeetingsFilter && sponsorsWithMeetings.has(s.id)) return false;
    return true;
  });
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

      {isNoMeetingsFilter && (
        <div className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800" data-testid="filter-no-meetings-banner">
          <span className="font-medium">Filtered:</span>
          <span className="inline-flex items-center gap-1.5 bg-amber-100 border border-amber-300 text-amber-800 text-xs font-semibold px-2.5 py-0.5 rounded-full" data-testid="chip-no-meetings">
            No Meetings
          </span>
          <span className="text-amber-700">— showing sponsors with no meetings scheduled across any event</span>
          <button
            onClick={clearAttentionFilter}
            className="ml-auto flex items-center gap-1 text-xs text-amber-600 hover:text-amber-900 hover:underline"
            data-testid="btn-clear-attention-filter"
          >
            <X className="h-3.5 w-3.5" /> Clear filter
          </button>
        </div>
      )}

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
          onCopy={handleCopy}
          onManageUsers={(sponsor) => setUsersModalSponsor(sponsor)}
          copyingId={copyingId}
        />
      )}

      <SponsorUsersModal
        sponsor={usersModalSponsor}
        open={!!usersModalSponsor}
        onClose={() => setUsersModalSponsor(null)}
      />

      <SponsorFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleSubmit}
        sponsor={editingSponsor}
        events={events}
        isPending={createMutation.isPending || updateMutation.isPending}
      />

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
