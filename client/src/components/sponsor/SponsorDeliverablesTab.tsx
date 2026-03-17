import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, Clock, AlertTriangle, PackageCheck, FileText,
  ChevronUp, Plus, Trash2, Save, X, Users, Mic,
  Briefcase, CalendarDays, Megaphone, BarChart2, ShieldCheck,
  Upload, Download, RefreshCw, Info, ExternalLink, Copy,
  Image, Link2, FileDown, Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { DELIVERABLE_CATEGORIES } from "@shared/schema";

interface Registrant {
  id: string;
  agreementDeliverableId: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  title: string | null;
  email: string | null;
  conciergeRole: string | null;
  registrationStatus: string | null;
}

interface Speaker {
  id: string;
  agreementDeliverableId: string;
  speakerName: string;
  speakerTitle: string | null;
  speakerBio: string | null;
  sessionType: string | null;
}

interface SocialEntry {
  id: string;
  deliverableId: string;
  entryType: string;
  entryIndex: number;
  title: string | null;
  url: string | null;
  fileAssetId: string | null;
  notes: string | null;
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
  helpTitle: string | null;
  helpText: string | null;
  helpLink: string | null;
  registrationAccessCode: string | null;
  registrationInstructions: string | null;
}

type StructuredType =
  | "company_description"
  | "registrations"
  | "speaking"
  | "social_graphics"
  | "social_announcements"
  | "category_words"
  | "coi"
  | "legacy_intro"
  | "sponsor_reps"
  | null;

function detectStructuredType(d: SponsorDeliverable): StructuredType {
  const n = d.deliverableName.toLowerCase();
  if (n.includes("company description")) return "company_description";
  if (n.includes("sponsor representative") || n.includes("sponsor rep")) return "sponsor_reps";
  if (n.includes("3 words") || n.includes("three words") || n.includes("what are") || n.includes("describe what you")) return "category_words";
  if (n.includes("registration")) return "registrations";
  if (n.includes("speaking") || n.includes("session")) return "speaking";
  if (n.includes("social") && (n.includes("graphic") || n.includes("media graphic"))) return "social_graphics";
  if (n.includes("social") && (n.includes("announcement") || n.includes("post"))) return "social_announcements";
  if (n.includes("meeting introduction") || n.includes("email introduction")) return "legacy_intro";
  if (n.includes("certificate of insurance") || n.includes("coi") || n.includes("general liability") || n.includes("worker")) return "coi";
  return null;
}

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

function isLogoDeliverable(d: SponsorDeliverable): boolean {
  return d.fulfillmentType === "file_upload" && d.deliverableName.toLowerCase().includes("logo");
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

function guessFileCategory(d: SponsorDeliverable): string {
  if (d.category === "Marketing & Branding") return "logos";
  if (d.category === "Speaking & Content") return "headshots";
  return "company-assets";
}

function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

// For Converge-owned deliverables, "Not Started" / "Awaiting Sponsor Input" should not
// say "Awaiting Your Input" — those statuses only make sense when the SPONSOR owns the item.
const CONVERGE_STATUS_OVERRIDE: Record<string, string> = {
  "Not Started":            "In Progress",
  "Awaiting Sponsor Input": "In Progress",
  "Needed":                 "Scheduled",
};

function StatusBadge({ status, sponsorEditable = true }: { status: string; sponsorEditable?: boolean }) {
  const label = (!sponsorEditable && CONVERGE_STATUS_OVERRIDE[status])
    ? CONVERGE_STATUS_OVERRIDE[status]
    : sponsorLabel(status);
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium", STATUS_COLOR[label] ?? "bg-muted text-muted-foreground border-muted")}>
      {label}
    </span>
  );
}

function DeliverableHelpPopover({ helpTitle, helpText, helpLink }: { helpTitle: string | null; helpText: string | null; helpLink: string | null }) {
  const [open, setOpen] = useState(false);
  if (!helpTitle && !helpText) return null;
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-700 transition-colors"
        data-testid="btn-help-info"
      >
        <Info className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">{open ? "Hide Info" : "More Info"}</span>
      </button>
      {open && (
        <div className="mt-2 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 space-y-1.5" data-testid="help-popover">
          {helpTitle && <p className="text-sm font-semibold text-foreground">{helpTitle}</p>}
          {helpText && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{helpText}</p>}
          {helpLink && (
            <a href={helpLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline">
              <ExternalLink className="h-3 w-3" /> Learn More
            </a>
          )}
        </div>
      )}
    </div>
  );
}

function CompanyDescriptionEditor({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(deliverable.deliverableDescription ?? "");
  const [saved, setSaved] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const wc = wordCount(text);
  const overLimit = wc > 1000;

  const save = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deliverableDescription: text.trim(), status: text.trim() ? "Submitted" : "Awaiting Sponsor Input" }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token] });
      toast({ title: "Company Description Saved", description: "Your description has been submitted successfully." });
      setSaved(true);
      setEditing(false);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  if (!canEdit && deliverable.deliverableDescription) {
    return <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{deliverable.deliverableDescription}</p>;
  }

  return (
    <div className="mt-3 space-y-2" data-testid={`company-desc-editor-${deliverable.id}`}>
      {saved && (
        <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
        </div>
      )}
      {!editing && canEdit ? (
        <div className="space-y-2">
          {deliverable.deliverableDescription && (
            <p className="text-sm text-muted-foreground whitespace-pre-wrap border-l-2 border-primary/20 pl-3">{deliverable.deliverableDescription}</p>
          )}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => { setText(deliverable.deliverableDescription ?? ""); setEditing(true); }} data-testid={`btn-edit-desc-${deliverable.id}`}>
            {deliverable.deliverableDescription ? "Edit Description" : "Write Description"}
          </Button>
        </div>
      ) : editing ? (
        <div className="space-y-2">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="text-sm"
            placeholder="Describe your company in up to 1000 words..."
            data-testid={`textarea-desc-${deliverable.id}`}
          />
          <div className="flex items-center justify-between">
            <span className={cn("text-xs font-medium", overLimit ? "text-red-600" : "text-muted-foreground")}>
              {wc} / 1,000 words
            </span>
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => save.mutate()} disabled={overLimit || save.isPending || !text.trim()} data-testid={`btn-save-desc-${deliverable.id}`}>
                <Save className="h-3 w-3 mr-1" /> {save.isPending ? "Saving…" : "Save"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditing(false)}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
          {overLimit && <p className="text-xs text-red-600">Please shorten your description to 1,000 words or fewer.</p>}
        </div>
      ) : null}
    </div>
  );
}

function SponsorRepEditor({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", title: "", conciergeRole: "" });
  const { toast } = useToast();
  const qc = useQueryClient();
  const queryKey = ["/api/sponsor-dashboard/agreement-deliverables", token];
  const total = deliverable.quantity;
  const current = deliverable.registrants.length;

  const add = useMutation({
    mutationFn: async () => {
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/registrants?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          email: form.email.trim() || null,
          title: form.title.trim() || null,
          conciergeRole: form.conciergeRole.trim() || null,
        }),
      });
      if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error ?? "Failed"); }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setForm({ firstName: "", lastName: "", email: "", title: "", conciergeRole: "" });
      setAdding(false);
      toast({ title: "Representative added" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const update = useMutation({
    mutationFn: async (rid: string) => {
      const name = `${form.firstName.trim()} ${form.lastName.trim()}`.trim();
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/registrants/${rid}?token=${token}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          firstName: form.firstName.trim() || null,
          lastName: form.lastName.trim() || null,
          email: form.email.trim() || null,
          title: form.title.trim() || null,
          conciergeRole: form.conciergeRole.trim() || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      setEditingId(null);
      toast({ title: "Representative updated" });
    },
    onError: () => toast({ title: "Error", description: "Could not save changes.", variant: "destructive" }),
  });

  const remove = useMutation({
    mutationFn: (rid: string) => fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/registrants/${rid}?token=${token}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast({ title: "Representative removed" });
    },
    onError: () => toast({ title: "Error", description: "Could not remove entry.", variant: "destructive" }),
  });

  const REG_STATUS_BADGE: Record<string, { label: string; cls: string }> = {
    Registered: { label: "Registered", cls: "bg-green-50 text-green-700 border-green-200" },
    "Not Registered": { label: "Not Registered", cls: "bg-gray-100 text-gray-500 border-gray-200" },
    Pending: { label: "Pending", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    Unknown: { label: "Not Registered", cls: "bg-gray-100 text-gray-500 border-gray-200" },
  };

  function repFormFields() {
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <Input placeholder="First Name *" value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} className="h-8 text-sm" data-testid={`input-rep-first-${deliverable.id}`} />
          <Input placeholder="Last Name *" value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} className="h-8 text-sm" data-testid={`input-rep-last-${deliverable.id}`} />
        </div>
        <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-8 text-sm" data-testid={`input-rep-email-${deliverable.id}`} />
        <Input placeholder="Title (optional)" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="h-8 text-sm" data-testid={`input-rep-title-${deliverable.id}`} />
        <Select value={form.conciergeRole || "__none__"} onValueChange={(v) => setForm({ ...form, conciergeRole: v === "__none__" ? "" : v })}>
          <SelectTrigger className="h-8 text-sm" data-testid={`select-rep-role-${deliverable.id}`}>
            <SelectValue placeholder="Concierge Role (optional)" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">No role selected</SelectItem>
            <SelectItem value="Account Owner">Account Owner</SelectItem>
            <SelectItem value="Representative">Representative</SelectItem>
            <SelectItem value="View Only">View Only</SelectItem>
          </SelectContent>
        </Select>
      </>
    );
  }

  return (
    <div className="mt-3 space-y-2" data-testid={`sponsor-rep-editor-${deliverable.id}`}>
      {total && (
        <p className="text-xs text-muted-foreground">
          {current} of {total} representative{total !== 1 ? "s" : ""} registered
        </p>
      )}
      {deliverable.registrants.map((r) => {
        const regStatus = r.registrationStatus ?? "Unknown";
        const badge = REG_STATUS_BADGE[regStatus] ?? REG_STATUS_BADGE.Unknown;
        return (
          <div key={r.id} data-testid={`rep-row-${r.id}`}>
            {editingId === r.id ? (
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                {repFormFields()}
                <div className="flex gap-2">
                  <Button size="sm" className="h-7 text-xs" onClick={() => update.mutate(r.id)} disabled={!form.firstName.trim() || !form.lastName.trim() || update.isPending}>
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
                  <div className="flex items-center gap-2">
                    <p className="font-medium truncate">{r.firstName || r.lastName ? `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() : r.name}</p>
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium border", badge.cls)}>
                      {badge.label}
                    </span>
                  </div>
                  {r.title && <p className="text-xs text-muted-foreground">{r.title}</p>}
                  {r.email && <p className="text-xs text-muted-foreground">{r.email}</p>}
                  {r.conciergeRole && <p className="text-xs text-muted-foreground italic">Role: {r.conciergeRole}</p>}
                </div>
                {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={() => {
                      setForm({
                        firstName: r.firstName ?? "",
                        lastName: r.lastName ?? "",
                        email: r.email ?? "",
                        title: r.title ?? "",
                        conciergeRole: r.conciergeRole ?? "",
                      });
                      setEditingId(r.id);
                    }} data-testid={`btn-edit-rep-${r.id}`}>
                      Edit
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive" onClick={() => remove.mutate(r.id)} data-testid={`btn-remove-rep-${r.id}`}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
      {canEdit && (!total || current < total) && (
        adding ? (
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            {repFormFields()}
            <div className="flex gap-2">
              <Button size="sm" className="h-7 text-xs" onClick={() => add.mutate()} disabled={!form.firstName.trim() || !form.lastName.trim() || add.isPending} data-testid={`btn-add-rep-${deliverable.id}`}>
                <Save className="h-3 w-3 mr-1" /> {add.isPending ? "Saving…" : "Add Representative"}
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setAdding(false); setForm({ firstName: "", lastName: "", email: "", title: "", conciergeRole: "" }); }}>
                <X className="h-3 w-3 mr-1" /> Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setAdding(true)} data-testid={`btn-add-rep-${deliverable.id}`}>
            <Plus className="h-3 w-3 mr-1" /> Add Representative
          </Button>
        )
      )}
      {canEdit && total && current >= total && (
        <p className="text-xs text-muted-foreground italic">All {total} representative slots have been filled.</p>
      )}
    </div>
  );
}

const FALLBACK_CATEGORIES = [
  "Payments", "Lending", "Risk Management", "Compliance", "Fraud Prevention",
  "Digital Banking", "Core Banking", "Data Analytics", "AI / Machine Learning",
  "Cybersecurity", "Wealth Management", "Treasury", "Insurance", "RegTech",
  "Open Banking", "Mobile Banking", "Cloud Infrastructure", "Identity Verification",
  "Customer Experience", "Process Automation",
];

interface EventInterestTopic { id: string; topicLabel: string; topicKey: string; }

function CategoryTagSelector({
  deliverable, token, canEdit,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean }) {
  let existingLegacy: string[] = [];
  if (deliverable.deliverableDescription) {
    try {
      const parsed = JSON.parse(deliverable.deliverableDescription);
      if (Array.isArray(parsed)) existingLegacy = parsed;
    } catch {
      existingLegacy = deliverable.deliverableDescription.split(",").map(s => s.trim()).filter(Boolean);
    }
  }

  const [tags, setTags] = useState<string[]>(existingLegacy);
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [topicSelectionsLoaded, setTopicSelectionsLoaded] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [saved, setSaved] = useState(false);
  const [suggestInput, setSuggestInput] = useState("");
  const [showSuggestBox, setShowSuggestBox] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: topicsData } = useQuery<{ topics: string[]; interestTopics: EventInterestTopic[]; eventId?: string; sponsorId?: string }>({
    queryKey: ["/api/sponsor-dashboard/event-topics", token],
    queryFn: () => fetch(`/api/sponsor-dashboard/event-topics?token=${token}`).then(r => r.json()),
  });
  const interestTopics = topicsData?.interestTopics ?? [];
  const isNewTopicMode = interestTopics.length > 0;

  const { data: existingSelections } = useQuery<{ topicId: string }[]>({
    queryKey: ["/api/sponsor-dashboard/topic-selections", token],
    queryFn: () => fetch(`/api/sponsor-dashboard/topic-selections?token=${token}`).then(r => r.json()),
    enabled: isNewTopicMode,
  });

  if (isNewTopicMode && existingSelections && !topicSelectionsLoaded) {
    const ids = existingSelections.map(s => s.topicId);
    if (ids.length > 0) setSelectedTopicIds(ids);
    setTopicSelectionsLoaded(true);
  }

  const suggestedTopics = !isNewTopicMode ? (topicsData?.topics?.length ? topicsData.topics : FALLBACK_CATEGORIES) : [];

  const save = useMutation({
    mutationFn: async () => {
      if (isNewTopicMode) {
        const selectedLabels = interestTopics.filter(t => selectedTopicIds.includes(t.id)).map(t => t.topicLabel);
        const [r1, r2] = await Promise.all([
          fetch(`/api/sponsor-dashboard/topic-selections?token=${token}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ topicIds: selectedTopicIds }),
          }),
          fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}?token=${token}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deliverableDescription: JSON.stringify(selectedLabels), status: selectedTopicIds.length > 0 ? "Submitted" : "Awaiting Sponsor Input" }),
          }),
        ]);
        if (!r1.ok || !r2.ok) throw new Error("Failed to save");
      } else {
        const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}?token=${token}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deliverableDescription: JSON.stringify(tags), status: tags.length === 3 ? "Submitted" : "Awaiting Sponsor Input" }),
        });
        if (!res.ok) throw new Error("Failed to save");
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token] });
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/topic-selections", token] });
      toast({ title: "Interests saved", description: "Your topic selections have been submitted." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast({ title: "Error", description: "Could not save selections.", variant: "destructive" }),
  });

  const suggestMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await fetch(`/api/sponsor-dashboard/suggest-topic?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicLabel: label }),
      });
      if (res.status === 409) {
        const data = await res.json();
        throw new Error(data.message ?? "A similar topic already exists");
      }
      if (!res.ok) throw new Error("Failed to suggest topic");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Topic suggested", description: "Your suggestion has been submitted for review by the event team." });
      setSuggestInput("");
      setShowSuggestBox(false);
    },
    onError: (err: any) => toast({ title: "Suggestion failed", description: err.message, variant: "destructive" }),
  });

  function addTag(val: string) {
    const trimmed = val.trim();
    if (!trimmed || tags.includes(trimmed) || tags.length >= 3) return;
    setTags([...tags, trimmed]);
    setInputVal("");
  }

  function removeTag(idx: number) {
    setTags(tags.filter((_, i) => i !== idx));
  }

  function toggleTopicId(id: string) {
    setSelectedTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const availableSuggestions = suggestedTopics.filter(s => !tags.includes(s));

  if (!canEdit) {
    const displayTags = isNewTopicMode
      ? interestTopics.filter(t => selectedTopicIds.includes(t.id)).map(t => t.topicLabel)
      : tags;
    return displayTags.length > 0 ? (
      <div className="mt-2 flex flex-wrap gap-1.5">
        {displayTags.map((t, i) => (
          <span key={i} className="px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">{t}</span>
        ))}
      </div>
    ) : null;
  }

  if (isNewTopicMode) {
    return (
      <div className="mt-3 space-y-3" data-testid={`category-selector-${deliverable.id}`}>
        {saved && (
          <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-medium">
            <CheckCircle2 className="h-3.5 w-3.5" /> Saved
          </div>
        )}
        <p className="text-xs text-muted-foreground">Select the topics that best describe your areas of focus. You can choose as many as you like.</p>

        <div className="flex flex-wrap gap-1.5">
          {interestTopics.map(t => {
            const selected = selectedTopicIds.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggleTopicId(t.id)}
                data-testid={`topic-chip-${t.id}`}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                  selected
                    ? "bg-accent text-white border-accent"
                    : "bg-white text-muted-foreground border-border hover:bg-accent/10 hover:text-accent hover:border-accent/40"
                )}
              >
                {t.topicLabel}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-1">
          <div>
            {!showSuggestBox ? (
              <button
                onClick={() => setShowSuggestBox(true)}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline hover:text-accent transition-colors"
                data-testid="btn-suggest-topic-link"
              >
                + Suggest a topic
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <Input
                  value={suggestInput}
                  onChange={e => setSuggestInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); if (suggestInput.trim()) suggestMutation.mutate(suggestInput.trim()); } if (e.key === "Escape") { setShowSuggestBox(false); setSuggestInput(""); } }}
                  placeholder="Topic name…"
                  className="h-7 text-xs w-40"
                  autoFocus
                  data-testid="input-suggest-topic"
                />
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { if (suggestInput.trim()) suggestMutation.mutate(suggestInput.trim()); }} disabled={!suggestInput.trim() || suggestMutation.isPending} data-testid="btn-submit-suggestion">
                  {suggestMutation.isPending ? "…" : "Submit"}
                </Button>
                <button onClick={() => { setShowSuggestBox(false); setSuggestInput(""); }} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{selectedTopicIds.length} selected</span>
            <Button size="sm" className="h-7 text-xs" onClick={() => save.mutate()} disabled={save.isPending} data-testid={`btn-save-tags-${deliverable.id}`}>
              <Save className="h-3 w-3 mr-1" /> {save.isPending ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-3 space-y-3" data-testid={`category-selector-${deliverable.id}`}>
      {saved && (
        <div className="flex items-center gap-1.5 text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 text-xs font-medium">
          <CheckCircle2 className="h-3.5 w-3.5" /> Saved
        </div>
      )}
      <p className="text-xs text-muted-foreground">Select exactly 3 words or short phrases that best describe what you want to sell. Pick from the suggestions below or type your own.</p>

      <div className="flex flex-wrap gap-1.5">
        {tags.map((t, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-accent/10 text-accent text-xs font-medium border border-accent/20">
            {t}
            <button onClick={() => removeTag(i)} className="hover:text-destructive"><X className="h-3 w-3" /></button>
          </span>
        ))}
      </div>

      {tags.length < 3 && (
        <>
          <div>
            <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1.5">Suggested Topics</p>
            <div className="flex flex-wrap gap-1.5">
              {availableSuggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => addTag(s)}
                  className="px-2 py-0.5 rounded-full border border-border text-xs text-muted-foreground hover:bg-accent/10 hover:text-accent hover:border-accent/30 transition-colors"
                  data-testid={`btn-suggest-tag-${s.replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(inputVal); } }}
              placeholder="Or type a custom word/phrase and press Enter"
              className="h-8 text-sm flex-1"
              data-testid={`input-tag-${deliverable.id}`}
            />
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => addTag(inputVal)} disabled={!inputVal.trim()}>
              <Plus className="h-3 w-3 mr-1" /> Add
            </Button>
          </div>
        </>
      )}

      <div className="flex items-center justify-between">
        <span className={cn("text-xs", tags.length === 3 ? "text-green-600 font-medium" : tags.length > 0 ? "text-amber-600" : "text-muted-foreground")}>
          {tags.length} / 3 selected {tags.length < 3 && tags.length > 0 ? `(${3 - tags.length} more needed)` : ""}
        </span>
        <Button size="sm" className="h-7 text-xs" onClick={() => save.mutate()} disabled={tags.length !== 3 || save.isPending} data-testid={`btn-save-tags-${deliverable.id}`}>
          <Save className="h-3 w-3 mr-1" /> {save.isPending ? "Saving…" : "Save Selections"}
        </Button>
      </div>
    </div>
  );
}

function RegistrationsInfoPanel({
  deliverable, token,
}: { deliverable: SponsorDeliverable; token: string }) {
  const { toast } = useToast();
  const total = deliverable.quantity ?? 0;
  const used = deliverable.registrants.length;
  const remaining = Math.max(0, total - used);

  const { data: files = [] } = useQuery<{ id: string; originalFileName: string; mimeType: string }[]>({
    queryKey: ["/api/sponsor-dashboard/files", token, deliverable.id, "reg-docs"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/files?token=${token}&deliverableId=${deliverable.id}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });
  const pdfFile = files.find(f => f.mimeType === "application/pdf");

  async function handleDownload(fileId: string, fileName: string) {
    try {
      const res = await fetch(`/api/sponsor-dashboard/files/${fileId}/download-url?token=${token}`);
      if (!res.ok) throw new Error("Unavailable");
      const { downloadURL } = await res.json();
      const a = document.createElement("a");
      a.href = downloadURL; a.download = fileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast({ title: "Download unavailable", variant: "destructive" }); }
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    toast({ title: "Access code copied" });
  }

  return (
    <div className="mt-3 space-y-3" data-testid={`reg-info-panel-${deliverable.id}`}>
      {deliverable.registrationAccessCode && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Access Code</p>
          <div className="flex items-center gap-2">
            <code className="bg-slate-900 text-emerald-400 px-3 py-1.5 rounded-md font-mono text-sm tracking-wider select-all" data-testid={`code-access-${deliverable.id}`}>
              {deliverable.registrationAccessCode}
            </code>
            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => copyCode(deliverable.registrationAccessCode!)}>
              <Copy className="h-3 w-3" /> Copy
            </Button>
          </div>
        </div>
      )}

      {deliverable.registrationInstructions && (
        <div className="space-y-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase">Instructions</p>
          <div className="text-sm text-muted-foreground whitespace-pre-wrap bg-muted/30 rounded-lg px-3 py-2 border">
            {deliverable.registrationInstructions}
          </div>
        </div>
      )}

      {pdfFile && (
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5" onClick={() => handleDownload(pdfFile.id, pdfFile.originalFileName)} data-testid={`btn-download-reg-pdf-${deliverable.id}`}>
          <FileDown className="h-3.5 w-3.5" /> Download Registration PDF
        </Button>
      )}

      {total > 0 && (
        <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <Users className="h-4 w-4 text-blue-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-blue-800">{remaining} seat{remaining !== 1 ? "s" : ""} remaining</p>
            <p className="text-xs text-blue-600">{used} of {total} {deliverable.quantityUnit ?? "seats"} used</p>
          </div>
        </div>
      )}

      {!deliverable.registrationAccessCode && !deliverable.registrationInstructions && !pdfFile && total === 0 && (
        <p className="text-xs text-muted-foreground italic">Registration details have not been configured yet. Check back later.</p>
      )}
    </div>
  );
}

function GraphicThumbnail({ fileAssetId, token }: { fileAssetId: string; token: string }) {
  const { data } = useQuery<{ downloadURL: string }>({
    queryKey: ["/api/sponsor-dashboard/files", fileAssetId, "thumb"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/files/${fileAssetId}/download-url?token=${token}`);
      if (!res.ok) return { downloadURL: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.downloadURL) return <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0"><Image className="h-4 w-4 text-muted-foreground/40" /></div>;
  return <img src={data.downloadURL} alt="Graphic" className="h-10 w-10 rounded object-cover border shrink-0" />;
}

function SocialGraphicsPanel({
  deliverable, token,
}: { deliverable: SponsorDeliverable; token: string }) {
  const { toast } = useToast();
  const { data: entries = [] } = useQuery<SocialEntry[]>({
    queryKey: ["/api/sponsor-dashboard/agreement-deliverables", deliverable.id, "social-entries", "graphics"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/social-entries?token=${token}`);
      if (!res.ok) return [];
      return (await res.json()).filter((e: SocialEntry) => e.entryType === "graphic");
    },
  });

  async function handleDownload(fileAssetId: string) {
    try {
      const res = await fetch(`/api/sponsor-dashboard/files/${fileAssetId}/download-url?token=${token}`);
      if (!res.ok) throw new Error("Unavailable");
      const { downloadURL, fileName } = await res.json();
      const a = document.createElement("a");
      a.href = downloadURL; a.download = fileName || "graphic.png"; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast({ title: "Download unavailable", variant: "destructive" }); }
  }

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic mt-2">Graphics have not been uploaded yet. Check back later.</p>;
  }

  return (
    <div className="mt-3 space-y-3" data-testid={`social-graphics-panel-${deliverable.id}`}>
      <div className="space-y-2">
        {entries.map((entry, i) => (
          <div key={entry.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2 border" data-testid={`graphic-slot-${entry.id}`}>
            {entry.fileAssetId ? (
              <GraphicThumbnail fileAssetId={entry.fileAssetId} token={token} />
            ) : (
              <div className="h-10 w-10 rounded bg-muted flex items-center justify-center shrink-0">
                <Image className="h-4 w-4 text-muted-foreground/40" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{entry.title || `Graphic #${i + 1}`}</p>
              {entry.fileAssetId ? (
                <p className="text-xs text-green-600">Ready to download</p>
              ) : (
                <p className="text-xs text-amber-600">Awaiting upload by admin</p>
              )}
            </div>
            {entry.fileAssetId && (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0" onClick={() => handleDownload(entry.fileAssetId!)} data-testid={`btn-download-graphic-${entry.id}`}>
                <Download className="h-3 w-3" /> Download
              </Button>
            )}
          </div>
        ))}
      </div>
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 space-y-1">
        <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
          <Link2 className="h-3.5 w-3.5" /> How to Share on LinkedIn
        </p>
        <ol className="text-xs text-blue-700 space-y-0.5 list-decimal list-inside">
          <li>Download the graphic above</li>
          <li>Go to LinkedIn and start a new post</li>
          <li>Attach the downloaded image to your post</li>
          <li>Add your own caption and relevant hashtags</li>
          <li>Publish!</li>
        </ol>
      </div>
    </div>
  );
}

function SocialAnnouncementsPanel({
  deliverable, token,
}: { deliverable: SponsorDeliverable; token: string }) {
  const { data: entries = [] } = useQuery<SocialEntry[]>({
    queryKey: ["/api/sponsor-dashboard/agreement-deliverables", deliverable.id, "social-entries", "announcements"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/social-entries?token=${token}`);
      if (!res.ok) return [];
      return (await res.json()).filter((e: SocialEntry) => e.entryType === "announcement");
    },
  });

  if (entries.length === 0) {
    return <p className="text-xs text-muted-foreground italic mt-2">Announcement posts have not been configured yet. Check back later.</p>;
  }

  return (
    <div className="mt-3 space-y-2" data-testid={`social-announcements-panel-${deliverable.id}`}>
      {entries.map((entry, i) => (
        <div key={entry.id} className="flex items-center gap-3 bg-muted/30 rounded-lg px-3 py-2.5 border" data-testid={`announcement-slot-${entry.id}`}>
          <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
            <Megaphone className="h-4 w-4 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{entry.title || `Announcement #${i + 1}`}</p>
            {entry.url ? (
              <p className="text-xs text-green-600">Post published</p>
            ) : (
              <p className="text-xs text-muted-foreground">Pending</p>
            )}
          </div>
          {entry.url && (
            <a href={entry.url} target="_blank" rel="noopener noreferrer" data-testid={`btn-view-announcement-${entry.id}`}>
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 shrink-0">
                <ExternalLink className="h-3 w-3" /> View & Share
              </Button>
            </a>
          )}
        </div>
      ))}
    </div>
  );
}


interface UploadedFile {
  id: string; originalFileName: string; mimeType: string;
  sizeBytes: number | null; uploadedAt: string; uploadedByRole: string; title: string | null;
}

function formatBytes(n: number | null): string {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function FileUploadEditor({
  deliverable, token, canEdit, onSaved,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean; onSaved: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const filesKey = ["/api/sponsor-dashboard/files", token, deliverable.id];
  const { data: files = [], isLoading } = useQuery<UploadedFile[]>({
    queryKey: filesKey,
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/files?token=${token}&deliverableId=${deliverable.id}`);
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
    enabled: !!token && !!deliverable.id,
  });

  async function handleDownload(file: UploadedFile) {
    try {
      const res = await fetch(`/api/sponsor-dashboard/files/${file.id}/download-url?token=${token}`);
      if (!res.ok) throw new Error("Download unavailable");
      const { downloadURL, fileName } = await res.json();
      const a = document.createElement("a");
      a.href = downloadURL; a.download = fileName ?? file.originalFileName; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch { toast({ title: "Download unavailable", variant: "destructive" }); }
  }

  async function handleUpload(replaceId?: string) {
    if (!selectedFile) return;
    setUploading(true);
    const category = guessFileCategory(deliverable);
    try {
      const urlRes = await fetch("/api/sponsor-dashboard/files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sponsor-token": token },
        body: JSON.stringify({ category, originalFileName: selectedFile.name, mimeType: selectedFile.type, sizeBytes: selectedFile.size }),
      });
      if (!urlRes.ok) {
        const err = await urlRes.json().catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      const { uploadURL, fileId, objectKey, storedFileName } = await urlRes.json();
      const putRes = await fetch(uploadURL, { method: "PUT", body: selectedFile, headers: { "Content-Type": selectedFile.type } });
      if (!putRes.ok) throw new Error("Storage upload failed");
      const confirmBody: Record<string, unknown> = {
        fileId, objectKey, storedFileName, category, originalFileName: selectedFile.name,
        mimeType: selectedFile.type, sizeBytes: selectedFile.size, deliverableId: deliverable.id,
      };
      if (replaceId) confirmBody.replacesFileAssetId = replaceId;
      const confRes = await fetch("/api/sponsor-dashboard/files/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-sponsor-token": token },
        body: JSON.stringify(confirmBody),
      });
      if (!confRes.ok) throw new Error("Confirmation failed");
      await qc.invalidateQueries({ queryKey: filesKey });
      await qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token] });
      toast({ title: "File uploaded", description: "Your file has been submitted successfully." });
      setSelectedFile(null); onSaved();
    } catch (e: unknown) {
      toast({ title: "Upload failed", description: e instanceof Error ? e.message : "An unexpected error occurred", variant: "destructive" });
    } finally { setUploading(false); }
  }

  const latestFile = files[0] ?? null;

  return (
    <div className="mt-3 space-y-3">
      {isLoading ? (
        <p className="text-xs text-muted-foreground">Loading files…</p>
      ) : files.length > 0 ? (
        <div className="space-y-2">
          {files.map(file => (
            <div key={file.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-3 py-2" data-testid={`sponsor-file-${file.id}`}>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{file.title || file.originalFileName}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.sizeBytes)} · {new Date(file.uploadedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
              </div>
              <Button variant="outline" size="sm" className="h-7 text-xs shrink-0 gap-1"
                data-testid={`btn-download-sponsor-file-${file.id}`} onClick={() => handleDownload(file)}>
                <Download className="h-3 w-3" /> Download
              </Button>
            </div>
          ))}
        </div>
      ) : null}

      {canEdit && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <input type="file" id={`file-input-${deliverable.id}`}
              className="block flex-1 text-xs text-muted-foreground file:mr-2 file:py-1 file:px-2 file:rounded file:border file:border-border file:text-xs file:bg-white file:text-foreground hover:file:bg-muted"
              data-testid={`file-input-${deliverable.id}`}
              onChange={e => setSelectedFile(e.target.files?.[0] ?? null)} />
          </div>
          {selectedFile && (
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-7 text-xs gap-1" disabled={uploading}
                data-testid={`btn-upload-file-${deliverable.id}`}
                onClick={() => handleUpload(latestFile?.id)}>
                {uploading ? <><RefreshCw className="h-3 w-3 animate-spin" /> Uploading…</> : <><Upload className="h-3 w-3" /> {latestFile ? "Replace File" : "Upload File"}</>}
              </Button>
              <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelectedFile(null)} disabled={uploading}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}
          {!selectedFile && files.length === 0 && (
            <p className="text-xs text-muted-foreground">Select a file above to upload.</p>
          )}
        </div>
      )}
    </div>
  );
}

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

type InputType = "registrants" | "speakers" | "text" | "file_upload" | "none";

function getInputType(d: SponsorDeliverable): InputType {
  if (!d.sponsorEditable) return "none";
  if (d.fulfillmentType === "file_upload") return "file_upload";
  if (d.fulfillmentType === "quantity_progress") return "registrants";
  if (d.category === "Speaking & Content") return "speakers";
  return "text";
}

function renderStructuredContent(d: SponsorDeliverable, token: string, canEdit: boolean) {
  const st = detectStructuredType(d);

  switch (st) {
    case "company_description":
      return <CompanyDescriptionEditor deliverable={d} token={token} canEdit={canEdit} />;
    case "sponsor_reps":
      return <SponsorRepEditor deliverable={d} token={token} canEdit={canEdit} />;
    case "category_words":
      return <CategoryTagSelector deliverable={d} token={token} canEdit={canEdit} />;
    case "registrations":
      return <RegistrationsInfoPanel deliverable={d} token={token} />;
    case "social_graphics":
      return <SocialGraphicsPanel deliverable={d} token={token} />;
    case "social_announcements":
      return <SocialAnnouncementsPanel deliverable={d} token={token} />;
    case "legacy_intro":
      return null;
    case "coi":
      return null;
    case "speaking":
      return <SpeakerEditor deliverable={d} token={token} canEdit={canEdit} />;
    default:
      return null;
  }
}

function DeliverableRow({
  deliverable, token, canEdit, sponsorLogoUrl,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean; sponsorLogoUrl?: string | null }) {
  const [expanded, setExpanded] = useState(true);
  const st = detectStructuredType(deliverable);
  const isCOI = st === "coi";
  const hasStructured = st !== null;
  const inputType = getInputType(deliverable);
  const dueLabel = dueLabelStr(deliverable);
  const hasHelp = !!(deliverable.helpTitle || deliverable.helpText);

  const hasEditor = (hasStructured && st !== "legacy_intro") || (inputType !== "none" && canEdit);
  const hasExpandableContent = hasEditor || deliverable.deliverableDescription || deliverable.sponsorFacingNote || hasHelp;

  const n = deliverable.deliverableName.toLowerCase();
  const ctaLabel = st === "company_description" ? "Write Description" :
    st === "sponsor_reps" ? "Add Representatives" :
    st === "category_words" ? "Select Categories" :
    st === "registrations" ? "View Registration Details" :
    st === "social_graphics" ? "Download Graphics" :
    st === "social_announcements" ? "View LinkedIn Posts" :
    st === "speaking" ? "View Speaker Details" :
    st === "legacy_intro" ? "View Details" :
    inputType === "registrants" ? "Add Names" :
    inputType === "file_upload" ? (n.includes("logo") ? "Upload Logo" : n.includes("head") ? "Upload Headshot" : "Upload File") :
    inputType === "text" ? "Provide Details" :
    "View Details";

  return (
    <div className="border rounded-lg bg-card overflow-hidden" data-testid={`deliverable-row-${deliverable.id}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm leading-snug">{deliverable.deliverableName}</p>
            {deliverable.isCustom && <Badge variant="outline" className="text-xs py-0">Custom</Badge>}
            {hasHelp && <DeliverableHelpPopover helpTitle={deliverable.helpTitle} helpText={deliverable.helpText} helpLink={deliverable.helpLink} />}
          </div>
          {deliverable.deliverableDescription && !expanded && !["company_description", "category_words"].includes(st ?? "") && (
            <p className="text-xs text-muted-foreground line-clamp-2">{deliverable.deliverableDescription}</p>
          )}
          {deliverable.sponsorFacingNote && !expanded && (
            <p className="text-xs text-muted-foreground italic line-clamp-1">{deliverable.sponsorFacingNote}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <StatusBadge status={deliverable.status} sponsorEditable={deliverable.sponsorEditable} />
            {dueLabel && <span className="text-xs text-muted-foreground">{dueLabel}</span>}
            {deliverable.quantity && st === "registrations" && (
              <span className="text-xs text-muted-foreground">
                {Math.max(0, deliverable.quantity - deliverable.registrants.length)} seat{Math.max(0, deliverable.quantity - deliverable.registrants.length) !== 1 ? "s" : ""} remaining
              </span>
            )}
            {deliverable.quantity && inputType === "registrants" && st !== "registrations" && st !== "sponsor_reps" && (
              <span className="text-xs text-muted-foreground">
                {deliverable.registrants.length} of {deliverable.quantity} {deliverable.quantityUnit ?? "submitted"}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {hasExpandableContent && (
            <Button
              variant={expanded ? "ghost" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded(!expanded)}
              data-testid={`btn-expand-${deliverable.id}`}
            >
              {expanded ? <><ChevronUp className="h-3 w-3 mr-1" />Close</> : <>{isCOI ? "View Details" : ctaLabel}</>}
            </Button>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t bg-muted/20 px-4 py-3 space-y-2">
          {deliverable.deliverableDescription && !["company_description", "category_words"].includes(st ?? "") && (
            <p className="text-sm text-muted-foreground">{deliverable.deliverableDescription}</p>
          )}
          {deliverable.sponsorFacingNote && (
            <p className="text-sm italic text-muted-foreground border-l-2 border-primary/30 pl-3">{deliverable.sponsorFacingNote}</p>
          )}

          {hasStructured ? (
            renderStructuredContent(deliverable, token, canEdit)
          ) : (
            <>
              {inputType === "text" && (
                <TextEditor deliverableId={deliverable.id} token={token} currentValue={deliverable.deliverableDescription} canEdit={canEdit} onSaved={() => {}} />
              )}
              {inputType === "registrants" && (
                <RegistrantEditor deliverable={deliverable} token={token} canEdit={canEdit} />
              )}
              {inputType === "speakers" && (
                <SpeakerEditor deliverable={deliverable} token={token} canEdit={canEdit} />
              )}
              {inputType === "file_upload" && (
                isLogoDeliverable(deliverable) && sponsorLogoUrl ? (
                  <div className="flex items-center gap-3 py-2">
                    <img src={sponsorLogoUrl} alt="Logo on file" className="h-12 max-w-[120px] object-contain border rounded-lg p-1 bg-white" />
                    <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Logo on file
                    </span>
                  </div>
                ) : (
                  <FileUploadEditor deliverable={deliverable} token={token} canEdit={canEdit} onSaved={() => setExpanded(false)} />
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function ActionCard({
  deliverable, token, canEdit, sponsorLogoUrl,
}: { deliverable: SponsorDeliverable; token: string; canEdit: boolean; sponsorLogoUrl?: string | null }) {
  const [expanded, setExpanded] = useState(true);
  const st = detectStructuredType(deliverable);
  const inputType = getInputType(deliverable);
  const dueLabel = dueLabelStr(deliverable);
  const hasHelp = !!(deliverable.helpTitle || deliverable.helpText);

  const an = deliverable.deliverableName.toLowerCase();
  const ctaLabel = st === "company_description" ? "Write Description" :
    st === "sponsor_reps" ? "Add Representatives" :
    st === "category_words" ? "Select Categories" :
    st === "registrations" ? "View Registration Details" :
    inputType === "registrants" ? "Add Names" :
    inputType === "speakers" ? "Add Speaker Details" :
    inputType === "file_upload" ? (an.includes("logo") ? "Upload Logo" : an.includes("head") ? "Upload Headshot" : "Upload File") :
    "Provide Details";

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50 overflow-hidden" data-testid={`action-card-${deliverable.id}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium text-sm">{deliverable.deliverableName}</p>
            {hasHelp && <DeliverableHelpPopover helpTitle={deliverable.helpTitle} helpText={deliverable.helpText} helpLink={deliverable.helpLink} />}
          </div>
          {deliverable.sponsorFacingNote && (
            <p className="text-xs text-muted-foreground">{deliverable.sponsorFacingNote}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <StatusBadge status={deliverable.status} sponsorEditable={deliverable.sponsorEditable} />
            {dueLabel && <span className="text-xs text-muted-foreground">{dueLabel}</span>}
          </div>
        </div>
        {canEdit && (inputType !== "none" || st !== null) && (
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
          {st ? renderStructuredContent(deliverable, token, canEdit) : (
            <>
              {inputType === "text" && (
                <TextEditor deliverableId={deliverable.id} token={token} currentValue={deliverable.deliverableDescription} canEdit={canEdit} onSaved={() => setExpanded(false)} />
              )}
              {inputType === "registrants" && <RegistrantEditor deliverable={deliverable} token={token} canEdit={canEdit} />}
              {inputType === "speakers" && <SpeakerEditor deliverable={deliverable} token={token} canEdit={canEdit} />}
              {inputType === "file_upload" && (
                isLogoDeliverable(deliverable) && sponsorLogoUrl ? (
                  <div className="flex items-center gap-3 py-2">
                    <img src={sponsorLogoUrl} alt="Logo on file" className="h-12 max-w-[120px] object-contain border rounded-lg p-1 bg-white" />
                    <span className="text-sm text-emerald-600 font-medium flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" /> Logo on file
                    </span>
                  </div>
                ) : (
                  <FileUploadEditor deliverable={deliverable} token={token} canEdit={canEdit} onSaved={() => setExpanded(false)} />
                )
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SponsorTopicSelectionSection({ token, canEdit }: { token: string; canEdit: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: topicsData, isLoading: topicsLoading } = useQuery<{
    interestTopics: EventInterestTopic[];
    pendingSuggestions: EventInterestTopic[];
    eventId?: string;
  }>({
    queryKey: ["/api/sponsor-dashboard/event-topics", token],
    queryFn: () => fetch(`/api/sponsor-dashboard/event-topics?token=${token}`).then(r => r.json()),
    enabled: !!token,
  });

  const interestTopics = topicsData?.interestTopics ?? [];
  const pendingSuggestions = topicsData?.pendingSuggestions ?? [];

  const { data: existingSelections } = useQuery<{ topicId: string }[]>({
    queryKey: ["/api/sponsor-dashboard/topic-selections", token],
    queryFn: () => fetch(`/api/sponsor-dashboard/topic-selections?token=${token}`).then(r => r.json()),
    enabled: interestTopics.length > 0,
  });

  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [selectionsLoaded, setSelectionsLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showSuggestBox, setShowSuggestBox] = useState(false);
  const [suggestInput, setSuggestInput] = useState("");
  const [suggestSubmitted, setSuggestSubmitted] = useState(false);

  if (existingSelections && !selectionsLoaded) {
    const ids = existingSelections.map(s => s.topicId);
    setSelectedTopicIds(ids);
    setSelectionsLoaded(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/topic-selections?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicIds: selectedTopicIds }),
      });
      if (!res.ok) throw new Error("Failed to save");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/topic-selections", token] });
      toast({ title: "Selections saved", description: "Your interest topic selections have been saved." });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
    onError: () => toast({ title: "Error", description: "Could not save selections.", variant: "destructive" }),
  });

  const suggestMutation = useMutation({
    mutationFn: async (label: string) => {
      const res = await fetch(`/api/sponsor-dashboard/suggest-topic?token=${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicLabel: label }),
      });
      if (res.status === 409) {
        const data = await res.json();
        throw new Error(data.message ?? "A similar topic already exists");
      }
      if (!res.ok) throw new Error("Failed to suggest topic");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/event-topics", token] });
      setSuggestInput("");
      setShowSuggestBox(false);
      setSuggestSubmitted(true);
      setTimeout(() => setSuggestSubmitted(false), 8000);
    },
    onError: (err: any) => toast({ title: "Suggestion failed", description: err.message, variant: "destructive" }),
  });

  if (topicsLoading) return null;
  if (interestTopics.length === 0) return null;

  return (
    <section className="border rounded-xl bg-card overflow-hidden" data-testid="sponsor-topic-selection-section">
      <div className="px-5 py-4 border-b border-border/50 bg-muted/30 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1">
          <h2 className="text-sm font-semibold text-foreground">Areas Your Company Supports</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Select the areas most relevant to your company for this event. These selections help Converge Concierge recommend your company to attendees.
          </p>
        </div>
      </div>

      <div className="px-5 py-4 space-y-4">
        {saved && (
          <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-medium" data-testid="topics-saved-banner">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" /> Selections saved successfully.
          </div>
        )}

        {suggestSubmitted && (
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800" data-testid="suggest-submitted-banner">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span><span className="font-medium">Topic suggestion submitted for review.</span> Converge will review this suggestion before making it available for this event.</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2" data-testid="topic-chips-container">
          {interestTopics.map(t => {
            const selected = selectedTopicIds.includes(t.id);
            return (
              <button
                key={t.id}
                disabled={!canEdit}
                onClick={() => setSelectedTopicIds(prev =>
                  prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id]
                )}
                data-testid={`topic-chip-${t.id}`}
                className={cn(
                  "px-3 py-1.5 rounded-full text-sm font-medium border transition-all",
                  selected
                    ? "bg-primary text-primary-foreground border-primary"
                    : canEdit
                      ? "bg-background text-muted-foreground border-border hover:bg-primary/10 hover:text-primary hover:border-primary/40 cursor-pointer"
                      : "bg-background text-muted-foreground border-border cursor-default opacity-60"
                )}
              >
                {t.topicLabel}
              </button>
            );
          })}
        </div>

        {pendingSuggestions.length > 0 && (
          <div className="space-y-1.5" data-testid="pending-suggestions-list">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">Your Pending Suggestions</p>
            <div className="flex flex-wrap gap-1.5">
              {pendingSuggestions.map(t => (
                <span
                  key={t.id}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-amber-50 text-amber-800 border border-amber-200"
                  data-testid={`pending-suggestion-${t.id}`}
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  {t.topicLabel}
                  <span className="text-amber-500 font-medium">· Under Review</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {canEdit && (
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-border/40">
            <div>
              {!showSuggestBox ? (
                <button
                  onClick={() => setShowSuggestBox(true)}
                  className="text-xs text-muted-foreground hover:text-primary hover:underline underline-offset-2 transition-colors"
                  data-testid="btn-suggest-topic-link"
                >
                  + Suggest a Topic
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  <Input
                    value={suggestInput}
                    onChange={e => setSuggestInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter") { e.preventDefault(); if (suggestInput.trim()) suggestMutation.mutate(suggestInput.trim()); }
                      if (e.key === "Escape") { setShowSuggestBox(false); setSuggestInput(""); }
                    }}
                    placeholder="Topic name…"
                    className="h-7 text-xs w-44"
                    autoFocus
                    data-testid="input-suggest-topic"
                  />
                  <p className="text-[10px] text-muted-foreground max-w-[160px] leading-tight hidden sm:block">
                    Suggest a topic for Converge to review.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => { if (suggestInput.trim()) suggestMutation.mutate(suggestInput.trim()); }}
                    disabled={!suggestInput.trim() || suggestMutation.isPending}
                    data-testid="btn-submit-suggestion"
                  >
                    {suggestMutation.isPending ? "…" : "Submit"}
                  </Button>
                  <button
                    onClick={() => { setShowSuggestBox(false); setSuggestInput(""); }}
                    className="text-muted-foreground hover:text-foreground"
                    data-testid="btn-cancel-suggestion"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{selectedTopicIds.length} selected</span>
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                data-testid="btn-save-topic-selections"
              >
                <Save className="h-3 w-3 mr-1" />
                {saveMutation.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}

        {!canEdit && selectedTopicIds.length === 0 && pendingSuggestions.length === 0 && (
          <p className="text-xs text-muted-foreground italic">No topics selected.</p>
        )}
      </div>
    </section>
  );
}

interface Props {
  token: string;
  canEdit: boolean;
  sponsorLogoUrl?: string | null;
}

export default function SponsorDeliverablesTab({ token, canEdit, sponsorLogoUrl }: Props) {
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

  const visibleDeliverables = deliverables.filter(d => detectStructuredType(d) !== "category_words");

  const total = visibleDeliverables.length;
  const delivered = visibleDeliverables.filter((d) => ["Delivered", "Approved", "Available After Event"].includes(d.status)).length;
  const inProgress = visibleDeliverables.filter((d) => ["In Progress", "Scheduled", "Under Review", "Submitted", "Received"].includes(d.status)).length;
  const awaitingInput = visibleDeliverables.filter((d) => ["Awaiting Sponsor Input", "Not Started", "Needed"].includes(d.status) && d.sponsorEditable).length;
  const afterEvent = visibleDeliverables.filter((d) => d.status === "Available After Event").length;

  const pct = total > 0 ? Math.round(((delivered + inProgress) / total) * 100) : 0;

  const actionItems = visibleDeliverables.filter(d => isActionRequired(d) && !(sponsorLogoUrl && isLogoDeliverable(d)));

  const byCat = DELIVERABLE_CATEGORIES.reduce<Record<string, SponsorDeliverable[]>>((acc, cat) => {
    acc[cat] = visibleDeliverables.filter((d) => d.category === cat);
    return acc;
  }, {} as Record<string, SponsorDeliverable[]>);

  return (
    <div className="space-y-8" data-testid="deliverables-tab">
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

      <SponsorTopicSelectionSection token={token} canEdit={canEdit} />

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
              <ActionCard key={d.id} deliverable={d} token={token} canEdit={canEdit} sponsorLogoUrl={sponsorLogoUrl} />
            ))}
          </div>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">All Deliverables</h2>
        {DELIVERABLE_CATEGORIES.map((cat) => {
          const items = byCat[cat];
          if (!items || items.length === 0) return null;
          const catComplete = items.filter(d => ["Delivered", "Approved", "Available After Event"].includes(d.status)).length;
          return (
            <div key={cat} className="space-y-2" data-testid={`category-section-${cat}`}>
              <div className="flex items-center gap-2.5 px-1 pb-2 border-b border-border/60">
                <span className="text-primary shrink-0">{CATEGORY_ICONS[cat]}</span>
                <h3 className="text-sm font-semibold text-foreground">
                  {cat}
                  <span className="ml-1.5 font-normal text-muted-foreground text-xs">
                    ({items.length} Deliverable{items.length !== 1 ? "s" : ""})
                  </span>
                </h3>
                {catComplete > 0 && (
                  <span className="ml-auto text-xs text-emerald-600 font-medium shrink-0">
                    {catComplete}/{items.length} complete
                  </span>
                )}
              </div>
              {items.map((d) => (
                <DeliverableRow key={d.id} deliverable={d} token={token} canEdit={canEdit} sponsorLogoUrl={sponsorLogoUrl} />
              ))}
            </div>
          );
        })}
      </section>
    </div>
  );
}
