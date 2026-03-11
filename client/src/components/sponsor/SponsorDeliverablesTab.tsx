import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, AlertTriangle, PackageCheck, FileText,
  ChevronDown, ChevronUp, Plus, Trash2, Save, X, Users, Mic,
  Briefcase, CalendarDays, Megaphone, BarChart2, ShieldCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DELIVERABLE_CATEGORIES } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

interface Registrant {
  id: string;
  agreementDeliverableId: string;
  name: string;
  title: string | null;
  email: string | null;
}

interface Speaker {
  id: string;
  agreementDeliverableId: string;
  speakerName: string;
  speakerTitle: string | null;
  speakerBio: string | null;
}

interface SponsorDeliverable {
  id: string;
  category: string;
  deliverableName: string;
  deliverableDescription: string | null;
  quantity: number | null;
  quantityUnit: string | null;
  ownerType: string;
  sponsorEditable: boolean;
  fulfillmentType: string;
  status: string;
  dueTiming: string;
  dueDate: string | null;
  sponsorFacingNote: string | null;
  isCustom: boolean;
  registrants: Registrant[];
  speakers: Speaker[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SPONSOR_STATUS_LABELS: Record<string, string> = {
  "Not Started":            "Awaiting Your Input",
  "Awaiting Sponsor Input": "Awaiting Your Input",
  "Needed":                 "Action Required",
  "In Progress":            "In Progress",
  "Submitted":              "Under Review",
  "Scheduled":              "Scheduled",
  "Delivered":              "Delivered",
  "Available After Event":  "Available After Event",
  "Approved":               "Approved",
  "Under Review":           "Under Review",
  "Issue Identified":       "Issue Identified",
  "Blocked":                "Blocked",
  "Received":               "Received",
};

const STATUS_COLOR: Record<string, string> = {
  "Awaiting Your Input":   "bg-amber-100 text-amber-800 border-amber-200",
  "Action Required":       "bg-red-100 text-red-800 border-red-200",
  "In Progress":           "bg-blue-100 text-blue-800 border-blue-200",
  "Under Review":          "bg-purple-100 text-purple-800 border-purple-200",
  "Scheduled":             "bg-sky-100 text-sky-800 border-sky-200",
  "Delivered":             "bg-emerald-100 text-emerald-800 border-emerald-200",
  "Available After Event": "bg-teal-100 text-teal-800 border-teal-200",
  "Approved":              "bg-green-100 text-green-800 border-green-200",
  "Issue Identified":      "bg-red-100 text-red-800 border-red-200",
  "Blocked":               "bg-red-100 text-red-800 border-red-200",
  "Received":              "bg-blue-100 text-blue-800 border-blue-200",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  "Company Profile":         <Briefcase className="h-4 w-4" />,
  "Event Participation":     <CalendarDays className="h-4 w-4" />,
  "Speaking & Content":      <Mic className="h-4 w-4" />,
  "Meetings & Introductions": <Users className="h-4 w-4" />,
  "Marketing & Branding":    <Megaphone className="h-4 w-4" />,
  "Post-Event Deliverables": <BarChart2 className="h-4 w-4" />,
  "Compliance":              <ShieldCheck className="h-4 w-4" />,
};

const ACTION_REQUIRED_STATUSES = new Set([
  "Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked",
]);

function sponsorLabel(status: string): string {
  return SPONSOR_STATUS_LABELS[status] ?? status;
}

function isActionRequired(d: SponsorDeliverable): boolean {
  return d.sponsorEditable && ACTION_REQUIRED_STATUSES.has(d.status);
}

type InputType = "registrants" | "speakers" | "text" | "none";

function getInputType(d: SponsorDeliverable): InputType {
  if (!d.sponsorEditable) return "none";
  if (d.fulfillmentType === "quantity_progress") return "registrants";
  if (d.category === "Speaking & Content") return "speakers";
  return "text";
}

function dueLabelStr(d: SponsorDeliverable): string | null {
  if (d.dueDate) {
    try { return `Due ${new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`; }
    catch { return null; }
  }
  const map: Record<string, string> = {
    before_event: "Due before event",
    during_event: "During event",
    after_event:  "After event",
    not_applicable: "",
  };
  return map[d.dueTiming] ?? null;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const label = sponsorLabel(status);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[label] ?? "bg-muted text-muted-foreground border-muted")}>
      {label}
    </span>
  );
}

// ── Text editor ───────────────────────────────────────────────────────────────

function TextEditor({
  deliverableId, token, currentValue, canEdit, onSaved,
}: { deliverableId: string; token: string; currentValue: string | null; canEdit: boolean; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(currentValue ?? "");
  const { toast } = useToast();
  const qc = useQueryClient();

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverableId}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableDescription: text, status: text.trim() ? "Submitted" : "Awaiting Sponsor Input" }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token] });
      toast({ title: "Saved", description: "Your response has been saved." });
      setOpen(false);
      onSaved();
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  if (!canEdit) {
    return currentValue ? <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{currentValue}</p> : null;
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" data-testid={`btn-edit-text-${deliverableId}`} onClick={() => { setText(currentValue ?? ""); setOpen(true); }}>
        {currentValue ? "Edit Response" : "Provide Details"}
      </Button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      {currentValue && <p className="text-xs text-muted-foreground">Current value: {currentValue}</p>}
      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        className="text-sm"
        placeholder="Enter your response here..."
        data-testid={`textarea-text-${deliverableId}`}
      />
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={() => save.mutate()} disabled={save.isPending} data-testid={`btn-save-text-${deliverableId}`}>
          <Save className="h-3 w-3 mr-1" /> {save.isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(false)} data-testid={`btn-cancel-text-${deliverableId}`}>
          <X className="h-3 w-3 mr-1" /> Cancel
        </Button>
      </div>
    </div>
  );
}

// ── Registrant editor ─────────────────────────────────────────────────────────

function RegistrantEditor({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["/api/sponsor-dashboard/agreement-deliverables", token];

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/registrants?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), title: newTitle.trim() || null, email: newEmail.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setNewName(""); setNewTitle(""); setNewEmail(""); setAdding(false);
      toast({ title: "Added", description: `${newName.trim()} has been added.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (rid: string) => fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/registrants/${rid}?token=${token}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Error", description: "Could not remove entry.", variant: "destructive" }),
  });

  const total = deliverable.quantity;
  const current = deliverable.registrants.length;

  return (
    <div className="mt-3 space-y-2">
      {total && (
        <p className="text-xs text-muted-foreground">
          {current} of {total} {deliverable.quantityUnit ?? "entries"} submitted
        </p>
      )}
      {deliverable.registrants.map((r) => (
        <div key={r.id} className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm" data-testid={`registrant-row-${r.id}`}>
          <div className="flex-1 min-w-0">
            <p className="font-medium truncate">{r.name}</p>
            {r.title && <p className="text-xs text-muted-foreground">{r.title}</p>}
            {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
          </div>
          {canEdit && (
            <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(r.id)} data-testid={`btn-remove-registrant-${r.id}`}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ))}
      {canEdit && (!total || current < total) && (
        adding ? (
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <Input placeholder="Full Name *" value={newName} onChange={(e) => setNewName(e.target.value)} className="h-8 text-sm" data-testid={`input-registrant-name-${deliverable.id}`} />
            <Input placeholder="Title (optional)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} className="h-8 text-sm" data-testid={`input-registrant-title-${deliverable.id}`} />
            <Input placeholder="Email (optional)" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} className="h-8 text-sm" data-testid={`input-registrant-email-${deliverable.id}`} />
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => add.mutate()} disabled={!newName.trim() || add.isPending} data-testid={`btn-add-registrant-${deliverable.id}`}>
                <Save className="h-3 w-3 mr-1" /> {add.isPending ? "Saving…" : "Add"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setNewName(""); setNewTitle(""); setNewEmail(""); }}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdding(true)} data-testid={`btn-add-entry-${deliverable.id}`}>
            <Plus className="h-3 w-3 mr-1" /> Add Entry
          </Button>
        )
      )}
    </div>
  );
}

// ── Speaker editor ────────────────────────────────────────────────────────────

function SpeakerEditor({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ speakerName: "", speakerTitle: "", speakerBio: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["/api/sponsor-dashboard/agreement-deliverables", token];

  const add = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerName: form.speakerName.trim(), speakerTitle: form.speakerTitle.trim() || null, speakerBio: form.speakerBio.trim() || null }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setForm({ speakerName: "", speakerTitle: "", speakerBio: "" }); setAdding(false);
      toast({ title: "Speaker added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (sid: string) => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers/${sid}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ speakerName: form.speakerName.trim(), speakerTitle: form.speakerTitle.trim() || null, speakerBio: form.speakerBio.trim() || null }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setEditingId(null);
      toast({ title: "Speaker updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (sid: string) => fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers/${sid}?token=${token}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey }),
    onError: () => toast({ title: "Error", description: "Could not remove speaker.", variant: "destructive" }),
  });

  return (
    <div className="mt-3 space-y-2">
      {deliverable.speakers.map((s) => (
        <div key={s.id} data-testid={`speaker-row-${s.id}`}>
          {editingId === s.id ? (
            <div className="rounded-lg border border-dashed p-3 space-y-2">
              <Input placeholder="Speaker Name *" value={form.speakerName} onChange={(e) => setForm({ ...form, speakerName: e.target.value })} className="h-8 text-sm" />
              <Input placeholder="Title (optional)" value={form.speakerTitle} onChange={(e) => setForm({ ...form, speakerTitle: e.target.value })} className="h-8 text-sm" />
              <Textarea placeholder="Bio (optional)" value={form.speakerBio} onChange={(e) => setForm({ ...form, speakerBio: e.target.value })} rows={3} className="text-sm" />
              <div className="flex gap-2">
                <Button size="sm" className="h-7 text-xs" onClick={() => update.mutate(s.id)} disabled={!form.speakerName.trim() || update.isPending}>
                  <Save className="h-3 w-3 mr-1" /> {update.isPending ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>
                  <X className="h-3 w-3 mr-1" /> Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-medium">{s.speakerName}</p>
                {s.speakerTitle && <p className="text-xs text-muted-foreground">{s.speakerTitle}</p>}
                {s.speakerBio && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{s.speakerBio}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1 shrink-0">
                  <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => { setForm({ speakerName: s.speakerName, speakerTitle: s.speakerTitle ?? "", speakerBio: s.speakerBio ?? "" }); setEditingId(s.id); }}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(s.id)} data-testid={`btn-remove-speaker-${s.id}`}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
      {canEdit && deliverable.speakers.length === 0 && !adding && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setForm({ speakerName: "", speakerTitle: "", speakerBio: "" }); setAdding(true); }} data-testid={`btn-add-speaker-${deliverable.id}`}>
          <Plus className="h-3 w-3 mr-1" /> Add Speaker
        </Button>
      )}
      {canEdit && adding && (
        <div className="rounded-lg border border-dashed p-3 space-y-2">
          <Input placeholder="Speaker Name *" value={form.speakerName} onChange={(e) => setForm({ ...form, speakerName: e.target.value })} className="h-8 text-sm" data-testid={`input-speaker-name-${deliverable.id}`} />
          <Input placeholder="Title (optional)" value={form.speakerTitle} onChange={(e) => setForm({ ...form, speakerTitle: e.target.value })} className="h-8 text-sm" data-testid={`input-speaker-title-${deliverable.id}`} />
          <Textarea placeholder="Bio (optional)" value={form.speakerBio} onChange={(e) => setForm({ ...form, speakerBio: e.target.value })} rows={3} className="text-sm" data-testid={`textarea-speaker-bio-${deliverable.id}`} />
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={() => add.mutate()} disabled={!form.speakerName.trim() || add.isPending} data-testid={`btn-save-speaker-${deliverable.id}`}>
              <Save className="h-3 w-3 mr-1" /> {add.isPending ? "Saving…" : "Add Speaker"}
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setAdding(false)}>
              <X className="h-3 w-3 mr-1" /> Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Deliverable Row ───────────────────────────────────────────────────────────

function DeliverableRow({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const inputType = getInputType(deliverable);
  const dueLabel = dueLabelStr(deliverable);
  const isCOI = deliverable.category === "Compliance";
  const hasEditor = inputType !== "none" && canEdit;
  const description = deliverable.deliverableDescription;

  const ctaLabel = deliverable.registrants.length > 0 || deliverable.speakers.length > 0 ? "Update" :
    inputType === "registrants" ? "Provide Names" :
    inputType === "speakers" ? "Add Speaker Details" :
    "Provide Details";

  return (
    <div className="border rounded-lg bg-card overflow-hidden" data-testid={`deliverable-row-${deliverable.id}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm leading-snug">{deliverable.deliverableName}</p>
            {deliverable.isCustom && <Badge variant="outline" className="text-xs py-0">Custom</Badge>}
          </div>
          {description && !expanded && (
            <p className="text-xs text-muted-foreground line-clamp-2">{description}</p>
          )}
          {deliverable.sponsorFacingNote && !expanded && (
            <p className="text-xs text-muted-foreground italic line-clamp-1">{deliverable.sponsorFacingNote}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <StatusBadge status={deliverable.status} />
            {dueLabel && <span className="text-xs text-muted-foreground">{dueLabel}</span>}
            {deliverable.quantity && inputType === "registrants" && (
              <span className="text-xs text-muted-foreground">
                {deliverable.registrants.length} of {deliverable.quantity} {deliverable.quantityUnit ?? "submitted"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasEditor && !isCOI && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-expand-${deliverable.id}`}
            >
              {expanded ? <><X className="h-3 w-3 mr-1" />Close</> : <>{ctaLabel}</>}
            </Button>
          )}
          {(description || deliverable.sponsorFacingNote) && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-toggle-details-${deliverable.id}`}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          {deliverable.sponsorFacingNote && (
            <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">{deliverable.sponsorFacingNote}</p>
          )}
          {!isCOI && inputType === "text" && (
            <TextEditor
              deliverableId={deliverable.id}
              token={token}
              currentValue={deliverable.deliverableDescription}
              canEdit={canEdit}
              onSaved={() => {}}
            />
          )}
          {!isCOI && inputType === "registrants" && (
            <RegistrantEditor deliverable={deliverable} token={token} canEdit={canEdit} />
          )}
          {!isCOI && inputType === "speakers" && (
            <SpeakerEditor deliverable={deliverable} token={token} canEdit={canEdit} />
          )}
        </div>
      )}
    </div>
  );
}

// ── Action Required Card ──────────────────────────────────────────────────────

function ActionCard({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const inputType = getInputType(deliverable);
  const dueLabel = dueLabelStr(deliverable);

  const ctaLabel = inputType === "registrants" ? "Provide Names" :
    inputType === "speakers" ? "Add Speaker Details" :
    "Provide Details";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 overflow-hidden" data-testid={`action-card-${deliverable.id}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <p className="font-medium text-sm">{deliverable.deliverableName}</p>
          {deliverable.sponsorFacingNote && (
            <p className="text-xs text-muted-foreground">{deliverable.sponsorFacingNote}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <StatusBadge status={deliverable.status} />
            {dueLabel && <span className="text-xs text-muted-foreground">{dueLabel}</span>}
            {deliverable.quantity && inputType === "registrants" && (
              <span className="text-xs text-muted-foreground">
                {deliverable.registrants.length} of {deliverable.quantity} submitted
              </span>
            )}
          </div>
        </div>
        {canEdit && inputType !== "none" && (
          <Button
            variant="default"
            size="sm"
            className="h-7 text-xs shrink-0"
            onClick={() => setExpanded(!expanded)}
            data-testid={`btn-action-cta-${deliverable.id}`}
          >
            {expanded ? "Close" : ctaLabel}
          </Button>
        )}
      </div>
      {expanded && (
        <div className="border-t bg-white/70 dark:bg-background/20 px-4 py-3">
          {inputType === "text" && (
            <TextEditor
              deliverableId={deliverable.id}
              token={token}
              currentValue={deliverable.deliverableDescription}
              canEdit={canEdit}
              onSaved={() => setExpanded(false)}
            />
          )}
          {inputType === "registrants" && <RegistrantEditor deliverable={deliverable} token={token} canEdit={canEdit} />}
          {inputType === "speakers" && <SpeakerEditor deliverable={deliverable} token={token} canEdit={canEdit} />}
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface Props {
  token: string;
  canEdit: boolean;
}

export default function SponsorDeliverablesTab({ token, canEdit }: Props) {
  const queryKey = ["/api/sponsor-dashboard/agreement-deliverables", token];

  const { data: deliverables = [], isLoading } = useQuery<SponsorDeliverable[]>({
    queryKey,
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables?token=${token}`);
      if (!res.ok) throw new Error("Failed to load deliverables");
      return res.json();
    },
    enabled: !!token,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Clock className="h-5 w-5 animate-spin mr-2" />
        Loading deliverables…
      </div>
    );
  }

  if (deliverables.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center text-muted-foreground" data-testid="deliverables-empty">
        <PackageCheck className="h-10 w-10 mb-3 opacity-40" />
        <p className="font-medium">No deliverables are currently available for this sponsorship.</p>
      </div>
    );
  }

  // ── Summary stats ──────────────────────────────────────────────────────────

  const total = deliverables.length;
  const delivered = deliverables.filter((d) => ["Delivered", "Approved", "Available After Event"].includes(d.status)).length;
  const inProgress = deliverables.filter((d) => ["In Progress", "Scheduled", "Under Review", "Submitted", "Received"].includes(d.status)).length;
  const awaitingInput = deliverables.filter((d) => ["Awaiting Sponsor Input", "Not Started", "Needed"].includes(d.status) && d.sponsorEditable).length;
  const afterEvent = deliverables.filter((d) => d.status === "Available After Event").length;

  const pct = total > 0 ? Math.round(((delivered + inProgress) / total) * 100) : 0;

  // ── Action required items ──────────────────────────────────────────────────

  const actionItems = deliverables.filter(isActionRequired);

  // ── Group by category (in spec order) ─────────────────────────────────────

  const byCat = DELIVERABLE_CATEGORIES.reduce<Record<string, SponsorDeliverable[]>>((acc, cat) => {
    acc[cat] = deliverables.filter((d) => d.category === cat);
    return acc;
  }, {} as Record<string, SponsorDeliverable[]>);

  return (
    <div className="space-y-8" data-testid="deliverables-tab">

      {/* ── Summary Cards ──────────────────────────────────────────────────── */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">Sponsorship Summary</h2>
          <span className="text-xs text-muted-foreground">{pct}% complete</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border bg-card p-4 space-y-1" data-testid="stat-total">
            <p className="text-2xl font-bold">{total}</p>
            <p className="text-xs text-muted-foreground">Total Deliverables</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1" data-testid="stat-delivered">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
              <p className="text-2xl font-bold">{delivered}</p>
            </div>
            <p className="text-xs text-muted-foreground">Delivered</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1" data-testid="stat-in-progress">
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-blue-500" />
              <p className="text-2xl font-bold">{inProgress}</p>
            </div>
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <div className="rounded-xl border bg-card p-4 space-y-1" data-testid="stat-awaiting">
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <p className="text-2xl font-bold">{awaitingInput}</p>
            </div>
            <p className="text-xs text-muted-foreground">Awaiting Your Input</p>
          </div>
        </div>
        {afterEvent > 0 && (
          <div className="mt-3 rounded-xl border bg-card p-4 flex items-center gap-3" data-testid="stat-after-event">
            <FileText className="h-4 w-4 text-teal-500 shrink-0" />
            <div>
              <p className="text-sm font-medium">{afterEvent} deliverable{afterEvent !== 1 ? "s" : ""} available after the event</p>
              <p className="text-xs text-muted-foreground">These will be shared with you once the event concludes.</p>
            </div>
          </div>
        )}
      </section>

      {/* ── Action Required ────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Action Required From You</h2>
        {actionItems.length === 0 ? (
          <div className="rounded-xl border bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/50 px-5 py-4 flex items-center gap-3" data-testid="action-required-empty">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-300 font-medium">You're all set for now. No sponsor action is currently needed.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {actionItems.map((d) => (
              <ActionCard key={d.id} deliverable={d} token={token} canEdit={canEdit} />
            ))}
          </div>
        )}
      </section>

      {/* ── Deliverables by Category ───────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Deliverables</h2>
        {DELIVERABLE_CATEGORIES.map((cat) => {
          const items = byCat[cat];
          if (!items || items.length === 0) return null;
          return (
            <div key={cat} className="space-y-2" data-testid={`category-section-${cat}`}>
              <div className="flex items-center gap-2 pb-1 border-b">
                <span className="text-muted-foreground">{CATEGORY_ICONS[cat]}</span>
                <h3 className="text-sm font-semibold">{cat}</h3>
                <span className="text-xs text-muted-foreground ml-auto">{items.length} item{items.length !== 1 ? "s" : ""}</span>
              </div>
              {items.map((d) => (
                <DeliverableRow key={d.id} deliverable={d} token={token} canEdit={canEdit} />
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
