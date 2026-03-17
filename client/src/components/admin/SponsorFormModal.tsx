import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sponsor, InsertSponsor, Event, EventSponsorLink, SPONSORSHIP_LEVELS, SponsorshipLevel } from "@shared/schema";
import { Building2, X, ImagePlus, Lock, Globe, Linkedin, Phone, Mail, User, Gem, CalendarDays, Send, Clock, Info, Sparkles, Check, Plus, Tag, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

interface SponsorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertSponsor) => void;
  sponsor?: Sponsor;
  events: Event[];
  isPending?: boolean;
  readOnly?: boolean;
}

const LEVELS = SPONSORSHIP_LEVELS;

const levelColors: Record<string, string> = {
  Platinum: "border-slate-700 bg-slate-800 text-white",
  Gold:     "border-amber-400 bg-amber-50 text-amber-900",
  Silver:   "border-gray-400 bg-gray-100 text-gray-600",
  Bronze:   "border-orange-400 bg-orange-50 text-orange-700",
};

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type TabId = "basic" | "profile" | "contacts" | "topics" | "meetings";

const TABS: { id: TabId; label: string }[] = [
  { id: "basic", label: "Basic Info" },
  { id: "profile", label: "Sponsor Profile" },
  { id: "contacts", label: "Contacts" },
  { id: "topics", label: "Correlated Agenda Topics" },
  { id: "meetings", label: "Meeting Management" },
];

interface EventTopic {
  id: string;
  topicLabel: string;
  topicKey: string;
  topicSource: string;
  status: string;
  isActive: boolean;
  suggestedBySponsorId?: string | null;
}

interface SponsorTopicData {
  eventId: string;
  selectedTopics: { id: string; topicLabel: string }[];
  pendingSuggestions: { id: string; topicLabel: string; suggestedBySponsorId?: string | null }[];
}

export function SponsorFormModal({ isOpen, onClose, onSubmit, sponsor, events, isPending, readOnly }: SponsorFormModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InsertSponsor>>({ name: "", logoUrl: "", level: "Gold", assignedEvents: [], archiveState: "active" });
  const [dragOver, setDragOver] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>("basic");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editedTopics, setEditedTopics] = useState<Record<string, Set<string>>>({});
  const [topicsInitialized, setTopicsInitialized] = useState(false);
  const [newTopicInputs, setNewTopicInputs] = useState<Record<string, string>>({});

  const assignedEventIds = (formData.assignedEvents ?? []).map(ae => ae.eventId);

  const { data: sponsorUserData, refetch: refetchSponsorUser } = useQuery<{ user: { lastLoginAt: string | null } | null }>({
    queryKey: ["/api/admin/sponsors", sponsor?.id, "user"],
    enabled: !!sponsor?.id && isOpen,
    staleTime: 30000,
  });

  const { data: sponsorTopics, refetch: refetchSponsorTopics } = useQuery<SponsorTopicData[]>({
    queryKey: ["/api/admin/sponsors", sponsor?.id, "topic-selections"],
    queryFn: () => fetch(`/api/admin/sponsors/${sponsor!.id}/topic-selections`).then(r => r.json()),
    enabled: !!sponsor?.id && isOpen,
    staleTime: 30000,
  });

  const { data: eventTopicsMap } = useQuery<Record<string, EventTopic[]>>({
    queryKey: ["/api/admin/event-topics-for-sponsor", assignedEventIds.join(",")],
    queryFn: async () => {
      if (assignedEventIds.length === 0) return {};
      const pairs = await Promise.all(
        assignedEventIds.map(async (eid) => {
          const data: EventTopic[] = await fetch(`/api/events/${eid}/interest-topics`).then(r => r.json());
          return [eid, data] as [string, EventTopic[]];
        })
      );
      return Object.fromEntries(pairs);
    },
    enabled: assignedEventIds.length > 0 && isOpen && activeTab === "topics",
    staleTime: 60000,
  });

  const saveTopicsMutation = useMutation({
    mutationFn: async ({ eventId, topicIds }: { eventId: string; topicIds: string[] }) => {
      const res = await apiRequest("POST", `/api/admin/sponsors/${sponsor!.id}/topic-selections`, { eventId, topicIds });
      return res.json();
    },
    onSuccess: (_, { eventId }) => {
      toast({ title: "Topics saved", description: "Correlated Agenda Topics updated." });
      refetchSponsorTopics();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/sponsors", sponsor?.id, "topic-selections"] });
    },
    onError: () => toast({ title: "Error", description: "Failed to save topic selections.", variant: "destructive" }),
  });

  const approveTopicMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/interest-topics/${topicId}`, { status: "APPROVED", isActive: true });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Topic approved", description: "The suggested topic is now active." });
      refetchSponsorTopics();
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-topics-for-sponsor", assignedEventIds.join(",")] });
    },
    onError: () => toast({ title: "Error", description: "Failed to approve topic.", variant: "destructive" }),
  });

  const denyTopicMutation = useMutation({
    mutationFn: async (topicId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/interest-topics/${topicId}`, { status: "DENIED", isActive: false });
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Topic denied", description: "The suggestion has been declined." });
      refetchSponsorTopics();
    },
    onError: () => toast({ title: "Error", description: "Failed to deny topic.", variant: "destructive" }),
  });

  const suggestTopicMutation = useMutation({
    mutationFn: async ({ eventId, topicLabel }: { eventId: string; topicLabel: string }) => {
      const res = await apiRequest("POST", `/api/admin/events/${eventId}/interest-topics`, {
        topicLabel,
        topicSource: "SPONSOR_SUGGESTED",
        status: "PENDING",
        isActive: false,
        suggestedBySponsorId: sponsor?.id,
      });
      return res.json();
    },
    onSuccess: (_, { eventId }) => {
      toast({ title: "Topic suggested", description: "The new topic has been submitted for review." });
      setNewTopicInputs(prev => ({ ...prev, [eventId]: "" }));
      refetchSponsorTopics();
    },
    onError: (err: any) => toast({ title: "Error", description: err?.message ?? "Failed to suggest topic.", variant: "destructive" }),
  });

  const sendAccessMutation = useMutation({
    mutationFn: async (sponsorId: string) => {
      const res = await apiRequest("POST", `/api/admin/sponsors/${sponsorId}/send-access-email`);
      return res.json();
    },
    onSuccess: (data) => {
      if (data.ok) {
        toast({ title: "Access email sent", description: `Login link sent to ${data.sentTo}` });
        refetchSponsorUser();
      } else {
        toast({ title: "Email failed", description: data.error ?? "Could not send access email.", variant: "destructive" });
      }
    },
    onError: () => toast({ title: "Error", description: "Failed to send access email.", variant: "destructive" }),
  });

  useEffect(() => {
    if (isOpen) {
      setLogoError(false);
      setActiveTab("basic");
      setTopicsInitialized(false);
      setEditedTopics({});
      setNewTopicInputs({});
      if (sponsor) {
        setFormData({
          ...sponsor,
          attributes: sponsor.attributes ?? [],
          assignedEvents: (sponsor.assignedEvents ?? []).filter(
            (ae) => !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
          ),
        });
      } else {
        setFormData({ name: "", logoUrl: "", assignedEvents: [], archiveState: "active", attributes: [] });
      }
    }
  }, [sponsor, isOpen]);

  useEffect(() => {
    if (sponsorTopics && !topicsInitialized) {
      const initial: Record<string, Set<string>> = {};
      sponsorTopics.forEach(et => {
        initial[et.eventId] = new Set(et.selectedTopics.map(t => t.id));
      });
      setEditedTopics(initial);
      setTopicsInitialized(true);
    }
  }, [sponsorTopics, topicsInitialized]);

  function handleFile(file: File) {
    if (readOnly || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      setFormData((prev) => ({ ...prev, logoUrl: e.target?.result as string }));
      setLogoError(false);
    };
    reader.readAsDataURL(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (readOnly) return;
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (readOnly) return;
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }

  function clearLogo() {
    if (readOnly) return;
    setFormData((prev) => ({ ...prev, logoUrl: "" }));
    setLogoError(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function setEventLevel(eventId: string, level: SponsorshipLevel | null) {
    if (readOnly) return;
    const current = formData.assignedEvents || [];
    if (level === null) {
      setFormData((prev) => ({ ...prev, assignedEvents: current.filter((ae) => ae.eventId !== eventId) }));
    } else {
      const existingIdx = current.findIndex((ae) => ae.eventId === eventId);
      if (existingIdx >= 0) {
        setFormData((prev) => ({
          ...prev,
          assignedEvents: current.map((ae, i) =>
            i === existingIdx ? { ...ae, sponsorshipLevel: level, archiveState: "active" as const, archiveSource: null } : ae
          ),
        }));
      } else {
        const newLink: EventSponsorLink = {
          eventId,
          sponsorshipLevel: level,
          archiveState: "active",
          archiveSource: null,
          onsiteMeetingEnabled: true,
          onlineMeetingEnabled: true,
          informationRequestEnabled: true,
        };
        setFormData((prev) => ({ ...prev, assignedEvents: [...current, newLink] }));
      }
    }
  }

  function handleActionFlag(eventId: string, flag: "onsiteMeetingEnabled" | "onlineMeetingEnabled" | "informationRequestEnabled", value: boolean) {
    if (readOnly) return;
    setFormData(prev => ({
      ...prev,
      assignedEvents: (prev.assignedEvents ?? []).map(ae =>
        ae.eventId === eventId ? { ...ae, [flag]: value } : ae
      )
    }));
  }

  function handleBlockAccess(eventId: string, useDefault: boolean, blockIds: string[]) {
    if (readOnly) return;
    setFormData(prev => ({
      ...prev,
      assignedEvents: (prev.assignedEvents ?? []).map(ae =>
        ae.eventId === eventId ? { ...ae, useDefaultBlocks: useDefault, selectedBlockIds: blockIds } : ae
      )
    }));
  }

  function getEventAssignedLevel(eventId: string): SponsorshipLevel | null {
    const ae = (formData.assignedEvents || []).find((link) => link.eventId === eventId && (link.archiveState ?? "active") === "active");
    return ae?.sponsorshipLevel ?? null;
  }

  function toggleTopic(eventId: string, topicId: string) {
    setEditedTopics(prev => {
      const current = new Set(prev[eventId] ?? []);
      if (current.has(topicId)) current.delete(topicId);
      else current.add(topicId);
      return { ...prev, [eventId]: current };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    onSubmit(formData as InsertSponsor);
  }

  const hasLogo = !!formData.logoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[1100px] w-[95vw] flex flex-col p-0 gap-0" style={{ maxHeight: "92vh" }}>
        <DialogHeader className="px-6 pt-5 pb-0 shrink-0">
          <DialogTitle className="text-lg font-display font-semibold">
            {readOnly ? "View Sponsor" : sponsor ? "Edit Sponsor" : "Add Sponsor"}
          </DialogTitle>
        </DialogHeader>

        {readOnly && (
          <div className="mx-6 mt-3 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5 shrink-0">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Archived – Read Only. This sponsor cannot be edited.</p>
          </div>
        )}

        <div className="px-6 pt-4 shrink-0 border-b border-border/40">
          <div className="flex gap-0 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "px-5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                  activeTab === tab.id
                    ? "border-accent text-accent"
                    : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
                data-testid={`tab-sponsor-${tab.id}`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="sponsor-form" onSubmit={handleSubmit} className="px-6 pt-6 pb-6">

            {/* ── Basic Info ─────────────────────────────────────────── */}
            {activeTab === "basic" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground mb-4">Sponsor Logo</h3>
                      <div className="flex items-start gap-4">
                        <div className={cn("h-20 w-20 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden transition-colors", hasLogo ? "border-border bg-white" : "border-border/60 bg-muted/40")}>
                          {hasLogo && !logoError ? (
                            <img src={formData.logoUrl ?? undefined} alt="Logo preview" className="h-full w-full object-contain p-1" onError={() => setLogoError(true)} />
                          ) : (
                            <Building2 className="h-8 w-8 text-muted-foreground/40" />
                          )}
                        </div>

                        {!readOnly && (
                          <div className="flex-1 space-y-3">
                            <div
                              className={cn("rounded-xl border-2 border-dashed px-4 py-4 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors", dragOver ? "border-accent bg-accent/5" : "border-border/60 hover:border-accent/50 hover:bg-muted/30")}
                              onClick={() => fileInputRef.current?.click()}
                              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                              onDragLeave={() => setDragOver(false)}
                              onDrop={handleDrop}
                              data-testid="logo-upload-zone"
                            >
                              <ImagePlus className="h-5 w-5 text-muted-foreground" />
                              <p className="text-xs text-muted-foreground text-center"><span className="font-medium text-foreground">Click to upload</span> or drag & drop</p>
                              <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG, WebP</p>
                            </div>
                            {hasLogo && (
                              <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive" onClick={clearLogo} data-testid="button-clear-logo">
                                <X className="h-3 w-3 mr-1" /> Remove logo
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} data-testid="input-logo-file" />

                      {!readOnly && (
                        <div className="space-y-1 pt-3">
                          <p className="text-[11px] text-muted-foreground">Or enter a logo URL directly:</p>
                          <Input
                            value={hasLogo && formData.logoUrl?.startsWith("data:") ? "" : (formData.logoUrl ?? "")}
                            onChange={(e) => { setFormData((prev) => ({ ...prev, logoUrl: e.target.value })); setLogoError(false); }}
                            placeholder="https://example.com/logo.png"
                            className="h-8 text-xs"
                            data-testid="input-sponsor-logo-url"
                          />
                        </div>
                      )}
                    </div>

                    <fieldset disabled={readOnly} className="space-y-5 border-none p-0 m-0">
                      <div className="space-y-2">
                        <Label htmlFor="sp-name">Sponsor Name {!readOnly && <span className="text-destructive">*</span>}</Label>
                        <Input id="sp-name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Acme Financial" required={!readOnly} data-testid="input-sponsor-name" />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="sp-status">Status</Label>
                        <select id="sp-status" className={selectClass} value={formData.archiveState ?? "active"} onChange={(e) => setFormData((prev) => ({ ...prev, archiveState: e.target.value as "active" | "archived" }))} data-testid="select-sponsor-status">
                          <option value="active">Active</option>
                          <option value="archived">Archived</option>
                        </select>
                      </div>
                    </fieldset>
                  </div>
                </div>
              </div>
            )}

            {/* ── Sponsor Profile ────────────────────────────────────── */}
            {activeTab === "profile" && (
              <div className="space-y-6 max-w-2xl">
                <div className="space-y-2">
                  <Label htmlFor="sp-short-desc">Short Description</Label>
                  <textarea
                    id="sp-short-desc"
                    rows={2}
                    disabled={readOnly}
                    value={formData.shortDescription ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, shortDescription: e.target.value }))}
                    placeholder="One-line summary of what this sponsor does…"
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 placeholder:text-muted-foreground"
                    data-testid="input-sponsor-short-desc"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="sp-website" className="flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website URL</Label>
                    <Input
                      id="sp-website"
                      disabled={readOnly}
                      value={formData.websiteUrl ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, websiteUrl: e.target.value }))}
                      placeholder="https://sponsor.com"
                      data-testid="input-sponsor-website"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sp-linkedin" className="flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn URL</Label>
                    <Input
                      id="sp-linkedin"
                      disabled={readOnly}
                      value={formData.linkedinUrl ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, linkedinUrl: e.target.value }))}
                      placeholder="https://linkedin.com/company/…"
                      data-testid="input-sponsor-linkedin"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sp-solutions">Solutions Summary</Label>
                  <textarea
                    id="sp-solutions"
                    rows={5}
                    disabled={readOnly}
                    value={formData.solutionsSummary ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, solutionsSummary: e.target.value }))}
                    placeholder="Describe the products, services, or solutions this sponsor offers…"
                    className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 placeholder:text-muted-foreground"
                    data-testid="input-sponsor-solutions"
                  />
                </div>
              </div>
            )}

            {/* ── Contacts ───────────────────────────────────────────── */}
            {activeTab === "contacts" && (
              <div className="space-y-6 max-w-2xl">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-4 w-4 text-accent" />
                  <h3 className="text-sm font-semibold text-foreground">Main Contact</h3>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sp-contact-name">Contact Name</Label>
                  <Input
                    id="sp-contact-name"
                    disabled={readOnly}
                    value={formData.contactName ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
                    placeholder="Jane Smith"
                    data-testid="input-sponsor-contact-name"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div className="space-y-2">
                    <Label htmlFor="sp-contact-email" className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                    <Input
                      id="sp-contact-email"
                      type="email"
                      disabled={readOnly}
                      value={formData.contactEmail ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))}
                      placeholder="jane@sponsor.com"
                      data-testid="input-sponsor-contact-email"
                    />
                    {sponsorUserData?.user?.lastLoginAt && (
                      <p className="flex items-center gap-1 text-[10px] text-muted-foreground mt-1" data-testid="text-last-accessed">
                        <Clock className="h-2.5 w-2.5" />
                        Last accessed: {format(new Date(sponsorUserData.user.lastLoginAt), "MMM d, yyyy")}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="sp-contact-phone" className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                    <Input
                      id="sp-contact-phone"
                      type="tel"
                      disabled={readOnly}
                      value={formData.contactPhone ?? ""}
                      onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
                      placeholder="+1 555 000 0000"
                      data-testid="input-sponsor-contact-phone"
                    />
                  </div>
                </div>

                <div className="mt-6 p-4 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-800">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Additional sponsor representatives can be managed from the Sponsor Dashboard once the sponsor is created.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Correlated Agenda Topics ───────────────────────────── */}
            {activeTab === "topics" && (
              <div className="space-y-6">
                {!sponsor?.id ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                    <Tag className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Save the sponsor first to configure Correlated Agenda Topics.</p>
                  </div>
                ) : assignedEventIds.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
                    <Tag className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Assign this sponsor to at least one event in Meeting Management to configure Correlated Agenda Topics.</p>
                    <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab("meetings")}>
                      Go to Meeting Management <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-8">
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                      <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                      <p className="text-xs text-muted-foreground">
                        Correlated Agenda Topics connect this sponsor to the same topic framework used to tag sessions and capture attendee interests. Attendees whose selected topics overlap with the sponsor's topics will see this sponsor recommended to them.
                      </p>
                    </div>

                    {assignedEventIds.map((eventId) => {
                      const ev = events.find(e => e.id === eventId);
                      const availableTopics: EventTopic[] = eventTopicsMap?.[eventId] ?? [];
                      const selectedSet = editedTopics[eventId] ?? new Set<string>();
                      const etData = sponsorTopics?.find(et => et.eventId === eventId);
                      const pendingSuggestions = etData?.pendingSuggestions ?? [];
                      const newTopicInput = newTopicInputs[eventId] ?? "";
                      const selectedCount = selectedSet.size;

                      return (
                        <div key={eventId} className="rounded-xl border border-border/60 overflow-hidden" data-testid={`topics-event-section-${eventId}`}>
                          <div className="flex items-center gap-3 px-4 py-3 bg-muted/30 border-b border-border/40">
                            <span className="font-mono text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-0.5 rounded shrink-0">
                              {ev?.slug ?? eventId}
                            </span>
                            <span className="text-sm font-medium text-foreground truncate">{ev?.name ?? eventId}</span>
                            {selectedCount > 0 && (
                              <span className="ml-auto text-xs text-accent font-semibold shrink-0">{selectedCount} selected</span>
                            )}
                          </div>

                          <div className="px-4 py-4 space-y-5">
                            {/* Section A: Topic Chip Selector */}
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Select Correlated Agenda Topics</h4>
                                {!readOnly && selectedCount > 0 && (
                                  <Button
                                    type="button"
                                    size="sm"
                                    className="h-7 px-3 text-xs bg-accent text-accent-foreground hover:bg-accent/90"
                                    disabled={saveTopicsMutation.isPending}
                                    onClick={() => saveTopicsMutation.mutate({ eventId, topicIds: Array.from(selectedSet) })}
                                    data-testid={`btn-save-topics-${eventId}`}
                                  >
                                    {saveTopicsMutation.isPending ? "Saving…" : "Save Topics"}
                                  </Button>
                                )}
                              </div>

                              {availableTopics.length === 0 ? (
                                <p className="text-xs text-muted-foreground italic">
                                  {eventTopicsMap ? "No approved Agenda Topics exist for this event yet. Add topics in the Agenda section first." : "Loading topics…"}
                                </p>
                              ) : (
                                <div className="flex flex-wrap gap-2" data-testid={`topic-chips-${eventId}`}>
                                  {availableTopics.map((topic) => {
                                    const isSelected = selectedSet.has(topic.id);
                                    return (
                                      <button
                                        key={topic.id}
                                        type="button"
                                        disabled={readOnly}
                                        onClick={() => toggleTopic(eventId, topic.id)}
                                        className={cn(
                                          "inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
                                          isSelected
                                            ? "bg-accent text-accent-foreground border-accent"
                                            : "bg-background text-muted-foreground border-border hover:border-accent/60 hover:text-foreground"
                                        )}
                                        data-testid={`chip-topic-${topic.id}`}
                                      >
                                        {isSelected && <Check className="h-3 w-3 shrink-0" />}
                                        {topic.topicLabel}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}

                              {!readOnly && availableTopics.length > 0 && (
                                <div className="flex justify-end">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={selectedCount > 0 ? "default" : "outline"}
                                    className={cn("h-7 px-3 text-xs", selectedCount > 0 ? "bg-accent text-accent-foreground hover:bg-accent/90" : "")}
                                    disabled={saveTopicsMutation.isPending}
                                    onClick={() => saveTopicsMutation.mutate({ eventId, topicIds: Array.from(selectedSet) })}
                                    data-testid={`btn-save-topics-bottom-${eventId}`}
                                  >
                                    {saveTopicsMutation.isPending ? "Saving…" : selectedCount > 0 ? `Save ${selectedCount} Topic${selectedCount !== 1 ? "s" : ""}` : "Save (no topics)"}
                                  </Button>
                                </div>
                              )}
                            </div>

                            {/* Section B: Pending Suggestions */}
                            {pendingSuggestions.length > 0 && (
                              <div className="space-y-2 border-t border-border/30 pt-4">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Sponsor-Suggested Topics — Pending Review</h4>
                                <div className="space-y-1.5">
                                  {pendingSuggestions.map((suggestion) => (
                                    <div
                                      key={suggestion.id}
                                      className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800"
                                      data-testid={`pending-suggestion-${suggestion.id}`}
                                    >
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" />
                                        <span className="text-sm text-amber-900 dark:text-amber-200 font-medium truncate">{suggestion.topicLabel}</span>
                                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium shrink-0">Pending Review</span>
                                      </div>
                                      {!readOnly && (
                                        <div className="flex gap-1.5 shrink-0">
                                          <Button
                                            type="button"
                                            size="sm"
                                            className="h-6 px-2 text-[11px] bg-green-600 hover:bg-green-700 text-white"
                                            disabled={approveTopicMutation.isPending}
                                            onClick={() => approveTopicMutation.mutate(suggestion.id)}
                                            data-testid={`btn-approve-suggestion-${suggestion.id}`}
                                          >
                                            <Check className="h-3 w-3 mr-1" /> Approve
                                          </Button>
                                          <Button
                                            type="button"
                                            size="sm"
                                            variant="outline"
                                            className="h-6 px-2 text-[11px] border-red-200 text-red-600 hover:bg-red-50"
                                            disabled={denyTopicMutation.isPending}
                                            onClick={() => denyTopicMutation.mutate(suggestion.id)}
                                            data-testid={`btn-deny-suggestion-${suggestion.id}`}
                                          >
                                            <X className="h-3 w-3 mr-1" /> Deny
                                          </Button>
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Section C: Suggest New Topic */}
                            {!readOnly && (
                              <div className="space-y-2 border-t border-border/30 pt-4">
                                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Suggest a New Topic for Review</h4>
                                <p className="text-[11px] text-muted-foreground">If you don't see an appropriate Agenda Topic, suggest a new term. It will enter review before becoming active.</p>
                                <div className="flex gap-2">
                                  <Input
                                    value={newTopicInput}
                                    onChange={(e) => setNewTopicInputs(prev => ({ ...prev, [eventId]: e.target.value }))}
                                    placeholder="e.g. Fair Lending"
                                    className="h-8 text-xs flex-1"
                                    data-testid={`input-suggest-topic-${eventId}`}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && newTopicInput.trim()) {
                                        e.preventDefault();
                                        suggestTopicMutation.mutate({ eventId, topicLabel: newTopicInput.trim() });
                                      }
                                    }}
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    className="h-8 px-3 text-xs gap-1"
                                    disabled={!newTopicInput.trim() || suggestTopicMutation.isPending}
                                    onClick={() => suggestTopicMutation.mutate({ eventId, topicLabel: newTopicInput.trim() })}
                                    data-testid={`btn-suggest-topic-${eventId}`}
                                  >
                                    <Plus className="h-3 w-3" /> Submit
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ── Meeting Management (was Event Assignments) ─────────── */}
            {activeTab === "meetings" && (
              <div className="space-y-4">
                <div className="flex items-start gap-2 p-3 rounded-lg border border-border/50 bg-muted/30">
                  <Info className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                  <p className="text-xs text-muted-foreground">
                    Selecting a sponsorship level will automatically assign the corresponding sponsorship package and generate deliverables for that event.
                  </p>
                </div>

                {(() => {
                  const visibleEvents = events.filter((ev) =>
                    readOnly
                      ? (formData.assignedEvents || []).some((ae) => ae.eventId === ev.id && (ae.archiveState ?? "active") === "active")
                      : (ev.archiveState ?? "active") === "active"
                  );
                  if (visibleEvents.length === 0) {
                    return <p className="text-sm text-muted-foreground italic py-2">{readOnly ? "No events assigned." : "No active events available."}</p>;
                  }
                  return (
                    <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                      {visibleEvents.map((ev) => {
                        const currentLevel = getEventAssignedLevel(ev.id);
                        return (
                          <div key={ev.id}>
                            <div
                              className={cn("flex items-center gap-3 px-5 py-4", currentLevel ? "bg-accent/5" : "")}
                              data-testid={`event-assignment-row-${ev.id}`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                <span className="font-mono text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-2 py-1 rounded shrink-0">
                                  {ev.slug}
                                </span>
                                <span className="text-sm text-foreground truncate">{ev.name}</span>
                              </div>
                              {readOnly ? (
                                currentLevel ? (
                                  <span className={cn("inline-flex items-center gap-0.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold shrink-0", levelColors[currentLevel])}>
                                    {currentLevel === "Platinum" && <Gem className="h-3 w-3" />}
                                    {currentLevel}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground italic shrink-0">None</span>
                                )
                              ) : (
                                <select
                                  className={cn(selectClass, "w-36 shrink-0")}
                                  value={currentLevel ?? ""}
                                  onChange={(e) => setEventLevel(ev.id, (e.target.value || null) as SponsorshipLevel | null)}
                                  data-testid={`select-event-level-${ev.id}`}
                                >
                                  <option value="">None</option>
                                  {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                                </select>
                              )}
                            </div>
                            {currentLevel && (
                              <div className="px-5 pb-4 pt-0 space-y-3">
                                <div className="flex gap-6 flex-wrap">
                                  {[
                                    { label: "Onsite Meetings", flag: "onsiteMeetingEnabled" as const },
                                    { label: "Online Meetings", flag: "onlineMeetingEnabled" as const },
                                    { label: "Info Requests", flag: "informationRequestEnabled" as const },
                                  ].map(({ label, flag }) => {
                                    const ae = (formData.assignedEvents || []).find(ae => ae.eventId === ev.id);
                                    const isEnabled = ae?.[flag] ?? true;
                                    return (
                                      <div key={flag} className="flex flex-col gap-1.5">
                                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                          {label}
                                        </span>
                                        <div className="flex rounded-md border border-input overflow-hidden w-fit">
                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleActionFlag(ev.id, flag, true)}
                                            className={cn(
                                              "text-[10px] px-2.5 py-1 font-medium transition-colors",
                                              isEnabled ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            data-testid={`toggle-${flag}-yes-${ev.id}`}
                                          >
                                            Yes
                                          </button>
                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleActionFlag(ev.id, flag, false)}
                                            className={cn(
                                              "text-[10px] px-2.5 py-1 font-medium transition-colors border-l border-input",
                                              !isEnabled ? "bg-muted text-muted-foreground" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            data-testid={`toggle-${flag}-no-${ev.id}`}
                                          >
                                            No
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                {(() => {
                                  const ae = (formData.assignedEvents || []).find(a => a.eventId === ev.id);
                                  const useDefault = ae?.useDefaultBlocks !== false;
                                  const sortedBlocks = [...(ev.meetingBlocks ?? [])].sort((a, b) =>
                                    a.date < b.date ? -1 : a.date > b.date ? 1 : a.startTime.localeCompare(b.startTime)
                                  );
                                  return (
                                    <div className="border-t border-border/30 pt-3">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                                          <CalendarDays className="h-3 w-3" /> Meeting Block Access
                                        </span>
                                        <div className="flex rounded-md border border-input overflow-hidden w-fit">
                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleBlockAccess(ev.id, true, [])}
                                            className={cn(
                                              "text-[10px] px-2 py-0.5 font-medium transition-colors",
                                              useDefault ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            data-testid={`toggle-blocks-default-${ev.id}`}
                                          >
                                            All event blocks
                                          </button>
                                          <button
                                            type="button"
                                            disabled={readOnly}
                                            onClick={() => handleBlockAccess(ev.id, false, ae?.selectedBlockIds ?? [])}
                                            className={cn(
                                              "text-[10px] px-2 py-0.5 font-medium transition-colors border-l border-input",
                                              !useDefault ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"
                                            )}
                                            data-testid={`toggle-blocks-custom-${ev.id}`}
                                          >
                                            Custom
                                          </button>
                                        </div>
                                      </div>
                                      {!useDefault && sortedBlocks.length > 0 && (
                                        <div className="max-h-44 overflow-y-auto space-y-0.5 border border-border/40 rounded-lg p-2 bg-muted/20">
                                          {sortedBlocks.map((block) => {
                                            const checked = (ae?.selectedBlockIds ?? []).includes(block.id);
                                            return (
                                              <label key={block.id} className="flex items-center gap-2 text-xs cursor-pointer py-0.5 hover:bg-muted/40 rounded px-1">
                                                <input
                                                  type="checkbox"
                                                  disabled={readOnly}
                                                  checked={checked}
                                                  onChange={(e) => {
                                                    const newIds = e.target.checked
                                                      ? [...(ae?.selectedBlockIds ?? []), block.id]
                                                      : (ae?.selectedBlockIds ?? []).filter((id) => id !== block.id);
                                                    handleBlockAccess(ev.id, false, newIds);
                                                  }}
                                                  className="h-3.5 w-3.5 rounded border-input shrink-0"
                                                  data-testid={`checkbox-block-${block.id}`}
                                                />
                                                <span className="text-foreground/80">
                                                  {format(new Date(block.date + "T00:00:00"), "EEE, MMM d")}
                                                  {" · "}
                                                  {fmt12(block.startTime)}–{fmt12(block.endTime)}
                                                </span>
                                              </label>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {!useDefault && sortedBlocks.length === 0 && (
                                        <p className="text-[10px] text-muted-foreground italic">No meeting blocks defined for this event yet.</p>
                                      )}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 bg-muted/20 shrink-0 flex flex-wrap gap-2">
          {sponsor?.id && sponsor.contactEmail && (
            <Button
              type="button"
              variant="outline"
              className="gap-2 mr-auto"
              disabled={sendAccessMutation.isPending}
              onClick={() => sendAccessMutation.mutate(sponsor.id)}
              data-testid="btn-send-dashboard-access"
            >
              {sendAccessMutation.isPending ? (
                <><span className="h-3.5 w-3.5 border-2 border-muted-foreground/40 border-t-muted-foreground rounded-full animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Send Dashboard Access</>
              )}
            </Button>
          )}
          {readOnly ? (
            <Button variant="outline" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose} disabled={isPending}>Cancel</Button>
              <Button type="submit" form="sponsor-form" className="bg-accent text-accent-foreground hover:bg-accent/90" disabled={isPending} data-testid="button-submit-sponsor">
                {isPending ? "Saving…" : sponsor ? "Update Sponsor" : "Add Sponsor"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
