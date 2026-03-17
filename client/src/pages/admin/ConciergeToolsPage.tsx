import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Search, RotateCcw, CheckCircle2, AlertCircle, Loader2, User,
  Calendar, Link2, Clock, Mail, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";
import { useQuery as useEventsQuery } from "@tanstack/react-query";
import type { Event } from "@shared/schema";

type PendingProfile = {
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

function fmtDate(ts: string | null | undefined) {
  if (!ts) return "—";
  return new Date(ts).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit", hour12: true,
  });
}

const STEP_LABELS: Record<string, string> = {
  topics: "Card 1 – Interests",
  email: "Card 2 – Your Matches",
  sessions: "Card 3 – Sessions",
  sponsors: "Card 4 – Sponsors",
  complete: "Card 5 – Complete",
};

function StatusBadge({ profile }: { profile: PendingProfile }) {
  if (profile.isCompleted) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200">
        <CheckCircle2 className="h-3 w-3" /> Completed
      </span>
    );
  }
  if (profile.matchedAttendeeId) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
        <Link2 className="h-3 w-3" /> Matched
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
      <Clock className="h-3 w-3" /> In Progress
    </span>
  );
}

export default function ConciergeToolsPage() {
  const { toast } = useToast();
  const [emailFilter, setEmailFilter] = useState("");
  const [eventFilter, setEventFilter] = useState("");
  const [searchParams, setSearchParams] = useState<{ email?: string; eventId?: string }>({});
  const [confirmReset, setConfirmReset] = useState<PendingProfile | null>(null);

  const { data: events = [] } = useEventsQuery<Event[]>({
    queryKey: ["/api/admin/events"],
  });

  const eventMap = new Map<string, string>(events.map((e) => [e.id, e.name]));

  const { data: profiles = [], isLoading, isFetching } = useQuery<PendingProfile[]>({
    queryKey: ["/api/admin/pending-concierge", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchParams.email) params.set("email", searchParams.email);
      if (searchParams.eventId) params.set("eventId", searchParams.eventId);
      const res = await fetch(`/api/admin/pending-concierge?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!(searchParams.email || searchParams.eventId),
  });

  const resetMutation = useMutation({
    mutationFn: async (profileId: string) => {
      await apiRequest("POST", `/api/admin/pending-concierge/${profileId}/reset`);
    },
    onSuccess: () => {
      toast({ title: "Reset successful", description: "Pending concierge profile reset to Card 1." });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pending-concierge"] });
      setConfirmReset(null);
    },
    onError: (err: any) => {
      toast({ title: "Reset failed", description: err.message ?? "Something went wrong.", variant: "destructive" });
    },
  });

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchParams({
      email: emailFilter.trim() || undefined,
      eventId: eventFilter || undefined,
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Concierge Tools</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search, inspect, and reset pending concierge onboarding records — including anonymous pre-matched profiles.
        </p>
      </div>

      {/* Search card */}
      <div className="bg-white border border-border/60 rounded-2xl shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Search className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Search Pending Concierge Profiles</h2>
        </div>
        <form onSubmit={handleSearch} className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <Label htmlFor="email-filter" className="text-xs font-medium">Attendee Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                id="email-filter"
                type="email"
                placeholder="dan@example.com"
                value={emailFilter}
                onChange={(e) => setEmailFilter(e.target.value)}
                className="pl-9 h-9 text-sm"
                data-testid="input-email-filter"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="event-filter" className="text-xs font-medium">Event</Label>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <select
                id="event-filter"
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-sm border border-input rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                data-testid="select-event-filter"
              >
                <option value="">All events</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              className="w-full h-9 text-sm gap-2"
              disabled={!emailFilter.trim() && !eventFilter}
              data-testid="button-search-pending"
            >
              {(isLoading || isFetching) ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…</>
              ) : (
                <><Search className="h-3.5 w-3.5" /> Search</>
              )}
            </Button>
          </div>
        </form>
        {!searchParams.email && !searchParams.eventId && (
          <p className="text-xs text-muted-foreground mt-3 flex items-center gap-1.5">
            <AlertCircle className="h-3.5 w-3.5" />
            Enter an email or select an event to search for pending concierge profiles.
          </p>
        )}
      </div>

      {/* Results */}
      {(searchParams.email || searchParams.eventId) && (
        <div className="bg-white border border-border/60 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/40 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">
              {isLoading ? "Searching…" : `${profiles.length} profile${profiles.length !== 1 ? "s" : ""} found`}
            </h2>
            {(searchParams.email || searchParams.eventId) && (
              <span className="text-xs text-muted-foreground">
                {searchParams.email && <span>Email: <strong>{searchParams.email}</strong></span>}
                {searchParams.email && searchParams.eventId && " · "}
                {searchParams.eventId && <span>Event: <strong>{eventMap.get(searchParams.eventId) ?? searchParams.eventId}</strong></span>}
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : profiles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-muted-foreground">
              <User className="h-10 w-10 opacity-20" />
              <p className="text-sm">No pending concierge profiles found.</p>
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {profiles.map((p) => (
                <div
                  key={p.id}
                  className="px-6 py-4 flex items-center gap-4 hover:bg-muted/30 transition-colors"
                  data-testid={`pending-profile-row-${p.id}`}
                >
                  <div className="flex-shrink-0 h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">
                        {p.email ?? <span className="text-muted-foreground italic">No email yet (anonymous)</span>}
                      </p>
                      <StatusBadge profile={p} />
                    </div>
                    <div className="flex flex-wrap gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {eventMap.get(p.eventId) ?? p.eventId}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {STEP_LABELS[p.onboardingStep] ?? p.onboardingStep}
                      </span>
                      {p.matchedAttendeeId && (
                        <span className="flex items-center gap-1 text-blue-600">
                          <Link2 className="h-3 w-3" />
                          Matched to attendee
                        </span>
                      )}
                      <span className="text-muted-foreground/60">
                        Created {fmtDate(p.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-xs h-8"
                      onClick={() => setConfirmReset(p)}
                      data-testid={`button-reset-profile-${p.id}`}
                    >
                      <RotateCcw className="h-3.5 w-3.5" /> Reset to Card 1
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* About section */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-blue-800 space-y-2">
        <p className="font-semibold flex items-center gap-2">
          <AlertCircle className="h-4 w-4" /> About Pending Concierge Profiles
        </p>
        <ul className="list-disc list-inside space-y-1 text-xs text-blue-700">
          <li>Pending profiles are created anonymously when an attendee starts the welcome wizard before logging in.</li>
          <li>Profiles are matched to registered attendees after the email step via the Eventzilla webhook.</li>
          <li><strong>Reset to Card 1</strong> clears the completion state so the attendee can restart from the Interests step.</li>
          <li>Resetting is event-specific — other event profiles for the same email are not affected.</li>
          <li>To also reset a <em>registered attendee's</em> concierge token, use the Reset button in the Attendee Detail drawer.</li>
        </ul>
      </div>

      {/* Confirmation dialog */}
      <Dialog open={!!confirmReset} onOpenChange={(o) => !o && setConfirmReset(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display">Reset Pending Concierge Profile?</DialogTitle>
            <DialogDescription>
              This will reset <strong>{confirmReset?.email ?? "this anonymous profile"}</strong>'s pending Concierge progress for{" "}
              <strong>{confirmReset ? (eventMap.get(confirmReset.eventId) ?? confirmReset.eventId) : ""}</strong>.
              They will be able to restart from Card 1 (Interests).
            </DialogDescription>
          </DialogHeader>
          <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-xs text-amber-800">
            <strong>Note:</strong> This resets the onboarding completion state only. Previously saved topic and session selections are not removed.
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirmReset(null)} data-testid="button-confirm-cancel">
              Cancel
            </Button>
            <Button
              onClick={() => confirmReset && resetMutation.mutate(confirmReset.id)}
              disabled={resetMutation.isPending}
              className="gap-2"
              data-testid="button-confirm-reset"
            >
              {resetMutation.isPending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Resetting…</>
              ) : (
                <><RotateCcw className="h-4 w-4" /> Reset to Card 1</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
