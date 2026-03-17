import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Plus, Upload, Download, Edit, Trash2, Search, CalendarDays,
  Clock, MapPin, Users, Mic2, FileText, AlertCircle, Sparkles, Bot, Copy, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Event, AgendaSession, AgendaSessionSpeaker, SessionType, Sponsor } from "@shared/schema";
import { SessionFormModal } from "@/components/admin/SessionFormModal";

type SessionWithSpeakers = AgendaSession & { speakers: AgendaSessionSpeaker[] };

export default function AgendaPage() {
  const { toast } = useToast();
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [editingSession, setEditingSession] = useState<SessionWithSpeakers | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingSession, setDeletingSession] = useState<SessionWithSpeakers | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [csvText, setCsvText] = useState("");
  const [importResult, setImportResult] = useState<any>(null);
  const [sessionTypeDialogOpen, setSessionTypeDialogOpen] = useState(false);
  const [chatGptDialogOpen, setChatGptDialogOpen] = useState(false);

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });
  const { data: sessionTypes = [] } = useQuery<SessionType[]>({ queryKey: ["/api/admin/session-types"] });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/agenda-sessions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agenda-sessions"] });
      setDeletingSession(null);
      toast({ title: "Session deleted" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  const importMutation = useMutation({
    mutationFn: (data: { csvData: string; eventId: string }) => apiRequest("POST", "/api/admin/agenda-sessions/import-csv", data),
    onSuccess: async (res) => {
      const result = await res.json();
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/admin/agenda-sessions"] });
    },
    onError: (err: any) => {
      toast({ title: "Import failed", description: err.message, variant: "destructive" });
    },
  });

  const sortedEvents = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active.filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active.filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  const effectiveEventId = selectedEventId ?? (sortedEvents.length > 0 ? sortedEvents[0].id : "all");

  const queryParams = effectiveEventId !== "all" ? `?eventId=${effectiveEventId}` : "";
  const { data: sessions = [], isLoading } = useQuery<SessionWithSpeakers[]>({
    queryKey: ["/api/admin/agenda-sessions", effectiveEventId],
    queryFn: async () => {
      const r = await fetch(`/api/admin/agenda-sessions${queryParams}`, { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to fetch sessions: ${r.status}`);
      return r.json();
    },
  });

  const { data: sessionTopicCounts = [] } = useQuery<{ sessionId: string; count: number }[]>({
    queryKey: ["/api/admin/events", effectiveEventId, "session-topic-counts"],
    queryFn: async () => {
      const r = await fetch(`/api/admin/events/${effectiveEventId}/session-topic-counts`, { credentials: "include" });
      if (!r.ok) return [];
      return r.json();
    },
    enabled: effectiveEventId !== "all",
  });

  const topicCountBySession = useMemo(() => {
    const map = new Map<string, number>();
    sessionTopicCounts.forEach(c => map.set(c.sessionId, c.count));
    return map;
  }, [sessionTopicCounts]);

  const filtered = useMemo(() => {
    if (!search) return sessions;
    const q = search.toLowerCase();
    return sessions.filter(s =>
      s.title.toLowerCase().includes(q) ||
      s.sessionCode?.toLowerCase().includes(q) ||
      s.speakers.some(sp => sp.name.toLowerCase().includes(q))
    );
  }, [sessions, search]);

  const getEvent = (id: string) => events.find(e => e.id === id);
  const getSessionTypeLabel = (key: string) => sessionTypes.find(st => st.key === key)?.label || key;

  const counts = useMemo(() => {
    const byStatus = { Draft: 0, Published: 0, Cancelled: 0 };
    sessions.forEach(s => { if (byStatus[s.status as keyof typeof byStatus] !== undefined) byStatus[s.status as keyof typeof byStatus]++; });
    return { total: sessions.length, ...byStatus };
  }, [sessions]);

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => setCsvText(ev.target?.result as string || "");
    reader.readAsText(file);
  };

  const doImport = () => {
    if (!csvText || effectiveEventId === "all") {
      toast({ title: "Select a specific event before importing", variant: "destructive" });
      return;
    }
    importMutation.mutate({ csvData: csvText, eventId: effectiveEventId });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-7xl mx-auto p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground" data-testid="text-agenda-title">Agenda</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage event sessions, speakers, and scheduling</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setSessionTypeDialogOpen(true)} data-testid="button-manage-session-types">
            <Mic2 className="h-4 w-4 mr-1" /> Session Types
          </Button>
          <Button variant="outline" size="sm" onClick={() => setChatGptDialogOpen(true)} data-testid="button-chatgpt-inquiry">
            <Bot className="h-4 w-4 mr-1" /> ChatGPT Inquiry
          </Button>
          <Button variant="outline" size="sm" asChild data-testid="button-download-template">
            <a href="/api/admin/agenda-csv-template" download>
              <Download className="h-4 w-4 mr-1" /> Template
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setImportResult(null); setCsvText(""); setImportDialogOpen(true); }} data-testid="button-upload-csv">
            <Upload className="h-4 w-4 mr-1" /> Upload CSV
          </Button>
          <Button size="sm" onClick={() => setIsCreating(true)} data-testid="button-add-session">
            <Plus className="h-4 w-4 mr-1" /> Add Session
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {sortedEvents.length > 0 && (
          <div className="overflow-x-auto pb-1">
            <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
              {sortedEvents.map((event) => {
                const isActive = effectiveEventId === event.id;
                return (
                  <button
                    key={event.id}
                    data-testid={`tab-event-${event.slug}`}
                    onClick={() => setSelectedEventId(event.id)}
                    className={cn(
                      "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                      isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                    )}
                    style={isActive ? { backgroundColor: event.accentColor ?? "#0D9488", color: "#ffffff" } : undefined}
                  >
                    {event.slug ?? event.name}
                  </button>
                );
              })}
              <button
                data-testid="tab-all-events"
                onClick={() => setSelectedEventId("all")}
                className={cn(
                  "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                  effectiveEventId === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
                style={effectiveEventId === "all" ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
              >
                All Events
              </button>
            </div>
          </div>
        )}
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sessions..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
            data-testid="input-search-sessions"
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Sessions" value={counts.total} icon={<CalendarDays className="h-5 w-5" />} />
        <SummaryCard label="Published" value={counts.Published} icon={<FileText className="h-5 w-5" />} color="text-green-600" />
        <SummaryCard label="Draft" value={counts.Draft} icon={<Edit className="h-5 w-5" />} color="text-amber-600" />
        <SummaryCard label="Cancelled" value={counts.Cancelled} icon={<AlertCircle className="h-5 w-5" />} color="text-red-600" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" /></div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card overflow-x-auto shadow-sm">
          <Table className="min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/30">
                <TableHead>Date</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Sponsor</TableHead>
                <TableHead className="text-center">Speakers</TableHead>
                <TableHead>Status</TableHead>
                {effectiveEventId === "all" && <TableHead>Event</TableHead>}
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(session => (
                <TableRow key={session.id} data-testid={`row-session-${session.id}`}>
                  <TableCell className="whitespace-nowrap text-sm">{session.sessionDate}</TableCell>
                  <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                    <Clock className="h-3 w-3 inline mr-1" />{session.startTime}–{session.endTime}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium text-sm">{session.title}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      {session.sessionCode && <span className="text-xs text-muted-foreground font-mono">{session.sessionCode}</span>}
                      {(topicCountBySession.get(session.id) ?? 0) > 0 && (
                        <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20" data-testid={`topic-count-${session.id}`}>
                          <Sparkles className="h-2.5 w-2.5" />{topicCountBySession.get(session.id)}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{getSessionTypeLabel(session.sessionTypeKey)}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {session.locationName ? (
                      <span><MapPin className="h-3 w-3 inline mr-1" />{session.locationName}</span>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">{session.sponsorNameSnapshot || "—"}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className="text-xs">
                      <Users className="h-3 w-3 mr-1" />{session.speakers.length}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={session.status === "Published" ? "default" : session.status === "Draft" ? "secondary" : "destructive"} className="text-xs">
                      {session.status}
                    </Badge>
                  </TableCell>
                  {effectiveEventId === "all" && (
                    <TableCell>
                      <Badge variant="outline" className="text-xs font-mono">{getEvent(session.eventId)?.slug || "—"}</Badge>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Edit session" onClick={() => setEditingSession(session)} data-testid={`edit-session-${session.id}`}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" title="Delete session" onClick={() => setDeletingSession(session)} data-testid={`delete-session-${session.id}`}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow>
                  <TableCell colSpan={effectiveEventId === "all" ? 10 : 9} className="h-24 text-center text-muted-foreground">
                    No sessions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {(isCreating || editingSession) && (
        <SessionFormModal
          session={editingSession}
          events={events}
          sponsors={sponsors}
          sessionTypes={sessionTypes}
          defaultEventId={effectiveEventId !== "all" ? effectiveEventId : undefined}
          onClose={() => { setIsCreating(false); setEditingSession(null); }}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/admin/agenda-sessions"] });
            setIsCreating(false);
            setEditingSession(null);
          }}
        />
      )}

      <Dialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{deletingSession?.title}"? This will also remove all speakers and saved agenda entries for this session.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeletingSession(null)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deletingSession && deleteMutation.mutate(deletingSession.id)} disabled={deleteMutation.isPending} data-testid="button-confirm-delete-session">
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload Agenda CSV</DialogTitle>
            <DialogDescription>
              Import sessions from a CSV file. {effectiveEventId === "all" ? "Please select a specific event tab first." : `Importing into ${getEvent(effectiveEventId)?.slug || "selected event"}.`}
            </DialogDescription>
          </DialogHeader>
          {!importResult ? (
            <div className="space-y-4">
              <div>
                <Label>CSV File</Label>
                <Input type="file" accept=".csv" onChange={handleCsvUpload} data-testid="input-csv-file" />
              </div>
              {csvText && (
                <p className="text-xs text-muted-foreground">{csvText.split("\n").length - 1} data rows detected</p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setImportDialogOpen(false)}>Cancel</Button>
                <Button onClick={doImport} disabled={!csvText || effectiveEventId === "all" || importMutation.isPending} data-testid="button-start-import">
                  {importMutation.isPending ? "Importing..." : "Import"}
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold text-red-600">{importResult.failed}</div>
                  <div className="text-xs text-muted-foreground">Failed</div>
                </div>
                <div className="bg-muted/50 rounded-lg p-3 text-center">
                  <div className="text-2xl font-bold">{importResult.total}</div>
                  <div className="text-xs text-muted-foreground">Total Rows</div>
                </div>
              </div>
              {importResult.errors?.length > 0 && (
                <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-lg p-3 max-h-40 overflow-y-auto">
                  <p className="text-xs font-medium text-red-700 dark:text-red-400 mb-1">Errors:</p>
                  {importResult.errors.map((e: string, i: number) => (
                    <p key={i} className="text-xs text-red-600 dark:text-red-400">{e}</p>
                  ))}
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => { setImportDialogOpen(false); setImportResult(null); setCsvText(""); }}>Done</Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SessionTypeManager
        open={sessionTypeDialogOpen}
        onClose={() => setSessionTypeDialogOpen(false)}
        sessionTypes={sessionTypes}
      />

      <ChatGptInquiryModal
        open={chatGptDialogOpen}
        onClose={() => setChatGptDialogOpen(false)}
        sessions={sessions}
        eventName={effectiveEventId !== "all" ? (events.find(e => e.id === effectiveEventId)?.name ?? "") : ""}
      />
    </motion.div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color?: string }) {
  return (
    <div className="bg-card border border-border/60 rounded-xl p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={`${color || "text-muted-foreground"}`}>{icon}</div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </div>
  );
}

function SessionTypeManager({ open, onClose, sessionTypes }: { open: boolean; onClose: () => void; sessionTypes: SessionType[] }) {
  const { toast } = useToast();
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ key: "", label: "", speakerLabelSingular: "Speaker", speakerLabelPlural: "Speakers" });

  const createMutation = useMutation({
    mutationFn: (data: any) => apiRequest("POST", "/api/admin/session-types", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session-types"] });
      setForm({ key: "", label: "", speakerLabelSingular: "Speaker", speakerLabelPlural: "Speakers" });
      toast({ title: "Session type created" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => apiRequest("PATCH", `/api/admin/session-types/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session-types"] });
      setEditId(null);
      toast({ title: "Session type updated" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/admin/session-types/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/session-types"] });
      toast({ title: "Session type deleted" });
    },
    onError: (err: any) => toast({ title: "Delete failed", description: err.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Session Types</DialogTitle>
          <DialogDescription>Manage session type definitions used across the agenda.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 max-h-[400px] overflow-y-auto">
          {sessionTypes.map(st => (
            <div key={st.id} className="flex items-center gap-3 bg-muted/30 rounded-lg p-3">
              {editId === st.id ? (
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <Input defaultValue={st.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} placeholder="Label" data-testid={`input-edit-label-${st.id}`} />
                  <Input defaultValue={st.speakerLabelSingular} onChange={e => setForm(f => ({ ...f, speakerLabelSingular: e.target.value }))} placeholder="Speaker (singular)" />
                  <Input defaultValue={st.speakerLabelPlural} onChange={e => setForm(f => ({ ...f, speakerLabelPlural: e.target.value }))} placeholder="Speakers (plural)" />
                  <div className="flex gap-1">
                    <Button size="sm" onClick={() => updateMutation.mutate({ id: st.id, data: { label: form.label || st.label, speakerLabelSingular: form.speakerLabelSingular || st.speakerLabelSingular, speakerLabelPlural: form.speakerLabelPlural || st.speakerLabelPlural } })}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditId(null)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1">
                    <div className="font-medium text-sm">{st.label}</div>
                    <div className="text-xs text-muted-foreground font-mono">{st.key} · {st.speakerLabelSingular}/{st.speakerLabelPlural}</div>
                  </div>
                  <Badge variant={st.isActive ? "default" : "secondary"} className="text-xs">{st.isActive ? "Active" : "Inactive"}</Badge>
                  <Button variant="ghost" size="icon" onClick={() => { setEditId(st.id); setForm({ key: st.key, label: st.label, speakerLabelSingular: st.speakerLabelSingular, speakerLabelPlural: st.speakerLabelPlural }); }} data-testid={`edit-session-type-${st.id}`}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(st.id)} data-testid={`delete-session-type-${st.id}`}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-2">Add New Session Type</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="Key (e.g. WORKSHOP)" value={form.key} onChange={e => setForm(f => ({ ...f, key: e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, "") }))} data-testid="input-new-session-type-key" />
            <Input placeholder="Label (e.g. Workshop)" value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} data-testid="input-new-session-type-label" />
            <Input placeholder="Speaker (singular)" value={form.speakerLabelSingular} onChange={e => setForm(f => ({ ...f, speakerLabelSingular: e.target.value }))} />
            <Input placeholder="Speakers (plural)" value={form.speakerLabelPlural} onChange={e => setForm(f => ({ ...f, speakerLabelPlural: e.target.value }))} />
          </div>
          <Button className="mt-2" size="sm" disabled={!form.key || !form.label || createMutation.isPending} onClick={() => createMutation.mutate(form)} data-testid="button-create-session-type">
            Add Session Type
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const CHATGPT_FIXED_PROMPT = `Analyze the following conference agenda and session descriptions. Your task has two outputs only.

Output 1 – Agenda Topics
Identify the top 15 Agenda Topics discussed across the sessions.

Rules:
Topics must be 1–2 words only
Topics must represent the core concepts discussed across sessions
Topics must be ordered from most relevant to least relevant

Do not number the list
Display one topic per row
Avoid duplicates or overlapping topics

Output 2 – Session Topic Mapping
For each session in the agenda:
List the session title
Identify the Agenda Topic(s) associated with that session

Rules:
Only use the Agenda Topics identified in Output 1
A session may have multiple Agenda Topics
Exclude networking sessions, breaks, and meals

Do not create new topics
Format:
Session Title
Agenda Topics: Topic A, Topic B

Industry Context (Important)

When identifying Agenda Topics, prioritize terminology commonly used in these industries:
Banking, Credit Unions, Governance, Risk, Compliance, Treasury Management, Banking Technology

Topics should reflect language typically used by executives and practitioners in these industries.

Prefer industry-standard terminology when defining Agenda Topics rather than generic phrasing.
For example:
Use Third-Party Risk instead of Vendor Monitoring
Use Financial Crime instead of Fraud Prevention
Use AI Governance instead of AI Oversight

Agenda to Analyze`;

function buildChatGptPrompt(sessions: SessionWithSpeakers[]): string {
  if (sessions.length === 0) {
    return `${CHATGPT_FIXED_PROMPT}\n\nNo agenda sessions found for this event.`;
  }
  const agendaLines = sessions.map(s => {
    const titleLine = `Session Title: ${s.title}`;
    const descLine = `Session Description: ${s.description?.trim() || ""}`;
    return `${titleLine}\n${descLine}`;
  }).join("\n\n");
  return `${CHATGPT_FIXED_PROMPT}\n\n${agendaLines}`;
}

function ChatGptInquiryModal({ open, onClose, sessions, eventName }: {
  open: boolean;
  onClose: () => void;
  sessions: SessionWithSpeakers[];
  eventName: string;
}) {
  const [copied, setCopied] = useState(false);
  const prompt = buildChatGptPrompt(sessions);

  function handleCopy() {
    navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl w-full flex flex-col gap-0 p-0 overflow-hidden max-h-[90vh]">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-accent" /> ChatGPT Agenda Inquiry
          </DialogTitle>
          <DialogDescription>
            {eventName
              ? `Copy this prompt and paste it into ChatGPT to generate Agenda Topics and Session Topic Mapping for ${eventName}.`
              : "Select a specific event to generate a focused prompt. Copy and paste into ChatGPT."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 py-4 flex flex-col gap-3 min-h-0">
          <textarea
            readOnly
            data-testid="textarea-chatgpt-prompt"
            value={prompt}
            className="flex-1 w-full min-h-[380px] rounded-lg border border-border/60 bg-muted/40 p-4 text-sm font-mono leading-relaxed text-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/40 overflow-y-auto"
          />
        </div>

        <div className="px-6 pb-5 flex justify-between items-center shrink-0 border-t border-border/60 pt-4">
          <p className="text-xs text-muted-foreground">
            {sessions.length === 0 ? "No sessions in this event" : `${sessions.length} session${sessions.length !== 1 ? "s" : ""} included`}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onClose} data-testid="button-chatgpt-close">
              Close
            </Button>
            <Button size="sm" onClick={handleCopy} data-testid="button-chatgpt-copy" className="min-w-[110px]">
              {copied ? (
                <><Check className="h-4 w-4 mr-1.5" /> Copied!</>
              ) : (
                <><Copy className="h-4 w-4 mr-1.5" /> Copy</>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
