import { CalendarDays, MapPin, Clock, Users, Bookmark, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

export interface SessionSpeaker {
  id?: string; name: string; title?: string | null; company?: string | null;
  roleLabel?: string | null; speakerOrder?: number;
}

export interface AgendaSessionDetail {
  id: string; title: string; description?: string | null;
  sessionTypeKey?: string; sessionTypeLabel?: string;
  speakerLabelPlural?: string;
  sessionDate?: string | null; startTime?: string | null; endTime?: string | null;
  timezone?: string;
  locationName?: string | null; locationDetails?: string | null;
  sponsorId?: string | null; sponsorName?: string | null;
  isFeatured?: boolean;
  speakers?: SessionSpeaker[];
  topicIds?: string[];
}

interface Props {
  session: AgendaSessionDetail;
  isSaved: boolean;
  onClose: () => void;
  onSave: () => void;
  onUnsave: () => void;
  isSaving: boolean;
}

function formatDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
}

function formatTimeRange(s: string | null | undefined, e: string | null | undefined) {
  if (!s) return "";
  const fmt = (t: string) => { const [h, m] = t.split(":").map(Number); return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`; };
  return e ? `${fmt(s)} – ${fmt(e)}` : fmt(s);
}

export default function SessionDetailSheet({ session, isSaved, onClose, onSave, onUnsave, isSaving }: Props) {
  const speakers = session.speakers ?? [];
  const speakerLabel = session.speakerLabelPlural ?? "Speakers";
  const location = [session.locationName, session.locationDetails].filter(Boolean).join(" — ");

  function handleAddToCalendar() {
    window.open(`/api/agenda-sessions/${session.id}/ics`, "_blank");
  }

  return (
    <Sheet open onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <div className="flex flex-col h-full">
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-border/60">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {session.sessionTypeLabel && (
                  <Badge variant="outline" className="mb-2 text-xs rounded-full">{session.sessionTypeLabel}</Badge>
                )}
                <SheetTitle className="text-lg font-display font-bold leading-snug text-foreground">{session.title}</SheetTitle>
              </div>
              <button onClick={onClose} className="mt-0.5 p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0" data-testid="button-close-sheet">
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            {/* Meta */}
            <div className="space-y-2">
              {session.sessionDate && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
                  <span>{formatDate(session.sessionDate)}</span>
                </div>
              )}
              {session.startTime && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Clock className="h-4 w-4 shrink-0 text-primary" />
                  <span>{formatTimeRange(session.startTime, session.endTime)}</span>
                </div>
              )}
              {location && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4 shrink-0 text-primary" />
                  <span>{location}</span>
                </div>
              )}
              {session.sponsorName && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Users className="h-4 w-4 shrink-0 text-primary" />
                  <span>Sponsored by <span className="text-foreground font-medium">{session.sponsorName}</span></span>
                </div>
              )}
            </div>

            {/* Description */}
            {session.description && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-2">About this session</h3>
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{session.description}</p>
              </div>
            )}

            {/* Speakers */}
            {speakers.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">{speakerLabel}</h3>
                <div className="space-y-3">
                  {speakers.map((sp, i) => (
                    <div key={sp.id ?? i} className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary font-semibold text-xs">
                        {sp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-foreground">{sp.name}</p>
                        {(sp.title || sp.company) && (
                          <p className="text-xs text-muted-foreground">
                            {[sp.title, sp.company].filter(Boolean).join(", ")}
                          </p>
                        )}
                        {sp.roleLabel && <p className="text-xs text-muted-foreground/70 italic mt-0.5">{sp.roleLabel}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 border-t border-border/60 flex flex-col gap-2">
            <Button
              className="w-full gap-2"
              variant={isSaved ? "secondary" : "default"}
              disabled={isSaving}
              data-testid="button-sheet-save"
              onClick={isSaved ? onUnsave : onSave}
            >
              <Bookmark className={`h-4 w-4 ${isSaved ? "fill-current" : ""}`} />
              {isSaved ? "Remove from My Agenda" : "Save to My Agenda"}
            </Button>
            <Button variant="outline" className="w-full gap-2" onClick={handleAddToCalendar} data-testid="button-add-to-calendar">
              <Download className="h-4 w-4" /> Add to Calendar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
