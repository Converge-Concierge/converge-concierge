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
