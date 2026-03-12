import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { EmailLog, Event, Sponsor, EmailTemplate } from "@shared/schema";
import {
  Mail, MailCheck, MailX, RefreshCw, Send, Search, Eye,
  FlaskConical, Building2, User, AlertCircle, CheckCircle2,
  Clock, CalendarDays, X, RotateCcw, ChevronRight, Code,
  Settings2, Edit2, FileText, Layout,
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

function TemplateVariables({ variables }: { variables: string[] }) {
  if (!variables || variables.length === 0) return null;
  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Available Variables</label>
      <div className="flex flex-wrap gap-1.5">
        {variables.map((v) => (
          <code key={v} className="px-2 py-1 rounded bg-muted text-[10px] font-mono text-accent border border-border/40">
            {"{{"}{v}{"}}"}
          </code>
        ))}
      </div>
    </div>
  );
}

function EmailTemplatesTab() {
  const { toast } = useToast();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<null | "view" | "edit">(null);
  const [editState, setEditState] = useState<EmailTemplate | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState<string | null>(null);
  const [previewSource, setPreviewSource] = useState<"code" | "custom" | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendTestDialogTemplate, setSendTestDialogTemplate] = useState<EmailTemplate | null>(null);

  const { data: templates = [], isLoading } = useQuery<EmailTemplate[]>({
    queryKey: ["/api/admin/email-templates"],
  });

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
    setPreviewHtml(null);
  };

  const openEdit = (t: EmailTemplate) => {
    setEditState({ ...t });
    setSelectedId(t.id);
    setMode("edit");
    setPreviewHtml(null);
  };

  const switchToEdit = () => {
    if (freshTemplate) setEditState({ ...freshTemplate });
    setMode("edit");
    setPreviewHtml(null);
  };

  const closePanel = () => {
    setSelectedId(null);
    setMode(null);
    setEditState(null);
    setPreviewHtml(null);
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
      const recipient = testEmail || sendTestDialogTemplate?.displayName;
      toast({
        title: data.ok ? "Test email sent" : "Test failed",
        description: data.ok ? `Sent successfully` : data.message,
        variant: data.ok ? "default" : "destructive",
      });
      setSendTestDialogTemplate(null);
    },
    onError: (err: Error) => toast({ title: "Send failed", description: err.message, variant: "destructive" }),
  });

  const panelOpen = mode === "view" || mode === "edit";
  const viewData = freshTemplate ?? templates.find((t) => t.id === selectedId);

  return (
    <div className="flex gap-6 h-[calc(100vh-280px)]">
      {/* ── Template List ─────────────────────────────────── */}
      <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden flex flex-col transition-all duration-300", panelOpen ? "w-[40%]" : "w-full")}>
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
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
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">Loading templates…</td></tr>
              ) : templates.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-12 text-muted-foreground">No templates found.</td></tr>
              ) : (
                templates.map((t) => (
                  <tr key={t.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", selectedId === t.id && "bg-accent/5")}>
                    <td className="px-4 py-3 font-medium">{t.displayName}</td>
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

      {/* ── View / Edit Panel ─────────────────────────────── */}
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

            <div className="flex-1 overflow-y-auto p-6 space-y-6">

              {/* View Mode */}
              {mode === "view" && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Display Name</p>
                      <p className="text-sm font-medium">{viewData.displayName}</p>
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
                    <div className="space-y-1">
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
                      <Input placeholder="test@example.com" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} className="h-9 flex-1" />
                      <Button size="sm" disabled={!testEmail || sendTestMutation.isPending} onClick={() => sendTestMutation.mutate()} className="gap-2">
                        <Send className="h-3.5 w-3.5" /> Send
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="p-4 border-t border-border/40 bg-muted/30 flex items-center justify-between">
              <Button variant="outline" size="sm" onClick={() => previewMutation.mutate()} disabled={previewMutation.isPending} className="gap-2">
                <Eye className="h-3.5 w-3.5" /> {previewMutation.isPending ? "Loading…" : "Preview"}
              </Button>
              {mode === "edit" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setMode("view"); setPreviewHtml(null); }}>Cancel</Button>
                  <Button
                    size="sm"
                    onClick={() => editState && updateMutation.mutate({
                      displayName: editState.displayName,
                      subjectTemplate: editState.subjectTemplate,
                      htmlTemplate: editState.htmlTemplate,
                      description: editState.description,
                      isActive: editState.isActive,
                    })}
                    disabled={updateMutation.isPending || !editState}
                    className="gap-2"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" /> {updateMutation.isPending ? "Saving…" : "Save Changes"}
                  </Button>
                </div>
              )}
              {mode === "view" && (
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={closePanel}>Close</Button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Send Test Email Dialog (from row action) ─── */}
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
              <Send className="h-3.5 w-3.5" /> {sendTestMutation.isPending ? "Sending…" : "Send Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function EmailCenterPage() {
  const { toast } = useToast();

  // Filters
  const [filterType, setFilterType] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterEventId, setFilterEventId] = useState("");
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

  // Build query params
  const params = new URLSearchParams();
  if (filterType) params.set("emailType", filterType);
  if (filterStatus) params.set("status", filterStatus);
  if (filterEventId) params.set("eventId", filterEventId);
  if (filterFrom) params.set("from", filterFrom);
  if (filterTo) params.set("to", filterTo);
  if (search) params.set("search", search);

  const { data: logs = [], isLoading, refetch } = useQuery<EmailLog[]>({
    queryKey: ["/api/admin/email-logs", filterType, filterStatus, filterEventId, filterFrom, filterTo, search],
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

  const hasFilters = !!(filterType || filterStatus || filterEventId || filterFrom || filterTo || search);
  const clearFilters = () => { setFilterType(""); setFilterStatus(""); setFilterEventId(""); setFilterFrom(""); setFilterTo(""); setSearch(""); };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-6">
      <Tabs defaultValue="logs" className="w-full">
        <div className="flex items-center justify-between mb-6">
          <TabsList className="bg-muted/50 p-1">
            <TabsTrigger value="logs" className="gap-2">
              <FileText className="h-3.5 w-3.5" /> Email Logs
            </TabsTrigger>
            <TabsTrigger value="templates" className="gap-2">
              <Layout className="h-3.5 w-3.5" /> Templates
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
                Email Center
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Review sent emails, delivery status, and resend important messages.</p>
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
            <div className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
              <input type="date" className={selectClass} value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} data-testid="filter-from" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" className={selectClass} value={filterTo} onChange={(e) => setFilterTo(e.target.value)} data-testid="filter-to" />
            </div>
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input placeholder="Search recipient, subject…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-sm" data-testid="email-search" />
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
                    {["Sent At", "Type", "Recipient", "Subject", "Event", "Sponsor", "Status", "Actions"].map((h) => (
                      <th key={h} className="text-left text-xs font-semibold text-muted-foreground px-4 py-3 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr><td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">Loading email logs…</td></tr>
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-16">
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
                      return (
                        <tr key={log.id} className={cn("border-b border-border/30 hover:bg-muted/20 transition-colors", i % 2 === 1 && "bg-muted/10")} data-testid={`email-row-${log.id}`}>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtSentAt(log.sentAt)}</td>
                          <td className="px-4 py-3"><TypeBadge type={log.emailType} /></td>
                          <td className="px-4 py-3 text-xs font-mono text-foreground max-w-[180px] truncate">{log.recipientEmail}</td>
                          <td className="px-4 py-3 text-sm text-foreground max-w-[220px] truncate" title={log.subject}>{log.subject}</td>
                          <td className="px-4 py-3">
                            {eventSlug ? <span className="text-xs font-mono font-semibold text-accent bg-accent/10 px-2 py-0.5 rounded">{eventSlug}</span> : <span className="text-xs text-muted-foreground">—</span>}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{sponsorName ?? "—"}</td>
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

        <TabsContent value="templates" className="mt-0">
          <EmailTemplatesTab />
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
