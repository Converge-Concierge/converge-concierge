export type AppEnvironment = "production" | "demo" | "development";

export function getAppEnv(): AppEnvironment {
  const env = process.env.APP_ENV?.toLowerCase();
  if (env === "demo") return "demo";
  if (env === "development") return "development";
  return "production";
}

export function isDemoMode(): boolean {
  return getAppEnv() === "demo";
}

export function getDemoStoragePrefix(): string {
  return isDemoMode() ? "demo/" : "";
}

const DEMO_EMAIL_ALLOWLIST = [
  "convergeevents.com",
  "converge.com",
];

export function isDemoEmailAllowed(email: string): boolean {
  if (!isDemoMode()) return true;
  const domain = email.split("@")[1]?.toLowerCase();
  return DEMO_EMAIL_ALLOWLIST.some((d) => domain === d);
}

export async function runDemoSeedIfNeeded(): Promise<void> {
  if (!isDemoMode()) return;
  try {
    const { db } = await import("../db");
    const { events } = await import("@shared/schema");
    const { like } = await import("drizzle-orm");
    const existing = await db.select().from(events).where(like(events.slug, "DEMO%"));
    if (existing.length > 0) {
      console.log("[DEMO SEED] Demo data already present — skipping auto-seed.");
      return;
    }
    console.log("[DEMO SEED] No demo events found — running seed script as subprocess...");
    const { execSync } = await import("child_process");
    const scriptPath = new URL("../../scripts/seedDemoEnvironment.ts", import.meta.url).pathname;
    execSync(`npx tsx ${scriptPath}`, {
      stdio: "inherit",
      timeout: 120_000,
      env: { ...process.env },
    });
    console.log("[DEMO SEED] Seed subprocess complete.");
  } catch (err: any) {
    console.error("[DEMO SEED] Auto-seed failed:", err.message);
  }
}

export function logDemoStartup(): void {
  const env = getAppEnv();
  if (env === "demo") {
    console.log("═══════════════════════════════════════════════════════");
    console.log("  🎪  DEMO MODE ACTIVE");
    console.log("  • Emails: suppressed (logged only, not sent externally)");
    console.log("  • Storage: using demo/ prefix");
    console.log("  • Backups: writing to demo/backups/");
    console.log("  • Integrations: disabled in demo mode");
    console.log("═══════════════════════════════════════════════════════");
  } else {
    console.log(`[STARTUP] APP_ENV=${env}`);
  }
}
