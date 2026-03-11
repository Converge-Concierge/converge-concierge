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
- **Key Entities**: `events`, `sponsors`, `attendees`, `meetings`, `PasswordResetToken`, `SponsorNotification`, `sponsorUsers`, `sponsorLoginTokens`.
- **Sponsorship Level**: Per-event, stored in `sponsors.assignedEvents` JSONB.
- **Event Scheduling Logic**: Includes conflict detection, cascade archiving/unarchiving, and attendee resolution. Features per-event scheduling shutoff (`schedulingEnabled`, `schedulingShutoffAt`) with external handoff options.
- **Event Management**: Admin panel supports comprehensive CRUD operations, including a `MeetingBlocksEditor` and event cloning (`POST /api/events/:id/copy`) with options to copy sponsors.
- **Attendee Management**: Enhanced module with `createdAt`/`updatedAt` timestamps, `interests` array, and `notes` field. Admin table includes `AttendeeDetailDrawer` for full profile and activity. Email-based attendee prefill (`POST /api/attendees/prefill-lookup`) is integrated into booking wizards.
- **Sponsor Management**: Sponsor profile pages and a dashboard with notifications, meeting status updates, and lead contact management. Sponsor-specific meeting block controls allow for custom block access per event.
- **Reporting**: Detailed meeting statistics and filterable tables with CSV export.
- **Data Exchange Module**: Centralized `/admin/data-exchange` for CSV import/export of Sponsors, Attendees, and Meetings with validation, preview, and audit logging. Includes Nunify Meeting Sync for event-specific import/export.
- **Access Control**: Per-user permission system (`/admin/access-control`) replacing broad role flags, with detailed module and entity-level permissions.
- **Email Integration**: Transactional emails sent via Brevo for meeting confirmations and info requests. An Admin Email Center (`/admin/email-center`) provides an audit log, resend functionality, and test email capabilities. Meeting emails include ICS calendar attachments and Google Calendar/Outlook links.
- **Password Recovery**: Token-based password reset with real Brevo email delivery. Rate-limited (3/15 min). Dedicated pages at `/admin/forgot-password` and `/admin/reset-password`. Password strength enforced (8+ chars, upper/lower/number).
- **Sponsor Magic Login**: Email-based magic link authentication for sponsors. Admin can send dashboard access email from sponsor edit modal ("Send Dashboard Access" button). `POST /api/sponsor/login-request` + `GET /api/sponsor/auth/magic?token=` flow. Login tokens stored as SHA-256 hashes with 24h expiry.

### Feature Specifications

- **Public Scheduling Flow**: Two distinct flows at `/event/:slug`: Onsite (5 steps) and Online request (6 steps).
- **Admin Panel**: Comprehensive CRUD for all entities, specialized pages for reports, bulk actions, and system configuration.
- **Sponsor Features**: Sponsor dashboard with notifications, meeting status updates, and CSV export. Magic link login via email (no password required). Admin can send access emails from sponsor edit modal; last login shown on sponsor contact card.
- **Calendar Integration**: ICS file generation, Google Calendar URL, and Outlook URL via `services/calendarService.js`. Meeting confirmation emails include ICS attachment + calendar link buttons.
- **Branding**: Public branding endpoint for displaying `appLogoUrl` and `appName`.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy.
- **Eventzilla Webhook**: `POST /api/integrations/eventzilla/registration` for attendee registration events.

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