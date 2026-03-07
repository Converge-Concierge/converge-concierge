import { useState } from "react";
  import { Button } from "@/components/ui/button";
  import { Input } from "@/components/ui/input";
  import { Label } from "@/components/ui/label";
  import { MeetingLocation } from "@shared/schema";
  import { Plus, X, Edit2, Check } from "lucide-react";

  interface MeetingLocationEditorProps {
    locations: MeetingLocation[];
    onChange: (locations: MeetingLocation[]) => void;
  }

  export function MeetingLocationEditor({ locations, onChange }: MeetingLocationEditorProps) {
    const [newLocationName, setNewLocationName] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingName, setEditingName] = useState("");

    const addLocation = () => {
      if (!newLocationName.trim()) return;
      const newLocation: MeetingLocation = {
        id: crypto.randomUUID(),
        name: newLocationName.trim() as any
      };
      onChange([...locations, newLocation]);
      setNewLocationName("");
    };

    const removeLocation = (id: string) => {
      onChange(locations.filter(loc => loc.id !== id));
    };

    const startEditing = (loc: MeetingLocation) => {
      setEditingId(loc.id);
      setEditingName(loc.name);
    };

    const saveEdit = () => {
      if (!editingId || !editingName.trim()) return;
      onChange(locations.map(loc => loc.id === editingId ? { ...loc, name: editingName.trim() as any } : loc));
      setEditingId(null);
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-base font-semibold">Meeting Locations</Label>
        </div>
        
        <div className="flex gap-2">
          <Input 
            placeholder="e.g. Booth 402" 
            value={newLocationName} 
            onChange={(e) => setNewLocationName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addLocation())}
          />
          <Button type="button" onClick={addLocation} size="sm">
            <Plus className="h-4 w-4 mr-1" /> Add
          </Button>
        </div>

        <div className="space-y-2">
          {locations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 border group">
              {editingId === loc.id ? (
                <div className="flex flex-1 gap-2">
                  <Input 
                    value={editingName} 
                    onChange={(e) => setEditingName(e.target.value)} 
                    className="h-8"
                    autoFocus
                  />
                  <Button type="button" onClick={saveEdit} size="icon" variant="ghost" className="h-8 w-8 text-green-600">
                    <Check className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-medium">{loc.name}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button type="button" onClick={() => startEditing(loc)} size="icon" variant="ghost" className="h-7 w-7">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button type="button" onClick={() => removeLocation(loc.id)} size="icon" variant="ghost" className="h-7 w-7 text-destructive">
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                </>
              )}
            </div>
          ))}
          {locations.length === 0 && (
            <p className="text-sm text-muted-foreground italic">No locations defined yet.</p>
          )}
        </div>
      </div>
    );
  }