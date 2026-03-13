import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Attendee, InsertAttendee, Event } from "@shared/schema";

const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "— Not Set —" },
  { value: "PRACTITIONER", label: "Practitioner" },
  { value: "GOVERNMENT_NONPROFIT", label: "Government / Non-Profit" },
  { value: "SOLUTION_PROVIDER", label: "Solution Provider" },
];

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
    firstName: "",
    lastName: "",
    name: "",
    company: "",
    title: "",
    email: "",
    linkedinUrl: "",
    assignedEvent: "",
    attendeeCategory: "",
  });

  useEffect(() => {
    if (attendee) {
      setFormData({
        firstName: attendee.firstName || attendee.name?.split(" ")[0] || "",
        lastName: attendee.lastName || attendee.name?.split(" ").slice(1).join(" ") || "",
        name: attendee.name || "",
        company: attendee.company || "",
        title: attendee.title || "",
        email: attendee.email || "",
        linkedinUrl: attendee.linkedinUrl || "",
        assignedEvent: attendee.assignedEvent || "",
        attendeeCategory: attendee.attendeeCategory || "",
      });
    } else {
      setFormData({ firstName: "", lastName: "", name: "", company: "", title: "", email: "", linkedinUrl: "", assignedEvent: "", attendeeCategory: "" });
    }
  }, [attendee, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const fullName = [formData.firstName, formData.lastName].filter(Boolean).join(" ");
    const payload: Partial<InsertAttendee> = {
      firstName: formData.firstName || "",
      lastName: formData.lastName || "",
      name: fullName,
      company: formData.company || "",
      title: formData.title || "",
      email: formData.email || "",
      assignedEvent: formData.assignedEvent || "",
      attendeeCategory: formData.attendeeCategory || null,
    };
    if (formData.linkedinUrl) {
      payload.linkedinUrl = formData.linkedinUrl;
    }
    onSubmit(payload as InsertAttendee);
  };

  const activeEvents = events.filter((e) => (e.archiveState ?? "active") === "active");
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
        <form id="attendee-form" onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="at-firstName">First Name</Label>
              <Input
                id="at-firstName"
                value={formData.firstName || ""}
                onChange={(e) => !readOnly && setFormData({ ...formData, firstName: e.target.value })}
                required={!readOnly}
                readOnly={readOnly}
                data-testid="input-attendee-firstname"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="at-lastName">Last Name</Label>
              <Input
                id="at-lastName"
                value={formData.lastName || ""}
                onChange={(e) => !readOnly && setFormData({ ...formData, lastName: e.target.value })}
                readOnly={readOnly}
                data-testid="input-attendee-lastname"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
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

          <div className="grid grid-cols-2 gap-4">
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
            <div className="space-y-2">
              <Label htmlFor="at-category">Category</Label>
              {readOnly ? (
                <Input
                  id="at-category"
                  value={CATEGORY_OPTIONS.find(o => o.value === (formData.attendeeCategory || ""))?.label || formData.attendeeCategory || "— Not Set —"}
                  readOnly
                  data-testid="input-attendee-category-readonly"
                />
              ) : (
                <select
                  id="at-category"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={formData.attendeeCategory || ""}
                  onChange={(e) => setFormData({ ...formData, attendeeCategory: e.target.value })}
                  data-testid="select-attendee-category"
                >
                  {CATEGORY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-[10px] text-muted-foreground">Used for attendee segmentation, matchmaking, and reporting.</p>
            </div>
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
