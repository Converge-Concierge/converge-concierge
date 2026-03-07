import { useState, useEffect } from "react";
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { Event, InsertEvent } from "@shared/schema";
  import { MeetingLocationsEditor } from "./MeetingLocationsEditor";
  import { MeetingBlocksEditor } from "./MeetingBlocksEditor";
  import { ScrollArea } from "@/components/ui/scroll-area";

  interface EventFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (data: InsertEvent) => void;
    event?: Event;
  }

  export function EventFormModal({ isOpen, onClose, onSubmit, event }: EventFormModalProps) {
    const [formData, setFormData] = useState<Partial<InsertEvent>>({
      name: "",
      slug: "",
      location: "",
      startDate: new Date(),
      endDate: new Date(),
      status: "active",
      meetingLocations: [],
      meetingBlocks: []
    });

    useEffect(() => {
      if (event) {
        setFormData({
          ...event,
          startDate: new Date(event.startDate),
          endDate: new Date(event.endDate),
        });
      } else {
        setFormData({
          name: "",
          slug: "",
          location: "",
          startDate: new Date(),
          endDate: new Date(),
          status: "active",
          meetingLocations: [],
          meetingBlocks: []
        });
      }
    }, [event, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSubmit(formData as InsertEvent);
    };

    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <DialogTitle>{event ? "Edit Event" : "Create Event"}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 p-6">
            <form id="event-form" onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Event Name</Label>
                  <Input 
                    id="name" 
                    value={formData.name} 
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Slug</Label>
                  <Input 
                    id="slug" 
                    value={formData.slug} 
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value })} 
                    required 
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="location">Event Location</Label>
                  <Input 
                    id="location" 
                    value={formData.location} 
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
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
                  <Input 
                    id="startDate" 
                    type="date" 
                    value={formData.startDate instanceof Date ? formData.startDate.toISOString().split('T')[0] : ''} 
                    onChange={(e) => setFormData({ ...formData, startDate: new Date(e.target.value) })} 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endDate">End Date</Label>
                  <Input 
                    id="endDate" 
                    type="date" 
                    value={formData.endDate instanceof Date ? formData.endDate.toISOString().split('T')[0] : ''} 
                    onChange={(e) => setFormData({ ...formData, endDate: new Date(e.target.value) })} 
                    required 
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="logoUrl">Event Logo (URL or Upload)</Label>
                <Input 
                  id="logoUrl" 
                  value={formData.logoUrl || ""} 
                  onChange={(e) => setFormData({ ...formData, logoUrl: e.target.value })} 
                  placeholder="Enter image URL"
                />
              </div>

              <div className="space-y-4 border-t pt-6">
                <h3 className="text-lg font-medium">Meeting Configuration</h3>
                <MeetingLocationsEditor 
                  locations={formData.meetingLocations || []} 
                  onChange={(locations) => setFormData({ ...formData, meetingLocations: locations })} 
                />
              </div>

              <div className="border-t pt-6 pb-4">
                <MeetingBlocksEditor 
                  blocks={formData.meetingBlocks || []} 
                  onChange={(blocks) => setFormData({ ...formData, meetingBlocks: blocks })} 
                />
              </div>
            </form>
          </ScrollArea>
          <DialogFooter className="p-6 border-t bg-muted/30">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" form="event-form">{event ? "Update Event" : "Create Event"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }