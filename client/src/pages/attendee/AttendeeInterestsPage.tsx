import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tag, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import AttendeeShell from "@/components/attendee/AttendeeShell";
import { useAttendeeAuth } from "@/hooks/use-attendee-auth";
import { useToast } from "@/hooks/use-toast";

interface Topic { id: string; topicLabel: string; topicKey: string }
interface TopicSelection { topicId: string }

export default function AttendeeInterestsPage() {
  const { token, headers, meQuery, logout } = useAttendeeAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [initialized, setInitialized] = useState(false);

  const topicsQuery = useQuery<Topic[]>({
    queryKey: ["/api/attendee-portal/topics"],
    queryFn: () => fetch("/api/attendee-portal/topics", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  const selectionsQuery = useQuery<TopicSelection[]>({
    queryKey: ["/api/attendee-portal/topic-selections"],
    queryFn: () => fetch("/api/attendee-portal/topic-selections", { headers }).then((r) => r.json()),
    enabled: !!token,
  });

  useEffect(() => {
    if (!initialized && selectionsQuery.data) {
      setSelected(new Set(selectionsQuery.data.map((s) => s.topicId)));
      setInitialized(true);
    }
  }, [selectionsQuery.data, initialized]);

  const saveTopicsMutation = useMutation({
    mutationFn: (topicIds: string[]) =>
      fetch("/api/attendee-portal/topic-selections", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ topicIds }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/topic-selections"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sessions"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/recommended-sponsors"] });
      qc.invalidateQueries({ queryKey: ["/api/attendee-portal/suggested-meetings"] });
      toast({ title: "Interests saved", description: "Your recommendations have been updated." });
    },
  });

  const toggle = (id: string) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

  const topics = topicsQuery.data ?? [];
  const topicMap = new Map(topics.map((t: Topic) => [t.id, t]));
  const selectedList = [...selected].map((id) => topicMap.get(id)).filter(Boolean) as Topic[];
  const me = meQuery.data;

  if (!token || meQuery.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <AttendeeShell onLogout={logout} attendeeName={me?.attendee.firstName} accentColor={me?.event.buttonColor || me?.event.accentColor || null}>
      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        <div className="mb-2">
          <h1 className="text-2xl font-display font-bold text-foreground tracking-tight flex items-center gap-2">
            <Tag className="h-6 w-6 text-primary" /> Your Interests
          </h1>
          {me && <p className="text-sm text-muted-foreground mt-1">{me.event.name}</p>}
          <p className="text-sm text-muted-foreground mt-2">
            Select the topics most relevant to you. Your session and sponsor recommendations update immediately when you save.
          </p>
        </div>

        <div className="bg-card border border-border/60 rounded-2xl p-6">
          {topicsQuery.isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : topics.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No topics have been configured for this event yet.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2.5" data-testid="interests-topics-list">
              {topics.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggle(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-all ${
                    selected.has(t.id)
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background border-border text-foreground hover:border-primary/50 hover:bg-primary/5"
                  }`}
                  data-testid={`button-interest-${t.id}`}
                >
                  {t.topicLabel}
                </button>
              ))}
            </div>
          )}

          {selectedList.length > 0 && (
            <div className="mt-5 pt-5 border-t border-border/50">
              <p className="text-xs font-medium text-muted-foreground mb-2.5 flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                {selectedList.length} topic{selectedList.length !== 1 ? "s" : ""} selected
              </p>
              <div className="flex flex-wrap gap-1.5" data-testid="interests-selected-list">
                {selectedList.map((t) => (
                  <Badge key={t.id} variant="secondary" className="rounded-full text-xs" data-testid={`badge-interest-${t.id}`}>
                    {t.topicLabel}
                  </Badge>
                ))}
              </div>
            </div>
          )}
        </div>

        <Button
          className="w-full gap-2"
          size="lg"
          onClick={() => saveTopicsMutation.mutate([...selected])}
          disabled={saveTopicsMutation.isPending}
          data-testid="button-save-interests"
        >
          {saveTopicsMutation.isPending ? "Saving…" : "Save My Interests"}
          {!saveTopicsMutation.isPending && <CheckCircle2 className="h-4 w-4" />}
        </Button>
      </div>
    </AttendeeShell>
  );
}
