import { Route, Switch, useLocation, Redirect } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, ShieldX } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import DashboardPage from "./DashboardPage";
import EventsPage from "./EventsPage";
import SponsorsPage from "./SponsorsPage";
import AttendeesPage from "./AttendeesPage";
import MeetingsPage from "./MeetingsPage";
import ReportsPage from "./ReportsPage";
import UsersPage from "./UsersPage";
import SettingsPage from "./SettingsPage";
import InformationRequestsPage from "./InformationRequestsPage";
import EmailCenterPage from "./EmailCenterPage";
import AgreementDeliverablesPage from "./AgreementDeliverablesPage";
import PackageTemplateEditorPage from "./PackageTemplateEditorPage";
import SponsorAgreementDetailPage from "./SponsorAgreementDetailPage";
import SponsorDashboardsAdminPage from "./SponsorDashboardsAdminPage";
import SponsorshipTemplatesPage from "./SponsorshipTemplatesPage";
import DataManagementPage from "./DataManagementPage";
import CategoryRulesPage from "./CategoryRulesPage";
import SponsorHealthPage from "./SponsorHealthPage";
import AgendaPage from "./AgendaPage";
import InterestTopicsPage from "./InterestTopicsPage";
import ConciergeToolsPage from "./ConciergeToolsPage";
import DemoBanner from "@/components/DemoBanner";

function AccessDenied() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground py-24">
      <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
        <ShieldX className="h-10 w-10 text-destructive/60" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-display font-bold text-foreground mb-1">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-xs">
          You don't have permission to access this page. Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
}

export default function AdminLayout() {
  const { user, isLoading, isAdmin } = useAuth();
  const [location] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-accent" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  const initials = user.name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <div className="flex h-screen w-full bg-[#f8fafc]">
        <AppSidebar isAdmin={isAdmin} />
        <div className="flex flex-col flex-1 min-w-0">
          <DemoBanner />
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-white/80 backdrop-blur-md px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-2 hover:bg-muted" />
            </div>

            <div className="flex items-center gap-4">
              <button
                className="relative p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => {}}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent border-2 border-white" />
              </button>

              <div className="h-8 w-[1px] bg-border/60 mx-1" />

              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-none text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 capitalize">{user.role}</p>
                </div>
                <Avatar className="h-9 w-9 border border-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-medium text-sm">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <Switch>
              <Route path="/admin" component={DashboardPage} />
              <Route path="/admin/events" component={EventsPage} />
              <Route path="/admin/sponsors" component={SponsorsPage} />
              <Route path="/admin/attendees" component={AttendeesPage} />
              <Route path="/admin/meetings" component={MeetingsPage} />
              <Route path="/admin/reports" component={ReportsPage} />
              <Route path="/admin/users" component={() => isAdmin ? <UsersPage /> : <AccessDenied />} />
              <Route path="/admin/branding"><Redirect to="/admin/settings" /></Route>
              <Route path="/admin/category-rules" component={CategoryRulesPage} />
              <Route path="/admin/settings" component={SettingsPage} />
              <Route path="/admin/information-requests" component={InformationRequestsPage} />
              <Route path="/admin/email-center" component={EmailCenterPage} />
              <Route path="/admin/data-management" component={DataManagementPage} />
              <Route path="/admin/data-exchange"><Redirect to="/admin/data-management" /></Route>
              <Route path="/admin/access-control"><Redirect to="/admin/users?tab=access-control" /></Route>
              <Route path="/admin/sponsor-dashboards" component={SponsorDashboardsAdminPage} />
              <Route path="/admin/sponsorship-templates" component={SponsorshipTemplatesPage} />
              <Route path="/admin/agreement/package-templates/:id" component={PackageTemplateEditorPage} />
              <Route path="/admin/agreement/sponsor-agreements/:sponsorId/:eventId" component={SponsorAgreementDetailPage} />
              <Route path="/admin/agreement" component={AgreementDeliverablesPage} />
              <Route path="/admin/agreement/:rest*" component={AgreementDeliverablesPage} />
              <Route path="/admin/agenda" component={AgendaPage} />
              <Route path="/admin/interest-topics" component={InterestTopicsPage} />
              <Route path="/admin/concierge-tools" component={ConciergeToolsPage} />
              <Route path="/admin/sponsor-health" component={SponsorHealthPage} />
              <Route path="/admin/data-backup">{() => { window.location.href = "/admin/data-management"; return null; }}</Route>
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
