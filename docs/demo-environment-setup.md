# Demo Environment Setup & Update Guide

## Overview

The Converge Concierge demo environment is a fully isolated instance for sales demonstrations and internal testing. It runs the same application codebase as production but with separate infrastructure and demo-safe protections.

**Production**: concierge.convergeevents.com
**Demo**: demo-concierge.convergeevents.com

---

## Initial Setup

### Step 1: Fork the Production Repl

1. Open the production Converge Concierge project on Replit
2. Click the three-dot menu → "Fork Repl"
3. Name the new Repl: `converge-concierge-demo`
4. The fork creates a complete copy of the codebase

### Step 2: Configure Environment Variables

In the demo Repl, set the following environment secrets:

**Required — Demo Mode:**
```
APP_ENV=demo
```

**Required — Copy from Production:**
```
SESSION_SECRET         (generate a new value or copy from production)
R2_ENDPOINT            (same R2 account, demo files are isolated by prefix)
R2_ACCESS_KEY_ID       (same R2 account)
R2_SECRET_ACCESS_KEY   (same R2 account)
R2_BUCKET_NAME         (same R2 bucket — demo writes under demo/ prefix)
R2_ACCOUNT_ID          (same R2 account)
```

**Automatic — Do NOT copy:**
```
DATABASE_URL           (auto-provisioned by the demo Repl's own PostgreSQL)
```

The demo Repl automatically receives its own PostgreSQL database. Confirm that `DATABASE_URL` points to the demo database, not production.

### Step 3: Push Database Schema

Run the schema push to create all tables in the demo database:

```bash
npm run db:push
```

### Step 4: Seed Demo Data

Populate the demo database with realistic sample data:

```bash
npx tsx scripts/seedDemoEnvironment.ts
```

This creates:
- 3 demo events (DEMOFRC2026, DEMOUSBT2026, DEMOTLS2026)
- 12 demo sponsors with tiered engagement profiles
- 90 demo attendees with realistic fintech titles
- Meetings, info requests, deliverables, email logs, and backup records

### Step 5: Deploy

1. Configure deployment in the demo Repl (autoscale target)
2. Click "Publish" to deploy
3. Configure DNS: point `demo-concierge.convergeevents.com` to the Replit deployment URL via CNAME record

### Step 6: Verify

After deployment, confirm:
- [ ] Admin login works (admin@converge.com / password)
- [ ] Amber "DEMO ENVIRONMENT" banner is visible
- [ ] Demo sponsors and attendees are populated
- [ ] Meetings and info requests exist
- [ ] Sponsor dashboards are accessible
- [ ] Settings → Demo Environment Tools section is visible
- [ ] Demo reset button works
- [ ] Emails are suppressed for external domains (check email logs)

---

## Demo Mode Protections

When `APP_ENV=demo`, the following protections are automatically enforced:

| Protection | Behavior |
|---|---|
| **Email Suppression** | External emails are logged but never sent. Only @convergeevents.com and @converge.com recipients receive emails. |
| **R2 Storage Isolation** | All file writes use the `demo/` prefix (e.g., `demo/backups/`, `demo/events/`). Production files are untouched. |
| **Eventzilla Webhook** | Blocked and logged. No external webhook processing. |
| **Demo Banner** | Amber banner displayed across all admin pages. |
| **Demo Reset Tool** | Admin → Settings → "Reset Demo Environment" button (with confirmation dialog and concurrency lock). |
| **Demo Status API** | Entity counts available at `GET /api/admin/demo/status`. |

---

## Demo Login Credentials

| Role | Email | Password |
|---|---|---|
| Admin | admin@converge.com | password |
| Manager | manager@converge.com | password |

---

## How to Update Demo

After copying updated code from production into the demo Repl, run:

```bash
npx tsx scripts/updateDemoEnvironment.ts
```

Or use the shell shortcut:

```bash
bash scripts/update-demo.sh
```

This single command:
1. Verifies `APP_ENV=demo` (refuses to run otherwise)
2. Verifies the database connection is not production
3. Updates the database schema (`db:push`)
4. Clears and reseeds all demo data

To preview what would happen without making changes:

```bash
npx tsx scripts/updateDemoEnvironment.ts --dry-run
```

The same workflow also runs from the admin panel: **Admin → Settings → Reset Demo Environment** button.

---

## Full Update Procedure

For syncing production code changes into the demo environment:

### Step-by-Step

1. **Review production changes**
   - Note what files changed and whether any database schema changes were made

2. **Copy updated code into the demo Repl**
   - Open both Repls side by side
   - Copy changed files from production to demo
   - For large updates, consider re-forking (but you'll need to reconfigure secrets)

3. **Confirm environment variables**
   - Verify `APP_ENV=demo` is still set
   - Verify all required secrets are present
   - Verify `DATABASE_URL` still points to the demo database (not production)

4. **Run the update command**
   ```bash
   npx tsx scripts/updateDemoEnvironment.ts
   ```
   This handles schema push and data reseed in one step.

5. **Verify demo protections**
   - Confirm demo banner is visible
   - Confirm emails are suppressed
   - Confirm R2 writes use `demo/` prefix
   - Confirm reset tool works

7. **Redeploy**
   - Click "Publish" in the demo Repl to push updated code live

8. **Smoke test**
   - Log in as admin
   - Navigate through dashboard, sponsors, attendees, meetings
   - Verify sponsor dashboards load
   - Check a sponsor login flow
   - Trigger a test email (confirm it's suppressed for external addresses)

---

## Demo Safety Rules

The demo instance must never contain real production data.

**Demo data contains only:**
- Fictional sponsors (e.g., RiskPilot, CoreNova, CloudTreasury)
- Fictional attendees (e.g., Michael Thornton, Jennifer Carmichael)
- Fictional meetings and info requests
- Fictional deliverables

**Safe to share with production:**
- Sponsorship templates and category lists
- UI configuration and branding settings
- Application code

**Never import into demo:**
- Real sponsor data
- Real attendee data
- Real meeting records
- Production database exports

---

## Architecture Reference

| Component | File |
|---|---|
| Demo mode service | `server/services/demoModeService.ts` |
| Email suppression | `services/emailService.js` |
| R2 prefix logic | `server/backup-service.ts` |
| Demo API routes | `server/routes.ts` |
| Demo banner | `client/src/components/DemoBanner.tsx` |
| Demo tools UI | `client/src/pages/admin/SettingsPage.tsx` |
| Demo seed script | `scripts/seedDemoEnvironment.ts` |
| Demo update script | `scripts/updateDemoEnvironment.ts` |
| Shell shortcut | `scripts/update-demo.sh` |

---

## Troubleshooting

**Demo banner not showing:**
- Verify `APP_ENV=demo` is set (check `GET /api/app-env` endpoint)

**Seed script won't run:**
- Script requires `APP_ENV=demo` or the `--force` flag

**Reset button returns 409:**
- A reset is already in progress. Wait for it to complete.

**Emails being sent to external addresses:**
- Verify `APP_ENV` is set to exactly `demo` (case-insensitive check)

**Database schema mismatch after update:**
- Run `npm run db:push` to sync schema, then re-seed
