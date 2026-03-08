import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertSponsorSchema, insertAttendeeSchema, insertMeetingSchema, manualAttendeeSchema, type InsertEvent, type InsertSponsor, type InsertAttendee, type EventSponsorLink, type SponsorNotificationType } from "@shared/schema";
import { requireAuth, requireAdmin, stripPassword } from "./auth";
import { buildSponsorReportPDF } from "./pdf-report";

async function seedData() {
  const events = await storage.getEvents();
  if (events.length > 0) return;

  const defaultLocations = [
    { id: crypto.randomUUID(), name: "Booth" },
    { id: crypto.randomUUID(), name: "Work Lounge" },
    { id: crypto.randomUUID(), name: "VIP Room" },
    { id: crypto.randomUUID(), name: "Networking Lounge" },
  ];

  const seedEvents: InsertEvent[] = [
    {
      name: "The 2027 CU Growth & Innovation Summit",
      slug: "CUGI2027",
      location: "Miami, FL",
      startDate: new Date("2027-03-12T09:00:00"),
      endDate: new Date("2027-03-14T17:00:00"),
      archiveState: "active",
      meetingLocations: defaultLocations.map((l) => ({ ...l, id: crypto.randomUUID() })),
      meetingBlocks: [
        { id: crypto.randomUUID(), date: "2027-03-12", startTime: "09:00", endTime: "12:00" },
        { id: crypto.randomUUID(), date: "2027-03-12", startTime: "13:00", endTime: "16:00" },
        { id: crypto.randomUUID(), date: "2027-03-13", startTime: "09:00", endTime: "12:00" },
      ],
    },
    {
      name: "The 2026 Fintech Risk & Compliance Forum",
      slug: "FRC2026",
      location: "Chicago, IL",
      startDate: new Date("2026-10-05T09:00:00"),
      endDate: new Date("2026-10-07T17:00:00"),
      archiveState: "active",
      meetingLocations: defaultLocations.map((l) => ({ ...l, id: crypto.randomUUID() })),
      meetingBlocks: [
        { id: crypto.randomUUID(), date: "2026-10-05", startTime: "09:00", endTime: "12:00" },
        { id: crypto.randomUUID(), date: "2026-10-05", startTime: "13:00", endTime: "16:00" },
        { id: crypto.randomUUID(), date: "2026-10-06", startTime: "09:00", endTime: "12:00" },
      ],
    },
    {
      name: "The 2026 Treasury Leadership Summit",
      slug: "TLS2026",
      location: "New York, NY",
      startDate: new Date("2026-06-18T09:00:00"),
      endDate: new Date("2026-06-20T17:00:00"),
      archiveState: "active",
      meetingLocations: defaultLocations.map((l) => ({ ...l, id: crypto.randomUUID() })),
      meetingBlocks: [
        { id: crypto.randomUUID(), date: "2026-06-18", startTime: "09:00", endTime: "12:00" },
        { id: crypto.randomUUID(), date: "2026-06-18", startTime: "13:00", endTime: "16:00" },
        { id: crypto.randomUUID(), date: "2026-06-19", startTime: "09:00", endTime: "12:00" },
      ],
    },
    {
      name: "The 2026 U.S. BankTech Summit",
      slug: "UBTS2026",
      location: "Austin, TX",
      startDate: new Date("2026-04-02T09:00:00"),
      endDate: new Date("2026-04-04T17:00:00"),
      archiveState: "active",
      meetingLocations: defaultLocations.map((l) => ({ ...l, id: crypto.randomUUID() })),
      meetingBlocks: [
        { id: crypto.randomUUID(), date: "2026-04-02", startTime: "09:00", endTime: "12:00" },
        { id: crypto.randomUUID(), date: "2026-04-02", startTime: "13:00", endTime: "16:00" },
        { id: crypto.randomUUID(), date: "2026-04-03", startTime: "09:00", endTime: "12:00" },
      ],
    },
  ];

  const createdEvents: Record<string, string> = {};
  for (const ev of seedEvents) {
    const created = await storage.createEvent(ev);
    createdEvents[created.slug] = created.id;
  }

  // Seed sponsors — assigned to FRC2026 and UBTS2026
  const toLink = (eventId: string): EventSponsorLink => ({ eventId, archiveState: "active", archiveSource: null });

  const sponsorSeeds: InsertSponsor[] = [
    {
      name: "Winnow",
      logoUrl: "",
      level: "Gold",
      assignedEvents: [createdEvents["FRC2026"], createdEvents["UBTS2026"]].filter(Boolean).map(toLink),
      archiveState: "active",
      allowOnlineMeetings: true,
    },
    {
      name: "eGain",
      logoUrl: "",
      level: "Silver",
      assignedEvents: [createdEvents["FRC2026"], createdEvents["TLS2026"]].filter(Boolean).map(toLink),
      archiveState: "active",
    },
  ];

  const createdSponsors: Record<string, string> = {};
  for (const sp of sponsorSeeds) {
    const created = await storage.createSponsor(sp);
    createdSponsors[created.name] = created.id;
  }

  // Seed attendees — distributed across events
  const attendeeSeeds: InsertAttendee[] = [
    { name: "Sarah Chen", company: "First National Bank", title: "VP of Digital Banking", email: "s.chen@fnb.com", assignedEvent: createdEvents["FRC2026"] },
    { name: "Marcus Rivera", company: "TechCredit Union", title: "Chief Risk Officer", email: "m.rivera@techcu.com", assignedEvent: createdEvents["FRC2026"] },
    { name: "Priya Nair", company: "Capital Growth Partners", title: "Head of Treasury", email: "p.nair@cgp.com", assignedEvent: createdEvents["TLS2026"] },
    { name: "James Whitfield", company: "Summit Financial", title: "Director of Compliance", email: "j.whitfield@sf.com", assignedEvent: createdEvents["FRC2026"] },
    { name: "Lisa Monroe", company: "Apex Bank", title: "Chief Innovation Officer", email: "l.monroe@apexbank.com", assignedEvent: createdEvents["UBTS2026"] },
    { name: "David Park", company: "Regional Credit Union", title: "EVP Operations", email: "d.park@rcu.com", assignedEvent: createdEvents["TLS2026"] },
  ];

  for (const att of attendeeSeeds) {
    if (att.assignedEvent) await storage.createAttendee(att);
  }
}

async function seedUsers() {
  const existing = await storage.getUsers();
  if (existing.length > 0) return;
  await storage.createUser({ name: "Admin User", email: "admin@converge.com", password: "password", role: "admin", isActive: true });
  await storage.createUser({ name: "Manager User", email: "manager@converge.com", password: "password", role: "manager", isActive: true });
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedData().catch(console.error);
  seedUsers().catch(console.error);

  // ── Auth ─────────────────────────────────────────────────────────────────

  app.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });
    const user = await storage.getUserByEmail(email);
    if (!user || user.password !== password || !user.isActive) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.id;
    req.session.role = user.role as "admin" | "manager";
    res.json(stripPassword(user));
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ message: "Not authenticated" });
    const user = await storage.getUser(req.session.userId);
    if (!user || !user.isActive) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.json(stripPassword(user));
  });

  // ── User Management (admin-only) ─────────────────────────────────────────

  app.get("/api/users", requireAdmin, async (_req, res) => {
    const users = await storage.getUsers();
    res.json(users.map(stripPassword));
  });

  app.post("/api/users", requireAdmin, async (req, res) => {
    const { name, email, password, role, isActive } = req.body;
    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "name, email, password, role are required" });
    }
    const exists = await storage.getUserByEmail(email);
    if (exists) return res.status(409).json({ message: "A user with this email already exists" });
    const user = await storage.createUser({ name, email, password, role, isActive: isActive ?? true });
    res.status(201).json(stripPassword(user));
  });

  app.patch("/api/users/:id", requireAdmin, async (req, res) => {
    const { password, ...updates } = req.body;
    const patch = password ? { ...updates, password } : updates;
    const user = await storage.updateUser(req.params.id as string, patch);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(stripPassword(user));
  });

  app.delete("/api/users/:id", requireAdmin, async (req, res) => {
    if (req.params.id === req.session.userId) {
      return res.status(400).json({ message: "You cannot delete your own account" });
    }
    await storage.deleteUser(req.params.id as string);
    res.sendStatus(204);
  });

  // ── Events ──────────────────────────────────────────────────────────────
  app.get("/api/events", async (_req, res) => {
    res.json(await storage.getEvents());
  });

  app.post("/api/events", async (req, res) => {
    const parsed = insertEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(await storage.createEvent(parsed.data));
  });

  app.patch("/api/events/:id", async (req, res) => {
    const current = await storage.getEvent(req.params.id);
    if (!current) return res.status(404).json({ message: "Event not found" });

    const event = await storage.updateEvent(req.params.id, req.body);
    if (!event) return res.status(404).json({ message: "Event not found" });

    // Cascade archive/unarchive when event archiveState changes
    if (req.body.archiveState === "archived" && current.archiveState !== "archived") {
      await storage.cascadeArchiveEvent(req.params.id);
    } else if (req.body.archiveState === "active" && current.archiveState === "archived") {
      await storage.cascadeUnarchiveEvent(req.params.id);
    }

    res.json(event);
  });

  app.delete("/api/events/:id", async (req, res) => {
    await storage.deleteEvent(req.params.id);
    res.sendStatus(204);
  });

  // ── Sponsors ─────────────────────────────────────────────────────────────
  app.get("/api/sponsors", async (_req, res) => {
    res.json(await storage.getSponsors());
  });

  app.post("/api/sponsors", async (req, res) => {
    const parsed = insertSponsorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(await storage.createSponsor(parsed.data));
  });

  app.patch("/api/sponsors/:id", async (req, res) => {
    const sponsor = await storage.updateSponsor(req.params.id, req.body);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    res.json(sponsor);
  });

  app.delete("/api/sponsors/:id", async (req, res) => {
    await storage.deleteSponsor(req.params.id);
    res.sendStatus(204);
  });

  // ── Attendees ────────────────────────────────────────────────────────────
  app.get("/api/attendees", async (_req, res) => {
    res.json(await storage.getAttendees());
  });

  app.post("/api/attendees", async (req, res) => {
    const parsed = insertAttendeeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    res.status(201).json(await storage.createAttendee(parsed.data));
  });

  app.patch("/api/attendees/:id", async (req, res) => {
    const attendee = await storage.updateAttendee(req.params.id, req.body);
    if (!attendee) return res.status(404).json({ message: "Attendee not found" });
    res.json(attendee);
  });

  app.delete("/api/attendees/:id", async (req, res) => {
    await storage.deleteAttendee(req.params.id);
    res.sendStatus(204);
  });

  // ── Meetings ─────────────────────────────────────────────────────────────
  app.get("/api/meetings", async (_req, res) => {
    res.json(await storage.getMeetings());
  });

  // Resolve attendee from body: event-specific lookup by email+eventId
  async function resolveAttendeeId(body: any, eventId: string): Promise<{ attendeeId: string } | { error: string }> {
    if (body.manualAttendee) {
      const parsed = manualAttendeeSchema.safeParse(body.manualAttendee);
      if (!parsed.success) return { error: "Invalid manual attendee data" };
      const ma = parsed.data;

      // 1. Active record for this specific event → reuse
      const activeForEvent = await storage.getAttendeeByEmailAndEvent(ma.email, eventId);
      if (activeForEvent) {
        return { attendeeId: activeForEvent.id };
      }

      // 2. Archived record for this specific event → reactivate and reuse
      const archivedForEvent = await storage.getArchivedAttendeeByEmailAndEvent(ma.email, eventId);
      if (archivedForEvent) {
        await storage.updateAttendee(archivedForEvent.id, { archiveState: "active", archiveSource: null });
        return { attendeeId: archivedForEvent.id };
      }

      // 3. No record for this event (may exist for other events) → create new
      const created = await storage.createAttendee({
        name: ma.name,
        company: ma.company,
        title: ma.title,
        email: ma.email,
        linkedinUrl: ma.linkedinUrl || undefined,
        assignedEvent: eventId,
        archiveState: "active",
      });
      return { attendeeId: created.id };
    }
    if (body.attendeeId) return { attendeeId: body.attendeeId };
    return { error: "attendeeId or manualAttendee is required" };
  }

  // ── Notification helper ───────────────────────────────────────────────────

  async function fireNotification(
    type: SponsorNotificationType,
    meetingId: string,
    sponsorId: string,
    eventId: string,
    attendeeId: string,
    date: string,
    time: string,
  ) {
    try {
      const [event, attendee] = await Promise.all([
        storage.getEvent(eventId),
        storage.getAttendee(attendeeId),
      ]);
      if (!event || !attendee) return;
      await storage.createNotification({
        sponsorId,
        eventId,
        meetingId,
        type,
        attendeeName:    attendee.name,
        attendeeCompany: attendee.company,
        eventName:       event.name,
        date,
        time,
        isRead: false,
      });
    } catch (_) {}
  }

  app.post("/api/meetings", async (req, res) => {
    const attendeeResult = await resolveAttendeeId(req.body, req.body.eventId);
    if ("error" in attendeeResult) return res.status(400).json({ message: attendeeResult.error });

    const body = { ...req.body, attendeeId: attendeeResult.attendeeId };
    delete body.manualAttendee;

    // Online requests default to Pending status and Online location
    if (body.meetingType === "online_request") {
      body.status = "Pending";
      if (!body.location) body.location = "Online";
    }

    const parsed = insertMeetingSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    // Only check for slot conflicts on onsite meetings
    if (parsed.data.meetingType !== "online_request") {
      const { eventId, sponsorId, date, time } = parsed.data;
      const conflict = await storage.getMeetingConflict(eventId, sponsorId, date, time);
      if (conflict) {
        return res.status(409).json({
          conflict: true,
          message: "This time slot is no longer available.",
        });
      }
    }

    const meeting = await storage.createMeeting(parsed.data);

    // Fire notification
    const notifType: SponsorNotificationType =
      meeting.meetingType === "online_request" ? "online_request_submitted" : "onsite_booked";
    fireNotification(notifType, meeting.id, meeting.sponsorId, meeting.eventId, meeting.attendeeId, meeting.date, meeting.time);

    res.status(201).json(meeting);
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    const existing = await storage.getMeeting(req.params.id);
    if (!existing) return res.status(404).json({ message: "Meeting not found" });

    const eventId = req.body.eventId || existing.eventId;
    let body = { ...req.body };

    if (req.body.manualAttendee) {
      const attendeeResult = await resolveAttendeeId(req.body, eventId);
      if ("error" in attendeeResult) return res.status(400).json({ message: attendeeResult.error });
      body.attendeeId = attendeeResult.attendeeId;
      delete body.manualAttendee;
    }

    // Only enforce slot conflicts for onsite meetings
    const effectiveType = body.meetingType ?? existing.meetingType ?? "onsite";
    if (effectiveType !== "online_request") {
      const merged = { ...existing, ...body };
      const { sponsorId, date, time } = merged;
      const conflict = await storage.getMeetingConflict(eventId, sponsorId, date, time, req.params.id);
      if (conflict) {
        return res.status(409).json({
          conflict: true,
          message: "This time slot is no longer available.",
        });
      }
    }

    const meeting = await storage.updateMeeting(req.params.id, body);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    // Fire status-change notifications
    const oldStatus = existing.status as string;
    const newStatus = (meeting.status ?? "") as string;
    if (oldStatus !== newStatus) {
      let notifType: SponsorNotificationType | null = null;
      if (newStatus === "Cancelled") notifType = "meeting_cancelled";
      else if (newStatus === "Confirmed" && existing.meetingType === "online_request") notifType = "request_confirmed";
      else if ((newStatus === "Cancelled" || newStatus === "NoShow") && existing.meetingType === "online_request" && oldStatus === "Pending") notifType = "request_declined";
      if (notifType) {
        fireNotification(notifType, meeting.id, meeting.sponsorId, meeting.eventId, meeting.attendeeId, meeting.date, meeting.time);
      }
    }

    res.json(meeting);
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    await storage.deleteMeeting(req.params.id);
    res.sendStatus(204);
  });

  // ── Sponsor Tokens (admin) ────────────────────────────────────────────────

  // Get all tokens (admin overview)
  app.get("/api/sponsor-tokens", async (_req, res) => {
    const sponsors = await storage.getSponsors();
    const all: import("@shared/schema").SponsorToken[] = [];
    for (const s of sponsors) {
      const t = await storage.getSponsorTokensBySponsor(s.id);
      all.push(...t);
    }
    res.json(all);
  });

  // Get all tokens for a sponsor
  app.get("/api/sponsor-tokens/sponsor/:sponsorId", async (req, res) => {
    const tokens = await storage.getSponsorTokensBySponsor(req.params.sponsorId);
    res.json(tokens);
  });

  // Generate a new token for sponsor+event (one active token per pair)
  app.post("/api/sponsor-tokens", async (req, res) => {
    const { sponsorId, eventId } = req.body;
    if (!sponsorId || !eventId) return res.status(400).json({ message: "sponsorId and eventId are required" });

    const sponsor = await storage.getSponsor(sponsorId);
    const event = await storage.getEvent(eventId);
    if (!sponsor || !event) return res.status(404).json({ message: "Sponsor or event not found" });

    // Revoke any existing active token for this sponsor+event pair
    const existing = await storage.getSponsorTokensBySponsor(sponsorId);
    const activeForEvent = existing.find((t) => t.eventId === eventId && t.isActive);
    if (activeForEvent) await storage.revokeSponsorToken(activeForEvent.token);

    const token = await storage.createSponsorToken(sponsorId, eventId);
    res.status(201).json(token);
  });

  // Revoke a token
  app.delete("/api/sponsor-tokens/:token", async (req, res) => {
    const token = await storage.getSponsorToken(req.params.token);
    if (!token) return res.status(404).json({ message: "Token not found" });
    const updated = await storage.revokeSponsorToken(req.params.token);
    res.json(updated);
  });

  // Regenerate: revoke old token, create new one for same sponsor+event
  app.post("/api/sponsor-tokens/:token/regenerate", async (req, res) => {
    const existing = await storage.getSponsorToken(req.params.token);
    if (!existing) return res.status(404).json({ message: "Token not found" });

    await storage.revokeSponsorToken(existing.token);
    const newToken = await storage.createSponsorToken(existing.sponsorId, existing.eventId);
    res.status(201).json(newToken);
  });

  // ── Sponsor Dashboard (public, token-validated) ───────────────────────────

  // Helper to validate a sponsor access token
  async function validateSponsorToken(token: string): Promise<
    { ok: false; status: number; message: string } | { ok: true; tokenRecord: NonNullable<Awaited<ReturnType<typeof storage.getSponsorToken>>> }
  > {
    const tokenRecord = await storage.getSponsorToken(token);
    if (!tokenRecord) return { ok: false, status: 401, message: "Invalid access token" };
    if (!tokenRecord.isActive) return { ok: false, status: 403, message: "Access token has been revoked" };
    if (new Date(tokenRecord.expiresAt) < new Date()) return { ok: false, status: 403, message: "Access token has expired" };
    return { ok: true, tokenRecord };
  }

  app.get("/api/sponsor-access/:token", async (req, res) => {
    const validation = await validateSponsorToken(req.params.token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const sponsor = await storage.getSponsor(tokenRecord.sponsorId);
    const event = await storage.getEvent(tokenRecord.eventId);
    if (!sponsor || !event) return res.status(404).json({ message: "Sponsor or event not found" });

    const allMeetings = await storage.getMeetings();
    const sponsorMeetings = allMeetings.filter(
      (m) => m.sponsorId === tokenRecord.sponsorId && m.eventId === tokenRecord.eventId
    );

    const meetingsWithAttendees = await Promise.all(
      sponsorMeetings.map(async (m) => {
        const attendee = await storage.getAttendee(m.attendeeId);
        return {
          id: m.id,
          date: m.date,
          time: m.time,
          location: m.location,
          status: m.status,
          meetingType: m.meetingType ?? "onsite",
          platform: m.platform ?? null,
          preferredTimezone: m.preferredTimezone ?? null,
          attendee: attendee
            ? { name: attendee.name, company: attendee.company, title: attendee.title, email: attendee.email, linkedinUrl: attendee.linkedinUrl ?? null }
            : { name: "Unknown", company: "—", title: "—", email: "—", linkedinUrl: null },
        };
      })
    );

    const uniqueCompanies = new Set(meetingsWithAttendees.map((m) => m.attendee.company).filter((c) => c !== "—"));
    const notifications = await storage.getNotificationsForSponsorEvent(tokenRecord.sponsorId, tokenRecord.eventId);

    res.json({
      sponsor: {
        id: sponsor.id, name: sponsor.name, level: sponsor.level, logoUrl: sponsor.logoUrl ?? "",
        shortDescription: sponsor.shortDescription ?? null,
        websiteUrl: sponsor.websiteUrl ?? null,
        linkedinUrl: sponsor.linkedinUrl ?? null,
        solutionsSummary: sponsor.solutionsSummary ?? null,
      },
      event: {
        id: event.id, name: event.name, slug: event.slug, location: event.location,
        startDate: event.startDate, endDate: event.endDate,
      },
      stats: {
        total:         sponsorMeetings.length,
        scheduled:     sponsorMeetings.filter((m) => m.status === "Scheduled").length,
        completed:     sponsorMeetings.filter((m) => m.status === "Completed").length,
        cancelled:     sponsorMeetings.filter((m) => m.status === "Cancelled" || m.status === "NoShow").length,
        pendingOnline: sponsorMeetings.filter((m) => m.status === "Pending").length,
        companies:     uniqueCompanies.size,
      },
      meetings: meetingsWithAttendees,
      notifications: notifications.map((n) => ({
        id: n.id, type: n.type, attendeeName: n.attendeeName, attendeeCompany: n.attendeeCompany,
        eventName: n.eventName, date: n.date, time: n.time, isRead: n.isRead,
        createdAt: n.createdAt.toISOString(),
      })),
    });
  });

  // ── Sponsor Notifications (token-gated) ───────────────────────────────────

  app.patch("/api/sponsor-notifications/read-all", async (req, res) => {
    const token = (req.query.token as string) || req.body.token;
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    await storage.markAllNotificationsRead(tokenRecord.sponsorId, tokenRecord.eventId);
    res.json({ ok: true });
  });

  app.patch("/api/sponsor-notifications/:id/read", async (req, res) => {
    const token = (req.query.token as string) || req.body.token;
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    await storage.markNotificationRead(req.params.id);
    res.json({ ok: true });
  });

  // ── Public sponsor profile (no auth required) ─────────────────────────────

  app.get("/api/sponsors/:id", async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.id);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    res.json(sponsor);
  });

  // ── Sponsor Report PDF helpers ─────────────────────────────────────────────

  async function buildReportData(sponsorId: string, eventId: string) {
    const [sponsor, event, allMeetings, allAttendees] = await Promise.all([
      storage.getSponsor(sponsorId),
      storage.getEvent(eventId),
      storage.getMeetings(),
      storage.getAttendees(),
    ]);
    if (!sponsor || !event) return null;

    const sponsorMeetings = allMeetings.filter(
      (m) => m.sponsorId === sponsorId && m.eventId === eventId
    );
    const attendeeMap = new Map(allAttendees.map((a) => [a.id, a]));

    const meetings = sponsorMeetings.map((m) => {
      const at = attendeeMap.get(m.attendeeId);
      return {
        id:               m.id,
        date:             m.date,
        time:             m.time,
        location:         m.location,
        status:           m.status,
        meetingType:      m.meetingType ?? "onsite",
        attendeeName:     at?.name ?? "Unknown",
        attendeeTitle:    at?.title ?? "",
        attendeeCompany:  at?.company ?? "",
        attendeeEmail:    at?.email ?? "",
        attendeeLinkedin: at?.linkedinUrl ?? "",
      };
    });

    return {
      generatedAt: new Date(),
      event: {
        name:      event.name,
        slug:      event.slug,
        location:  event.location,
        startDate: event.startDate,
        endDate:   event.endDate,
      },
      sponsor: { name: sponsor.name, level: sponsor.level },
      meetings,
    };
  }

  // Token-gated: sponsor downloads their own report
  app.get("/api/sponsor-report/pdf", async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ message: "Token required" });

    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const data = await buildReportData(tokenRecord.sponsorId, tokenRecord.eventId);
    if (!data) return res.status(404).json({ message: "Sponsor or event not found" });

    const filename = `${data.sponsor.name.replace(/\s+/g, "_")}_${data.event.slug}_Report.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdf = buildSponsorReportPDF(data);
    (pdf as any).pipe(res);
  });

  // Admin: download sponsor report by eventId + sponsorId
  app.get("/api/admin/reports/sponsor-pdf", requireAdmin, async (req, res) => {
    const { eventId, sponsorId } = req.query as { eventId?: string; sponsorId?: string };
    if (!eventId || !sponsorId) return res.status(400).json({ message: "eventId and sponsorId required" });

    const data = await buildReportData(sponsorId, eventId);
    if (!data) return res.status(404).json({ message: "Sponsor or event not found" });

    const filename = `${data.sponsor.name.replace(/\s+/g, "_")}_${data.event.slug}_Report.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdf = buildSponsorReportPDF(data);
    (pdf as any).pipe(res);
  });

  return httpServer;
}
