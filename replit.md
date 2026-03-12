# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform designed for booking meetings between attendees and sponsors at various events. It features a public-facing site for event browsing and booking, and a comprehensive admin panel for managing events, sponsors, attendees, meetings, reports, and users. The platform aims to provide a robust and intuitive solution for event scheduling, including a multi-step booking wizard, detailed management functionalities, and comprehensive reporting.

## Admin Navigation Structure (4 Sections)

The AppSidebar is organized into 4 sections:
- **Management**: Dashboard, Events, Sponsors, Attendees, Meetings, Info Requests
- **Sponsor Management**: Deliverables (AgreementDeliverablesPage), Sponsor Dashboards (SponsorDashboardsAdminPage at `/admin/sponsor-dashboards`)
- **Reporting**: Email Center, Reports, Data Exchange
- **Configuration**: Branding, Settings, Users, Access Control, Sponsorship Templates

## Event Tab Strip Pattern

Sponsors, Attendees, Meetings, Info Requests, and Sponsor Dashboards pages all feature event tab strips at the top. Tabs auto-select the nearest upcoming event on load. Tab order: upcoming events (soonest first) → completed events (most recent first) → All Events. Active tab uses `event.accentColor ?? "#0D9488"` for background color.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture

The platform utilizes a modern web stack with a distinct separation between frontend and backend. The backend is built with Express.js and TypeScript, using PostgreSQL with Drizzle ORM. The frontend is a React single-page application, employing Vite for building, Wouter for routing, and TanStack Query for state management. UI components and styling are handled by Shadcn/ui and Tailwind CSS.

### Frontend Details

- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter.
- **State Management**: TanStack Query v5 for server state.
- **UI/UX**: shadcn/ui components (New York style) with Radix UI primitives, styled using Tailwind CSS, a custom fintech color palette, and `Plus Jakarta Sans` and `Outfit` fonts. Framer Motion provides animations. Event-specific theming supports dynamic `accentColor` and `buttonColor`. Public scheduling flows include "Onsite" and "Online request" with conflict detection.

### Backend Details

- **Runtime**: Node.js with Express 5 and TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **File Uploads**: Replit App Storage.
- **Authentication**: Session-based authentication with `express-session` and `connect-pg-simple`.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `manager` roles.
- **Password Management**: Token-based password recovery.

### Shared & Data Models

- **Schema**: Defined in `shared/schema.ts`, encompassing entities like `events`, `sponsors`, `attendees`, and `meetings`.
- **Event Scheduling Logic**: Includes conflict detection, cascade archiving/unarchiving, and attendee resolution, with per-event scheduling shutoff and external handoff options.
- **Event Management**: Admin panel supports CRUD operations, a `MeetingBlocksEditor`, and event cloning.
- **Attendee Management**: Enhanced module with interest tracking and notes. Admin table includes `AttendeeDetailDrawer`.
- **Sponsor Management**: Sponsor profile pages, dashboard with notifications, meeting status updates, and lead contact management. Supports multi-user sponsor access with different access levels. Admin Sponsor Dashboards page (`/admin/sponsor-dashboards`) shows all event-eligible sponsors regardless of token state, with status (Ready, Access Sent, Active, No Contact, Inactive), primary contact column, and Send/Resend Access actions. Auto-creates `sponsor_users` record from main contact on sponsor creation/update. Backfill endpoint creates missing contacts for existing sponsors. Backend: `GET /api/admin/sponsor-dashboards`, `POST /api/admin/sponsor-dashboards/send-access`, `POST /api/admin/sponsor-dashboards/backfill`.
- **Reporting**: Detailed meeting statistics and filterable tables with CSV export.
- **Data Exchange Module**: Centralized `/admin/data-exchange` for CSV import/export of Sponsors, Attendees, and Meetings, including Nunify Meeting Sync.
- **Backup & Restore Architecture**: R2 backups now use timestamped folder structure (`backups/full/{ts}/`, `backups/events/{code}/{ts}/`, `backups/sponsors/{code}/{slug}/{ts}/`) with manifest.json alongside data files (database.json, file-metadata.json). Schema versioning tracked in `backupJobs.schemaVersion`. Restore validation service (`server/services/restoreValidationService.ts`) checks manifest structure, file presence, schema compatibility, and payload shape. Dry-run restore service (`server/services/restoreImportService.ts`) simulates restore with entity counts, restore order, and conflict detection. Admin UI at Data Backup page has "Backup History" and "Restore Tools" tabs. API endpoints: `GET /api/admin/backups/:id/detail`, `POST /api/admin/backups/:id/validate`, `POST /api/admin/backups/:id/dry-run`. Production restore is disabled; tools verify restore readiness only.
- **Access Control**: Granular, per-user permission system replacing broad role flags.
- **Email Integration**: Transactional emails via Brevo for confirmations and info requests. An Admin Email Center provides an audit log, resend functionality, and DB-backed template management with delivery tracking. Automated meeting reminders are sent 24h and 2h before meetings. Email Center Templates tab features per-row Send Test Email button (flask icon) with dialog, and preview renders the actual code-rendered template (with "Preview Source" label showing Code-Rendered vs Custom HTML).
- **Password Recovery**: Token-based password reset with Brevo email delivery and rate limiting.
- **Sponsor Magic Login**: Email-based magic link authentication for sponsors. All email URLs use centralized `getAppBaseUrl()` helper (in `server/routes.ts`) which checks: 1) `appBaseUrl` from branding settings, 2) `REPLIT_DOMAINS` (deployed), 3) `REPLIT_DEV_DOMAIN` (dev), 4) hardcoded fallback. Production URL is admin-configurable via Branding → Identity → Production URL field. Magic auth route has comprehensive error handling with branded error messages on the sponsor login page.
- **Agreement Deliverables Module**: Full lifecycle management for sponsorship agreement deliverables, including templates, sponsor-specific instances, and an admin UI for management. Features a sponsor portal for input and tracking, automated reminders for outstanding items, and Replit Object Storage (GCS-backed) file attachments with presigned upload/download URLs. Admins have a Files & Links tab per agreement; sponsors can upload files for `file_upload`-type deliverables. File metadata stored in `file_assets` table; deliverable links stored in `deliverable_links` table. Phase 6 additions: help content (helpTitle/helpText/helpLink) on template items and deliverables; registrationAccessCode/Instructions on deliverables; firstName/lastName/conciergeRole/registrationStatus on registrants; sessionType/sessionTitle on speakers; `deliverableSocialEntries` table for social graphics/announcements; `internalNotificationEmail` on AppBranding for admin alerts on sponsor submissions; attendee CSV export endpoint at `/api/admin/attendee-csv`.
- **Sponsor Fulfillment Queue**: Operational admin view under Deliverables → Fulfillment Queue tab. Shows ALL deliverables across all sponsors and events in a flat operational table. Features: 6 summary cards (Open, Awaiting Sponsor, Awaiting Converge, Overdue, Compliance, Due This Week), 7 quick-filter presets (All, Awaiting Sponsor, Awaiting Converge, Overdue, Compliance, Post-Event, This Week), collapsible filter panel (event/sponsor/level/category/owner/status/due-timing/overdue/never-reminded), search, inline status editing (click status badge to change), row expand for detail view, bulk selection with bulk actions (Send Grouped Reminder, Mark In Progress, Mark Delivered, Mark Awaiting Sponsor), CSV export. Bulk reminders group by sponsor+event to send one email per pair. Dashboard alerts deep-link into queue with preset applied. Backend: `/api/agreement/fulfillment-queue`, `/api/agreement/fulfillment-queue/bulk-status`, `/api/agreement/fulfillment-queue/bulk-remind`.
- **Meeting Conflict Detection**: Checks sponsor, attendee, and location conflicts during meeting creation/update.
- **Event-Scoped Admin Dashboard**: Dashboard KPIs and alerts are filtered by selected event.
- **Sponsor Dashboard**: Redesigned with a 6-tab layout for Overview, Meetings, Info Requests, Leads, Deliverables, and Reports. Phase 6 Deliverables tab upgrade: structured type-specific UI for Company Description (word-counted textarea with 1000-word limit), Sponsor Representatives (multi-person form with registration status badges), Category Tags (hybrid tag selector for 3-word selection), Registrations (access code display, instructions, PDF download, seats remaining), Social Graphics (thumbnails, download, LinkedIn sharing guide), Social Announcements (URL links with View & Share), COI (status-only badges), Legacy Intro (informational banner), plus help/info popovers for deliverables with helpTitle/helpText.
- **Public Scheduling Flow**: Distinct "Onsite" and "Online request" flows available at `/event/:slug`.
- **Calendar Integration**: ICS file generation, Google Calendar URL, and Outlook URL for meetings.
- **Branding**: Public endpoint for displaying `appLogoUrl` and `appName`.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy.
- **Eventzilla Webhook**: Integration for attendee registration events.
- **Demo Environment**: Full setup and update guide at `docs/demo-environment-setup.md`. Controlled by `APP_ENV=demo` env var. Features: email suppression (external emails logged but not sent; internal @convergeevents.com/@converge.com allowed), R2 storage prefix `demo/` for isolation, Eventzilla webhook blocking, admin demo tools (Settings page → Demo Environment Tools section with reset button, data counts, quick login credentials). Demo seed script at `scripts/seedDemoEnvironment.ts` follows the Demo Data Blueprint — creates 3 named events (DEMOFRC2026, DEMOUSBT2026, DEMOTLS2026), 12 named sponsors with specific level/event assignments and engagement profiles (high/moderate/low), 90 attendees with realistic fintech titles and companies, sponsor users/reps, meetings with varied statuses, info requests, deliverables with mixed completion states (16 deliverable types per sponsor), email logs, and backup job records. Multi-event sponsors: FuturePay (FRC+USBT), CloudTreasury (TLS+FRC). Seed is deterministic and idempotent (clears + reseeds). Script requires APP_ENV=demo or --force flag. Demo mode service at `server/services/demoModeService.ts`. Demo banner component at `client/src/components/DemoBanner.tsx` shows amber bar when in demo mode. API: `GET /api/app-env` (public), `GET /api/admin/demo/status` (admin), `POST /api/admin/demo/reset` (admin, with concurrency lock).

## External Dependencies

- **PostgreSQL**: Primary database.
- **Cloudflare R2**: For backup storage (via S3-compatible API) and file assets. Env vars: `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.
- **Replit App Storage**: For image uploads.
- **TanStack Query**: Frontend server state management.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Styling.
- **Framer Motion**: Animations.
- **express-session**: Session management.
- **connect-pg-simple**: PostgreSQL session store.
- **Drizzle ORM**: TypeScript ORM.
- **Vite**: Frontend build tool.
- **Wouter**: React routing library.
- **Brevo (sib-api-v3-sdk)**: Transactional email service.