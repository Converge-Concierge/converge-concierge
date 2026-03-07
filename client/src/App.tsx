import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/use-auth";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import AdminLayout from "@/pages/admin/AdminLayout";
import EventPage from "@/pages/public/EventPage";
import SponsorDashboardPage from "@/pages/public/SponsorDashboardPage";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/login" component={LoginPage} />
      <Route path="/event/:slug" component={EventPage} />
      <Route path="/sponsor-access/:token" component={SponsorDashboardPage} />
      {/* old deep-link from previous flow — redirect back to event page */}
      <Route path="/event/:slug/book/:rest*">
        {(params) => <Redirect to={`/event/${params.slug}`} />}
      </Route>
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
          <Toaster />
          <Router />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
