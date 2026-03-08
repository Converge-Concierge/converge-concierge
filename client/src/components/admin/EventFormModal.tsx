import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Event, InsertEvent } from "@shared/schema";
import { MeetingLocationsEditor } from "./MeetingLocationsEditor";
import { MeetingBlocksEditor } from "./MeetingBlocksEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock, ImagePlus, X, ChevronDown, ChevronUp, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertEvent) => void;
  event?: Event;
  readOnly?: boolean;
}

const COLOR_FIELDS = [
  { key: "primaryColor",   label: "Primary Color",         hint: "Main dark brand color" },
  { key: "secondaryColor", label: "Secondary Color",        hint: "Background/light surface" },
  { key: "accentColor",    label: "Accent Color",           hint: "Highlights, links, icons" },
  { key: "buttonColor",    label: "Button Color",           hint: "CTA button background" },
  { key: "bgAccentColor",  label: "Background Accent",      hint: "Gradient start or tint" },
] as const;

export function EventFormModal({ isOpen, onClose, onSubmit, event, readOnly }: EventFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertEvent>>({
    name: "",
    slug: "",
    location: "",
    startDate: new Date(),
    endDate: new Date(),
    archiveState: "active",
    meetingLocations: [],
    meetingBlocks: [],
  });
  const [logoUploading, setLogoUploading] = useState(false);
  const [colorOpen, setColorOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleLogoFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setLogoUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      setFormData((prev) => ({ ...prev, logoUrl: url }));
    } catch {
      alert("Logo upload failed. Please try again.");
    } finally {
      setLogoUploading(false);
    }
  }

  useEffect(() => {
    if (event) {
      setFormData({ ...event, startDate: new Date(event.startDate), endDate: new Date(event.endDate) });
      const hasColors = event.primaryColor || event.secondaryColor || event.accentColor || event.buttonColor || event.bgAccentColor;
      setColorOpen(!!hasColors);
    } else {
      setFormData({ name: "", slug: "", location: "", startDate: new Date(), endDate: new Date(), archiveState: "active", meetingLocations: [], meetingBlocks: [] });
      setColorOpen(false);
    }
  }, [event, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    onSubmit(formData as InsertEvent);
  };

  const setColor = (key: string, value: string) => setFormData((prev) => ({ ...prev, [key]: value || null }));

  const hasCustomColors = COLOR_FIELDS.some(({ key }) => !!(formData as any)[key]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{readOnly ? "View Event" : event ? "Edit Event" : "Create Event"}</DialogTitle>
        </DialogHeader>

        {readOnly && (
          <div className="mx-6 mt-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 px-4 py-2.5">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Archived – Read Only. This event cannot be edited.</p>
          </div>
        )}

        <ScrollArea className="flex-1 p-6">
          <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
            <fieldset disabled={readOnly} className="space-y-6 border-none p-0 m-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Event Code</Label>
                  <Input id="slug" value={formData.slug} onChange={(e) => setFormData({ ...formData, slug: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="e.g. FRC2026" required />
                  <p className="text-[10px] text-muted-foreground">Short event code used for internal scheduling and reports.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Event Location</Label>
                  <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.archiveState ?? "active"}
                    onChange={(e) => setFormData({ ...formData, archiveState: e.target.value as "active" | "archived" })}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={formData.startDate instanceof Date && !isNaN(formData.startDate.getTime()) ? formData.startDate.toISOString().split("T")[0] : ""} onChange={(e) => { const d = e.target.value ? new Date(e.target.value + "T12:00:00") : new Date(); setFormData({ ...formData, startDate: d }); }} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={formData.endDate instanceof Date && !isNaN(formData.endDate.getTime()) ? formData.endDate.toISOString().split("T")[0] : ""} onChange={(e) => { const d = e.target.value ? new Date(e.target.value + "T12:00:00") : new Date(); setFormData({ ...formData, endDate: d }); }} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Event Logo</Label>
                <div className="flex gap-2">
                  <Input
                    id="logoUrl"
                    value={formData.logoUrl?.startsWith("/uploads/") ? "" : (formData.logoUrl || "")}
                    onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                    placeholder="Paste image URL or upload a file"
                    data-testid="input-event-logo-url"
                  />
                  {!readOnly && (
                    <button
                      type="button"
                      disabled={logoUploading}
                      onClick={() => fileRef.current?.click()}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-60"
                      data-testid="btn-event-logo-upload"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {logoUploading ? "Uploading…" : "Upload"}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleLogoFile(f); }}
                />
                {formData.logoUrl && (
                  <div className="flex items-center gap-3 mt-1 p-2 rounded-lg border border-border bg-muted/20">
                    <img src={formData.logoUrl} alt="Logo preview" className="h-8 w-8 object-contain rounded" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
                    <span className="text-xs text-muted-foreground flex-1 truncate">
                      {formData.logoUrl.startsWith("/uploads/") ? "Uploaded file" : formData.logoUrl.slice(0, 60) + (formData.logoUrl.length > 60 ? "…" : "")}
                    </span>
                    {!readOnly && (
                      <button type="button" onClick={() => setFormData({ ...formData, logoUrl: "" })} className="text-xs text-destructive hover:underline shrink-0">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </fieldset>

            {/* Color Scheme */}
            <div className="border rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => setColorOpen((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/60 transition-colors text-left"
                data-testid="btn-color-scheme-toggle"
              >
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-accent" />
                  <span className="text-sm font-semibold">Event Color Scheme</span>
                  <span className="text-xs text-muted-foreground">(optional)</span>
                  {hasCustomColors && (
                    <div className="flex gap-1 ml-2">
                      {COLOR_FIELDS.map(({ key }) => {
                        const val = (formData as any)[key];
                        return val ? <div key={key} className="h-3 w-3 rounded-full border border-border/50" style={{ background: val }} /> : null;
                      })}
                    </div>
                  )}
                </div>
                {colorOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>

              {colorOpen && (
                <div className="p-4 space-y-3 border-t">
                  <p className="text-xs text-muted-foreground">
                    These colors will theme the public event page for this event. Leave blank to use global branding.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {COLOR_FIELDS.map(({ key, label, hint }) => {
                      const val = (formData as any)[key] || "";
                      return (
                        <div key={key} className="space-y-1">
                          <Label className="text-xs font-medium">{label}</Label>
                          <p className="text-[10px] text-muted-foreground">{hint}</p>
                          <div className="flex gap-2 items-center">
                            <input
                              type="color"
                              value={val || "#000000"}
                              onChange={(e) => setColor(key, e.target.value)}
                              disabled={readOnly}
                              className="h-8 w-10 rounded border border-input cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 p-0.5"
                              data-testid={`color-${key}`}
                            />
                            <Input
                              value={val}
                              onChange={(e) => setColor(key, e.target.value)}
                              placeholder="#000000"
                              disabled={readOnly}
                              className="h-8 text-xs font-mono flex-1"
                              data-testid={`input-color-${key}`}
                            />
                            {val && !readOnly && (
                              <button
                                type="button"
                                onClick={() => setColor(key, "")}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Clear"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-4 border-t pt-6">
              <h3 className="text-lg font-medium">Meeting Configuration</h3>
              <MeetingLocationsEditor
                locations={formData.meetingLocations || []}
                onChange={(locations) => !readOnly && setFormData({ ...formData, meetingLocations: locations })}
                readOnly={readOnly}
              />
            </div>

            <div className="border-t pt-6 pb-4">
              <MeetingBlocksEditor
                blocks={formData.meetingBlocks || []}
                locations={formData.meetingLocations || []}
                onChange={(blocks) => !readOnly && setFormData({ ...formData, meetingBlocks: blocks })}
                readOnly={readOnly}
              />
            </div>
          </form>
        </ScrollArea>

        <DialogFooter className="p-6 border-t bg-muted/30">
          {readOnly ? (
            <Button variant="outline" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="event-form">{event ? "Update Event" : "Create Event"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
