import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { Link, useLocation } from "wouter";
import { format } from "date-fns";
import {
  Package, Plus, RefreshCw, Eye, Archive, Copy, ChevronRight,
  CheckCircle2, Search, Gem,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { PackageTemplate } from "@shared/schema";

type TemplateWithCount = PackageTemplate & { deliverableCount: number };
type Event = { id: string; name: string; slug: string; accentColor?: string | null };

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700 border-slate-300",
  Gold:     "bg-amber-50 text-amber-700 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-50 text-orange-700 border-orange-300",
};

function templateMatchesEvent(t: TemplateWithCount, event: Event): boolean {
  if (t.eventId && t.eventId === event.id) return true;
  if (t.eventFamily && event.slug.toLowerCase().includes(t.eventFamily.toLowerCase())) return true;
  return false;
}

export default function SponsorshipTemplatesPage() {
  const [, nav] = useLocation();
  const { toast } = useToast();

  const [selectedEventId, setSelectedEventId] = useState("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState<TemplateWithCount | null>(null);
  const [searchTemplates, setSearchTemplates] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [newTemplateName, setNewTemplateName] = useState("");
  const [newTemplateLevel, setNewTemplateLevel] = useState("Platinum");
  const [newTemplateYear, setNewTemplateYear] = useState("2026");
  const [newTemplateFamily, setNewTemplateFamily] = useState("FRC");
  const [dupName, setDupName] = useState("");
  const [dupFamily, setDupFamily] = useState("");
  const [dupYear, setDupYear] = useState("");
  const [dupLevel, setDupLevel] = useState("");

  const { data: templates = [], isLoading: tplLoading } = useQuery<TemplateWithCount[]>({
    queryKey: ["/api/agreement/package-templates"],
  });

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const createTemplate = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/agreement/package-templates", data),
    onSuccess: async (res) => {
      const tpl = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: "Sponsorship template created" });
      setShowCreateDialog(false);
      setNewTemplateName("");
      nav(`/admin/agreement/package-templates/${tpl.id}`);
    },
    onError: () => toast({ title: "Failed to create template", variant: "destructive" }),
  });

  const archiveTemplate = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/agreement/package-templates/${id}/archive`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: "Template archived" });
    },
    onError: () => toast({ title: "Failed to archive", variant: "destructive" }),
  });

  const duplicateTemplate = useMutation({
    mutationFn: ({ id, newName, eventFamily, year, sponsorshipLevel }: { id: string; newName: string; eventFamily?: string; year?: string; sponsorshipLevel?: string }) =>
      apiRequest("POST", `/api/agreement/package-templates/${id}/duplicate`, { newName, eventFamily, year, sponsorshipLevel }),
    onSuccess: async (res) => {
      const tpl = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: "Template duplicated" });
      setShowDuplicateDialog(null);
      nav(`/admin/agreement/package-templates/${tpl.id}`);
    },
    onError: () => toast({ title: "Failed to duplicate", variant: "destructive" }),
  });

  const seedTemplates = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agreement/seed-templates", {}),
    onSuccess: async (res) => {
      const data = await res.json();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/package-templates"] });
      toast({ title: data.message });
    },
    onError: () => toast({ title: "Seed failed", variant: "destructive" }),
  });

  // Filter by selected event
  const eventFiltered = selectedEventId === "all"
    ? templates
    : templates.filter((t) => {
        const ev = events.find((e) => e.id === selectedEventId);
        return ev ? templateMatchesEvent(t, ev) : false;
      });

  const filteredTemplates = eventFiltered.filter((t) => {
    if (searchTemplates && !t.packageName.toLowerCase().includes(searchTemplates.toLowerCase())) return false;
    if (filterLevel !== "all" && t.sponsorshipLevel !== filterLevel) return false;
    return true;
  });

  const activeTemplates = filteredTemplates.filter((t) => !t.isArchived);
  const archivedTemplates = filteredTemplates.filter((t) => t.isArchived);

  // Show all active events as tabs
  const activeEvents = events;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <Package className="h-6 w-6 text-accent" />
            Sponsorship Templates
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage sponsorship package templates by level and event.
          </p>
        </div>
        <div className="flex gap-2">
          {templates.length === 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => seedTemplates.mutate()}
              disabled={seedTemplates.isPending}
              data-testid="button-seed-templates"
            >
              {seedTemplates.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Seed FRC 2026 Templates
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            data-testid="button-create-template"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Create Sponsorship Template
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Active Templates", value: templates.filter((t) => !t.isArchived).length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Platinum", value: templates.filter((t) => !t.isArchived && t.sponsorshipLevel === "Platinum").length, color: "text-slate-700", bg: "bg-slate-100" },
          { label: "Gold", value: templates.filter((t) => !t.isArchived && t.sponsorshipLevel === "Gold").length, color: "text-amber-700", bg: "bg-amber-50" },
          { label: "Archived", value: templates.filter((t) => t.isArchived).length, color: "text-muted-foreground", bg: "bg-muted" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
              <Package className={cn("h-4 w-4", color)} />
            </div>
            <div>
              <p className="text-xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Event tabs */}
      {activeEvents.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {activeEvents.map((event) => {
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

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            className="pl-9"
            value={searchTemplates}
            onChange={(e) => setSearchTemplates(e.target.value)}
            data-testid="input-search-templates"
          />
        </div>
        <Select value={filterLevel} onValueChange={setFilterLevel}>
          <SelectTrigger className="w-44" data-testid="select-filter-level">
            <SelectValue placeholder="All Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {["Platinum", "Gold", "Silver", "Bronze"].map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Templates Table */}
      {tplLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...
        </div>
      ) : activeTemplates.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
          <Package className="h-12 w-12 opacity-20" />
          <p className="text-sm font-medium">
            {selectedEventId === "all" ? "No sponsorship templates yet" : "No templates for this event"}
          </p>
          {selectedEventId === "all" && (
            <>
              <p className="text-xs text-center max-w-xs">
                Create your first template or seed the standard FRC 2026 package templates to get started.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => seedTemplates.mutate()} disabled={seedTemplates.isPending}>
                  {seedTemplates.isPending ? <RefreshCw className="h-3 w-3 animate-spin mr-1" /> : null}
                  Seed FRC 2026 Templates
                </Button>
                <Button size="sm" onClick={() => setShowCreateDialog(true)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Create Template
                </Button>
              </div>
            </>
          )}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                {["Template Name", "Sponsorship Level", "Event / Year", "Deliverables", "Status", "Last Updated", "Actions"].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeTemplates.map((t) => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-template-${t.id}`}>
                  <td className="px-4 py-3 font-medium text-foreground">
                    <Link href={`/admin/agreement/package-templates/${t.id}`} className="hover:text-accent transition-colors flex items-center gap-1.5">
                      {t.packageName}
                      <ChevronRight className="h-3.5 w-3.5 opacity-50" />
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn("gap-1", LEVEL_COLORS[t.sponsorshipLevel] ?? "bg-muted text-muted-foreground")}>
                      {t.sponsorshipLevel === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                      {t.sponsorshipLevel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-sm">
                    {[t.eventFamily, t.year].filter(Boolean).join(" ") || t.eventId || "—"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center h-6 w-8 rounded-full bg-accent/10 text-accent text-xs font-bold">
                      {t.deliverableCount}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", t.isActive ? "bg-green-50 text-green-700" : "bg-muted text-muted-foreground")}>
                      {t.isActive ? <><CheckCircle2 className="h-2.5 w-2.5" /> Active</> : "Inactive"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {format(new Date(t.updatedAt), "MMM d, yyyy")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                        onClick={() => nav(`/admin/agreement/package-templates/${t.id}`)}
                        data-testid={`button-open-${t.id}`}
                      >
                        <Eye className="h-3 w-3" /> Open
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1"
                        onClick={() => { setDupName(`${t.packageName} (Copy)`); setDupFamily(t.eventFamily ?? ""); setDupYear(t.year ?? ""); setDupLevel(t.sponsorshipLevel); setShowDuplicateDialog(t); }}
                        data-testid={`button-duplicate-${t.id}`}
                      >
                        <Copy className="h-3 w-3" /> Duplicate
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-destructive hover:text-destructive"
                        onClick={() => archiveTemplate.mutate(t.id)}
                        disabled={archiveTemplate.isPending}
                        data-testid={`button-archive-${t.id}`}
                      >
                        <Archive className="h-3 w-3" /> Archive
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Archived Templates */}
      {archivedTemplates.length > 0 && (
        <details className="bg-muted/30 border border-border rounded-xl overflow-hidden">
          <summary className="px-4 py-3 text-sm font-medium text-muted-foreground cursor-pointer hover:text-foreground">
            Archived Templates ({archivedTemplates.length})
          </summary>
          <div className="px-4 pb-3 space-y-1">
            {archivedTemplates.map((t) => (
              <div key={t.id} className="flex items-center justify-between py-1.5 text-sm text-muted-foreground">
                <span>{t.packageName}</span>
                <span className="text-xs">{t.sponsorshipLevel} · {[t.eventFamily, t.year].filter(Boolean).join(" ") || "—"}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Create Template Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Sponsorship Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="tpl-name">Template Name</Label>
              <Input
                id="tpl-name"
                placeholder="e.g. FRC 2026 Platinum"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                data-testid="input-template-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sponsorship Level</Label>
                <Select value={newTemplateLevel} onValueChange={setNewTemplateLevel}>
                  <SelectTrigger data-testid="select-template-level">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["Platinum", "Gold", "Silver", "Bronze"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="tpl-year">Year</Label>
                <Input
                  id="tpl-year"
                  placeholder="2026"
                  value={newTemplateYear}
                  onChange={(e) => setNewTemplateYear(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="tpl-family">Event Family</Label>
              <Input
                id="tpl-family"
                placeholder="e.g. FRC, USBT, TLS"
                value={newTemplateFamily}
                onChange={(e) => setNewTemplateFamily(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => createTemplate.mutate({
                packageName: newTemplateName,
                sponsorshipLevel: newTemplateLevel,
                year: newTemplateYear,
                eventFamily: newTemplateFamily,
                isActive: true,
                isArchived: false,
              })}
              disabled={!newTemplateName.trim() || createTemplate.isPending}
              data-testid="button-submit-create-template"
            >
              {createTemplate.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Create Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Dialog */}
      <Dialog open={!!showDuplicateDialog} onOpenChange={(o) => !o && setShowDuplicateDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Duplicating "{showDuplicateDialog?.packageName}" including all deliverable items.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="dup-name">New Template Name</Label>
              <Input
                id="dup-name"
                value={dupName}
                onChange={(e) => setDupName(e.target.value)}
                data-testid="input-dup-name"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Sponsorship Level</Label>
                <Select value={dupLevel} onValueChange={setDupLevel}>
                  <SelectTrigger data-testid="select-dup-level">
                    <SelectValue placeholder="Level" />
                  </SelectTrigger>
                  <SelectContent>
                    {["Platinum", "Gold", "Silver", "Bronze"].map((l) => (
                      <SelectItem key={l} value={l}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="dup-year">Year</Label>
                <Input
                  id="dup-year"
                  placeholder="2026"
                  value={dupYear}
                  onChange={(e) => setDupYear(e.target.value)}
                  data-testid="input-dup-year"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dup-family">Event Family</Label>
              <Input
                id="dup-family"
                placeholder="e.g. FRC, USBT, TLS"
                value={dupFamily}
                onChange={(e) => setDupFamily(e.target.value)}
                data-testid="input-dup-family"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDuplicateDialog(null)}>Cancel</Button>
            <Button
              onClick={() => showDuplicateDialog && duplicateTemplate.mutate({
                id: showDuplicateDialog.id,
                newName: dupName,
                eventFamily: dupFamily || undefined,
                year: dupYear || undefined,
                sponsorshipLevel: dupLevel || undefined,
              })}
              disabled={!dupName.trim() || duplicateTemplate.isPending}
              data-testid="button-submit-duplicate"
            >
              {duplicateTemplate.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Duplicate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
