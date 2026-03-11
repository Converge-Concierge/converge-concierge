# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform designed exclusively for event scheduling. Its primary purpose is to facilitate the booking of meetings between attendees and sponsors for various events. The platform features a public-facing site for event browsing and booking, and a comprehensive admin panel for managing events, sponsors, attendees, meetings, reports, and users. The project aims to streamline the event scheduling process with a robust and intuitive solution, offering capabilities such as a multi-step booking wizard, detailed event and sponsor management, and comprehensive reporting.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture

The platform employs a modern web stack with a clear separation between frontend and backend. The backend is built with Express.js and TypeScript, utilizing PostgreSQL as the primary database with Drizzle ORM. The frontend is a React single-page application, using Vite for building, Wouter for routing, and TanStack Query for state management. Shadcn/ui and Tailwind CSS are used for UI components and styling. File uploads are handled via Replit App Storage.

### Frontend Details

- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter.
- **State Management**: TanStack Query v5 for server state.
- **UI/UX**: shadcn/ui components (New York style) with Radix UI primitives. Styling uses Tailwind CSS, a custom fintech color palette, and `Plus Jakarta Sans` and `Outfit` fonts. Framer Motion is used for animations.
- **UI/UX Decisions**: Event-specific theming supports dynamic `accentColor` and `buttonColor`. Logos are displayed based on branding settings. Public scheduling flows include "Onsite" (5 steps) and "Online request" (6 steps) with conflict detection and attendee resolution.

### Backend Details

- **Runtime**: Node.js with Express 5 and TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **File Uploads**: Replit App Storage.
- **Authentication**: Session-based authentication with `express-session` and `connect-pg-simple`.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `manager` roles.
- **Password Management**: Token-based password recovery.

### Shared & Data Models

- **Schema**: `shared/schema.ts` defines all data types and Drizzle table definitions.
- **Key Entities**: `events`, `sponsors`, `attendees`, `meetings`, `PasswordResetToken`, `SponsorNotification`, `sponsorUsers` (with `accessLevel` + `isPrimary`), `sponsorLoginTokens`, `emailTemplates`, `agreementPackageTemplates`, `agreementDeliverableTemplateItems`, `agreementDeliverables`.
- **Sponsorship Level**: Per-event, stored in `sponsors.assignedEvents` JSONB.
- **Event Scheduling Logic**: Includes conflict detection, cascade archiving/unarchiving, and attendee resolution. Features per-event scheduling shutoff (`schedulingEnabled`, `schedulingShutoffAt`) with external handoff options.
- **Event Management**: Admin panel supports comprehensive CRUD operations, including a `MeetingBlocksEditor` and event cloning (`POST /api/events/:id/copy`) with options to copy sponsors.
- **Attendee Management**: Enhanced module with `createdAt`/`updatedAt` timestamps, `interests` array, and `notes` field. Admin table includes `AttendeeDetailDrawer` for full profile and activity. Email-based attendee prefill (`POST /api/attendees/prefill-lookup`) is integrated into booking wizards.
- **Sponsor Management**: Sponsor profile pages and a dashboard with notifications, meeting status updates, and lead contact management. Sponsor-specific meeting block controls allow for custom block access per event.
- **Reporting**: Detailed meeting statistics and filterable tables with CSV export.
- **Data Exchange Module**: Centralized `/admin/data-exchange` for CSV import/export of Sponsors, Attendees, and Meetings with validation, preview, and audit logging. Includes Nunify Meeting Sync for event-specific import/export.
- **Access Control**: Per-user permission system (`/admin/access-control`) replacing broad role flags, with detailed module and entity-level permissions.
- **Email Integration**: Transactional emails sent via Brevo for meeting confirmations and info requests. An Admin Email Center (`/admin/email-center`) provides an audit log, resend functionality, and test email capabilities. Meeting emails include ICS calendar attachments and Google Calendar/Outlook links. The Email Center includes a **Templates tab** with DB-backed template management — list/edit/preview (iframe with sample data substitution)/send-test for 9 core templates seeded via `server/email-template-seeder.ts`. Templates stored in `emailTemplates` table. Info request confirmation subject includes sponsor name. **Email Delivery Tracking**: `email_logs` table extended with `providerMessageId`, `deliveredAt`, `openedAt`, `clickedAt`, `bouncedAt`, `bounceReason`, `providerStatus` fields. Brevo messageId captured from API response in `sendAndLog`. `POST /api/webhooks/brevo` endpoint updates log status on delivery events (delivered/opened/clicked/bounced/blocked). Email Center detail drawer shows a delivery timeline panel.
- **Meeting Reminders**: Automated reminder emails sent 24h and 2h before meetings. `reminder24SentAt` and `reminder2SentAt` fields on meetings table prevent duplicate sends. `server/reminder-service.ts` runs a `setInterval` job every 10 minutes via `startReminderJob()`. Sends to both attendee and sponsor. Two new seeded templates: `meeting_reminder_24`, `meeting_reminder_2`.
- **Password Recovery**: Token-based password reset with real Brevo email delivery. Rate-limited (3/15 min). Dedicated pages at `/admin/forgot-password` and `/admin/reset-password`. Password strength enforced (8+ chars, upper/lower/number).
- **Sponsor Magic Login**: Email-based magic link authentication for sponsors. Admin can send dashboard access email from sponsor edit modal ("Send Dashboard Access" button). `POST /api/sponsor/login-request` + `GET /api/sponsor/auth/magic?token=` flow. Login tokens stored as SHA-256 hashes with 24h expiry.

### Feature Specifications

- **Meeting Conflict Detection**: POST/PATCH `/api/meetings` checks sponsor, attendee, and location conflicts in parallel. Returns 409 with descriptive messages ("This attendee already has a meeting at this time.", "This location is already booked at this time."). Location conflict only checked for onsite meetings with a location set.
- **Event-Scoped Admin Dashboard**: `/admin/dashboard` has an event selector dropdown. All KPIs, alerts, and meeting counts are filtered by `selectedEventId` when not "All Events". Context banner shown when event is selected.
- **Sponsor Dashboard Tabs**: `SponsorDashboardPage.tsx` redesigned with 6-tab layout: Overview | Meetings | Info Requests | Leads | Deliverables | Reports. Sponsor/event header always visible above tabs. All existing functionality preserved with unchanged permission logic.
- **Sponsor Access Link Renewal**: `/sponsor/login` email form copy updated to clarify renewal use case. Token form includes "Link expired? Switch to email above." inline link.
- **Public Scheduling Flow**: Two distinct flows at `/event/:slug`: Onsite (5 steps) and Online request (6 steps).
- **Admin Panel**: Comprehensive CRUD for all entities, specialized pages for reports, bulk actions, and system configuration.
- **Sponsor Features**: Sponsor dashboard with notifications, meeting status updates, and CSV export. Magic link login via email (no password required). Admin can send access emails from sponsor edit modal; last login shown on sponsor contact card. **Multi-User Sponsor Access**: `sponsorUsers` table extended with `accessLevel` ("owner"|"editor"|"viewer") and `isPrimary` (bool). Admin → Sponsors page has "Manage Users" button per sponsor row that opens `SponsorUsersModal` (CRUD, per-user magic link, set-primary). Export buttons (CSV/PDF) on sponsor dashboard are hidden for non-primary-owner users; `GET /api/sponsor-dashboard/me` returns user context. `GET /api/sponsor-report/pdf` enforces primary-owner-only server-side. Backward compatible: sponsors with no users configured get full access.
- **Calendar Integration**: ICS file generation, Google Calendar URL, and Outlook URL via `services/calendarService.js`. Meeting confirmation emails include ICS attachment + calendar link buttons.
- **Branding**: Public branding endpoint for displaying `appLogoUrl` and `appName`.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy.
- **Eventzilla Webhook**: `POST /api/integrations/eventzilla/registration` for attendee registration events.
- **Agreement Deliverables Module (Phase 2 — Sponsor Portal)**: `SponsorDeliverablesTab.tsx` at `client/src/components/sponsor/`. Summary cards (Total, Delivered, In Progress, Awaiting Your Input + after-event note + progress bar). "Action Required From You" section surfacing `sponsorEditable=true` items with `Awaiting Sponsor Input|Not Started|Needed|Issue Identified|Blocked` statuses. All deliverables grouped by category (7 categories). Three inline editor types: text editor (free-form, used for Company Description/categories), registrant list editor (used for `fulfillmentType=quantity_progress` — name/title/email repeatable rows), speaker editor (used for `Speaking & Content` category — name/title/bio). COI/Compliance items shown status-only, no edit UI. Status auto-updated on save (e.g., "Submitted" after save). Internal notes never exposed to sponsor. Role enforcement: `canEdit` prop from `meData.sponsorUser.accessLevel` — Owner/Editor see edit buttons, Viewer sees read-only. New API endpoints: `GET /api/sponsor-dashboard/agreement-deliverables` (returns sponsor-visible deliverables + child registrants/speakers, strips internalNote), `PATCH /api/sponsor-dashboard/agreement-deliverables/:id`, `GET|POST|PATCH|DELETE /api/sponsor-dashboard/agreement-deliverables/:id/registrants`, `GET|POST|PATCH|DELETE /api/sponsor-dashboard/agreement-deliverables/:id/speakers`. Two new DB tables: `agreement_deliverable_registrants` (id, agreementDeliverableId, name, title, email), `agreement_deliverable_speakers` (id, agreementDeliverableId, speakerName, speakerTitle, speakerBio).
- **Agreement Deliverables Module (Phase 3 — Outstanding Items & Reminders)**: `agreement_deliverable_reminders` DB table logs all sent reminders (sponsorId, eventId, recipientEmail, reminderType, sentByRole, status, deliverableCount). `reminderEligible` boolean column on both `agreement_deliverable_template_items` (default true) and `agreement_deliverables` (default true). **Outstanding Items tab** in `/admin/agreement` shows sponsor-responsible incomplete deliverables grouped by sponsor+event with stat cards (total/overdue/sponsors affected), search/filter/overdue-only controls, per-group Send Reminder button (count of eligible items, 6-day cooldown), and View link to sponsor detail. **API endpoints**: `GET /api/agreement/outstanding-items` (filterable: eventId, sponsorId, category, overdueOnly, reminderEligibleOnly), `GET /api/agreement/outstanding-summary` (total/overdueCount/sponsorCount for dashboard), `POST /api/agreement/reminders/send` (sends email + logs to DB), `GET /api/agreement/reminders` (reminder history, filterable). **Sponsor Agreement Detail improvements**: "Send Reminder" button in header, "Reminder History" section in Overview tab showing past sends with type/count/status, "Sponsor Inputs" tab (was stub, now shows sponsor-editable outstanding items split into Action Required / Completed). **Admin Dashboard**: Needs Attention section shows outstanding deliverables alert with sponsor count and link to Outstanding Items tab. **Weekly automated reminders**: `runWeeklyDeliverableReminders()` in `reminder-service.ts` fires Tuesday 8–10am UTC (hourly check), sends to sponsors with outstanding reminder-eligible items, skips if reminder sent within 6 days. Email template `deliverableReminderEmail()` in `services/emailTemplates.js` renders grouped item table. `getSponsorUsersBySponsor()` used to find primary contact; `sponsor.contactEmail` used as fallback.
- **Agreement Deliverables Module (Phase 1)**: Full lifecycle management for sponsorship agreement deliverables. Three DB tables: `agreementPackageTemplates` (reusable per-level templates), `agreementDeliverableTemplateItems` (categorized items per template), `agreementDeliverables` (sponsor-specific instances). Admin UI at `/admin/agreement` with tabs: Package Templates (CRUD + archive + duplicate), Sponsor Agreements (summary view with completion stats), Outstanding Items. Package template editor at `/admin/agreement/package-templates/:id` with categorized item tables (8 categories: Company Profile, Branding & Visibility, Content Creation, Speaking & Programming, Event Experience, Lead Generation, Post-Event, Compliance). Sponsor agreement detail at `/admin/agreement/sponsor-agreements/:sponsorId/:eventId` with Overview + Deliverables + Sponsor Inputs tabs, inline edit/delete/reset per deliverable, custom deliverable creation, and regenerate-from-template. API endpoints: `GET|POST /api/agreement/package-templates`, `PATCH|POST|DELETE /api/agreement/package-templates/:id`, `GET /api/agreement/deliverables` (summaries), `GET /api/agreement/deliverables/detail` (per sponsor+event), `POST /api/agreement/generate`, `POST /api/agreement/generate/regenerate`, `POST /api/agreement/deliverables/:id/reset`, `POST /api/agreement/seed-templates` (idempotent). Seeded FRC 2026 Platinum/Gold/Silver/Bronze templates with 11–14 items each.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Replit App Storage**: For file uploads.
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