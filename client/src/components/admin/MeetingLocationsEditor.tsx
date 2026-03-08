import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MeetingLocation, SPONSORSHIP_LEVELS, SponsorshipLevel } from "@shared/schema";
import { Plus, X, Edit2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

const LEVEL_ACTIVE: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold: "bg-amber-100 text-amber-900 border-amber-200",
  Silver: "bg-gray-100 text-gray-600 border-gray-200",
  Bronze: "bg-orange-100 text-orange-700 border-orange-200",
};
const LEVEL_INACTIVE = "bg-muted text-muted-foreground border-border/60 hover:border-accent/50";

interface MeetingLocationsEditorProps {
  locations: MeetingLocation[];
  onChange: (locations: MeetingLocation[]) => void;
  readOnly?: boolean;
}

function LevelToggles({
  selected,
  onToggle,
  readOnly,
}: {
  selected: string[];
  onToggle: (level: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {SPONSORSHIP_LEVELS.map((level) => {
        const active = selected.includes(level);
        return (
          <button
            key={level}
            type="button"
            disabled={readOnly}
            onClick={() => onToggle(level)}
            className={cn(
              "px-2 py-0.5 rounded border text-[11px] font-medium transition-all",
              active ? LEVEL_ACTIVE[level] : LEVEL_INACTIVE,
              readOnly && "cursor-default opacity-70"
            )}
          >
            {level}
          </button>
        );
      })}
    </div>
  );
}

export function MeetingLocationsEditor({ locations, onChange, readOnly }: MeetingLocationsEditorProps) {
  const [newName, setNewName] = useState("");
  const [newLevels, setNewLevels] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingLevels, setEditingLevels] = useState<string[]>([]);

  const toggleNew = (level: string) =>
    setNewLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));

  const toggleEdit = (level: string) =>
    setEditingLevels((prev) => (prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]));

  const addLocation = () => {
    if (!newName.trim() || readOnly) return;
    const loc: MeetingLocation = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      allowedSponsorLevels: newLevels as SponsorshipLevel[],
    };
    onChange([...locations, loc]);
    setNewName("");
    setNewLevels([]);
  };

  const removeLocation = (id: string) => {
    if (readOnly) return;
    onChange(locations.filter((l) => l.id !== id));
  };

  const startEditing = (loc: MeetingLocation) => {
    if (readOnly) return;
    setEditingId(loc.id);
    setEditingName(loc.name);
    setEditingLevels(loc.allowedSponsorLevels ?? []);
  };

  const saveEdit = () => {
    if (!editingId || !editingName.trim() || readOnly) return;
    onChange(
      locations.map((loc) =>
        loc.id === editingId
          ? { ...loc, name: editingName.trim(), allowedSponsorLevels: editingLevels as SponsorshipLevel[] }
          : loc
      )
    );
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <Label className="text-base font-semibold">Meeting Locations</Label>

      {!readOnly && (
        <div className="space-y-2 bg-muted/30 rounded-lg border p-3">
          <div className="flex gap-2 items-end">
            <Input
              placeholder="e.g. Booth 402"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addLocation())}
              className="h-8 text-sm"
              data-testid="input-new-location-name"
            />
            <Button type="button" onClick={addLocation} size="sm" className="h-8 shrink-0" data-testid="button-add-location">
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>
          <div className="space-y-1">
            <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">
              Restrict to tiers — leave empty to allow all
            </p>
            <LevelToggles selected={newLevels} onToggle={toggleNew} />
          </div>
        </div>
      )}

      <div className="space-y-2">
        {locations.map((loc) => {
          const levels = loc.allowedSponsorLevels ?? [];
          const isEditing = editingId === loc.id;
          return (
            <div key={loc.id} className="rounded-md bg-muted/50 border group" data-testid={`location-row-${loc.id}`}>
              {isEditing ? (
                <div className="p-2 space-y-2">
                  <div className="flex gap-2 items-center">
                    <Input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="h-8 text-sm flex-1"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), saveEdit())}
                      data-testid="input-edit-location-name"
                    />
                    <Button
                      type="button"
                      onClick={saveEdit}
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-green-600 shrink-0"
                      data-testid="button-save-location"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase text-muted-foreground font-medium tracking-wide">
                      Restrict to tiers — leave empty to allow all
                    </p>
                    <LevelToggles selected={editingLevels} onToggle={toggleEdit} />
                  </div>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{loc.name}</span>
                    {!readOnly && (
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          type="button"
                          onClick={() => startEditing(loc)}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          data-testid={`button-edit-location-${loc.id}`}
                        >
                          <Edit2 className="h-3 w-3" />
                        </Button>
                        <Button
                          type="button"
                          onClick={() => removeLocation(loc.id)}
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-destructive"
                          data-testid={`button-delete-location-${loc.id}`}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {levels.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground italic">All sponsor tiers</p>
                  ) : (
                    <div className="flex items-center gap-1 flex-wrap">
                      {levels.map((level) => (
                        <span
                          key={level}
                          className={cn("px-1.5 py-0.5 rounded border text-[10px] font-medium", LEVEL_ACTIVE[level])}
                        >
                          {level}
                        </span>
                      ))}
                      <span className="text-[10px] text-muted-foreground italic ml-0.5">only</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {locations.length === 0 && (
          <p className="text-sm text-muted-foreground italic">No locations defined.</p>
        )}
      </div>
    </div>
  );
}
