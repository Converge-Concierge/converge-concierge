import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Tags, Plus, Upload, Search, Check, X, Edit2, Trash2,
  ChevronDown, ChevronUp, AlertCircle, Lightbulb, Users, Building2, BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event } from "@shared/schema";

interface TopicWithUsage {
  id: string;
  eventId: string;
  topicKey: string;
  topicLabel: string;
  topicDescription: string | null;
  topicSource: string;
  status: string;
  displayOrder: number;
  isActive: boolean;
  suggestedBySponsorId: string | null;
  createdAt: string;
  updatedAt: string;
  usage: { attendees: number; sponsors: number; sessions: number };
}

const SOURCE_COLORS: Record<string, string> = {
  ADMIN_DEFINED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  AGENDA_ANALYSIS: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  SPONSOR_SUGGESTED: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
};

const SOURCE_LABELS: Record<string, string> = {
  ADMIN_DEFINED: "Admin",
  AGENDA_ANALYSIS: "Agenda AI",
  SPONSOR_SUGGESTED: "Sponsor",
};

const STATUS_COLORS: Record<string, string> = {
  APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
  PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};

export default function InterestTopicsPage() {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addStatus, setAddStatus] = useState("APPROVED");

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkStatus, setBulkStatus] = useState("APPROVED");

  const [editTopic, setEditTopic] = useState<TopicWithUsage | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const [deleteTopic, setDeleteTopic] = useState<TopicWithUsage | null>(null);
  const [pendingExpanded, setPendingExpanded] = useState(true);

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const sortedEvents = useMemo(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active.filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active.filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  const effectiveEventId = selectedEventId ?? (sortedEvents.length > 0 ? sortedEvents[0].id : null);

  const { data: topics = [], isLoading } = useQuery<TopicWithUsage[]>({
    queryKey: ["/api/admin/interest-topics", effectiveEventId],
    queryFn: async () => {
      if (!effectiveEventId) return [];
      const res = await fetch(`/api/admin/events/${effectiveEventId}/interest-topics`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch topics");
      return res.json();
    },
    enabled: !!effectiveEventId,
  });

  const pendingTopics = useMemo(() => topics.filter(t => t.status === "PENDING"), [topics]);
  const filteredTopics = useMemo(() => {
    let list = topics.filter(t => t.status !== "PENDING");
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(t => t.topicLabel.toLowerCase().includes(q) || t.topicKey.toLowerCase().includes(q));
    }
    return list;
  }, [topics, statusFilter, search]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/admin/interest-topics", effectiveEventId] });

  const createMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/admin/events/${effectiveEventId}/interest-topics`, body),
    onSuccess: () => { toast({ title: "Topic created" }); setAddDialogOpen(false); setAddLabel(""); setAddDescription(""); setAddStatus("APPROVED"); invalidate(); },
    onError: async (err: any) => {
      const body = await err?.response?.json?.().catch(() => null);
      toast({ title: "Error", description: body?.message ?? err.message, variant: "destructive" });
    },
  });

  const bulkMutation = useMutation({
    mutationFn: (body: any) => apiRequest("POST", `/api/admin/events/${effectiveEventId}/interest-topics/bulk`, body),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Bulk add complete`, description: `${data.created} created, ${data.duplicates} skipped (duplicates)` });
      setBulkDialogOpen(false); setBulkText(""); invalidate();
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: any }) => apiRequest("PATCH", `/api/admin/interest-topics/${id}`, updates),
    onSuccess: () => { toast({ title: "Topic updated" }); setEditTopic(null); invalidate(); },
    onError: async (err: any) => {
      const body = await err?.response?.json?.().catch(() => null);
      toast({ title: "Error", description: body?.message ?? err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/interest-topics/${id}`),
    onSuccess: () => { toast({ title: "Topic deleted" }); setDeleteTopic(null); invalidate(); },
    onError: async (err: any) => {
      const body = await err?.response?.json?.().catch(() => null);
      toast({ title: "Cannot delete", description: body?.message ?? err.message, variant: "destructive" });
    },
  });

  const handleStatus = (id: string, status: string) => updateMutation.mutate({ id, updates: { status, isActive: status === "APPROVED" } });
  const handleToggleActive = (topic: TopicWithUsage) => updateMutation.mutate({ id: topic.id, updates: { isActive: !topic.isActive } });
  const handleMoveOrder = (topic: TopicWithUsage, dir: -1 | 1) => {
    const newOrder = Math.max(0, topic.displayOrder + dir);
    updateMutation.mutate({ id: topic.id, updates: { displayOrder: newOrder } });
  };

  const handleBulkAdd = () => {
    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) { toast({ title: "Enter at least one topic", variant: "destructive" }); return; }
    bulkMutation.mutate({ lines, status: bulkStatus });
  };

  const openEdit = (t: TopicWithUsage) => { setEditTopic(t); setEditLabel(t.topicLabel); setEditDescription(t.topicDescription ?? ""); };

  if (!effectiveEventId) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center space-y-2">
          <Tags className="h-10 w-10 mx-auto opacity-40" />
          <p>No events found</p>
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Agenda Topics</h1>
            <p className="text-sm text-muted-foreground mt-1">Manage event-specific topics for attendees, sponsors, and sessions</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setBulkDialogOpen(true)} data-testid="button-bulk-add" className="gap-1.5">
              <Upload className="h-4 w-4" /> Bulk Add
            </Button>
            <Button size="sm" onClick={() => setAddDialogOpen(true)} data-testid="button-add-topic" className="gap-1.5" disabled={!effectiveEventId}>
              <Plus className="h-4 w-4" /> Add Topic
            </Button>
          </div>
        </div>

        {sortedEvents.length > 0 && (
          <div className="overflow-x-auto pb-1">
            <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
              {sortedEvents.map(event => {
                const isActive = effectiveEventId === event.id;
                return (
                  <button
                    key={event.id}
                    data-testid={`tab-event-${event.slug}`}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn("shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap", isActive ? "shadow-sm text-white" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                    style={isActive ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
                  >
                    {event.slug || event.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {pendingTopics.length > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/60 dark:bg-yellow-900/10 dark:border-yellow-800/40 overflow-hidden">
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-yellow-800 dark:text-yellow-200"
              onClick={() => setPendingExpanded(p => !p)}
              data-testid="button-toggle-pending"
            >
              <span className="flex items-center gap-2">
                <Lightbulb className="h-4 w-4" />
                Pending Review — {pendingTopics.length} suggestion{pendingTopics.length !== 1 ? "s" : ""} awaiting approval
              </span>
              {pendingExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            {pendingExpanded && (
              <div className="border-t border-yellow-200 dark:border-yellow-800/40">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-yellow-50/80 dark:bg-yellow-900/20">
                      <TableHead className="font-semibold">Topic Label</TableHead>
                      <TableHead className="font-semibold">Key</TableHead>
                      <TableHead className="font-semibold">Source</TableHead>
                      <TableHead className="font-semibold w-[200px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTopics.map(t => (
                      <TableRow key={t.id} data-testid={`row-pending-${t.id}`}>
                        <TableCell className="font-medium">{t.topicLabel}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{t.topicKey}</TableCell>
                        <TableCell>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SOURCE_COLORS[t.topicSource] || "bg-gray-100")}>{SOURCE_LABELS[t.topicSource] || t.topicSource}</span>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-green-700 border-green-300 hover:bg-green-50" onClick={() => handleStatus(t.id, "APPROVED")} data-testid={`button-approve-${t.id}`}>
                              <Check className="h-3.5 w-3.5" /> Approve
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 gap-1 text-red-700 border-red-300 hover:bg-red-50" onClick={() => handleStatus(t.id, "REJECTED")} data-testid={`button-reject-${t.id}`}>
                              <X className="h-3.5 w-3.5" /> Reject
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEdit(t)} data-testid={`button-edit-pending-${t.id}`}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search topics…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
              data-testid="input-search-topics"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px] h-9" data-testid="filter-topic-status">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="APPROVED">Approved</SelectItem>
              <SelectItem value="REJECTED">Rejected</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">{filteredTopics.length} topic{filteredTopics.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold w-[40px]">Order</TableHead>
                <TableHead className="font-semibold">Topic Label</TableHead>
                <TableHead className="font-semibold">Source</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Active</TableHead>
                <TableHead className="font-semibold text-center">
                  <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1 justify-center cursor-default"><Users className="h-3.5 w-3.5" />Attendees</span></TooltipTrigger><TooltipContent>Attendees who selected this topic</TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="font-semibold text-center">
                  <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1 justify-center cursor-default"><Building2 className="h-3.5 w-3.5" />Sponsors</span></TooltipTrigger><TooltipContent>Sponsors who selected this topic</TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="font-semibold text-center">
                  <Tooltip><TooltipTrigger asChild><span className="flex items-center gap-1 justify-center cursor-default"><BookOpen className="h-3.5 w-3.5" />Sessions</span></TooltipTrigger><TooltipContent>Sessions tagged with this topic</TooltipContent></Tooltip>
                </TableHead>
                <TableHead className="font-semibold w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="h-24 text-center text-muted-foreground">Loading topics…</TableCell></TableRow>
              ) : filteredTopics.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="h-24 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Tags className="h-8 w-8 opacity-40" />
                      <p className="text-sm">{search ? "No topics match your search" : "No topics yet — add some to get started"}</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTopics.map(t => (
                  <TableRow key={t.id} className="hover:bg-muted/20" data-testid={`row-topic-${t.id}`}>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => handleMoveOrder(t, -1)} className="text-muted-foreground hover:text-foreground p-0.5" disabled={t.displayOrder === 0}><ChevronUp className="h-3 w-3" /></button>
                        <span className="text-xs text-muted-foreground text-center">{t.displayOrder}</span>
                        <button onClick={() => handleMoveOrder(t, 1)} className="text-muted-foreground hover:text-foreground p-0.5"><ChevronDown className="h-3 w-3" /></button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <span className="font-medium">{t.topicLabel}</span>
                        <span className="ml-2 font-mono text-xs text-muted-foreground">{t.topicKey}</span>
                        {t.topicDescription && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{t.topicDescription}</p>}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", SOURCE_COLORS[t.topicSource] || "bg-gray-100")}>{SOURCE_LABELS[t.topicSource] || t.topicSource}</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[t.status] || "bg-gray-100")}>{t.status}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch checked={t.isActive} onCheckedChange={() => handleToggleActive(t)} disabled={t.status !== "APPROVED"} data-testid={`switch-active-${t.id}`} />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-sm font-medium", t.usage.attendees > 0 ? "text-foreground" : "text-muted-foreground")}>{t.usage.attendees}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-sm font-medium", t.usage.sponsors > 0 ? "text-foreground" : "text-muted-foreground")}>{t.usage.sponsors}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      <span className={cn("text-sm font-medium", t.usage.sessions > 0 ? "text-foreground" : "text-muted-foreground")}>{t.usage.sessions}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(t)} data-testid={`button-edit-${t.id}`}><Edit2 className="h-3.5 w-3.5" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>Edit topic</TooltipContent>
                        </Tooltip>
                        {t.status === "APPROVED" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => handleStatus(t.id, "REJECTED")} data-testid={`button-reject-active-${t.id}`}><X className="h-3.5 w-3.5" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>Reject topic</TooltipContent>
                          </Tooltip>
                        )}
                        {t.status === "REJECTED" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleStatus(t.id, "APPROVED")} data-testid={`button-approve-active-${t.id}`}><Check className="h-3.5 w-3.5" /></Button>
                            </TooltipTrigger>
                            <TooltipContent>Approve topic</TooltipContent>
                          </Tooltip>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setDeleteTopic(t)} data-testid={`button-delete-${t.id}`} disabled={t.usage.attendees + t.usage.sponsors + t.usage.sessions > 0}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </TooltipTrigger>
                          <TooltipContent>{t.usage.attendees + t.usage.sponsors + t.usage.sessions > 0 ? "In use — cannot delete" : "Delete topic"}</TooltipContent>
                        </Tooltip>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Interest Topic</DialogTitle>
              <DialogDescription>Topics should be concise 2–3 word phrases (e.g. "AI Risk Management", "Real-Time Payments")</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="add-label">Topic Label <span className="text-destructive">*</span></Label>
                <Input id="add-label" placeholder="e.g. AI Risk Management" value={addLabel} onChange={e => setAddLabel(e.target.value)} data-testid="input-topic-label" onKeyDown={e => e.key === "Enter" && createMutation.mutate({ topicLabel: addLabel, topicDescription: addDescription || undefined, status: addStatus })} />
                {addLabel && <p className="text-xs text-muted-foreground">Key: <code className="bg-muted px-1 rounded">{addLabel.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}</code></p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="add-desc">Description <span className="text-muted-foreground text-xs">(optional)</span></Label>
                <Textarea id="add-desc" placeholder="Brief description of this topic area…" value={addDescription} onChange={e => setAddDescription(e.target.value)} className="resize-none h-20" data-testid="input-topic-description" />
              </div>
              <div className="space-y-1.5">
                <Label>Initial Status</Label>
                <Select value={addStatus} onValueChange={setAddStatus}>
                  <SelectTrigger data-testid="select-topic-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">Approved (live immediately)</SelectItem>
                    <SelectItem value="PENDING">Pending (review required)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddDialogOpen(false)}>Cancel</Button>
              <Button onClick={() => createMutation.mutate({ topicLabel: addLabel, topicDescription: addDescription || undefined, status: addStatus })} disabled={!addLabel.trim() || createMutation.isPending} data-testid="button-save-topic">
                {createMutation.isPending ? "Saving…" : "Add Topic"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bulk Add Topics</DialogTitle>
              <DialogDescription>Paste one topic per line. Duplicate topics within this event will be skipped automatically.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="bulk-text">Topics (one per line)</Label>
                <Textarea
                  id="bulk-text"
                  placeholder={"AI Risk Management\nFraud Detection\nReal-Time Payments\nCore Modernization\nEmbedded Finance"}
                  value={bulkText}
                  onChange={e => setBulkText(e.target.value)}
                  className="resize-none h-40 font-mono text-sm"
                  data-testid="textarea-bulk-topics"
                />
                <p className="text-xs text-muted-foreground">{bulkText.split("\n").filter(l => l.trim()).length} lines detected</p>
              </div>
              <div className="space-y-1.5">
                <Label>Status for all new topics</Label>
                <Select value={bulkStatus} onValueChange={setBulkStatus}>
                  <SelectTrigger data-testid="select-bulk-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="APPROVED">Approved (live immediately)</SelectItem>
                    <SelectItem value="PENDING">Pending (review required)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleBulkAdd} disabled={!bulkText.trim() || bulkMutation.isPending} data-testid="button-bulk-submit">
                {bulkMutation.isPending ? "Adding…" : "Add Topics"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editTopic} onOpenChange={open => !open && setEditTopic(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Topic</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label>Topic Label</Label>
                <Input value={editLabel} onChange={e => setEditLabel(e.target.value)} data-testid="input-edit-label" />
                {editLabel && <p className="text-xs text-muted-foreground">Key: <code className="bg-muted px-1 rounded">{editLabel.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "")}</code></p>}
              </div>
              <div className="space-y-1.5">
                <Label>Description</Label>
                <Textarea value={editDescription} onChange={e => setEditDescription(e.target.value)} className="resize-none h-20" data-testid="input-edit-description" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTopic(null)}>Cancel</Button>
              <Button onClick={() => updateMutation.mutate({ id: editTopic!.id, updates: { topicLabel: editLabel, topicDescription: editDescription || undefined } })} disabled={!editLabel.trim() || updateMutation.isPending} data-testid="button-save-edit">
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={!!deleteTopic} onOpenChange={open => !open && setDeleteTopic(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Topic</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>"{deleteTopic?.topicLabel}"</strong>? This cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate(deleteTopic!.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </motion.div>
    </TooltipProvider>
  );
}
