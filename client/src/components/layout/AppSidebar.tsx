import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Users,
  Handshake,
  BarChart3,
  Settings,
  Hexagon,
  LogOut,
  UserCog,
  ArrowLeftRight,
  Mail,
  Inbox,
  ClipboardList,
  LayoutGrid,
  Package,
  Tags,
  HeartPulse,
  BookOpen,
  Sparkles,
  Wrench,
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

const managementItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Events", url: "/admin/events", icon: CalendarDays },
  { title: "Sponsors", url: "/admin/sponsors", icon: Building2 },
  { title: "Attendees", url: "/admin/attendees", icon: Users },
  { title: "Meetings", url: "/admin/meetings", icon: Handshake },
  { title: "Agenda", url: "/admin/agenda", icon: BookOpen },
  { title: "Interest Topics", url: "/admin/interest-topics", icon: Sparkles },
  { title: "Info Requests", url: "/admin/information-requests", icon: Mail },
  { title: "Concierge Tools", url: "/admin/concierge-tools", icon: Wrench },
];

const sponsorMgmtItems = [
  { title: "Deliverables", url: "/admin/agreement", icon: ClipboardList },
  { title: "Sponsor Dashboards", url: "/admin/sponsor-dashboards", icon: LayoutGrid },
  { title: "Sponsor Health", url: "/admin/sponsor-health", icon: HeartPulse },
];

const reportingItems = [
  { title: "Email Center", url: "/admin/email-center", icon: Inbox },
  { title: "Reports", url: "/admin/reports", icon: BarChart3 },
  { title: "Data Management", url: "/admin/data-management", icon: ArrowLeftRight },
];

const configItems = [
  { title: "Category Rules", url: "/admin/category-rules", icon: Tags },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

interface AppSidebarProps {
  isAdmin?: boolean;
}

function NavItem({ item, isActive }: { item: { title: string; url: string; icon: React.ElementType }; isActive: boolean }) {
  return (
    <SidebarMenuItem>
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
}

export function AppSidebar({ isAdmin }: AppSidebarProps) {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [, nav] = useWouterLocation();

  async function handleLogout() {
    await logout();
    nav("/login");
  }

  function isActive(url: string) {
    if (url === "/admin") return location === url;
    return location === url || location.startsWith(url + "/");
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
        {/* ── Management ── */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {managementItems.map((item) => (
                <NavItem key={item.title} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Sponsor Management ── */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Sponsor Management
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {sponsorMgmtItems.map((item) => (
                <NavItem key={item.title} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Reporting ── */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Reporting
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {reportingItems.map((item) => (
                <NavItem key={item.title} item={item} isActive={isActive(item.url)} />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* ── Configuration ── */}
        <SidebarGroup className="mt-4">
          <SidebarGroupLabel className="text-sidebar-foreground/70 text-xs font-semibold uppercase tracking-wider">
            Configuration
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {configItems.map((item) => (
                <NavItem key={item.title} item={item} isActive={isActive(item.url)} />
              ))}

              {isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location === "/admin/users" || location === "/admin/access-control"}
                    className="transition-all duration-200"
                  >
                    <Link href="/admin/users">
                      <UserCog className="h-4 w-4" />
                      <span>Users</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive("/admin/sponsorship-templates") || (isActive("/admin/agreement") && location.includes("package-templates"))}
                  className="transition-all duration-200"
                >
                  <Link href="/admin/sponsorship-templates">
                    <Package className="h-4 w-4" />
                    <span>Sponsorship Packages</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
