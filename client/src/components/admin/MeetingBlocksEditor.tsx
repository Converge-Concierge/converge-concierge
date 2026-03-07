import { useState } from "react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { MeetingTimeBlock } from "@shared/schema";
  import { Plus, Trash2, Calendar as CalendarIcon } from "lucide-react";

  interface MeetingBlocksEditorProps {
    blocks: MeetingTimeBlock[];
    onChange: (blocks: MeetingTimeBlock[]) => void;
  }

  export function MeetingBlocksEditor({ blocks, onChange }: MeetingBlocksEditorProps) {
    const [newBlock, setNewBlock] = useState({
      date: "",
      startTime: "09:00",
      endTime: "12:00"
    });

    const addBlock = () => {
      if (!newBlock.date || !newBlock.startTime || !newBlock.endTime) return;
      
      const block: MeetingTimeBlock = {
        id: crypto.randomUUID(),
        ...newBlock
      };
      
      onChange([...blocks, block].sort((a, b) => {
        const dateCompare = a.date.localeCompare(b.date);
        if (dateCompare !== 0) return dateCompare;
        return a.startTime.localeCompare(b.startTime);
      }));

      setNewBlock({
        date: "",
        startTime: "09:00",
        endTime: "12:00"
      });
    };

    const removeBlock = (id: string) => {
      onChange(blocks.filter(b => b.id !== id));
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Meeting Time Blocks</Label>
        </div>

        <div className="grid grid-cols-3 gap-2 items-end bg-muted/30 p-3 rounded-lg border">
          <div className="space-y-1">
            <Label htmlFor="block-date" className="text-[10px] uppercase text-muted-foreground">Date</Label>
            <Input 
              id="block-date"
              type="date" 
              value={newBlock.date} 
              onChange={(e) => setNewBlock({ ...newBlock, date: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="block-start" className="text-[10px] uppercase text-muted-foreground">Start Time</Label>
            <Input 
              id="block-start"
              type="time" 
              value={newBlock.startTime} 
              onChange={(e) => setNewBlock({ ...newBlock, startTime: e.target.value })}
              className="h-8 text-xs"
            />
          </div>
          <div className="space-y-1 flex gap-2">
            <div className="flex-1 space-y-1">
              <Label htmlFor="block-end" className="text-[10px] uppercase text-muted-foreground">End Time</Label>
              <Input 
                id="block-end"
                type="time" 
                value={newBlock.endTime} 
                onChange={(e) => setNewBlock({ ...newBlock, endTime: e.target.value })}
                className="h-8 text-xs"
              />
            </div>
            <Button type="button" onClick={addBlock} size="icon" className="h-8 w-8 shrink-0">
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {blocks.map((block) => (
            <div key={block.id} className="flex items-center justify-between p-2 rounded-md border bg-card text-sm">
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                <div className="flex flex-col">
                  <span className="font-medium">{block.date}</span>
                  <span className="text-[10px] text-muted-foreground">{block.startTime} - {block.endTime}</span>
                </div>
              </div>
              <Button type="button" onClick={() => removeBlock(block.id)} size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
          {blocks.length === 0 && (
            <p className="text-sm text-muted-foreground italic col-span-full">No scheduling blocks defined.</p>
          )}
        </div>
      </div>
    );
  }