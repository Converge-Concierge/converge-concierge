import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Settings2, Clock, Globe, Calendar, Edit2, Save, X,
  Lock, Info, CheckCircle2, XCircle, FlaskConical, RotateCcw,
  Mail, Database, Shield, AlertTriangle, Palette, Eye,
  Monitor, LayoutDashboard, CheckCircle, ImagePlus, Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AppSettings, AppBranding } from "@shared/schema";

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Singapore",
  "Asia/Dubai",
  "Australia/Sydney",
  "UTC",
];

const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

type SettingsTab = "general" | "branding" | "notifications";

const TABS: { id: SettingsTab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "branding", label: "Branding", icon: Palette },
  { id: "notifications", label: "Notifications", icon: Bell },
];

function SectionHeader({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc?: string }) {
  return (
    <div className="pb-3 border-b border-border/50 space-y-0.5">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      </div>
      {desc && <p className="text-xs text-muted-foreground pl-6">{desc}</p>}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string | number | boolean }) {
  const isBoolean = typeof value === "boolean";
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      {isBoolean ? (
        value ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-green-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> Allowed
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <XCircle className="h-3.5 w-3.5" /> Not allowed
          </span>
        )
      ) : (
        <span className="text-sm font-semibold text-foreground">{value}</span>
      )}
    </div>
  );
}

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-5 w-5 rounded border border-border/60 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ColorField({ id, label, value, onChange, testId }: {
  id: string; label: string; value: string; onChange: (v: string) => void; testId?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 rounded border border-input cursor-pointer p-0.5 bg-transparent"
          data-testid={testId ? `${testId}-picker` : undefined}
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="font-mono text-sm"
          data-testid={testId}
        />
      </div>
    </div>
  );
}

function LogoField({ id, label, value, onChange, testId }: {
  id: string; label: string; value: string; onChange: (v: string) => void; testId?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", credentials: "include", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = await res.json();
      onChange(url);
    } catch {
      toast({ title: "Upload failed", description: "Could not upload the image file.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value.startsWith("/uploads/") || value.startsWith("data:") ? "" : value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://example.com/logo.png"
          className="text-sm flex-1"
          data-testid={testId}
        />
        <button
          type="button"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-2 rounded-md border border-input text-sm text-muted-foreground hover:bg-muted transition-colors shrink-0 disabled:opacity-60"
          data-testid={testId ? `${testId}-upload` : undefined}
        >
          <ImagePlus className="h-4 w-4" />
          {uploading ? "Uploading…" : "Upload"}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>
      {value && (
        <div className="flex items-center gap-3 mt-2">
          <div className="h-10 w-10 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
            <img src={value} alt="Logo preview" className="h-full w-full object-contain p-1" onError={(e) => ((e.target as HTMLImageElement).style.display = "none")} />
          </div>
          <span className="text-xs text-muted-foreground">{value.startsWith("/uploads/") ? "Uploaded file" : value.slice(0, 50) + (value.length > 50 ? "…" : "")}</span>
          <button type="button" onClick={() => onChange("")} className="text-xs text-destructive hover:underline ml-auto">Remove</button>
        </div>
      )}
    </div>
  );
}

function parseEmails(input: string): string[] {
  return input
    .split(/[,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function validateEmails(input: string): { valid: boolean; emails: string[]; errors: string[] } {
  const parts = parseEmails(input);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const errors: string[] = [];
  const seen = new Set<string>();
  const valid: string[] = [];
  for (const part of parts) {
    if (!emailRegex.test(part)) {
      errors.push(`"${part}" is not a valid email address`);
    } else if (seen.has(part.toLowerCase())) {
      errors.push(`"${part}" is duplicated`);
    } else {
      seen.add(part.toLowerCase());
      valid.push(part);
    }
  }
  return { valid: errors.length === 0, emails: valid, errors };
}

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AppSettings | null>(null);
  const [brandingEditing, setBrandingEditing] = useState(false);
  const [brandingDraft, setBrandingDraft] = useState<AppBranding | null>(null);
  const [emailErrors, setEmailErrors] = useState<string[]>([]);

  const { data: settings, isLoading: settingsLoading } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });
  const { data: branding, isLoading: brandingLoading } = useQuery<AppBranding>({ queryKey: ["/api/branding"] });

  const canEdit = isAdmin || (settings?.allowManagersToEditSettings ?? false);
  const canEditBranding = isAdmin || (settings?.allowManagersToEditBranding ?? false);

  const updateMutation = useMutation({
    mutationFn: async (data: Partial<AppSettings>) => {
      const res = await apiRequest("PUT", "/api/settings", data);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? "Failed to save settings");
      }
      return res.json() as Promise<AppSettings>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/settings"], data);
      toast({ title: "Settings saved", description: "System settings have been updated." });
      setEditing(false);
      setDraft(null);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const brandingMutation = useMutation({
    mutationFn: async (data: Partial<AppBranding>) => {
      const res = await apiRequest("PUT", "/api/branding", data);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.message ?? "Failed to save branding");
      }
      return res.json() as Promise<AppBranding>;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/branding"], data);
      toast({ title: "Branding saved", description: "Branding settings have been updated." });
      setBrandingEditing(false);
      setBrandingDraft(null);
      setEmailErrors([]);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  function startEdit() {
    if (!settings) return;
    setDraft({ ...settings });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function set<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function startBrandingEdit() {
    if (!branding) return;
    setBrandingDraft({ ...branding });
    setBrandingEditing(true);
    setEmailErrors([]);
  }

  function cancelBrandingEdit() {
    setBrandingDraft(null);
    setBrandingEditing(false);
    setEmailErrors([]);
  }

  function setBranding<K extends keyof AppBranding>(key: K, value: AppBranding[K]) {
    setBrandingDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  function handleSaveBranding() {
    if (!brandingDraft) return;
    const emailVal = brandingDraft.internalNotificationEmail?.trim() ?? "";
    if (emailVal) {
      const result = validateEmails(emailVal);
      if (!result.valid) {
        setEmailErrors(result.errors);
        return;
      }
      brandingDraft.internalNotificationEmail = result.emails.join(", ");
    }
    setEmailErrors([]);
    brandingMutation.mutate(brandingDraft);
  }

  const isLoading = settingsLoading || brandingLoading;
  if (isLoading || !settings || !branding) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const s = editing && draft ? draft : settings;
  const b = brandingEditing && brandingDraft ? brandingDraft : branding;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-4xl mx-auto"
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure system preferences, branding, and notification settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === "general" && (
            editing ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending} data-testid="btn-cancel-settings">
                  <X className="h-4 w-4 mr-1.5" /> Cancel
                </Button>
                <Button
                  onClick={() => draft && updateMutation.mutate(draft)}
                  disabled={updateMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  data-testid="btn-save-settings"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {updateMutation.isPending ? "Saving…" : "Save Settings"}
                </Button>
              </>
            ) : canEdit ? (
              <Button onClick={startEdit} className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="btn-edit-settings">
                <Edit2 className="h-4 w-4 mr-1.5" /> Edit Settings
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
                <Lock className="h-4 w-4" /> View only
              </div>
            )
          )}
          {(activeTab === "branding" || activeTab === "notifications") && (
            brandingEditing ? (
              <>
                <Button variant="outline" onClick={cancelBrandingEdit} disabled={brandingMutation.isPending} data-testid="btn-cancel-branding">
                  <X className="h-4 w-4 mr-1.5" /> Cancel
                </Button>
                <Button
                  onClick={handleSaveBranding}
                  disabled={brandingMutation.isPending}
                  className="bg-accent text-accent-foreground hover:bg-accent/90"
                  data-testid="btn-save-branding"
                >
                  <Save className="h-4 w-4 mr-1.5" />
                  {brandingMutation.isPending ? "Saving…" : "Save"}
                </Button>
              </>
            ) : canEditBranding ? (
              <Button onClick={startBrandingEdit} className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="btn-edit-branding">
                <Edit2 className="h-4 w-4 mr-1.5" /> Edit
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
                <Lock className="h-4 w-4" /> View only
              </div>
            )
          )}
        </div>
      </div>

      {!isAdmin && canEdit && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            You can edit system preferences and scheduling defaults. Access control settings are restricted to admins.
          </p>
        </div>
      )}

      <div className="border-b border-border/50">
        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-2 px-5 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px",
                activeTab === tab.id
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
              data-testid={`tab-settings-${tab.id}`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "general" && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={Globe} title="System Preferences" />
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="set-timezone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Time Zone</Label>
                  <select id="set-timezone" className={selectClass} value={s.defaultTimezone} onChange={(e) => set("defaultTimezone", e.target.value)} data-testid="select-timezone">
                    {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="set-duration" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Meeting Duration (minutes)</Label>
                  <Input id="set-duration" type="number" min={5} max={120} step={5} value={s.defaultMeetingDuration} onChange={(e) => set("defaultMeetingDuration", Number(e.target.value))} className="max-w-[160px]" data-testid="input-meeting-duration" />
                </div>
              </div>
            ) : (
              <div>
                <ReadRow label="Default Time Zone" value={s.defaultTimezone} />
                <ReadRow label="Default Meeting Duration" value={`${s.defaultMeetingDuration} minutes`} />
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={Calendar} title="Default Scheduling Preferences" />
            {editing ? (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="set-win-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Meeting Window Start</Label>
                  <Input id="set-win-start" type="time" value={s.onlineWindowStart} onChange={(e) => set("onlineWindowStart", e.target.value)} data-testid="input-window-start" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="set-win-end" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Meeting Window End</Label>
                  <Input id="set-win-end" type="time" value={s.onlineWindowEnd} onChange={(e) => set("onlineWindowEnd", e.target.value)} data-testid="input-window-end" />
                </div>
              </div>
            ) : (
              <div>
                <ReadRow label="Online Meeting Window Start" value={s.onlineWindowStart} />
                <ReadRow label="Online Meeting Window End" value={s.onlineWindowEnd} />
              </div>
            )}
          </div>

          <DemoToolsSection />
        </div>
      )}

      {activeTab === "branding" && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={Globe} title="Identity" desc="The name and logo displayed throughout the platform." />
            {brandingEditing ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="br-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">App Name</Label>
                  <Input id="br-name" value={b.appName} onChange={(e) => setBranding("appName", e.target.value)} placeholder="Converge Concierge" data-testid="input-app-name" />
                </div>
                <LogoField id="br-logo" label="Global App Logo" value={b.appLogoUrl} onChange={(v) => setBranding("appLogoUrl", v)} testId="input-app-logo" />
                <div className="space-y-1.5">
                  <Label htmlFor="br-base-url" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Production URL</Label>
                  <Input id="br-base-url" value={b.appBaseUrl} onChange={(e) => setBranding("appBaseUrl", e.target.value)} placeholder="https://concierge.convergeevents.com" data-testid="input-app-base-url" />
                  <p className="text-xs text-muted-foreground">The public URL used in sponsor login emails and password reset links.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <span className="text-sm text-muted-foreground">App Name</span>
                  <span className="text-sm font-semibold text-foreground">{b.appName}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-border/30">
                  <span className="text-sm text-muted-foreground">App Logo</span>
                  {b.appLogoUrl ? (
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded border border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                        <img src={b.appLogoUrl} alt="App logo" className="h-full w-full object-contain p-0.5" />
                      </div>
                      <span className="text-xs text-muted-foreground">Configured</span>
                    </div>
                  ) : (
                    <span className="text-sm text-muted-foreground italic">Not set — using default</span>
                  )}
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-muted-foreground">Production URL</span>
                  <span className="text-sm font-semibold text-foreground">
                    {b.appBaseUrl || <span className="italic text-muted-foreground font-normal">Auto-detect</span>}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={Palette} title="Color Palette" desc="Primary colors used across the interface." />
            {brandingEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <ColorField id="br-primary" label="Primary Color" value={b.primaryColor} onChange={(v) => setBranding("primaryColor", v)} testId="input-primary-color" />
                <ColorField id="br-secondary" label="Secondary Color" value={b.secondaryColor} onChange={(v) => setBranding("secondaryColor", v)} testId="input-secondary-color" />
                <ColorField id="br-accent" label="Accent Color" value={b.accentColor} onChange={(v) => setBranding("accentColor", v)} testId="input-accent-color" />
              </div>
            ) : (
              <div className="space-y-2">
                {[
                  { label: "Primary Color", value: b.primaryColor },
                  { label: "Secondary Color", value: b.secondaryColor },
                  { label: "Accent Color", value: b.accentColor },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm text-muted-foreground">{label}</span>
                    <div className="flex items-center gap-2">
                      <ColorSwatch color={value} />
                      <span className="text-sm font-mono font-semibold text-foreground">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-3 flex items-center gap-1.5">
                <Eye className="h-3.5 w-3.5" /> Color Preview
              </p>
              <div className="flex flex-wrap gap-2">
                <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: b.primaryColor }}>Primary</div>
                <div className="px-4 py-2 rounded-lg border border-border text-sm font-medium" style={{ backgroundColor: b.secondaryColor, color: b.primaryColor }}>Secondary</div>
                <div className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ backgroundColor: b.accentColor }}>Accent</div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={LayoutDashboard} title="App Branding Zones" desc="Override logos for specific areas of the platform." />
            {brandingEditing ? (
              <div className="space-y-5">
                <LogoField id="br-confirm" label="Confirmation Screen Logo" value={b.confirmationLogoUrl} onChange={(v) => setBranding("confirmationLogoUrl", v)} testId="input-confirm-logo" />
                <LogoField id="br-sponsor" label="Sponsor Dashboard Header Logo" value={b.sponsorDashboardLogoUrl} onChange={(v) => setBranding("sponsorDashboardLogoUrl", v)} testId="input-sponsor-logo" />
                <LogoField id="br-public" label="Public Event Page Logo" value={b.publicEventLogoUrl} onChange={(v) => setBranding("publicEventLogoUrl", v)} testId="input-public-logo" />
              </div>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "Confirmation Screen Logo", value: b.confirmationLogoUrl, zone: "booking confirmation pages" },
                  { label: "Sponsor Dashboard Logo", value: b.sponsorDashboardLogoUrl, zone: "sponsor dashboard header" },
                  { label: "Public Event Page Logo", value: b.publicEventLogoUrl, zone: "public event landing pages" },
                ].map(({ label, value, zone }) => (
                  <div key={label} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-sm text-foreground">{label}</p>
                      <p className="text-xs text-muted-foreground">Used on {zone}</p>
                    </div>
                    {value ? (
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded border border-border bg-muted/30 overflow-hidden flex items-center justify-center">
                          <img src={value} alt={label} className="h-full w-full object-contain p-0.5" />
                        </div>
                        <span className="text-xs text-green-600 font-medium">Set</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">Using global logo</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "notifications" && (
        <div className="space-y-6">
          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
            <SectionHeader icon={Mail} title="Sponsor Activity Notification Email" desc="Receives alerts when sponsors submit deliverable data such as registrants, speakers, or file uploads." />
            {brandingEditing ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="br-notif-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notification Email(s)</Label>
                  <Input
                    id="br-notif-email"
                    value={b.internalNotificationEmail}
                    onChange={(e) => { setBranding("internalNotificationEmail", e.target.value); setEmailErrors([]); }}
                    placeholder="admin@example.com, manager@example.com"
                    data-testid="input-notification-email"
                  />
                  <p className="text-xs text-muted-foreground">
                    Enter one or more email addresses, separated by commas. Notifications are sent when sponsors submit registrants, speakers, upload files, or update deliverable status.
                  </p>
                  {emailErrors.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {emailErrors.map((err, i) => (
                        <p key={i} className="text-xs text-destructive flex items-center gap-1">
                          <XCircle className="h-3 w-3 shrink-0" /> {err}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between py-2.5">
                <span className="text-sm text-muted-foreground">Notification Email(s)</span>
                <span className="text-sm font-semibold text-foreground">
                  {b.internalNotificationEmail || <span className="italic text-muted-foreground font-normal">Not set — notifications disabled</span>}
                </span>
              </div>
            )}
          </div>

          <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
            <SectionHeader icon={Settings2} title="Sponsor Notification Preferences" />
            <p className="text-sm text-muted-foreground">
              Sponsor notifications are automatically generated when meetings are created or updated. No additional configuration is required.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                "Meeting Scheduled → Sponsor notified",
                "Meeting Confirmed → Sponsor notified",
                "Meeting Cancelled → Sponsor notified",
                "Meeting Completed → Sponsor notified",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

function DemoToolsSection() {
  const { toast } = useToast();
  const [confirmReset, setConfirmReset] = useState(false);

  const { data: envData } = useQuery<{ env: string; isDemoMode: boolean }>({
    queryKey: ["/api/app-env"],
  });

  const { data: demoStatus } = useQuery<{
    isDemoMode: boolean;
    counts: { events: number; sponsors: number; attendees: number; meetings: number; informationRequests: number };
  }>({
    queryKey: ["/api/admin/demo/status"],
    enabled: !!envData?.isDemoMode,
  });

  const resetMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/admin/demo/reset"),
    onSuccess: () => {
      toast({ title: "Demo Reset Complete", description: "All data has been reset with fresh demo data." });
      setConfirmReset(false);
      queryClient.invalidateQueries();
    },
    onError: (err: Error) => {
      toast({ title: "Reset Failed", description: err.message, variant: "destructive" });
      setConfirmReset(false);
    },
  });

  if (!envData?.isDemoMode) return null;

  return (
    <div data-testid="demo-tools-section" className="bg-amber-50 dark:bg-amber-950/30 rounded-2xl border-2 border-amber-300 dark:border-amber-700 shadow-sm p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
          <FlaskConical className="h-5 w-5 text-amber-600" />
        </div>
        <div>
          <h3 className="text-base font-semibold text-foreground">Demo Environment Tools</h3>
          <p className="text-xs text-muted-foreground">Manage the demo environment for sales presentations</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-center gap-2 text-sm">
          <Mail className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-muted-foreground">Emails suppressed to external recipients</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Shield className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-muted-foreground">Webhooks blocked in demo mode</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Database className="h-4 w-4 text-amber-600 shrink-0" />
          <span className="text-muted-foreground">Storage uses demo/ prefix</span>
        </div>
      </div>

      {demoStatus && (
        <div className="bg-white dark:bg-background rounded-lg border border-border/60 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Current Demo Data</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {Object.entries(demoStatus.counts).map(([key, value]) => (
              <div key={key} data-testid={`demo-count-${key}`} className="text-center">
                <p className="text-lg font-bold text-foreground">{value}</p>
                <p className="text-xs text-muted-foreground capitalize">{key.replace(/([A-Z])/g, " $1").trim()}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-background rounded-lg border border-border/60 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Quick Login Credentials</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">admin@converge.com / password</span>
            <span className="text-xs text-muted-foreground">(Admin)</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-mono text-xs">manager@converge.com / password</span>
            <span className="text-xs text-muted-foreground">(Manager)</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        {!confirmReset ? (
          <Button
            data-testid="button-demo-reset"
            variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-100"
            onClick={() => setConfirmReset(true)}
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset Demo Environment
          </Button>
        ) : (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-red-500 shrink-0" />
            <span className="text-sm text-red-700 dark:text-red-300">This will delete all data and reseed fresh demo data. Are you sure?</span>
            <Button data-testid="button-confirm-demo-reset" variant="destructive" size="sm" disabled={resetMutation.isPending} onClick={() => resetMutation.mutate()}>
              {resetMutation.isPending ? "Resetting..." : "Yes, Reset"}
            </Button>
            <Button data-testid="button-cancel-demo-reset" variant="ghost" size="sm" onClick={() => setConfirmReset(false)}>Cancel</Button>
          </div>
        )}
      </div>
    </div>
  );
}
