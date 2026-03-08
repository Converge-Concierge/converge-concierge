import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeetingTimeBlock, MeetingLocation } from "@shared/schema";
import { Plus, Trash2, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingBlocksEditorProps {
  blocks: MeetingTimeBlock[];
  onChange: (blocks: MeetingTimeBlock[]) => void;
  locations?: MeetingLocation[];
  readOnly?: boolean;
}

export function MeetingBlocksEditor({ blocks, onChange, locations = [], readOnly }: MeetingBlocksEditorProps) {
  const [newBlock, setNewBlock] = useState({ date: "", startTime: "09:00", endTime: "12:00" });

  const addBlock = () => {
    if (!newBlock.date || !newBlock.startTime || !newBlock.endTime || readOnly) return;
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
        <div className="grid grid-cols-3 gap-2 items-end bg-muted/30 p-3 rounded-lg border">
          <div className="space-y-1">
            <Label htmlFor="block-date" className="text-[10px] uppercase text-muted-foreground">Date</Label>
            <Input id="block-date" type="date" value={newBlock.date} onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })} className="h-8 text-xs" />
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
      )}

      <div className="space-y-2">
        {blocks.map((block) => {
          const blockLocIds = block.locationIds ?? [];
          const allSelected = locations.length > 0 && blockLocIds.length === 0;
          return (
            <div key={block.id} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{block.date}</span>
                  <span className="text-muted-foreground text-xs">{block.startTime} – {block.endTime}</span>
                </div>
                {!readOnly && (
                  <Button type="button" onClick={() => removeBlock(block.id)} size="icon" variant="ghost" className="h-7 w-7 text-destructive shrink-0">
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

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
