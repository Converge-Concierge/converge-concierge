# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform focused exclusively on event scheduling. It facilitates the booking of meetings between attendees and sponsors for various events. The platform comprises a public-facing site for event browsing and booking, and a comprehensive admin panel for managing events, sponsors, attendees, meetings, reports, and users.

The project's vision is to streamline the event scheduling process, providing a robust and intuitive solution for both event organizers and participants. Its key capabilities include a multi-step booking wizard, detailed event and sponsor management, and comprehensive reporting features.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture

The platform uses a modern web stack with a clear separation between frontend and backend. The backend is built with Express.js and TypeScript, using PostgreSQL as the primary database with Drizzle ORM for data access. The frontend is a React single-page application, leveraging Vite for build, Wouter for routing, and TanStack Query for state management. Shadcn/ui and Tailwind CSS are used for UI components and styling, ensuring a consistent and themeable design. File uploads are handled via Replit App Storage.

### Frontend Details

- **Framework**: React 18 with TypeScript and Vite.
- **Routing**: Wouter, utilizing absolute paths for navigation.
- **State Management**: TanStack Query v5 for server state, local React state for UI.
- **UI/UX**: shadcn/ui components (New York style) with Radix UI primitives.
- **Styling**: Tailwind CSS, custom fintech color palette (deep navy, teal accent), with `Plus Jakarta Sans` and `Outfit` fonts.
- **Animations**: Framer Motion for page transitions and micro-interactions.
- **UI/UX Decisions**: Event-specific theming allows for `accentColor` and `buttonColor` to be applied dynamically to various UI elements. Logos can be displayed based on branding settings.

### Backend Details

- **Runtime**: Node.js with Express 5 and TypeScript.
- **Database**: PostgreSQL with Drizzle ORM (`DatabaseStorage`).
- **File Uploads**: Integration with Replit App Storage for file persistence.
- **Authentication**: Session-based authentication using `express-session` and `connect-pg-simple` for a PostgreSQL-backed session store.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `manager` roles, enforced via middleware.
- **Password Management**: Includes a password recovery flow with token-based reset functionality.

### Shared & Data Models

- **Schema**: `shared/schema.ts` defines all data types and Drizzle table definitions, serving as a single source of truth.
- **Key Entities**: `events`, `sponsors`, `attendees`, `meetings`, `PasswordResetToken`, `SponsorNotification`.
- **Sponsorship Level**: Per-event. Stored in `sponsors.assignedEvents` JSONB as `EventSponsorLink.sponsorshipLevel`. The global `sponsors.level` column is nullable (kept for fallback only). Admin form shows per-event level dropdowns replacing the old global dropdown.
- **Event Scheduling Logic**: Includes conflict detection for meeting slots, cascade archiving/unarchiving of related records (attendees, meetings) based on event status, and attendee resolution logic (lookup, reactivation, creation).
- **Per-Event Scheduling Shutoff**: `schedulingEnabled` (bool), `schedulingShutoffAt` (timestamp), `externalSchedulingLabel/Url/Message` fields on events. EventPage shows blue external-handoff banner + CTA button when disabled+URL set. LandingPage shows "Coming Soon" badge on cards with no active sponsors (non-clickable).
- **Event Website URL**: `events.websiteUrl` column. Editable in admin EventFormModal. Public EventPage header shows "Event Website" link using this value (falls back to hardcoded domain map by slug prefix if field is empty).
- **Event Logo in Admin Table**: EventTable shows small logo thumbnail (32px) to left of event name — image if uploaded, or initials/icon placeholder.
- **Multi-Level Sponsor Display**: SponsorsTable Level column shows per-event breakdown (slug + badge per row) when a sponsor has different sponsorship levels across events. Single badge shown when all levels are the same.
- **Password Reset Recovery**: Forgot-password flow always advances to the token entry step (never a misleading "check your email" dead-end, since no SMTP is configured). Token is shown directly in the UI. Server logs every reset token generation to console for deployment log visibility.
- **Event Cloning**: `POST /api/events/:id/copy` with `{ copySponsors }` body. Copies name, location, branding, meeting config, scheduling settings. Admin Events table has Copy icon button → AlertDialog with "Copy with sponsors" / "Copy without sponsors" → opens new event in edit modal.

### Feature Specifications

- **Public Scheduling Flow**: Two distinct flows at `/event/:slug`. **Onsite** (5 steps): sponsor → event date cards → time slot cards → attendee info → confirm. **Online request** (6 steps): sponsor → free-form date picker (any date, not restricted to event days) → free-form time picker → platform selection (Zoom/Teams/Google Meet/No Preference) → attendee info → confirm. Online requests are stored with status "Pending" and must be confirmed/declined by the sponsor in the Sponsor Dashboard.
- **Admin Panel**: Comprehensive CRUD operations for all entities (Events, Sponsors, Attendees, Meetings, Users). Includes specialized pages for reports, bulk actions, and system configuration. Meeting blocks in the Event editor support add, edit (inline — changes start/end time without deleting+recreating, preserving existing bookings), and delete operations via the `MeetingBlocksEditor` component.
- **Sponsor Features**: Sponsor profile pages (`/event/:slug/sponsor/:sponsorId`), sponsor dashboard with notifications, meeting status updates, lead contact management, and CSV export.
- **Reporting**: Detailed meeting statistics, breakdowns, and filterable tables with CSV export capabilities for various datasets (sponsor summary, attendee summary, all meetings).
- **Calendar Integration**: ICS file generation and Google Calendar integration for booked meetings.
- **Branding**: Public branding endpoint for displaying `appLogoUrl` and `appName` on public pages.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy, and a legal acknowledgment component integrated into booking forms.
- **Enhanced Attendees Module**: Attendee records now include `createdAt`/`updatedAt` timestamps, `interests` array, and `notes` field. The admin Attendees table defaults to newest-first sort order and shows an "Added" date column. Each row has an eye icon that opens a right-side `AttendeeDetailDrawer` showing: Basic Profile (all fields including phone, source, external IDs), Timestamps, Meeting Activity counts by status, full Meeting List (sponsor/event/date/time/type/status), Interests/Topics badges, and Notes. Interest topics selected on the public EventPage are automatically captured into the attendee record when a meeting is booked (deduplicated merge).
- **Data Exchange Module** (`/admin/data-exchange`): Centralized admin module for CSV import/export of Sponsors, Attendees, and Meetings. Each category supports: downloadable sample CSV templates, filtered export, and a multi-step import flow (upload → parse → validate → preview → confirm → results). Validation rejects rows with unknown eventCode, invalid email, bad status, etc. Duplicate-safe upsert logic per category. Rejected rows can be downloaded as a CSV with error reasons. Import/export activity is logged in the `data_exchange_logs` table and displayed in the page's Audit Log section.
- **Sponsor Dashboard Header**: Streamlined header card — branding strip (platform logo + event logo + event name/location) at top, main panel shows sponsor logo, name, level badge, description, event slug, date range, location, countdown pill, and website/linkedin links. Removed duplicated event name and mini event logo from the main panel. Countdown badge is now inline with the date row.
- **Admin Sponsors Table Level Pills**: Single-pill rows now wrapped in the same `flex flex-col gap-1.5 min-h-[32px] justify-center` container as multi-pill rows, ensuring clean vertical alignment regardless of single vs. multiple event assignments.
- **Sponsor-Specific Meeting Block Controls**: `EventSponsorLink` schema extended with `useDefaultBlocks: boolean` (default true) and `selectedBlockIds: string[]` (default []). Edit Sponsor modal now shows a "Meeting Block Access" section per event with "All event blocks" (default) or "Custom" toggle; Custom reveals a sorted checklist of the event's meeting blocks with checkboxes. EventPage scheduling respects sponsor's block access (`sponsorEffectiveBlocks` memo filters available dates and times). Server validates booking falls within allowed blocks for public onsite bookings.
- **Event Scheduling Page Hero Header**: Step 0 (sponsor selection) now uses a horizontal hero card matching the Welcome page visual style — event logo box (h-20 w-20 bordered) on left, bold event name + date range + location + website link on right. Intro copy is now always shown when scheduling is active (not gated by topic filter availability).
- **Email-Based Attendee Prefill**: `POST /api/attendees/prefill-lookup` with `{eventId, email}` — public endpoint, no auth required. Returns `{found, attendee: {attendeeId, firstName, lastName, email, company, title}}`. Scoped to current event. Used by `useAttendeePrefill` hook (`client/src/hooks/use-attendee-prefill.ts`). Wired into: (1) `RequestInfoModal` — email is first field, triggers lookup on blur, prefills empty fields, shows green "We found your registration" or neutral "couldn't find" banner; (2) EventPage booking wizard "Your Info" step (both onsite and online) — same email-first, blur-trigger, banner pattern. Server logs each lookup result with `[PREFILL LOOKUP]` prefix.
- **Eventzilla Webhook**: `POST /api/integrations/eventzilla/registration` accepts attendee registration events from Eventzilla. Authenticated via `x-converge-secret` header + `EVENTZILLA_WEBHOOK_SECRET` env var. Upserts attendees by email+event with `externalSource=eventzilla` and `externalRegistrationId` set.
- **Information Request Statuses**: `INFORMATION_REQUEST_STATUSES` extended to `["New","Open","Contacted","Email Sent","Meeting Scheduled","Closed","Not Qualified"]`. Sponsor-facing dropdown shows `SPONSOR_INFO_REQUEST_STATUSES`: `["Open","Email Sent","Meeting Scheduled","Closed","Not Qualified"]`. Legacy "New"/"Contacted" shown as read-only fallback if record has them.
- **Sponsor Dashboard UX**: Info Requests section expanded by default. KPI stat cards scroll to their respective sections. Header card shows branding logo + event logo strip. Inline status dropdown for info requests.
- **Welcome Page UX**: Registration confirmation badge larger with `animate-pulse`. "Next step:" label above CTA. "Request Information" button on each sponsor card (gated by `informationRequestEnabled` per-event flag), wired to `RequestInfoModal`.
- **Event Scheduling Page**: Removed inaccurate "30-minute private conversations" copy. Replaced with flexible scheduling copy.
- **Admin Dashboard**: 5th stat card for Info Requests (with open count). "Recent Info Requests" widget showing last 5 requests. "Meetings by Sponsor" bar chart widget. All widgets have "View all" links.


- **Nunify Meeting Sync** (inside Data Exchange → Nunify Meetings tab): Event-specific import/export in Nunify CSV format (Id,Title,Attendees,Attendees Emails,Date,Start Time,End Time,Meeting Room,Description,Status). Admin must select an event first. Export maps Concierge fields to Nunify columns with 20-minute interval end time calculation and status mapping. Push to Nunify Ready toggle filters export to meetings not yet exported. Meetings get nunifyExportedAt/nunifyExportedBy stamps after export. Import: upload → parse → validate → preview → confirm with rejection download. Audit log included. New meeting schema fields: nunifyExternalId, nunifyExportedAt, nunifyExportedBy.
- **Access Control** (/admin/access-control, admin-only): Per-user permission system replacing broad role flags. Two-panel layout: user list (left) + permission editor (right). Permission categories: Module Access, Events, Sponsors, Attendees, Meetings, Reports, Data Exchange, Branding, Settings, Users, Sensitive Data, Account Controls. Admin users have full automatic access and are read-only in this panel. All permission changes logged in permissionAuditLogs table with old/new values. GET /api/auth/me/permissions returns current user permissions. Access Control nav item appears in Management section for admin users only.

## External Dependencies

- **PostgreSQL**: Primary database for all application data and session storage.
- **Replit App Storage (Google Cloud Storage)**: Used for storing uploaded files (e.g., sponsor logos, event images).
- **TanStack Query**: For server state management and data fetching in the frontend.
- **shadcn/ui**: UI component library built on Radix UI primitives.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **Framer Motion**: Animation library for React.
- **express-session**: Middleware for session management.
- **connect-pg-simple**: PostgreSQL session store for `express-session`.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Vite**: Frontend build tool.
- **Wouter**: React routing library.