import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Event, InsertEvent } from "@shared/schema";
import { MeetingLocationsEditor } from "./MeetingLocationsEditor";
import { MeetingBlocksEditor } from "./MeetingBlocksEditor";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Lock } from "lucide-react";

interface EventFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: InsertEvent) => void;
  event?: Event;
  readOnly?: boolean;
}

export function EventFormModal({ isOpen, onClose, onSubmit, event, readOnly }: EventFormModalProps) {
  const [formData, setFormData] = useState<Partial<InsertEvent>>({
    name: "",
    slug: "",
    location: "",
    startDate: new Date(),
    endDate: new Date(),
    status: "active",
    meetingLocations: [],
    meetingBlocks: [],
  });

  useEffect(() => {
    if (event) {
      setFormData({ ...event, startDate: new Date(event.startDate), endDate: new Date(event.endDate) });
    } else {
      setFormData({ name: "", slug: "", location: "", startDate: new Date(), endDate: new Date(), status: "active", meetingLocations: [], meetingBlocks: [] });
    }
  }, [event, isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly) return;
    onSubmit(formData as InsertEvent);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
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
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as "active" | "archived" })}
                  >
                    <option value="active">Active</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="startDate">Start Date</Label>
                  <Input id="startDate" type="date" value={formData.startDate instanceof Date ? formData.startDate.toISOString().split("T")[0] : ""} onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input id="endDate" type="date" value={formData.endDate instanceof Date ? formData.endDate.toISOString().split("T")[0] : ""} onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })} required />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Event Logo (URL or Upload)</Label>
                <Input id="logoUrl" value={formData.logoUrl || ""} onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} placeholder="Enter image URL" />
              </div>
            </fieldset>

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
