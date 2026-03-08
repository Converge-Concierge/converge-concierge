import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Sponsor, InsertSponsor, Event, EventSponsorLink } from "@shared/schema";
import { Building2, Upload, X, ImagePlus, Lock } from "lucide-react";
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

const LEVELS = ["Platinum", "Gold", "Silver", "Bronze"] as const;

const levelColors: Record<string, string> = {
  Platinum: "border-slate-400 bg-slate-100 text-slate-800",
  Gold:     "border-yellow-400 bg-yellow-50 text-yellow-800",
  Silver:   "border-gray-400 bg-gray-100 text-gray-700",
  Bronze:   "border-orange-400 bg-orange-50 text-orange-800",
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
        setFormData({ ...sponsor, allowOnlineMeetings: sponsor.allowOnlineMeetings ?? false });
      } else {
        setFormData({ name: "", logoUrl: "", level: "Gold", assignedEvents: [], archiveState: "active", allowOnlineMeetings: false });
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

  function toggleEvent(eventId: string) {
    if (readOnly) return;
    const current = formData.assignedEvents || [];
    const existingIdx = current.findIndex((ae) => ae.eventId === eventId);
    if (existingIdx >= 0) {
      const existing = current[existingIdx];
      if ((existing.archiveState ?? "active") === "active") {
        setFormData((prev) => ({ ...prev, assignedEvents: current.filter((_, i) => i !== existingIdx) }));
      } else {
        setFormData((prev) => ({ ...prev, assignedEvents: current.map((ae, i) => i === existingIdx ? { ...ae, archiveState: "active" as const, archiveSource: null } : ae) }));
      }
    } else {
      const newLink: EventSponsorLink = { eventId, archiveState: "active", archiveSource: null };
      setFormData((prev) => ({ ...prev, assignedEvents: [...current, newLink] }));
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (readOnly) return;
    onSubmit(formData as InsertSponsor);
  }

  const hasLogo = !!formData.logoUrl;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 shrink-0">
          <DialogTitle className="text-lg font-display font-semibold">
            {readOnly ? "View Sponsor" : sponsor ? "Edit Sponsor" : "Add Sponsor"}
          </DialogTitle>
        </DialogHeader>

        {readOnly && (
          <div className="mx-6 mb-1 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Archived – Read Only. This sponsor cannot be edited.</p>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <form id="sponsor-form" onSubmit={handleSubmit} className="px-6 pb-6 space-y-5">

            {/* Logo */}
            <div className="space-y-2">
              <Label>Sponsor Logo</Label>
              <div className="flex items-center gap-4">
                <div className={cn("h-16 w-16 rounded-xl border-2 border-dashed flex items-center justify-center shrink-0 overflow-hidden transition-colors", hasLogo ? "border-border bg-white" : "border-border/60 bg-muted/40")}>
                  {hasLogo && !logoError ? (
                    <img src={formData.logoUrl} alt="Logo preview" className="h-full w-full object-contain p-1" onError={() => setLogoError(true)} />
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

              {/* Level + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="sp-level">Sponsorship Level</Label>
                  <select id="sp-level" className={selectClass} value={formData.level} onChange={(e) => setFormData((prev) => ({ ...prev, level: e.target.value as InsertSponsor["level"] }))} data-testid="select-sponsor-level">
                    {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                  <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold w-fit", levelColors[formData.level ?? "Gold"])}>
                    {formData.level}
                  </span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="sp-status">Status</Label>
                  <select id="sp-status" className={selectClass} value={formData.archiveState ?? "active"} onChange={(e) => setFormData((prev) => ({ ...prev, archiveState: e.target.value as "active" | "archived" }))} data-testid="select-sponsor-status">
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
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

            {/* Assign Events */}
            <div className="space-y-2">
              <Label>Assigned Event(s)</Label>
              {(formData.assignedEvents?.length ?? 0) === 0 && readOnly ? (
                <p className="text-sm text-muted-foreground italic py-2">No events assigned.</p>
              ) : (
                <div className="rounded-xl border border-border/60 divide-y divide-border/40 overflow-hidden">
                  {events.filter((ev) => readOnly ? (formData.assignedEvents || []).some((ae) => ae.eventId === ev.id) : (ev.archiveState ?? "active") === "active").map((ev) => {
                    const checked = (formData.assignedEvents || []).some((ae) => ae.eventId === ev.id && (ae.archiveState ?? "active") === "active");
                    return (
                      <label key={ev.id} htmlFor={`ev-${ev.id}`} className={cn("flex items-center gap-3 px-4 py-3 transition-colors", readOnly ? "cursor-default" : "cursor-pointer hover:bg-muted/40", checked ? "bg-accent/5" : "")}>
                        <Checkbox id={`ev-${ev.id}`} checked={checked} onCheckedChange={() => toggleEvent(ev.id)} disabled={readOnly} data-testid={`checkbox-event-${ev.id}`} />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-xs font-semibold text-accent bg-accent/10 border border-accent/20 px-1.5 py-0.5 rounded shrink-0">{ev.slug}</span>
                          <span className="text-sm text-foreground truncate">{ev.name}</span>
                        </div>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-6 pt-4 border-t bg-muted/30 shrink-0 flex gap-2">
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
