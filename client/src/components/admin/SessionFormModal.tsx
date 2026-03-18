import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event, Sponsor, SessionType, AgendaSession, AgendaSessionSpeaker } from "@shared/schema";

type SessionWithSpeakers = AgendaSession & { speakers: AgendaSessionSpeaker[] };

interface SpeakerRow {
  name: string;
  title: string;
  company: string;
}

interface Props {
  session: SessionWithSpeakers | null;
  events: Event[];
  sponsors: Sponsor[];
  sessionTypes: SessionType[];
  defaultEventId?: string;
  onClose: () => void;
  onSaved: () => void;
}

export function SessionFormModal({ session, events, sponsors, sessionTypes, defaultEventId, onClose, onSaved }: Props) {
  const { toast } = useToast();
  const isEdit = !!session;

  const [eventId, setEventId] = useState(session?.eventId || defaultEventId || "");
  const [title, setTitle] = useState(session?.title || "");
  const [description, setDescription] = useState(session?.description || "");
  const [sessionCode, setSessionCode] = useState(session?.sessionCode || "");
  const [sessionTypeKey, setSessionTypeKey] = useState(session?.sessionTypeKey || "OTHER");
  const [sessionDate, setSessionDate] = useState(session?.sessionDate || "");
  const [startTime, setStartTime] = useState(session?.startTime || "");
  const [endTime, setEndTime] = useState(session?.endTime || "");
  const [timezone, setTimezone] = useState(session?.timezone || "America/Chicago");
  const [locationName, setLocationName] = useState(session?.locationName || "");
  const [locationDetails, setLocationDetails] = useState(session?.locationDetails || "");
  const [sponsorId, setSponsorId] = useState(session?.sponsorId || "");
  const [status, setStatus] = useState(session?.status || "Draft");
  const [isFeatured, setIsFeatured] = useState(session?.isFeatured || false);
  const [isPublic, setIsPublic] = useState(session?.isPublic !== false);

  const [speakers, setSpeakers] = useState<SpeakerRow[]>(
    session?.speakers?.length
      ? session.speakers.map(sp => ({ name: sp.name, title: sp.title || "", company: sp.company || "" }))
      : []
  );
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [topicsPreloaded, setTopicsPreloaded] = useState(false);

  const addSpeaker = () => setSpeakers(s => [...s, { name: "", title: "", company: "" }]);
  const removeSpeaker = (idx: number) => setSpeakers(s => s.filter((_, i) => i !== idx));
  const updateSpeaker = (idx: number, field: keyof SpeakerRow, val: string) => {
    setSpeakers(s => s.map((sp, i) => i === idx ? { ...sp, [field]: val } : sp));
  };

  const { data: availableTopics = [] } = useQuery<{ id: string; topicLabel: string }[]>({
    queryKey: ["/api/events", eventId, "interest-topics"],
    queryFn: async () => {
      const res = await fetch(`/api/events/${eventId}/interest-topics`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!eventId,
  });

  const { data: existingTopicSelections } = useQuery<{ topicId: string }[]>({
    queryKey: ["/api/admin/sessions", session?.id, "topic-selections"],
    queryFn: async () => {
      const res = await fetch(`/api/admin/sessions/${session!.id}/topic-selections`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: isEdit && !!session?.id,
    gcTime: 0,
  });

  useEffect(() => {
    if (isEdit && existingTopicSelections !== undefined && !topicsPreloaded) {
      setTopicsPreloaded(true);
      const ids = existingTopicSelections.map(s => s.topicId);
      if (ids.length > 0) setSelectedTopicIds(ids);
    }
  }, [isEdit, existingTopicSelections, topicsPreloaded]);

  function toggleTopic(id: string) {
    setSelectedTopicIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        eventId, title, description: description || null, sessionCode: sessionCode || null,
        sessionTypeKey, sessionDate, startTime, endTime, timezone,
        locationName: locationName || null, locationDetails: locationDetails || null,
        sponsorId: sponsorId || null, status, isFeatured, isPublic,
        speakers: speakers.filter(sp => sp.name.trim()),
      };
      let sessionId: string;
      if (isEdit) {
        await apiRequest("PATCH", `/api/admin/agenda-sessions/${session!.id}`, payload);
        sessionId = session!.id;
      } else {
        const res = await apiRequest("POST", "/api/admin/agenda-sessions", payload);
        const created = await res.json();
        sessionId = created.id;
      }
      if (availableTopics.length > 0) {
        await apiRequest("POST", `/api/admin/sessions/${sessionId}/topic-selections`, { eventId, topicIds: selectedTopicIds });
      }
    },
    onSuccess: () => {
      toast({ title: isEdit ? "Session updated" : "Session created" });
      onSaved();
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const activeEvents = events.filter(e => e.archiveState === "active");
  const activeSponsors = sponsors.filter(s => s.archiveState === "active");
  const activeSessionTypes = sessionTypes.filter(st => st.isActive);

  const canSave = eventId && title.trim() && sessionTypeKey && sessionDate && startTime && endTime;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Session" : "Add Session"}</DialogTitle>
          <DialogDescription>{isEdit ? "Update the session details below." : "Create a new agenda session."}</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Event *</Label>
            <Select value={eventId} onValueChange={setEventId}>
              <SelectTrigger data-testid="select-event">
                <SelectValue placeholder="Select event" />
              </SelectTrigger>
              <SelectContent>
                {activeEvents.map(e => (
                  <SelectItem key={e.id} value={e.id}>{e.slug} — {e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Session Type *</Label>
            <Select value={sessionTypeKey} onValueChange={setSessionTypeKey}>
              <SelectTrigger data-testid="select-session-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {activeSessionTypes.map(st => (
                  <SelectItem key={st.key} value={st.key}>{st.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="col-span-2">
            <Label>Session Title *</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Enter session title" data-testid="input-session-title" />
          </div>

          <div className="col-span-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Session description..." data-testid="input-session-description" />
          </div>

          <div>
            <Label>Session Code</Label>
            <Input value={sessionCode} onChange={e => setSessionCode(e.target.value)} placeholder="e.g. PNL-001" data-testid="input-session-code" />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger data-testid="select-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Draft">Draft</SelectItem>
                <SelectItem value="Published">Published</SelectItem>
                <SelectItem value="Cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Date *</Label>
            <Input type="date" value={sessionDate} onChange={e => setSessionDate(e.target.value)} data-testid="input-session-date" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Start Time *</Label>
              <Input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} data-testid="input-start-time" />
            </div>
            <div>
              <Label>End Time *</Label>
              <Input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} data-testid="input-end-time" />
            </div>
          </div>

          <div>
            <Label>Timezone</Label>
            <Select value={timezone} onValueChange={setTimezone}>
              <SelectTrigger data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="America/New_York">Eastern (America/New_York)</SelectItem>
                <SelectItem value="America/Chicago">Central (America/Chicago)</SelectItem>
                <SelectItem value="America/Denver">Mountain (America/Denver)</SelectItem>
                <SelectItem value="America/Los_Angeles">Pacific (America/Los_Angeles)</SelectItem>
                <SelectItem value="UTC">UTC</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Sponsor</Label>
            <Select value={sponsorId || "none"} onValueChange={v => setSponsorId(v === "none" ? "" : v)}>
              <SelectTrigger data-testid="select-sponsor">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {activeSponsors.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Location Name</Label>
            <Input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Room name" data-testid="input-location-name" />
          </div>
          <div>
            <Label>Location Details</Label>
            <Input value={locationDetails} onChange={e => setLocationDetails(e.target.value)} placeholder="Floor, building, etc." data-testid="input-location-details" />
          </div>

          <div className="flex items-center gap-3">
            <Switch checked={isFeatured} onCheckedChange={setIsFeatured} data-testid="switch-featured" />
            <Label>Featured Session</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={isPublic} onCheckedChange={setIsPublic} data-testid="switch-public" />
            <Label>Public</Label>
          </div>
        </div>

        {availableTopics.length > 0 && (
          <div className="border-t pt-4 mt-1">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm font-semibold">Agenda Topics</Label>
              {selectedTopicIds.length > 0 && (
                <Badge variant="secondary" className="text-xs">{selectedTopicIds.length} selected</Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mb-2">Tag this session with relevant topics to help attendees discover it.</p>
            <div className="flex flex-wrap gap-1.5">
              {availableTopics.map(t => {
                const active = selectedTopicIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTopic(t.id)}
                    data-testid={`topic-chip-session-${t.id}`}
                    className={cn(
                      "px-2.5 py-1 rounded-full text-xs font-medium border transition-all",
                      active
                        ? "bg-accent text-white border-accent"
                        : "bg-background text-muted-foreground border-border hover:bg-accent/10 hover:text-accent hover:border-accent/40"
                    )}
                  >
                    {t.topicLabel}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="border-t pt-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <Label className="text-base font-semibold">Speakers</Label>
            <Button variant="outline" size="sm" onClick={addSpeaker} disabled={speakers.length >= 5} data-testid="button-add-speaker">
              <Plus className="h-3 w-3 mr-1" /> Add Speaker
            </Button>
          </div>
          {speakers.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No speakers added yet.</p>
          )}
          <div className="space-y-2">
            {speakers.map((sp, idx) => (
              <div key={idx} className="flex items-start gap-2 bg-muted/30 rounded-lg p-3">
                <div className="text-muted-foreground/40 pt-2"><GripVertical className="h-4 w-4" /></div>
                <div className="flex-1 grid grid-cols-3 gap-2">
                  <Input placeholder="Name *" value={sp.name} onChange={e => updateSpeaker(idx, "name", e.target.value)} data-testid={`input-speaker-name-${idx}`} />
                  <Input placeholder="Title" value={sp.title} onChange={e => updateSpeaker(idx, "title", e.target.value)} data-testid={`input-speaker-title-${idx}`} />
                  <Input placeholder="Company" value={sp.company} onChange={e => updateSpeaker(idx, "company", e.target.value)} data-testid={`input-speaker-company-${idx}`} />
                </div>
                <Button variant="ghost" size="icon" className="text-destructive mt-1" onClick={() => removeSpeaker(idx)} data-testid={`remove-speaker-${idx}`}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!canSave || saveMutation.isPending} data-testid="button-save-session">
            {saveMutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Session"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
