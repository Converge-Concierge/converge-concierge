import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertSponsorSchema, insertAttendeeSchema, insertMeetingSchema, manualAttendeeSchema, type InsertEvent, type InsertSponsor, type InsertAttendee } from "@shared/schema";

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
      status: "active",
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
      status: "active",
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
      status: "active",
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
      status: "active",
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
  const sponsorSeeds: InsertSponsor[] = [
    {
      name: "Winnow",
      logoUrl: "",
      level: "Gold",
      assignedEvents: [createdEvents["FRC2026"], createdEvents["UBTS2026"]].filter(Boolean),
      status: "active",
    },
    {
      name: "eGain",
      logoUrl: "",
      level: "Silver",
      assignedEvents: [createdEvents["FRC2026"], createdEvents["TLS2026"]].filter(Boolean),
      status: "active",
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedData().catch(console.error);

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
    const event = await storage.updateEvent(req.params.id, req.body);
    if (!event) return res.status(404).json({ message: "Event not found" });
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

  // Resolve attendee from body: if manualAttendee provided, find or create; else use attendeeId
  async function resolveAttendeeId(body: any, eventId: string): Promise<{ attendeeId: string } | { error: string }> {
    if (body.manualAttendee) {
      const parsed = manualAttendeeSchema.safeParse(body.manualAttendee);
      if (!parsed.success) return { error: "Invalid manual attendee data" };
      const ma = parsed.data;
      const existing = await storage.getAttendeeByEmail(ma.email);
      if (existing) {
        return { attendeeId: existing.id };
      }
      const created = await storage.createAttendee({
        name: ma.name,
        company: ma.company,
        title: ma.title,
        email: ma.email,
        linkedinUrl: ma.linkedinUrl || undefined,
        assignedEvent: eventId,
      });
      return { attendeeId: created.id };
    }
    if (body.attendeeId) return { attendeeId: body.attendeeId };
    return { error: "attendeeId or manualAttendee is required" };
  }

  app.post("/api/meetings", async (req, res) => {
    const attendeeResult = await resolveAttendeeId(req.body, req.body.eventId);
    if ("error" in attendeeResult) return res.status(400).json({ message: attendeeResult.error });

    const body = { ...req.body, attendeeId: attendeeResult.attendeeId };
    delete body.manualAttendee;

    const parsed = insertMeetingSchema.safeParse(body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });

    const { eventId, date, time } = parsed.data;
    const conflict = await storage.getMeetingConflict(eventId, date, time);
    if (conflict) {
      return res.status(409).json({
        conflict: true,
        message: `A meeting is already scheduled for this event on ${date} at ${time}. Only one meeting is allowed per time slot.`,
      });
    }

    res.status(201).json(await storage.createMeeting(parsed.data));
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

    const merged = { ...existing, ...body };
    const { date, time } = merged;
    const conflict = await storage.getMeetingConflict(eventId, date, time, req.params.id);
    if (conflict) {
      return res.status(409).json({
        conflict: true,
        message: `A meeting is already scheduled for this event on ${date} at ${time}. Only one meeting is allowed per time slot.`,
      });
    }

    const meeting = await storage.updateMeeting(req.params.id, body);
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

  app.get("/api/sponsor-access/:token", async (req, res) => {
    const tokenRecord = await storage.getSponsorToken(req.params.token);

    if (!tokenRecord) return res.status(401).json({ message: "Invalid access token" });
    if (!tokenRecord.isActive) return res.status(403).json({ message: "Access token has been revoked" });
    if (new Date(tokenRecord.expiresAt) < new Date()) return res.status(403).json({ message: "Access token has expired" });

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
          attendee: attendee
            ? { name: attendee.name, company: attendee.company, title: attendee.title, email: attendee.email, linkedinUrl: attendee.linkedinUrl }
            : { name: "Unknown", company: "—", title: "—", email: "—" },
        };
      })
    );

    const uniqueCompanies = new Set(meetingsWithAttendees.map((m) => m.attendee.company).filter((c) => c !== "—"));

    res.json({
      sponsor: { id: sponsor.id, name: sponsor.name, level: sponsor.level, logoUrl: sponsor.logoUrl ?? "" },
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
      },
      stats: {
        total: sponsorMeetings.length,
        scheduled: sponsorMeetings.filter((m) => m.status === "Scheduled").length,
        completed: sponsorMeetings.filter((m) => m.status === "Completed").length,
        cancelled: sponsorMeetings.filter((m) => m.status === "Cancelled" || m.status === "NoShow").length,
        companies: uniqueCompanies.size,
      },
      meetings: meetingsWithAttendees,
    });
  });

  return httpServer;
}
