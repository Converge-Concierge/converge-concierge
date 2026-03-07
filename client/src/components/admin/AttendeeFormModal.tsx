import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Attendee, InsertAttendee, Event } from "@shared/schema";

interface AttendeeFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertAttendee) => void;
  attendee?: Attendee;
  events: Event[];
}

export function AttendeeFormModal({ isOpen, onClose, onSubmit, attendee, events }: AttendeeFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertAttendee>>({
    name: "",
    company: "",
    title: "",
    email: "",
    assignedEvent: "",
  });

  useEffect(() => {
    if (attendee) {
      setFormData({ ...attendee });
    } else {
      setFormData({ name: "", company: "", title: "", email: "", assignedEvent: "" });
    }
  }, [attendee, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData as InsertAttendee);
  };

  const activeEvents = events.filter((e) => e.status === "active");

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{attendee ? "Edit Attendee" : "Add Attendee"}</DialogTitle>
        </DialogHeader>
        <form id="attendee-form" onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="at-name">Name</Label>
              <Input
                id="at-name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                data-testid="input-attendee-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-company">Company</Label>
              <Input
                id="at-company"
                value={formData.company}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                required
                data-testid="input-attendee-company"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="at-title">Title</Label>
              <Input
                id="at-title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                data-testid="input-attendee-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-email">Email</Label>
              <Input
                id="at-email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                data-testid="input-attendee-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="at-event">Assigned Event</Label>
            <select
              id="at-event"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={formData.assignedEvent}
              onChange={(e) => setFormData({ ...formData, assignedEvent: e.target.value })}
              required
              data-testid="select-attendee-event"
            >
              <option value="">Select an event...</option>
              {activeEvents.map((ev) => (
                <option key={ev.id} value={ev.id}>
                  [{ev.slug}] {ev.name}
                </option>
              ))}
            </select>
          </div>
        </form>
        <DialogFooter className="px-6 pb-6 border-t pt-4 bg-muted/30">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="attendee-form" data-testid="button-submit-attendee">
            {attendee ? "Update Attendee" : "Add Attendee"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
