import { useQuery } from "@tanstack/react-query";
import { Users, ExternalLink } from "lucide-react";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import { Badge } from "@/components/ui/badge";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";

interface Sponsor {
  id: string; name: string; category: string | null; logoUrl: string | null;
  overlapScore: number; topicIds: string[];
}

export default function AttendeeSponsorsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();

  const sponsorsQuery = useQuery<Sponsor[]>({
    queryKey: ["/api/attendee-portal/recommended-sponsors"],
    queryFn: () => fetch("/api/attendee-portal/recommended-sponsors", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  if (!token || meQuery.isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" /></div>;
  }

  const me = meQuery.data;
  const sponsors = sponsorsQuery.data ?? [];

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName}>
      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Users className="h-6 w-6 text-primary" /> Sponsors
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
        </div>

        {sponsorsQuery.isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        )}

        {!sponsorsQuery.isLoading && sponsors.length === 0 && (
          <div className="text-center py-20 bg-card border border-border/60 rounded-2xl">
            <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <p className="text-muted-foreground">Sponsor information will appear here soon.</p>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" data-testid="sponsors-grid">
          {sponsors.map((sponsor) => (
            <div key={sponsor.id} className="bg-card border border-border/60 rounded-xl p-5 flex items-start gap-4" data-testid={`card-sponsor-${sponsor.id}`}>
              {sponsor.logoUrl
                ? <img src={sponsor.logoUrl} alt={sponsor.name} className="h-12 w-12 rounded-lg object-contain shrink-0 border border-border/40 bg-white p-1" />
                : <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Users className="h-6 w-6 text-primary" /></div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-foreground text-sm" data-testid={`text-sponsor-name-${sponsor.id}`}>{sponsor.name}</p>
                {sponsor.category && (
                  <Badge variant="outline" className="mt-1 text-xs rounded-full">{sponsor.category}</Badge>
                )}
                {sponsor.overlapScore > 0 && (
                  <p className="text-xs text-primary mt-1.5 font-medium">{sponsor.overlapScore} topic{sponsor.overlapScore !== 1 ? "s" : ""} in common</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </AttendeeShell>
  );
}
