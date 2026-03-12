import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus, Trash2, Download, Users, Mic2, Share2, Globe, ShieldCheck,
  Copy, HelpCircle, ExternalLink, ChevronDown, ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
      return <RegistrationsEditor deliverable={deliverable} />;
    case "social_graphics":
    case "social_announcements":
      return <SocialEntriesEditor deliverable={deliverable} entryType={dtype === "social_graphics" ? "graphic" : "announcement"} />;
    case "attendee_list":
      return <AttendeeListPanel deliverable={deliverable} />;
    case "coi":
      return <COIPanel deliverable={deliverable} />;
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

  return (
    <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3 space-y-2" data-testid={`panel-speakers-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
          <Mic2 className="h-3.5 w-3.5" /> Speakers & Sessions
          {deliverable.quantity != null && deliverable.quantity > 0 && (
            <span className="text-purple-500 font-normal">({speakers.length} / {deliverable.quantity} sessions)</span>
          )}
        </h4>
        <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-700 hover:bg-purple-100" onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3 mr-0.5" /> Add Speaker
        </Button>
      </div>

      {showAdd && (
        <div className="bg-white border border-purple-200 rounded-md p-2 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Speaker Name *" value={newSpeaker.speakerName} onChange={e => setNewSpeaker(s => ({ ...s, speakerName: e.target.value }))} className="h-7 text-xs" data-testid="input-new-speaker-name" />
            <Input placeholder="Title / Role" value={newSpeaker.speakerTitle} onChange={e => setNewSpeaker(s => ({ ...s, speakerTitle: e.target.value }))} className="h-7 text-xs" />
            <Input placeholder="Session Type (e.g. Panel)" value={newSpeaker.sessionType} onChange={e => setNewSpeaker(s => ({ ...s, sessionType: e.target.value }))} className="h-7 text-xs" />
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
                    {[s.sessionType, s.sessionTitle].filter(Boolean).join(": ")}
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

function RegistrationsEditor({ deliverable }: { deliverable: EnrichedDeliverable }) {
  const seatsTotal = deliverable.quantity ?? 0;
  const seatsUsed = deliverable.registrantCount ?? 0;
  const seatsRemaining = Math.max(0, seatsTotal - seatsUsed);

  return (
    <div className="bg-cyan-50/50 border border-cyan-200 rounded-lg p-3 space-y-2" data-testid={`panel-registrations-${deliverable.id}`}>
      <h4 className="text-xs font-semibold text-cyan-800 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" /> Registrations
      </h4>

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
          <p className="text-foreground mt-0.5 bg-white border rounded px-2 py-1">{deliverable.registrationInstructions}</p>
        </div>
      )}
    </div>
  );
}

function SocialEntriesEditor({
  deliverable,
  entryType,
}: {
  deliverable: EnrichedDeliverable;
  entryType: "graphic" | "announcement";
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
          <span className="font-normal opacity-70">({filteredEntries.length})</span>
        </h4>
        <Button size="sm" variant="ghost" className={cn("h-6 text-[10px]", textColor, hoverBg)} onClick={() => setShowAdd(!showAdd)}>
          <Plus className="h-3 w-3 mr-0.5" /> Add
        </Button>
      </div>

      {showAdd && (
        <div className="bg-white border rounded-md p-2 space-y-2">
          <Input placeholder={isGraphic ? "Graphic title (e.g. LinkedIn Banner)" : "Post title"} value={newEntry.title} onChange={e => setNewEntry(s => ({ ...s, title: e.target.value }))} className="h-7 text-xs" data-testid={`input-social-title-${entryType}`} />
          {!isGraphic && (
            <Input placeholder="Post URL (e.g. https://linkedin.com/posts/...)" value={newEntry.url} onChange={e => setNewEntry(s => ({ ...s, url: e.target.value }))} className="h-7 text-xs" data-testid={`input-social-url-${entryType}`} />
          )}
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px]" disabled={addEntry.isPending} onClick={() => addEntry.mutate()} data-testid={`button-add-social-${entryType}`}>
              Add
            </Button>
          </div>
        </div>
      )}

      {filteredEntries.length === 0 ? (
        <p className="text-[11px] opacity-60 italic">{isGraphic ? "No graphic slots created yet" : "No announcements yet"}</p>
      ) : (
        <div className="space-y-1">
          {filteredEntries.map((e, i) => (
            <div key={e.id} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-medium text-foreground">{e.title || `${isGraphic ? "Graphic" : "Announcement"} #${i + 1}`}</span>
                {e.url && (
                  <a href={e.url} target="_blank" rel="noopener" className="ml-2 text-blue-600 hover:underline inline-flex items-center gap-0.5">
                    <ExternalLink className="h-2.5 w-2.5" /> View
                  </a>
                )}
                {isGraphic && !e.fileAssetId && <span className="ml-2 text-amber-600 text-[10px]">Awaiting upload</span>}
                {isGraphic && e.fileAssetId && <span className="ml-2 text-green-600 text-[10px]">Uploaded</span>}
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntry.mutate(e.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
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

function COIPanel({ deliverable }: { deliverable: EnrichedDeliverable }) {
  const statusColor = deliverable.status === "Approved" || deliverable.status === "Delivered"
    ? "text-green-700 bg-green-50 border-green-200"
    : deliverable.status === "Received" || deliverable.status === "Under Review"
    ? "text-blue-700 bg-blue-50 border-blue-200"
    : "text-amber-700 bg-amber-50 border-amber-200";

  return (
    <div className="bg-slate-50/50 border border-slate-200 rounded-lg p-3 space-y-2" data-testid={`panel-coi-${deliverable.id}`}>
      <h4 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
        <ShieldCheck className="h-3.5 w-3.5" /> Certificate of Insurance
      </h4>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className={cn("text-[10px]", statusColor)}>
          {deliverable.status}
        </Badge>
        <span className="text-[11px] text-muted-foreground">{deliverable.deliverableName}</span>
      </div>
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
    <div className="flex items-center gap-1 flex-wrap">
      {parts.map((p, i) => (
        <span key={i} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium whitespace-nowrap", p.color)}>
          {p.label}
        </span>
      ))}
    </div>
  );
}
