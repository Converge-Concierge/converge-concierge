import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { HeartPulse, AlertTriangle, CheckCircle2, XCircle, Search, Filter } from "lucide-react";
import { cn } from "@/lib/utils";

interface SponsorHealth {
  sponsorId: string;
  sponsorName: string;
  level: string | null;
  assignedEvents: number;
  totalMeetings: number;
  completedMeetings: number;
  totalInfoRequests: number;
  hasLogo: boolean;
  hasDescription: boolean;
  riskLevel: "healthy" | "attention" | "at_risk";
  issues: string[];
}

interface HealthResponse {
  sponsors: SponsorHealth[];
  summary: { total: number; healthy: number; attention: number; atRisk: number };
}

const RISK_CONFIG = {
  healthy: { label: "Healthy", className: "bg-green-100 text-green-700 border-green-200", icon: CheckCircle2, cardBg: "bg-green-50 border-green-200" },
  attention: { label: "Needs Attention", className: "bg-amber-100 text-amber-700 border-amber-200", icon: AlertTriangle, cardBg: "bg-amber-50 border-amber-200" },
  at_risk: { label: "At Risk", className: "bg-red-100 text-red-700 border-red-200", icon: XCircle, cardBg: "bg-red-50 border-red-200" },
};

export default function SponsorHealthPage() {
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");

  const { data, isLoading } = useQuery<HealthResponse>({
    queryKey: ["/api/admin/sponsor-health"],
  });

  const sponsors = data?.sponsors ?? [];
  const summary = data?.summary ?? { total: 0, healthy: 0, attention: 0, atRisk: 0 };

  const filtered = sponsors.filter((s) => {
    if (riskFilter !== "all" && s.riskLevel !== riskFilter) return false;
    if (search && !s.sponsorName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
          <HeartPulse className="h-6 w-6 text-accent" />
          Sponsor Health
        </h1>
        <p className="text-muted-foreground mt-1">Monitor sponsor engagement and identify areas needing attention</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sponsors", count: summary.total, color: "text-foreground", bg: "border-border/60" },
          { label: "Healthy", count: summary.healthy, color: "text-green-600", bg: "border-green-200 bg-green-50/50" },
          { label: "Needs Attention", count: summary.attention, color: "text-amber-600", bg: "border-amber-200 bg-amber-50/50" },
          { label: "At Risk", count: summary.atRisk, color: "text-red-600", bg: "border-red-200 bg-red-50/50" },
        ].map((m) => (
          <Card key={m.label} className={cn("border", m.bg)}>
            <CardContent className="pt-5 pb-4">
              <p className="text-xs font-medium text-muted-foreground mb-1">{m.label}</p>
              <p className={cn("text-2xl font-display font-bold", m.color)} data-testid={`count-health-${m.label.toLowerCase().replace(/\s+/g, "-")}`}>{m.count}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search sponsors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 w-56 text-sm"
            data-testid="input-search-sponsor-health"
          />
        </div>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger className="w-44 h-8 text-sm" data-testid="select-filter-risk">
            <SelectValue placeholder="All Risk Levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Risk Levels</SelectItem>
            <SelectItem value="healthy">Healthy</SelectItem>
            <SelectItem value="attention">Needs Attention</SelectItem>
            <SelectItem value="at_risk">At Risk</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} sponsor{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <Card className="border-border/60">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent mr-3" />
              Loading sponsor health data...
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
                <HeartPulse className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <div>
                <p className="font-medium text-foreground">No sponsors found</p>
                <p className="text-sm text-muted-foreground">Adjust your filters or add sponsors to get started.</p>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Sponsor</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead className="text-center">Events</TableHead>
                  <TableHead className="text-center">Meetings</TableHead>
                  <TableHead className="text-center">Info Requests</TableHead>
                  <TableHead className="text-center">Profile</TableHead>
                  <TableHead>Risk Level</TableHead>
                  <TableHead>Issues</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((s) => {
                  const cfg = RISK_CONFIG[s.riskLevel];
                  const RiskIcon = cfg.icon;
                  return (
                    <TableRow key={s.sponsorId} data-testid={`row-health-${s.sponsorId}`}>
                      <TableCell className="font-medium text-sm">{s.sponsorName}</TableCell>
                      <TableCell>
                        {s.level ? (
                          <Badge variant="outline" className="text-xs capitalize">{s.level}</Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center text-sm">{s.assignedEvents}</TableCell>
                      <TableCell className="text-center text-sm">
                        <span className="font-medium">{s.completedMeetings}</span>
                        <span className="text-muted-foreground">/{s.totalMeetings}</span>
                      </TableCell>
                      <TableCell className="text-center text-sm">{s.totalInfoRequests}</TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          {s.hasLogo ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                          {s.hasDescription ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <XCircle className="h-3.5 w-3.5 text-red-400" />}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-xs border gap-1", cfg.className)}>
                          <RiskIcon className="h-3 w-3" />
                          {cfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {s.issues.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {s.issues.map((issue, i) => (
                              <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{issue}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-green-600">All good</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
