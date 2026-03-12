import { useState, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { InformationRequest, InformationRequestStatus, INFORMATION_REQUEST_STATUSES, Event, Sponsor } from "@shared/schema";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Inbox, Eye, Check, X, MailCheck, MessageSquare, Filter } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<InformationRequestStatus, string> = {
  New: "bg-blue-100 text-blue-800 border-blue-200",
  Contacted: "bg-amber-100 text-amber-800 border-amber-200",
  Closed: "bg-gray-100 text-gray-600 border-gray-200",
};

export default function InformationRequestsPage() {
  const { toast } = useToast();
  const [eventFilter, setEventFilter] = useState("all");
  const [sponsorFilter, setSponsorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<InformationRequest | null>(null);
  const hasAutoSelected = useRef(false);

  const { data: requests = [], isLoading } = useQuery<InformationRequest[]>({
    queryKey: ["/api/admin/information-requests"],
  });

  const { data: events = [] } = useQuery<Event[]>({ queryKey: ["/api/events"] });
  const { data: sponsors = [] } = useQuery<Sponsor[]>({ queryKey: ["/api/sponsors"] });

  useEffect(() => {
    if (hasAutoSelected.current || events.length === 0) return;
    hasAutoSelected.current = true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const upcoming = events
      .filter(e => (e.archiveState ?? "active") === "active" && e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    if (upcoming.length > 0) setEventFilter(upcoming[0].id);
  }, [events]);

  const sortedEventsForSelector = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = events.filter(e => (e.archiveState ?? "active") === "active");
    const upcoming = active.filter(e => e.endDate && new Date(e.endDate) >= today)
      .sort((a, b) => new Date(a.startDate ?? 0).getTime() - new Date(b.startDate ?? 0).getTime());
    const completed = active.filter(e => !e.endDate || new Date(e.endDate) < today)
      .sort((a, b) => new Date(b.endDate ?? 0).getTime() - new Date(a.endDate ?? 0).getTime());
    return [...upcoming, ...completed];
  }, [events]);

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: InformationRequestStatus }) =>
      apiRequest("PATCH", `/api/admin/information-requests/${id}/status`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/information-requests"] });
      if (selectedRequest) {
        setSelectedRequest(null);
      }
    },
    onError: () => toast({ title: "Failed to update status", variant: "destructive" }),
  });

  const filtered = requests.filter((r) => {
    if (eventFilter !== "all" && r.eventId !== eventFilter) return false;
    if (sponsorFilter !== "all" && r.sponsorId !== sponsorFilter) return false;
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    return true;
  });

  const getSponsorName = (id: string) => sponsors.find((s) => s.id === id)?.name ?? id;
  const getEventName = (id: string | null) => id ? (events.find((e) => e.id === id)?.name ?? "—") : "—";

  function updateStatus(id: string, status: InformationRequestStatus, req?: InformationRequest) {
    statusMutation.mutate({ id, status });
    if (req) setSelectedRequest({ ...req, status });
  }

  const counts = {
    total: requests.length,
    new: requests.filter((r) => r.status === "New").length,
    contacted: requests.filter((r) => r.status === "Contacted").length,
    closed: requests.filter((r) => r.status === "Closed").length,
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Information Requests</h1>
        <p className="text-muted-foreground mt-1">Attendee inquiries submitted to sponsors</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total", count: counts.total, color: "text-foreground" },
          { label: "New", count: counts.new, color: "text-blue-600" },
          { label: "Contacted", count: counts.contacted, color: "text-amber-600" },
          { label: "Closed", count: counts.closed, color: "text-gray-500" },
        ].map((m) => (
          <Card key={m.label} className="border-border/60">
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{m.label}</p>
              <p className={cn("text-2xl font-display font-bold", m.color)} data-testid={`count-inforeq-${m.label.toLowerCase()}`}>{m.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Event tabs */}
      {sortedEventsForSelector.length > 0 && (
        <div className="overflow-x-auto pb-1">
          <div className="flex items-center gap-2 min-w-max p-1 bg-muted/50 border border-border/40 rounded-xl w-fit">
            {sortedEventsForSelector.map((event) => {
              const isActive = eventFilter === event.id;
              return (
                <button
                  key={event.id}
                  data-testid={`event-tab-${event.id}`}
                  onClick={() => setEventFilter(event.id)}
                  className={cn(
                    "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                    isActive ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                  )}
                  style={isActive ? { backgroundColor: event.accentColor ?? "#0D9488", color: "#ffffff" } : undefined}
                >
                  {event.slug ?? event.name}
                </button>
              );
            })}
            <button
              data-testid="event-tab-all"
              onClick={() => setEventFilter("all")}
              className={cn(
                "shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
                eventFilter === "all" ? "shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              style={eventFilter === "all" ? { backgroundColor: "#0D9488", color: "#ffffff" } : undefined}
            >
              All Events
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={sponsorFilter} onValueChange={setSponsorFilter}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-sponsor">
            <SelectValue placeholder="All Sponsors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sponsors</SelectItem>
            {sponsors.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36 h-8 text-sm" data-testid="select-filter-status">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {INFORMATION_REQUEST_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
          </SelectContent>
        </Select>
        {(eventFilter !== "all" || sponsorFilter !== "all" || statusFilter !== "all") && (
          <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => { setEventFilter("all"); setSponsorFilter("all"); setStatusFilter("all"); }}>
            Clear filters
          </Button>
        )}
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} request{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      {/* Table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mr-3" />
              Loading requests...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <Inbox className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-medium text-foreground">No information requests</p>
                <p className="text-sm text-muted-foreground">Requests will appear here once attendees submit them.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Attendee</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((req) => (
                  <TableRow key={req.id} data-testid={`row-inforeq-${req.id}`}>
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{req.attendeeFirstName} {req.attendeeLastName}</p>
                        <p className="text-xs text-muted-foreground">{req.attendeeEmail}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{req.attendeeCompany}</TableCell>
                    <TableCell className="text-sm font-medium">{getSponsorName(req.sponsorId)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getEventName(req.eventId)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-xs border", STATUS_COLORS[req.status as InformationRequestStatus])}>
                        {req.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(req.createdAt), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs gap-1"
                          onClick={() => setSelectedRequest(req)}
                          data-testid={`button-view-inforeq-${req.id}`}
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </Button>
                        {req.status === "New" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                            onClick={() => updateStatus(req.id, "Contacted")}
                            disabled={statusMutation.isPending}
                            data-testid={`button-contacted-inforeq-${req.id}`}
                          >
                            <MailCheck className="h-3.5 w-3.5" /> Contacted
                          </Button>
                        )}
                        {req.status !== "Closed" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 text-xs gap-1 text-gray-500 hover:text-gray-700 hover:bg-gray-50"
                            onClick={() => updateStatus(req.id, "Closed")}
                            disabled={statusMutation.isPending}
                            data-testid={`button-close-inforeq-${req.id}`}
                          >
                            <X className="h-3.5 w-3.5" /> Close
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail sheet */}
      <Sheet open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          {selectedRequest && (
            <>
              <SheetHeader className="mb-4">
                <SheetTitle className="font-display">Request Details</SheetTitle>
                <SheetDescription>
                  Submitted {format(new Date(selectedRequest.createdAt), "MMMM d, yyyy 'at' h:mm a")}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant="outline" className={cn("text-xs border", STATUS_COLORS[selectedRequest.status as InformationRequestStatus])}>
                    {selectedRequest.status}
                  </Badge>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Attendee</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Name</span>
                    <span className="font-medium">{selectedRequest.attendeeFirstName} {selectedRequest.attendeeLastName}</span>
                    <span className="text-muted-foreground">Email</span>
                    <span>{selectedRequest.attendeeEmail}</span>
                    <span className="text-muted-foreground">Company</span>
                    <span>{selectedRequest.attendeeCompany}</span>
                    <span className="text-muted-foreground">Title</span>
                    <span>{selectedRequest.attendeeTitle}</span>
                    <span className="text-muted-foreground">Consent</span>
                    <span className={selectedRequest.consentToShareContact ? "text-green-600 font-medium" : "text-destructive"}>
                      {selectedRequest.consentToShareContact ? "Given" : "Not given"}
                    </span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Request</h3>
                  <div className="grid grid-cols-2 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Sponsor</span>
                    <span className="font-medium">{getSponsorName(selectedRequest.sponsorId)}</span>
                    <span className="text-muted-foreground">Event</span>
                    <span>{getEventName(selectedRequest.eventId)}</span>
                    <span className="text-muted-foreground">Source</span>
                    <span>{selectedRequest.source}</span>
                    <span className="text-muted-foreground">Updated</span>
                    <span>{format(new Date(selectedRequest.updatedAt), "MMM d, yyyy")}</span>
                  </div>
                  {selectedRequest.message && (
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5 flex items-center gap-1">
                        <MessageSquare className="h-3 w-3" /> Message
                      </p>
                      <div className="rounded-lg bg-muted/50 border border-border/60 p-3 text-sm text-foreground whitespace-pre-wrap">
                        {selectedRequest.message}
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Update Status</h3>
                  <div className="flex gap-2 flex-wrap">
                    {INFORMATION_REQUEST_STATUSES.map((s) => (
                      <Button
                        key={s}
                        size="sm"
                        variant={selectedRequest.status === s ? "default" : "outline"}
                        className="text-xs"
                        disabled={selectedRequest.status === s || statusMutation.isPending}
                        onClick={() => updateStatus(selectedRequest.id, s, selectedRequest)}
                        data-testid={`button-status-${s.toLowerCase()}`}
                      >
                        {s}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
