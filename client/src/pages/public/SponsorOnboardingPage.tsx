import { useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  Hexagon, CheckCircle2, Check, Upload, FileText, Users, Tag,
  ClipboardList, ArrowRight, Package, CalendarDays, LogOut, Info,
  Key, ExternalLink, FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";

interface DashboardData {
  sponsor: { id: string; name: string; level: string; logoUrl: string };
  event: { id: string; name: string; location: string; startDate: string; endDate: string; logoUrl?: string | null };
}

interface AppBranding {
  appName: string; appLogoUrl: string; sponsorDashboardLogoUrl: string;
}

interface SponsorDeliverable {
  id: string;
  category: string;
  deliverableName: string;
  quantity: number | null;
  quantityUnit: string | null;
  ownerType: string;
  sponsorEditable: boolean;
  fulfillmentType: string;
  status: string;
  registrationAccessCode: string | null;
  registrationInstructions: string | null;
  helpLink: string | null;
}

function detectType(d: SponsorDeliverable) {
  const n = d.deliverableName.toLowerCase();
  if (n.includes("company description")) return "company_description";
  if (n.includes("sponsor representative") || n.includes("sponsor rep")) return "sponsor_reps";
  if (n.includes("3 words") || n.includes("three words") || n.includes("what are") || n.includes("describe what you")) return "category_words";
  if (n.includes("registration")) return "registrations";
  if (n.includes("logo")) return "logo";
  return null;
}

const DONE_STATUSES = ["Delivered", "Approved", "Completed", "Submitted"];

const levelBadge: Record<string, string> = {
  Platinum: "bg-slate-800 text-white border-slate-700",
  Gold:     "bg-amber-100 text-amber-900 border-amber-300",
  Silver:   "bg-gray-100 text-gray-600 border-gray-300",
  Bronze:   "bg-orange-100 text-orange-700 border-orange-300",
};

const SETUP_STEPS = [
  { key: "logo",               icon: Upload,        label: "Upload Company Logo",        description: "Your logo will appear on the event website, printed materials, and digital assets." },
  { key: "company_description",icon: FileText,       label: "Add Company Description",    description: "A short overview of your company shown on your public sponsor profile." },
  { key: "sponsor_reps",       icon: Users,          label: "Add Sponsor Representatives", description: "Add the names of your team members attending the event." },
  { key: "category_words",     icon: Tag,            label: "Select Company Categories",   description: "Help attendees discover your company by selecting relevant categories." },
  { key: "registrations",      icon: ClipboardList,  label: "Register Your Team",          description: "Register your team members to receive event access and credentials." },
];

export default function SponsorOnboardingPage() {
  const [, nav] = useLocation();
  const token = localStorage.getItem("sponsor_token") ?? "";

  useEffect(() => {
    if (!token) nav("/sponsor/login");
  }, [token]);

  const { data: branding } = useQuery<AppBranding>({ queryKey: ["/api/branding-public"] });

  const { data, isLoading, isError } = useQuery<DashboardData>({
    queryKey: ["/api/sponsor-access", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-access/${token}`);
      if (!res.ok) throw new Error("Invalid token");
      return res.json();
    },
    enabled: !!token,
    retry: false,
  });

  const { data: deliverables = [] } = useQuery<SponsorDeliverable[]>({
    queryKey: ["/api/sponsor-dashboard/agreement-deliverables", token],
    queryFn: async () => {
      const res = await fetch(`/api/sponsor-dashboard/agreement-deliverables?token=${token}`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
  });

  function handleStartSetup() {
    localStorage.setItem(`onboarding_seen_${token}`, "1");
    localStorage.setItem("sponsor_initial_tab", "deliverables");
    nav("/sponsor/dashboard");
  }

  function handleSignOut() {
    localStorage.removeItem("sponsor_token");
    nav("/sponsor/login");
  }

  if (!token || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-muted-foreground">Session expired. Please sign in again.</p>
      </div>
    );
  }

  const { sponsor, event } = data;

  const stepStatusMap: Record<string, boolean> = {};
  deliverables.forEach((d) => {
    const t = detectType(d);
    if (t && d.sponsorEditable && DONE_STATUSES.includes(d.status)) stepStatusMap[t] = true;
  });

  const completedCount = SETUP_STEPS.filter((s) => stepStatusMap[s.key]).length;
  const allDone = completedCount === SETUP_STEPS.length;

  const registrationDeliverable = deliverables.find((d) => detectType(d) === "registrations");

  const packageItems = deliverables;

  const appName = branding?.appName || "Converge Concierge";
  const logoUrl = branding?.sponsorDashboardLogoUrl || branding?.appLogoUrl;

  const eventStartStr = event.startDate ? format(parseISO(event.startDate), "MMMM d, yyyy") : "";

  return (
    <div className="min-h-screen bg-background">
      <header className="w-full border-b border-border/50 bg-card/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <img src={logoUrl} alt={appName} className="h-8 w-auto object-contain" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <Hexagon className="h-4 w-4" />
              </div>
            )}
            <span className="font-semibold text-sm text-foreground">{appName}</span>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            data-testid="button-signout"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge
              className={cn("text-xs font-medium border", levelBadge[sponsor.level] ?? "bg-muted text-muted-foreground")}
              variant="outline"
              data-testid="badge-sponsor-level"
            >
              {sponsor.level} Sponsor
            </Badge>
            {eventStartStr && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" />
                {eventStartStr} · {event.location}
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground" data-testid="heading-welcome">
            Welcome to the {event.name} Sponsor Dashboard
          </h1>
          <p className="text-muted-foreground">
            Before we finalize your sponsorship materials, we need a few details from your team. Most sponsors complete this in under 10 minutes.
          </p>
        </div>

        <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border/50 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Sponsor Setup Checklist</h2>
              <p className="text-xs text-muted-foreground mt-0.5">You'll complete these items on the next page inside your Deliverables dashboard.</p>
            </div>
            <span className="text-xs text-muted-foreground shrink-0 ml-4" data-testid="text-setup-progress">
              {completedCount} of {SETUP_STEPS.length} complete
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {SETUP_STEPS.map((step) => {
              const done = !!stepStatusMap[step.key];
              const Icon = step.icon;
              return (
                <div
                  key={step.key}
                  className={cn("flex items-start gap-4 px-6 py-4", done && "bg-emerald-50/50 dark:bg-emerald-950/10")}
                  data-testid={`checklist-item-${step.key}`}
                >
                  <div className="mt-0.5 shrink-0">
                    {done ? (
                      <Check className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Check className="h-4 w-4 text-muted-foreground/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                      <p className={cn("text-sm font-medium", done ? "text-emerald-700 dark:text-emerald-400" : "text-foreground")}>{step.label}</p>
                      {done && (
                        <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 dark:bg-emerald-950/20 py-0">
                          Done
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
          {allDone && (
            <div className="px-6 py-3 bg-emerald-50 dark:bg-emerald-950/20 border-t border-emerald-200 dark:border-emerald-900/40 flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Your setup is complete! Head to the dashboard to review everything.</p>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/60 dark:bg-blue-950/10 px-6 py-4 flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-800 dark:text-blue-300">
            Some sponsorship items such as speaking sessions, exhibit tables, and marketing announcements are handled by the Converge Events team.
            You will see these in your dashboard, but <strong>no action is required from you</strong>.
          </p>
        </div>

        {packageItems.length > 0 && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Your Sponsorship Includes</h2>
            </div>
            <div className="px-6 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge
                  className={cn("text-xs font-medium border", levelBadge[sponsor.level] ?? "bg-muted text-muted-foreground")}
                  variant="outline"
                >
                  {sponsor.level} Sponsor
                </Badge>
              </div>
              <ul className="space-y-1.5" data-testid="list-package-items">
                {packageItems.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-sm text-foreground">
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0" />
                    <span>
                      {d.quantity != null && d.quantityUnit
                        ? `${d.quantity} ${d.quantityUnit}`
                        : d.quantity != null
                        ? `${d.quantity}×`
                        : ""}{" "}
                      {d.deliverableName}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {registrationDeliverable && (registrationDeliverable.registrationAccessCode || registrationDeliverable.registrationInstructions || registrationDeliverable.helpLink) && (
          <div className="rounded-2xl border border-border/60 bg-card shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-border/50 flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold text-foreground">Register Your Team</h2>
            </div>
            <div className="px-6 py-4 space-y-3">
              {registrationDeliverable.registrationAccessCode && (
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Key className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registration Access Code</p>
                    <p className="text-sm font-mono font-semibold text-foreground" data-testid="text-registration-code">
                      {registrationDeliverable.registrationAccessCode}
                    </p>
                  </div>
                </div>
              )}
              {registrationDeliverable.registrationInstructions && (
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <ExternalLink className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Registration Link</p>
                    <p className="text-sm text-foreground">{registrationDeliverable.registrationInstructions}</p>
                  </div>
                </div>
              )}
              {registrationDeliverable.helpLink && (
                <a
                  href={registrationDeliverable.helpLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  data-testid="link-registration-instructions"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  Download Registration Instructions
                </a>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col items-center gap-3 pt-2 pb-6">
          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={handleStartSetup}
            data-testid="button-start-setup"
          >
            Continue to Setup
            <ArrowRight className="h-4 w-4" />
          </Button>
          <p className="text-xs text-muted-foreground">You will be able to enter this information on the next page in your sponsor dashboard.</p>
        </div>
      </main>
    </div>
  );
}
