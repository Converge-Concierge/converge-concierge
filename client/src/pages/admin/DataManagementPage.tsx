import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import type { BackupJob, BackupScheduleConfig } from "@shared/schema";
import {
  Shield, RefreshCw, CheckCircle2, XCircle, Clock, Loader2,
  Download, Play, Database, AlertTriangle,
  HardDrive, Eye, ShieldCheck,
  FileSearch, RotateCcw, FileWarning, Info, AlertCircle,
  ArrowLeftRight, Settings2, Power, Timer,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import DataExchangePage from "./DataExchangePage";

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Denver",
  "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Asia/Tokyo", "Asia/Singapore", "Australia/Sydney",
];

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

function TypeBadge({ type }: { type: string }) {
  const isLegacy = type === "event" || type === "sponsor_event";
  const label = type === "full" ? "Full System" : type === "event" ? "Event (Legacy)" : type === "sponsor_event" ? "Sponsor+Event (Legacy)" : type;
  const color = type === "full"
    ? "bg-violet-50 text-violet-700 border-violet-200"
    : "bg-gray-100 text-gray-500 border-gray-200";
  const icon = <Database className="h-3 w-3" />;
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border", color)}>
      {icon} {label}
    </span>
  );
}

const RESTORE_READY_CFG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
  ready:             { label: "Ready",           className: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <ShieldCheck className="h-3 w-3" /> },
  unvalidated:       { label: "Unvalidated",     className: "bg-blue-50 text-blue-600 border-blue-200",          icon: <FileSearch className="h-3 w-3" /> },
  missing_manifest:  { label: "No Manifest",     className: "bg-gray-50 text-gray-600 border-gray-200",         icon: <FileWarning className="h-3 w-3" /> },
  missing_files:     { label: "Missing Files",   className: "bg-red-50 text-red-700 border-red-200",            icon: <XCircle className="h-3 w-3" /> },
  invalid_manifest:  { label: "Invalid",         className: "bg-red-50 text-red-700 border-red-200",            icon: <AlertCircle className="h-3 w-3" /> },
  schema_mismatch:   { label: "Schema Mismatch", className: "bg-amber-50 text-amber-700 border-amber-200",      icon: <AlertTriangle className="h-3 w-3" /> },
  validation_failed: { label: "Failed",          className: "bg-red-50 text-red-700 border-red-200",            icon: <XCircle className="h-3 w-3" /> },
  not_completed:     { label: "Incomplete",       className: "bg-gray-50 text-gray-500 border-gray-200",         icon: <Clock className="h-3 w-3" /> },
};

function RestoreReadyBadge({ status }: { status: string }) {
  const cfg = RESTORE_READY_CFG[status] ?? { label: status, className: "bg-muted text-muted-foreground border-border", icon: null };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border", cfg.className)}>
      {cfg.icon} {cfg.label}
    </span>
  );
}

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
    <Button variant="ghost" size="sm" onClick={handleDownload} className="h-7 gap-1 text-xs px-2" title={job.r2ObjectKey ?? undefined} data-testid={`button-download-${job.id}`}>
      <Download className="h-3 w-3" /> Download
    </Button>
  );
}

function BackupDetailDialog({ open, onClose, jobId }: { open: boolean; onClose: () => void; jobId: string | null }) {
  const { data: detail, isLoading } = useQuery<any>({
    queryKey: ["/api/admin/backups", jobId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/backups/${jobId}/detail`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load detail");
      return res.json();
    },
    enabled: !!jobId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Eye className="h-4 w-4 text-accent" /> Backup Detail</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : !detail ? (
          <p className="text-sm text-muted-foreground py-4">Failed to load backup details.</p>
        ) : (
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Backup Type</p>
                <TypeBadge type={detail.job?.backupType} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Restore Ready</p>
                <RestoreReadyBadge status={detail.restoreReady} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Status</p>
                <StatusBadge status={detail.job?.status} />
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Created</p>
                <p className="text-sm">{fmtDate(detail.job?.createdAt)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Size</p>
                <p className="text-sm">{fmtSize(detail.job?.fileSizeBytes)}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Records</p>
                <p className="text-sm">{detail.job?.recordCount?.toLocaleString() ?? "—"}</p>
              </div>
            </div>

            {detail.job?.r2ObjectKey && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">R2 Data Key</p>
                <p className="text-xs font-mono bg-muted/30 rounded px-2 py-1 break-all">{detail.job.r2ObjectKey}</p>
              </div>
            )}
            {detail.job?.manifestKey && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1">Manifest Key</p>
                <p className="text-xs font-mono bg-muted/30 rounded px-2 py-1 break-all">{detail.job.manifestKey}</p>
              </div>
            )}

            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">Validation Summary</p>
              <p className="text-sm text-muted-foreground">{detail.validationSummary}</p>
            </div>

            {detail.manifest && (
              <div className="border rounded-lg p-3 bg-muted/10">
                <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1"><FileSearch className="h-3 w-3" /> Manifest</p>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div><span className="text-muted-foreground">Type:</span> {detail.manifest.backup_type}</div>
                  <div><span className="text-muted-foreground">Scope:</span> {detail.manifest.scope}</div>
                  <div><span className="text-muted-foreground">Schema Version:</span> {detail.manifest.schema_version}</div>
                  <div><span className="text-muted-foreground">Created:</span> {fmtDate(detail.manifest.created_at)}</div>
                </div>
                {detail.manifest.record_counts && (
                  <div className="mt-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-1">Record Counts</p>
                    <div className="grid grid-cols-3 gap-1 text-xs">
                      {Object.entries(detail.manifest.record_counts).map(([k, v]) => (
                        <div key={k} className="flex justify-between bg-background/60 rounded px-2 py-0.5">
                          <span className="text-muted-foreground">{k}</span>
                          <span className="font-mono font-semibold">{(v as number).toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ValidationResultDialog({ open, onClose, result }: { open: boolean; onClose: () => void; result: any }) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-accent" /> Validation Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <RestoreReadyBadge status={result.restoreReady} />
            <span className="text-sm text-muted-foreground">Checked {fmtDate(result.checkedAt)}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className={cn("rounded-lg px-3 py-2 border", result.manifestValid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
              {result.manifestValid ? <CheckCircle2 className="h-3 w-3 text-emerald-600 inline mr-1" /> : <XCircle className="h-3 w-3 text-red-600 inline mr-1" />}
              Manifest Structure
            </div>
            <div className={cn("rounded-lg px-3 py-2 border", result.filesPresent ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
              {result.filesPresent ? <CheckCircle2 className="h-3 w-3 text-emerald-600 inline mr-1" /> : <XCircle className="h-3 w-3 text-red-600 inline mr-1" />}
              Files Present
            </div>
            <div className={cn("rounded-lg px-3 py-2 border", result.schemaCompatible ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
              {result.schemaCompatible ? <CheckCircle2 className="h-3 w-3 text-emerald-600 inline mr-1" /> : <XCircle className="h-3 w-3 text-red-600 inline mr-1" />}
              Schema Compatible
            </div>
            <div className={cn("rounded-lg px-3 py-2 border", result.payloadValid ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
              {result.payloadValid ? <CheckCircle2 className="h-3 w-3 text-emerald-600 inline mr-1" /> : <XCircle className="h-3 w-3 text-red-600 inline mr-1" />}
              Payload Valid
            </div>
          </div>
          {result.errors?.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Errors</p>
              {result.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          {result.warnings?.length > 0 && (
            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Warnings</p>
              {result.warnings.map((w: string, i: number) => <p key={i} className="text-xs text-amber-600">{w}</p>)}
            </div>
          )}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DryRunResultDialog({ open, onClose, result }: { open: boolean; onClose: () => void; result: any }) {
  if (!result) return null;
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><RotateCcw className="h-4 w-4 text-accent" /> Dry Run Result</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          {!result.valid && result.errors?.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">Errors</p>
              {result.errors.map((e: string, i: number) => <p key={i} className="text-xs text-red-600">{e}</p>)}
            </div>
          )}
          {result.valid && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="text-muted-foreground">Type:</span> <span className="font-semibold">{result.backupType}</span></div>
                <div><span className="text-muted-foreground">Scope:</span> <span className="font-semibold">{result.scope}</span></div>
                <div><span className="text-muted-foreground">Schema:</span> <span className="font-semibold">v{result.schemaVersion}</span></div>
                <div><span className="text-muted-foreground">Backup Date:</span> <span className="font-semibold">{fmtDate(result.createdAt)}</span></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Entity Counts</p>
                <div className="grid grid-cols-3 gap-1 text-xs">
                  {Object.entries(result.entityCounts).map(([k, v]) => (
                    <div key={k} className="flex justify-between bg-muted/30 rounded px-2 py-0.5">
                      <span className="text-muted-foreground">{k}</span>
                      <span className="font-mono font-semibold">{(v as number).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground mb-2">Restore Order</p>
                <div className="flex flex-wrap gap-1">
                  {result.restoreOrder.map((step: string, i: number) => (
                    <span key={step} className="inline-flex items-center gap-1 text-[10px] bg-accent/10 text-accent border border-accent/20 rounded-full px-2 py-0.5 font-semibold">
                      {i + 1}. {step}
                    </span>
                  ))}
                </div>
              </div>
              <div className={cn("rounded-lg p-3 border", result.conflicts.length > 0 ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200")}>
                <p className={cn("text-xs font-semibold mb-1", result.conflicts.length > 0 ? "text-amber-700" : "text-emerald-700")}>
                  {result.conflictSummary}
                </p>
                {result.conflicts.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.conflicts.slice(0, 20).map((c: any, i: number) => (
                      <div key={i} className="text-xs flex items-center gap-2">
                        <span className="font-mono text-amber-600 bg-amber-100 rounded px-1">{c.domain}</span>
                        <span className="text-amber-700">{c.identifier}</span>
                        <span className="text-amber-500 text-[10px]">already exists</span>
                      </div>
                    ))}
                    {result.conflicts.length > 20 && (
                      <p className="text-[10px] text-amber-600 mt-1">...and {result.conflicts.length - 20} more</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Close</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RestoreToolsSection({ jobs }: { jobs: BackupJob[] }) {
  const { toast } = useToast();
  const [selectedJobId, setSelectedJobId] = useState<string>("");
  const [validationResult, setValidationResult] = useState<any>(null);
  const [showValidation, setShowValidation] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<any>(null);
  const [showDryRun, setShowDryRun] = useState(false);

  const completedJobs = jobs.filter((j) => j.status === "completed");

  const validateMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/admin/backups/${jobId}/validate`);
      return res.json();
    },
    onSuccess: (data) => {
      setValidationResult(data);
      setShowValidation(true);
      toast({ title: data.restoreReady === "ready" ? "Backup is restore-ready" : "Validation found issues", variant: data.restoreReady === "ready" ? "default" : "destructive" });
    },
    onError: (err: Error) => toast({ title: "Validation failed", description: err.message, variant: "destructive" }),
  });

  const dryRunMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const res = await apiRequest("POST", `/api/admin/backups/${jobId}/dry-run`);
      return res.json();
    },
    onSuccess: (data) => {
      setDryRunResult(data);
      setShowDryRun(true);
      toast({ title: data.valid ? "Dry run complete" : "Dry run found issues", description: data.valid ? data.conflictSummary : data.errors?.[0], variant: data.valid ? "default" : "destructive" });
    },
    onError: (err: Error) => toast({ title: "Dry run failed", description: err.message, variant: "destructive" }),
  });

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
      <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <RotateCcw className="h-4 w-4 text-accent" /> Restore Tools
      </h2>
      <p className="text-xs text-muted-foreground">
        Validate backups and preview restore operations. Production restore is disabled — these tools verify restore readiness and simulate what a restore would do.
      </p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1 block">Select a Completed Backup</label>
          <select
            className="w-full h-9 rounded-lg border border-border/60 bg-background px-3 text-sm focus:outline-none focus:ring-1 focus:ring-accent/40"
            value={selectedJobId}
            onChange={(e) => setSelectedJobId(e.target.value)}
            data-testid="select-restore-backup"
          >
            <option value="">Select backup...</option>
            {completedJobs.map((j) => {
              const typeLabel = j.backupType === "full" ? "Full System" : j.backupType === "event" ? "Event (Legacy)" : "Sponsor+Event (Legacy)";
              const scope = j.backupType === "full" ? "All data" : j.backupType === "event" ? j.eventCode : `${j.eventCode}/${j.sponsorSlug}`;
              return (
                <option key={j.id} value={j.id}>
                  {typeLabel} — {scope} — {fmtDate(j.completedAt)} — {fmtSize(j.fileSizeBytes)}
                  {j.manifestKey ? "" : " (legacy, no manifest)"}
                </option>
              );
            })}
          </select>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-emerald-800 flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Validate Backup</p>
              <p className="text-xs text-emerald-600 mt-1">Check manifest, verify all files exist in R2, validate data structure and record counts.</p>
            </div>
            <Button
              size="sm"
              disabled={!selectedJobId || validateMutation.isPending}
              onClick={() => validateMutation.mutate(selectedJobId)}
              className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white self-start"
              data-testid="button-validate-backup"
            >
              {validateMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {validateMutation.isPending ? "Validating..." : "Validate"}
            </Button>
          </div>

          <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-bold text-indigo-800 flex items-center gap-2"><RotateCcw className="h-4 w-4" /> Dry Run Restore</p>
              <p className="text-xs text-indigo-600 mt-1">Simulate restore: show entity counts, detect conflicts with existing data, preview restore order. No data is written.</p>
            </div>
            <Button
              size="sm"
              disabled={!selectedJobId || dryRunMutation.isPending}
              onClick={() => dryRunMutation.mutate(selectedJobId)}
              className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white self-start"
              data-testid="button-dry-run-restore"
            >
              {dryRunMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
              {dryRunMutation.isPending ? "Simulating..." : "Dry Run"}
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border/40 bg-muted/10 p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1"><Info className="h-3 w-3" /> Production restore is currently disabled. Use these tools to verify backup integrity and preview what a restore would look like.</p>
      </div>

      <ValidationResultDialog open={showValidation} onClose={() => setShowValidation(false)} result={validationResult} />
      <DryRunResultDialog open={showDryRun} onClose={() => setShowDryRun(false)} result={dryRunResult} />
    </div>
  );
}

function BackupScheduleSection() {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<BackupScheduleConfig>>({});

  const { data: schedule, isLoading } = useQuery<BackupScheduleConfig>({
    queryKey: ["/api/admin/backup-schedule"],
  });

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<BackupScheduleConfig>) => {
      const res = await apiRequest("PUT", "/api/admin/backup-schedule", data);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/admin/backup-schedule"], data);
      toast({ title: "Backup schedule updated" });
      setEditing(false);
      setDraft({});
    },
    onError: (err: Error) => toast({ title: "Failed to save schedule", description: err.message, variant: "destructive" }),
  });

  if (isLoading || !schedule) {
    return (
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  const s = editing ? { ...schedule, ...draft } : schedule;

  const selectClass = "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

  return (
    <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Timer className="h-4 w-4 text-accent" /> Automatic Backup Schedule
        </h2>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" size="sm" onClick={() => { setEditing(false); setDraft({}); }} data-testid="btn-cancel-schedule">Cancel</Button>
              <Button
                size="sm"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate(draft)}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="btn-save-schedule"
              >
                {updateMutation.isPending ? "Saving..." : "Save Schedule"}
              </Button>
            </>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setDraft({}); setEditing(true); }} data-testid="btn-edit-schedule">
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Configure
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</p>
          {editing ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDraft({ ...draft, enabled: !s.enabled })}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", s.enabled ? "bg-accent" : "bg-gray-300")}
                data-testid="toggle-backup-enabled"
              >
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white transition-transform", s.enabled ? "translate-x-6" : "translate-x-1")} />
              </button>
              <span className="text-sm">{s.enabled ? "Enabled" : "Disabled"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {s.enabled ? (
                <span className="flex items-center gap-1.5 text-sm font-medium text-green-700"><Power className="h-3.5 w-3.5" /> Enabled</span>
              ) : (
                <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground"><Power className="h-3.5 w-3.5" /> Disabled</span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Frequency</p>
          <p className="text-sm font-semibold text-foreground">Daily</p>
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Time (UTC)</p>
          {editing ? (
            <Input
              type="time"
              value={s.timeUtc ?? "03:00"}
              onChange={(e) => setDraft({ ...draft, timeUtc: e.target.value })}
              className="max-w-[140px]"
              data-testid="input-backup-time"
            />
          ) : (
            <p className="text-sm font-semibold text-foreground">{s.timeUtc || "03:00"} UTC</p>
          )}
        </div>

        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Timezone</p>
          {editing ? (
            <select
              className={selectClass}
              value={s.timezone ?? "UTC"}
              onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
              data-testid="select-backup-timezone"
            >
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          ) : (
            <p className="text-sm font-semibold text-foreground">{s.timezone || "UTC"}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-border/40">
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Last Scheduled Run</p>
          <p className="text-sm text-foreground">
            {s.lastRunAt ? fmtDate(s.lastRunAt) : "No runs yet"}
            {s.lastRunStatus && (
              <span className={cn("ml-2 text-xs font-semibold", s.lastRunStatus === "success" ? "text-green-600" : "text-red-600")}>
                ({s.lastRunStatus})
              </span>
            )}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Scheduled Run</p>
          <p className="text-sm text-foreground">{s.enabled && s.nextRunAt ? fmtDate(s.nextRunAt) : "—"}</p>
        </div>
      </div>
    </div>
  );
}

function DataBackupTab() {
  const { toast } = useToast();
  const [activeSubTab, setActiveSubTab] = useState<"history" | "restore">("history");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  const { data: jobs = [], isLoading: jobsLoading, refetch } = useQuery<BackupJob[]>({
    queryKey: ["/api/admin/backups"],
  });

  const { data: schedule } = useQuery<BackupScheduleConfig>({
    queryKey: ["/api/admin/backup-schedule"],
  });

  const fullBackupMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/admin/backups/full");
      return res.json();
    },
    onSuccess: (job: any) => {
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
  const failedCount = jobs.filter((j) => j.status === "failed").length;
  const fullStale = (() => {
    if (!lastFull || !lastFull.completedAt) return true;
    const ageMs = Date.now() - new Date(lastFull.completedAt).getTime();
    return ageMs > 25 * 60 * 60 * 1000;
  })();

  function scopeLabel(job: BackupJob) {
    if (job.backupType === "full") return "All data";
    if (job.backupType === "event") return job.eventCode ?? job.eventId ?? "—";
    return `${job.eventCode ?? "?"}  /  ${job.sponsorSlug ?? "?"}`;
  }

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          title="Last Successful Backup"
          icon={<Database className="h-3.5 w-3.5" />}
          value={lastFull ? fmtDate(lastFull.completedAt) : "Never"}
          sub={lastFull ? fmtSize(lastFull.fileSizeBytes) : undefined}
          warn={fullStale}
        />
        <SummaryCard
          title="Next Scheduled Backup"
          icon={<Timer className="h-3.5 w-3.5" />}
          value={schedule?.enabled && schedule?.nextRunAt ? fmtDate(schedule.nextRunAt) : "Not scheduled"}
          sub={schedule?.enabled ? `Daily at ${schedule.timeUtc || "03:00"} UTC` : "Scheduling disabled"}
        />
        <SummaryCard
          title="Backup Status"
          icon={<Shield className="h-3.5 w-3.5" />}
          value={fullStale ? "Attention Needed" : "Healthy"}
          warn={fullStale}
          sub={failedCount > 0 ? `${failedCount} failed in history` : "No failures"}
        />
        <SummaryCard
          title="Storage Target"
          icon={<HardDrive className="h-3.5 w-3.5" />}
          value="Cloudflare R2"
          sub="Encrypted object storage"
        />
      </div>

      <BackupScheduleSection />

      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Play className="h-4 w-4 text-accent" /> Manual Backup
        </h2>
        <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-violet-800 flex items-center gap-2"><Database className="h-4 w-4" /> Full System Backup</p>
            <p className="text-xs text-violet-600 mt-1">All events, sponsors, meetings, deliverables, attendees, email templates, and file metadata.</p>
          </div>
          <Button
            size="sm"
            disabled={fullBackupMutation.isPending}
            onClick={() => fullBackupMutation.mutate()}
            className="gap-2 bg-violet-700 hover:bg-violet-800 text-white shrink-0"
            data-testid="button-run-full-backup"
          >
            {fullBackupMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            {fullBackupMutation.isPending ? "Running..." : "Run Full Backup"}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-border/40">
        <button
          onClick={() => setActiveSubTab("history")}
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-colors", activeSubTab === "history" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
          data-testid="tab-backup-history"
        >
          <HardDrive className="h-3.5 w-3.5 inline mr-1.5" />
          Backup History
        </button>
        <button
          onClick={() => setActiveSubTab("restore")}
          className={cn("px-4 py-2 text-sm font-semibold border-b-2 transition-colors", activeSubTab === "restore" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground")}
          data-testid="tab-restore-tools"
        >
          <RotateCcw className="h-3.5 w-3.5 inline mr-1.5" />
          Restore Tools
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === "history" && (
          <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <div className="bg-card rounded-2xl border border-border/60 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-accent" /> Backup History
                </h2>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{jobs.length} records</span>
                  <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 gap-1 text-xs px-2" data-testid="button-refresh-backups">
                    <RefreshCw className="h-3 w-3" /> Refresh
                  </Button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/50 bg-muted/30">
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Type</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Scope</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Status</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Restore</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Started</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Size</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Records</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Trigger</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobsLoading ? (
                      <tr><td colSpan={9} className="text-center py-12 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" /> Loading backup history...
                      </td></tr>
                    ) : jobs.length === 0 ? (
                      <tr><td colSpan={9} className="text-center py-16 text-muted-foreground">
                        <Shield className="h-8 w-8 mx-auto mb-3 text-muted-foreground/30" />
                        <p className="font-medium">No backups yet</p>
                        <p className="text-xs mt-1">Run your first backup using the action above.</p>
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
                            data-testid={`row-backup-${job.id}`}
                          >
                            <td className="px-4 py-3"><TypeBadge type={job.backupType} /></td>
                            <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-[160px] truncate">{scopeLabel(job)}</td>
                            <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                            <td className="px-4 py-3">
                              {job.status === "completed" ? (
                                job.manifestKey ? (
                                  <RestoreReadyBadge status="unvalidated" />
                                ) : (
                                  <RestoreReadyBadge status="missing_manifest" />
                                )
                              ) : job.status === "failed" ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <RestoreReadyBadge status="not_completed" />
                              )}
                            </td>
                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(job.startedAt)}</td>
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
                              <div className="flex items-center gap-1">
                                <DownloadButton job={job} />
                                {job.status === "completed" && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 gap-1 text-xs px-2"
                                    onClick={() => { setDetailJobId(job.id); setShowDetail(true); }}
                                    data-testid={`button-detail-${job.id}`}
                                  >
                                    <Eye className="h-3 w-3" /> Detail
                                  </Button>
                                )}
                              </div>
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
                                    <div>
                                      <p className="font-semibold text-muted-foreground mb-0.5">Schema Version</p>
                                      <p>{job.schemaVersion ?? "—"}</p>
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
          </motion.div>
        )}

        {activeSubTab === "restore" && (
          <motion.div key="restore" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <RestoreToolsSection jobs={jobs} />
          </motion.div>
        )}
      </AnimatePresence>

      {fullStale && jobs.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Backup Health Warning</p>
            <p className="text-xs text-amber-700 mt-1">No successful full system backup in the last 25 hours. Consider running one now.</p>
          </div>
        </div>
      )}

      <BackupDetailDialog open={showDetail} onClose={() => setShowDetail(false)} jobId={detailJobId} />
    </div>
  );
}

export default function DataManagementPage() {
  const [activeTab, setActiveTab] = useState<"exchange" | "backup">("exchange");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
          <Database className="h-6 w-6 text-accent" />
          Data Management
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Import, export, and back up your platform data from one central location.
        </p>
      </div>

      <div className="flex gap-1 border-b border-border/40">
        <button
          onClick={() => setActiveTab("exchange")}
          className={cn(
            "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2",
            activeTab === "exchange" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-data-exchange"
        >
          <ArrowLeftRight className="h-4 w-4" />
          Data Exchange
        </button>
        <button
          onClick={() => setActiveTab("backup")}
          className={cn(
            "px-5 py-2.5 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2",
            activeTab === "backup" ? "border-accent text-accent" : "border-transparent text-muted-foreground hover:text-foreground",
          )}
          data-testid="tab-data-backup"
        >
          <Shield className="h-4 w-4" />
          Data Backup
        </button>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === "exchange" && (
          <motion.div key="exchange" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <DataExchangePage />
          </motion.div>
        )}
        {activeTab === "backup" && (
          <motion.div key="backup" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <DataBackupTab />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
