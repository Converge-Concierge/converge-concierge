# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform designed for booking meetings between attendees and sponsors at various events. It features a public-facing site for event browsing and booking, and a comprehensive admin panel for managing events, sponsors, attendees, meetings, reports, and users. The platform aims to provide a robust and intuitive solution for event scheduling, including a multi-step booking wizard, detailed management functionalities, and comprehensive reporting.

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
- **Sponsor Management**: Sponsor profile pages, dashboard with notifications, meeting status updates, and lead contact management. Supports multi-user sponsor access with different access levels.
- **Reporting**: Detailed meeting statistics and filterable tables with CSV export.
- **Data Exchange Module**: Centralized `/admin/data-exchange` for CSV import/export of Sponsors, Attendees, and Meetings, including Nunify Meeting Sync.
- **Access Control**: Granular, per-user permission system replacing broad role flags.
- **Email Integration**: Transactional emails via Brevo for confirmations and info requests. An Admin Email Center provides an audit log, resend functionality, and DB-backed template management with delivery tracking. Automated meeting reminders are sent 24h and 2h before meetings.
- **Password Recovery**: Token-based password reset with Brevo email delivery and rate limiting.
- **Sponsor Magic Login**: Email-based magic link authentication for sponsors.
- **Agreement Deliverables Module**: Full lifecycle management for sponsorship agreement deliverables, including templates, sponsor-specific instances, and an admin UI for management. Features a sponsor portal for input and tracking, automated reminders for outstanding items, and Replit Object Storage (GCS-backed) file attachments with presigned upload/download URLs. Admins have a Files & Links tab per agreement; sponsors can upload files for `file_upload`-type deliverables. File metadata stored in `file_assets` table; deliverable links stored in `deliverable_links` table. Phase 6 additions: help content (helpTitle/helpText/helpLink) on template items and deliverables; registrationAccessCode/Instructions on deliverables; firstName/lastName/conciergeRole/registrationStatus on registrants; sessionType/sessionTitle on speakers; `deliverableSocialEntries` table for social graphics/announcements; `internalNotificationEmail` on AppBranding for admin alerts on sponsor submissions; attendee CSV export endpoint at `/api/admin/attendee-csv`.
- **Meeting Conflict Detection**: Checks sponsor, attendee, and location conflicts during meeting creation/update.
- **Event-Scoped Admin Dashboard**: Dashboard KPIs and alerts are filtered by selected event.
- **Sponsor Dashboard**: Redesigned with a 6-tab layout for Overview, Meetings, Info Requests, Leads, Deliverables, and Reports.
- **Public Scheduling Flow**: Distinct "Onsite" and "Online request" flows available at `/event/:slug`.
- **Calendar Integration**: ICS file generation, Google Calendar URL, and Outlook URL for meetings.
- **Branding**: Public endpoint for displaying `appLogoUrl` and `appName`.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy.
- **Eventzilla Webhook**: Integration for attendee registration events.

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