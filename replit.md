# Converge Concierge — Admin Platform

## Overview

Converge Concierge is a premium event management admin platform built for fintech and financial services conferences. It provides a centralized command center for managing events, sponsors, attendees, and 1:1 meeting scheduling between sponsors and attendees.

The app has two main surfaces:
- **Public Landing Page** — showcases upcoming events, links to login
- **Admin Panel** (`/admin/*`) — full CRUD management of Events, Sponsors, Attendees, and Meetings

The backend is an Express server with in-memory storage (MemStorage) that can be swapped for PostgreSQL via Drizzle ORM. The frontend is a React SPA using Vite, Wouter for routing, TanStack Query for server state, and shadcn/ui components styled with Tailwind CSS.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, built with Vite
- **Routing**: Wouter (lightweight client-side router). Admin nested routes are all handled inside `AdminLayout` via `/admin` and `/admin/:rest*` wildcard patterns. Use **absolute paths** for all Wouter links.
- **State management**: TanStack Query v5 for server state; local React state for UI/forms
- **UI components**: shadcn/ui ("new-york" style) on top of Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming. Custom professional fintech palette (deep navy primary, teal accent). Two fonts: `Plus Jakarta Sans` (body/sans) and `Outfit` (display).
- **Animations**: Framer Motion for entry animations and micro-interactions
- **Forms**: Controlled React state with manual validation (not react-hook-form in admin modals)

Key frontend directories:
- `client/src/pages/` — top-level page components (LandingPage, LoginPage, admin/*)
- `client/src/components/admin/` — admin-specific components (tables, form modals, editors)
- `client/src/components/ui/` — shadcn/ui component library (do not redesign these)
- `client/src/components/layout/` — AppSidebar and layout wrappers
- `client/src/lib/` — queryClient, utils

### Backend

- **Runtime**: Node.js with Express 5
- **Language**: TypeScript compiled with `tsx` in dev, esbuild for production
- **Entry**: `server/index.ts` → registers routes via `server/routes.ts`
- **Storage layer**: `server/storage.ts` defines `IStorage` interface. Current implementation is `MemStorage` (in-memory Maps). Drizzle ORM + PostgreSQL schema is defined and ready in `shared/schema.ts` for when a DB is provisioned.
- **Seeding**: `seedData()` in `server/routes.ts` populates events, sponsors, and attendees on first startup if empty
- **Static serving**: In production, serves built Vite output from `dist/public`

### Shared

- `shared/schema.ts` — single source of truth for all data types. Uses Drizzle ORM table definitions + `drizzle-zod` for insert schemas. Types exported for both frontend and backend.
- `shared/routes.ts` — shared route/URL utilities (currently minimal)

### Data Models (from `shared/schema.ts`)

| Entity | Key Fields |
|--------|-----------|
| `users` | id, username, password |
| `events` | id, name, slug, location, startDate, endDate, status, logoUrl, meetingLocations (JSONB), meetingBlocks (JSONB) |
| `sponsors` | id, name, logoUrl, level (Platinum/Gold/Silver/Bronze), assignedEvents (array of event IDs), status (active/archived) |
| `attendees` | id, name, company, title, email, assignedEvent |
| `meetings` | id, eventId, sponsorId, attendeeId, date, time, location, status (Scheduled/Completed/Cancelled/NoShow), notes |

### Admin Routing Structure

```
/admin                → Dashboard
/admin/events         → Events CRUD
/admin/sponsors       → Sponsors CRUD
/admin/attendees      → Attendees CRUD
/admin/meetings       → Meetings Scheduler
/admin/reports        → Reports (stub)
/admin/branding       → Branding (stub)
/admin/settings       → Settings (stub)
```

All admin pages live under `client/src/pages/admin/`. The sidebar is defined in `AppSidebar.tsx` — **do not redesign it**.

### Key Design Constraints

- **Do not change the LandingPage** (`/`)
- **Do not redesign the admin layout or sidebar**
- **Do not change the existing Events module** except to wire up sponsor/attendee/meeting relationships
- Preserve all existing working functionality
- Use existing schema and current styling patterns
- Meeting conflict detection: use `getMeetingConflict()` on the storage layer before saving

---

## External Dependencies

### Infrastructure
- **PostgreSQL** (via `DATABASE_URL` env var) — schema ready via Drizzle, currently using MemStorage fallback
- **Drizzle ORM** (`drizzle-orm`, `drizzle-zod`) — schema definition + query builder + Zod validation
- **Drizzle Kit** — migration management (`db:push` script, outputs to `./migrations/`)

### Frontend Libraries
- `@tanstack/react-query` v5 — data fetching and caching
- `wouter` — client-side routing
- `framer-motion` — animations
- `date-fns` — date formatting
- `lucide-react` — icon set
- `recharts` — chart components (used in Reports)
- `embla-carousel-react` — carousel
- `react-day-picker` — calendar/date picker
- `cmdk` — command palette
- `vaul` — drawer component
- `input-otp` — OTP input
- `react-resizable-panels` — resizable layout panels

### Radix UI Primitives (full suite)
Full set installed: accordion, alert-dialog, avatar, checkbox, collapsible, context-menu, dialog, dropdown-menu, hover-card, label, menubar, navigation-menu, popover, progress, radio-group, scroll-area, select, separator, slider, slot, switch, tabs, toast, toggle, toggle-group, tooltip

### Dev / Build
- `vite` + `@vitejs/plugin-react` — frontend build
- `tsx` — TypeScript execution for server dev
- `esbuild` — server production bundle
- `@replit/vite-plugin-runtime-error-modal` — dev error overlay
- `@replit/vite-plugin-cartographer` — Replit dev tooling
- `connect-pg-simple` — PostgreSQL session store (for future auth)
- `nanoid` — ID generation

### Google Fonts (loaded via CDN)
- Plus Jakarta Sans (body)
- Outfit (display/headings)
- DM Sans, Fira Code, Geist Mono, Architects Daughter (supplementary)