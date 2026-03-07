import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sponsor, InsertSponsor, Event } from "@shared/schema";
import { Checkbox } from "@/components/ui/checkbox";

interface SponsorFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertSponsor) => void;
  sponsor?: Sponsor;
  events: Event[];
}

const LEVELS = ["Platinum", "Gold", "Silver", "Bronze"] as const;

export function SponsorFormModal({ isOpen, onClose, onSubmit, sponsor, events }: SponsorFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertSponsor>>({
    name: "",
    logoUrl: "",
    level: "Gold",
    assignedEvents: [],
    status: "active",
  });

  useEffect(() => {
    if (sponsor) {
      setFormData({ ...sponsor });
    } else {
      setFormData({ name: "", logoUrl: "", level: "Gold", assignedEvents: [], status: "active" });
    }
  }, [sponsor, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as InsertSponsor);
  };

  const toggleEvent = (eventId: string) => {
    const current = formData.assignedEvents || [];
    const updated = current.includes(eventId)
      ? current.filter((id) => id !== eventId)
      : [...current, eventId];
    setFormData({ ...formData, assignedEvents: updated });
  };

  const activeEvents = events.filter((e) => e.status === "active");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{sponsor ? "Edit Sponsor" : "Add Sponsor"}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="flex-1 p-6">
          <form id="sponsor-form" onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="sp-name">Sponsor Name</Label>
              <Input
                id="sp-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-sponsor-name"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sp-level">Sponsorship Level</Label>
                <select
                  id="sp-level"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.level}
                  onChange={(e) => setFormData({ ...formData, level: e.target.value as InsertSponsor["level"] })}
                  data-testid="select-sponsor-level"
                >
                  {LEVELS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sp-status">Status</Label>
                <select
                  id="sp-status"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "archived" })}
                  data-testid="select-sponsor-status"
                >
                  <option value="active">Active</option>
                  <option value="archived">Archived</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sp-logo">Logo URL</Label>
              <Input
                id="sp-logo"
                value={formData.logoUrl || ""}
                onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })}
                placeholder="Enter image URL"
                data-testid="input-sponsor-logo"
              />
            </div>

            <div className="space-y-3">
              <Label>Assigned Event(s)</Label>
              {activeEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">No active events available.</p>
              ) : (
                <div className="space-y-2 rounded-md border p-3">
                  {activeEvents.map((ev) => (
                    <div key={ev.id} className="flex items-center gap-3">
                      <Checkbox
                        id={`ev-${ev.id}`}
                        checked={(formData.assignedEvents || []).includes(ev.id)}
                        onCheckedChange={() => toggleEvent(ev.id)}
                        data-testid={`checkbox-event-${ev.id}`}
                      />
                      <label htmlFor={`ev-${ev.id}`} className="flex items-center gap-2 cursor-pointer text-sm">
                        <span className="font-mono text-xs bg-muted px-1.5 py-0.5 rounded">{ev.slug}</span>
                        <span>{ev.name}</span>
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </ScrollArea>
        <DialogFooter className="p-6 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="sponsor-form" data-testid="button-submit-sponsor">
            {sponsor ? "Update Sponsor" : "Add Sponsor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
