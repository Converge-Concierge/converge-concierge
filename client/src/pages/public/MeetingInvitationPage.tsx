import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams } from "wouter";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, MapPin, Clock, CheckCircle2, XCircle, Building2 } from "lucide-react";

interface InvitationData {
  id: string;
  status: string;
  message: string | null;
  sponsorName: string;
  sponsorDescription: string;
  sponsorSolutions: string;
  eventName: string;
  eventLocation: string;
  eventStartDate: string;
  eventEndDate: string;
  attendeeName: string;
  meetingBlocks: { id: string; date: string; startTime: string; endTime: string }[];
  meetingLocations: { id: string; name: string }[];
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function generateTimeSlots(startTime: string, endTime: string): string[] {
  const slots: string[] = [];
  const [startH, startM] = startTime.split(":").map(Number);
  const [endH, endM] = endTime.split(":").map(Number);
  let h = startH, m = startM;
  while (h < endH || (h === endH && m < endM)) {
    slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    m += 30;
    if (m >= 60) { m = 0; h++; }
  }
  return slots;
}

export default function MeetingInvitationPage() {
  const { token } = useParams<{ token: string }>();
  const [selectedBlock, setSelectedBlock] = useState<string>("");
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [selectedLocation, setSelectedLocation] = useState<string>("");
  const [accepted, setAccepted] = useState(false);
  const [declined, setDeclined] = useState(false);

  const { data, isLoading, error } = useQuery<InvitationData>({
    queryKey: ["/api/meeting-invitation", token],
    queryFn: async () => {
      const res = await fetch(`/api/meeting-invitation/${token}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message || "Invitation not found");
      }
      return res.json();
    },
    enabled: !!token,
  });

  const acceptMutation = useMutation({
    mutationFn: async () => {
      const block = data?.meetingBlocks.find(b => b.id === selectedBlock);
      const loc = data?.meetingLocations.find(l => l.id === selectedLocation);
      const res = await apiRequest("POST", `/api/meeting-invitation/${token}/accept`, {
        date: block?.date,
        time: selectedTime,
        location: loc?.name || "TBD",
      });
      return res.json();
    },
    onSuccess: () => setAccepted(true),
  });

  const declineMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/meeting-invitation/${token}/decline`);
      return res.json();
    },
    onSuccess: () => setDeclined(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto h-12 w-12 text-red-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Not Available</h2>
            <p className="text-muted-foreground">{(error as Error).message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) return null;

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-500 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Meeting Confirmed!</h2>
            <p className="text-muted-foreground mb-4">
              Your meeting with <strong>{data.sponsorName}</strong> at <strong>{data.eventName}</strong> has been scheduled.
            </p>
            <p className="text-sm text-muted-foreground">You'll receive a confirmation email shortly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (declined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <XCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invitation Declined</h2>
            <p className="text-muted-foreground">
              You have declined the meeting invitation from {data.sponsorName}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (data.status !== "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-md w-full">
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Invitation Already Responded</h2>
            <p className="text-muted-foreground">
              This invitation has already been {data.status}.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedBlockData = data.meetingBlocks.find(b => b.id === selectedBlock);
  const timeSlots = selectedBlockData ? generateTimeSlots(selectedBlockData.startTime, selectedBlockData.endTime) : [];

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <div className="max-w-lg mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-900" data-testid="text-invitation-title">Meeting Invitation</h1>
          <p className="text-muted-foreground mt-1" data-testid="text-event-name">{data.eventName}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Building2 className="h-5 w-5" />
              {data.sponsorName}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data.sponsorDescription && (
              <p className="text-sm text-muted-foreground">{data.sponsorDescription}</p>
            )}
            {data.message && (
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Personal message:</p>
                <p className="text-sm italic">"{data.message}"</p>
              </div>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />{formatDate(data.eventStartDate)} – {formatDate(data.eventEndDate)}</span>
              <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{data.eventLocation}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Choose a Meeting Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Meeting Day</label>
              <Select value={selectedBlock} onValueChange={(v) => { setSelectedBlock(v); setSelectedTime(""); }}>
                <SelectTrigger data-testid="select-meeting-day">
                  <SelectValue placeholder="Select a day" />
                </SelectTrigger>
                <SelectContent>
                  {data.meetingBlocks.map(block => (
                    <SelectItem key={block.id} value={block.id}>
                      {formatDate(block.date)} ({block.startTime} – {block.endTime})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedBlock && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Time Slot</label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger data-testid="select-meeting-time">
                    <SelectValue placeholder="Select a time" />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map(slot => (
                      <SelectItem key={slot} value={slot}>
                        <Clock className="h-3 w-3 mr-1 inline" />{slot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {data.meetingLocations.length > 0 && selectedTime && (
              <div>
                <label className="text-sm font-medium mb-1.5 block">Location</label>
                <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger data-testid="select-meeting-location">
                    <SelectValue placeholder="Select a location" />
                  </SelectTrigger>
                  <SelectContent>
                    {data.meetingLocations.map(loc => (
                      <SelectItem key={loc.id} value={loc.id}>{loc.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => declineMutation.mutate()}
            disabled={declineMutation.isPending}
            data-testid="button-decline-invitation"
          >
            {declineMutation.isPending ? "Declining..." : "Decline"}
          </Button>
          <Button
            className="flex-1"
            style={{ backgroundColor: "#0D9488" }}
            disabled={!selectedBlock || !selectedTime || acceptMutation.isPending}
            onClick={() => acceptMutation.mutate()}
            data-testid="button-accept-invitation"
          >
            {acceptMutation.isPending ? "Scheduling..." : "Accept & Schedule"}
          </Button>
        </div>

        {(acceptMutation.error || declineMutation.error) && (
          <p className="text-sm text-red-500 text-center">
            {(acceptMutation.error as Error)?.message || (declineMutation.error as Error)?.message}
          </p>
        )}
      </div>
    </div>
  );
}
