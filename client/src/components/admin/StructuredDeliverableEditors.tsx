import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus, Trash2, Download, Users, Mic2, Share2, Globe, ShieldCheck,
  Copy, HelpCircle, ExternalLink, ChevronDown, ChevronUp, Save, Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type {
  AgreementDeliverable,
  AgreementDeliverableSpeaker,
  AgreementDeliverableRegistrant,
  DeliverableSocialEntry,
} from "@shared/schema";

type EnrichedDeliverable = AgreementDeliverable & {
  registrantCount: number;
  speakerCount: number;
  socialEntryCount: number;
};

export function getDeliverableType(name: string): string | null {
  const n = name.toLowerCase();
  if (n.includes("speaking") || n.includes("session")) return "speaking";
  if (n.includes("registration") && !n.includes("attendee")) return "registrations";
  if (n.includes("social") && (n.includes("graphic") || n.includes("media graphic"))) return "social_graphics";
  if (n.includes("social") && (n.includes("announcement") || n.includes("post"))) return "social_announcements";
  if (n.includes("attendee") && n.includes("contact")) return "attendee_list";
  if (n.includes("certificate of insurance") || n.includes("coi") || n.includes("general liability") || n.includes("worker")) return "coi";
  return null;
}

export function hasStructuredEditor(d: EnrichedDeliverable): boolean {
  return getDeliverableType(d.deliverableName) !== null;
}

const SESSION_TYPES = ["Keynote", "Panel", "Fireside Chat", "Workshop", "Breakout Session", "Lightning Talk", "Roundtable", "Demo", "Other"];

export function StructuredDeliverablePanel({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const dtype = getDeliverableType(deliverable.deliverableName);
  if (!dtype) return null;

  switch (dtype) {
    case "speaking":
      return <SpeakerEditor deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    case "registrations":
      return <RegistrationsEditor deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    case "social_graphics":
    case "social_announcements":
      return <SocialEntriesEditor deliverable={deliverable} entryType={dtype === "social_graphics" ? "graphic" : "announcement"} sponsorId={sponsorId} eventId={eventId} />;
    case "attendee_list":
      return <AttendeeListPanel deliverable={deliverable} />;
    case "coi":
      return <COIPanel deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    default:
      return null;
  }
}

function SpeakerEditor({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newSpeaker, setNewSpeaker] = useState({ speakerName: "", speakerTitle: "", sessionType: "", sessionTitle: "" });

  const { data: speakers = [], refetch } = useQuery<AgreementDeliverableSpeaker[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "speakers"],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const addSpeaker = useMutation({
    mutationFn: () => apiRequest("POST", `/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers`, {
      ...newSpeaker,
      agreementDeliverableId: deliverable.id,
    }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      setNewSpeaker({ speakerName: "", speakerTitle: "", sessionType: "", sessionTitle: "" });
      setShowAdd(false);
      toast({ title: "Speaker added" });
    },
    onError: () => toast({ title: "Failed to add speaker", variant: "destructive" }),
  });

  const deleteSpeaker = useMutation({
    mutationFn: (sid: string) => apiRequest("DELETE", `/api/sponsor-dashboard/agreement-deliverables/${deliverable.id}/speakers/${sid}`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Speaker removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  const atCapacity = deliverable.quantity != null && deliverable.quantity > 0 && speakers.length >= deliverable.quantity;

  return (
    <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3 space-y-2" data-testid={`panel-speakers-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
          <Mic2 className="h-3.5 w-3.5" /> Speakers & Sessions
          {deliverable.quantity != null && deliverable.quantity > 0 && (
            <span className={cn("font-normal", atCapacity ? "text-green-600" : "text-purple-500")}>
              ({speakers.length} / {deliverable.quantity} sessions)
            </span>
          )}
        </h4>
        {!atCapacity && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-700 hover:bg-purple-100" onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3 w-3 mr-0.5" /> Add Speaker
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white border border-purple-200 rounded-md p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Speaker Name *" value={newSpeaker.speakerName} onChange={e => setNewSpeaker(s => ({ ...s, speakerName: e.target.value }))} className="h-7 text-xs" data-testid="input-new-speaker-name" />
            <Input placeholder="Title / Role" value={newSpeaker.speakerTitle} onChange={e => setNewSpeaker(s => ({ ...s, speakerTitle: e.target.value }))} className="h-7 text-xs" />
            <Select value={newSpeaker.sessionType} onValueChange={v => setNewSpeaker(s => ({ ...s, sessionType: v }))}>
              <SelectTrigger className="h-7 text-xs" data-testid="select-session-type">
                <SelectValue placeholder="Session Type" />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Session Title" value={newSpeaker.sessionTitle} onChange={e => setNewSpeaker(s => ({ ...s, sessionTitle: e.target.value }))} className="h-7 text-xs" />
          </div>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px]" disabled={!newSpeaker.speakerName.trim() || addSpeaker.isPending} onClick={() => addSpeaker.mutate()} data-testid="button-add-speaker">
              Add
            </Button>
          </div>
        </div>
      )}

      {speakers.length === 0 ? (
        <p className="text-[11px] text-purple-600/60 italic">No speakers submitted yet</p>
      ) : (
        <div className="space-y-1">
          {speakers.map(s => (
            <div key={s.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-purple-100 text-xs">
              <div>
                <span className="font-medium text-foreground">{s.speakerName}</span>
                {s.speakerTitle && <span className="text-muted-foreground ml-1">— {s.speakerTitle}</span>}
                {(s.sessionType || s.sessionTitle) && (
                  <p className="text-[10px] text-muted-foreground">
                    {s.sessionType && <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1 border-purple-200 text-purple-700">{s.sessionType}</Badge>}
                    {s.sessionTitle}
                  </p>
                )}
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteSpeaker.mutate(s.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RegistrationsEditor({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [accessCode, setAccessCode] = useState(deliverable.registrationAccessCode ?? "");
  const [instructions, setInstructions] = useState(deliverable.registrationInstructions ?? "");

  const seatsTotal = deliverable.quantity ?? 0;
  const seatsUsed = deliverable.registrantCount ?? 0;
  const seatsRemaining = Math.max(0, seatsTotal - seatsUsed);

  const updateFields = useMutation({
    mutationFn: () => apiRequest("PATCH", `/api/agreement/deliverables/${deliverable.id}`, {
      registrationAccessCode: accessCode.trim() || null,
      registrationInstructions: instructions.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      setEditing(false);
      toast({ title: "Registration settings updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className="bg-cyan-50/50 border border-cyan-200 rounded-lg p-3 space-y-2" data-testid={`panel-registrations-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-cyan-800 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Registrations
        </h4>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-cyan-700 hover:bg-cyan-100" onClick={() => setEditing(!editing)} data-testid={`button-edit-registration-${deliverable.id}`}>
          <Pencil className="h-3 w-3 mr-0.5" /> {editing ? "Cancel" : "Edit Settings"}
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="bg-white rounded-md border border-cyan-100 px-2 py-1.5">
          <p className="text-sm font-bold text-foreground">{seatsUsed}</p>
          <p className="text-[10px] text-muted-foreground">Submitted</p>
        </div>
        <div className="bg-white rounded-md border border-cyan-100 px-2 py-1.5">
          <p className="text-sm font-bold text-foreground">{seatsTotal || "—"}</p>
          <p className="text-[10px] text-muted-foreground">Total Seats</p>
        </div>
        <div className={cn("bg-white rounded-md border px-2 py-1.5", seatsRemaining === 0 && seatsTotal > 0 ? "border-green-200" : "border-cyan-100")}>
          <p className={cn("text-sm font-bold", seatsRemaining === 0 && seatsTotal > 0 ? "text-green-700" : "text-foreground")}>{seatsTotal > 0 ? seatsRemaining : "—"}</p>
          <p className="text-[10px] text-muted-foreground">Remaining</p>
        </div>
      </div>

      {editing ? (
        <div className="bg-white border border-cyan-200 rounded-md p-2.5 space-y-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Access Code</Label>
            <Input value={accessCode} onChange={e => setAccessCode(e.target.value)} placeholder="Optional access code for sponsor registration" className="h-7 text-xs" data-testid={`input-access-code-${deliverable.id}`} />
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">Registration Instructions</Label>
            <Textarea value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instructions shown to sponsor for how to register attendees..." rows={3} className="text-xs" data-testid={`input-reg-instructions-${deliverable.id}`} />
          </div>
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setEditing(false); setAccessCode(deliverable.registrationAccessCode ?? ""); setInstructions(deliverable.registrationInstructions ?? ""); }}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px] gap-0.5" disabled={updateFields.isPending} onClick={() => updateFields.mutate()} data-testid={`button-save-registration-${deliverable.id}`}>
              <Save className="h-3 w-3" /> Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          {deliverable.registrationAccessCode && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Access Code:</span>
              <code className="bg-white border rounded px-1.5 py-0.5 font-mono text-foreground">{deliverable.registrationAccessCode}</code>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => navigator.clipboard.writeText(deliverable.registrationAccessCode!)} data-testid={`button-copy-code-${deliverable.id}`}>
                <Copy className="h-3 w-3 text-muted-foreground" />
              </Button>
            </div>
          )}
          {deliverable.registrationInstructions && (
            <div className="text-xs">
              <span className="text-muted-foreground">Instructions:</span>
              <p className="text-foreground mt-0.5 bg-white border rounded px-2 py-1 whitespace-pre-wrap">{deliverable.registrationInstructions}</p>
            </div>
          )}
          {!deliverable.registrationAccessCode && !deliverable.registrationInstructions && (
            <p className="text-[11px] text-cyan-600/60 italic">No access code or instructions set — click Edit Settings to configure</p>
          )}
        </>
      )}
    </div>
  );
}

function SocialEntriesEditor({
  deliverable,
  entryType,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  entryType: "graphic" | "announcement";
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const [showAdd, setShowAdd] = useState(false);
  const [newEntry, setNewEntry] = useState({ title: "", url: "" });

  const { data: entries = [], refetch } = useQuery<DeliverableSocialEntry[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "social-entries"],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/${deliverable.id}/social-entries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const filteredEntries = entries.filter(e => e.entryType === entryType);
  const slotsTotal = deliverable.quantity ?? 0;
  const atCapacity = slotsTotal > 0 && filteredEntries.length >= slotsTotal;

  const addEntry = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agreement/deliverables/${deliverable.id}/social-entries`, {
      deliverableId: deliverable.id,
      entryType,
      entryIndex: filteredEntries.length + 1,
      title: newEntry.title.trim() || null,
      url: newEntry.url.trim() || null,
    }),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      setNewEntry({ title: "", url: "" });
      setShowAdd(false);
      toast({ title: entryType === "graphic" ? "Graphic slot added" : "Announcement added" });
    },
    onError: () => toast({ title: "Failed to add", variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: (eid: string) => apiRequest("DELETE", `/api/agreement/social-entries/${eid}`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Entry removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  const isGraphic = entryType === "graphic";
  const borderColor = isGraphic ? "border-indigo-200" : "border-violet-200";
  const bgColor = isGraphic ? "bg-indigo-50/50" : "bg-violet-50/50";
  const textColor = isGraphic ? "text-indigo-800" : "text-violet-800";
  const hoverBg = isGraphic ? "hover:bg-indigo-100" : "hover:bg-violet-100";

  return (
    <div className={cn(bgColor, "border", borderColor, "rounded-lg p-3 space-y-2")} data-testid={`panel-social-${entryType}-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className={cn("text-xs font-semibold flex items-center gap-1.5", textColor)}>
          {isGraphic ? <Share2 className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
          {isGraphic ? "Social Media Graphics" : "Social Announcements"}
          <span className="font-normal opacity-70">
            ({filteredEntries.length}{slotsTotal > 0 ? ` / ${slotsTotal}` : ""})
          </span>
        </h4>
        {!atCapacity && (
          <Button size="sm" variant="ghost" className={cn("h-6 text-[10px]", textColor, hoverBg)} onClick={() => setShowAdd(!showAdd)}>
            <Plus className="h-3 w-3 mr-0.5" /> Add
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white border rounded-md p-2 space-y-2">
          <Input placeholder={isGraphic ? "Graphic title (e.g. LinkedIn Banner)" : "Post title"} value={newEntry.title} onChange={e => setNewEntry(s => ({ ...s, title: e.target.value }))} className="h-7 text-xs" data-testid={`input-social-title-${entryType}`} />
          <Input placeholder={isGraphic ? "File URL (optional — sponsor can upload)" : "Post URL (e.g. https://linkedin.com/posts/...)"} value={newEntry.url} onChange={e => setNewEntry(s => ({ ...s, url: e.target.value }))} className="h-7 text-xs" data-testid={`input-social-url-${entryType}`} />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px]" disabled={addEntry.isPending} onClick={() => addEntry.mutate()} data-testid={`button-add-social-${entryType}`}>
              Add
            </Button>
          </div>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <p className="text-[11px] opacity-60 italic">
          {slotsTotal > 0
            ? `${slotsTotal} slot${slotsTotal !== 1 ? "s" : ""} allocated — click Add to create entries`
            : isGraphic ? "No graphic slots created yet" : "No announcements yet"}
        </p>
      ) : (
        <div className="space-y-1">
          {filteredEntries.map((e, i) => (
            <div key={e.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{e.title || `${isGraphic ? "Graphic" : "Post"} #${i + 1}`}</span>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener" className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    <ExternalLink className="h-2.5 w-2.5" /> View
                  </a>
                )}
                {isGraphic && !e.fileAssetId && !e.url && <span className="ml-2 text-amber-600 text-[10px]">Awaiting upload</span>}
                {isGraphic && (e.fileAssetId || e.url) && <span className="ml-2 text-green-600 text-[10px]">Uploaded</span>}
                {!isGraphic && !e.url && <span className="ml-2 text-amber-600 text-[10px]">URL not yet provided</span>}
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntry.mutate(e.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {slotsTotal > 0 && filteredEntries.length < slotsTotal && (
            <p className="text-[10px] text-muted-foreground italic pl-1">
              {slotsTotal - filteredEntries.length} slot{slotsTotal - filteredEntries.length !== 1 ? "s" : ""} remaining
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function AttendeeListPanel({ deliverable }: { deliverable: EnrichedDeliverable }) {
  return (
    <div className="bg-blue-50/50 border border-blue-200 rounded-lg p-3 space-y-2" data-testid={`panel-attendee-${deliverable.id}`}>
      <h4 className="text-xs font-semibold text-blue-800 flex items-center gap-1.5">
        <Download className="h-3.5 w-3.5" /> Attendee Contact List
      </h4>
      <p className="text-[11px] text-blue-700/70">
        This deliverable will be fulfilled after the event with the attendee contact list.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100"
          onClick={() => window.open(`/api/agreement/deliverables/${deliverable.id}/attendee-csv`, "_blank")}
          data-testid={`button-download-csv-${deliverable.id}`}
        >
          <Download className="h-3 w-3" /> Download Full CSV
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs gap-1 border-blue-300 text-blue-700 hover:bg-blue-100"
          onClick={() => window.open(`/api/agreement/deliverables/${deliverable.id}/attendee-csv?type=partial`, "_blank")}
          data-testid={`button-download-partial-csv-${deliverable.id}`}
        >
          <Download className="h-3 w-3" /> Partial CSV
        </Button>
      </div>
    </div>
  );
}

const COI_STATUSES = ["Not Started", "Awaiting Sponsor Input", "In Progress", "Submitted", "Received", "Under Review", "Approved", "Delivered", "Rejected"];

function COIPanel({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const [editingStatus, setEditingStatus] = useState(false);

  const statusColor = deliverable.status === "Approved" || deliverable.status === "Delivered"
    ? "text-green-700 bg-green-50 border-green-200"
    : deliverable.status === "Received" || deliverable.status === "Under Review"
    ? "text-blue-700 bg-blue-50 border-blue-200"
    : deliverable.status === "Rejected"
    ? "text-red-700 bg-red-50 border-red-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  const updateStatus = useMutation({
    mutationFn: (status: string) => apiRequest("PATCH", `/api/agreement/deliverables/${deliverable.id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      setEditingStatus(false);
      toast({ title: "COI status updated" });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  return (
    <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 space-y-2" data-testid={`panel-coi-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> Certificate of Insurance
        </h4>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-slate-700 hover:bg-slate-100" onClick={() => setEditingStatus(!editingStatus)} data-testid={`button-edit-coi-status-${deliverable.id}`}>
          <Pencil className="h-3 w-3 mr-0.5" /> {editingStatus ? "Cancel" : "Change Status"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
          {deliverable.status}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{deliverable.deliverableName}</span>
      </div>

      {editingStatus && (
        <div className="bg-white border border-slate-200 rounded-md p-2">
          <Label className="text-[11px] text-muted-foreground mb-1 block">Update Status</Label>
          <Select value={deliverable.status} onValueChange={v => updateStatus.mutate(v)}>
            <SelectTrigger className="h-7 text-xs" data-testid={`select-coi-status-${deliverable.id}`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {COI_STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      {deliverable.sponsorFacingNote && (
        <p className="text-[11px] text-muted-foreground bg-white border rounded px-2 py-1">{deliverable.sponsorFacingNote}</p>
      )}
    </div>
  );
}

export function HelpContentPreview({ helpTitle, helpText, helpLink }: { helpTitle?: string | null; helpText?: string | null; helpLink?: string | null }) {
  if (!helpTitle && !helpText && !helpLink) return null;
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md px-3 py-2 space-y-1" data-testid="help-content-preview">
      <p className="text-xs font-semibold text-blue-800 flex items-center gap-1">
        <HelpCircle className="h-3 w-3" /> Sponsor Help Preview
      </p>
      {helpTitle && <p className="text-xs font-medium text-blue-900">{helpTitle}</p>}
      {helpText && <p className="text-[11px] text-blue-700 whitespace-pre-wrap">{helpText}</p>}
      {helpLink && (
        <a href={helpLink} target="_blank" rel="noopener" className="text-[11px] text-blue-600 hover:underline inline-flex items-center gap-0.5">
          <ExternalLink className="h-2.5 w-2.5" /> {helpLink}
        </a>
      )}
    </div>
  );
}

export function DeliverableStructuredSummary({ d }: { d: EnrichedDeliverable }) {
  const parts: { label: string; color: string }[] = [];

  if (d.speakerCount > 0) {
    parts.push({ label: `${d.speakerCount} speaker${d.speakerCount !== 1 ? "s" : ""}`, color: "bg-purple-50 text-purple-700" });
  }
  if (d.registrantCount > 0) {
    const seats = d.quantity != null && d.quantity > 0 ? ` / ${d.quantity}` : "";
    parts.push({ label: `${d.registrantCount}${seats} registrants`, color: "bg-cyan-50 text-cyan-700" });
  }
  if (d.socialEntryCount > 0) {
    parts.push({ label: `${d.socialEntryCount} social`, color: "bg-indigo-50 text-indigo-700" });
  }

  const dtype = getDeliverableType(d.deliverableName);
  if (dtype === "coi") {
    const isComplete = d.status === "Approved" || d.status === "Delivered";
    parts.push({ label: isComplete ? "COI ✓" : "COI pending", color: isComplete ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700" });
  }
  if (dtype === "attendee_list") {
    parts.push({ label: "CSV ready", color: "bg-blue-50 text-blue-700" });
  }

  if (parts.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap mt-0.5">
      {parts.map((p, i) => (
        <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap", p.color)}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
