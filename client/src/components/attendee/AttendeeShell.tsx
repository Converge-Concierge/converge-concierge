import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { Hexagon, LayoutDashboard, CalendarDays, Bookmark, Building2, Calendar, Tag, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onLogout: () => void;
  attendeeName?: string;
  accentColor?: string | null;
}

const navItems = [
  { label: "Home", href: "/attendee", icon: LayoutDashboard },
  { label: "Interests", href: "/attendee/interests", icon: Tag },
  { label: "Agenda", href: "/attendee/agenda", icon: CalendarDays },
  { label: "My Agenda", href: "/attendee/my-agenda", icon: Bookmark },
  { label: "Sponsors", href: "/attendee/sponsors", icon: Building2 },
  { label: "Meetings", href: "/attendee/meetings", icon: Calendar },
];

export default function AttendeeShell({ children, onLogout, attendeeName, accentColor }: Props) {
  const [location] = useLocation();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top header */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-7 w-7 items-center justify-center rounded-lg shadow-md text-white"
              style={accentColor ? { backgroundColor: accentColor, boxShadow: `0 4px 6px -1px ${accentColor}33` } : undefined}
            >
              <Hexagon className="h-4 w-4" />
            </div>
            <span className="font-display text-base font-bold text-foreground tracking-tight">Converge Concierge</span>
          </div>
          <div className="flex items-center gap-2">
            {attendeeName && (
              <span className="hidden sm:block text-xs text-muted-foreground">{attendeeName}</span>
            )}
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground h-8 px-2" data-testid="button-logout" onClick={onLogout}>
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-xs">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Tab nav */}
      <nav className="sticky top-14 z-10 bg-background border-b border-border/60">
        <div className="max-w-4xl mx-auto px-4">
          <div className="flex items-center gap-0 overflow-x-auto scrollbar-none">
            {navItems.map(({ label, href, icon: Icon }) => {
              const active = href === "/attendee"
                ? location === href
                : location.startsWith(href);
              const activeStyle = accentColor && active
                ? { borderColor: accentColor, color: accentColor }
                : undefined;
              return (
                <Link key={href} href={href}>
                  <button
                    data-testid={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}
                    style={activeStyle}
                    className={[
                      "flex items-center gap-1.5 px-4 py-3 text-sm border-b-2 transition-colors whitespace-nowrap",
                      active
                        ? accentColor
                          ? "border-b-2 font-semibold"
                          : "border-primary text-primary font-semibold"
                        : "border-transparent text-muted-foreground font-medium hover:text-foreground hover:border-border/60",
                    ].join(" ")}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" style={active && accentColor ? { color: accentColor } : undefined} />
                    {label}
                  </button>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Page content */}
      <main className="flex-1">{children}</main>
    </div>
  );
}
