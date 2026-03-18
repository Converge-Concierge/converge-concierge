import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { categoryLabel, categoryBadgeClass } from "@/lib/categoryUtils";
import { useToast } from "@/hooks/use-toast";
import { Users, Search, Send, Filter, Building2, Briefcase, Star } from "lucide-react";

interface DiscoveryAttendee {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  attendeeCategory: string | null;
  interests: string[];
  matchScore: number;
  matchReasons: string[];
  invited: boolean;
}

interface DiscoveryData {
  matchmakingEnabled: boolean;
  attendees: DiscoveryAttendee[];
  categoryCounts: { practitioner: number; governmentNonprofit: number; solutionProvider: number };
  invitationsUsed: number;
  invitationLimit: number;
}


export default function AttendeeDiscoveryTab({ token, eventAccent }: { token: string; eventAccent: string }) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [inviteModal, setInviteModal] = useState<DiscoveryAttendee | null>(null);
  const [inviteMessage, setInviteMessage] = useState("");

  const { data, isLoading } = useQuery<DiscoveryData>({
    queryKey: ["/api/sponsor-dashboard/discovery/attendees", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/discovery/attendees?token=${encodeURIComponent(token)}`, { credentials: "include" });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    enabled: !!token,
  });

  const sendInvitation = useMutation({
    mutationFn: async ({ attendeeId, message }: { attendeeId: string; message: string }) => {
      const res = await fetch(`/api/sponsor-dashboard/invitations?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attendeeId, message }),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({ message: "Failed to send invitation" }));
        throw new Error(errData.message);
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Invitation sent", description: "The attendee will receive an email invitation." });
      queryClient.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/discovery/attendees"] });
      queryClient.invalidateQueries({ queryKey: ["/api/sponsor-dashboard/invitations"] });
      setInviteModal(null);
      setInviteMessage("");
    },
    onError: (err: any) => {
      toast({ title: "Error", description: err.message || "Failed to send invitation", variant: "destructive" });
    },
  });

  // All hooks must be declared before any conditional returns
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    (data?.attendees ?? []).forEach(a => { if (a.attendeeCategory) cats.add(a.attendeeCategory); });
    return Array.from(cats).sort();
  }, [data?.attendees]);

  const remaining = (data?.invitationLimit ?? 0) - (data?.invitationsUsed ?? 0);

  const filtered = useMemo(() => {
    let list = data?.attendees ?? [];
    if (categoryFilter !== "all") list = list.filter(a => a.attendeeCategory === categoryFilter);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter(a =>
        a.name.toLowerCase().includes(term) ||
        a.company.toLowerCase().includes(term) ||
        a.title.toLowerCase().includes(term) ||
        a.interests.some(i => i.toLowerCase().includes(term))
      );
    }
    return list;
  }, [data?.attendees, categoryFilter, searchTerm]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!data?.matchmakingEnabled) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Users className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Attendee Discovery Not Available</h3>
          <p className="text-muted-foreground">Attendee discovery has not been enabled for this event yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold" style={{ color: eventAccent }} data-testid="count-practitioners">{data.categoryCounts.practitioner}</div>
            <div className="text-xs text-muted-foreground">Practitioners</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold" style={{ color: eventAccent }} data-testid="count-gov">{data.categoryCounts.governmentNonprofit}</div>
            <div className="text-xs text-muted-foreground">Gov / Non-Profit</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold" style={{ color: eventAccent }} data-testid="count-solution">{data.categoryCounts.solutionProvider}</div>
            <div className="text-xs text-muted-foreground">Solution Providers</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-4 text-center">
            <div className="text-2xl font-bold" style={{ color: remaining > 0 ? eventAccent : "#ef4444" }} data-testid="count-remaining">{remaining}</div>
            <div className="text-xs text-muted-foreground">Invitations Remaining</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, company, title, or interest..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
            data-testid="input-search-attendees"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-[200px]" data-testid="select-category-filter">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {uniqueCategories.map(cat => (
              <SelectItem key={cat} value={cat}>{categoryLabel(cat)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="text-sm text-muted-foreground">
        Showing {filtered.length} attendee{filtered.length !== 1 ? "s" : ""}
        {data.invitationsUsed > 0 && ` · ${data.invitationsUsed} of ${data.invitationLimit} invitations used`}
      </div>

      <div className="grid gap-3">
        {filtered.map((attendee) => (
          <Card key={attendee.id} className="hover:shadow-md transition-shadow" data-testid={`card-attendee-${attendee.id}`}>
            <CardContent className="py-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h4 className="font-semibold text-sm" data-testid={`text-name-${attendee.id}`}>{attendee.name}</h4>
                    <Badge variant="outline" className={`text-[10px] ${categoryBadgeClass(attendee.attendeeCategory)}`}>
                      {categoryLabel(attendee.attendeeCategory)}
                    </Badge>
                    {attendee.matchScore >= 100 && (
                      <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200">
                        <Star className="h-3 w-3 mr-0.5" />Top Match
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{attendee.title}</span>
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{attendee.company}</span>
                  </div>
                  {attendee.interests.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {attendee.interests.slice(0, 5).map((interest, idx) => (
                        <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0">{interest}</Badge>
                      ))}
                    </div>
                  )}
                  {attendee.matchReasons.length > 0 && (
                    <p className="text-[11px] text-muted-foreground mt-1.5 italic">
                      {attendee.matchReasons.join(" · ")}
                    </p>
                  )}
                </div>
                <div className="flex-shrink-0">
                  {attendee.invited ? (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700">Invited</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={remaining <= 0}
                      onClick={() => { setInviteModal(attendee); setInviteMessage(""); }}
                      data-testid={`button-invite-${attendee.id}`}
                      style={remaining > 0 ? { borderColor: eventAccent, color: eventAccent } : {}}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />Invite
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No attendees found matching your criteria.
          </div>
        )}
      </div>

      <Dialog open={!!inviteModal} onOpenChange={(open) => { if (!open) setInviteModal(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Meeting Invitation</DialogTitle>
            <DialogDescription>
              Invite {inviteModal?.name} from {inviteModal?.company} to schedule a meeting.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="font-medium text-sm">{inviteModal?.name}</p>
              <p className="text-xs text-muted-foreground">{inviteModal?.title} at {inviteModal?.company}</p>
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Message (optional)</label>
              <Textarea
                placeholder="Add a personal note about why you'd like to meet..."
                value={inviteMessage}
                onChange={(e) => setInviteMessage(e.target.value)}
                rows={3}
                data-testid="textarea-invite-message"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {remaining} invitation{remaining !== 1 ? "s" : ""} remaining
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteModal(null)} data-testid="button-cancel-invite">Cancel</Button>
            <Button
              onClick={() => inviteModal && sendInvitation.mutate({ attendeeId: inviteModal.id, message: inviteMessage })}
              disabled={sendInvitation.isPending}
              style={{ backgroundColor: eventAccent }}
              data-testid="button-send-invite"
            >
              {sendInvitation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
