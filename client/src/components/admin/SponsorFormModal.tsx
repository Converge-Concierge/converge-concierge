import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sponsor, InsertSponsor, Event, EventSponsorLink, SPONSORSHIP_LEVELS, SponsorshipLevel } from "@shared/schema";
import { Building2, X, ImagePlus, Lock, Globe, Linkedin, Phone, Mail, User, Gem } from "lucide-react";
import { cn } from "@/lib/utils";

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

export function SponsorFormModal({ isOpen, onClose, onSubmit, sponsor, events, isPending, readOnly }: SponsorFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertSponsor>>({ name: "", logoUrl: "", level: "Gold", assignedEvents: [], archiveState: "active", allowOnlineMeetings: false });
  const [dragOver, setDragOver] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setLogoError(false);
      if (sponsor) {
        setFormData({
          ...sponsor,
          allowOnlineMeetings: sponsor.allowOnlineMeetings ?? false,
          attributes: sponsor.attributes ?? [],
          assignedEvents: (sponsor.assignedEvents ?? []).filter(
            (ae) => !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
          ),
        });
      } else {
        setFormData({ name: "", logoUrl: "", assignedEvents: [], archiveState: "active", allowOnlineMeetings: false, attributes: [] });
      }
    }
  }, [sponsor, isOpen]);

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
        const newLink: EventSponsorLink = { eventId, sponsorshipLevel: level, archiveState: "active", archiveSource: null };
        setFormData((prev) => ({ ...prev, assignedEvents: [...current, newLink] }));
      }
    }
  }

  function getEventAssignedLevel(eventId: string): SponsorshipLevel | null {
    const ae = (formData.assignedEvents || []).find((link) => link.eventId === eventId && (link.archiveState ?? "active") === "active");
    return ae?.sponsorshipLevel ?? null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    onSubmit(formData as InsertSponsor);
  }

  const hasLogo = !!formData.logoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg flex flex-col p-0 gap-0" style={{ maxHeight: "92vh" }}>
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0 border-b border-border/30">
          <DialogTitle className="text-lg font-display font-semibold">
            {readOnly ? "View Sponsor" : sponsor ? "Edit Sponsor" : "Add Sponsor"}
          </DialogTitle>
        </DialogHeader>

        {readOnly && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5 shrink-0">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Archived – Read Only. This sponsor cannot be edited.</p>
          </div>
        )}

        <div className="flex-1 overflow-y-auto min-h-0">
          <form id="sponsor-form" onSubmit={handleSubmit} className="px-6 pt-5 pb-6 space-y-5">

            {/* Logo */}
            <div className="space-y-2">
              <Label>Sponsor Logo</Label>
              <div className="flex items-center gap-4">
                <div className={cn("h-16 w-16 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden transition-colors", hasLogo ? "border-border bg-white" : "border-border/60 bg-muted/40")}>
                  {hasLogo && !logoError ? (
                    <img src={formData.logoUrl ?? undefined} alt="Logo preview" className="h-full w-full object-contain p-1" onError={() => setLogoError(true)} />
                  ) : (
                    <Building2 className="h-7 w-7 text-muted-foreground/40" />
                  )}
                </div>

                {!readOnly && (
                  <div
                    className={cn("flex-1 rounded-xl border-2 border-dashed px-4 py-3 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors", dragOver ? "border-accent bg-accent/5" : "border-border/60 hover:border-accent/50 hover:bg-muted/30")}
                    onClick={() => fileInputRef.current?.click()}
                    onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    data-testid="logo-upload-zone"
                  >
                    <ImagePlus className="h-4 w-4 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground text-center"><span className="font-medium text-foreground">Click to upload</span> or drag & drop</p>
                    <p className="text-[11px] text-muted-foreground">PNG, JPG, SVG, WebP</p>
                  </div>
                )}

                {!readOnly && hasLogo && (
                  <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive" onClick={clearLogo} title="Remove logo" data-testid="button-clear-logo">
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} data-testid="input-logo-file" />

              {!readOnly && (
                <div className="space-y-1 pt-1">
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
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="sp-name">Sponsor Name {!readOnly && <span className="text-destructive">*</span>}</Label>
                <Input id="sp-name" value={formData.name} onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))} placeholder="Acme Financial" required={!readOnly} data-testid="input-sponsor-name" />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="sp-status">Status</Label>
                <select id="sp-status" className={selectClass} value={formData.archiveState ?? "active"} onChange={(e) => setFormData((prev) => ({ ...prev, archiveState: e.target.value as "active" | "archived" }))} data-testid="select-sponsor-status">
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>

              {/* Allow Online Meetings toggle */}
              <div className="space-y-2">
                <Label>Allow Online Meetings</Label>
                <div className="flex rounded-lg border border-input overflow-hidden w-fit text-sm">
                  <button
                    type="button"
                    onClick={() => !readOnly && setFormData((prev) => ({ ...prev, allowOnlineMeetings: true }))}
                    className={cn(
                      "px-5 py-2 font-medium transition-colors",
                      formData.allowOnlineMeetings ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                    data-testid="toggle-online-yes"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => !readOnly && setFormData((prev) => ({ ...prev, allowOnlineMeetings: false }))}
                    className={cn(
                      "px-5 py-2 font-medium transition-colors border-l border-input",
                      !formData.allowOnlineMeetings ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
                    )}
                    data-testid="toggle-online-no"
                  >
                    No
                  </button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {formData.allowOnlineMeetings
                    ? "Attendees may submit an online meeting request for this sponsor."
                    : "Only onsite meeting scheduling is available for this sponsor."}
                </p>
              </div>
            </fieldset>

            {/* Solution Types — free-form, up to 3 */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Solution Types <span className="text-muted-foreground font-normal text-xs">(up to 3)</span></Label>
                {(formData.attributes ?? []).filter(Boolean).length > 0 && (
                  <span className="text-xs text-accent font-medium">{(formData.attributes ?? []).filter(Boolean).length} entered</span>
                )}
              </div>
              <div className="space-y-2">
                {[0, 1, 2].map((i) => {
                  const current = formData.attributes ?? [];
                  const val = current[i] ?? "";
                  const filledBefore = i === 0 || !!(current[i - 1] ?? "").trim();
                  if (i > 0 && !filledBefore && !val) return null;
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <Input
                        value={val}
                        disabled={readOnly}
                        placeholder={i === 0 ? "e.g. Compliance" : i === 1 ? "e.g. Payments" : "e.g. AI"}
                        className="h-8 text-xs flex-1"
                        data-testid={`input-solution-type-${i}`}
                        onChange={(e) => {
                          if (readOnly) return;
                          const next = [...(formData.attributes ?? [])];
                          while (next.length <= i) next.push("");
                          next[i] = e.target.value;
                          setFormData((p) => ({ ...p, attributes: next }));
                        }}
                      />
                      {!readOnly && val && (
                        <button
                          type="button"
                          onClick={() => {
                            const next = [...(formData.attributes ?? [])];
                            next.splice(i, 1);
                            setFormData((p) => ({ ...p, attributes: next }));
                          }}
                          className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                          data-testid={`remove-solution-type-${i}`}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  );
                })}
                {/* Show third input only after second is filled */}
                {!readOnly && (formData.attributes ?? []).filter(Boolean).length < 3 && (formData.attributes ?? []).filter(Boolean).length > 0 && !(formData.attributes ?? [])[2] && (
                  <p className="text-[10px] text-muted-foreground">Fill the field above to add another</p>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">Used to filter sponsors by Solution Type on the event page.</p>
            </div>

            {/* Sponsor Profile */}
            <div className="pt-1 border-t border-border/40 space-y-4">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 pt-1">
                <Globe className="h-3.5 w-3.5 text-accent" /> Sponsor Profile
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sp-short-desc" className="text-xs">Short Description</Label>
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
              <div className="space-y-1.5">
                <Label htmlFor="sp-website" className="text-xs flex items-center gap-1.5"><Globe className="h-3.5 w-3.5" /> Website URL</Label>
                <Input
                  id="sp-website"
                  disabled={readOnly}
                  value={formData.websiteUrl ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, websiteUrl: e.target.value }))}
                  placeholder="https://sponsor.com"
                  className="h-8 text-xs"
                  data-testid="input-sponsor-website"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-linkedin" className="text-xs flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn URL</Label>
                <Input
                  id="sp-linkedin"
                  disabled={readOnly}
                  value={formData.linkedinUrl ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, linkedinUrl: e.target.value }))}
                  placeholder="https://linkedin.com/company/…"
                  className="h-8 text-xs"
                  data-testid="input-sponsor-linkedin"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sp-solutions" className="text-xs">Solutions Summary</Label>
                <textarea
                  id="sp-solutions"
                  rows={3}
                  disabled={readOnly}
                  value={formData.solutionsSummary ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, solutionsSummary: e.target.value }))}
                  placeholder="Describe the products, services, or solutions this sponsor offers…"
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm resize-none focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50 placeholder:text-muted-foreground"
                  data-testid="input-sponsor-solutions"
                />
              </div>
            </div>

            {/* Main Contact */}
            <div className="pt-1 border-t border-border/40 space-y-3">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5 pt-1">
                <User className="h-3.5 w-3.5 text-accent" /> Main Contact
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="sp-contact-name" className="text-xs">Contact Name</Label>
                <Input
                  id="sp-contact-name"
                  disabled={readOnly}
                  value={formData.contactName ?? ""}
                  onChange={(e) => setFormData((p) => ({ ...p, contactName: e.target.value }))}
                  placeholder="Jane Smith"
                  className="h-8 text-xs"
                  data-testid="input-sponsor-contact-name"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sp-contact-email" className="text-xs flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> Email</Label>
                  <Input
                    id="sp-contact-email"
                    type="email"
                    disabled={readOnly}
                    value={formData.contactEmail ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactEmail: e.target.value }))}
                    placeholder="jane@sponsor.com"
                    className="h-8 text-xs"
                    data-testid="input-sponsor-contact-email"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sp-contact-phone" className="text-xs flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Phone</Label>
                  <Input
                    id="sp-contact-phone"
                    type="tel"
                    disabled={readOnly}
                    value={formData.contactPhone ?? ""}
                    onChange={(e) => setFormData((p) => ({ ...p, contactPhone: e.target.value }))}
                    placeholder="+1 555 000 0000"
                    className="h-8 text-xs"
                    data-testid="input-sponsor-contact-phone"
                  />
                </div>
              </div>
            </div>

            {/* Event Sponsorship Assignments */}
            <div className="space-y-2">
              <Label>Event Sponsorship Assignments</Label>
              <p className="text-[11px] text-muted-foreground -mt-1">Select a sponsorship level per event. "None" means not assigned.</p>
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
                        <div
                          key={ev.id}
                          className={cn("flex items-center gap-3 px-4 py-3", currentLevel ? "bg-accent/5" : "")}
                          data-testid={`event-assignment-row-${ev.id}`}
                        >
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <span className="font-mono text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded shrink-0">
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
                              className={cn(selectClass, "w-32 shrink-0")}
                              value={currentLevel ?? ""}
                              onChange={(e) => setEventLevel(ev.id, (e.target.value || null) as SponsorshipLevel | null)}
                              data-testid={`select-event-level-${ev.id}`}
                            >
                              <option value="">None</option>
                              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                            </select>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </form>
        </div>

        <DialogFooter className="px-6 py-4 border-t border-border/30 bg-muted/20 shrink-0 flex gap-2">
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
