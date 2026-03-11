import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Handshake,
  BarChart3,
  Palette,
  Settings,
  Hexagon,
  LogOut,
  UserCog,
  ArrowLeftRight,
  ShieldCheck,
  Mail,
  Inbox,
  ClipboardList,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/use-auth";
import { useLocation as useWouterLocation } from "wouter";

const mainItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Events", url: "/admin/events", icon: CalendarDays },
  { title: "Sponsors", url: "/admin/sponsors", icon: Building2 },
  { title: "Attendees", url: "/admin/attendees", icon: Users },
  { title: "Meetings", url: "/admin/meetings", icon: Handshake },
  { title: "Info Requests", url: "/admin/information-requests", icon: Mail },
  { title: "Agreement Deliverables", url: "/admin/agreement", icon: ClipboardList },
  { title: "Email Center", url: "/admin/email-center", icon: Inbox },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Data Exchange", url: "/admin/data-exchange", icon: ArrowLeftRight },
];

const configItems = [
  { title: "Branding", url: "/admin/branding", icon: Palette },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

interface AppSidebarProps {
  isAdmin?: boolean;
}

export function AppSidebar({ isAdmin }: AppSidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [, nav] = useWouterLocation();

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  return (
    <Sidebar className="border-r border-sidebar-border bg-sidebar">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-3 px-2 py-1 transition-opacity hover:opacity-80">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground shadow-sm">
            <Hexagon className="h-5 w-5" />
          </div>
          <span className="font-display text-lg font-bold tracking-tight text-sidebar-foreground">
            Concierge
          </span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => {
                const isActive = item.url === "/admin"
                  ? location === item.url
                  : location === item.url || location.startsWith(item.url + "/");
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="transition-all duration-200"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Configuration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      className="transition-all duration-200"
                    >
                      <Link href={item.url}>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/users"}
                    className="transition-all duration-200"
                  >
                    <Link href="/admin/users">
                      <UserCog className="h-4 w-4" />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/access-control"}
                    className="transition-all duration-200"
                  >
                    <Link href="/admin/access-control">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Access Control</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="hover:bg-destructive/10 hover:text-destructive cursor-pointer"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              <span>Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
