import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";
import { format } from "date-fns";
import FulfillmentQueueTab from "@/components/admin/FulfillmentQueueTab";
import {
  ClipboardList, Plus, Users, AlertCircle, RefreshCw,
  Eye, ChevronRight, CheckCircle2, Search,
  Send, TriangleAlert, Download, Gem, Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import type { Event, Sponsor } from "@shared/schema";
import { getDeliverableType } from "@/components/admin/StructuredDeliverableEditors";

type TemplateWithCount = PackageTemplate & { deliverableCount: number };

type AgreementSummary = {
  sponsorId: string;
  eventId: string;
  sponsorName: string;
  eventName: string;
  sponsorshipLevel: string;
  packageTemplateId: string | null;
  totalDeliverables: number;
  deliveredCount: number;
  awaitingSponsorCount: number;
  lastUpdated: string;
};

type ActivationMetric = {
  sponsorId: string;
  eventId: string;
  activationScore: number;
  activationLabel: string;
  completionPct: number;
  completedDeliverables: number;
  totalDeliverables: number;
  meetingsScheduled: number;
  meetingsCompleted: number;
  meetingRequests: number;
  infoRequestCount: number;
  lastLoginAt: string | null;
  loginCount: number;
  hasNeverLoggedIn: boolean;
};

const ACTIVATION_COLORS: Record<string, string> = {
  "Fully Activated": "bg-green-100 text-green-700 border-green-300",
  "Active":          "bg-blue-100 text-blue-700 border-blue-300",
  "At Risk":         "bg-amber-100 text-amber-700 border-amber-300",
  "Inactive":        "bg-red-100 text-red-700 border-red-300",
};

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700 border-slate-300",
  Gold:     "bg-amber-50 text-amber-700 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-50 text-orange-700 border-orange-300",
};

export default function AgreementDeliverablesPage() {
  const [location, nav] = useLocation();
  const { toast } = useToast();
  const urlParams = new URLSearchParams(location.split("?")[1] ?? "");
  const initialTab = urlParams.get("tab") ?? "sponsor-agreements";
  const initialPreset = urlParams.get("preset") ?? undefined;
  const [activeTab, setActiveTab] = useState(initialTab);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [searchAgreements, setSearchAgreements] = useState("");
  const [filterLevel, setFilterLevel] = useState("all");
  const [filterEvent, setFilterEvent] = useState("all");
  const [filterActivation, setFilterActivation] = useState("all");

  const [searchOutstanding, setSearchOutstanding] = useState("");
  const [filterOutstandingEvent, setFilterOutstandingEvent] = useState("all");
  const [filterOutstandingStatus, setFilterOutstandingStatus] = useState("all");
  const [showOverdueOnly, setShowOverdueOnly] = useState(false);
  const [sendingPair, setSendingPair] = useState<string | null>(null);

  const [genSponsorId, setGenSponsorId] = useState("");
  const [genEventId, setGenEventId] = useState("");
  const [genTemplateId, setGenTemplateId] = useState("");
  const [genLevel, setGenLevel] = useState("");

  const { data: templates = [] } = useQuery<TemplateWithCount[]>({
    queryKey: ["/api/agreement/package-templates"],
    enabled: showGenerateDialog,
  });

  const { data: agreements = [], isLoading: agrLoading } = useQuery<AgreementSummary[]>({
    queryKey: ["/api/agreement/deliverables"],
  });

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: activationMetrics = [] } = useQuery<ActivationMetric[]>({
    queryKey: ["/api/agreement/activation-metrics"],
    enabled: activeTab === "sponsor-agreements",
  });
  const activationMap = new Map(activationMetrics.map(m => [`${m.sponsorId}:${m.eventId}`, m]));

  // Sort events: upcoming first (soonest start), then past (most recent end first)
  const hasAutoSelected = useRef(false);
  const sortedEventsForSelector = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active
      .filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active
      .filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  // Only show events that actually have agreements
  const eventIdsWithAgreements = useMemo(() => new Set(agreements.map(a => a.eventId)), [agreements]);
  const eventsWithAgreements = useMemo(
    () => sortedEventsForSelector.filter(e => eventIdsWithAgreements.has(e.id)),
    [sortedEventsForSelector, eventIdsWithAgreements],
  );

  // Auto-select the soonest active event on first load
  useEffect(() => {
    if (hasAutoSelected.current || agreements.length === 0 || eventsWithAgreements.length === 0) return;
    hasAutoSelected.current = true;
    setFilterEvent(eventsWithAgreements[0].id);
  }, [agreements, eventsWithAgreements]);

  type OutstandingItem = {
    id: string; sponsorId: string; eventId: string; sponsorName: string; eventName: string;
    sponsorshipLevel: string; deliverableName: string; category: string; status: string;
    dueDate: string | null; dueTiming: string; reminderEligible: boolean;
    lastReminderSent: string | null; isOverdue: boolean;
  };
  const { data: outstandingItems = [], isLoading: outLoading, refetch: refetchOutstanding } = useQuery<OutstandingItem[]>({
    queryKey: ["/api/agreement/outstanding-items"],
  });

  const sendReminder = useMutation({
    mutationFn: ({ sponsorId, eventId }: { sponsorId: string; eventId: string }) =>
      apiRequest("POST", "/api/agreement/reminders/send", { sponsorId, eventId }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Reminder sent — ${data.deliverableCount} item${data.deliverableCount !== 1 ? "s" : ""} included` });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/outstanding-items"] });
      setSendingPair(null);
    },
    onError: async (err: any) => {
      const msg = err?.message ?? "Failed to send reminder";
      toast({ title: msg, variant: "destructive" });
      setSendingPair(null);
    },
  });

  const generateAgreement = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/agreement/generate", data),
    onSuccess: async () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables"] });
      toast({ title: "Agreement deliverables generated" });
      setShowGenerateDialog(false);
    },
    onError: () => toast({ title: "Failed to generate", variant: "destructive" }),
  });

  const filteredAgreements = agreements.filter((a) => {
    if (searchAgreements) {
      const q = searchAgreements.toLowerCase();
      if (!a.sponsorName.toLowerCase().includes(q) && !a.eventName.toLowerCase().includes(q)) return false;
    }
    if (filterEvent !== "all" && a.eventId !== filterEvent) return false;
    if (filterLevel !== "all" && a.sponsorshipLevel !== filterLevel) return false;
    if (filterActivation !== "all") {
      const m = activationMap.get(`${a.sponsorId}:${a.eventId}`);
      if (filterActivation === "no-meetings") {
        if (!m || m.meetingsScheduled > 0) return false;
      } else {
        if (!m || m.activationLabel !== filterActivation) return false;
      }
    }
    return true;
  });

  const filteredOutstanding = outstandingItems.filter((item) => {
    if (searchOutstanding) {
      const q = searchOutstanding.toLowerCase();
      if (!item.deliverableName.toLowerCase().includes(q) &&
          !item.sponsorName.toLowerCase().includes(q) &&
          !item.eventName.toLowerCase().includes(q)) return false;
    }
    if (filterOutstandingEvent !== "all" && item.eventId !== filterOutstandingEvent) return false;
    if (filterOutstandingStatus !== "all" && item.status !== filterOutstandingStatus) return false;
    if (showOverdueOnly && !item.isOverdue) return false;
    return true;
  });

  type OutstandingGroup = { sponsorId: string; eventId: string; sponsorName: string; eventName: string; sponsorshipLevel: string; items: typeof filteredOutstanding; lastReminderSent: string | null };
  const outstandingGroups: OutstandingGroup[] = [];
  const seen = new Set<string>();
  for (const item of filteredOutstanding) {
    const key = `${item.sponsorId}|${item.eventId}`;
    if (!seen.has(key)) {
      seen.add(key);
      outstandingGroups.push({ sponsorId: item.sponsorId, eventId: item.eventId, sponsorName: item.sponsorName, eventName: item.eventName, sponsorshipLevel: item.sponsorshipLevel, items: [], lastReminderSent: item.lastReminderSent });
    }
    outstandingGroups.find(g => g.sponsorId === item.sponsorId && g.eventId === item.eventId)!.items.push(item);
  }

  const overdueCount = outstandingItems.filter(i => i.isOverdue).length;
  const uniqueSponsorCount = new Set(outstandingItems.map(i => i.sponsorId)).size;
  const awaitingSponsorTotal = agreements.reduce((s, a) => s + a.awaitingSponsorCount, 0);

  const STATUS_COLORS: Record<string, string> = {
    "Awaiting Sponsor Input": "bg-amber-50 text-amber-700 border-amber-200",
    "Not Started": "bg-muted text-muted-foreground",
    "Needed": "bg-amber-50 text-amber-700 border-amber-200",
    "Issue Identified": "bg-red-50 text-red-700 border-red-200",
    "Blocked": "bg-red-50 text-red-700 border-red-200",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-accent" />
            Deliverables
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage live sponsor agreements, fulfillment queue, and outstanding sponsor items.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            size="sm"
            onClick={() => setShowGenerateDialog(true)}
            variant="outline"
            data-testid="button-generate-agreement"
          >
            <Users className="h-4 w-4 mr-1.5" /> Generate Agreement
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Sponsor Agreements", value: agreements.length, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Awaiting Sponsor Input", value: awaitingSponsorTotal, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Outstanding Items", value: outstandingItems.length, color: "text-orange-600", bg: "bg-orange-50" },
          { label: "Overdue Deliverables", value: overdueCount, color: "text-red-600", bg: "bg-red-50" },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-4 shadow-sm">
            <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", bg)}>
              <ClipboardList className={cn("h-5 w-5", color)} />
            </div>
            <div>
              <p className="text-2xl font-display font-bold text-foreground">{value}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-10">
          <TabsTrigger value="sponsor-agreements" className="gap-2" data-testid="tab-sponsor-agreements">
            <Users className="h-4 w-4" /> Sponsor Agreements
          </TabsTrigger>
          <TabsTrigger value="fulfillment-queue" className="gap-2" data-testid="tab-fulfillment-queue">
            <Layers className="h-4 w-4" /> Fulfillment Queue
          </TabsTrigger>
          <TabsTrigger value="outstanding" className="gap-2" data-testid="tab-outstanding">
            <AlertCircle className="h-4 w-4" /> Outstanding Items
          </TabsTrigger>
        </TabsList>

        {/* ── Sponsor Agreements ── */}
        <TabsContent value="sponsor-agreements" className="mt-4 space-y-4">
          {/* Event tab strip — soonest active event first, only events with agreements */}
          {eventsWithAgreements.length > 0 && (
            <div className="overflow-x-auto pb-1">
              <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
                {eventsWithAgreements.map((ev) => {
                  const isActive = filterEvent === ev.id;
                  const count = agreements.filter(a => a.eventId === ev.id).length;
                  return (
                    <button
                      key={ev.id}
                      onClick={() => setFilterEvent(ev.id)}
                      className={cn(
                        "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                        isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                      )}
                      style={isActive ? { backgroundColor: ev.accentColor ?? ev.primaryColor ?? "#0D9488", color: "#ffffff" } : undefined}
                      data-testid={`tab-event-${ev.id}`}
                    >
                      {ev.slug ?? ev.name} ({count})
                    </button>
                  );
                })}
                <button
                  onClick={() => setFilterEvent("all")}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    filterEvent === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  style={filterEvent === "all" ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
                  data-testid="tab-event-all"
                >
                  All Events
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by sponsor or event..."
                className="pl-9"
                value={searchAgreements}
                onChange={(e) => setSearchAgreements(e.target.value)}
                data-testid="input-search-agreements"
              />
            </div>
            <Select value={filterLevel} onValueChange={setFilterLevel}>
              <SelectTrigger className="w-36" data-testid="select-filter-level-agr">
                <SelectValue placeholder="All Levels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Levels</SelectItem>
                {["Platinum", "Gold", "Silver", "Bronze"].map((l) => (
                  <SelectItem key={l} value={l}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterActivation} onValueChange={setFilterActivation}>
              <SelectTrigger className="w-44" data-testid="select-filter-activation">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Activation</SelectItem>
                <SelectItem value="Fully Activated">Fully Activated</SelectItem>
                <SelectItem value="Active">Active</SelectItem>
                <SelectItem value="At Risk">At Risk</SelectItem>
                <SelectItem value="Inactive">Inactive</SelectItem>
                <SelectItem value="no-meetings">No Meetings Scheduled</SelectItem>
              </SelectContent>
            </Select>
            <a href="/api/agreement/activation-metrics/export.csv" download data-testid="link-export-csv">
              <Button variant="outline" size="sm" className="h-9 gap-1.5">
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            </a>
          </div>

          {agrLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading...
            </div>
          ) : filteredAgreements.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <Users className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">No sponsor agreements yet</p>
              <p className="text-xs text-center max-w-xs">
                Use the "Generate Agreement" button to create deliverables for a sponsor from a package template.
              </p>
              <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Generate Agreement
              </Button>
            </div>
          ) : (
            <div className="bg-white border border-border rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-sm min-w-[900px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    {["Sponsor", "Event", "Level", "Completion", "Activation", "Meetings", "Last Login", "Actions"].map((h) => (
                      <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredAgreements.map((a) => {
                    const metric = activationMap.get(`${a.sponsorId}:${a.eventId}`);
                    const completionPct = metric?.completionPct ?? (a.totalDeliverables > 0 ? Math.round((a.deliveredCount / a.totalDeliverables) * 100) : 0);
                    return (
                      <tr key={`${a.sponsorId}-${a.eventId}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors" data-testid={`row-agreement-${a.sponsorId}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{a.sponsorName}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{a.eventName}</td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", LEVEL_COLORS[a.sponsorshipLevel] ?? "bg-muted text-muted-foreground")}>
                            {a.sponsorshipLevel === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                            {a.sponsorshipLevel}
                          </span>
                        </td>
                        <td className="px-4 py-3 w-32">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={cn("h-full rounded-full transition-all", completionPct >= 80 ? "bg-green-500" : completionPct >= 50 ? "bg-blue-500" : completionPct >= 25 ? "bg-amber-500" : "bg-red-400")}
                                style={{ width: `${completionPct}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-foreground shrink-0">{completionPct}%</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{a.deliveredCount}/{a.totalDeliverables} items</p>
                        </td>
                        <td className="px-4 py-3">
                          {metric ? (
                            <div className="flex flex-col gap-1">
                              <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border w-fit", ACTIVATION_COLORS[metric.activationLabel] ?? "bg-muted text-muted-foreground")}>
                                {metric.activationLabel}
                              </span>
                              <span className="text-[11px] text-muted-foreground font-medium">{metric.activationScore}/100</span>
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {metric ? (
                            <div className="text-xs">
                              <span className="font-medium text-foreground">{metric.meetingsScheduled}</span>
                              <span className="text-muted-foreground"> sched.</span>
                              {metric.meetingsCompleted > 0 && <span className="text-green-600 ml-1">{metric.meetingsCompleted} done</span>}
                            </div>
                          ) : <span className="text-muted-foreground text-xs">—</span>}
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {metric?.lastLoginAt ? (
                            <span className="text-foreground">{format(new Date(metric.lastLoginAt), "MMM d, yyyy")}</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                              <AlertCircle className="h-3 w-3" /> Never
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1" onClick={() => nav(`/admin/agreement/sponsor-agreements/${a.sponsorId}/${a.eventId}`)} data-testid={`button-open-agreement-${a.sponsorId}`}>
                            <Eye className="h-3 w-3" /> Open
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        {/* ── Fulfillment Queue ── */}
        <TabsContent value="fulfillment-queue" className="mt-4">
          <FulfillmentQueueTab initialPreset={initialPreset} />
        </TabsContent>

        {/* ── Outstanding Items ── */}
        <TabsContent value="outstanding" className="mt-4 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Outstanding Items", value: outstandingItems.length, color: "text-amber-600", bg: "bg-amber-50" },
              { label: "Overdue", value: overdueCount, color: "text-red-600", bg: "bg-red-50" },
              { label: "Sponsors Affected", value: uniqueSponsorCount, color: "text-blue-600", bg: "bg-blue-50" },
            ].map(({ label, value, color, bg }) => (
              <div key={label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3 shadow-sm">
                <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", bg)}>
                  <AlertCircle className={cn("h-4 w-4", color)} />
                </div>
                <div>
                  <p className="text-xl font-display font-bold text-foreground">{value}</p>
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search sponsor, item…"
                value={searchOutstanding}
                onChange={e => setSearchOutstanding(e.target.value)}
                className="pl-8 h-8 text-sm"
                data-testid="input-search-outstanding"
              />
            </div>
            <Select value={filterOutstandingEvent} onValueChange={setFilterOutstandingEvent}>
              <SelectTrigger className="h-8 w-40 text-sm" data-testid="select-filter-outstanding-event">
                <SelectValue placeholder="All Events" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Events</SelectItem>
                {events.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterOutstandingStatus} onValueChange={setFilterOutstandingStatus}>
              <SelectTrigger className="h-8 w-44 text-sm" data-testid="select-filter-outstanding-status">
                <SelectValue placeholder="All Statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {["Awaiting Sponsor Input","Not Started","Needed","Issue Identified","Blocked"].map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant={showOverdueOnly ? "default" : "outline"}
              size="sm"
              className="h-8"
              onClick={() => setShowOverdueOnly(v => !v)}
              data-testid="button-filter-overdue"
            >
              <TriangleAlert className="h-3.5 w-3.5 mr-1" />
              Overdue Only
            </Button>
            <Button variant="ghost" size="sm" className="h-8" onClick={() => refetchOutstanding()} data-testid="button-refresh-outstanding">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>

          {outLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground gap-2">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span className="text-sm">Loading outstanding items…</span>
            </div>
          ) : outstandingGroups.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <CheckCircle2 className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">
                {outstandingItems.length === 0 ? "No outstanding sponsor items — all clear!" : "No items match the current filters"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {outstandingGroups.map((group) => {
                const pairKey = `${group.sponsorId}|${group.eventId}`;
                const reminderEligibleCount = group.items.filter(i => i.reminderEligible).length;
                return (
                  <div key={pairKey} className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between gap-3 px-4 py-3 bg-muted/40 border-b border-border">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-sm text-foreground truncate">{group.sponsorName}</span>
                            {group.sponsorshipLevel && (
                              <Badge variant="outline" className={cn("text-xs shrink-0", LEVEL_COLORS[group.sponsorshipLevel] || "")}>
                                {group.sponsorshipLevel}
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{group.eventName}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {group.lastReminderSent && (
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            Last reminder: {format(new Date(group.lastReminderSent), "MMM d")}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">{group.items.length} item{group.items.length !== 1 ? "s" : ""}</Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs gap-1"
                          disabled={reminderEligibleCount === 0 || sendingPair === pairKey || sendReminder.isPending}
                          onClick={() => {
                            setSendingPair(pairKey);
                            sendReminder.mutate({ sponsorId: group.sponsorId, eventId: group.eventId });
                          }}
                          data-testid={`button-send-reminder-${group.sponsorId}`}
                          title={reminderEligibleCount === 0 ? "No reminder-eligible items" : `Send reminder for ${reminderEligibleCount} item${reminderEligibleCount !== 1 ? "s" : ""}`}
                        >
                          {sendingPair === pairKey && sendReminder.isPending
                            ? <RefreshCw className="h-3 w-3 animate-spin" />
                            : <Send className="h-3 w-3" />}
                          Send Reminder
                          {reminderEligibleCount > 0 && <span className="ml-0.5 opacity-70">({reminderEligibleCount})</span>}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs gap-1"
                          onClick={() => nav(`/admin/agreement/sponsor-agreements/${group.sponsorId}/${group.eventId}`)}
                          data-testid={`button-view-agreement-${group.sponsorId}`}
                        >
                          <Eye className="h-3 w-3" /> View
                        </Button>
                      </div>
                    </div>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Item</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden md:table-cell">Category</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Type</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground">Status</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Due</th>
                          <th className="text-left px-4 py-2 text-xs font-semibold text-muted-foreground hidden lg:table-cell">Reminder Eligible</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id} className={cn("border-b border-border/50 last:border-0", item.isOverdue && "bg-red-50/40")}>
                            <td className="px-4 py-2.5">
                              <span className="font-medium text-foreground">{item.deliverableName}</span>
                              {item.isOverdue && (
                                <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] font-bold text-red-600 bg-red-100 px-1.5 py-0.5 rounded-full">
                                  <TriangleAlert className="h-2.5 w-2.5" /> OVERDUE
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell">{item.category}</td>
                            <td className="px-4 py-2.5 text-xs hidden lg:table-cell">
                              {(() => {
                                const dt = getDeliverableType(item.deliverableName);
                                if (!dt) return <span className="text-muted-foreground/50">—</span>;
                                const labels: Record<string, { label: string; color: string }> = {
                                  speaking: { label: "Speaking", color: "bg-purple-50 text-purple-700" },
                                  registrations: { label: "Registrations", color: "bg-cyan-50 text-cyan-700" },
                                  social_graphics: { label: "Social Graphics", color: "bg-indigo-50 text-indigo-700" },
                                  social_announcements: { label: "Social Posts", color: "bg-violet-50 text-violet-700" },
                                  attendee_list: { label: "Attendee List", color: "bg-blue-50 text-blue-700" },
                                  coi: { label: "Insurance", color: "bg-slate-100 text-slate-700" },
                                };
                                const cfg = labels[dt];
                                return cfg ? <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap", cfg.color)} data-testid={`badge-type-${item.id}`}>{cfg.label}</span> : null;
                              })()}
                            </td>
                            <td className="px-4 py-2.5">
                              <Badge variant="outline" className={cn("text-xs", STATUS_COLORS[item.status] || "")}>
                                {item.status}
                              </Badge>
                            </td>
                            <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                              {item.dueDate
                                ? <span className={item.isOverdue ? "text-red-600 font-semibold" : ""}>{format(new Date(item.dueDate), "MMM d, yyyy")}</span>
                                : item.dueTiming && item.dueTiming !== "not_applicable"
                                  ? item.dueTiming.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
                                  : <span className="text-muted-foreground/50">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-xs hidden lg:table-cell">
                              {item.reminderEligible
                                ? <span className="text-green-600 font-medium">Yes</span>
                                : <span className="text-muted-foreground">No</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Generate Agreement Dialog */}
      <Dialog open={showGenerateDialog} onOpenChange={setShowGenerateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Sponsor Agreement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Select a sponsor, event, and package template to generate the agreement deliverables.
            </p>
            <div className="space-y-1.5">
              <Label>Sponsor</Label>
              <Select value={genSponsorId} onValueChange={setGenSponsorId}>
                <SelectTrigger data-testid="select-gen-sponsor">
                  <SelectValue placeholder="Select sponsor..." />
                </SelectTrigger>
                <SelectContent>
                  {sponsors.filter((s) => (s.archiveState ?? "active") === "active").map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Event</Label>
              <Select value={genEventId} onValueChange={setGenEventId}>
                <SelectTrigger data-testid="select-gen-event">
                  <SelectValue placeholder="Select event..." />
                </SelectTrigger>
                <SelectContent>
                  {events.map((e) => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Package Template</Label>
              <Select value={genTemplateId} onValueChange={(v) => {
                setGenTemplateId(v);
                const tpl = templates.find((t) => t.id === v);
                if (tpl) setGenLevel(tpl.sponsorshipLevel);
              }}>
                <SelectTrigger data-testid="select-gen-template">
                  <SelectValue placeholder="Select template..." />
                </SelectTrigger>
                <SelectContent>
                  {templates.filter((t) => !t.isArchived).map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.packageName} ({t.deliverableCount} items)</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {genLevel && (
              <p className="text-xs text-muted-foreground">
                Sponsorship level will be set to: <strong>{genLevel}</strong>
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateDialog(false)}>Cancel</Button>
            <Button
              onClick={() => generateAgreement.mutate({ sponsorId: genSponsorId, eventId: genEventId, packageTemplateId: genTemplateId, sponsorshipLevel: genLevel })}
              disabled={!genSponsorId || !genEventId || !genTemplateId || generateAgreement.isPending}
              data-testid="button-submit-generate"
            >
              Generate Deliverables
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
