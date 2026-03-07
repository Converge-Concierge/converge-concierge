# Converge Concierge — Event Scheduling Platform

## Overview

Converge Concierge is a fintech event scheduling platform operating in **scheduling-only mode** (no matchmaking, no approval workflows, no preference matching). It has two main surfaces:

- **Public site** — landing page → event page → multi-step booking wizard (sponsor → date → time → attendee details → confirmation)
- **Admin panel** (`/admin/*`) — full management of Events, Sponsors, Attendees, Meetings, Reports, and Users (admin-only)

Backend: Express + in-memory storage (MemStorage). Frontend: React SPA with Vite, Wouter, TanStack Query v5, shadcn/ui, Tailwind CSS, Framer Motion.

---

## User Preferences

Preferred communication style: Simple, everyday language.

---

## System Architecture

### Frontend

- **Framework**: React 18 with TypeScript, Vite
- **Routing**: Wouter — admin nested routes handled inside `AdminLayout` via `/admin` and `/admin/:rest*`. Use **absolute paths** for all Wouter links.
- **State management**: TanStack Query v5; local React state for UI/forms
- **UI components**: shadcn/ui ("new-york" style) on Radix UI primitives
- **Styling**: Tailwind CSS + CSS variables. Custom fintech palette (deep navy primary, teal accent). Fonts: `Plus Jakarta Sans` (body) and `Outfit` (display).
- **Animations**: Framer Motion for page transitions and micro-interactions

Key frontend directories:
- `client/src/pages/` — LandingPage, LoginPage, `admin/`, `public/`
- `client/src/pages/public/` — EventPage.tsx (full 5-step booking wizard)
- `client/src/components/admin/` — admin tables, form modals, editors
- `client/src/components/ui/` — shadcn/ui library (do not redesign)
- `client/src/components/layout/` — AppSidebar

### Backend

- **Runtime**: Node.js + Express 5, TypeScript via `tsx`
- **Entry**: `server/index.ts` → `server/routes.ts`
- **Storage**: `server/storage.ts` — `IStorage` interface, `MemStorage` implementation (in-memory Maps). Drizzle ORM + PostgreSQL schema defined and ready in `shared/schema.ts`.
- **Seeding**: `seedData()` in `server/routes.ts` populates 4 events, 2 sponsors, 6 attendees on first startup

### Shared

- `shared/schema.ts` — single source of truth for all types. Drizzle table definitions + `drizzle-zod` insert schemas.

### Data Models

| Entity | Key Fields |
|--------|-----------|
| `events` | id, name, slug (A-Z0-9, uppercase), location, startDate, endDate, status (active/archived), meetingLocations (JSONB), meetingBlocks (JSONB) |
| `sponsors` | id, name, logoUrl, level (Platinum/Gold/Silver/Bronze), assignedEvents (array of event IDs), status (active/archived) |
| `attendees` | id, name, company, title, email, linkedinUrl (optional), assignedEvent |
| `meetings` | id, eventId, sponsorId, attendeeId, date, time, location, status (Scheduled/Completed/Cancelled/NoShow), notes |

---

## Public Scheduling Flow

All at `/event/:slug` — single-page multi-step wizard:

1. **Sponsor selection** — cards with logo, level badge, "Meet [Sponsor]" CTA button
2. **Date selection** — date tile buttons (from event.meetingBlocks)
3. **Time selection** — 30-min slot grid (booked slots disabled in real-time)
4. **Attendee details** — location buttons + Name/Company/Title/Email/LinkedIn form
5. **Confirmation** — success card with full meeting summary

**Rules enforced:**
- One meeting per event+date+time (409 conflict from backend, disabled button in UI)
- Sponsors shown are filtered to selected event
- Dates/times come from event.meetingBlocks
- Locations come from event.meetingLocations
- If attendee email matches existing record → link to existing; else → auto-create

---

## Admin Routing Structure

```
/admin                → DashboardPage (real data: stat cards, upcoming meetings, per-event chart)
/admin/events         → EventsPage (CRUD + archive, meeting blocks/locations editor)
/admin/sponsors       → SponsorsPage (CRUD + archive, event assignment)
/admin/attendees      → AttendeesPage (CRUD, LinkedIn URL, bulk import placeholder)
/admin/meetings       → MeetingsPage (smart scheduler, conflict enforcement, filters)
/admin/reports        → ReportsPage (meeting stats, breakdowns, filterable table, CSV export)
/admin/users          → UsersPage (admin-only: CRUD for internal users, role assignment)
/admin/branding       → Placeholder shell
/admin/settings       → Placeholder shell
```

---

## Auth & RBAC

### Session auth
- `express-session` with `SESSION_SECRET` env var; 8-hour cookie; MemStore (no DB)
- Session stores `userId` and `role` — type-augmented via `declare module "express-session"`
- Passwords stored as plain text in MemStorage (demo app, no bcrypt needed)

### Roles
| Role | Access |
|------|--------|
| `admin` | All pages including /admin/users; full CRUD on users |
| `manager` | All pages except /admin/users (shows Access Denied) |

### Default seeded users (re-created on each server restart)
- `admin@converge.com` / `password` — role: admin
- `manager@converge.com` / `password` — role: manager

### Auth context (frontend)
- `client/src/hooks/use-auth.tsx` — `AuthProvider` wraps app in `App.tsx`
- `useAuth()` returns `{ user, isLoading, isAdmin, isManager, login, logout }`
- `GET /api/auth/me` queried via TanStack Query on mount; `staleTime: 5 min`
- `AdminLayout` guards the entire `/admin/*` tree: unauthenticated → redirect to /login

### API middleware
- `requireAuth` — checks `req.session.userId`, returns 401 if missing
- `requireAdmin` — checks `req.session.role === "admin"`, returns 403 if not

---

## Key Implementation Notes

### Meeting conflict
- Backend: `getMeetingConflict(eventId, date, time)` → returns 409 `{conflict:true, message}`
- Public booking: `fetch()` (not `apiRequest`) so 409 doesn't throw — shown inline
- Admin modal: same raw fetch pattern
- Public UI: booked slots have `disabled` attribute + CSS line-through

### Manual attendee (public booking)
- `manualAttendee` object in POST body → `resolveAttendeeId()` finds or creates by email
- Backend strips `manualAttendee` before DB write

### Event code (slug)
- Stored as `slug`, validated `^[A-Z0-9]+$`
- Input auto-uppercases and strips non-alphanum

### MeetingFormPayload
- Type exported from `MeetingFormModal.tsx` — used instead of `InsertMeeting` in admin mutations

### CSS variable
- Sidebar background uses `--sidebar` (not `--sidebar-background`) in `index.css`

### Cache invalidation
- After public booking success: `queryClient.invalidateQueries({ queryKey: ["/api/meetings"] })`
- This immediately disables the booked time slot in the UI

---

## Design Constraints

- **Do NOT change** the LandingPage (`/`) layout or styling
- **Do NOT redesign** the admin sidebar or admin layout shell
- **Do NOT add** matchmaking, sponsor targeting, preference matching, or approval workflows
- **MemStorage only** — no database until explicitly requested
- Preserve all scheduling rules and conflict detection
