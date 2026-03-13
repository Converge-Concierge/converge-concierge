import { execSync } from "child_process";

const DIVIDER = "═══════════════════════════════════════════════════════";

function log(msg: string) {
  console.log(`[UPDATE-DEMO] ${msg}`);
}

function fail(msg: string): never {
  console.error(`\n[UPDATE-DEMO] ABORTED: ${msg}\n`);
  process.exit(1);
}

function run(cmd: string, label: string) {
  log(`${label}...`);
  try {
    execSync(cmd, { cwd: process.cwd(), stdio: "inherit", timeout: 120000 });
    log(`${label} — done.`);
  } catch (err: any) {
    fail(`${label} failed: ${err.message}`);
  }
}

const isDryRun = process.argv.includes("--dry-run");

console.log(DIVIDER);
console.log("  UPDATE DEMO — Converge Concierge");
console.log(isDryRun ? "  MODE: DRY RUN (no changes will be made)" : "  MODE: LIVE");
console.log(DIVIDER);
console.log();

log("Step 1/5 — Verifying demo environment...");
if (process.env.APP_ENV !== "demo") {
  fail("APP_ENV is not set to 'demo'. This script can only run in the demo environment.");
}
log(`APP_ENV = ${process.env.APP_ENV}`);

log("Step 2/5 — Verifying database connection...");
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  fail("DATABASE_URL is not set. Cannot connect to demo database.");
}
const safeDbId = dbUrl.includes("@") ? dbUrl.split("@")[1]?.split("/")[0] ?? "unknown" : "unknown";
log(`Database host: ${safeDbId}`);

if (dbUrl.includes("production") || dbUrl.includes("prod-db")) {
  fail("DATABASE_URL appears to reference a production database. Refusing to continue.");
}

log("Step 3/5 — Checking seed script exists...");
const fs = await import("fs");
if (!fs.existsSync("scripts/seedDemoEnvironment.ts")) {
  fail("Seed script not found at scripts/seedDemoEnvironment.ts");
}
log("Seed script found.");

if (isDryRun) {
  console.log();
  console.log(DIVIDER);
  console.log("  DRY RUN COMPLETE — No changes were made.");
  console.log();
  console.log("  What would happen in a live run:");
  console.log("    1. Database schema pushed (npm run db:push)");
  console.log("    2. Demo data cleared and reseeded");
  console.log("    3. 3 events, 12 sponsors, 90 attendees created");
  console.log(DIVIDER);
  process.exit(0);
}

const start = Date.now();

run("npm run db:push", "Step 4/5 — Updating database schema");

run("npx tsx scripts/seedDemoEnvironment.ts --force", "Step 5/5 — Resetting and reseeding demo data");

const elapsed = ((Date.now() - start) / 1000).toFixed(1);

console.log();
console.log(DIVIDER);
console.log("  DEMO UPDATE COMPLETE");
console.log(`  Completed in ${elapsed}s`);
console.log();
console.log("  What was done:");
console.log("    Schema updated (db:push)");
console.log("    Demo data cleared and reseeded");
console.log();
console.log("  Demo data includes:");
console.log("    Events:       3  (DEMOFRC2026, DEMOUSBT2026, DEMOTLS2026)");
console.log("    Sponsors:    12  (Platinum, Gold, Silver, Bronze)");
console.log("    Attendees:   90  (30 per event)");
console.log("    Deliverables: 16 types per sponsor");
console.log("    + meetings, info requests, email logs, backup records");
console.log();
console.log("  Login credentials:");
console.log("    Admin:   admin@converge.com / password");
console.log("    Manager: manager@converge.com / password");
console.log(DIVIDER);
