import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Link } from "wouter";
import { format, formatDistanceToNow, isAfter, isBefore, addDays } from "date-fns";
import {
  Search, Filter, Download, Send, CheckSquare, ChevronDown, ChevronRight,
  AlertCircle, AlertTriangle, Clock, Package, Users, Activity, Calendar,
  ExternalLink, RefreshCw, CheckCircle2, Eye, EyeOff, Bell, BellOff,
  Layers, ArrowUpDown, X, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { Event, Sponsor } from "@shared/schema";
import { DELIVERABLE_CATEGORIES, DELIVERABLE_STATUSES, DELIVERABLE_OWNER_TYPES } from "@shared/schema";

type QueueItem = {
  id: string;
  sponsorId: string;
  eventId: string;
  deliverableName: string;
  category: string;
  ownerType: string;
  status: string;
  fulfillmentType: string;
  dueTiming: string;
  dueDate: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  quantityFulfilled: number;
  reminderEligible: boolean;
  sponsorVisible: boolean;
  isOverridden: boolean;
  isCustom: boolean;
  sponsorFacingNote: string | null;
  internalNote: string | null;
  updatedAt: string | null;
  sponsorName: string;
  eventName: string;
  eventSlug: string;
  sponsorshipLevel: string;
  lastReminderSent: string | null;
  isOverdue: boolean;
};

const STATUS_COLORS: Record<string, string> = {
  "Awaiting Sponsor Input": "bg-amber-50 text-amber-700 border-amber-200",
  "Not Started":            "bg-muted text-muted-foreground border-border",
  "Needed":                 "bg-amber-50 text-amber-700 border-amber-200",
  "Issue Identified":       "bg-red-50 text-red-700 border-red-200",
  "Blocked":                "bg-red-50 text-red-700 border-red-200",
  "In Progress":            "bg-blue-50 text-blue-700 border-blue-200",
  "Scheduled":              "bg-blue-50 text-blue-700 border-blue-200",
  "Under Review":           "bg-purple-50 text-purple-700 border-purple-200",
  "Received":               "bg-purple-50 text-purple-700 border-purple-200",
  "Approved":               "bg-green-50 text-green-700 border-green-200",
  "Delivered":              "bg-green-50 text-green-700 border-green-200",
  "Available After Event":  "bg-teal-50 text-teal-700 border-teal-200",
};

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700",
  Gold:     "bg-amber-50 text-amber-700",
  Silver:   "bg-gray-100 text-gray-600",
  Bronze:   "bg-orange-50 text-orange-700",
};

const OWNER_COLORS: Record<string, string> = {
  Sponsor:  "bg-amber-50 text-amber-700",
  Converge: "bg-blue-50 text-blue-700",
  Shared:   "bg-purple-50 text-purple-700",
};

const DUE_TIMING_LABELS: Record<string, string> = {
  before_event:   "Pre-Event",
  during_event:   "During Event",
  after_event:    "Post-Event",
  specific_date:  "Specific Date",
  not_applicable: "N/A",
};

const COMPLETED_STATUSES = new Set(["Delivered", "Approved", "Available After Event"]);

type Preset = "all" | "awaiting-sponsor" | "awaiting-converge" | "overdue" | "compliance" | "post-event" | "this-week";

const PRESETS: { id: Preset; label: string; icon: typeof AlertCircle }[] = [
  { id: "all",              label: "All Items",            icon: Layers },
  { id: "awaiting-sponsor", label: "Awaiting Sponsor",     icon: Users },
  { id: "awaiting-converge",label: "Awaiting Converge",    icon: Activity },
  { id: "overdue",          label: "Overdue",              icon: AlertTriangle },
  { id: "compliance",       label: "Compliance",           icon: AlertCircle },
  { id: "post-event",       label: "Post-Event",           icon: Calendar },
  { id: "this-week",        label: "This Week",            icon: Clock },
];

export default function FulfillmentQueueTab({ initialPreset }: { initialPreset?: string }) {
  const { toast } = useToast();

  const [preset, setPreset] = useState<Preset>(() => {
    const valid: Preset[] = ["all", "awaiting-sponsor", "awaiting-converge", "overdue", "compliance", "post-event", "this-week"];
    return (valid.includes(initialPreset as Preset) ? initialPreset : "awaiting-sponsor") as Preset;
  });
  const [search, setSearch] = useState("");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterSponsor, setFilterSponsor] = useState("all");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterOwner, setFilterOwner] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterDueTiming, setFilterDueTiming] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [neverReminded, setNeverReminded] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);

  const { data: allItems = [], isLoading, refetch } = useQuery<QueueItem[]>({
    queryKey: ["/api/agreement/fulfillment-queue"],
  });

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/agreement/deliverables/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/fulfillment-queue"] });
      setInlineEditId(null);
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const bulkStatus = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: string }) =>
      apiRequest("POST", "/api/agreement/fulfillment-queue/bulk-status", { ids, status }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Updated ${data.updated} items` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/fulfillment-queue"] });
    },
    onError: () => toast({ title: "Bulk update failed", variant: "destructive" }),
  });

  const bulkRemind = useMutation({
    mutationFn: (ids: string[]) =>
      apiRequest("POST", "/api/agreement/fulfillment-queue/bulk-remind", { ids }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Sent ${data.sentCount} grouped reminder${data.sentCount !== 1 ? "s" : ""} to ${data.groupCount} sponsor/event pair${data.groupCount !== 1 ? "s" : ""}` });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/fulfillment-queue"] });
    },
    onError: () => toast({ title: "Bulk remind failed", variant: "destructive" }),
  });

  const now = new Date();
  const thisWeekEnd = addDays(now, 7);

  function applyPresetFilter(items: QueueItem[], p: Preset): QueueItem[] {
    switch (p) {
      case "awaiting-sponsor":
        return items.filter(d =>
          (d.ownerType === "Sponsor" || d.ownerType === "Shared") &&
          ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"].includes(d.status)
        );
      case "awaiting-converge":
        return items.filter(d =>
          (d.ownerType === "Converge" || d.ownerType === "Shared") &&
          !COMPLETED_STATUSES.has(d.status)
        );
      case "overdue":
        return items.filter(d => d.isOverdue && !COMPLETED_STATUSES.has(d.status));
      case "compliance":
        return items.filter(d => d.category === "Compliance");
      case "post-event":
        return items.filter(d => d.category === "Post-Event Deliverables" || d.dueTiming === "after_event");
      case "this-week":
        return items.filter(d => {
          if (!d.dueDate) return false;
          const dd = new Date(d.dueDate);
          return isAfter(dd, now) && isBefore(dd, thisWeekEnd) && !COMPLETED_STATUSES.has(d.status);
        });
      default:
        return items;
    }
  }

  const filteredItems = useMemo(() => {
    let items = applyPresetFilter(allItems, preset);

    if (filterEvent !== "all") items = items.filter(d => d.eventId === filterEvent);
    if (filterSponsor !== "all") items = items.filter(d => d.sponsorId === filterSponsor);
    if (filterLevel !== "all") items = items.filter(d => d.sponsorshipLevel === filterLevel);
    if (filterCategory !== "all") items = items.filter(d => d.category === filterCategory);
    if (filterOwner !== "all") items = items.filter(d => d.ownerType === filterOwner);
    if (filterStatus !== "all") items = items.filter(d => d.status === filterStatus);
    if (filterDueTiming !== "all") items = items.filter(d => d.dueTiming === filterDueTiming);
    if (overdueOnly) items = items.filter(d => d.isOverdue);
    if (neverReminded) items = items.filter(d => !d.lastReminderSent);

    if (search) {
      const q = search.toLowerCase();
      items = items.filter(d =>
        d.deliverableName.toLowerCase().includes(q) ||
        d.sponsorName.toLowerCase().includes(q) ||
        d.eventName.toLowerCase().includes(q) ||
        (d.eventSlug || "").toLowerCase().includes(q)
      );
    }

    return items;
  }, [allItems, preset, filterEvent, filterSponsor, filterLevel, filterCategory, filterOwner, filterStatus, filterDueTiming, overdueOnly, neverReminded, search]);

  const summaryCards = useMemo(() => {
    const open = allItems.filter(d => !COMPLETED_STATUSES.has(d.status));
    const awaitingSponsor = allItems.filter(d =>
      (d.ownerType === "Sponsor" || d.ownerType === "Shared") &&
      ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"].includes(d.status)
    );
    const awaitingConverge = allItems.filter(d =>
      (d.ownerType === "Converge" || d.ownerType === "Shared") &&
      !COMPLETED_STATUSES.has(d.status)
    );
    const overdue = allItems.filter(d => d.isOverdue && !COMPLETED_STATUSES.has(d.status));
    const compliance = allItems.filter(d => d.category === "Compliance" && !COMPLETED_STATUSES.has(d.status));
    const thisWeek = allItems.filter(d => {
      if (!d.dueDate) return false;
      const dd = new Date(d.dueDate);
      return isAfter(dd, now) && isBefore(dd, thisWeekEnd) && !COMPLETED_STATUSES.has(d.status);
    });
    return { open, awaitingSponsor, awaitingConverge, overdue, compliance, thisWeek };
  }, [allItems]);

  function toggleSelect(id: string) {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  }

  function toggleSelectAll() {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredItems.map(d => d.id)));
    }
  }

  function exportCSV() {
    const rows = filteredItems;
    const cols = ["Event", "Sponsor", "Level", "Deliverable", "Category", "Owner", "Status", "Due Timing", "Due Date", "Last Updated", "Last Reminder", "Reminder Eligible", "Visible to Sponsor"];
    const data = rows.map(r => [
      r.eventName, r.sponsorName, r.sponsorshipLevel, r.deliverableName, r.category, r.ownerType, r.status,
      DUE_TIMING_LABELS[r.dueTiming] ?? r.dueTiming,
      r.dueDate ? format(new Date(r.dueDate), "yyyy-MM-dd") : "",
      r.updatedAt ? format(new Date(r.updatedAt), "yyyy-MM-dd") : "",
      r.lastReminderSent ? format(new Date(r.lastReminderSent), "yyyy-MM-dd") : "Never",
      r.reminderEligible ? "Yes" : "No",
      r.sponsorVisible ? "Yes" : "No",
    ]);
    const csv = [cols, ...data].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "fulfillment-queue.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function formatLastReminder(val: string | null) {
    if (!val) return <span className="text-muted-foreground text-xs italic">Never</span>;
    const d = new Date(val);
    return (
      <span className="text-xs text-muted-foreground" title={format(d, "MMM d, yyyy h:mm a")}>
        {formatDistanceToNow(d, { addSuffix: true })}
      </span>
    );
  }

  function formatDueDate(item: QueueItem) {
    if (item.dueDate) {
      const d = new Date(item.dueDate);
      const isPast = isBefore(d, now);
      return (
        <span className={cn("text-xs", isPast && !COMPLETED_STATUSES.has(item.status) ? "text-red-600 font-medium" : "text-muted-foreground")}>
          {format(d, "MMM d")}
        </span>
      );
    }
    return <span className="text-xs text-muted-foreground">{DUE_TIMING_LABELS[item.dueTiming] ?? item.dueTiming}</span>;
  }

  function QuantityProgress({ item }: { item: QueueItem }) {
    if (item.fulfillmentType !== "quantity_progress" || !item.quantity) return null;
    const pct = Math.min(100, Math.round((item.quantityFulfilled / item.quantity) * 100));
    return (
      <div className="mt-1 flex items-center gap-1.5">
        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden max-w-[60px]">
          <div className="h-full bg-accent rounded-full" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-[10px] text-muted-foreground">{item.quantityFulfilled}/{item.quantity} {item.quantityUnit}</span>
      </div>
    );
  }

  function InlineStatusEdit({ item }: { item: QueueItem }) {
    return (
      <Select
        defaultValue={item.status}
        onValueChange={(val) => updateStatus.mutate({ id: item.id, status: val })}
        open
        onOpenChange={(open) => { if (!open) setInlineEditId(null); }}
      >
        <SelectTrigger className="h-6 text-xs w-44 hidden" />
        <SelectContent>
          {DELIVERABLE_STATUSES.map(s => (
            <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const allSelected = filteredItems.length > 0 && selectedIds.size === filteredItems.length;
  const someSelected = selectedIds.size > 0;

  return (
    <div className="space-y-4" data-testid="fulfillment-queue">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Open Items", value: summaryCards.open.length, icon: Package, color: "text-foreground", bg: "bg-muted/50", preset: "all" as Preset },
          { label: "Awaiting Sponsor", value: summaryCards.awaitingSponsor.length, icon: Users, color: "text-amber-600", bg: "bg-amber-50", preset: "awaiting-sponsor" as Preset },
          { label: "Awaiting Converge", value: summaryCards.awaitingConverge.length, icon: Activity, color: "text-blue-600", bg: "bg-blue-50", preset: "awaiting-converge" as Preset },
          { label: "Overdue", value: summaryCards.overdue.length, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50", preset: "overdue" as Preset },
          { label: "Compliance", value: summaryCards.compliance.length, icon: AlertCircle, color: "text-purple-600", bg: "bg-purple-50", preset: "compliance" as Preset },
          { label: "Due This Week", value: summaryCards.thisWeek.length, icon: Clock, color: "text-green-600", bg: "bg-green-50", preset: "this-week" as Preset },
        ].map(({ label, value, icon: Icon, color, bg, preset: p }) => (
          <button
            key={label}
            onClick={() => setPreset(p)}
            className={cn(
              "rounded-xl border p-3 flex items-center gap-3 text-left transition-all hover:shadow-sm",
              preset === p ? "ring-2 ring-accent border-accent/30" : "bg-card border-border",
            )}
            data-testid={`summary-card-${p}`}
          >
            <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", bg)}>
              <Icon className={cn("h-4 w-4", color)} />
            </div>
            <div>
              <p className="text-lg font-bold leading-tight">{value}</p>
              <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Preset Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {PRESETS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setPreset(id)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors border",
              preset === id
                ? "bg-accent text-accent-foreground border-accent/50"
                : "bg-card text-muted-foreground border-border hover:bg-muted/50",
            )}
            data-testid={`preset-${id}`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sponsor, deliverable, event..."
            className="pl-9 h-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-queue-search"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className={cn("h-9 gap-1.5", showFilters && "bg-accent/10 border-accent/30 text-accent")}
          onClick={() => setShowFilters(!showFilters)}
          data-testid="btn-toggle-filters"
        >
          <Filter className="h-3.5 w-3.5" />
          Filters
          {showFilters ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={exportCSV} data-testid="btn-export-csv">
          <Download className="h-3.5 w-3.5" /> Export
        </Button>
        <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => refetch()} data-testid="btn-refresh-queue">
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="rounded-xl border bg-card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Event</label>
            <Select value={filterEvent} onValueChange={setFilterEvent}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-event">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map(e => <SelectItem key={e.id} value={e.id} className="text-xs">{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Sponsor</label>
            <Select value={filterSponsor} onValueChange={setFilterSponsor}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-sponsor">
                <SelectValue placeholder="All Sponsors" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sponsors</SelectItem>
                {sponsors.map(s => <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Level</label>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-level">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {["Platinum", "Gold", "Silver", "Bronze"].map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Category</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {DELIVERABLE_CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Owner</label>
            <Select value={filterOwner} onValueChange={setFilterOwner}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-owner">
                <SelectValue placeholder="All Owners" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Owners</SelectItem>
                {DELIVERABLE_OWNER_TYPES.map(o => <SelectItem key={o} value={o} className="text-xs">{o}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Status</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {DELIVERABLE_STATUSES.map(s => <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground uppercase mb-1 block">Due Timing</label>
            <Select value={filterDueTiming} onValueChange={setFilterDueTiming}>
              <SelectTrigger className="h-8 text-xs" data-testid="filter-due-timing">
                <SelectValue placeholder="Any Timing" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Any Timing</SelectItem>
                {Object.entries(DUE_TIMING_LABELS).map(([v, l]) => <SelectItem key={v} value={v} className="text-xs">{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col justify-end gap-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={overdueOnly} onCheckedChange={(v) => setOverdueOnly(!!v)} data-testid="filter-overdue-only" />
              Overdue Only
            </label>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Checkbox checked={neverReminded} onCheckedChange={(v) => setNeverReminded(!!v)} data-testid="filter-never-reminded" />
              Never Reminded
            </label>
          </div>
          <div className="col-span-full flex justify-end">
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => {
              setFilterEvent("all"); setFilterSponsor("all"); setFilterLevel("all");
              setFilterCategory("all"); setFilterOwner("all"); setFilterStatus("all");
              setFilterDueTiming("all"); setOverdueOnly(false); setNeverReminded(false);
              setSearch("");
            }} data-testid="btn-clear-filters">
              <X className="h-3.5 w-3.5 mr-1" /> Clear All Filters
            </Button>
          </div>
        </div>
      )}

      {/* Bulk Actions Bar */}
      {someSelected && (
        <div className="flex items-center gap-3 rounded-xl border border-accent/30 bg-accent/5 px-4 py-2.5">
          <span className="text-sm font-medium text-foreground">{selectedIds.size} selected</span>
          <div className="flex gap-2 ml-auto flex-wrap">
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => bulkRemind.mutate(Array.from(selectedIds))}
              disabled={bulkRemind.isPending}
              data-testid="btn-bulk-remind"
            >
              <Send className="h-3 w-3" />
              {bulkRemind.isPending ? "Sending…" : "Send Grouped Reminder"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => bulkStatus.mutate({ ids: Array.from(selectedIds), status: "In Progress" })}
              disabled={bulkStatus.isPending}
              data-testid="btn-bulk-in-progress"
            >
              <Activity className="h-3 w-3" /> Mark In Progress
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => bulkStatus.mutate({ ids: Array.from(selectedIds), status: "Delivered" })}
              disabled={bulkStatus.isPending}
              data-testid="btn-bulk-delivered"
            >
              <CheckCircle2 className="h-3 w-3" /> Mark Delivered
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs gap-1.5"
              onClick={() => bulkStatus.mutate({ ids: Array.from(selectedIds), status: "Awaiting Sponsor Input" })}
              disabled={bulkStatus.isPending}
              data-testid="btn-bulk-awaiting-sponsor"
            >
              <Users className="h-3 w-3" /> Mark Awaiting Sponsor
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      {/* Results count */}
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{filteredItems.length} item{filteredItems.length !== 1 ? "s" : ""}</span>
        {selectedIds.size > 0 && <span className="text-accent font-medium">{selectedIds.size} selected</span>}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading fulfillment queue...
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
          <CheckCircle2 className="h-12 w-12 opacity-20" />
          <p className="text-sm font-medium">No items match your filters</p>
          <p className="text-xs">Try a different preset or clear filters</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="w-8 py-2.5 pl-3 pr-1">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={toggleSelectAll}
                      data-testid="checkbox-select-all"
                    />
                  </th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Sponsor</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Event</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">Deliverable</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden lg:table-cell">Category</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden md:table-cell">Owner</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden sm:table-cell">Due</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell">Last Reminder</th>
                  <th className="py-2.5 px-3 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wide hidden xl:table-cell whitespace-nowrap">Visible</th>
                  <th className="py-2.5 px-3 text-right text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const isExpanded = expandedId === item.id;
                  const isSelected = selectedIds.has(item.id);
                  const isEditingStatus = inlineEditId === item.id;
                  const isComplete = COMPLETED_STATUSES.has(item.status);

                  return (
                    <>
                      <tr
                        key={item.id}
                        className={cn(
                          "border-b transition-colors",
                          isSelected ? "bg-accent/5" : "hover:bg-muted/30",
                          item.isOverdue && !isComplete && "bg-red-50/30 dark:bg-red-950/10",
                        )}
                        data-testid={`queue-row-${item.id}`}
                      >
                        <td className="py-2.5 pl-3 pr-1">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleSelect(item.id)}
                            data-testid={`checkbox-row-${item.id}`}
                          />
                        </td>
                        <td className="py-2.5 px-3 max-w-[140px]">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <div className="min-w-0">
                              <p className="text-xs font-medium truncate">{item.sponsorName}</p>
                              {item.sponsorshipLevel && (
                                <span className={cn("text-[9px] px-1 py-0.5 rounded font-medium", LEVEL_COLORS[item.sponsorshipLevel] ?? "bg-muted text-muted-foreground")}>
                                  {item.sponsorshipLevel}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 max-w-[100px]">
                          <p className="text-xs text-muted-foreground truncate" title={item.eventName}>{item.eventSlug || item.eventName}</p>
                        </td>
                        <td className="py-2.5 px-3 max-w-[180px]">
                          <p className="text-xs font-medium truncate">{item.deliverableName}</p>
                          <QuantityProgress item={item} />
                          <div className="flex gap-1 mt-0.5">
                            {item.isOverridden && <span className="text-[9px] bg-purple-50 text-purple-600 px-1 rounded border border-purple-200">Override</span>}
                            {item.isCustom && <span className="text-[9px] bg-blue-50 text-blue-600 px-1 rounded border border-blue-200">Custom</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 hidden lg:table-cell">
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.category}</span>
                        </td>
                        <td className="py-2.5 px-3 hidden md:table-cell">
                          <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", OWNER_COLORS[item.ownerType] ?? "bg-muted text-muted-foreground")}>
                            {item.ownerType}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {isEditingStatus ? (
                            <div className="relative">
                              <Select
                                defaultValue={item.status}
                                onValueChange={(val) => updateStatus.mutate({ id: item.id, status: val })}
                                open
                                onOpenChange={(open) => { if (!open) setInlineEditId(null); }}
                              >
                                <SelectTrigger className="h-6 text-xs w-40" data-testid={`inline-status-select-${item.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DELIVERABLE_STATUSES.map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          ) : (
                            <button
                              onClick={() => setInlineEditId(item.id)}
                              className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border cursor-pointer hover:opacity-80 transition-opacity",
                                STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground border-border"
                              )}
                              title="Click to change status"
                              data-testid={`btn-status-${item.id}`}
                            >
                              {item.isOverdue && !isComplete && <AlertTriangle className="h-2.5 w-2.5 inline mr-0.5 text-red-500" />}
                              {item.status}
                            </button>
                          )}
                        </td>
                        <td className="py-2.5 px-3 hidden sm:table-cell">
                          {formatDueDate(item)}
                        </td>
                        <td className="py-2.5 px-3 hidden xl:table-cell">
                          {formatLastReminder(item.lastReminderSent)}
                        </td>
                        <td className="py-2.5 px-3 hidden xl:table-cell">
                          {item.sponsorVisible
                            ? <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                            : <EyeOff className="h-3.5 w-3.5 text-muted-foreground opacity-40" />
                          }
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setExpandedId(isExpanded ? null : item.id)}
                              className="p-1 rounded hover:bg-muted text-muted-foreground"
                              title={isExpanded ? "Collapse" : "Expand details"}
                              data-testid={`btn-expand-${item.id}`}
                            >
                              {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                            </button>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="p-1 rounded hover:bg-muted text-muted-foreground" data-testid={`btn-actions-${item.id}`}>
                                  <MoreHorizontal className="h-3.5 w-3.5" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="text-xs w-44">
                                <DropdownMenuItem asChild>
                                  <Link href={`/admin/agreement/sponsor-agreements/${item.sponsorId}/${item.eventId}`} className="flex items-center gap-2 text-xs cursor-pointer">
                                    <ExternalLink className="h-3.5 w-3.5" /> Open Agreement
                                  </Link>
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={() => setInlineEditId(item.id)} className="text-xs gap-2">
                                  <ArrowUpDown className="h-3.5 w-3.5" /> Update Status
                                </DropdownMenuItem>
                                {item.reminderEligible && !isComplete && (
                                  <DropdownMenuItem
                                    onSelect={() => bulkRemind.mutate([item.id])}
                                    className="text-xs gap-2"
                                    data-testid={`btn-remind-${item.id}`}
                                  >
                                    <Send className="h-3.5 w-3.5" /> Send Reminder
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onSelect={() => bulkStatus.mutate({ ids: [item.id], status: "In Progress" })}
                                  className="text-xs gap-2"
                                >
                                  <Activity className="h-3.5 w-3.5" /> Mark In Progress
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onSelect={() => bulkStatus.mutate({ ids: [item.id], status: "Delivered" })}
                                  className="text-xs gap-2"
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5" /> Mark Delivered
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr key={`${item.id}-detail`} className="border-b bg-muted/20">
                          <td colSpan={11} className="py-3 px-4">
                            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Due Timing</p>
                                <p>{DUE_TIMING_LABELS[item.dueTiming] ?? item.dueTiming}</p>
                                {item.dueDate && (
                                  <p className={cn("text-muted-foreground", item.isOverdue && !COMPLETED_STATUSES.has(item.status) ? "text-red-600 font-medium" : "")}>
                                    {format(new Date(item.dueDate), "MMM d, yyyy")}
                                    {item.isOverdue && !COMPLETED_STATUSES.has(item.status) && " (Overdue)"}
                                  </p>
                                )}
                              </div>
                              {(item.quantity != null) && (
                                <div>
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Quantity</p>
                                  <p>{item.quantityFulfilled} / {item.quantity} {item.quantityUnit}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Badges</p>
                                <div className="flex flex-wrap gap-1">
                                  {item.sponsorVisible && <span className="text-[9px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-200">Sponsor Visible</span>}
                                  {item.reminderEligible && <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded border border-green-200">Reminder Eligible</span>}
                                  {item.isOverridden && <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded border border-purple-200">Overridden</span>}
                                  {item.isCustom && <span className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-200">Custom</span>}
                                </div>
                              </div>
                              <div>
                                <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Last Updated</p>
                                <p className="text-muted-foreground">
                                  {item.updatedAt ? formatDistanceToNow(new Date(item.updatedAt), { addSuffix: true }) : "—"}
                                </p>
                              </div>
                              {item.sponsorFacingNote && (
                                <div className="col-span-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Sponsor-Facing Note</p>
                                  <p className="text-muted-foreground italic">{item.sponsorFacingNote}</p>
                                </div>
                              )}
                              {item.internalNote && (
                                <div className="col-span-2">
                                  <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Internal Note</p>
                                  <p className="text-muted-foreground italic">{item.internalNote}</p>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
