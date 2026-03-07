import { Route, Switch } from "wouter";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { DashboardShell } from "./DashboardShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell } from "lucide-react";

export default function AdminLayout() {
  return (
    <SidebarProvider style={{ "--sidebar-width": "16rem" } as React.CSSProperties}>
      <div className="flex h-screen w-full bg-[#f8fafc]">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/40 bg-white/80 backdrop-blur-md px-6 sticky top-0 z-10">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="-ml-2 hover:bg-muted" />
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                className="relative p-2 rounded-full text-muted-foreground hover:bg-muted transition-colors"
                onClick={() => console.log("Notifications")}
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-accent border-2 border-white"></span>
              </button>
              
              <div className="h-8 w-[1px] bg-border/60 mx-1"></div>
              
              <div className="flex items-center gap-3 cursor-pointer group" onClick={() => console.log("Profile")}>
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-medium leading-none text-foreground group-hover:text-accent transition-colors">Admin User</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Event Manager</p>
                </div>
                <Avatar className="h-9 w-9 border border-border group-hover:border-accent transition-colors">
                  <AvatarFallback className="bg-primary text-primary-foreground font-display font-medium">AU</AvatarFallback>
                </Avatar>
              </div>
            </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            <Switch>
              <Route path="/admin" component={() => <DashboardShell title="Dashboard" description="Overview of your event metrics and recent activities." />} />
              <Route path="/admin/events" component={() => <DashboardShell title="Events" description="Manage upcoming and past conferences." />} />
              <Route path="/admin/sponsors" component={() => <DashboardShell title="Sponsors" description="Partner directory and sponsorship tiers." />} />
              <Route path="/admin/attendees" component={() => <DashboardShell title="Attendees" description="Registrations, VIPs, and ticketing." />} />
              <Route path="/admin/meetings" component={() => <DashboardShell title="Meetings" description="1-on-1 strategy sessions and networking." />} />
              <Route path="/admin/reports" component={() => <DashboardShell title="Reports" description="Analytics, revenue, and engagement data." />} />
              <Route path="/admin/branding" component={() => <DashboardShell title="Branding" description="Themes, assets, and event whitelabeling." />} />
              <Route path="/admin/settings" component={() => <DashboardShell title="Settings" description="System configuration and team access." />} />
            </Switch>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
