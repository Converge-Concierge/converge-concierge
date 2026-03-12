import { useState, Fragment } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import { format, parseISO } from "date-fns";
import {
  ArrowLeft, RefreshCw, Plus, Pencil, Trash2, RotateCcw, CheckCircle2,
  AlertCircle, Clock, Ban, FileCheck, Users, Gem, Send,
  Upload, Download, Archive, Link2, ExternalLink, File as FileIcon, X, Paperclip,
  ChevronDown, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  DELIVERABLE_CATEGORIES, DELIVERABLE_STATUSES, DELIVERABLE_OWNER_TYPES,
  DELIVERABLE_FULFILLMENT_TYPES, DELIVERABLE_DUE_TIMING_TYPES,
  FILE_CATEGORIES,
  type AgreementDeliverable,
} from "@shared/schema";
import type { Sponsor, Event } from "@shared/schema";
import {
  StructuredDeliverablePanel, hasStructuredEditor, DeliverableStructuredSummary, HelpContentPreview,
} from "@/components/admin/StructuredDeliverableEditors";

type EnrichedDeliverable = AgreementDeliverable & {
  registrantCount: number;
  speakerCount: number;
  socialEntryCount: number;
};

type EditDeliverableForm = {
  deliverableName: string;
  deliverableDescription: string;
  quantity: string;
  quantityUnit: string;
  status: string;
  dueTiming: string;
  dueDate: string;
  sponsorFacingNote: string;
  internalNote: string;
  sponsorVisible: boolean;
  ownerType: string;
  fulfillmentType: string;
  category: string;
  helpTitle: string;
  helpText: string;
  helpLink: string;
};

const STATUS_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  "Not Started":           { color: "bg-muted text-muted-foreground", icon: <Clock className="h-3 w-3" /> },
  "Awaiting Sponsor Input":{ color: "bg-amber-50 text-amber-700 border border-amber-200", icon: <AlertCircle className="h-3 w-3" /> },
  "In Progress":           { color: "bg-blue-50 text-blue-700 border border-blue-200", icon: <RefreshCw className="h-3 w-3" /> },
  "Scheduled":             { color: "bg-cyan-50 text-cyan-700 border border-cyan-200", icon: <Clock className="h-3 w-3" /> },
  "Delivered":             { color: "bg-green-50 text-green-700 border border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  "Available After Event": { color: "bg-purple-50 text-purple-700 border border-purple-200", icon: <Clock className="h-3 w-3" /> },
  "Blocked":               { color: "bg-red-50 text-red-700 border border-red-200", icon: <Ban className="h-3 w-3" /> },
  "Approved":              { color: "bg-green-100 text-green-800 border border-green-300", icon: <FileCheck className="h-3 w-3" /> },
  "Issue Identified":      { color: "bg-red-50 text-red-700 border border-red-200", icon: <AlertCircle className="h-3 w-3" /> },
  "Needed":                { color: "bg-amber-50 text-amber-700 border border-amber-200", icon: <AlertCircle className="h-3 w-3" /> },
  "Received":              { color: "bg-blue-50 text-blue-700 border border-blue-200", icon: <CheckCircle2 className="h-3 w-3" /> },
  "Under Review":          { color: "bg-purple-50 text-purple-700 border border-purple-200", icon: <RefreshCw className="h-3 w-3" /> },
};

const LEVEL_COLORS: Record<string, string> = {
  Platinum: "bg-slate-100 text-slate-700",
  Gold:     "bg-amber-50 text-amber-700",
  Silver:   "bg-gray-100 text-gray-600",
  Bronze:   "bg-orange-50 text-orange-700",
};

const FULFILLMENT_LABELS: Record<string, string> = {
  status_only: "Status Only",
  file_upload: "File Upload",
  link_proof: "Link Proof",
  quantity_progress: "Qty Progress",
  mixed: "Mixed",
};

const DUE_LABELS: Record<string, string> = {
  before_event: "Before Event",
  during_event: "During Event",
  after_event: "After Event",
  specific_date: "Specific Date",
  not_applicable: "N/A",
};

// ── FilesLinksTab ─────────────────────────────────────────────────────────────

interface FileAsset {
  id: string; category: string; originalFileName: string; mimeType: string;
  sizeBytes: number | null; uploadedByRole: string; uploadedAt: string;
  deliverableId: string | null; title: string | null; status: string;
}
interface DeliverableLink {
  id: string; deliverableId: string; title: string; url: string;
  visibility: string; addedAt: string;
}

const CATEGORY_LABEL: Record<string, string> = {
  "logos": "Logo", "headshots": "Headshots", "company-assets": "Company Assets",
  "social-graphics": "Social Graphics", "session-assets": "Session Assets",
  "promo-assets": "Promo Assets", "attendee-reports": "Attendee Reports",
  "sponsor-reports": "Sponsor Reports", "contracts": "Contracts", "internal": "Internal",
};

function formatBytes(n: number | null): string {
  if (!n) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FilesLinksTab({
  sponsorId, eventId, deliverables,
}: {
  sponsorId: string; eventId: string; deliverables: AgreementDeliverable[];
}) {
  const { toast } = useToast();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCategory, setUploadCategory] = useState<string>("logos");
  const [uploadDeliverable, setUploadDeliverable] = useState<string>("__none__");
  const [uploadTitle, setUploadTitle] = useState("");
  const [linkDeliverable, setLinkDeliverable] = useState<string>("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [replaceTarget, setReplaceTarget] = useState<string | null>(null);

  const filesKey = ["/api/files", sponsorId, eventId];
  const { data: files = [], isLoading: filesLoading } = useQuery<FileAsset[]>({
    queryKey: filesKey,
    queryFn: () => fetch(`/api/files?sponsorId=${sponsorId}&eventId=${eventId}&status=active`).then(r => r.json()),
  });

  const linksKey = ["/api/agreement/deliverables", linkDeliverable, "links"];
  const { data: links = [] } = useQuery<DeliverableLink[]>({
    queryKey: linksKey,
    queryFn: () => fetch(`/api/agreement/deliverables/${linkDeliverable}/links`).then(r => r.json()),
    enabled: !!linkDeliverable,
  });

  const archiveFile = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/files/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: filesKey }); toast({ title: "File archived" }); },
    onError: () => toast({ title: "Failed to archive file", variant: "destructive" }),
  });

  const addLink = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agreement/deliverables/${linkDeliverable}/links`, { title: linkTitle, url: linkUrl }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: linksKey });
      toast({ title: "Link added" });
      setLinkTitle(""); setLinkUrl("");
    },
    onError: () => toast({ title: "Failed to add link", variant: "destructive" }),
  });

  const deleteLink = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agreement/deliverables/${linkDeliverable}/links/${id}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: linksKey }); toast({ title: "Link removed" }); },
    onError: () => toast({ title: "Failed to remove link", variant: "destructive" }),
  });

  async function handleDownload(file: FileAsset) {
    try {
      const res = await fetch(`/api/files/${file.id}/download-url`);
      if (!res.ok) throw new Error("Failed to get download URL");
      const { downloadURL, fileName } = await res.json();
      const a = document.createElement("a");
      a.href = downloadURL; a.download = fileName ?? file.originalFileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch (e) { toast({ title: "Download failed", variant: "destructive" }); }
  }

  async function handleUpload() {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const urlResponse = await apiRequest("POST", "/api/files/upload-url", {
        category: uploadCategory, originalFileName: uploadFile.name,
        mimeType: uploadFile.type, sizeBytes: uploadFile.size,
        sponsorId, eventId,
        deliverableId: uploadDeliverable !== "__none__" ? uploadDeliverable : null,
      });
      const urlRes = await urlResponse.json() as { uploadURL: string; fileId: string; objectKey: string; storedFileName: string };
      const { uploadURL, fileId, objectKey, storedFileName } = urlRes;
      const putRes = await fetch(uploadURL, {
        method: "PUT", body: uploadFile,
        headers: { "Content-Type": uploadFile.type },
      });
      if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
      const confirmPayload: Record<string, unknown> = {
        fileId, objectKey, storedFileName, category: uploadCategory,
        originalFileName: uploadFile.name, mimeType: uploadFile.type,
        sizeBytes: uploadFile.size, sponsorId, eventId, visibility: "sponsor_private",
        title: uploadTitle || null,
        deliverableId: uploadDeliverable !== "__none__" ? uploadDeliverable : null,
      };
      if (replaceTarget) confirmPayload.replacesFileAssetId = replaceTarget;
      await apiRequest("POST", "/api/files/confirm", confirmPayload);
      queryClient.invalidateQueries({ queryKey: filesKey });
      toast({ title: "File uploaded successfully" });
      setUploadOpen(false);
      setUploadFile(null); setUploadTitle(""); setUploadDeliverable("__none__"); setReplaceTarget(null);
    } catch (e: any) {
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    } finally { setUploading(false); }
  }

  return (
    <div className="mt-4 space-y-6">
      {/* ── Files Section ──────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
            <FileIcon className="h-4 w-4 text-muted-foreground" /> Files
          </h3>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" data-testid="button-upload-file"
            onClick={() => { setUploadOpen(true); setReplaceTarget(null); }}>
            <Upload className="h-3.5 w-3.5" /> Upload File
          </Button>
        </div>
        {filesLoading ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm">Loading files…</div>
        ) : files.length === 0 ? (
          <div className="px-5 py-8 text-center text-muted-foreground text-sm" data-testid="files-empty">
            <FileIcon className="h-8 w-8 mx-auto mb-2 opacity-30" />
            No files uploaded yet for this sponsorship.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/20">
                  {["File", "Category", "Size", "Deliverable", "Uploaded By", "Date", "Actions"].map(h => (
                    <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map(file => {
                  const linkedDel = deliverables.find(d => d.id === file.deliverableId);
                  return (
                    <tr key={file.id} className="border-t border-border/30 hover:bg-muted/10" data-testid={`row-file-${file.id}`}>
                      <td className="px-4 py-2.5 max-w-xs">
                        <span className="truncate block font-medium text-foreground">{file.title || file.originalFileName}</span>
                        {file.title && <span className="text-xs text-muted-foreground truncate block">{file.originalFileName}</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge variant="outline" className="text-xs">{CATEGORY_LABEL[file.category] ?? file.category}</Badge>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatBytes(file.sizeBytes)}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground max-w-[160px]">
                        <span className="truncate block">{linkedDel?.deliverableName ?? "—"}</span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                          file.uploadedByRole === "admin" ? "bg-purple-50 text-purple-700" : "bg-blue-50 text-blue-700"
                        )}>{file.uploadedByRole === "admin" ? "Converge" : "Sponsor"}</span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(file.uploadedAt), "MMM d, yyyy")}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Download"
                            data-testid={`btn-download-file-${file.id}`} onClick={() => handleDownload(file)}>
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" title="Replace file"
                            data-testid={`btn-replace-file-${file.id}`}
                            onClick={() => {
                              setReplaceTarget(file.id);
                              setUploadCategory(file.category);
                              setUploadDeliverable(file.deliverableId ?? "__none__");
                              setUploadOpen(true);
                            }}>
                            <RefreshCw className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive/70 hover:text-destructive" title="Archive"
                            data-testid={`btn-archive-file-${file.id}`}
                            onClick={() => { if (confirm("Archive this file?")) archiveFile.mutate(file.id); }}>
                            <Archive className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Links Section ─────────────────────────────────────────────────── */}
      <div className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
        <div className="px-5 py-3 border-b border-border/50 flex items-center gap-2">
          <Paperclip className="h-4 w-4 text-muted-foreground" />
          <h3 className="font-display font-semibold text-sm text-foreground">Links by Deliverable</h3>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Select a deliverable to manage links</Label>
            <Select value={linkDeliverable} onValueChange={setLinkDeliverable}>
              <SelectTrigger className="max-w-sm" data-testid="select-link-deliverable">
                <SelectValue placeholder="Choose deliverable…" />
              </SelectTrigger>
              <SelectContent>
                {deliverables.map(d => (
                  <SelectItem key={d.id} value={d.id}>{d.deliverableName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {linkDeliverable && (
            <div className="space-y-3">
              {links.length === 0 ? (
                <p className="text-xs text-muted-foreground">No links for this deliverable yet.</p>
              ) : (
                <div className="space-y-2">
                  {links.map(link => (
                    <div key={link.id} className="flex items-center justify-between gap-3 rounded-lg border border-border/50 px-3 py-2" data-testid={`link-row-${link.id}`}>
                      <div className="flex items-center gap-2 min-w-0">
                        <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <a href={link.url} target="_blank" rel="noopener noreferrer"
                          className="text-sm text-primary hover:underline truncate flex items-center gap-1">
                          {link.title}
                          <ExternalLink className="h-3 w-3 opacity-60" />
                        </a>
                      </div>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground shrink-0"
                        data-testid={`btn-delete-link-${link.id}`}
                        onClick={() => deleteLink.mutate(link.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Add a link</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Link title" value={linkTitle} onChange={e => setLinkTitle(e.target.value)}
                    className="h-8 text-xs" data-testid="input-link-title" />
                  <Input placeholder="https://…" value={linkUrl} onChange={e => setLinkUrl(e.target.value)}
                    className="h-8 text-xs" data-testid="input-link-url" />
                </div>
                <Button size="sm" className="h-7 text-xs" disabled={!linkTitle.trim() || !linkUrl.trim() || addLink.isPending}
                  data-testid="button-add-link" onClick={() => addLink.mutate()}>
                  <Plus className="h-3 w-3 mr-1" /> Add Link
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Upload Dialog ──────────────────────────────────────────────────── */}
      <Dialog open={uploadOpen} onOpenChange={o => { if (!o && !uploading) { setUploadOpen(false); setUploadFile(null); setReplaceTarget(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{replaceTarget ? "Replace File" : "Upload File"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            {replaceTarget && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800">
                This will replace the existing file. The old file will be archived.
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger data-testid="select-upload-category"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FILE_CATEGORIES.map(c => <SelectItem key={c} value={c}>{CATEGORY_LABEL[c] ?? c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Deliverable (optional)</Label>
              <Select value={uploadDeliverable} onValueChange={setUploadDeliverable}>
                <SelectTrigger data-testid="select-upload-deliverable"><SelectValue placeholder="Not linked to a deliverable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Not linked</SelectItem>
                  {deliverables.map(d => <SelectItem key={d.id} value={d.id}>{d.deliverableName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Title (optional)</Label>
              <Input placeholder="e.g. Company Logo (Dark)" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)}
                data-testid="input-upload-title" />
            </div>
            <div className="space-y-1.5">
              <Label>File</Label>
              <input type="file" data-testid="input-upload-file"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded-md file:border file:border-border file:text-xs file:bg-white file:text-foreground hover:file:bg-muted cursor-pointer"
                onChange={e => setUploadFile(e.target.files?.[0] ?? null)} />
              {uploadFile && <p className="text-xs text-muted-foreground">{uploadFile.name} ({formatBytes(uploadFile.size)})</p>}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setUploadFile(null); setReplaceTarget(null); }} disabled={uploading}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!uploadFile || uploading} data-testid="button-confirm-upload">
              {uploading ? "Uploading…" : replaceTarget ? "Replace" : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function emptyEditForm(d?: AgreementDeliverable): EditDeliverableForm {
  return {
    deliverableName: d?.deliverableName ?? "",
    deliverableDescription: d?.deliverableDescription ?? "",
    quantity: d?.quantity !== null && d?.quantity !== undefined ? String(d.quantity) : "",
    quantityUnit: d?.quantityUnit ?? "",
    status: d?.status ?? "Not Started",
    dueTiming: d?.dueTiming ?? "not_applicable",
    dueDate: d?.dueDate ? format(new Date(d.dueDate), "yyyy-MM-dd") : "",
    sponsorFacingNote: d?.sponsorFacingNote ?? "",
    internalNote: d?.internalNote ?? "",
    sponsorVisible: d?.sponsorVisible ?? true,
    ownerType: d?.ownerType ?? "Converge",
    fulfillmentType: d?.fulfillmentType ?? "status_only",
    category: d?.category ?? "Company Profile",
    helpTitle: d?.helpTitle ?? "",
    helpText: d?.helpText ?? "",
    helpLink: d?.helpLink ?? "",
  };
}

export default function SponsorAgreementDetailPage() {
  const { sponsorId, eventId } = useParams<{ sponsorId: string; eventId: string }>();
  const [, nav] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("deliverables");
  const [editingDeliverable, setEditingDeliverable] = useState<AgreementDeliverable | null>(null);
  const [showCustomDialog, setShowCustomDialog] = useState(false);
  const [editForm, setEditForm] = useState<EditDeliverableForm>(emptyEditForm());
  const [customForm, setCustomForm] = useState<EditDeliverableForm>(emptyEditForm());
  const [expandedDeliverable, setExpandedDeliverable] = useState<string | null>(null);

  const { data: deliverables = [], isLoading } = useQuery<EnrichedDeliverable[]>({
    queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/detail?sponsorId=${sponsorId}&eventId=${eventId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!sponsorId && !!eventId,
  });

  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });

  const sponsor = sponsors.find((s) => s.id === sponsorId);
  const event = events.find((e) => e.id === eventId);
  const sponsorshipLevel = deliverables[0]?.sponsorshipLevel ?? "";
  const packageTemplateId = deliverables[0]?.packageTemplateId ?? null;

  const updateDeliverable = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      apiRequest("PATCH", `/api/agreement/deliverables/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables"] });
      toast({ title: "Deliverable updated" });
      setEditingDeliverable(null);
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteDeliverable = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/agreement/deliverables/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables"] });
      toast({ title: "Deliverable removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  const resetDeliverable = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/agreement/deliverables/${id}/reset`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Reset to template default" });
    },
    onError: (e: any) => toast({ title: e?.message ?? "Reset failed", variant: "destructive" }),
  });

  type ReminderLog = { id: string; sentAt: string; reminderType: string; recipientEmail: string; deliverableCount: number; status: string };
  const { data: reminderHistory = [], refetch: refetchReminders } = useQuery<ReminderLog[]>({
    queryKey: ["/api/agreement/reminders", sponsorId, eventId],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/reminders?sponsorId=${sponsorId}&eventId=${eventId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!sponsorId && !!eventId,
  });

  const sendReminder = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agreement/reminders/send", { sponsorId, eventId }),
    onSuccess: async (res) => {
      const data = await res.json();
      toast({ title: `Reminder sent — ${data.deliverableCount} item${data.deliverableCount !== 1 ? "s" : ""} included` });
      refetchReminders();
    },
    onError: async (err: any) => {
      const msg = err?.message ?? "Send failed";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const createCustomDeliverable = useMutation({
    mutationFn: (data: object) => apiRequest("POST", "/api/agreement/deliverables", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables"] });
      toast({ title: "Custom deliverable added" });
      setShowCustomDialog(false);
      setCustomForm(emptyEditForm());
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const regenerate = useMutation({
    mutationFn: () => apiRequest("POST", "/api/agreement/generate/regenerate", {
      sponsorId, eventId, packageTemplateId, sponsorshipLevel,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables"] });
      toast({ title: "Agreement regenerated from template" });
    },
    onError: () => toast({ title: "Regeneration failed", variant: "destructive" }),
  });

  // Computed stats
  const total = deliverables.length;
  const delivered = deliverables.filter((d) => d.status === "Delivered" || d.status === "Approved").length;
  const inProgress = deliverables.filter((d) => ["In Progress", "Scheduled", "Under Review", "Received"].includes(d.status)).length;
  const awaitingSponsor = deliverables.filter((d) => d.status === "Awaiting Sponsor Input").length;
  const blocked = deliverables.filter((d) => d.status === "Blocked" || d.status === "Issue Identified").length;
  const compliance = deliverables.filter((d) => d.category === "Compliance" && d.status !== "Approved").length;
  const overridden = deliverables.filter((d) => d.isOverridden).length;
  const custom = deliverables.filter((d) => d.isCustom).length;
  const completionPct = total > 0 ? Math.round((delivered / total) * 100) : 0;

  const byCategory = DELIVERABLE_CATEGORIES.reduce((acc, cat) => {
    acc[cat] = deliverables.filter((d) => d.category === cat).sort((a, b) => a.displayOrder - b.displayOrder);
    return acc;
  }, {} as Record<string, EnrichedDeliverable[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground -ml-2" onClick={() => nav("/admin/agreement?tab=sponsor-agreements")}>
        <ArrowLeft className="h-4 w-4" /> Agreement Deliverables
      </Button>

      {/* Header card */}
      <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <h1 className="text-xl font-display font-bold text-foreground">
                  {sponsor?.name ?? sponsorId}
                </h1>
                {sponsorshipLevel && (
                  <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold", LEVEL_COLORS[sponsorshipLevel] ?? "bg-muted text-muted-foreground")}>
                    {sponsorshipLevel === "Platinum" && <Gem className="h-2.5 w-2.5" />}
                    {sponsorshipLevel}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {event?.name ?? eventId}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline" size="sm" className="gap-1.5"
                onClick={() => setShowCustomDialog(true)}
                data-testid="button-add-custom"
              >
                <Plus className="h-3.5 w-3.5" /> Add Custom Deliverable
              </Button>
              {packageTemplateId && (
                <Button
                  variant="outline" size="sm" className="gap-1.5"
                  onClick={() => regenerate.mutate()}
                  disabled={regenerate.isPending}
                  data-testid="button-regenerate"
                >
                  {regenerate.isPending
                    ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    : <RotateCcw className="h-3.5 w-3.5" />
                  }
                  Regenerate from Template
                </Button>
              )}
              <Button
                size="sm" className="gap-1.5"
                onClick={() => sendReminder.mutate()}
                disabled={sendReminder.isPending}
                data-testid="button-send-reminder"
                title="Send reminder email for all outstanding reminder-eligible items"
              >
                {sendReminder.isPending ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                Send Reminder
              </Button>
            </div>
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
            <div className="flex items-center gap-2">
              <div className="h-9 w-9 rounded-full bg-muted/50 border-2 border-muted flex items-center justify-center">
                <span className="text-xs font-bold text-foreground">{completionPct}%</span>
              </div>
              <span className="text-sm text-muted-foreground">Complete</span>
            </div>
            {[
              { label: "Total", value: total, color: "" },
              { label: "Delivered", value: delivered, color: "text-green-700" },
              { label: "In Progress", value: inProgress, color: "text-blue-700" },
              { label: "Awaiting", value: awaitingSponsor, color: "text-amber-700" },
              { label: "Blocked", value: blocked, color: "text-red-700" },
              { label: "Compliance", value: compliance, color: compliance > 0 ? "text-red-700" : "text-muted-foreground" },
            ].map(({ label, value, color }) => (
              <div key={label} className="text-center">
                <p className={cn("text-lg font-display font-bold leading-none", color || "text-foreground")}>{value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">{label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Deliverables Timeline */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/20">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2.5">Deliverables Progress</p>
          <div className="relative">
            <div className="h-2 bg-muted/60 rounded-full overflow-hidden flex">
              {[
                { label: "Setup", range: [0, 25], color: "bg-slate-400" },
                { label: "Sponsor Inputs", range: [25, 50], color: "bg-amber-400" },
                { label: "Event Prep", range: [50, 75], color: "bg-blue-400" },
                { label: "Post Event", range: [75, 100], color: "bg-green-500" },
              ].map(({ label, range, color }, i) => {
                const segmentStart = range[0];
                const segmentEnd = range[1];
                const fill = Math.min(100, Math.max(0, ((completionPct - segmentStart) / (segmentEnd - segmentStart)) * 100));
                return (
                  <div key={label} className={`flex-1 relative ${i > 0 ? "border-l border-background/60" : ""}`}>
                    <div className={`h-full ${color} transition-all`} style={{ width: `${completionPct >= segmentStart ? Math.min(fill, 100) : 0}%` }} />
                  </div>
                );
              })}
            </div>
            <div
              className="absolute top-0 h-2 w-0.5 bg-foreground/40 shadow-sm transition-all"
              style={{ left: `calc(${completionPct}% - 1px)` }}
            />
          </div>
          <div className="flex mt-1.5">
            {["0–25% Setup", "25–50% Sponsor Inputs", "50–75% Event Prep", "75–100% Post Event"].map((label, i) => (
              <div key={label} className="flex-1 text-center">
                <span className={`text-[9px] font-semibold uppercase tracking-wide ${i * 25 <= completionPct ? "text-foreground/70" : "text-muted-foreground/40"}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="deliverables" data-testid="tab-deliverables">Deliverables</TabsTrigger>
          <TabsTrigger value="sponsor-inputs" data-testid="tab-sponsor-inputs">Sponsor Inputs</TabsTrigger>
          <TabsTrigger value="files" data-testid="tab-files">Files & Links</TabsTrigger>
        </TabsList>

        {/* Overview tab */}
        <TabsContent value="overview" className="mt-4">
          <div className="bg-white border border-border rounded-xl p-6 shadow-sm space-y-4">
            <h3 className="font-display font-semibold text-base text-foreground">Agreement Summary</h3>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Package Template</p>
                <p className="font-medium text-foreground">{packageTemplateId ? `Template ID: ${packageTemplateId.slice(0, 8)}…` : "Custom / No Template"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Sponsorship Level</p>
                <p className="font-medium text-foreground">{sponsorshipLevel || "—"}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Overridden Items</p>
                <p className={cn("font-medium", overridden > 0 ? "text-amber-700" : "text-muted-foreground")}>{overridden}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Custom Items</p>
                <p className={cn("font-medium", custom > 0 ? "text-blue-700" : "text-muted-foreground")}>{custom}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Awaiting Sponsor Input</p>
                <p className={cn("font-medium", awaitingSponsor > 0 ? "text-amber-700" : "text-muted-foreground")}>{awaitingSponsor}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-xs uppercase tracking-wide mb-1">Compliance Issues</p>
                <p className={cn("font-medium", compliance > 0 ? "text-red-700" : "text-muted-foreground")}>{compliance}</p>
              </div>
            </div>
            {deliverables.length === 0 && (
              <div className="pt-2 border-t border-border/50">
                <p className="text-sm text-muted-foreground">No deliverables yet. Use "Regenerate from Template" or "Add Custom Deliverable" to get started.</p>
              </div>
            )}
          </div>

          {/* Reminder History */}
          <div className="bg-white border border-border rounded-xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display font-semibold text-sm text-foreground flex items-center gap-2">
                <Send className="h-4 w-4 text-muted-foreground" /> Reminder History
              </h3>
              {reminderHistory.length > 0 && (
                <span className="text-xs text-muted-foreground">{reminderHistory.length} sent</span>
              )}
            </div>
            {reminderHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No reminders sent yet for this agreement.</p>
            ) : (
              <div className="space-y-2">
                {reminderHistory.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b border-border/50 last:border-0">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium", r.reminderType === "weekly_automatic" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700")}>
                        {r.reminderType === "weekly_automatic" ? "Auto" : "Manual"}
                      </span>
                      <span className="text-muted-foreground text-xs">{r.recipientEmail}</span>
                      <span className="text-muted-foreground text-xs">— {r.deliverableCount} item{r.deliverableCount !== 1 ? "s" : ""}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{format(new Date(r.sentAt), "MMM d, yyyy h:mm a")}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* Deliverables tab */}
        <TabsContent value="deliverables" className="mt-4 space-y-4">
          {deliverables.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted-foreground gap-3">
              <FileCheck className="h-12 w-12 opacity-20" />
              <p className="text-sm font-medium">No deliverables yet</p>
              <p className="text-xs text-center max-w-xs">
                Use "Regenerate from Template" to generate deliverables from the assigned package template.
              </p>
            </div>
          ) : (
            DELIVERABLE_CATEGORIES.map((cat) => {
              const catItems = byCategory[cat] ?? [];
              if (catItems.length === 0) return null;
              return (
                <div key={cat} className="bg-white border border-border rounded-xl overflow-hidden shadow-sm">
                  <div className="px-5 py-3 border-b border-border/50 flex items-center justify-between">
                    <h3 className="font-display font-semibold text-sm text-foreground">{cat}</h3>
                    <span className="text-xs text-muted-foreground">{catItems.length} item{catItems.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-muted/20">
                          {["Deliverable", "Qty", "Owner", "Status", "Due", "Visible", "Flags", "Actions"].map((h) => (
                            <th key={h} className="text-left px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {catItems.map((d) => {
                          const sc = STATUS_CONFIG[d.status] ?? { color: "bg-muted text-muted-foreground", icon: null };
                          return (<Fragment key={d.id}>
                            <tr className="border-t border-border/30 hover:bg-muted/10 transition-colors" data-testid={`row-deliverable-${d.id}`}>
                              <td className="px-4 py-2.5 font-medium text-foreground max-w-xs">
                                <div className="flex items-center gap-1">
                                  <span className="truncate">{d.deliverableName}</span>
                                  {hasStructuredEditor(d) && (
                                    <Button
                                      variant="ghost" size="sm" className="h-5 w-5 p-0 shrink-0"
                                      onClick={() => setExpandedDeliverable(expandedDeliverable === d.id ? null : d.id)}
                                      data-testid={`button-expand-${d.id}`}
                                    >
                                      {expandedDeliverable === d.id
                                        ? <ChevronDown className="h-3 w-3 text-accent" />
                                        : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                                    </Button>
                                  )}
                                </div>
                                {d.deliverableDescription && (
                                  <p className="text-[11px] text-muted-foreground truncate">{d.deliverableDescription}</p>
                                )}
                                <DeliverableStructuredSummary d={d} />
                              </td>
                              <td className="px-4 py-2.5 text-center text-muted-foreground text-xs">
                                {d.quantity !== null ? `${d.quantity}${d.quantityUnit ? ` ${d.quantityUnit}` : ""}` : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <span className={cn("text-xs px-1.5 py-0.5 rounded font-medium",
                                  d.ownerType === "Sponsor" ? "bg-blue-50 text-blue-700" :
                                  d.ownerType === "Converge" ? "bg-purple-50 text-purple-700" :
                                  "bg-gray-50 text-gray-600"
                                )}>
                                  {d.ownerType}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 whitespace-nowrap">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium", sc.color)}>
                                  {sc.icon}{d.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                {d.dueDate ? format(new Date(d.dueDate), "MMM d") : DUE_LABELS[d.dueTiming] ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-center text-xs text-muted-foreground">
                                {d.sponsorVisible ? "✓" : "—"}
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-1">
                                  {d.isOverridden && !d.isCustom && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 font-medium whitespace-nowrap">Override</span>
                                  )}
                                  {d.isCustom && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 font-medium whitespace-nowrap">Custom</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-2.5">
                                <div className="flex items-center gap-0.5">
                                  <Button
                                    variant="ghost" size="sm" className="h-6 w-6 p-0"
                                    onClick={() => { setEditingDeliverable(d); setEditForm(emptyEditForm(d)); }}
                                    data-testid={`button-edit-deliverable-${d.id}`}
                                  >
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  {d.createdFromTemplateItemId && d.isOverridden && (
                                    <Button
                                      variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                      onClick={() => resetDeliverable.mutate(d.id)}
                                      disabled={resetDeliverable.isPending}
                                      title="Reset to template default"
                                      data-testid={`button-reset-${d.id}`}
                                    >
                                      <RotateCcw className="h-3 w-3" />
                                    </Button>
                                  )}
                                  <Button
                                    variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                                    onClick={() => deleteDeliverable.mutate(d.id)}
                                    disabled={deleteDeliverable.isPending}
                                    data-testid={`button-delete-deliverable-${d.id}`}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                            {expandedDeliverable === d.id && hasStructuredEditor(d) && sponsorId && eventId && (
                              <tr data-testid={`expanded-${d.id}`}>
                                <td colSpan={8} className="px-4 py-2 bg-muted/10">
                                  <StructuredDeliverablePanel deliverable={d} sponsorId={sponsorId} eventId={eventId} />
                                  {(d.helpTitle || d.helpText || d.helpLink) && (
                                    <div className="mt-2">
                                      <HelpContentPreview helpTitle={d.helpTitle} helpText={d.helpText} helpLink={d.helpLink} />
                                    </div>
                                  )}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>

        {/* Sponsor Inputs tab */}
        <TabsContent value="sponsor-inputs" className="mt-4">
          {(() => {
            const OUTSTANDING_STATUSES = ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"];
            const sponsorItems = deliverables.filter(d => d.sponsorEditable);
            const outstanding = sponsorItems.filter(d => OUTSTANDING_STATUSES.includes(d.status));
            const completed = sponsorItems.filter(d => !OUTSTANDING_STATUSES.includes(d.status));
            if (sponsorItems.length === 0) {
              return (
                <div className="bg-white border border-border rounded-xl p-8 shadow-sm flex flex-col items-center gap-3 text-muted-foreground">
                  <Users className="h-12 w-12 opacity-20" />
                  <p className="text-sm font-medium">No sponsor-editable deliverables in this agreement</p>
                </div>
              );
            }
            return (
              <div className="space-y-4">
                {outstanding.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500" />
                      Action Required ({outstanding.length})
                    </h3>
                    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Item</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Category</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden sm:table-cell">Due</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground hidden md:table-cell">Sponsor Note</th>
                          </tr>
                        </thead>
                        <tbody>
                          {outstanding.map(d => (
                            <tr key={d.id} className="border-b border-border/50 last:border-0">
                              <td className="px-4 py-2.5 font-medium text-foreground">{d.deliverableName}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.category}</td>
                              <td className="px-4 py-2.5">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_CONFIG[d.status]?.color ?? "bg-muted text-muted-foreground")}>
                                  {STATUS_CONFIG[d.status]?.icon}
                                  {d.status}
                                </span>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground hidden sm:table-cell">
                                {d.dueDate ? format(new Date(d.dueDate), "MMM d, yyyy") : DUE_LABELS[d.dueTiming ?? ""] ?? "—"}
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground hidden md:table-cell max-w-48 truncate">
                                {d.sponsorFacingNote ?? <span className="opacity-40">—</span>}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                {completed.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      Completed ({completed.length})
                    </h3>
                    <div className="bg-white border border-border rounded-xl shadow-sm overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/30">
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Item</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Category</th>
                            <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {completed.map(d => (
                            <tr key={d.id} className="border-b border-border/50 last:border-0">
                              <td className="px-4 py-2.5 font-medium text-foreground">{d.deliverableName}</td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{d.category}</td>
                              <td className="px-4 py-2.5">
                                <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_CONFIG[d.status]?.color ?? "bg-muted text-muted-foreground")}>
                                  {STATUS_CONFIG[d.status]?.icon}
                                  {d.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}
        </TabsContent>

        {/* Files & Links tab */}
        <TabsContent value="files">
          {sponsorId && eventId ? (
            <FilesLinksTab sponsorId={sponsorId} eventId={eventId} deliverables={deliverables} />
          ) : (
            <div className="py-12 text-center text-muted-foreground text-sm">Loading…</div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Deliverable Dialog */}
      <Dialog open={!!editingDeliverable} onOpenChange={(o) => !o && setEditingDeliverable(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Deliverable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Editing this deliverable will mark it as overridden. The package template will not be changed.
              {editingDeliverable?.createdFromTemplateItemId && " You can reset it to the template default later."}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Deliverable Name</Label>
                <Input value={editForm.deliverableName} onChange={(e) => setEditForm((f) => ({ ...f, deliverableName: e.target.value }))} data-testid="input-edit-name" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} value={editForm.deliverableDescription} onChange={(e) => setEditForm((f) => ({ ...f, deliverableDescription: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger data-testid="select-edit-status"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner Type</Label>
                <Select value={editForm.ownerType} onValueChange={(v) => setEditForm((f) => ({ ...f, ownerType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_OWNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="0" value={editForm.quantity} onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={editForm.quantityUnit} onChange={(e) => setEditForm((f) => ({ ...f, quantityUnit: e.target.value }))} placeholder="e.g. sessions" />
              </div>
              <div className="space-y-1.5">
                <Label>Due Timing</Label>
                <Select value={editForm.dueTiming} onValueChange={(v) => setEditForm((f) => ({ ...f, dueTiming: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_DUE_TIMING_TYPES.map((t) => <SelectItem key={t} value={t}>{DUE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={editForm.dueDate} onChange={(e) => setEditForm((f) => ({ ...f, dueDate: e.target.value }))} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Sponsor-Facing Note</Label>
                <Textarea rows={2} value={editForm.sponsorFacingNote} onChange={(e) => setEditForm((f) => ({ ...f, sponsorFacingNote: e.target.value }))} placeholder="Visible to sponsor..." />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Internal Note</Label>
                <Textarea rows={2} value={editForm.internalNote} onChange={(e) => setEditForm((f) => ({ ...f, internalNote: e.target.value }))} placeholder="Internal admin notes..." />
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch id="edit-visible" checked={editForm.sponsorVisible} onCheckedChange={(v) => setEditForm((f) => ({ ...f, sponsorVisible: v }))} />
                <Label htmlFor="edit-visible" className="cursor-pointer">Visible to sponsor</Label>
              </div>
              <div className="col-span-2 pt-2 border-t border-border/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Sponsor Help Content</p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Help Title</Label>
                <Input value={editForm.helpTitle} onChange={(e) => setEditForm((f) => ({ ...f, helpTitle: e.target.value }))} placeholder="e.g. How to submit your logo files" data-testid="input-edit-help-title" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Help Text</Label>
                <Textarea rows={2} value={editForm.helpText} onChange={(e) => setEditForm((f) => ({ ...f, helpText: e.target.value }))} placeholder="Instructions shown to sponsor..." data-testid="input-edit-help-text" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Help Link</Label>
                <Input value={editForm.helpLink} onChange={(e) => setEditForm((f) => ({ ...f, helpLink: e.target.value }))} placeholder="https://example.com/guide" data-testid="input-edit-help-link" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDeliverable(null)}>Cancel</Button>
            <Button
              onClick={() => editingDeliverable && updateDeliverable.mutate({
                id: editingDeliverable.id,
                data: {
                  deliverableName: editForm.deliverableName.trim(),
                  deliverableDescription: editForm.deliverableDescription.trim() || null,
                  quantity: editForm.quantity ? parseInt(editForm.quantity) : null,
                  quantityUnit: editForm.quantityUnit.trim() || null,
                  status: editForm.status,
                  dueTiming: editForm.dueTiming,
                  dueDate: editForm.dueDate ? new Date(editForm.dueDate) : null,
                  sponsorFacingNote: editForm.sponsorFacingNote.trim() || null,
                  internalNote: editForm.internalNote.trim() || null,
                  sponsorVisible: editForm.sponsorVisible,
                  ownerType: editForm.ownerType,
                  helpTitle: editForm.helpTitle.trim() || null,
                  helpText: editForm.helpText.trim() || null,
                  helpLink: editForm.helpLink.trim() || null,
                },
              })}
              disabled={!editForm.deliverableName.trim() || updateDeliverable.isPending}
              data-testid="button-submit-edit"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Custom Deliverable Dialog */}
      <Dialog open={showCustomDialog} onOpenChange={(o) => { if (!o) { setShowCustomDialog(false); setCustomForm(emptyEditForm()); } }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Custom Deliverable</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Deliverable Name *</Label>
                <Input value={customForm.deliverableName} onChange={(e) => setCustomForm((f) => ({ ...f, deliverableName: e.target.value }))} data-testid="input-custom-name" />
              </div>
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={customForm.category} onValueChange={(v) => setCustomForm((f) => ({ ...f, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Owner Type</Label>
                <Select value={customForm.ownerType} onValueChange={(v) => setCustomForm((f) => ({ ...f, ownerType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_OWNER_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea rows={2} value={customForm.deliverableDescription} onChange={(e) => setCustomForm((f) => ({ ...f, deliverableDescription: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input type="number" min="0" value={customForm.quantity} onChange={(e) => setCustomForm((f) => ({ ...f, quantity: e.target.value }))} placeholder="—" />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Input value={customForm.quantityUnit} onChange={(e) => setCustomForm((f) => ({ ...f, quantityUnit: e.target.value }))} placeholder="e.g. sessions" />
              </div>
              <div className="space-y-1.5">
                <Label>Fulfillment Type</Label>
                <Select value={customForm.fulfillmentType} onValueChange={(v) => setCustomForm((f) => ({ ...f, fulfillmentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_FULFILLMENT_TYPES.map((t) => <SelectItem key={t} value={t}>{FULFILLMENT_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={customForm.status} onValueChange={(v) => setCustomForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Timing</Label>
                <Select value={customForm.dueTiming} onValueChange={(v) => setCustomForm((f) => ({ ...f, dueTiming: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DELIVERABLE_DUE_TIMING_TYPES.map((t) => <SelectItem key={t} value={t}>{DUE_LABELS[t]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                <Switch id="custom-visible" checked={customForm.sponsorVisible} onCheckedChange={(v) => setCustomForm((f) => ({ ...f, sponsorVisible: v }))} />
                <Label htmlFor="custom-visible" className="cursor-pointer">Visible to sponsor</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowCustomDialog(false); setCustomForm(emptyEditForm()); }}>Cancel</Button>
            <Button
              onClick={() => createCustomDeliverable.mutate({
                sponsorId, eventId,
                packageTemplateId: null,
                sponsorshipLevel: sponsorshipLevel || "Custom",
                category: customForm.category,
                deliverableName: customForm.deliverableName.trim(),
                deliverableDescription: customForm.deliverableDescription.trim() || null,
                quantity: customForm.quantity ? parseInt(customForm.quantity) : null,
                quantityUnit: customForm.quantityUnit.trim() || null,
                ownerType: customForm.ownerType,
                sponsorEditable: false,
                sponsorVisible: customForm.sponsorVisible,
                fulfillmentType: customForm.fulfillmentType,
                status: customForm.status,
                dueTiming: customForm.dueTiming,
                isOverridden: true,
                isCustom: true,
                displayOrder: deliverables.length,
              })}
              disabled={!customForm.deliverableName.trim() || createCustomDeliverable.isPending}
              data-testid="button-submit-custom"
            >
              Add Custom Deliverable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
