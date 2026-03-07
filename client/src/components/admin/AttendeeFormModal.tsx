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
  readOnly?: boolean;
}

export function AttendeeFormModal({ isOpen, onClose, onSubmit, attendee, events, readOnly }: AttendeeFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertAttendee>>({
    name: "",
    company: "",
    title: "",
    email: "",
    linkedinUrl: "",
    assignedEvent: "",
  });

  useEffect(() => {
    if (attendee) {
      setFormData({ ...attendee, linkedinUrl: attendee.linkedinUrl || "" });
    } else {
      setFormData({ name: "", company: "", title: "", email: "", linkedinUrl: "", assignedEvent: "" });
    }
  }, [attendee, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const data = { ...formData };
    if (!data.linkedinUrl) delete data.linkedinUrl;
    onSubmit(data as InsertAttendee);
  };

  const activeEvents = events.filter((e) => e.status === "active");

  const assignedEvent = events.find((e) => e.id === formData.assignedEvent);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle>{readOnly ? "Attendee Details" : attendee ? "Edit Attendee" : "Add Attendee"}</DialogTitle>
        </DialogHeader>
        {readOnly && (
          <div className="mx-6 mt-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-2.5 text-sm font-medium text-amber-800 dark:text-amber-300">
            Archived – Read Only
          </div>
        )}
        <form id="attendee-form" onSubmit={handleSubmit} className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="at-name">Name</Label>
              <Input
                id="at-name"
                value={formData.name}
                onChange={(e) => !readOnly && setFormData({ ...formData, name: e.target.value })}
                required={!readOnly}
                readOnly={readOnly}
                data-testid="input-attendee-name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-company">Company</Label>
              <Input
                id="at-company"
                value={formData.company}
                onChange={(e) => !readOnly && setFormData({ ...formData, company: e.target.value })}
                required={!readOnly}
                readOnly={readOnly}
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
                onChange={(e) => !readOnly && setFormData({ ...formData, title: e.target.value })}
                required={!readOnly}
                readOnly={readOnly}
                data-testid="input-attendee-title"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-email">Email</Label>
              <Input
                id="at-email"
                type="email"
                value={formData.email}
                onChange={(e) => !readOnly && setFormData({ ...formData, email: e.target.value })}
                required={!readOnly}
                readOnly={readOnly}
                data-testid="input-attendee-email"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="at-linkedin">LinkedIn URL <span className="text-muted-foreground font-normal">(optional)</span></Label>
            <Input
              id="at-linkedin"
              type={readOnly ? "text" : "url"}
              value={formData.linkedinUrl || ""}
              onChange={(e) => !readOnly && setFormData({ ...formData, linkedinUrl: e.target.value })}
              placeholder="https://linkedin.com/in/..."
              readOnly={readOnly}
              data-testid="input-attendee-linkedin"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="at-event">Assigned Event</Label>
            {readOnly ? (
              <Input
                id="at-event"
                value={assignedEvent ? `[${assignedEvent.slug}] ${assignedEvent.name}` : formData.assignedEvent || ""}
                readOnly
                data-testid="input-attendee-event-readonly"
              />
            ) : (
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
            )}
          </div>
        </form>
        <DialogFooter className="px-6 pb-6 border-t pt-4 bg-muted/30">
          {readOnly ? (
            <Button variant="outline" onClick={onClose}>Close</Button>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" form="attendee-form" data-testid="button-submit-attendee">
                {attendee ? "Update Attendee" : "Add Attendee"}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
