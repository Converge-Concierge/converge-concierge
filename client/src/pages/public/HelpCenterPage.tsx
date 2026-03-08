import { Link } from "wouter";
import { Hexagon, HelpCircle, Mail, ArrowLeft, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-accent/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-primary/5 blur-[120px] pointer-events-none" />

      <header className="relative z-10 w-full max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-xl font-bold text-foreground tracking-tight hidden sm:block">
            Converge Concierge
          </span>
        </Link>
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            Back to Events
          </Button>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-start justify-center px-6 pt-16 pb-24">
        <div className="w-full max-w-2xl space-y-8">
          <div className="text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 border border-accent/20 mb-5">
              <HelpCircle className="h-7 w-7 text-accent" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground mb-3">Help Center</h1>
            <p className="text-muted-foreground leading-relaxed">
              Need help scheduling a meeting or have questions about your event registration?
            </p>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-8 space-y-6">
            <div>
              <h2 className="text-lg font-display font-semibold text-foreground mb-2">Scheduling a Meeting</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                To schedule a 1-on-1 meeting with a sponsor, navigate to your event page, select a sponsor, choose an available date and time, then enter your attendee details. Your meeting will be confirmed immediately.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-display font-semibold text-foreground mb-2">Online Meeting Requests</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Some sponsors offer virtual meetings. If available, you'll see a "Request Online Meeting" option on the sponsor card. The sponsor will reach out to confirm a time and send you a meeting link.
              </p>
            </div>

            <div>
              <h2 className="text-lg font-display font-semibold text-foreground mb-2">Questions or Issues?</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Questions about your event registration, sponsor meetings, or anything else? Please contact Converge Events for assistance and a team member will be happy to help.
              </p>
              <a
                href="https://convergeevents.com/contact/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:bg-accent/90 transition-colors"
                data-testid="link-support-contact"
              >
                <Mail className="h-4 w-4" />
                Contact Converge Events
              </a>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Link href="/" className="flex-1">
              <Button variant="outline" className="w-full gap-2" data-testid="btn-help-back-events">
                <ArrowLeft className="h-4 w-4" />
                Back to Events
              </Button>
            </Link>
            <Link href="/login" className="flex-1">
              <Button variant="ghost" className="w-full gap-2 text-muted-foreground" data-testid="btn-help-admin-login">
                <LogIn className="h-4 w-4" />
                Admin Login
              </Button>
            </Link>
          </div>
        </div>
      </main>

      <footer className="relative z-10 border-t border-border/50 bg-white/50 py-5 text-center">
        <p className="text-xs text-muted-foreground">&copy; 2026 Converge Events. All rights reserved.</p>
      </footer>
    </div>
  );
}
