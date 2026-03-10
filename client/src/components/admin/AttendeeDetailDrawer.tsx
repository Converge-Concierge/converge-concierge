import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { AttendeeDetail } from "server/storage";
import { format } from "date-fns";
import { User, Calendar, Tag, FileText, Info, Pencil, Check, X } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface AttendeeDetailDrawerProps {
  attendeeId: string | null;
  open: boolean;
  onClose: () => void;
}

export function AttendeeDetailDrawer({ attendeeId, open, onClose }: AttendeeDetailDrawerProps) {
  const { toast } = useToast();
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState("");

  const { data: attendee, isLoading } = useQuery<AttendeeDetail>({
    queryKey: ["/api/attendees", attendeeId, "detail"],
    queryFn: async () => {
      const res = await fetch(`/api/attendees/${attendeeId}/detail`);
      if (!res.ok) throw new Error("Failed to fetch attendee details");
      return res.json();
    },
    enabled: !!attendeeId && open,
  });

  const saveNotesMutation = useMutation({
    mutationFn: (notes: string) =>
      apiRequest("PATCH", `/api/attendees/${attendeeId}`, { notes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/attendees", attendeeId, "detail"] });
      queryClient.invalidateQueries({ queryKey: ["/api/attendees"] });
      setEditingNotes(false);
      toast({ title: "Notes saved", description: "Internal notes updated successfully." });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to save notes.", variant: "destructive" });
    },
  });

  const meetingStats = attendee?.meetingsList.reduce(
    (acc, m) => {
      acc.total++;
      acc[m.status as keyof typeof acc] = (acc[m.status as keyof typeof acc] || 0) + 1;
      return acc;
    },
    { total: 0, Scheduled: 0, Completed: 0, Cancelled: 0, NoShow: 0, Pending: 0, Confirmed: 0, Declined: 0 }
  );

  function startEditNotes() {
    setNotesValue(attendee?.notes ?? "");
    setEditingNotes(true);
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="sm:max-w-[520px] p-0 flex flex-col h-full" data-testid="drawer-attendee-detail">
        <SheetHeader className="p-6 border-b">
          <SheetTitle className="text-2xl font-display flex items-center gap-2">
            <User className="h-5 w-5 text-accent" />
            {attendee ? attendee.name : "Attendee Details"}
          </SheetTitle>
          <SheetDescription>
            {attendee ? `${attendee.title} at ${attendee.company}` : "Loading attendee details..."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="p-12 flex flex-col items-center justify-center space-y-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
              <p className="text-sm text-muted-foreground">Loading attendee data...</p>
            </div>
          ) : attendee ? (
            <div className="p-6 space-y-8 pb-12">
              {/* Basic Profile Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Info className="h-4 w-4" />
                  Basic Profile
                </div>
                <div className="grid grid-cols-2 gap-y-4 gap-x-8 bg-muted/30 p-4 rounded-lg border border-border/50">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Email</p>
                    <p className="text-sm font-medium break-all" data-testid="text-attendee-email">{attendee.email}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Phone</p>
                    <p className="text-sm font-medium">{attendee.phone || "—"}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Event</p>
                    <p className="text-sm font-medium">
                      <Badge variant="outline" className="font-mono text-[10px]">{attendee.eventSlug}</Badge>
                      <span className="ml-2">{attendee.eventName}</span>
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="text-sm font-medium capitalize">{attendee.externalSource || "Manual"}</p>
                  </div>
                </div>
              </section>

              {/* Timestamps Section */}
              <section className="space-y-3">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Added: {format(new Date(attendee.createdAt), "MMM d, yyyy h:mm a")}</span>
                  <span className="mx-1">•</span>
                  <span>Updated: {format(new Date(attendee.updatedAt), "MMM d, yyyy h:mm a")}</span>
                </div>
              </section>

              <Separator />

              {/* Interests / Topics Section */}
              <section className="space-y-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                  <Tag className="h-4 w-4" />
                  Interests & Topics
                </div>
                <div className="flex flex-wrap gap-2">
                  {attendee.interests && attendee.interests.length > 0 ? (
                    attendee.interests.map((interest, i) => (
                      <Badge key={i} variant="secondary" className="px-2 py-0.5 rounded-full text-xs font-medium" data-testid={`badge-interest-${i}`}>
                        {interest}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm text-muted-foreground italic" data-testid="text-no-interests">No interests recorded yet.</p>
                  )}
                </div>
              </section>

              {/* Notes Section */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <FileText className="h-4 w-4" />
                    Internal Notes
                  </div>
                  {!editingNotes && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs gap-1"
                      onClick={startEditNotes}
                      data-testid="button-edit-notes"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                </div>

                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notesValue}
                      onChange={(e) => setNotesValue(e.target.value)}
                      placeholder="Add internal notes about this attendee..."
                      className="min-h-[100px] text-sm resize-none"
                      data-testid="input-notes"
                    />
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs gap-1"
                        onClick={() => saveNotesMutation.mutate(notesValue)}
                        disabled={saveNotesMutation.isPending}
                        data-testid="button-save-notes"
                      >
                        <Check className="h-3 w-3" />
                        {saveNotesMutation.isPending ? "Saving..." : "Save"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 text-xs gap-1"
                        onClick={() => setEditingNotes(false)}
                        disabled={saveNotesMutation.isPending}
                        data-testid="button-cancel-notes"
                      >
                        <X className="h-3 w-3" />
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div
                    className="text-sm bg-muted/30 p-4 rounded-lg border border-border/50 min-h-[60px] whitespace-pre-wrap cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={startEditNotes}
                    data-testid="display-notes"
                  >
                    {attendee.notes || <span className="text-muted-foreground italic">No internal notes yet. Click to add.</span>}
                  </div>
                )}
              </section>

              <Separator />

              {/* Meeting Activity Section */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    <Calendar className="h-4 w-4" />
                    Meeting Activity
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400">
                      {meetingStats?.Scheduled || 0} Scheduled
                    </Badge>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400">
                      {meetingStats?.Completed || 0} Done
                    </Badge>
                  </div>
                </div>

                <div className="rounded-md border border-border/60 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="text-xs h-8">Sponsor / Event</TableHead>
                        <TableHead className="text-xs h-8">Date/Time</TableHead>
                        <TableHead className="text-xs h-8">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendee.meetingsList && attendee.meetingsList.length > 0 ? (
                        attendee.meetingsList.map((m) => (
                          <TableRow key={m.id} className="hover:bg-transparent">
                            <TableCell className="py-2">
                              <div className="font-medium text-xs">{m.sponsorName}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{m.eventSlug}</div>
                            </TableCell>
                            <TableCell className="py-2">
                              <div className="text-xs">{format(new Date(m.date), "MMM d")}</div>
                              <div className="text-[10px] text-muted-foreground">{m.time}</div>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] px-1.5 py-0 h-5",
                                  m.status === "Scheduled" && "border-blue-200 text-blue-700 bg-blue-50",
                                  m.status === "Completed" && "border-green-200 text-green-700 bg-green-50",
                                  m.status === "Cancelled" && "border-red-200 text-red-700 bg-red-50",
                                  m.status === "Pending" && "border-amber-200 text-amber-700 bg-amber-50"
                                )}
                              >
                                {m.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic text-sm">
                            No meetings found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </section>
            </div>
          ) : null}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}
