import { useEffect, useState } from "react";
import { useParams, useLocation } from "wouter";
import { Hexagon, ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AttendeeAccessPage() {
  const { token } = useParams<{ token: string }>();
  const [, nav] = useLocation();
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("No token provided."); return; }
    const search = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(search);
    const source = params.get("source");
    fetch(`/api/attendee-access/${token}`)
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setError(body.message || "This link is invalid or has been revoked.");
          return;
        }
        localStorage.setItem("attendee_token", token);
        nav(source === "email" ? "/attendee?source=email" : "/attendee");
      })
      .catch(() => setError("Network error. Please try again."));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <header className="w-full max-w-7xl mx-auto px-6 h-20 flex items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <Hexagon className="h-5 w-5" />
            </div>
            <span className="font-display text-xl font-bold text-foreground tracking-tight">Converge Concierge</span>
          </div>
        </header>
        <main className="flex-1 flex items-center justify-center px-6">
          <div className="bg-card rounded-2xl border border-border/60 shadow-xl p-10 max-w-sm w-full text-center">
            <div className="flex justify-center mb-5">
              <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldX className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <h1 className="text-xl font-display font-bold text-foreground mb-2">Access Denied</h1>
            <p className="text-sm text-muted-foreground mb-6" data-testid="text-error-message">{error}</p>
            <Button variant="outline" data-testid="button-go-home" onClick={() => nav("/")}>Go to Home</Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
    </div>
  );
}
