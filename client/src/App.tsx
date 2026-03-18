import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider, useQuery } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";
import { useEffect } from "react";
import type { AppBranding } from "@shared/schema";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import EventPage from "@/pages/public/EventPage";
import SponsorLoginPage from "@/pages/public/SponsorLoginPage";
import SponsorDashboardPage from "@/pages/public/SponsorDashboardPage";
import SponsorAutoLoginPage from "@/pages/public/SponsorAutoLoginPage";
import SponsorOnboardingPage from "@/pages/public/SponsorOnboardingPage";
import SponsorProfilePage from "@/pages/public/SponsorProfilePage";
import WelcomePage from "@/pages/public/WelcomePage";
import ResetPasswordPage from "@/pages/public/ResetPasswordPage";
import HelpCenterPage from "@/pages/public/HelpCenterPage";
import MeetingInvitationPage from "@/pages/public/MeetingInvitationPage";
import AttendeeAccessPage from "@/pages/public/AttendeeAccessPage";
import AttendeePortalPage from "@/pages/attendee/AttendeePortalPage";
import AttendeeAgendaPage from "@/pages/attendee/AttendeeAgendaPage";
import AttendeeMyAgendaPage from "@/pages/attendee/AttendeeMyAgendaPage";
import AttendeeSponsorsPage from "@/pages/attendee/AttendeeSponsorsPage";
import AttendeeMeetingsPage from "@/pages/attendee/AttendeeMeetingsPage";
import AttendeeInterestsPage from "@/pages/attendee/AttendeeInterestsPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import AdminResetPasswordPage from "@/pages/AdminResetPasswordPage";
import TermsPage from "@/pages/TermsPage";
import PrivacyPage from "@/pages/PrivacyPage";
import NotFound from "@/pages/not-found";

function FaviconUpdater() {
  const { data: branding } = useQuery<AppBranding>({
    queryKey: ["/api/branding-public"],
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    const logoUrl = branding?.appLogoUrl;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (logoUrl) {
      link.type = "image/png";
      link.href = `${logoUrl}?v=${Date.now()}`;
    } else {
      link.type = "image/svg+xml";
      link.href = "/favicon.svg";
    }
  }, [branding?.appLogoUrl]);

  return null;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/admin/forgot-password" component={ForgotPasswordPage} />
      <Route path="/admin/reset-password" component={AdminResetPasswordPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/help" component={HelpCenterPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/event/:slug/sponsor/:sponsorId" component={SponsorProfilePage} />
      <Route path="/event/:slug/welcome" component={WelcomePage} />
      <Route path="/event/:slug" component={EventPage} />
      <Route path="/sponsor/login" component={SponsorLoginPage} />
      <Route path="/sponsor/onboarding" component={SponsorOnboardingPage} />
      <Route path="/sponsor/dashboard" component={SponsorDashboardPage} />
      <Route path="/meeting-invitation/:token" component={MeetingInvitationPage} />
      <Route path="/sponsor-access/:token" component={SponsorAutoLoginPage} />
      <Route path="/attendee-access/:token" component={AttendeeAccessPage} />
      <Route path="/attendee/agenda" component={AttendeeAgendaPage} />
      <Route path="/attendee/my-agenda" component={AttendeeMyAgendaPage} />
      <Route path="/attendee/sponsors" component={AttendeeSponsorsPage} />
      <Route path="/attendee/meetings" component={AttendeeMeetingsPage} />
      <Route path="/attendee/interests" component={AttendeeInterestsPage} />
      <Route path="/attendee" component={AttendeePortalPage} />
      <Route path="/event/:slug/book/:rest*">
        {(params) => <Redirect to={`/event/${params.slug}`} />}
      </Route>
      <Route path="/admin/agreement/package-templates/:id" component={AdminLayout} />
      <Route path="/admin/agreement/sponsor-agreements/:sponsorId/:eventId" component={AdminLayout} />
      <Route path="/admin/agreement" component={AdminLayout} />
      <Route path="/admin" component={AdminLayout} />
      <Route path="/admin/:rest*" component={AdminLayout} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <FaviconUpdater />
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
