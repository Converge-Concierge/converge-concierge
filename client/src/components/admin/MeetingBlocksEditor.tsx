import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeetingTimeBlock, MeetingLocation } from "@shared/schema";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin, AlertCircle, Pencil, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingBlocksEditorProps {
  blocks: MeetingTimeBlock[];
  onChange: (blocks: MeetingTimeBlock[]) => void;
  locations?: MeetingLocation[];
  readOnly?: boolean;
  eventStartDate?: Date;
  eventEndDate?: Date;
  bookedBlockIds?: string[];
}

export function MeetingBlocksEditor({ blocks, onChange, locations = [], readOnly, eventStartDate, eventEndDate, bookedBlockIds = [] }: MeetingBlocksEditorProps) {
  const [newBlock, setNewBlock] = useState({ date: "", startTime: "09:00", endTime: "12:00" });
  const [dateError, setDateError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ startTime: string; endTime: string }>({ startTime: "", endTime: "" });
  const [editError, setEditError] = useState("");

  const addBlock = () => {
    if (!newBlock.date || !newBlock.startTime || !newBlock.endTime || readOnly) return;
    setDateError("");

    if (eventStartDate && eventEndDate) {
      const blockDate = new Date(newBlock.date + "T00:00:00");
      const start = new Date(eventStartDate);
      const end = new Date(eventEndDate);
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
      if (blockDate < start || blockDate > end) {
        setDateError(`Date must be within the event dates (${start.toLocaleDateString()} – ${end.toLocaleDateString()}).`);
        return;
      }
    }

    const block: MeetingTimeBlock = { id: crypto.randomUUID(), ...newBlock, locationIds: [] };
    onChange(
      [...blocks, block].sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0 ? d : a.startTime.localeCompare(b.startTime);
      }),
    );
    setNewBlock({ date: "", startTime: "09:00", endTime: "12:00" });
  };

  const removeBlock = (id: string) => {
    if (readOnly) return;
    onChange(blocks.filter((b) => b.id !== id));
  };

  const startEdit = (block: MeetingTimeBlock) => {
    setEditingId(block.id);
    setEditForm({ startTime: block.startTime, endTime: block.endTime });
    setEditError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditError("");
  };

  const saveEdit = (blockId: string) => {
    setEditError("");
    if (!editForm.startTime || !editForm.endTime) {
      setEditError("Start and end times are required.");
      return;
    }
    if (editForm.startTime >= editForm.endTime) {
      setEditError("Start time must be before end time.");
      return;
    }
    onChange(blocks.map((b) => b.id === blockId ? { ...b, startTime: editForm.startTime, endTime: editForm.endTime } : b));
    setEditingId(null);
  };

  const toggleLocation = (blockId: string, locationId: string) => {
    if (readOnly) return;
    onChange(blocks.map((b) => {
      if (b.id !== blockId) return b;
      const ids = b.locationIds ?? [];
      const has = ids.includes(locationId);
      return { ...b, locationIds: has ? ids.filter((id) => id !== locationId) : [...ids, locationId] };
    }));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Meeting Time Blocks</Label>
      </div>

      {!readOnly && (
        <div className="space-y-2">
          <div className="grid grid-cols-3 gap-2 items-end bg-muted/30 p-3 rounded-lg border">
            <div className="space-y-1">
              <Label htmlFor="block-date" className="text-[10px] uppercase text-muted-foreground">Date</Label>
              <Input id="block-date" type="date" value={newBlock.date} onChange={(e) => { setDateError(""); setNewBlock({ ...newBlock, date: e.target.value }); }} className="h-8 text-xs" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="block-start" className="text-[10px] uppercase text-muted-foreground">Start Time</Label>
              <Input id="block-start" type="time" value={newBlock.startTime} onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })} className="h-8 text-xs" />
            </div>
            <div className="space-y-1 flex gap-2">
              <div className="flex-1 space-y-1">
                <Label htmlFor="block-end" className="text-[10px] uppercase text-muted-foreground">End Time</Label>
                <Input id="block-end" type="time" value={newBlock.endTime} onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })} className="h-8 text-xs" />
              </div>
              <Button type="button" onClick={addBlock} size="icon" className="h-8 w-8 shrink-0 self-end">
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {dateError && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/5 border border-destructive/20 rounded-lg px-3 py-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              {dateError}
            </div>
          )}
        </div>
      )}

      <div className="space-y-2">
        {blocks.map((block) => {
          const blockLocIds = block.locationIds ?? [];
          const allSelected = locations.length > 0 && blockLocIds.length === 0;
          const isEditing = editingId === block.id;
          const hasBookings = bookedBlockIds.includes(block.id);

          return (
            <div key={block.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{block.date}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="time"
                        value={editForm.startTime}
                        onChange={(e) => { setEditError(""); setEditForm({ ...editForm, startTime: e.target.value }); }}
                        className="h-7 w-28 text-xs px-2"
                        data-testid={`edit-start-${block.id}`}
                      />
                      <span className="text-muted-foreground text-xs">–</span>
                      <Input
                        type="time"
                        value={editForm.endTime}
                        onChange={(e) => { setEditError(""); setEditForm({ ...editForm, endTime: e.target.value }); }}
                        className="h-7 w-28 text-xs px-2"
                        data-testid={`edit-end-${block.id}`}
                      />
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">{block.startTime} – {block.endTime}</span>
                  )}
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    {isEditing ? (
                      <>
                        <Button type="button" onClick={() => saveEdit(block.id)} size="icon" variant="ghost" className="h-7 w-7 text-green-600 hover:text-green-700 shrink-0" data-testid={`btn-save-block-${block.id}`}>
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" onClick={cancelEdit} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground shrink-0" data-testid={`btn-cancel-edit-${block.id}`}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button type="button" onClick={() => startEdit(block)} size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0" data-testid={`btn-edit-block-${block.id}`}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button type="button" onClick={() => removeBlock(block.id)} size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0" data-testid={`btn-delete-block-${block.id}`}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {isEditing && editError && (
                <div className="flex items-center gap-1.5 text-xs text-destructive">
                  <AlertCircle className="h-3 w-3 shrink-0" /> {editError}
                </div>
              )}

              {isEditing && hasBookings && (
                <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Some meetings are already scheduled in this block. Changes apply only to future availability.
                </div>
              )}

              {locations.length > 0 && (
                <div className="space-y-1">
                  <div className="flex items-center gap-1 text-[10px] uppercase text-muted-foreground">
                    <MapPin className="h-2.5 w-2.5" />
                    Available locations
                    {allSelected && <span className="ml-1 text-accent font-medium">(all — no restriction)</span>}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {locations.map((loc) => {
                      const active = blockLocIds.includes(loc.id);
                      return (
                        <button
                          key={loc.id}
                          type="button"
                          disabled={readOnly}
                          onClick={() => toggleLocation(block.id, loc.id)}
                          className={cn(
                            "px-2 py-0.5 rounded text-[11px] font-medium border transition-all",
                            active
                              ? "bg-accent text-accent-foreground border-accent"
                              : "bg-muted text-muted-foreground border-border/60 hover:border-accent/50",
                            readOnly && "cursor-default opacity-70"
                          )}
                        >
                          {loc.name}
                        </button>
                      );
                    })}
                  </div>
                  {blockLocIds.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic">No locations selected — all event locations will be shown.</p>
                  )}
                </div>
              )}

              {locations.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
                  <MapPin className="h-2.5 w-2.5" />
                  Define meeting locations above to restrict which locations are available in this block.
                </p>
              )}
            </div>
          );
        })}
        {blocks.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No scheduling blocks defined.</p>
        )}
      </div>
    </div>
  );
}
