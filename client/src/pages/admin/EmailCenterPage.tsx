import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { EmailLog, Event, Sponsor, EmailTemplate, EmailTemplateVersion, ScheduledEmail, AutomationRule, AutomationLog, Campaign, EmailSettings } from "@shared/schema";
import { CAMPAIGN_STATUSES, CAMPAIGN_AUDIENCE_TYPES } from "@shared/schema";
import { EMAIL_TEMPLATE_CATEGORIES } from "@shared/schema";

const EMAIL_SOURCE_OPTIONS = [
  "System Action",
  "Manual",
  "Campaign",
  "Automation – Deliverable Reminder",
  "Automation – Meeting Reminder",
  "Automation – Scheduling Invitation",
] as const;
import { SCHEDULED_EMAIL_STATUSES } from "@shared/schema";
import {
  Mail, MailCheck, MailX, RefreshCw, Send, Search, Eye,
  FlaskConical, Building2, User, AlertCircle, CheckCircle2,
  Clock, CalendarDays, X, RotateCcw, ChevronRight, Code,
  Settings2, Edit2, FileText, Layout, Plus, Pencil, Trash2, Ban,
  Timer, History, Tag, Filter, Undo2, Zap, Power, PauseCircle,
  PlayCircle, ToggleLeft, ToggleRight, Activity, Info, Megaphone,
  Users, ChevronDown, Shield, Gauge, BarChart3, Save, Pause, Play,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// ── Constants ──────────────────────────────────────────────────────────────────

const EMAIL_TYPE_LABELS: Record<string, string> = {
  meeting_confirmation_attendee: "Meeting Confirmation",
  meeting_notification_sponsor: "Sponsor Meeting Alert",
  meeting_reminder_24: "Reminder (24h)",
  meeting_reminder_2: "Reminder (2h)",
  info_request_notification_sponsor: "Info Request Alert",
  info_request_confirmation_attendee: "Info Request Confirmation",
  scheduling_invitation: "Scheduling Invitation",
  sponsor_report: "Sponsor Report",
  admin_alert: "Admin Alert",
  test_email: "Test Email",
  password_reset: "Password Reset",
  sponsor_magic_login: "Sponsor Magic Login",
};

const EMAIL_TYPES = Object.keys(EMAIL_TYPE_LABELS);

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  sent:      { label: "Sent",      className: "bg-teal-100 text-teal-700 border-teal-200",     icon: <MailCheck className="h-3 w-3" /> },
  failed:    { label: "Failed",    className: "bg-red-100 text-red-700 border-red-200",         icon: <MailX className="h-3 w-3" /> },
  queued:    { label: "Queued",    className: "bg-amber-100 text-amber-700 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
  delivered: { label: "Delivered", className: "bg-blue-100 text-blue-700 border-blue-200",      icon: <MailCheck className="h-3 w-3" /> },
  opened:    { label: "Opened",    className: "bg-purple-100 text-purple-700 border-purple-200",icon: <Eye className="h-3 w-3" /> },
  clicked:   { label: "Clicked",   className: "bg-indigo-100 text-indigo-700 border-indigo-200",icon: <ChevronRight className="h-3 w-3" /> },
  bounced:   { label: "Bounced",   className: "bg-orange-100 text-orange-700 border-orange-200",icon: <RotateCcw className="h-3 w-3" /> },
};

function fmtSentAt(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border", icon: <Mail className="h-3 w-3" /> };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border", cfg.className)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const label = EMAIL_TYPE_LABELS[type] ?? type.replace(/_/g, " ");
  const colorMap: Record<string, string> = {
    meeting_confirmation_attendee: "bg-sky-100 text-sky-700 border-sky-200",
    meeting_notification_sponsor: "bg-violet-100 text-violet-700 border-violet-200",
    info_request_notification_sponsor: "bg-amber-100 text-amber-700 border-amber-200",
    info_request_confirmation_attendee: "bg-teal-100 text-teal-700 border-teal-200",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border", colorMap[type] ?? "bg-muted text-muted-foreground border-border")}>
      {label}
    </span>
  );
}

// ── Email Templates Tab Component ─────────────────────────────────────────────

function fmtUpdatedAt(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit", hour12: true });
}

const CATEGORY_COLORS: Record<string, string> = {
  System: "bg-blue-50 text-blue-700 border-blue-200",
  Operational: "bg-violet-50 text-violet-700 border-violet-200",
  Campaign: "bg-amber-50 text-amber-700 border-amber-200",
};

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? "bg-muted text-muted-foreground border-border";
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", colors)}>
      <Tag className="h-2.5 w-2.5" /> {category}
    </span>
  );
}

const VARIABLE_GROUPS: Record<string, string[]> = {
  Attendee: ["attendee_first_name", "attendee_full_name", "attendee_email", "recipient_first_name", "recipient_email"],
  Sponsor: ["sponsor_name", "sponsor_user_name", "sponsor_dashboard_url"],
  Event: ["event_name", "event_code", "event_schedule_url", "scheduling_url", "app_name"],
  Meeting: ["meeting_date", "meeting_time", "meeting_location", "meeting_type", "status"],
  System: ["user_name", "reset_url", "magic_link_url"],
};

function groupVariable(v: string): string {
  for (const [group, vars] of Object.entries(VARIABLE_GROUPS)) {
    if (vars.includes(v)) return group;
  }
  return "Other";
}

function TemplateVariables({ variables }: { variables: string[] }) {
  if (!variables || variables.length === 0) return null;
  const grouped: Record<string, string[]> = {};
  for (const v of variables) {
    const g = groupVariable(v);
    if (!grouped[g]) grouped[g] = [];
    grouped[g].push(v);
  }
  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Variables</label>
      {Object.entries(grouped).map(([group, vars]) => (
        <div key={group} className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest">{group}</p>
          <div className="flex flex-wrap gap-1.5">
            {vars.map((v) => (
              <code key={v} className="px-2 py-1 rounded bg-muted text-[10px] font-mono text-accent border border-border/40">
                {"{{"}{v}{"}}"}
              </code>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function VersionHistoryPanel({ templateId, onRestore }: { templateId: string; onRestore: () => void }) {
  const { toast } = useToast();
  const { data: versions = [], isLoading } = useQuery<EmailTemplateVersion[]>({
    queryKey: ["/api/admin/email-templates", templateId, "versions"],
    queryFn: () => fetch(`/api/admin/email-templates/${templateId}/versions`).then((r) => r.json()),
    enabled: !!templateId,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmRestore, setConfirmRestore] = useState<EmailTemplateVersion | null>(null);

  const restoreMutation = useMutation({
    mutationFn: async (versionId: string) => {
      const res = await apiRequest("POST", `/api/admin/email-templates/${templateId}/restore/${versionId}`);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Version restored successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates", templateId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates", templateId, "versions"] });
      setConfirmRestore(null);
      onRestore();
    },
    onError: (err: Error) => toast({ title: "Restore failed", description: err.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground text-sm">Loading version history...</div>;
  if (versions.length === 0) return <div className="text-center py-8 text-muted-foreground text-sm">No previous versions yet. Versions are created when you save changes.</div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{versions.length} previous version{versions.length !== 1 ? "s" : ""}</p>
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {versions.map((v) => (
          <div key={v.id} className="rounded-lg border border-border/50 bg-muted/10 overflow-hidden">
            <div className="px-3 py-2 flex items-center justify-between cursor-pointer hover:bg-muted/20 transition-colors" onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-accent shrink-0">v{v.version}</span>
                <span className="text-xs text-muted-foreground truncate">{fmtUpdatedAt(v.createdAt)}</span>
                {v.updatedBy && <span className="text-[10px] text-muted-foreground/70 truncate">by {v.updatedBy}</span>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={(e) => { e.stopPropagation(); setConfirmRestore(v); }} data-testid={`restore-version-${v.id}`}>
                  <Undo2 className="h-3 w-3" /> Restore
                </Button>
                <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expandedId === v.id && "rotate-90")} />
              </div>
            </div>
            {expandedId === v.id && (
              <div className="px-3 pb-3 space-y-2 border-t border-border/30 pt-2">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{v.displayName}</span></div>
                  <div><span className="text-muted-foreground">Category:</span> <CategoryBadge category={v.category} /></div>
                  <div><span className="text-muted-foreground">Status:</span> {v.isActive ? "Active" : "Inactive"}</div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] text-muted-foreground font-semibold">Subject</p>
                  <p className="text-xs font-mono bg-muted/40 rounded px-2 py-1 border border-border/30">{v.subjectTemplate}</p>
                </div>
                {v.htmlTemplate?.trim() && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground font-semibold">HTML Body</p>
                    <pre className="text-[10px] font-mono bg-muted/40 rounded px-2 py-1 border border-border/30 max-h-[120px] overflow-y-auto whitespace-pre-wrap">{v.htmlTemplate}</pre>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <AlertDialog open={!!confirmRestore} onOpenChange={(open) => { if (!open) setConfirmRestore(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restore Version {confirmRestore?.version}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will save the current template as a new version in the history, then restore the content from version {confirmRestore?.version}. No history will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmRestore && restoreMutation.mutate(confirmRestore.id)} disabled={restoreMutation.isPending}>
              {restoreMutation.isPending ? "Restoring…" : "Restore Version"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmailTemplatesTab() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "view" | "edit">(null);
  const [panelTab, setPanelTab] = useState<"details" | "versions">("details");
  const [editState, setEditState] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<"code" | "custom" | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendTestDialogTemplate, setSendTestDialogTemplate] = useState<EmailTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const filteredTemplates = useMemo(() => {
    let list = templates;
    if (categoryFilter !== "all") {
      list = list.filter((t) => t.category === categoryFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter((t) =>
        t.displayName.toLowerCase().includes(q) ||
        t.templateKey.toLowerCase().includes(q) ||
        (t.description ?? "").toLowerCase().includes(q)
      );
    }
    return list;
  }, [templates, categoryFilter, searchQuery]);

  const { data: freshTemplate, isLoading: isFetchingFresh } = useQuery<EmailTemplate>({
    queryKey: ["/api/admin/email-templates", selectedId],
    queryFn: () => fetch(`/api/admin/email-templates/${selectedId}`).then((r) => r.json()),
    enabled: !!selectedId,
    staleTime: 0,
  });

  useEffect(() => {
    if (mode === "edit" && freshTemplate) {
      setEditState({ ...freshTemplate });
    }
  }, [freshTemplate, mode]);

  const openView = (t: EmailTemplate) => {
    setSelectedId(t.id);
    setMode("view");
    setPanelTab("details");
    setPreviewHtml(null);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditState({ ...t });
    setSelectedId(t.id);
    setMode("edit");
    setPanelTab("details");
    setPreviewHtml(null);
  };

  const switchToEdit = () => {
    if (freshTemplate) setEditState({ ...freshTemplate });
    setMode("edit");
    setPanelTab("details");
    setPreviewHtml(null);
  };

  const closePanel = () => {
    setSelectedId(null);
    setMode(null);
    setEditState(null);
    setPreviewHtml(null);
    setPanelTab("details");
  };

  const updateMutation = useMutation({
    mutationFn: async (values: Partial<EmailTemplate>) => {
      const res = await apiRequest("PATCH", `/api/admin/email-templates/${selectedId}`, values);
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Template updated successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates", selectedId] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-templates", selectedId, "versions"] });
      setMode("view");
    },
    onError: (err: Error) => toast({ title: "Update failed", description: err.message, variant: "destructive" }),
  });

  const previewMutation = useMutation({
    mutationFn: async () => {
      const body = mode === "edit" && editState
        ? { htmlTemplate: editState.htmlTemplate, subjectTemplate: editState.subjectTemplate }
        : undefined;
      const res = await apiRequest("POST", `/api/admin/email-templates/${selectedId}/preview`, body);
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewHtml(data.html);
      setPreviewSubject(data.subject);
      setPreviewSource(data.source ?? null);
    },
    onError: (err: Error) => toast({ title: "Preview failed", description: err.message, variant: "destructive" }),
  });

  const sendTestMutation = useMutation({
    mutationFn: async (args?: { templateId?: string; recipientEmail?: string }) => {
      const tid = args?.templateId ?? selectedId;
      const email = args?.recipientEmail ?? testEmail;
      const res = await apiRequest("POST", `/api/admin/email-templates/${tid}/send-test`, { email });
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: data.ok ? "Test email sent" : "Test failed",
        description: data.ok ? "Sent successfully" : data.message,
        variant: data.ok ? "default" : "destructive",
      });
      setSendTestDialogTemplate(null);
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const panelOpen = mode === "view" || mode === "edit";
  const viewData = freshTemplate ?? templates.find((t) => t.id === selectedId);

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-280px)]">
      {/* Filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search by name, key, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
            data-testid="input-template-search"
          />
        </div>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-9 rounded-md border border-border bg-card px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            data-testid="select-template-category-filter"
          >
            <option value="all">All Categories</option>
            {EMAIL_TEMPLATE_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-6 flex-1 min-h-0">
        {/* Template List */}
        <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden flex flex-col transition-all duration-300", panelOpen ? "w-[40%]" : "w-full")}>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 bg-muted/30">
                  {!panelOpen && <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Category</th>}
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Display Name</th>
                  {!panelOpen && <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Key</th>}
                  {!panelOpen && <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Subject</th>}
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                  {!panelOpen && <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Last Updated</th>}
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Loading templates...</td></tr>
                ) : filteredTemplates.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">{searchQuery || categoryFilter !== "all" ? "No templates match your filters." : "No templates found."}</td></tr>
                ) : (
                  filteredTemplates.map((t) => (
                    <tr key={t.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", selectedId === t.id && "bg-accent/5")}>
                      {!panelOpen && <td className="px-4 py-3"><CategoryBadge category={t.category} /></td>}
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium">{t.displayName}</p>
                          {panelOpen && <p className="text-[10px] text-muted-foreground mt-0.5"><CategoryBadge category={t.category} /></p>}
                        </div>
                      </td>
                      {!panelOpen && <td className="px-4 py-3 text-xs font-mono text-muted-foreground">{t.templateKey}</td>}
                      {!panelOpen && <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[200px]">{t.subjectTemplate}</td>}
                      <td className="px-4 py-3">
                        <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", t.isActive ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-muted text-muted-foreground border-border")}>
                          {t.isActive ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {!panelOpen && <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtUpdatedAt(t.updatedAt)}</td>}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" title="View template" onClick={() => openView(t)} className="h-8 w-8 p-0" data-testid={`view-template-${t.id}`}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Edit template" onClick={() => openEdit(t)} className="h-8 w-8 p-0" data-testid={`edit-template-${t.id}`}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" title="Send test email" onClick={() => setSendTestDialogTemplate(t)} className="h-8 w-8 p-0" data-testid={`send-test-template-${t.id}`}>
                            <FlaskConical className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* View / Edit Panel */}
        <AnimatePresence>
          {panelOpen && viewData && (
            <motion.div
              key="template-panel"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex-1 bg-card rounded-2xl border border-border/60 shadow-lg overflow-hidden flex flex-col"
            >
              {/* Panel header */}
              <div className="p-4 border-b border-border/40 bg-muted/30 flex items-center justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-display font-bold text-foreground truncate">
                      {mode === "view" ? "View Template" : "Edit Template"}
                    </h3>
                    {isFetchingFresh && <div className="h-3.5 w-3.5 rounded-full border-2 border-accent border-t-transparent animate-spin shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{viewData.displayName} · <span className="font-mono">{viewData.templateKey}</span></p>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-3">
                  {mode === "view" && (
                    <Button variant="outline" size="sm" onClick={switchToEdit} className="gap-1.5 h-8 text-xs">
                      <Edit2 className="h-3 w-3" /> Edit Template
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={closePanel} className="h-8 w-8">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Panel tabs */}
              <div className="flex border-b border-border/40 bg-muted/10 px-4">
                <button
                  className={cn("px-4 py-2 text-xs font-semibold border-b-2 transition-colors", panelTab === "details" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => setPanelTab("details")}
                  data-testid="tab-template-details"
                >
                  Details
                </button>
                <button
                  className={cn("px-4 py-2 text-xs font-semibold border-b-2 transition-colors flex items-center gap-1.5", panelTab === "versions" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
                  onClick={() => setPanelTab("versions")}
                  data-testid="tab-template-versions"
                >
                  <History className="h-3 w-3" /> Version History
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {panelTab === "versions" && selectedId && (
                  <VersionHistoryPanel templateId={selectedId} onRestore={() => setPanelTab("details")} />
                )}

                {panelTab === "details" && (
                  <>
                    {/* View Mode */}
                    {mode === "view" && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</p>
                            <p className="text-sm font-medium">{viewData.displayName}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</p>
                            <CategoryBadge category={viewData.category} />
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template Key</p>
                            <p className="text-sm font-mono text-muted-foreground">{viewData.templateKey}</p>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
                            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", viewData.isActive ? "bg-teal-50 text-teal-700 border-teal-200" : "bg-muted text-muted-foreground border-border")}>
                              {viewData.isActive ? "Active" : "Inactive"}
                            </span>
                          </div>
                          <div className="space-y-1 col-span-2">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Updated</p>
                            <p className="text-xs text-muted-foreground">{fmtUpdatedAt(viewData.updatedAt)}</p>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject Template</p>
                          <p className="text-sm font-mono bg-muted/40 rounded-lg px-3 py-2 border border-border/40">{viewData.subjectTemplate}</p>
                        </div>

                        {viewData.description && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</p>
                            <p className="text-sm text-muted-foreground">{viewData.description}</p>
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">HTML Body</p>
                          {viewData.htmlTemplate?.trim() ? (
                            <pre className="text-xs font-mono bg-muted/40 rounded-lg px-3 py-2 border border-border/40 overflow-x-auto whitespace-pre-wrap max-h-[200px] overflow-y-auto">{viewData.htmlTemplate}</pre>
                          ) : (
                            <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-3 flex items-center gap-2 text-muted-foreground">
                              <Code className="h-4 w-4 shrink-0" />
                              <p className="text-xs">No custom HTML body stored. Live emails use the code-rendered template.</p>
                            </div>
                          )}
                        </div>

                        <TemplateVariables variables={viewData.variables} />
                      </>
                    )}

                    {/* Edit Mode */}
                    {mode === "edit" && editState && (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</label>
                            <Input
                              value={editState.displayName}
                              onChange={(e) => setEditState({ ...editState, displayName: e.target.value })}
                              className="h-9"
                              data-testid="input-template-displayname"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</label>
                            <select
                              value={editState.category}
                              onChange={(e) => setEditState({ ...editState, category: e.target.value })}
                              className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
                              data-testid="select-template-category"
                            >
                              {EMAIL_TEMPLATE_CATEGORIES.map((c) => (
                                <option key={c} value={c}>{c}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="space-y-1.5 flex-1">
                            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                            <div className="flex items-center gap-2 h-9">
                              <Button variant={editState.isActive ? "default" : "outline"} size="sm" onClick={() => setEditState({ ...editState, isActive: true })} className="flex-1">Active</Button>
                              <Button variant={!editState.isActive ? "default" : "outline"} size="sm" onClick={() => setEditState({ ...editState, isActive: false })} className="flex-1">Inactive</Button>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Subject Template</label>
                          <Input
                            value={editState.subjectTemplate}
                            onChange={(e) => setEditState({ ...editState, subjectTemplate: e.target.value })}
                            className="h-9 font-mono text-sm"
                            data-testid="input-template-subject"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">HTML Body</label>
                          {!editState.htmlTemplate?.trim() && (
                            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-2">
                              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                              <p className="text-xs">No custom HTML body stored yet. Enter HTML below to override the code-rendered template.</p>
                            </div>
                          )}
                          <Textarea
                            value={editState.htmlTemplate ?? ""}
                            onChange={(e) => setEditState({ ...editState, htmlTemplate: e.target.value })}
                            className="min-h-[240px] font-mono text-xs leading-relaxed"
                            placeholder="<!-- Enter custom HTML here, or leave blank to use the code-rendered template -->"
                            data-testid="textarea-template-html"
                          />
                        </div>

                        <div className="space-y-1.5">
                          <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
                          <Textarea
                            value={editState.description ?? ""}
                            onChange={(e) => setEditState({ ...editState, description: e.target.value })}
                            className="min-h-[80px] text-sm"
                          />
                        </div>

                        <TemplateVariables variables={editState.variables} />
                      </>
                    )}

                    {/* Preview Section */}
                    {previewHtml && (
                      <div className="space-y-3 pt-4 border-t border-border/40">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-bold flex items-center gap-2"><Eye className="h-4 w-4 text-accent" /> Preview</h4>
                          <Button variant="ghost" size="sm" onClick={() => setPreviewHtml(null)} className="h-7 text-xs">Hide</Button>
                        </div>
                        {previewSource && (
                          <div className={cn("rounded-lg px-3 py-2 flex items-center gap-2 text-xs border",
                            previewSource === "code"
                              ? "bg-blue-50 dark:bg-blue-950/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                              : "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800"
                          )}>
                            <Code className="h-3.5 w-3.5 shrink-0" />
                            <span className="font-medium">
                              Preview Source: {previewSource === "code" ? "Code-Rendered Template" : "Custom HTML Override"}
                            </span>
                          </div>
                        )}
                        <div className="rounded-lg border border-border/60 bg-muted/10 p-3 space-y-2">
                          <p className="text-xs font-mono"><strong>Subject:</strong> {previewSubject}</p>
                          <div className="rounded border border-border/40 bg-white overflow-hidden">
                            <iframe srcDoc={previewHtml} className="w-full h-[380px]" title="Template Preview" sandbox="allow-same-origin" />
                          </div>
                        </div>

                        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 space-y-3">
                          <p className="text-xs font-bold text-accent uppercase tracking-wider">Send Test Email</p>
                          <div className="flex gap-2">
                            <Input placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="h-9 flex-1" data-testid="input-preview-test-email" />
                            <Button size="sm" disabled={!testEmail || sendTestMutation.isPending} onClick={() => sendTestMutation.mutate()} className="gap-2" data-testid="button-preview-send-test">
                              <Send className="h-3.5 w-3.5" /> Send
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Panel footer */}
              {panelTab === "details" && (
                <div className="p-4 border-t border-border/40 bg-muted/30 flex items-center justify-between">
                  <Button variant="outline" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} className="gap-2" data-testid="button-template-preview">
                    <Eye className="h-3.5 w-3.5" /> {previewMutation.isPending ? "Loading..." : "Preview"}
                  </Button>
                  {mode === "edit" && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => { setMode("view"); setPreviewHtml(null); }}>Cancel</Button>
                      <Button
                        size="sm"
                        onClick={() => editState && updateMutation.mutate({
                          displayName: editState.displayName,
                          category: editState.category,
                          subjectTemplate: editState.subjectTemplate,
                          htmlTemplate: editState.htmlTemplate,
                          description: editState.description,
                          isActive: editState.isActive,
                        })}
                        disabled={updateMutation.isPending || !editState}
                        className="gap-2"
                        data-testid="button-template-save"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> {updateMutation.isPending ? "Saving..." : "Save Changes"}
                      </Button>
                    </div>
                  )}
                  {mode === "view" && (
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={closePanel}>Close</Button>
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Send Test Email Dialog (from row action) */}
        <Dialog open={!!sendTestDialogTemplate} onOpenChange={(open) => { if (!open) setSendTestDialogTemplate(null); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FlaskConical className="h-5 w-5 text-accent" />
                Send Test Email
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Template</p>
                <p className="text-sm font-medium">{sendTestDialogTemplate?.displayName}</p>
                <p className="text-xs font-mono text-muted-foreground">{sendTestDialogTemplate?.templateKey}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recipient Email</label>
                <Input
                  placeholder="test@example.com"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  className="h-9"
                  data-testid="input-send-test-email"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setSendTestDialogTemplate(null)}>Cancel</Button>
              <Button
                size="sm"
                disabled={!testEmail.trim() || sendTestMutation.isPending}
                onClick={() => sendTestDialogTemplate && sendTestMutation.mutate({ templateId: sendTestDialogTemplate.id, recipientEmail: testEmail.trim() })}
                className="gap-2"
                data-testid="button-send-test-email"
              >
                <Send className="h-3.5 w-3.5" /> {sendTestMutation.isPending ? "Sending..." : "Send Test"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

// ── Automations Tab Component ─────────────────────────────────────────────────

const AUTOMATION_CATEGORY_COLORS: Record<string, string> = {
  Meeting: "bg-blue-100 text-blue-700 border-blue-200",
  "Info Requests": "bg-purple-100 text-purple-700 border-purple-200",
  Sponsor: "bg-amber-100 text-amber-700 border-amber-200",
  Attendee: "bg-green-100 text-green-700 border-green-200",
  System: "bg-gray-100 text-gray-700 border-gray-200",
};

function AutomationsTab() {
  const { toast } = useToast();
  const [selectedRule, setSelectedRule] = useState<AutomationRule | null>(null);

  const { data: rules = [], isLoading } = useQuery<AutomationRule[]>({
    queryKey: ["/api/admin/automations"],
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isEnabled }: { id: string; isEnabled: boolean }) => {
      const res = await apiRequest("PATCH", `/api/admin/automations/${id}`, { isEnabled });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automations"] });
    },
  });

  const pauseAllMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/automations/pause-all"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automations"] });
      toast({ title: "All automations paused" });
    },
  });

  const resumeAllMutation = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/automations/resume-all"); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/automations"] });
      toast({ title: "All automations resumed" });
    },
  });

  const allEnabled = rules.length > 0 && rules.every((r) => r.isEnabled);
  const allDisabled = rules.length > 0 && rules.every((r) => !r.isEnabled);
  const enabledCount = rules.filter((r) => r.isEnabled).length;

  const categories = useMemo(() => {
    const cats: Record<string, AutomationRule[]> = {};
    for (const r of rules) {
      if (!cats[r.category]) cats[r.category] = [];
      cats[r.category].push(r);
    }
    return cats;
  }, [rules]);

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "Never";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Zap className="h-6 w-6 text-accent" />
            Automations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage automated email workflows — toggle individual rules or pause everything at once.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-xs text-muted-foreground mr-2">
            <span className="font-semibold text-foreground">{enabledCount}</span> of {rules.length} active
          </div>
          {!allDisabled && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
              onClick={() => pauseAllMutation.mutate()}
              disabled={pauseAllMutation.isPending}
              data-testid="button-pause-all-automations"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Pause All
            </Button>
          )}
          {!allEnabled && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2 h-8 text-green-700 border-green-200 hover:bg-green-50"
              onClick={() => resumeAllMutation.mutate()}
              disabled={resumeAllMutation.isPending}
              data-testid="button-resume-all-automations"
            >
              <PlayCircle className="h-3.5 w-3.5" /> Resume All
            </Button>
          )}
        </div>
      </div>

      {allDisabled && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center gap-3" data-testid="banner-all-paused">
          <PauseCircle className="h-5 w-5 text-amber-600 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-amber-800">All automations are paused</p>
            <p className="text-xs text-amber-600 mt-0.5">No automated emails will be sent until automations are resumed.</p>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading automations…
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(categories).map(([category, catRules]) => (
            <div key={category}>
              <div className="flex items-center gap-2 mb-3">
                <span className={cn("text-xs font-semibold px-2.5 py-0.5 rounded-full border", AUTOMATION_CATEGORY_COLORS[category] || AUTOMATION_CATEGORY_COLORS.System)}>
                  {category}
                </span>
                <span className="text-xs text-muted-foreground">{catRules.length} rule{catRules.length !== 1 ? "s" : ""}</span>
              </div>
              <div className="rounded-xl border border-border/60 bg-card overflow-hidden divide-y divide-border/40">
                {catRules.map((rule) => (
                  <div key={rule.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors" data-testid={`automation-row-${rule.automationKey}`}>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground truncate">{rule.name}</p>
                        <span className={cn(
                          "text-[10px] px-1.5 py-0.5 rounded font-medium",
                          rule.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                        )}>
                          {rule.isEnabled ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        <span className="font-medium">Trigger:</span> {rule.triggerDescription}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><User className="h-3 w-3" /> {rule.audience}</span>
                        {rule.templateKey && (
                          <span className="flex items-center gap-1"><FileText className="h-3 w-3" /> {rule.templateKey}</span>
                        )}
                        <span className="flex items-center gap-1"><Settings2 className="h-3 w-3" /> {rule.eventScope}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-6 shrink-0">
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Last Run</p>
                        <p className="text-xs font-medium">{fmtDate(rule.lastRunAt)}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">Sent</p>
                        <p className="text-sm font-semibold">{rule.emailsSent}</p>
                      </div>
                      {(rule.failures ?? 0) > 0 && (
                        <div className="text-right">
                          <p className="text-xs text-red-500">Failures</p>
                          <p className="text-sm font-semibold text-red-600">{rule.failures}</p>
                        </div>
                      )}
                      <button
                        onClick={() => toggleMutation.mutate({ id: rule.id, isEnabled: !rule.isEnabled })}
                        className="focus:outline-none"
                        data-testid={`toggle-automation-${rule.automationKey}`}
                        disabled={toggleMutation.isPending}
                      >
                        {rule.isEnabled ? (
                          <ToggleRight className="h-7 w-7 text-green-500" />
                        ) : (
                          <ToggleLeft className="h-7 w-7 text-gray-400" />
                        )}
                      </button>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedRule(rule)} data-testid={`view-automation-${rule.automationKey}`}>
                        <Eye className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Sheet open={!!selectedRule} onOpenChange={(o) => { if (!o) setSelectedRule(null); }}>
        <SheetContent side="right" className="w-[520px] sm:max-w-[520px] flex flex-col">
          <SheetHeader className="pb-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-base font-display">
              <Zap className="h-4 w-4 text-accent" />
              Automation Detail
            </SheetTitle>
          </SheetHeader>
          {selectedRule && <AutomationDetailPanel rule={selectedRule} fmtDate={fmtDate} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function AutomationDetailPanel({ rule, fmtDate }: { rule: AutomationRule; fmtDate: (d: string | Date | null | undefined) => string }) {
  const { data: logs = [], isLoading } = useQuery<AutomationLog[]>({
    queryKey: ["/api/admin/automations", rule.id, "logs"],
  });

  return (
    <div className="flex-1 overflow-y-auto py-4 space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Name</p>
          <p className="text-sm font-semibold">{rule.name}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Category</p>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full border", AUTOMATION_CATEGORY_COLORS[rule.category] || AUTOMATION_CATEGORY_COLORS.System)}>
            {rule.category}
          </span>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Status</p>
          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded", rule.isEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500")}>
            {rule.isEnabled ? "Enabled" : "Disabled"}
          </span>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
          <p className="text-xs text-muted-foreground mb-1">Trigger</p>
          <p className="text-sm">{rule.triggerDescription}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Audience</p>
          <p className="text-sm">{rule.audience}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Event Scope</p>
          <p className="text-sm">{rule.eventScope}</p>
        </div>
        {rule.templateKey && (
          <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
            <p className="text-xs text-muted-foreground mb-1">Template</p>
            <p className="text-sm font-mono">{rule.templateKey}</p>
          </div>
        )}
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Last Run</p>
          <p className="text-sm">{fmtDate(rule.lastRunAt)}</p>
        </div>
        <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
          <p className="text-xs text-muted-foreground mb-1">Total Emails Sent</p>
          <p className="text-sm font-semibold">{rule.emailsSent}</p>
        </div>
        {(rule.failures ?? 0) > 0 && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-600 mb-1">Failures</p>
            <p className="text-sm font-semibold text-red-700">{rule.failures}</p>
          </div>
        )}
        {rule.lastError && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 col-span-2">
            <p className="text-xs text-red-600 mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Last Error</p>
            <p className="text-xs text-red-700 font-mono">{rule.lastError}</p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Execution History</p>
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4"><RefreshCw className="h-3 w-3 animate-spin" /> Loading…</div>
        ) : logs.length === 0 ? (
          <p className="text-xs text-muted-foreground py-4">No execution history yet.</p>
        ) : (
          <div className="rounded-lg border border-border/50 bg-muted/10 divide-y divide-border/30">
            {logs.slice(0, 10).map((log) => (
              <div key={log.id} className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", log.status === "success" ? "bg-green-500" : "bg-red-500")} />
                  <span className="text-xs text-muted-foreground">{fmtDate(log.executedAt)}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="text-foreground font-medium">{log.emailsSent} sent</span>
                  {(log.failures ?? 0) > 0 && <span className="text-red-600">{log.failures} failed</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!rule.isEnabled && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-700 flex items-center gap-1">
            <Info className="h-3 w-3" />
            This automation is currently disabled. No new emails will be triggered until it is re-enabled.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Campaigns Tab Component ─────────────────────────────────────────────────

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  Draft: "bg-gray-100 text-gray-700 border-gray-200",
  Scheduled: "bg-blue-100 text-blue-700 border-blue-200",
  Sending: "bg-amber-100 text-amber-700 border-amber-200",
  Sent: "bg-green-100 text-green-700 border-green-200",
  Cancelled: "bg-red-100 text-red-500 border-red-200",
};

interface AudiencePreview {
  count: number;
  preview: Array<{ id: string; name: string; email: string; company: string }>;
}

function CampaignsTab({ events, sponsors }: { events: Event[]; sponsors: Sponsor[] }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Campaign | null>(null);
  const [confirmSendTarget, setConfirmSendTarget] = useState<Campaign | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Campaign | null>(null);
  const [previewTarget, setPreviewTarget] = useState<Campaign | null>(null);
  const [audiencePreview, setAudiencePreview] = useState<AudiencePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEvent, setFilterEvent] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  const emptyForm = {
    name: "", eventId: "", audienceType: "Attendees" as string, audienceFilters: {} as Record<string, any>,
    templateId: "", status: "Draft", scheduledAt: "",
  };
  const [form, setForm] = useState(emptyForm);

  const { data: campaignList = [], isLoading } = useQuery<Campaign[]>({
    queryKey: ["/api/admin/campaigns"],
  });

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const filteredCampaigns = useMemo(() => {
    let list = campaignList;
    if (filterStatus) list = list.filter(c => c.status === filterStatus);
    if (filterEvent) list = list.filter(c => c.eventId === filterEvent);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q));
    }
    return list;
  }, [campaignList, filterStatus, filterEvent, searchQuery]);

  const createMutation = useMutation({
    mutationFn: async (data: typeof emptyForm) => {
      const res = await apiRequest("POST", "/api/admin/campaigns", {
        ...data,
        eventId: data.eventId || null,
        templateId: data.templateId || null,
        scheduledAt: data.scheduledAt || null,
        status: data.scheduledAt ? "Scheduled" : "Draft",
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setCreateOpen(false);
      setForm(emptyForm);
      toast({ title: "Campaign created" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof emptyForm }) => {
      const res = await apiRequest("PATCH", `/api/admin/campaigns/${id}`, {
        ...data,
        eventId: data.eventId || null,
        templateId: data.templateId || null,
        scheduledAt: data.scheduledAt || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setEditTarget(null);
      setForm(emptyForm);
      toast({ title: "Campaign updated" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/campaigns/${id}/send`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setConfirmSendTarget(null);
      toast({ title: `Campaign sent — ${data.emailsSent} emails delivered${data.skippedByRateLimit ? `, ${data.skippedByRateLimit} skipped (rate limit)` : ""}` });
    },
    onError: (err: any) => {
      toast({ title: "Send failed", description: err.message, variant: "destructive" });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/admin/campaigns/${id}/cancel`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      setCancelTarget(null);
      toast({ title: "Campaign cancelled" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/campaigns/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/campaigns"] });
      toast({ title: "Campaign deleted" });
    },
  });

  const openEdit = (c: Campaign) => {
    setForm({
      name: c.name,
      eventId: c.eventId || "",
      audienceType: c.audienceType || "Attendees",
      audienceFilters: (c.audienceFilters || {}) as Record<string, any>,
      templateId: c.templateId || "",
      status: c.status,
      scheduledAt: c.scheduledAt ? new Date(c.scheduledAt).toISOString().slice(0, 16) : "",
    });
    setEditTarget(c);
  };

  const loadAudiencePreview = async (campaignId: string) => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/admin/campaigns/${campaignId}/preview-audience`, { method: "POST", credentials: "include" });
      const data = await res.json();
      setAudiencePreview(data);
    } catch {
      toast({ title: "Failed to load preview", variant: "destructive" });
    }
    setPreviewLoading(false);
  };

  const openPreview = (c: Campaign) => {
    setPreviewTarget(c);
    setAudiencePreview(null);
    loadAudiencePreview(c.id);
  };

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
      " " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  const getEventName = (eventId: string | null) => {
    if (!eventId) return "All Events";
    return events.find(e => e.id === eventId)?.name || eventId;
  };

  const getTemplateName = (templateId: string | null) => {
    if (!templateId) return "—";
    return templates.find(t => t.id === templateId || t.templateKey === templateId)?.displayName || templateId;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-accent" />
            Campaigns
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create and send targeted email communications to event participants.
          </p>
        </div>
        <Button size="sm" className="gap-2 h-8" onClick={() => { setForm(emptyForm); setCreateOpen(true); }} data-testid="button-create-campaign">
          <Plus className="h-3.5 w-3.5" /> Create Campaign
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search campaigns…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9 h-8 text-sm" data-testid="input-campaign-search" />
        </div>
        <select className="h-8 text-xs rounded-lg border border-border/60 bg-background px-3" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="select-campaign-status-filter">
          <option value="">All Statuses</option>
          {CAMPAIGN_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="h-8 text-xs rounded-lg border border-border/60 bg-background px-3" value={filterEvent} onChange={(e) => setFilterEvent(e.target.value)} data-testid="select-campaign-event-filter">
          <option value="">All Events</option>
          {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      </div>

      {/* Campaign Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
          <RefreshCw className="h-4 w-4 animate-spin" /> Loading campaigns…
        </div>
      ) : filteredCampaigns.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{campaignList.length === 0 ? "No campaigns yet" : "No campaigns match your filters"}</p>
          <p className="text-xs mt-1">Create a campaign to start sending targeted emails.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-hidden">
          <table className="w-full text-sm" data-testid="table-campaigns">
            <thead className="bg-muted/30 border-b border-border/40">
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Campaign</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Event</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Audience</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Template</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Sent</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {filteredCampaigns.map((c) => (
                <tr key={c.id} className="hover:bg-muted/20 transition-colors" data-testid={`campaign-row-${c.id}`}>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground truncate max-w-[200px]">{c.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.scheduledAt ? `Scheduled: ${fmtDate(c.scheduledAt)}` : c.sentAt ? `Sent: ${fmtDate(c.sentAt)}` : `Created: ${fmtDate(c.createdAt)}`}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">{getEventName(c.eventId)}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs flex items-center gap-1"><Users className="h-3 w-3" /> {c.audienceType}</span>
                    {c.audienceSize > 0 && <span className="text-xs text-muted-foreground">{c.audienceSize} recipients</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[150px]">{getTemplateName(c.templateId)}</td>
                  <td className="px-4 py-3">
                    <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium border", CAMPAIGN_STATUS_COLORS[c.status] || CAMPAIGN_STATUS_COLORS.Draft)}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold">{c.emailsSent}</p>
                    {c.failures > 0 && <p className="text-xs text-red-500">{c.failures} failed</p>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {(c.status === "Draft" || c.status === "Scheduled") && (
                        <>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openPreview(c)} data-testid={`preview-campaign-${c.id}`} title="Preview Audience">
                            <Users className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(c)} data-testid={`edit-campaign-${c.id}`} title="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-green-600" onClick={() => { setConfirmSendTarget(c); openPreview(c); }} data-testid={`send-campaign-${c.id}`} title="Send Now">
                            <Send className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setCancelTarget(c)} data-testid={`cancel-campaign-${c.id}`} title="Cancel">
                            <Ban className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                      {c.status === "Draft" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-400" onClick={() => deleteMutation.mutate(c.id)} data-testid={`delete-campaign-${c.id}`} title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {c.status === "Sent" && (
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openPreview(c)} title="View Details">
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Campaign Dialog */}
      <Dialog open={createOpen || !!editTarget} onOpenChange={(o) => { if (!o) { setCreateOpen(false); setEditTarget(null); setForm(emptyForm); } }}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-accent" />
              {editTarget ? "Edit Campaign" : "Create Campaign"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Campaign Name *</label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. FRC2026 – Invite Attendees to Schedule" data-testid="input-campaign-name" />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Event</label>
              <select className="w-full h-9 text-sm rounded-lg border border-border/60 bg-background px-3" value={form.eventId} onChange={(e) => setForm({ ...form, eventId: e.target.value })} data-testid="select-campaign-event">
                <option value="">All Events</option>
                {events.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Audience Type</label>
              <select className="w-full h-9 text-sm rounded-lg border border-border/60 bg-background px-3" value={form.audienceType} onChange={(e) => setForm({ ...form, audienceType: e.target.value, audienceFilters: {} })} data-testid="select-campaign-audience-type">
                {CAMPAIGN_AUDIENCE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Audience Filters */}
            <div className="space-y-2 rounded-lg border border-border/60 p-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Filter className="h-3 w-3" /> Audience Filters</p>
              {form.audienceType === "Attendees" ? (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Category</label>
                      <select className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2" value={form.audienceFilters.category || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, category: e.target.value || undefined } })} data-testid="filter-attendee-category">
                        <option value="">All Categories</option>
                        <option value="PRACTITIONER">Practitioner</option>
                        <option value="SOLUTION_PROVIDER">Solution Provider</option>
                        <option value="GOVERNMENT_NONPROFIT">Government / Non-Profit</option>
                        <option value="BANKER">Banker</option>
                        <option value="STAFF">Staff</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Meetings Scheduled</label>
                      <select className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2" value={form.audienceFilters.meetingsScheduled || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, meetingsScheduled: e.target.value || undefined } })} data-testid="filter-attendee-meetings">
                        <option value="">Any</option>
                        <option value="0">0 (no meetings)</option>
                        <option value="1+">1+ meetings</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Info Requests</label>
                      <select className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2" value={form.audienceFilters.infoRequests || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, infoRequests: e.target.value || undefined } })} data-testid="filter-attendee-info-requests">
                        <option value="">Any</option>
                        <option value="0">0 (none)</option>
                        <option value="1+">1+ requests</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Profile Complete</label>
                      <select className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2" value={form.audienceFilters.profileComplete || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, profileComplete: e.target.value || undefined } })} data-testid="filter-attendee-profile">
                        <option value="">Any</option>
                        <option value="true">Complete</option>
                        <option value="false">Incomplete</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">Company</label>
                    <Input className="h-8 text-xs" placeholder="Filter by company name" value={form.audienceFilters.company || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, company: e.target.value || undefined } })} data-testid="filter-attendee-company" />
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <label className="text-xs text-muted-foreground">Sponsorship Level</label>
                    <select className="w-full h-8 text-xs rounded-lg border border-border/60 bg-background px-2" value={form.audienceFilters.level || ""} onChange={(e) => setForm({ ...form, audienceFilters: { ...form.audienceFilters, level: e.target.value || undefined } })} data-testid="filter-sponsor-level">
                      <option value="">All Levels</option>
                      <option value="Platinum">Platinum</option>
                      <option value="Gold">Gold</option>
                      <option value="Silver">Silver</option>
                      <option value="Bronze">Bronze</option>
                    </select>
                  </div>
                </div>
              )}
            </div>

            {/* Template Selection */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Template *</label>
              <select className="w-full h-9 text-sm rounded-lg border border-border/60 bg-background px-3" value={form.templateId} onChange={(e) => setForm({ ...form, templateId: e.target.value })} data-testid="select-campaign-template">
                <option value="">Select a template…</option>
                {templates.filter(t => t.isActive).map(t => (
                  <option key={t.id} value={t.id}>{t.displayName} ({t.category})</option>
                ))}
              </select>
              {form.templateId && (() => {
                const tpl = templates.find(t => t.id === form.templateId);
                return tpl ? (
                  <div className="rounded-lg border border-border/40 bg-muted/20 p-2 mt-1">
                    <p className="text-xs text-muted-foreground">Subject: <span className="text-foreground">{tpl.subjectTemplate}</span></p>
                  </div>
                ) : null;
              })()}
            </div>

            {/* Schedule */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Schedule Send (optional)</label>
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} data-testid="input-campaign-scheduled-at" />
              <p className="text-xs text-muted-foreground">Leave empty to save as Draft, or set a date/time to schedule the send.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreateOpen(false); setEditTarget(null); setForm(emptyForm); }}>Cancel</Button>
            {editTarget ? (
              <Button onClick={() => updateMutation.mutate({ id: editTarget.id, data: form })} disabled={!form.name || updateMutation.isPending} className="gap-2" data-testid="button-save-campaign">
                {updateMutation.isPending ? "Saving…" : "Save Changes"}
              </Button>
            ) : (
              <Button onClick={() => createMutation.mutate(form)} disabled={!form.name || createMutation.isPending} className="gap-2" data-testid="button-submit-campaign">
                {createMutation.isPending ? "Creating…" : <><Plus className="h-3.5 w-3.5" /> Create Campaign</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Audience Preview Drawer */}
      <Sheet open={!!previewTarget && !confirmSendTarget} onOpenChange={(o) => { if (!o) { setPreviewTarget(null); setAudiencePreview(null); } }}>
        <SheetContent side="right" className="w-[480px] sm:max-w-[480px] flex flex-col">
          <SheetHeader className="pb-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-base font-display">
              <Users className="h-4 w-4 text-accent" />
              Audience Preview
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto py-4 space-y-4">
            {previewTarget && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Campaign</p>
                    <p className="text-sm font-semibold">{previewTarget.name}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground mb-1">Audience Type</p>
                    <p className="text-sm">{previewTarget.audienceType}</p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
                    <p className="text-xs text-muted-foreground mb-1">Event</p>
                    <p className="text-sm">{getEventName(previewTarget.eventId)}</p>
                  </div>
                </div>
                {previewLoading ? (
                  <div className="flex items-center gap-2 py-8 text-xs text-muted-foreground justify-center"><RefreshCw className="h-3 w-3 animate-spin" /> Loading audience…</div>
                ) : audiencePreview ? (
                  <>
                    <div className="rounded-xl border border-accent/30 bg-accent/5 p-4 text-center">
                      <p className="text-3xl font-display font-bold text-accent">{audiencePreview.count}</p>
                      <p className="text-xs text-muted-foreground mt-1">Total Recipients</p>
                    </div>
                    {audiencePreview.preview?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                          Preview (first {Math.min(20, audiencePreview.preview.length)})
                        </p>
                        <div className="rounded-lg border border-border/50 bg-muted/10 divide-y divide-border/30 max-h-[300px] overflow-y-auto">
                          {audiencePreview.preview.map((r, i) => (
                            <div key={i} className="flex items-center justify-between px-3 py-2">
                              <div>
                                <p className="text-xs font-medium">{r.name || "—"}</p>
                                <p className="text-[10px] text-muted-foreground">{r.company}</p>
                              </div>
                              <p className="text-xs text-muted-foreground font-mono">{r.email}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={!!confirmSendTarget} onOpenChange={(o) => { if (!o) { setConfirmSendTarget(null); setPreviewTarget(null); setAudiencePreview(null); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-semibold text-foreground">{confirmSendTarget?.name}</span>
              {audiencePreview && (
                <span className="block mt-2">This will send emails to <strong>{audiencePreview.count}</strong> {confirmSendTarget?.audienceType?.toLowerCase() || "recipients"}. Recipients who already received a campaign email today will be skipped.</span>
              )}
              {!audiencePreview && previewLoading && <span className="block mt-2">Loading audience count…</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmSendTarget && sendMutation.mutate(confirmSendTarget.id)}
              disabled={sendMutation.isPending || previewLoading}
              data-testid="button-confirm-send-campaign"
            >
              {sendMutation.isPending ? "Sending…" : "Confirm Send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelTarget} onOpenChange={(o) => { if (!o) setCancelTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              This will cancel <strong>{cancelTarget?.name}</strong>. Cancelled campaigns cannot be sent.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Campaign</AlertDialogCancel>
            <AlertDialogAction onClick={() => cancelTarget && cancelMutation.mutate(cancelTarget.id)} disabled={cancelMutation.isPending} data-testid="button-confirm-cancel-campaign">
              {cancelMutation.isPending ? "Cancelling…" : "Cancel Campaign"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Email Settings Tab Component ─────────────────────────────────────────────

interface EmailStats {
  dailyLimit: number;
  sentToday: number;
  failedToday: number;
  globalPaused: boolean;
  pausedAt: string | null;
  systemStatus: string;
  history: Array<{ date: string; sent: number; failed: number }>;
  recentFailures: EmailLog[];
}

const STATUS_COLORS: Record<string, string> = {
  Operational: "bg-green-100 text-green-700 border-green-300",
  Paused: "bg-amber-100 text-amber-700 border-amber-300",
  "Provider Error": "bg-red-100 text-red-700 border-red-300",
  "Delivery Issues Detected": "bg-orange-100 text-orange-700 border-orange-300",
};

interface MessageJob {
  id: string;
  jobName: string;
  messageType: string;
  sourceType: string;
  sourceId: string | null;
  eventId: string | null;
  sponsorId: string | null;
  attendeeId: string | null;
  templateId: string | null;
  templateKeySnapshot: string | null;
  triggerType: string;
  triggerName: string | null;
  status: string;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  recipientCount: number;
  sentCount: number;
  failedCount: number;
  createdByUserId: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  eventName?: string | null;
  eventSlug?: string | null;
  sponsorName?: string | null;
  attendeeName?: string | null;
  createdByName?: string | null;
  childEmails?: EmailLog[];
}

const MESSAGE_TYPE_COLORS: Record<string, string> = {
  SYSTEM: "bg-blue-100 text-blue-700",
  AUTOMATION: "bg-purple-100 text-purple-700",
  CAMPAIGN: "bg-teal-100 text-teal-700",
  MANUAL: "bg-gray-100 text-gray-700",
};

const JOB_STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-600",
  SCHEDULED: "bg-blue-100 text-blue-600",
  RUNNING: "bg-amber-100 text-amber-700",
  COMPLETED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-200 text-gray-500",
};

function MessageRunsTab({ events, sponsors }: { events: Event[]; sponsors: Sponsor[] }) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [sponsorFilter, setSponsorFilter] = useState("");
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const activeType = typeFilter && typeFilter !== "all" ? typeFilter : "";
  const activeStatus = statusFilter && statusFilter !== "all" ? statusFilter : "";
  const activeEvent = eventFilter && eventFilter !== "all" ? eventFilter : "";
  const activeSource = sourceFilter && sourceFilter !== "all" ? sourceFilter : "";
  const activeSponsor = sponsorFilter && sponsorFilter !== "all" ? sponsorFilter : "";

  const { data: jobs = [], isLoading } = useQuery<MessageJob[]>({
    queryKey: ["/api/admin/message-jobs", { messageType: activeType || undefined, status: activeStatus || undefined, eventId: activeEvent || undefined, sourceType: activeSource || undefined, sponsorId: activeSponsor || undefined, search: search || undefined }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeType) params.set("messageType", activeType);
      if (activeStatus) params.set("status", activeStatus);
      if (activeEvent) params.set("eventId", activeEvent);
      if (activeSource) params.set("sourceType", activeSource);
      if (activeSponsor) params.set("sponsorId", activeSponsor);
      if (search) params.set("search", search);
      const res = await fetch(`/api/admin/message-jobs?${params}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch message jobs");
      return res.json();
    },
  });

  const { data: jobDetail, isLoading: detailLoading } = useQuery<MessageJob>({
    queryKey: ["/api/admin/message-jobs", selectedJobId],
    queryFn: async () => {
      const res = await fetch(`/api/admin/message-jobs/${selectedJobId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch job detail");
      return res.json();
    },
    enabled: !!selectedJobId,
  });

  const formatDate = (d: string | null) => {
    if (!d) return "—";
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search job name, template..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" data-testid="input-search-jobs" />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px] h-9" data-testid="filter-job-type">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="SYSTEM">System</SelectItem>
            <SelectItem value="AUTOMATION">Automation</SelectItem>
            <SelectItem value="CAMPAIGN">Campaign</SelectItem>
            <SelectItem value="MANUAL">Manual</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px] h-9" data-testid="filter-job-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="RUNNING">Running</SelectItem>
            <SelectItem value="FAILED">Failed</SelectItem>
            <SelectItem value="SCHEDULED">Scheduled</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-[160px] h-9" data-testid="filter-job-event">
            <SelectValue placeholder="All Events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map(e => <SelectItem key={e.id} value={e.id}>{e.slug || e.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[150px] h-9" data-testid="filter-job-source">
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="automation">Automation</SelectItem>
            <SelectItem value="campaign">Campaign</SelectItem>
            <SelectItem value="manual_send">Manual Send</SelectItem>
            <SelectItem value="event_action">Event Action</SelectItem>
            <SelectItem value="scheduled_send">Scheduled Send</SelectItem>
          </SelectContent>
        </Select>
        {sponsors.length > 0 && (
          <Select value={sponsorFilter} onValueChange={setSponsorFilter}>
            <SelectTrigger className="w-[150px] h-9" data-testid="filter-job-sponsor">
              <SelectValue placeholder="All Sponsors" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Sponsors</SelectItem>
              {sponsors.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading message runs...
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No message runs found</p>
          <p className="text-sm mt-1">Message runs will appear here as emails are sent through campaigns, automations, and manual actions.</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold">Job Name</TableHead>
                <TableHead className="font-semibold">Type</TableHead>
                <TableHead className="font-semibold">Event</TableHead>
                <TableHead className="font-semibold">Sponsor</TableHead>
                <TableHead className="font-semibold">Template</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold text-center">Audience</TableHead>
                <TableHead className="font-semibold text-center">Sent</TableHead>
                <TableHead className="font-semibold text-center">Failed</TableHead>
                <TableHead className="font-semibold">Started</TableHead>
                <TableHead className="font-semibold">Completed</TableHead>
                <TableHead className="font-semibold">Source</TableHead>
                <TableHead className="font-semibold w-[60px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map(job => (
                <TableRow key={job.id} className="hover:bg-muted/20 cursor-pointer" onClick={() => setSelectedJobId(job.id)} data-testid={`row-job-${job.id}`}>
                  <TableCell className="font-medium max-w-[250px] truncate" title={job.jobName}>{job.jobName}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MESSAGE_TYPE_COLORS[job.messageType] || "bg-gray-100 text-gray-600"}`}>
                      {job.messageType}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{job.eventSlug || job.eventName || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{job.sponsorName || (job.sponsorId ? sponsors.find(s => s.id === job.sponsorId)?.name : null) || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[120px] truncate" title={job.templateKeySnapshot || ""}>{job.templateKeySnapshot || "—"}</TableCell>
                  <TableCell>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${JOB_STATUS_COLORS[job.status] || "bg-gray-100"}`}>
                      {job.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm font-medium">{job.recipientCount}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-sm text-green-600 font-medium">{job.sentCount}</span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className={`text-sm font-medium ${job.failedCount > 0 ? "text-red-600" : "text-muted-foreground"}`}>{job.failedCount}</span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(job.startedAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatDate(job.completedAt)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground capitalize">{job.sourceType?.replace(/_/g, " ") || "—"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" data-testid={`button-view-job-${job.id}`}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={!!selectedJobId} onOpenChange={(o) => { if (!o) setSelectedJobId(null); }}>
        <SheetContent side="right" className="w-[700px] sm:max-w-[700px] flex flex-col overflow-y-auto" data-testid="drawer-job-detail">
          <SheetHeader className="pb-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-base font-display">
              <Activity className="h-4 w-4 text-accent" />
              Message Run Detail
            </SheetTitle>
          </SheetHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <RefreshCw className="h-5 w-5 animate-spin mr-2" /> Loading...
            </div>
          ) : jobDetail ? (
            <div className="space-y-6 py-4">
              <div>
                <h3 className="text-lg font-semibold" data-testid="text-job-name">{jobDetail.jobName}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MESSAGE_TYPE_COLORS[jobDetail.messageType] || ""}`}>{jobDetail.messageType}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${JOB_STATUS_COLORS[jobDetail.status] || ""}`}>{jobDetail.status}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Source Type</span>
                  <p className="font-medium capitalize">{jobDetail.sourceType?.replace(/_/g, " ")}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Trigger</span>
                  <p className="font-medium">{jobDetail.triggerName || jobDetail.triggerType}</p>
                </div>
                {jobDetail.eventName && (
                  <div>
                    <span className="text-muted-foreground">Event</span>
                    <p className="font-medium">{jobDetail.eventName}</p>
                  </div>
                )}
                {jobDetail.sponsorName && (
                  <div>
                    <span className="text-muted-foreground">Sponsor</span>
                    <p className="font-medium">{jobDetail.sponsorName}</p>
                  </div>
                )}
                {jobDetail.attendeeName && (
                  <div>
                    <span className="text-muted-foreground">Attendee</span>
                    <p className="font-medium">{jobDetail.attendeeName}</p>
                  </div>
                )}
                {jobDetail.templateKeySnapshot && (
                  <div>
                    <span className="text-muted-foreground">Template</span>
                    <p className="font-medium">{jobDetail.templateKeySnapshot}</p>
                  </div>
                )}
                <div>
                  <span className="text-muted-foreground">Started</span>
                  <p className="font-medium">{formatDate(jobDetail.startedAt)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Completed</span>
                  <p className="font-medium">{formatDate(jobDetail.completedAt)}</p>
                </div>
                {jobDetail.createdByName && (
                  <div>
                    <span className="text-muted-foreground">Created By</span>
                    <p className="font-medium">{jobDetail.createdByName}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="bg-muted/40 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{jobDetail.recipientCount}</div>
                  <div className="text-xs text-muted-foreground">Recipients</div>
                </div>
                <div className="bg-green-50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{jobDetail.sentCount}</div>
                  <div className="text-xs text-muted-foreground">Sent</div>
                </div>
                <div className={`rounded-lg p-3 text-center ${jobDetail.failedCount > 0 ? "bg-red-50" : "bg-muted/40"}`}>
                  <div className={`text-2xl font-bold ${jobDetail.failedCount > 0 ? "text-red-600" : ""}`}>{jobDetail.failedCount}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
              </div>

              {jobDetail.notes && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground font-medium">Notes:</span> {jobDetail.notes}
                </div>
              )}

              {jobDetail.childEmails && jobDetail.childEmails.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                    <Mail className="h-4 w-4" /> Email Activity ({jobDetail.childEmails.length})
                  </h4>
                  <div className="rounded-lg border border-border/60 overflow-hidden max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/20">
                          <TableHead className="text-xs">Recipient</TableHead>
                          <TableHead className="text-xs">Subject</TableHead>
                          <TableHead className="text-xs">Status</TableHead>
                          <TableHead className="text-xs">Sent At</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {jobDetail.childEmails.map((email: EmailLog) => (
                          <TableRow key={email.id} className="text-xs">
                            <TableCell className="max-w-[160px] truncate">{email.recipientEmail}</TableCell>
                            <TableCell className="max-w-[180px] truncate">{email.subject}</TableCell>
                            <TableCell>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${email.status === "sent" ? "bg-green-100 text-green-700" : email.status === "failed" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-600"}`}>
                                {email.status}
                              </span>
                            </TableCell>
                            <TableCell className="text-muted-foreground">{email.sentAt ? new Date(email.sentAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function EmailSettingsTab() {
  const { toast } = useToast();

  const { data: settings, isLoading: settingsLoading } = useQuery<EmailSettings>({
    queryKey: ["/api/admin/email-settings"],
  });

  const { data: stats, isLoading: statsLoading } = useQuery<EmailStats>({
    queryKey: ["/api/admin/email-stats"],
    refetchInterval: 30000,
  });

  const [senderForm, setSenderForm] = useState({
    senderName: "", senderEmail: "", replyToEmail: "", dailyLimit: 100,
  });
  const [formDirty, setFormDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setSenderForm({
        senderName: settings.senderName,
        senderEmail: settings.senderEmail,
        replyToEmail: settings.replyToEmail,
        dailyLimit: settings.dailyLimit,
      });
    }
  }, [settings]);

  const updateSenderMutation = useMutation({
    mutationFn: async (data: typeof senderForm) => {
      const res = await apiRequest("PATCH", "/api/admin/email-settings", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      setFormDirty(false);
      toast({ title: "Sender configuration saved" });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/email-settings/pause");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-stats"] });
      toast({ title: "All emails paused", description: "No automated or campaign emails will be sent." });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/email-settings/resume");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-settings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-stats"] });
      toast({ title: "Email sending resumed" });
    },
  });

  const usagePct = stats ? Math.round((stats.sentToday / stats.dailyLimit) * 100) : 0;
  const usageColor = usagePct >= 90 ? "bg-red-500" : usagePct >= 75 ? "bg-amber-500" : "bg-accent";

  const fmtDate = (d: string | Date | null | undefined) => {
    if (!d) return "—";
    const dt = new Date(d);
    return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
      " " + dt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  };

  if (settingsLoading || statsLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground gap-2">
        <RefreshCw className="h-4 w-4 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
          <Settings2 className="h-6 w-6 text-accent" />
          Email Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure email sending, monitor usage, and manage system controls.
        </p>
      </div>

      {/* System Status + Daily Usage Cards Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* System Status */}
        <div className="rounded-xl border border-border/60 bg-card p-4" data-testid="card-system-status">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Email System Status</p>
          <div className="flex items-center gap-2">
            <span className={cn("text-xs px-2.5 py-1 rounded-full font-medium border", STATUS_COLORS[stats?.systemStatus || "Operational"] || STATUS_COLORS.Operational)}>
              {stats?.systemStatus || "Operational"}
            </span>
          </div>
          {stats?.globalPaused && stats.pausedAt && (
            <p className="text-xs text-muted-foreground mt-2">Paused at {fmtDate(stats.pausedAt)}</p>
          )}
        </div>

        {/* Daily Email Usage */}
        <div className="rounded-xl border border-border/60 bg-card p-4 col-span-2" data-testid="card-daily-usage">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Daily Email Usage</p>
            <span className="text-sm font-semibold text-foreground">{stats?.sentToday ?? 0} / {stats?.dailyLimit ?? 100}</span>
          </div>
          <div className="h-3 rounded-full bg-muted/40 overflow-hidden" data-testid="progress-daily-usage">
            <div className={cn("h-full rounded-full transition-all", usageColor)} style={{ width: `${Math.min(usagePct, 100)}%` }} />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">{usagePct}% of daily limit used</p>
          {usagePct >= 90 && (
            <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2" data-testid="warning-90">
              <p className="text-xs text-red-700 font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Critical: {stats?.sentToday} of {stats?.dailyLimit} emails sent. Further sends may exceed the daily limit.</p>
            </div>
          )}
          {usagePct >= 75 && usagePct < 90 && (
            <div className="mt-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2" data-testid="warning-75">
              <p className="text-xs text-amber-700 font-medium flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Warning: Approaching the daily sending limit ({stats?.sentToday} of {stats?.dailyLimit}).</p>
            </div>
          )}
        </div>
      </div>

      {/* Global Pause Control */}
      <div className="rounded-xl border border-border/60 bg-card p-5" data-testid="section-global-pause">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Power className="h-4 w-4 text-muted-foreground" /> Global Email Pause
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {stats?.globalPaused
                ? "All automated emails, campaigns, and scheduled sends are currently paused."
                : "Email sending is active. Use this control to immediately pause all outgoing emails."}
            </p>
          </div>
          {stats?.globalPaused ? (
            <Button size="sm" className="gap-2 bg-green-600 hover:bg-green-700" onClick={() => resumeMutation.mutate()} disabled={resumeMutation.isPending} data-testid="button-resume-emails">
              <Play className="h-3.5 w-3.5" /> Resume Emails
            </Button>
          ) : (
            <Button size="sm" variant="destructive" className="gap-2" onClick={() => pauseMutation.mutate()} disabled={pauseMutation.isPending} data-testid="button-pause-emails">
              <Pause className="h-3.5 w-3.5" /> Pause All Emails
            </Button>
          )}
        </div>
      </div>

      {/* Sender Configuration */}
      <div className="rounded-xl border border-border/60 bg-card p-5" data-testid="section-sender-config">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Mail className="h-4 w-4 text-muted-foreground" /> Sender Configuration
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Default From Name</label>
            <Input value={senderForm.senderName} onChange={(e) => { setSenderForm({ ...senderForm, senderName: e.target.value }); setFormDirty(true); }} data-testid="input-sender-name" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Default From Email</label>
            <Input value={senderForm.senderEmail} onChange={(e) => { setSenderForm({ ...senderForm, senderEmail: e.target.value }); setFormDirty(true); }} data-testid="input-sender-email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Reply-To Email</label>
            <Input value={senderForm.replyToEmail} onChange={(e) => { setSenderForm({ ...senderForm, replyToEmail: e.target.value }); setFormDirty(true); }} data-testid="input-reply-to-email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Daily Send Limit</label>
            <Input type="number" value={senderForm.dailyLimit} onChange={(e) => { setSenderForm({ ...senderForm, dailyLimit: parseInt(e.target.value) || 100 }); setFormDirty(true); }} data-testid="input-daily-limit" />
          </div>
        </div>
        {formDirty && (
          <div className="flex justify-end mt-4">
            <Button size="sm" className="gap-2" onClick={() => updateSenderMutation.mutate(senderForm)} disabled={updateSenderMutation.isPending} data-testid="button-save-sender">
              <Save className="h-3.5 w-3.5" /> {updateSenderMutation.isPending ? "Saving…" : "Save Configuration"}
            </Button>
          </div>
        )}
      </div>

      {/* Email Provider Status */}
      <div className="rounded-xl border border-border/60 bg-card p-5" data-testid="section-provider-status">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Shield className="h-4 w-4 text-muted-foreground" /> Email Provider Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Provider", value: "Brevo (Sendinblue)" },
            { label: "Sending Domain", value: "concierge.convergeevents.com" },
            { label: "Domain Status", value: "Verified", color: "text-green-600" },
            { label: "DKIM", value: "Verified", color: "text-green-600" },
            { label: "SPF", value: "Verified", color: "text-green-600" },
          ].map((item, i) => (
            <div key={i} className="rounded-lg border border-border/40 bg-muted/10 p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{item.label}</p>
              <p className={cn("text-xs font-semibold mt-1", item.color || "text-foreground")}>{item.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Email Usage History */}
      <div className="rounded-xl border border-border/60 bg-card p-5" data-testid="section-usage-history">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <BarChart3 className="h-4 w-4 text-muted-foreground" /> Email Usage History (Last 7 Days)
        </h3>
        <div className="overflow-hidden rounded-lg border border-border/40">
          <table className="w-full text-sm" data-testid="table-usage-history">
            <thead className="bg-muted/30 border-b border-border/40">
              <tr>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Date</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">Emails Sent</th>
                <th className="text-right text-xs font-semibold text-muted-foreground px-4 py-2.5">Failures</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Usage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/30">
              {(stats?.history || []).map((row, i) => {
                const pct = Math.round((row.sent / (stats?.dailyLimit || 100)) * 100);
                return (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-xs font-medium">{new Date(row.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", weekday: "short" })}</td>
                    <td className="px-4 py-2 text-xs text-right font-semibold">{row.sent}</td>
                    <td className="px-4 py-2 text-xs text-right">{row.failed > 0 ? <span className="text-red-500">{row.failed}</span> : <span className="text-muted-foreground">0</span>}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 flex-1 max-w-[80px] rounded-full bg-muted/40 overflow-hidden">
                          <div className={cn("h-full rounded-full", pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-accent")} style={{ width: `${Math.min(pct, 100)}%` }} />
                        </div>
                        <span className="text-[10px] text-muted-foreground">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Email Failures */}
      <div className="rounded-xl border border-border/60 bg-card p-5" data-testid="section-recent-failures">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <MailX className="h-4 w-4 text-red-500" /> Recent Email Failures
        </h3>
        {(stats?.recentFailures?.length ?? 0) === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <CheckCircle2 className="h-8 w-8 mx-auto mb-2 opacity-30" />
            <p className="text-xs">No recent email failures. All systems operational.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border/40">
            <table className="w-full text-sm" data-testid="table-recent-failures">
              <thead className="bg-muted/30 border-b border-border/40">
                <tr>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Time</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Recipient</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Type</th>
                  <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-2.5">Error</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {(stats?.recentFailures || []).map((f, i) => (
                  <tr key={i} className="hover:bg-muted/10">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{fmtDate(f.sentAt)}</td>
                    <td className="px-4 py-2 text-xs font-mono truncate max-w-[180px]">{f.recipientEmail}</td>
                    <td className="px-4 py-2 text-xs">{f.emailType}</td>
                    <td className="px-4 py-2 text-xs text-red-500 truncate max-w-[250px]">{f.errorMessage || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Scheduled Emails Tab ─────────────────────────────────────────────────────

const SCHED_STATUS_CONFIG: Record<string, { className: string }> = {
  Draft: { className: "bg-gray-100 text-gray-700 border-gray-200" },
  Scheduled: { className: "bg-blue-100 text-blue-700 border-blue-200" },
  Sent: { className: "bg-teal-100 text-teal-700 border-teal-200" },
  Cancelled: { className: "bg-amber-100 text-amber-700 border-amber-200" },
  Failed: { className: "bg-red-100 text-red-700 border-red-200" },
};

type AllowedRecipient = { email: string; name: string; source: string };

function ScheduledEmailsTab({ events, sponsors }: { events: Event[]; sponsors: Sponsor[] }) {
  const { toast } = useToast();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ScheduledEmail | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ScheduledEmail | null>(null);
  const [form, setForm] = useState({
    emailType: "sponsor_report",
    recipientEmail: "",
    recipientName: "",
    subject: "",
    templateId: "",
    eventId: "",
    sponsorId: "",
    scheduledAt: "",
    status: "Scheduled" as string,
  });

  const isSponsorReport = form.emailType === "sponsor_report";
  const { data: allowedRecipients } = useQuery<{ recipients: AllowedRecipient[]; sponsorName: string }>({
    queryKey: ["/api/admin/sponsors", form.sponsorId, "allowed-report-recipients"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/sponsors/${form.sponsorId}/allowed-report-recipients`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch recipients");
      return res.json();
    },
    enabled: isSponsorReport && !!form.sponsorId,
  });

  const { data: scheduled = [], isLoading } = useQuery<ScheduledEmail[]>({
    queryKey: ["/api/admin/scheduled-emails"],
  });

  const { data: templates = [] } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

  const resetForm = () => setForm({
    emailType: "sponsor_report", recipientEmail: "", recipientName: "",
    subject: "", templateId: "", eventId: "", sponsorId: "",
    scheduledAt: "", status: "Scheduled",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/scheduled-emails", {
        ...form,
        scheduledAt: new Date(form.scheduledAt),
        templateId: form.templateId || null,
        eventId: form.eventId || null,
        sponsorId: form.sponsorId || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-emails"] });
      toast({ title: "Email scheduled successfully" });
      setCreateOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      let msg = "Failed to schedule email";
      try { const parsed = JSON.parse(err?.message?.substring(err.message.indexOf("{")) || "{}"); msg = parsed.error || parsed.message || msg; } catch {}
      toast({ title: "Scheduling Failed", description: msg, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/scheduled-emails/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-emails"] });
      toast({ title: "Scheduled email updated" });
      setEditTarget(null);
    },
    onError: (err: any) => {
      let msg = "Failed to update scheduled email";
      try { const parsed = JSON.parse(err?.message?.substring(err.message.indexOf("{")) || "{}"); msg = parsed.error || parsed.message || msg; } catch {}
      toast({ title: "Update Failed", description: msg, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/admin/scheduled-emails/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-emails"] });
      toast({ title: "Scheduled email deleted" });
      setDeleteTarget(null);
    },
    onError: () => toast({ title: "Failed to delete", variant: "destructive" }),
  });

  const cancelMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("PATCH", `/api/admin/scheduled-emails/${id}`, { status: "Cancelled" });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/scheduled-emails"] });
      toast({ title: "Email cancelled" });
    },
    onError: () => toast({ title: "Failed to cancel", variant: "destructive" }),
  });

  const openEdit = (se: ScheduledEmail) => {
    setForm({
      emailType: se.emailType,
      recipientEmail: se.recipientEmail,
      recipientName: se.recipientName ?? "",
      subject: se.subject,
      templateId: se.templateId ?? "",
      eventId: se.eventId ?? "",
      sponsorId: se.sponsorId ?? "",
      scheduledAt: se.scheduledAt ? new Date(se.scheduledAt).toISOString().slice(0, 16) : "",
      status: se.status,
    });
    setEditTarget(se);
  };

  const saveEdit = () => {
    if (!editTarget) return;
    updateMutation.mutate({
      id: editTarget.id,
      data: {
        ...form,
        scheduledAt: new Date(form.scheduledAt),
        templateId: form.templateId || null,
        eventId: form.eventId || null,
        sponsorId: form.sponsorId || null,
      },
    });
  };

  const getEventName = (id: string | null) => id ? (events.find(e => e.id === id)?.slug ?? events.find(e => e.id === id)?.name ?? "—") : "—";
  const getSponsorName = (id: string | null) => id ? (sponsors.find(s => s.id === id)?.name ?? "—") : "—";

  const recipientsList = isSponsorReport && form.sponsorId ? (allowedRecipients?.recipients ?? []) : [];
  const noRecipientsWarning = isSponsorReport && form.sponsorId && allowedRecipients && recipientsList.length === 0;

  const formFields = (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Recipient Email *</label>
          {isSponsorReport && form.sponsorId ? (
            <div className="space-y-1">
              <select
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                value={form.recipientEmail}
                onChange={e => {
                  const r = recipientsList.find(r => r.email === e.target.value);
                  setForm(f => ({ ...f, recipientEmail: e.target.value, recipientName: r?.name ?? f.recipientName }));
                }}
                data-testid="select-sched-recipient"
              >
                <option value="">Select recipient...</option>
                {recipientsList.map(r => (
                  <option key={r.email} value={r.email}>{r.name} ({r.email}) — {r.source}</option>
                ))}
              </select>
              {noRecipientsWarning && (
                <p className="text-xs text-amber-600 flex items-center gap-1" data-testid="warning-no-recipients">
                  <AlertCircle className="h-3 w-3" /> No registered team members found for this sponsor. Add contacts in the Sponsors page first.
                </p>
              )}
            </div>
          ) : (
            <Input value={form.recipientEmail} onChange={e => setForm(f => ({ ...f, recipientEmail: e.target.value }))} data-testid="input-sched-email" />
          )}
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Recipient Name</label>
          <Input value={form.recipientName} onChange={e => setForm(f => ({ ...f, recipientName: e.target.value }))} data-testid="input-sched-name" />
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Subject *</label>
        <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} data-testid="input-sched-subject" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Email Type</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.emailType} onChange={e => setForm(f => ({ ...f, emailType: e.target.value }))} data-testid="select-sched-type">
            {EMAIL_TYPES.map(t => <option key={t} value={t}>{EMAIL_TYPE_LABELS[t] ?? t}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Template</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.templateId} onChange={e => setForm(f => ({ ...f, templateId: e.target.value }))} data-testid="select-sched-template">
            <option value="">None</option>
            {templates.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-muted-foreground">Event</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.eventId} onChange={e => setForm(f => ({ ...f, eventId: e.target.value }))} data-testid="select-sched-event">
            <option value="">None</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.slug ?? e.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground">Sponsor</label>
          <select className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm" value={form.sponsorId} onChange={e => setForm(f => ({ ...f, sponsorId: e.target.value }))} data-testid="select-sched-sponsor">
            <option value="">None</option>
            {sponsors.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label className="text-xs font-medium text-muted-foreground">Scheduled Date & Time *</label>
        <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} data-testid="input-sched-datetime" />
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
            <Timer className="h-5 w-5 text-accent" />
            Scheduled Emails
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Manage upcoming email deliveries</p>
        </div>
        <Button size="sm" onClick={() => { resetForm(); setCreateOpen(true); }} className="gap-2" data-testid="button-schedule-email">
          <Plus className="h-3.5 w-3.5" /> Schedule Email
        </Button>
      </div>

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mr-3" />
            Loading scheduled emails...
          </div>
        ) : scheduled.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
              <Timer className="h-7 w-7 text-muted-foreground/50" />
            </div>
            <div>
              <p className="font-medium text-foreground">No scheduled emails</p>
              <p className="text-sm text-muted-foreground">Schedule emails to be sent at specific times.</p>
            </div>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Recipient</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Subject</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Event</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Scheduled</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {scheduled.map(se => {
                const scfg = SCHED_STATUS_CONFIG[se.status] ?? SCHED_STATUS_CONFIG.Draft;
                return (
                  <tr key={se.id} className="border-b border-border/30 hover:bg-muted/20 transition-colors" data-testid={`row-sched-${se.id}`}>
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium">{se.recipientName || se.recipientEmail}</p>
                        {se.recipientName && <p className="text-xs text-muted-foreground">{se.recipientEmail}</p>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[180px]">{se.subject}</td>
                    <td className="px-4 py-3"><TypeBadge type={se.emailType} /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{getEventName(se.eventId)}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtSentAt(se.scheduledAt)}</td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border", scfg.className)}>
                        {se.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {(se.status === "Draft" || se.status === "Scheduled") && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(se)} title="Edit" data-testid={`button-edit-sched-${se.id}`}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-amber-600" onClick={() => cancelMutation.mutate(se.id)} title="Cancel" data-testid={`button-cancel-sched-${se.id}`}>
                              <Ban className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        )}
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500" onClick={() => setDeleteTarget(se)} title="Delete" data-testid={`button-delete-sched-${se.id}`}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Email</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.recipientEmail || !form.subject || !form.scheduledAt || createMutation.isPending}
              data-testid="button-confirm-schedule"
            >
              {createMutation.isPending ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editTarget} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Scheduled Email</DialogTitle>
          </DialogHeader>
          {formFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditTarget(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMutation.isPending} data-testid="button-save-sched-edit">
              {updateMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Scheduled Email</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this scheduled email to {deleteTarget?.recipientEmail}? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete-sched"
            >
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmailCenterPage() {
  const { toast } = useToast();

  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEventId, setFilterEventId] = useState("");
  const [filterSponsorId, setFilterSponsorId] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [search, setSearch] = useState("");

  // Detail + resend
  const [selectedLog, setSelectedLog] = useState<EmailLog | null>(null);
  const [resendTarget, setResendTarget] = useState<EmailLog | null>(null);
  const [htmlPreviewMode, setHtmlPreviewMode] = useState<"preview" | "source">("preview");

  // Test email
  const [testOpen, setTestOpen] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testType, setTestType] = useState("meeting_confirmation_attendee");

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: templates = [] } = useQuery<EmailTemplate[]>({ queryKey: ["/api/admin/email-templates"] });
  const { data: emailStats } = useQuery<EmailStats>({ queryKey: ["/api/admin/email-stats"], refetchInterval: 60000 });

  const params = new URLSearchParams();
  if (filterType) params.set("emailType", filterType);
  if (filterStatus) params.set("status", filterStatus);
  if (filterEventId) params.set("eventId", filterEventId);
  if (filterSponsorId) params.set("sponsorId", filterSponsorId);
  if (filterSource) params.set("source", filterSource);
  if (filterFrom) params.set("from", filterFrom);
  if (filterTo) params.set("to", filterTo);
  if (search) params.set("search", search);

  const { data: logs = [], isLoading, refetch } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs", filterType, filterStatus, filterEventId, filterSponsorId, filterSource, filterFrom, filterTo, search],
    queryFn: () => fetch(`/api/admin/email-logs?${params}`).then((r) => r.json()),
  });

  // Summary counts
  const summary = useMemo(() => {
    const total = logs.length;
    const sent = logs.filter((l) => l.status === "sent").length;
    const failed = logs.filter((l) => l.status === "failed").length;
    return { total, sent, failed };
  }, [logs]);

  const getEventSlug = (id: string | null | undefined) => events.find((e) => e.id === id)?.slug ?? null;
  const getSponsorName = (id: string | null | undefined) => sponsors.find((s) => s.id === id)?.name ?? null;
  const getTemplateName = (id: string | null | undefined) => {
    if (!id) return null;
    const t = templates.find((t) => t.id === id);
    return t?.displayName ?? null;
  };

  // Resend mutation
  const resendMutation = useMutation({
    mutationFn: async (log: EmailLog) => {
      const res = await apiRequest("POST", `/api/admin/email-logs/${log.id}/resend`);
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.status === "sent" ? "Email resent successfully" : "Resend failed", description: data.status === "sent" ? "A new log entry has been created." : data.log?.errorMessage ?? "Unknown error", variant: data.status === "sent" ? "default" : "destructive" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-logs"] });
      setResendTarget(null);
    },
    onError: () => toast({ title: "Resend failed", variant: "destructive" }),
  });

  // Test send mutation
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/email-logs/send-test", { to: testTo, emailType: testType });
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: data.ok ? "Test email sent" : "Test email failed", description: data.ok ? `Sent to ${testTo}` : data.errorMessage ?? "Unknown error", variant: data.ok ? "default" : "destructive" });
      if (data.ok) { setTestOpen(false); setTestTo(""); }
      queryClient.invalidateQueries({ queryKey: ["/api/admin/email-logs"] });
    },
    onError: () => toast({ title: "Send failed", variant: "destructive" }),
  });

  const selectClass = "h-8 text-sm rounded-lg border border-border/60 bg-background px-3 focus:outline-none focus:ring-1 focus:ring-accent/40";

  const hasFilters = !!(filterType || filterStatus || filterEventId || filterSponsorId || filterSource || filterFrom || filterTo || search);
  const clearFilters = () => { setFilterType(""); setFilterStatus(""); setFilterEventId(""); setFilterSponsorId(""); setFilterSource(""); setFilterFrom(""); setFilterTo(""); setSearch(""); };

  const topUsagePct = emailStats ? Math.round((emailStats.sentToday / emailStats.dailyLimit) * 100) : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
      {/* Top Status Bar */}
      {emailStats && (
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card px-4 py-2.5" data-testid="bar-email-status">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className={cn("h-2 w-2 rounded-full", emailStats.systemStatus === "Operational" ? "bg-green-500" : emailStats.systemStatus === "Paused" ? "bg-amber-500" : "bg-red-500")} />
              <span className="text-xs font-medium text-foreground">{emailStats.systemStatus}</span>
            </div>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Today:</span>
              <span className="text-xs font-semibold">{emailStats.sentToday} / {emailStats.dailyLimit}</span>
              <div className="h-1.5 w-16 rounded-full bg-muted/40 overflow-hidden">
                <div className={cn("h-full rounded-full", topUsagePct >= 90 ? "bg-red-500" : topUsagePct >= 75 ? "bg-amber-500" : "bg-accent")} style={{ width: `${Math.min(topUsagePct, 100)}%` }} />
              </div>
            </div>
            {emailStats.failedToday > 0 && (
              <>
                <div className="h-4 w-px bg-border/60" />
                <span className="text-xs text-red-500 font-medium">{emailStats.failedToday} failed</span>
              </>
            )}
          </div>
          {emailStats.globalPaused && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium border border-amber-200">Emails Paused</span>
          )}
        </div>
      )}

      <Tabs defaultValue="logs" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="logs" className="gap-2" data-testid="tab-email-activity">
              <FileText className="h-3.5 w-3.5" /> Email Activity
            </TabsTrigger>
            <TabsTrigger value="message-runs" className="gap-2" data-testid="tab-message-runs">
              <Activity className="h-3.5 w-3.5" /> Message Runs
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layout className="h-3.5 w-3.5" /> Templates
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2" data-testid="tab-automations">
              <Zap className="h-3.5 w-3.5" /> Automations
            </TabsTrigger>
            <TabsTrigger value="campaigns" className="gap-2" data-testid="tab-campaigns">
              <Megaphone className="h-3.5 w-3.5" /> Campaigns
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-email-settings">
              <Settings2 className="h-3.5 w-3.5" /> Settings
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2" data-testid="tab-scheduled-emails">
              <Timer className="h-3.5 w-3.5" /> Scheduled
            </TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-8">
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
            <Button size="sm" onClick={() => setTestOpen(true)} className="gap-2 h-8" data-testid="button-send-test-email">
              <FlaskConical className="h-3.5 w-3.5" /> Send Test Email
            </Button>
          </div>
        </div>

        <TabsContent value="logs" className="space-y-6 mt-0">
          {/* Header */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
                <Mail className="h-6 w-6 text-accent" />
                Email Activity
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Review all emails sent by the platform — delivery status, source, template, and full content.</p>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border border-border/60 bg-card p-4">
              <p className="text-2xl font-display font-bold">{summary.total}</p>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Mail className="h-3 w-3" /> Total Emails</p>
            </div>
            <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
              <p className="text-2xl font-display font-bold text-teal-700">{summary.sent}</p>
              <p className="text-xs text-teal-600 mt-1 flex items-center gap-1"><MailCheck className="h-3 w-3" /> Sent</p>
            </div>
            <div className="rounded-xl border border-red-200 bg-red-50 p-4">
              <p className="text-2xl font-display font-bold text-red-700">{summary.failed}</p>
              <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><MailX className="h-3 w-3" /> Failed</p>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <select className={selectClass} value={filterType} onChange={(e) => setFilterType(e.target.value)} data-testid="filter-email-type">
              <option value="">All Types</option>
              {EMAIL_TYPES.map((t) => <option key={t} value={t}>{EMAIL_TYPE_LABELS[t]}</option>)}
            </select>
            <select className={selectClass} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} data-testid="filter-status">
              <option value="">All Statuses</option>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
            <select className={selectClass} value={filterEventId} onChange={(e) => setFilterEventId(e.target.value)} data-testid="filter-event">
              <option value="">All Events</option>
              {events.map((e) => <option key={e.id} value={e.id}>{e.slug}</option>)}
            </select>
            <select className={selectClass} value={filterSponsorId} onChange={(e) => setFilterSponsorId(e.target.value)} data-testid="filter-sponsor">
              <option value="">All Sponsors</option>
              {sponsors.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className={selectClass} value={filterSource} onChange={(e) => setFilterSource(e.target.value)} data-testid="filter-source">
              <option value="">All Sources</option>
              {EMAIL_SOURCE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" className={selectClass} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} data-testid="filter-from" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" className={selectClass} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} data-testid="filter-to" />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search recipient, subject, sponsor…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="email-search" />
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors" data-testid="button-clear-filters">
                <X className="h-3.5 w-3.5" /> Clear
              </button>
            )}
          </div>

          {/* Table */}
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 bg-muted/30">
                    {["Sent At", "Type", "Recipient", "Subject", "Event", "Sponsor", "Source", "Template", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={10} className="text-center py-12 text-muted-foreground text-sm">Loading…</td></tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="text-center py-16">
                        <div className="flex flex-col items-center gap-3">
                          <div className="h-12 w-12 rounded-full bg-muted/60 flex items-center justify-center">
                            <Mail className="h-6 w-6 text-muted-foreground/50" />
                          </div>
                          <p className="text-sm font-medium text-muted-foreground">No email activity found.</p>
                          <p className="text-xs text-muted-foreground/60">{hasFilters ? "Try adjusting your filters." : "Emails will appear here once they are sent."}</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    logs.map((log, i) => {
                      const eventSlug = getEventSlug(log.eventId);
                      const sponsorName = getSponsorName(log.sponsorId);
                      const templateName = getTemplateName(log.templateId);
                      return (
                        <tr key={log.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", i % 2 === 1 && "bg-muted/10")} data-testid={`email-row-${log.id}`}>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtSentAt(log.sentAt)}</td>
                          <td className="px-4 py-3"><TypeBadge type={log.emailType} /></td>
                          <td className="px-4 py-3 text-xs font-mono text-foreground max-w-[180px] truncate">{log.recipientEmail}</td>
                          <td className="px-4 py-3 text-sm text-foreground max-w-[200px] truncate" title={log.subject}>{log.subject}</td>
                          <td className="px-4 py-3">
                            {eventSlug ? <span className="text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">{eventSlug}</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{sponsorName ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{log.source ?? "—"}</td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap max-w-[140px] truncate" title={templateName ?? ""}>{templateName ?? (log.templateId ? log.templateId : "—")}</td>
                          <td className="px-4 py-3"><StatusBadge status={log.status} /></td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setSelectedLog(log)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:text-accent/80 transition-colors px-2 py-1 rounded hover:bg-accent/10"
                                data-testid={`button-view-${log.id}`}
                              >
                                <Eye className="h-3 w-3" /> View
                              </button>
                              <button
                                onClick={() => setResendTarget(log)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted/50"
                                data-testid={`button-resend-${log.id}`}
                              >
                                <Send className="h-3 w-3" /> Resend
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {logs.length > 0 && (
              <div className="px-4 py-3 border-t border-border/30 text-xs text-muted-foreground">
                {logs.length} email{logs.length !== 1 ? "s" : ""} {hasFilters ? "matching filters" : "total"}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="message-runs" className="mt-0">
          <MessageRunsTab events={events} sponsors={sponsors} />
        </TabsContent>

        <TabsContent value="templates" className="mt-0">
          <EmailTemplatesTab />
        </TabsContent>

        <TabsContent value="automations" className="mt-0">
          <AutomationsTab />
        </TabsContent>

        <TabsContent value="campaigns" className="mt-0">
          <CampaignsTab events={events} sponsors={sponsors} />
        </TabsContent>

        <TabsContent value="settings" className="mt-0">
          <EmailSettingsTab />
        </TabsContent>

        <TabsContent value="scheduled" className="mt-0">
          <ScheduledEmailsTab events={events} sponsors={sponsors} />
        </TabsContent>
      </Tabs>

      {/* Detail Drawer */}
      <Sheet open={!!selectedLog} onOpenChange={(o) => { if (!o) setSelectedLog(null); }}>
        <SheetContent side="right" className="w-[600px] sm:max-w-[600px] flex flex-col">
          <SheetHeader className="pb-4 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-base font-display">
              <Mail className="h-4 w-4 text-accent" />
              Email Detail
            </SheetTitle>
          </SheetHeader>
          {selectedLog && (
            <div className="flex-1 overflow-y-auto py-4 space-y-5">
              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Type</p>
                  <TypeBadge type={selectedLog.emailType} />
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Status</p>
                  <StatusBadge status={selectedLog.status} />
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Recipient</p>
                  <p className="text-sm font-mono font-medium">{selectedLog.recipientEmail}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3 col-span-2">
                  <p className="text-xs text-muted-foreground mb-1">Subject</p>
                  <p className="text-sm font-medium">{selectedLog.subject}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sent At</p>
                  <p className="text-sm">{fmtSentAt(selectedLog.sentAt)}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Event</p>
                  <p className="text-sm">{getEventSlug(selectedLog.eventId) ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Sponsor</p>
                  <p className="text-sm">{getSponsorName(selectedLog.sponsorId) ?? "—"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Source</p>
                  <p className="text-sm">{selectedLog.source ?? "Unknown"}</p>
                </div>
                <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground mb-1">Template</p>
                  <p className="text-sm">{getTemplateName(selectedLog.templateId) ?? (selectedLog.templateId ? selectedLog.templateId : "—")}</p>
                </div>
                {selectedLog.resendOfId && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs text-amber-600 mb-1">Resend of</p>
                    <p className="text-xs font-mono text-amber-700 truncate">{selectedLog.resendOfId}</p>
                  </div>
                )}
                {selectedLog.errorMessage && (
                  <div className="rounded-lg border border-red-200 bg-red-50 p-3 col-span-2">
                    <p className="text-xs text-red-600 mb-1 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Error</p>
                    <p className="text-xs text-red-700 font-mono">{selectedLog.errorMessage}</p>
                  </div>
                )}
              </div>

              {/* Delivery Timeline */}
              {(selectedLog.providerMessageId || selectedLog.deliveredAt || selectedLog.openedAt || selectedLog.clickedAt || selectedLog.bouncedAt) && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Delivery Timeline</p>
                  <div className="rounded-lg border border-border/50 bg-muted/10 divide-y divide-border/30">
                    {selectedLog.providerMessageId && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">Provider Message ID</span>
                        <span className="text-xs font-mono text-foreground truncate max-w-[260px]">{selectedLog.providerMessageId}</span>
                      </div>
                    )}
                    {selectedLog.sentAt && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-blue-700"><MailCheck className="h-3 w-3" /> Sent</div>
                        <span className="text-xs text-muted-foreground">{fmtSentAt(selectedLog.sentAt)}</span>
                      </div>
                    )}
                    {selectedLog.deliveredAt && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-green-700"><CheckCircle2 className="h-3 w-3" /> Delivered</div>
                        <span className="text-xs text-muted-foreground">{fmtSentAt(selectedLog.deliveredAt)}</span>
                      </div>
                    )}
                    {selectedLog.openedAt && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-purple-700"><Eye className="h-3 w-3" /> Opened</div>
                        <span className="text-xs text-muted-foreground">{fmtSentAt(selectedLog.openedAt)}</span>
                      </div>
                    )}
                    {selectedLog.clickedAt && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-indigo-700"><ChevronRight className="h-3 w-3" /> Clicked</div>
                        <span className="text-xs text-muted-foreground">{fmtSentAt(selectedLog.clickedAt)}</span>
                      </div>
                    )}
                    {selectedLog.bouncedAt && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-1.5 text-xs text-red-700"><RotateCcw className="h-3 w-3" /> Bounced</div>
                        <span className="text-xs text-muted-foreground">{fmtSentAt(selectedLog.bouncedAt)}</span>
                      </div>
                    )}
                    {selectedLog.bounceReason && (
                      <div className="flex items-center justify-between px-3 py-2">
                        <span className="text-xs text-muted-foreground">Bounce Reason</span>
                        <span className="text-xs text-red-700">{selectedLog.bounceReason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* HTML Preview */}
              {selectedLog.htmlContent && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Email Content</p>
                    <div className="flex gap-1">
                      <button onClick={() => setHtmlPreviewMode("preview")} className={cn("text-xs px-2 py-1 rounded", htmlPreviewMode === "preview" ? "bg-accent text-white" : "text-muted-foreground hover:bg-muted")}>Preview</button>
                      <button onClick={() => setHtmlPreviewMode("source")} className={cn("text-xs px-2 py-1 rounded flex items-center gap-1", htmlPreviewMode === "source" ? "bg-accent text-white" : "text-muted-foreground hover:bg-muted")}>
                        <Code className="h-3 w-3" /> Source
                      </button>
                    </div>
                  </div>
                  {htmlPreviewMode === "preview" ? (
                    <div className="rounded-lg border border-border/60 overflow-hidden">
                      <iframe
                        srcDoc={selectedLog.htmlContent}
                        className="w-full h-[360px] bg-white"
                        sandbox="allow-same-origin"
                        title="Email preview"
                      />
                    </div>
                  ) : (
                    <pre className="text-xs bg-muted/40 border border-border/60 rounded-lg p-3 overflow-auto max-h-[360px] font-mono whitespace-pre-wrap break-all">{selectedLog.htmlContent}</pre>
                  )}
                </div>
              )}

              {/* Resend button in drawer */}
              <div className="pt-2 border-t border-border/40">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={() => { setResendTarget(selectedLog); }}
                >
                  <Send className="h-3.5 w-3.5" /> Resend This Email
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Resend Confirmation */}
      <AlertDialog open={!!resendTarget} onOpenChange={(o) => { if (!o) setResendTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resend this email?</AlertDialogTitle>
            <AlertDialogDescription>
              This will resend the email to <strong>{resendTarget?.recipientEmail}</strong> and create a new log entry. The original email record will not be modified.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => resendTarget && resendMutation.mutate(resendTarget)}
              disabled={resendMutation.isPending}
              data-testid="button-confirm-resend"
            >
              {resendMutation.isPending ? "Sending…" : "Resend"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Test Email Dialog */}
      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="h-4 w-4 text-accent" />
              Send Test Email
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">To Email</label>
              <Input
                type="email"
                placeholder="recipient@example.com"
                value={testTo}
                onChange={(e) => setTestTo(e.target.value)}
                data-testid="input-test-email-to"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Email Type</label>
              <select
                className="w-full h-9 text-sm rounded-lg border border-border/60 bg-background px-3 focus:outline-none focus:ring-1 focus:ring-accent/40"
                value={testType}
                onChange={(e) => setTestType(e.target.value)}
                data-testid="select-test-email-type"
              >
                {EMAIL_TYPES.map((t) => <option key={t} value={t}>{EMAIL_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">This will send a demo email using sample data to verify formatting and delivery.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)}>Cancel</Button>
            <Button
              onClick={() => testMutation.mutate()}
              disabled={!testTo || testMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-send-test"
            >
              {testMutation.isPending ? <><RefreshCw className="h-3.5 w-3.5 animate-spin" /> Sending…</> : <><Send className="h-3.5 w-3.5" /> Send Test</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
