import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Plus, Trash2, Download, Users, Mic2, Share2, Globe, ShieldCheck,
  Copy, HelpCircle, ExternalLink, Save, Pencil, Upload, FileText, Image,
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
  if (n.includes("registration")) return "registrations";
  if (n.includes("social") && (n.includes("graphic") || n.includes("media graphic"))) return "social_graphics";
  if (n.includes("social") && (n.includes("announcement") || n.includes("post"))) return "social_announcements";
  if (n.includes("attendee") && (n.includes("contact") || n.includes("list"))) return "attendee_list";
  if (n.includes("certificate of insurance") || n.includes("coi") || n.includes("general liability") || n.includes("worker")) return "coi";
  return null;
}

export function hasStructuredEditor(d: EnrichedDeliverable): boolean {
  return getDeliverableType(d.deliverableName) !== null;
}

const SESSION_TYPES = ["Panel", "Peer-to-Peer", "Other"];

async function uploadFileAsset(file: File, opts: { category: string; sponsorId?: string; eventId?: string; deliverableId?: string }) {
  const urlResponse = await apiRequest("POST", "/api/files/upload-url", {
    category: opts.category,
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sponsorId: opts.sponsorId,
    eventId: opts.eventId,
    deliverableId: opts.deliverableId || null,
  });
  const urlRes = await urlResponse.json() as { uploadURL: string; fileId: string; objectKey: string; storedFileName: string };
  const putRes = await fetch(urlRes.uploadURL, {
    method: "PUT",
    body: file,
    headers: { "Content-Type": file.type },
  });
  if (!putRes.ok) throw new Error(`Upload failed: ${putRes.status}`);
  await apiRequest("POST", "/api/files/confirm", {
    fileId: urlRes.fileId,
    objectKey: urlRes.objectKey,
    storedFileName: urlRes.storedFileName,
    category: opts.category,
    originalFileName: file.name,
    mimeType: file.type,
    sizeBytes: file.size,
    sponsorId: opts.sponsorId,
    eventId: opts.eventId,
    visibility: "sponsor_private",
    deliverableId: opts.deliverableId || null,
  });
  return urlRes.fileId;
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
      return <RegistrationsEditor deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    case "social_graphics":
      return <SocialGraphicsEditor deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    case "social_announcements":
      return <SocialAnnouncementsEditor deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    case "attendee_list":
      return <AttendeeListPanel deliverable={deliverable} />;
    case "coi":
      return <COIPanel deliverable={deliverable} sponsorId={sponsorId} eventId={eventId} />;
    default:
      return null;
  }
}

const EMPTY_SPEAKER_FORM = { speakerName: "", speakerTitle: "", sessionType: "", sessionTitle: "", speakerBio: "" };

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newSpeaker, setNewSpeaker] = useState(EMPTY_SPEAKER_FORM);
  const [editForm, setEditForm] = useState(EMPTY_SPEAKER_FORM);
  const [uploadingHeadshot, setUploadingHeadshot] = useState<string | null>(null);
  const headshotInputRef = useRef<HTMLInputElement>(null);
  const newHeadshotInputRef = useRef<HTMLInputElement>(null);

  const { data: speakers = [], refetch } = useQuery<AgreementDeliverableSpeaker[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "speakers"],
  });

  const invalidate = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
  };

  const addSpeaker = useMutation({
    mutationFn: () => apiRequest("POST", `/api/agreement/deliverables/${deliverable.id}/speakers`, {
      ...newSpeaker,
      agreementDeliverableId: deliverable.id,
    }),
    onSuccess: () => { invalidate(); setNewSpeaker(EMPTY_SPEAKER_FORM); setShowAdd(false); toast({ title: "Speaker added" }); },
    onError: () => toast({ title: "Failed to add speaker", variant: "destructive" }),
  });

  const updateSpeaker = useMutation({
    mutationFn: (sid: string) => apiRequest("PATCH", `/api/agreement/deliverables/${deliverable.id}/speakers/${sid}`, editForm),
    onSuccess: () => { invalidate(); setEditingId(null); toast({ title: "Speaker updated" }); },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteSpeaker = useMutation({
    mutationFn: (sid: string) => apiRequest("DELETE", `/api/agreement/deliverables/${deliverable.id}/speakers/${sid}`),
    onSuccess: () => { invalidate(); toast({ title: "Speaker removed" }); },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  async function handleHeadshotUpload(file: File, speakerId: string) {
    setUploadingHeadshot(speakerId);
    try {
      const fileId = await uploadFileAsset(file, { category: "headshots", sponsorId, eventId, deliverableId: deliverable.id });
      await apiRequest("PATCH", `/api/agreement/deliverables/${deliverable.id}/speakers/${speakerId}`, { headshotFileAssetId: fileId });
      invalidate();
      toast({ title: "Headshot uploaded" });
    } catch {
      toast({ title: "Headshot upload failed", variant: "destructive" });
    } finally {
      setUploadingHeadshot(null);
      if (headshotInputRef.current) headshotInputRef.current.value = "";
    }
  }

  const atCapacity = deliverable.quantity != null && deliverable.quantity > 0 && speakers.length >= deliverable.quantity;

  const SpeakerFormFields = ({ form, setForm }: { form: typeof EMPTY_SPEAKER_FORM; setForm: (f: typeof EMPTY_SPEAKER_FORM) => void }) => (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Input placeholder="Speaker Name *" value={form.speakerName} onChange={e => setForm({ ...form, speakerName: e.target.value })} className="h-7 text-xs" />
        <Input placeholder="Title / Role" value={form.speakerTitle} onChange={e => setForm({ ...form, speakerTitle: e.target.value })} className="h-7 text-xs" />
        <Select value={form.sessionType} onValueChange={v => setForm({ ...form, sessionType: v })}>
          <SelectTrigger className="h-7 text-xs"><SelectValue placeholder="Session Type" /></SelectTrigger>
          <SelectContent>{SESSION_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
        <Input placeholder="Session Title" value={form.sessionTitle} onChange={e => setForm({ ...form, sessionTitle: e.target.value })} className="h-7 text-xs" />
      </div>
      <Textarea placeholder="Speaker Bio (optional)" value={form.speakerBio} onChange={e => setForm({ ...form, speakerBio: e.target.value })} rows={2} className="text-xs resize-none" />
    </>
  );

  return (
    <div className="bg-purple-50/50 border border-purple-200 rounded-lg p-3 space-y-2" data-testid={`panel-speakers-${deliverable.id}`}>
      <input ref={headshotInputRef} type="file" accept="image/*" className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f && editingId) handleHeadshotUpload(f, editingId); }} />
      <input ref={newHeadshotInputRef} type="file" accept="image/*" className="hidden" />

      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-purple-800 flex items-center gap-1.5">
          <Mic2 className="h-3.5 w-3.5" /> Speakers & Sessions
          {deliverable.quantity != null && deliverable.quantity > 0 && (
            <span className={cn("font-normal", atCapacity ? "text-green-600" : "text-purple-500")}>
              ({speakers.length} / {deliverable.quantity} sessions)
            </span>
          )}
        </h4>
        {!atCapacity && !showAdd && (
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-700 hover:bg-purple-100" onClick={() => { setShowAdd(true); setEditingId(null); }}>
            <Plus className="h-3 w-3 mr-0.5" /> Add Speaker
          </Button>
        )}
      </div>

      {showAdd && (
        <div className="bg-white border border-purple-200 rounded-md p-2 space-y-2">
          <SpeakerFormFields form={newSpeaker} setForm={setNewSpeaker} />
          <div className="flex gap-1.5 justify-end">
            <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setShowAdd(false); setNewSpeaker(EMPTY_SPEAKER_FORM); }}>Cancel</Button>
            <Button size="sm" className="h-6 text-[10px]" disabled={!newSpeaker.speakerName.trim() || addSpeaker.isPending} onClick={() => addSpeaker.mutate()} data-testid="button-add-speaker">
              {addSpeaker.isPending ? "Adding…" : "Add Speaker"}
            </Button>
          </div>
        </div>
      )}

      {speakers.length === 0 && !showAdd ? (
        <p className="text-[11px] text-purple-600/60 italic">No speakers submitted yet</p>
      ) : (
        <div className="space-y-1.5">
          {speakers.map(s => (
            <div key={s.id} className="bg-white rounded border border-purple-100 text-xs overflow-hidden">
              {editingId === s.id ? (
                <div className="p-2 space-y-2">
                  <SpeakerFormFields form={editForm} setForm={setEditForm} />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="ghost" className="h-6 text-[10px] text-purple-700 hover:bg-purple-100"
                      disabled={uploadingHeadshot === s.id} onClick={() => headshotInputRef.current?.click()}>
                      <Image className="h-3 w-3 mr-0.5" /> {uploadingHeadshot === s.id ? "Uploading…" : "Upload Headshot"}
                    </Button>
                    {s.headshotFileAssetId && <span className="text-[10px] text-green-600">✓ Headshot on file</span>}
                    <div className="flex gap-1.5 ml-auto">
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => setEditingId(null)}>Cancel</Button>
                      <Button size="sm" className="h-6 text-[10px] gap-0.5" disabled={!editForm.speakerName.trim() || updateSpeaker.isPending}
                        onClick={() => updateSpeaker.mutate(s.id)}>
                        <Save className="h-3 w-3" /> {updateSpeaker.isPending ? "Saving…" : "Save"}
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between px-2 py-1.5">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {s.headshotFileAssetId && <span className="text-[9px] bg-green-100 text-green-700 rounded px-1">📷</span>}
                      <span className="font-medium text-foreground">{s.speakerName}</span>
                      {s.speakerTitle && <span className="text-muted-foreground">— {s.speakerTitle}</span>}
                    </div>
                    {(s.sessionType || s.sessionTitle) && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {s.sessionType && <Badge variant="outline" className="text-[9px] px-1 py-0 mr-1 border-purple-200 text-purple-700">{s.sessionType}</Badge>}
                        {s.sessionTitle}
                      </p>
                    )}
                    {s.speakerBio && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{s.speakerBio}</p>}
                  </div>
                  <div className="flex gap-0.5 shrink-0 ml-2">
                    <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-purple-700 hover:bg-purple-100"
                      onClick={() => { setEditForm({ speakerName: s.speakerName, speakerTitle: s.speakerTitle ?? "", sessionType: s.sessionType ?? "", sessionTitle: s.sessionTitle ?? "", speakerBio: s.speakerBio ?? "" }); setEditingId(s.id); setShowAdd(false); }}
                      data-testid={`button-edit-speaker-${s.id}`}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteSpeaker.mutate(s.id)}
                      data-testid={`button-delete-speaker-${s.id}`}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

type EligibleAttendee = { id: string; name: string; firstName: string; lastName: string; email: string; company: string; title: string };
type AdminRegistrant = { id: string; agreementDeliverableId: string; name: string; firstName: string | null; lastName: string | null; email: string | null; attendeeId: string | null; registrationStatus: string };

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
  const [showAttendeeSearch, setShowAttendeeSearch] = useState(false);
  const [attendeeSearch, setAttendeeSearch] = useState("");
  const [accessCode, setAccessCode] = useState(deliverable.registrationAccessCode ?? "");
  const [instructions, setInstructions] = useState(deliverable.registrationInstructions ?? "");
  const [uploading, setUploading] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const { data: registrants = [], refetch: refetchRegistrants } = useQuery<AdminRegistrant[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "registrants"],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/${deliverable.id}/registrants`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const { data: eligibleAttendees = [] } = useQuery<EligibleAttendee[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "eligible-attendees"],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/${deliverable.id}/eligible-attendees`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showAttendeeSearch,
  });

  const assignedIds = new Set(registrants.map(r => r.attendeeId).filter(Boolean));
  const filteredAttendees = eligibleAttendees.filter(a => {
    if (assignedIds.has(a.id)) return false;
    if (!attendeeSearch.trim()) return true;
    const q = attendeeSearch.toLowerCase();
    return a.name.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q) || a.company?.toLowerCase().includes(q);
  });

  const addRegistrant = useMutation({
    mutationFn: (a: EligibleAttendee) => apiRequest("POST", `/api/agreement/deliverables/${deliverable.id}/registrants`, {
      firstName: a.firstName, lastName: a.lastName, name: a.name, email: a.email, title: a.title, attendeeId: a.id,
    }),
    onSuccess: () => {
      refetchRegistrants();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Attendee assigned" });
    },
    onError: () => toast({ title: "Failed to assign attendee", variant: "destructive" }),
  });

  const removeRegistrant = useMutation({
    mutationFn: (rid: string) => apiRequest("DELETE", `/api/agreement/deliverables/${deliverable.id}/registrants/${rid}`),
    onSuccess: () => {
      refetchRegistrants();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Attendee removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  const seatsTotal = deliverable.quantity ?? 0;
  const seatsUsed = registrants.length || (deliverable.registrantCount ?? 0);
  const seatsRemaining = Math.max(0, seatsTotal - seatsUsed);
  const atCapacity = seatsTotal > 0 && seatsUsed >= seatsTotal;

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

  async function handlePdfUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadFileAsset(file, { category: "registration-docs", sponsorId, eventId, deliverableId: deliverable.id });
      toast({ title: "PDF uploaded successfully" });
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
    } catch {
      toast({ title: "PDF upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (pdfInputRef.current) pdfInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-cyan-50/50 border border-cyan-200 rounded-lg p-3 space-y-2" data-testid={`panel-registrations-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-cyan-800 flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" /> Registrations
        </h4>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-cyan-700 hover:bg-cyan-100" onClick={() => pdfInputRef.current?.click()} disabled={uploading} data-testid={`button-upload-pdf-${deliverable.id}`}>
            <Upload className="h-3 w-3 mr-0.5" /> {uploading ? "Uploading..." : "Upload PDF"}
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-[10px] text-cyan-700 hover:bg-cyan-100" onClick={() => setEditing(!editing)} data-testid={`button-edit-registration-${deliverable.id}`}>
            <Pencil className="h-3 w-3 mr-0.5" /> {editing ? "Cancel" : "Edit Settings"}
          </Button>
        </div>
      </div>
      <input ref={pdfInputRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={handlePdfUpload} data-testid={`input-pdf-upload-${deliverable.id}`} />

      {/* Seat stats */}
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

      {/* Assigned attendees list */}
      {registrants.length > 0 && (
        <div className="space-y-1">
          {registrants.map(r => (
            <div key={r.id} className="flex items-center justify-between bg-white rounded border border-cyan-100 px-2 py-1 text-xs">
              <div className="min-w-0 flex-1">
                <span className="font-medium">{r.name}</span>
                {r.email && <span className="text-muted-foreground ml-1">· {r.email}</span>}
              </div>
              <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive shrink-0 ml-1"
                onClick={() => removeRegistrant.mutate(r.id)} data-testid={`button-remove-registrant-${r.id}`}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Attendee search/add */}
      {!atCapacity && (
        <div>
          {showAttendeeSearch ? (
            <div className="bg-white border border-cyan-200 rounded-md p-2 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Input placeholder="Search attendees by name, email, company…" value={attendeeSearch} onChange={e => setAttendeeSearch(e.target.value)} className="h-7 text-xs flex-1" autoFocus data-testid="input-attendee-search" />
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => { setShowAttendeeSearch(false); setAttendeeSearch(""); }}>Cancel</Button>
              </div>
              <div className="max-h-36 overflow-y-auto space-y-0.5">
                {filteredAttendees.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic py-1 px-1">{eligibleAttendees.length === 0 ? "No attendees found for this event" : "No matching attendees"}</p>
                ) : (
                  filteredAttendees.map(a => (
                    <button key={a.id} className="w-full text-left text-xs px-2 py-1 rounded hover:bg-cyan-50 flex items-center justify-between gap-2"
                      onClick={() => { addRegistrant.mutate(a); setShowAttendeeSearch(false); setAttendeeSearch(""); }}
                      data-testid={`button-assign-attendee-${a.id}`}>
                      <span className="font-medium">{a.name}</span>
                      <span className="text-muted-foreground truncate">{a.company}</span>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : (
            <Button size="sm" variant="ghost" className="h-6 text-[10px] text-cyan-700 hover:bg-cyan-100"
              onClick={() => setShowAttendeeSearch(true)} data-testid={`button-add-attendee-${deliverable.id}`}>
              <Plus className="h-3 w-3 mr-0.5" /> Assign Attendee
            </Button>
          )}
        </div>
      )}

      {/* Settings edit form */}
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
          {!deliverable.registrationAccessCode && !deliverable.registrationInstructions && registrants.length === 0 && (
            <p className="text-[11px] text-cyan-600/60 italic">No access code or instructions set — click Edit Settings to configure</p>
          )}
        </>
      )}
    </div>
  );
}

function GraphicThumbnail({ fileAssetId }: { fileAssetId: string }) {
  const { data } = useQuery<{ downloadURL: string }>({
    queryKey: ["/api/files", fileAssetId, "download-url"],
    queryFn: async () => {
      const res = await fetch(`/api/files/${fileAssetId}/download-url`, { credentials: "include" });
      if (!res.ok) return { downloadURL: "" };
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
  if (!data?.downloadURL) return null;
  return <img src={data.downloadURL} alt="Graphic preview" className="h-6 w-6 rounded object-cover border border-indigo-200 shrink-0" />;
}

function SocialGraphicsEditor({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const slotsTotal = deliverable.quantity ?? 0;
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const { data: entries = [], refetch } = useQuery<DeliverableSocialEntry[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "social-entries"],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/${deliverable.id}/social-entries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const graphicEntries = entries.filter(e => e.entryType === "graphic");

  const slots = Array.from({ length: Math.max(slotsTotal, graphicEntries.length) }, (_, i) => {
    return graphicEntries.find(e => e.entryIndex === i + 1) || graphicEntries[i] || null;
  });

  const deleteEntry = useMutation({
    mutationFn: (eid: string) => apiRequest("DELETE", `/api/agreement/social-entries/${eid}`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Graphic removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>, slotIndex: number) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingSlot(slotIndex);
    try {
      let entry = slots[slotIndex];
      if (!entry) {
        const createRes = await apiRequest("POST", `/api/agreement/deliverables/${deliverable.id}/social-entries`, {
          deliverableId: deliverable.id,
          entryType: "graphic",
          entryIndex: slotIndex + 1,
          title: `Graphic #${slotIndex + 1}`,
        });
        entry = await createRes.json();
      }
      const fileId = await uploadFileAsset(file, {
        category: "social-graphics",
        sponsorId,
        eventId,
        deliverableId: deliverable.id,
      });
      if (entry) {
        await apiRequest("PATCH", `/api/agreement/social-entries/${entry.id}`, {
          fileAssetId: fileId,
        });
      }
      toast({ title: "Graphic uploaded" });
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploadingSlot(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="bg-indigo-50/50 border border-indigo-200 rounded-lg p-3 space-y-2" data-testid={`panel-social-graphic-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-indigo-800 flex items-center gap-1.5">
          <Image className="h-3.5 w-3.5" /> Social Media Graphics
          <span className="font-normal text-indigo-500">
            ({graphicEntries.length}{slotsTotal > 0 ? ` / ${slotsTotal}` : ""} slots)
          </span>
        </h4>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => activeSlot !== null && handleFileUpload(e, activeSlot)} />

      <div className="space-y-1">
        {slots.map((entry, i) => (
          <div key={entry?.id ?? `slot-${i}`} className="flex items-center justify-between bg-white rounded px-2 py-1.5 border border-indigo-100 text-xs">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <span className="text-muted-foreground font-mono text-[10px] w-4 shrink-0">#{i + 1}</span>
              {entry ? (
                <>
                  {entry.fileAssetId && <GraphicThumbnail fileAssetId={entry.fileAssetId} />}
                  <span className="font-medium text-foreground truncate">{entry.title || `Graphic #${i + 1}`}</span>
                  {entry.fileAssetId || entry.url ? (
                    <span className="text-green-600 text-[10px] flex items-center gap-0.5"><Image className="h-2.5 w-2.5" /> Uploaded</span>
                  ) : (
                    <span className="text-amber-600 text-[10px]">Awaiting upload</span>
                  )}
                  {entry.url && (
                    <a href={entry.url} target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[10px]">
                      <ExternalLink className="h-2.5 w-2.5" /> View
                    </a>
                  )}
                </>
              ) : (
                <span className="text-muted-foreground italic">Empty slot</span>
              )}
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-indigo-700 hover:bg-indigo-100" disabled={uploadingSlot === i} onClick={() => { setActiveSlot(i); fileInputRef.current?.click(); }} data-testid={`button-upload-graphic-${i}`}>
                <Upload className="h-3 w-3" /> {uploadingSlot === i ? "..." : "Upload"}
              </Button>
              {entry && (
                <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={() => deleteEntry.mutate(entry.id)}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>
        ))}

        {slotsTotal === 0 && graphicEntries.length === 0 && (
          <p className="text-[11px] text-indigo-600/60 italic">No quantity set — set a quantity on the deliverable to create graphic slots</p>
        )}
      </div>
    </div>
  );
}

function SocialAnnouncementsEditor({
  deliverable,
  sponsorId,
  eventId,
}: {
  deliverable: EnrichedDeliverable;
  sponsorId: string;
  eventId: string;
}) {
  const { toast } = useToast();
  const slotsTotal = deliverable.quantity ?? 0;

  const { data: entries = [], refetch } = useQuery<DeliverableSocialEntry[]>({
    queryKey: ["/api/agreement/deliverables", deliverable.id, "social-entries"],
    queryFn: async () => {
      const res = await fetch(`/api/agreement/deliverables/${deliverable.id}/social-entries`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const announcementEntries = entries.filter(e => e.entryType === "announcement");

  const slots = Array.from({ length: Math.max(slotsTotal, announcementEntries.length) }, (_, i) => {
    return announcementEntries.find(e => e.entryIndex === i + 1) || announcementEntries[i] || null;
  });

  const createOrUpdateSlot = useMutation({
    mutationFn: async ({ index, url, title }: { index: number; url: string; title?: string }) => {
      const existing = slots[index];
      if (existing) {
        return apiRequest("PATCH", `/api/agreement/social-entries/${existing.id}`, { url: url.trim() || null, title: title?.trim() || existing.title });
      }
      return apiRequest("POST", `/api/agreement/deliverables/${deliverable.id}/social-entries`, {
        deliverableId: deliverable.id,
        entryType: "announcement",
        entryIndex: index + 1,
        title: title?.trim() || `Post #${index + 1}`,
        url: url.trim() || null,
      });
    },
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
    },
    onError: () => toast({ title: "Update failed", variant: "destructive" }),
  });

  const deleteEntry = useMutation({
    mutationFn: (eid: string) => apiRequest("DELETE", `/api/agreement/social-entries/${eid}`),
    onSuccess: () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["/api/agreement/deliverables/detail", sponsorId, eventId] });
      toast({ title: "Announcement removed" });
    },
    onError: () => toast({ title: "Remove failed", variant: "destructive" }),
  });

  return (
    <div className="bg-violet-50/50 border border-violet-200 rounded-lg p-3 space-y-2" data-testid={`panel-social-announcement-${deliverable.id}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold text-violet-800 flex items-center gap-1.5">
          <Globe className="h-3.5 w-3.5" /> Social Announcements
          <span className="font-normal text-violet-500">
            ({announcementEntries.filter(e => e.url).length}{slotsTotal > 0 ? ` / ${slotsTotal}` : ""} with URLs)
          </span>
        </h4>
      </div>

      <div className="space-y-1">
        {slots.map((entry, i) => (
          <AnnouncementSlot
            key={entry?.id ?? `slot-${i}`}
            index={i}
            entry={entry}
            onSave={(url, title) => createOrUpdateSlot.mutate({ index: i, url, title })}
            onDelete={entry ? () => deleteEntry.mutate(entry.id) : undefined}
            saving={createOrUpdateSlot.isPending}
          />
        ))}

        {slotsTotal === 0 && announcementEntries.length === 0 && (
          <p className="text-[11px] text-violet-600/60 italic">No quantity set — set a quantity on the deliverable to create announcement slots</p>
        )}
      </div>
    </div>
  );
}

function AnnouncementSlot({
  index,
  entry,
  onSave,
  onDelete,
  saving,
}: {
  index: number;
  entry: DeliverableSocialEntry | null;
  onSave: (url: string, title?: string) => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(entry?.url ?? "");
  const [title, setTitle] = useState(entry?.title ?? `Post #${index + 1}`);

  const hasUrl = !!entry?.url;

  return (
    <div className="bg-white rounded px-2 py-1.5 border border-violet-100 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-muted-foreground font-mono text-[10px] w-4 shrink-0">#{index + 1}</span>
          <span className="font-medium text-foreground truncate">{entry?.title || `Post #${index + 1}`}</span>
          {hasUrl ? (
            <a href={entry!.url!} target="_blank" rel="noopener" className="text-blue-600 hover:underline inline-flex items-center gap-0.5 text-[10px] shrink-0">
              <ExternalLink className="h-2.5 w-2.5" /> View
            </a>
          ) : (
            <span className="text-amber-600 text-[10px]">URL not provided</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="sm" className="h-5 px-1 text-[10px] text-violet-700 hover:bg-violet-100" onClick={() => setEditing(!editing)}>
            <Pencil className="h-3 w-3" />
          </Button>
          {onDelete && (
            <Button variant="ghost" size="sm" className="h-5 w-5 p-0 text-destructive hover:text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <div className="mt-1.5 space-y-1.5 pl-6">
          <Input placeholder="Post title" value={title} onChange={e => setTitle(e.target.value)} className="h-7 text-xs" data-testid={`input-announcement-title-${index}`} />
          <Input placeholder="Post URL (e.g. https://linkedin.com/posts/...)" value={url} onChange={e => setUrl(e.target.value)} className="h-7 text-xs" data-testid={`input-announcement-url-${index}`} />
          <div className="flex gap-1 justify-end">
            <Button size="sm" variant="ghost" className="h-5 text-[10px]" onClick={() => { setEditing(false); setUrl(entry?.url ?? ""); setTitle(entry?.title ?? `Post #${index + 1}`); }}>Cancel</Button>
            <Button size="sm" className="h-5 text-[10px] gap-0.5" disabled={saving} onClick={() => { onSave(url, title); setEditing(false); }} data-testid={`button-save-announcement-${index}`}>
              <Save className="h-3 w-3" /> Save
            </Button>
          </div>
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

const COI_STATUSES = ["Not Started", "Needed", "Awaiting Sponsor Input", "Received", "Under Review", "Approved", "Issue Identified", "Delivered"];

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
