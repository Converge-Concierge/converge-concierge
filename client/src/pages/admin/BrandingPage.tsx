import { useState, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Palette, Globe, Edit2, Save, X, Lock, ImagePlus, Eye,
  Monitor, LayoutDashboard, CheckCircle, Mail,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AppBranding, AppSettings } from "@shared/schema";

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

function ColorSwatch({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-5 w-5 rounded border border-border/60 shrink-0"
      style={{ backgroundColor: color }}
    />
  );
}

function ColorField({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
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

function LogoField({
  id,
  label,
  value,
  onChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
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
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs text-destructive hover:underline ml-auto"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

export default function BrandingPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AppBranding | null>(null);

  const { data: branding, isLoading } = useQuery<AppBranding>({ queryKey: ["/api/branding"] });
  const { data: settings } = useQuery<AppSettings>({ queryKey: ["/api/settings"] });

  const canEdit = isAdmin || (settings?.allowManagersToEditBranding ?? false);

  const updateMutation = useMutation({
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
      toast({ title: "Branding saved", description: "Global branding settings have been updated." });
      setEditing(false);
      setDraft(null);
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  function startEdit() {
    if (!branding) return;
    setDraft({ ...branding });
    setEditing(true);
  }

  function cancelEdit() {
    setDraft(null);
    setEditing(false);
  }

  function set<K extends keyof AppBranding>(key: K, value: AppBranding[K]) {
    setDraft((prev) => prev ? { ...prev, [key]: value } : prev);
  }

  if (isLoading || !branding) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const b = editing && draft ? draft : branding;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="space-y-6 max-w-3xl mx-auto"
    >
      {/* Page header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Branding</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Customize the global look and identity of Converge Concierge.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending} data-testid="btn-cancel-branding">
                <X className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <Button
                onClick={() => draft && updateMutation.mutate(draft)}
                disabled={updateMutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="btn-save-branding"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {updateMutation.isPending ? "Saving…" : "Save Branding"}
              </Button>
            </>
          ) : canEdit ? (
            <Button onClick={startEdit} className="bg-accent text-accent-foreground hover:bg-accent/90" data-testid="btn-edit-branding">
              <Edit2 className="h-4 w-4 mr-1.5" /> Edit Branding
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
              <Lock className="h-4 w-4" /> View only
            </div>
          )}
        </div>
      </div>

      {/* ── Identity ─────────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader icon={Globe} title="Identity" desc="The name and logo displayed throughout the platform." />

        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="br-name" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">App Name</Label>
              <Input
                id="br-name"
                value={b.appName}
                onChange={(e) => set("appName", e.target.value)}
                placeholder="Converge Concierge"
                data-testid="input-app-name"
              />
            </div>
            <LogoField id="br-logo" label="Global App Logo" value={b.appLogoUrl} onChange={(v) => set("appLogoUrl", v)} testId="input-app-logo" />
            <div className="space-y-1.5">
              <Label htmlFor="br-base-url" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Production URL</Label>
              <Input
                id="br-base-url"
                value={b.appBaseUrl}
                onChange={(e) => set("appBaseUrl", e.target.value)}
                placeholder="https://concierge.convergeevents.com"
                data-testid="input-app-base-url"
              />
              <p className="text-xs text-muted-foreground">
                The public URL used in sponsor login emails and password reset links. Leave blank to auto-detect from the Replit environment.
              </p>
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

      {/* ── Color Palette ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader icon={Palette} title="Color Palette" desc="Primary colors used across the interface." />

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField id="br-primary" label="Primary Color" value={b.primaryColor} onChange={(v) => set("primaryColor", v)} testId="input-primary-color" />
            <ColorField id="br-secondary" label="Secondary Color" value={b.secondaryColor} onChange={(v) => set("secondaryColor", v)} testId="input-secondary-color" />
            <ColorField id="br-accent" label="Accent Color" value={b.accentColor} onChange={(v) => set("accentColor", v)} testId="input-accent-color" />
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

        {/* Live preview */}
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

      {/* ── App Branding Zones ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader
          icon={LayoutDashboard}
          title="App Branding Zones"
          desc="Override logos for specific areas of the platform."
        />

        {editing ? (
          <div className="space-y-5">
            <LogoField id="br-confirm" label="Confirmation Screen Logo" value={b.confirmationLogoUrl} onChange={(v) => set("confirmationLogoUrl", v)} testId="input-confirm-logo" />
            <LogoField id="br-sponsor" label="Sponsor Dashboard Header Logo" value={b.sponsorDashboardLogoUrl} onChange={(v) => set("sponsorDashboardLogoUrl", v)} testId="input-sponsor-logo" />
            <LogoField id="br-public" label="Public Event Page Logo" value={b.publicEventLogoUrl} onChange={(v) => set("publicEventLogoUrl", v)} testId="input-public-logo" />
          </div>
        ) : (
          <div className="space-y-3">
            {[
              { icon: CheckCircle, label: "Confirmation Screen Logo", value: b.confirmationLogoUrl, zone: "booking confirmation pages" },
              { icon: Monitor, label: "Sponsor Dashboard Logo", value: b.sponsorDashboardLogoUrl, zone: "sponsor dashboard header" },
              { icon: Globe, label: "Public Event Page Logo", value: b.publicEventLogoUrl, zone: "public event landing pages" },
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

      {/* ── Internal Notification Email ─────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader
          icon={Mail}
          title="Internal Notification Email"
          desc="Email address that receives internal notifications when sponsors submit deliverables."
        />

        {editing ? (
          <div className="space-y-1.5">
            <Label htmlFor="br-notif-email" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notification Email</Label>
            <Input
              id="br-notif-email"
              type="email"
              value={b.internalNotificationEmail}
              onChange={(e) => set("internalNotificationEmail", e.target.value)}
              placeholder="admin@example.com"
              data-testid="input-notification-email"
            />
            <p className="text-xs text-muted-foreground">
              When a sponsor submits registrants, speakers, or other deliverable data, a notification will be sent to this address.
            </p>
          </div>
        ) : (
          <div className="flex items-center justify-between py-2.5">
            <span className="text-sm text-muted-foreground">Notification Email</span>
            <span className="text-sm font-semibold text-foreground">
              {b.internalNotificationEmail || <span className="italic text-muted-foreground font-normal">Not set</span>}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
