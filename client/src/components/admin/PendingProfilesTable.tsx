import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, RotateCcw, CheckCircle2, Loader2, User, Calendar,
  Link2, Clock, Mail, Filter, AlertCircle, ChevronDown, Trash2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { Event } from "@shared/schema";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export type PendingProfile = {
  id: string;
  eventId: string;
  email: string | null;
  onboardingStep: string;
  isCompleted: boolean;
  matchedAttendeeId: string | null;
  source: string;
  createdAt: string;
  updatedAt: string;
};

const STEP_LABELS: Record<string, string> = {
  topics:   "1 – Interests",
  email:    "2 – Your Matches",
  sessions: "3 – Sessions",
  sponsors: "4 – Sponsors",
  complete: "5 – Complete",
};

function fmtDate(ts: string | null | undefined) {
  if (!ts) return "—";
  return format(new Date(ts), "MMM d, yyyy");
}

function StepBadge({ step }: { step: string }) {
  const colors: Record<string, string> = {
    topics:   "bg-slate-100 text-slate-600",
    email:    "bg-blue-50 text-blue-700",
    sessions: "bg-indigo-50 text-indigo-700",
    sponsors: "bg-purple-50 text-purple-700",
    complete: "bg-green-50 text-green-700",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full", colors[step] ?? "bg-muted text-muted-foreground")}>
      {STEP_LABELS[step] ?? step}
    </span>
  );
}

interface Props {
  events: Event[];
}

export function PendingProfilesTable({ events }: Props) {
  const { toast } = useToast();
  const [emailFilter, setEmailFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("all");
  const [matchedFilter, setMatchedFilter] = useState("all");
  const [completedFilter, setCompletedFilter] = useState("all");
  const [confirmReset, setConfirmReset] = useState<PendingProfile | null>(null);

  const eventMap = new Map<string, Event>(events.map((e) => [e.id, e]));

  const { data: profiles = [], isLoading, refetch } = useQuery<PendingProfile[]>({
    queryKey: ["/api/admin/pending-concierge", eventFilter, emailFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (eventFilter && eventFilter !== "all") params.set("eventId", eventFilter);
      const res = await fetch(`/api/admin/pending-concierge?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch pending profiles");
      return res.json();
    },
    staleTime: 30_000,
  });

  const resetMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiRequest("POST", `/api/admin/pending-concierge/${profileId}/reset`);
    },
    onSuccess: () => {
      toast({ title: "Reset successful", description: "Profile reset to Card 1 (Interests)." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-concierge"] });
      setConfirmReset(null);
    },
    onError: () => toast({ title: "Reset failed", variant: "destructive" }),
  });

  // Client-side filtering
  const filtered = profiles.filter((p) => {
    if (emailFilter && !p.email?.toLowerCase().includes(emailFilter.toLowerCase())) return false;
    if (matchedFilter === "matched" && !p.matchedAttendeeId) return false;
    if (matchedFilter === "unmatched" && p.matchedAttendeeId) return false;
    if (completedFilter === "completed" && !p.isCompleted) return false;
    if (completedFilter === "incomplete" && p.isCompleted) return false;
    return true;
  });

  return (
    <>
      {/* Filters row */}
      <div className="flex flex-col sm:flex-row gap-3 p-4 bg-card rounded-xl border border-border/50 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by email…"
            value={emailFilter}
            onChange={(e) => setEmailFilter(e.target.value)}
            className="pl-9 bg-muted/50 border-transparent focus-visible:ring-accent/20"
            data-testid="input-pending-email-filter"
          />
        </div>
        <Select value={eventFilter} onValueChange={setEventFilter}>
          <SelectTrigger className="w-full sm:w-44" data-testid="select-pending-event-filter">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue placeholder="All events" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Events</SelectItem>
            {events.map((e) => (
              <SelectItem key={e.id} value={e.id}>{e.slug ?? e.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={matchedFilter} onValueChange={setMatchedFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-pending-matched-filter">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Matched &amp; Unmatched</SelectItem>
            <SelectItem value="matched">Matched only</SelectItem>
            <SelectItem value="unmatched">Unmatched only</SelectItem>
          </SelectContent>
        </Select>
        <Select value={completedFilter} onValueChange={setCompletedFilter}>
          <SelectTrigger className="w-full sm:w-40" data-testid="select-pending-completed-filter">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="incomplete">Incomplete</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh" data-testid="button-pending-refresh">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>

      {/* Count + info */}
      <div className="flex items-center justify-between px-1">
        <p className="text-xs text-muted-foreground">
          {isLoading ? "Loading…" : `${filtered.length} pending profile${filtered.length !== 1 ? "s" : ""}`}
          {profiles.length !== filtered.length ? ` (${profiles.length} total, filtered)` : ""}
        </p>
        <p className="text-xs text-muted-foreground hidden sm:block">
          Showing up to 200 most recent. Use event filter to narrow results.
        </p>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border/60 bg-card overflow-x-auto shadow-sm">
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[200px]">Email</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Step</TableHead>
              <TableHead className="text-center">Completed</TableHead>
              <TableHead className="text-center">Matched</TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Updated</TableHead>
              <TableHead className="text-right w-[130px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                  <User className="h-8 w-8 opacity-20 mx-auto mb-2" />
                  No pending concierge profiles found.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => {
                const event = eventMap.get(p.eventId);
                return (
                  <TableRow key={p.id} data-testid={`row-pending-${p.id}`} className="hover:bg-muted/30">
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
                        {p.email ? (
                          <span className="text-sm font-medium text-foreground truncate max-w-[160px]">{p.email}</span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No email yet</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {event ? (
                        <Badge variant="outline" className="text-xs font-mono">{event.slug ?? event.name}</Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">Unknown</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <StepBadge step={p.onboardingStep} />
                    </TableCell>
                    <TableCell className="text-center">
                      {p.isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600 mx-auto" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-500 mx-auto" />
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {p.matchedAttendeeId ? (
                        <Link2 className="h-4 w-4 text-blue-600 mx-auto" title="Matched to attendee" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(p.createdAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(p.updatedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Reset progress to Card 1"
                          onClick={() => setConfirmReset(p)}
                          data-testid={`button-reset-pending-${p.id}`}
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info callout */}
      <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 text-xs text-blue-700 space-y-1">
        <p className="font-semibold flex items-center gap-1.5"><AlertCircle className="h-3.5 w-3.5" /> About Pending Profiles</p>
        <ul className="list-disc list-inside space-y-0.5 text-blue-600">
          <li>Created anonymously when someone starts the welcome wizard before logging in.</li>
          <li>Matched to registered attendees when their email is entered and confirmed via webhook.</li>
          <li><strong>Reset</strong> clears the completion state so the attendee can restart from Interests.</li>
        </ul>
      </div>

      {/* Confirm reset dialog */}
      <Dialog open={!!confirmReset} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Reset Pending Profile?</DialogTitle>
            <DialogDescription>
              Reset <strong>{confirmReset?.email ?? "this anonymous profile"}</strong> for{" "}
              <strong>{confirmReset ? (eventMap.get(confirmReset.eventId)?.slug ?? confirmReset.eventId) : ""}</strong>{" "}
              back to Card 1 (Interests). They'll be able to restart the welcome flow.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(null)}>Cancel</Button>
            <Button
              onClick={() => confirmReset && resetMutation.mutate(confirmReset.id)}
              disabled={resetMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-reset-pending"
            >
              {resetMutation.isPending ? <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</> : <><RotateCcw className="h-4 w-4" /> Reset to Card 1</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
