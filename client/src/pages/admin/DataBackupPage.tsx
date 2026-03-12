import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import type { Event, Sponsor, BackupJob } from "@shared/schema";
import {
  Shield, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Download, Play, Database, CalendarDays, Building2, AlertTriangle,
  HardDrive, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(ts: string | Date | null | undefined) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

function fmtSize(bytes: number | null | undefined) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function fmtDuration(job: BackupJob) {
  if (!job.startedAt || !job.completedAt) return "—";
  const ms = new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function staleAlert(jobs: BackupJob[], backupType: string, thresholdHours = 25): boolean {
  const last = jobs.find((j) => j.backupType === backupType && j.status === "completed");
  if (!last || !last.completedAt) return true;
  const ageMs = Date.now() - new Date(last.completedAt).getTime();
  return ageMs > thresholdHours * 60 * 60 * 1000;
}

// ── Status Badge ─────────────────────────────────────────────────────────────

const STATUS_CFG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  queued:      { label: "Queued",      className: "bg-amber-50 text-amber-700 border-amber-200",   icon: <Clock className="h-3 w-3" /> },
  in_progress: { label: "Running",     className: "bg-blue-50 text-blue-700 border-blue-200",      icon: <Loader2 className="h-3 w-3 animate-spin" /> },
  completed:   { label: "Completed",   className: "bg-teal-50 text-teal-700 border-teal-200",      icon: <CheckCircle2 className="h-3 w-3" /> },
  failed:      { label: "Failed",      className: "bg-red-50 text-red-700 border-red-200",         icon: <XCircle className="h-3 w-3" /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CFG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", cfg.className)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

const TYPE_CFG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  full:         { label: "Full System",   color: "bg-violet-50 text-violet-700 border-violet-200",  icon: <Database className="h-3 w-3" /> },
  event:        { label: "Event",         color: "bg-sky-50 text-sky-700 border-sky-200",           icon: <CalendarDays className="h-3 w-3" /> },
  sponsor_event:{ label: "Sponsor+Event", color: "bg-orange-50 text-orange-700 border-orange-200",  icon: <Building2 className="h-3 w-3" /> },
};

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CFG[type] ?? { label: type, color: "bg-muted text-muted-foreground border-border", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", cfg.color)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

// ── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({
  title, icon, value, sub, warn, className,
}: {
  title: string;
  icon: React.ReactNode;
  value: string | React.ReactNode;
  sub?: string;
  warn?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border p-4 flex flex-col gap-1", warn ? "border-amber-300 bg-amber-50" : "border-border/60 bg-card", className)}>
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon} {title}
        {warn && <AlertTriangle className="h-3 w-3 text-amber-600 ml-auto" />}
      </div>
      <p className={cn("text-lg font-display font-bold", warn ? "text-amber-800" : "text-foreground")}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

// ── Run Backup Dialog ─────────────────────────────────────────────────────────

function RunEventBackupDialog({
  open,
  onClose,
  events,
}: {
  open: boolean;
  onClose: () => void;
  events: Event[];
}) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/backups/event/${selectedEventId}`);
      return res.json();
    },
    onSuccess: (job) => {
      toast({
        title: job.status === "completed" ? "Event backup completed" : job.status === "failed" ? "Backup failed" : "Backup started",
        description: job.status === "failed" ? job.errorMessage : `Status: ${job.status}`,
        variant: job.status === "failed" ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Failed to start backup", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><CalendarDays className="h-4 w-4 text-sky-600" /> Run Event Backup</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Select an event to back up all its sponsors, meetings, attendees, deliverables, and file metadata.</p>
          <select
            className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Select event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name} ({e.slug ?? e.code})</option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selectedEventId || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="gap-2"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {mutation.isPending ? "Running…" : "Run Event Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RunSponsorBackupDialog({
  open,
  onClose,
  events,
  sponsors,
}: {
  open: boolean;
  onClose: () => void;
  events: Event[];
  sponsors: Sponsor[];
}) {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState("");
  const [selectedSponsorId, setSelectedSponsorId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/admin/backups/sponsor/${selectedSponsorId}/${selectedEventId}`);
      return res.json();
    },
    onSuccess: (job) => {
      toast({
        title: job.status === "completed" ? "Sponsor backup completed" : job.status === "failed" ? "Backup failed" : "Backup started",
        description: job.status === "failed" ? job.errorMessage : `Status: ${job.status}`,
        variant: job.status === "failed" ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
      onClose();
    },
    onError: (err: Error) => toast({ title: "Failed to start backup", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Building2 className="h-4 w-4 text-orange-600" /> Run Sponsor + Event Backup</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <p className="text-sm text-muted-foreground">Back up a single sponsor's deliverables, meetings, info requests, users, and files for a specific event.</p>
          <select
            className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
          >
            <option value="">Select event…</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </select>
          <select
            className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
            value={selectedSponsorId}
            onChange={(e) => setSelectedSponsorId(e.target.value)}
          >
            <option value="">Select sponsor…</option>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!selectedEventId || !selectedSponsorId || mutation.isPending}
            onClick={() => mutation.mutate()}
            className="gap-2"
          >
            {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {mutation.isPending ? "Running…" : "Run Sponsor Backup"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Download Button ───────────────────────────────────────────────────────────

function DownloadButton({ job }: { job: BackupJob }) {
  if (job.status !== "completed" || !job.r2ObjectKey) return <span className="text-xs text-muted-foreground">—</span>;

  function handleDownload() {
    const a = document.createElement("a");
    a.href = `/api/admin/backups/${job.id}/download`;
    a.download = job.r2ObjectKey?.split("/").pop() ?? "backup.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 gap-1 text-xs px-2" title={job.r2ObjectKey}>
      <Download className="h-3 w-3" />
      Download
    </Button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function DataBackupPage() {
  const { toast } = useToast();
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showSponsorDialog, setShowSponsorDialog] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);

  const { data: jobs = [], isLoading: jobsLoading, refetch } = useQuery<BackupJob[]>({
    queryKey: ["/api/admin/backups"],
  });

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  const fullBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backups/full");
      return res.json();
    },
    onSuccess: (job) => {
      toast({
        title: job.status === "completed" ? "Full backup completed" : job.status === "failed" ? "Backup failed" : "Backup started",
        description: job.status === "failed" ? job.errorMessage : `${fmtSize(job.fileSizeBytes)} · ${job.recordCount?.toLocaleString() ?? 0} records`,
        variant: job.status === "failed" ? "destructive" : "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/backups"] });
    },
    onError: (err: Error) => toast({ title: "Backup failed to start", description: err.message, variant: "destructive" }),
  });

  const lastFull = jobs.find((j) => j.backupType === "full" && j.status === "completed");
  const lastEvent = jobs.find((j) => j.backupType === "event" && j.status === "completed");
  const lastSponsor = jobs.find((j) => j.backupType === "sponsor_event" && j.status === "completed");
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const fullStale = staleAlert(jobs, "full");
  const eventStale = staleAlert(jobs, "event");

  function scopeLabel(job: BackupJob) {
    if (job.backupType === "full") return "All data";
    if (job.backupType === "event") return job.eventCode ?? job.eventId ?? "—";
    return `${job.eventCode ?? "?"}  /  ${job.sponsorSlug ?? "?"}`;
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Shield className="h-6 w-6 text-accent" />
            Data Backup
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Protect critical production data by backing up to Cloudflare R2. Nightly backups run automatically at 3 AM UTC.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 h-8">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Last Full Backup"
          icon={<Database className="h-3.5 w-3.5" />}
          value={lastFull ? fmtDate(lastFull.completedAt) : "Never"}
          sub={lastFull ? fmtSize(lastFull.fileSizeBytes) : undefined}
          warn={fullStale}
        />
        <SummaryCard
          title="Last Event Backup"
          icon={<CalendarDays className="h-3.5 w-3.5" />}
          value={lastEvent ? fmtDate(lastEvent.completedAt) : "Never"}
          sub={lastEvent ? lastEvent.eventCode ?? undefined : undefined}
          warn={eventStale}
        />
        <SummaryCard
          title="Last Sponsor Backup"
          icon={<Building2 className="h-3.5 w-3.5" />}
          value={lastSponsor ? fmtDate(lastSponsor.completedAt) : "Never"}
          sub={lastSponsor ? `${lastSponsor.sponsorSlug} / ${lastSponsor.eventCode}` : undefined}
        />
        <SummaryCard
          title="Failed Backups"
          icon={<XCircle className="h-3.5 w-3.5" />}
          value={failedCount}
          sub="in backup history"
          warn={failedCount > 0}
          className={failedCount > 0 ? "" : ""}
        />
      </div>

      {/* Actions */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Play className="h-4 w-4 text-accent" /> Manual Backup Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-violet-800 flex items-center gap-2"><Database className="h-4 w-4" /> Full System Backup</p>
              <p className="text-xs text-violet-600 mt-1">All events, sponsors, meetings, deliverables, attendees, email templates, and file metadata.</p>
            </div>
            <Button
              size="sm"
              disabled={fullBackupMutation.isPending}
              onClick={() => fullBackupMutation.mutate()}
              className="gap-2 bg-violet-700 hover:bg-violet-800 text-white self-start"
              data-testid="button-run-full-backup"
            >
              {fullBackupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              {fullBackupMutation.isPending ? "Running…" : "Run Full Backup"}
            </Button>
          </div>

          <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-sky-800 flex items-center gap-2"><CalendarDays className="h-4 w-4" /> Event Backup</p>
              <p className="text-xs text-sky-600 mt-1">All data scoped to a single event — attendees, sponsors, meetings, deliverables, and files.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowEventDialog(true)}
              className="gap-2 bg-sky-700 hover:bg-sky-800 text-white self-start"
              data-testid="button-run-event-backup"
            >
              <Play className="h-3.5 w-3.5" /> Run Event Backup
            </Button>
          </div>

          <div className="rounded-xl border border-orange-200 bg-orange-50 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-orange-800 flex items-center gap-2"><Building2 className="h-4 w-4" /> Sponsor + Event Backup</p>
              <p className="text-xs text-orange-600 mt-1">A single sponsor's deliverables, meetings, info requests, users, and file metadata for one event.</p>
            </div>
            <Button
              size="sm"
              onClick={() => setShowSponsorDialog(true)}
              className="gap-2 bg-orange-700 hover:bg-orange-800 text-white self-start"
              data-testid="button-run-sponsor-backup"
            >
              <Play className="h-3.5 w-3.5" /> Run Sponsor Backup
            </Button>
          </div>
        </div>
      </div>

      {/* Backup History Table */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <HardDrive className="h-4 w-4 text-accent" /> Backup History
          </h2>
          <span className="text-xs text-muted-foreground">{jobs.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 bg-muted/30">
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Type</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Scope</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Started</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Completed</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Size</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Records</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Trigger</th>
                <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {jobsLoading ? (
                <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                  Loading backup history…
                </td></tr>
              ) : jobs.length === 0 ? (
                <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">
                  <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                  <p className="font-medium">No backups yet</p>
                  <p className="text-xs mt-1">Run your first backup using the actions above.</p>
                </td></tr>
              ) : (
                jobs.map((job) => (
                  <>
                    <tr
                      key={job.id}
                      className={cn(
                        "border-b border-border/30 hover:bg-muted/20 transition-colors cursor-pointer",
                        job.status === "failed" && "bg-red-50/50",
                        expandedJobId === job.id && "bg-accent/5",
                      )}
                      onClick={() => setExpandedJobId(expandedJobId === job.id ? null : job.id)}
                    >
                      <td className="px-4 py-3"><TypeBadge type={job.backupType} /></td>
                      <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-[160px] truncate">{scopeLabel(job)}</td>
                      <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(job.startedAt)}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(job.completedAt)}</td>
                      <td className="px-4 py-3 text-xs">{fmtSize(job.fileSizeBytes)}</td>
                      <td className="px-4 py-3 text-xs">{job.recordCount?.toLocaleString() ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                          job.triggerType === "scheduled"
                            ? "bg-muted text-muted-foreground border-border"
                            : "bg-accent/10 text-accent border-accent/20",
                        )}>
                          {job.triggerType}
                        </span>
                      </td>
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <DownloadButton job={job} />
                      </td>
                    </tr>
                    {expandedJobId === job.id && (
                      <tr key={`${job.id}-expanded`} className="border-b border-border/30 bg-muted/10">
                        <td colSpan={9} className="px-6 py-4">
                          <div className="space-y-2 text-xs">
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                              <div>
                                <p className="font-semibold text-muted-foreground mb-0.5">Job ID</p>
                                <p className="font-mono break-all">{job.id}</p>
                              </div>
                              <div>
                                <p className="font-semibold text-muted-foreground mb-0.5">Duration</p>
                                <p>{fmtDuration(job)}</p>
                              </div>
                              {job.r2ObjectKey && (
                                <div className="col-span-2">
                                  <p className="font-semibold text-muted-foreground mb-0.5">R2 Object Key</p>
                                  <p className="font-mono break-all">{job.r2ObjectKey}</p>
                                </div>
                              )}
                            </div>
                            {job.errorMessage && (
                              <div className="mt-2 rounded-lg bg-red-50 border border-red-200 px-3 py-2">
                                <p className="font-semibold text-red-700 mb-0.5">Error</p>
                                <p className="text-red-600">{job.errorMessage}</p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Health Warning Banner */}
      {(fullStale || eventStale) && jobs.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Backup Health Warning</p>
            <ul className="text-xs text-amber-700 mt-1 space-y-0.5 list-disc list-inside">
              {fullStale && <li>No successful full backup in the last 25 hours. Consider running one now.</li>}
              {eventStale && <li>No successful event backup in the last 25 hours.</li>}
            </ul>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <RunEventBackupDialog
        open={showEventDialog}
        onClose={() => setShowEventDialog(false)}
        events={events}
      />
      <RunSponsorBackupDialog
        open={showSponsorDialog}
        onClose={() => setShowSponsorDialog(false)}
        events={events}
        sponsors={sponsors}
      />
    </motion.div>
  );
}
