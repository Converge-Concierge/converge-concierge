import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Settings2, Clock, Globe, Calendar, Shield, Edit2, Save, X,
  Lock, Info, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import type { AppSettings } from "@shared/schema";

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

function Toggle({
  value,
  onChange,
  disabled,
  testId,
}: {
  value: boolean;
  onChange?: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  return (
    <div className={cn("flex rounded-lg border border-input overflow-hidden w-fit text-sm", disabled && "opacity-60")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(true)}
        className={cn(
          "px-4 py-1.5 font-medium transition-colors",
          value ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted",
        )}
        data-testid={testId ? `${testId}-yes` : undefined}
      >
        Yes
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange?.(false)}
        className={cn(
          "px-4 py-1.5 font-medium transition-colors border-l border-input",
          !value ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted",
        )}
        data-testid={testId ? `${testId}-no` : undefined}
      >
        No
      </button>
    </div>
  );
}

function SectionHeader({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-3 border-b border-border/50">
      <Icon className="h-4 w-4 text-accent" />
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
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

export default function SettingsPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<AppSettings | null>(null);

  const { data: settings, isLoading } = useQuery<AppSettings>({
    queryKey: ["/api/settings"],
  });

  const canEdit = isAdmin || (settings?.allowManagersToEditSettings ?? false);

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

  function handleSave() {
    if (!draft) return;
    updateMutation.mutate(draft);
  }

  if (isLoading || !settings) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  const s = editing && draft ? draft : settings;

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
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Configure system preferences and access control.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {editing ? (
            <>
              <Button variant="outline" onClick={cancelEdit} disabled={updateMutation.isPending} data-testid="btn-cancel-settings">
                <X className="h-4 w-4 mr-1.5" /> Cancel
              </Button>
              <Button
                onClick={handleSave}
                disabled={updateMutation.isPending}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="btn-save-settings"
              >
                <Save className="h-4 w-4 mr-1.5" />
                {updateMutation.isPending ? "Saving…" : "Save Settings"}
              </Button>
            </>
          ) : (
            canEdit ? (
              <Button
                onClick={startEdit}
                className="bg-accent text-accent-foreground hover:bg-accent/90"
                data-testid="btn-edit-settings"
              >
                <Edit2 className="h-4 w-4 mr-1.5" /> Edit Settings
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-sm text-muted-foreground border border-border/60 rounded-lg px-3 py-2 bg-muted/30">
                <Lock className="h-4 w-4" /> View only
              </div>
            )
          )}
        </div>
      </div>

      {/* Manager permission notice */}
      {!isAdmin && canEdit && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
          <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-blue-700">
            You can edit system preferences and scheduling defaults. Access control settings are restricted to admins.
          </p>
        </div>
      )}

      {/* ── System Preferences ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader icon={Globe} title="System Preferences" />
        {editing ? (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-timezone" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Time Zone</Label>
              <select
                id="set-timezone"
                className={selectClass}
                value={s.defaultTimezone}
                onChange={(e) => set("defaultTimezone", e.target.value)}
                data-testid="select-timezone"
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-duration" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Default Meeting Duration (minutes)</Label>
              <Input
                id="set-duration"
                type="number"
                min={5}
                max={120}
                step={5}
                value={s.defaultMeetingDuration}
                onChange={(e) => set("defaultMeetingDuration", Number(e.target.value))}
                className="max-w-[160px]"
                data-testid="input-meeting-duration"
              />
            </div>
          </div>
        ) : (
          <div>
            <ReadRow label="Default Time Zone" value={s.defaultTimezone} />
            <ReadRow label="Default Meeting Duration" value={`${s.defaultMeetingDuration} minutes`} />
          </div>
        )}
      </div>

      {/* ── Scheduling Defaults ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5">
        <SectionHeader icon={Calendar} title="Default Scheduling Preferences" />
        {editing ? (
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="set-win-start" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Meeting Window Start</Label>
              <Input
                id="set-win-start"
                type="time"
                value={s.onlineWindowStart}
                onChange={(e) => set("onlineWindowStart", e.target.value)}
                data-testid="input-window-start"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="set-win-end" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Online Meeting Window End</Label>
              <Input
                id="set-win-end"
                type="time"
                value={s.onlineWindowEnd}
                onChange={(e) => set("onlineWindowEnd", e.target.value)}
                data-testid="input-window-end"
              />
            </div>
          </div>
        ) : (
          <div>
            <ReadRow label="Online Meeting Window Start" value={s.onlineWindowStart} />
            <ReadRow label="Online Meeting Window End" value={s.onlineWindowEnd} />
          </div>
        )}
      </div>

      {/* ── Access Control ──────────────────────────────────────────────────── */}
      <div className={cn("bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-5", !isAdmin && "opacity-70")}>
        <div className="flex items-center justify-between pb-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-foreground">Access Control</h2>
          </div>
          {!isAdmin && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground border border-border/60 rounded px-2 py-0.5">
              <Lock className="h-3 w-3" /> Admin only
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Control what managers are permitted to do in this system.
        </p>
        {editing && isAdmin ? (
          <div className="space-y-5">
            {([
              { key: "allowManagersToArchive" as const, label: "Allow Managers to Archive Records", desc: "Managers can archive events, sponsors, and attendees." },
              { key: "allowManagersToEditBranding" as const, label: "Allow Managers to Edit Branding", desc: "Managers can modify global branding settings." },
              { key: "allowManagersToEditSettings" as const, label: "Allow Managers to Edit Settings", desc: "Managers can edit system preferences and scheduling defaults." },
            ]).map(({ key, label, desc }) => (
              <div key={key} className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-medium text-foreground">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
                <Toggle value={s[key] as boolean} onChange={(v) => set(key, v)} testId={`toggle-${key}`} />
              </div>
            ))}
          </div>
        ) : (
          <div>
            <ReadRow label="Managers can archive records" value={s.allowManagersToArchive} />
            <ReadRow label="Managers can edit branding" value={s.allowManagersToEditBranding} />
            <ReadRow label="Managers can edit settings" value={s.allowManagersToEditSettings} />
          </div>
        )}
      </div>

      {/* ── Notification Preferences ─────────────────────────────────────────── */}
      <div className="bg-card rounded-2xl border border-border/60 shadow-sm p-6 space-y-4">
        <SectionHeader icon={Settings2} title="Notification Preferences" />
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
    </motion.div>
  );
}
