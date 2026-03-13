# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform designed for booking meetings between attendees and sponsors at various events. It provides a public-facing site for event browsing and booking, alongside a comprehensive admin panel for managing events, sponsors, attendees, meetings, reports, and users. The platform's core purpose is to streamline event scheduling, offering a multi-step booking wizard, detailed management functionalities, and extensive reporting capabilities to enhance the event experience for all stakeholders.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Core Architecture

The platform employs a modern web stack, separating frontend and backend concerns. The backend is developed with Express.js and TypeScript, utilizing PostgreSQL with Drizzle ORM. The frontend is a React single-page application, built with Vite, using Wouter for routing and TanStack Query for state management. UI components and styling are provided by Shadcn/ui and Tailwind CSS.

### Frontend Details

- **Technology**: React 18 with TypeScript, Vite, Wouter for routing, TanStack Query v5 for server state.
- **UI/UX**: shadcn/ui components (New York style) with Radix UI primitives, Tailwind CSS for styling, a custom fintech color palette, and `Plus Jakarta Sans` and `Outfit` fonts. Framer Motion is used for animations. Event-specific theming supports dynamic `accentColor` and `buttonColor`. Public scheduling flows include "Onsite" and "Online request" with conflict detection.

### Backend Details

- **Technology**: Node.js with Express 5 and TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.
- **File Uploads**: Replit App Storage.
- **Authentication**: Session-based authentication using `express-session` and `connect-pg-simple`.
- **Authorization**: Role-Based Access Control (RBAC) with `admin` and `manager` roles.
- **Password Management**: Token-based password recovery.

### Key Features and Modules

- **Data Models**: Defined in `shared/schema.ts`, covering `events`, `sponsors`, `attendees`, and `meetings`.
- **Event Scheduling**: Includes conflict detection, cascade archiving/unarchiving, attendee resolution, per-event scheduling shutoff, and external handoff options.
- **Attendee Management**: Features interest tracking, notes, category classification, and a DB-driven category rules engine for dynamic attendee categorization and matchmaking weights.
- **Sponsor Management**: Includes sponsor profile pages, a dashboard with notifications, meeting status updates, lead contact management, and multi-user access.
- **Reporting**: Provides detailed meeting statistics and filterable tables with CSV export.
- **Data Exchange**: Centralized module for CSV import/export of Sponsors, Attendees, and Meetings, including Nunify Meeting Sync.
- **Backup & Restore**: Architecture for R2 backups with timestamped folders and manifest files. Restore validation and dry-run services are available, with production restore disabled.
- **Access Control**: Granular, per-user permission system with over 100 boolean flags across 19 categories, including role presets and an audit log.
- **Email Integration**: Transactional emails via Brevo for confirmations, info requests, and automated meeting reminders. An Admin Email Center offers an audit log, resend functionality, and DB-backed template management.
- **Sponsor Magic Login**: Email-based magic link authentication for sponsors, with comprehensive error handling and branded messages.
- **Agreement Deliverables**: Full lifecycle management for sponsorship deliverables, including templates, sponsor-specific instances, an admin UI, a sponsor portal for input and tracking, automated reminders, and file attachments via Replit Object Storage. The **Sponsor Fulfillment Queue** provides an operational view for managing deliverables across all sponsors and events.
- **Sponsor/Attendee Matchmaking & Meeting Invitations**: Sponsors can discover and invite attendees to meetings based on category weights, interest overlap, and role seniority, controlled by event-specific flags and quotas. Attendees can accept/decline invitations via secure token links.
- **Meeting Conflict Detection**: Ensures no conflicts for sponsors, attendees, and locations during meeting creation/updates.
- **Event-Scoped Admin Dashboard**: KPIs and alerts are filtered by the selected event.
- **Sponsor Dashboard**: Redesigned with a 6-tab layout (Overview, Meetings, Info Requests, Leads, Deliverables, Reports) and structured UIs for various deliverable types.
- **Public Scheduling Flow**: Distinct "Onsite" and "Online request" flows available at `/event/:slug`.
- **Calendar Integration**: ICS file generation, Google Calendar URL, and Outlook URL for meetings.
- **Branding**: Public endpoint for `appLogoUrl` and `appName`.
- **Legal**: Dedicated pages for Terms of Use and Privacy Policy.
- **Eventzilla Webhook**: Integration for attendee registration events.
- **Demo Environment**: Controlled by `APP_ENV=demo`, includes email suppression, R2 storage isolation, webhook blocking, admin demo tools, and a deterministic seeding script for realistic demo data.

## External Dependencies

- **PostgreSQL**: Primary database.
- **Cloudflare R2**: For backup storage and file assets (via S3-compatible API).
- **Replit App Storage**: For image uploads.
- **TanStack Query**: Frontend server state management.
- **shadcn/ui**: UI component library.
- **Tailwind CSS**: Styling framework.
- **Framer Motion**: Animation library.
- **express-session**: Session management middleware.
- **connect-pg-simple**: PostgreSQL session store for `express-session`.
- **Drizzle ORM**: TypeScript ORM for PostgreSQL.
- **Vite**: Frontend build tool.
- **Wouter**: React routing library.
- **Brevo (sib-api-v3-sdk)**: Transactional email service.