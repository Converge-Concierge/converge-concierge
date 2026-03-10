import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertSponsorSchema, insertAttendeeSchema, insertMeetingSchema, manualAttendeeSchema, type InsertEvent, type InsertSponsor, type InsertAttendee, type EventSponsorLink, type SponsorNotificationType } from "@shared/schema";
import { requireAuth, requireAdmin, stripPassword } from "./auth";
import { buildSponsorReportPDF } from "./pdf-report";
import multer from "multer";
import path from "path";
import { randomBytes } from "crypto";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

async function uploadToObjectStorage(buffer: Buffer, mimetype: string, originalname: string): Promise<string> {
  const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
  if (!bucketId) throw new Error("DEFAULT_OBJECT_STORAGE_BUCKET_ID is not set");
  const ext = path.extname(originalname) || ".png";
  const key = `${Date.now()}-${randomBytes(8).toString("hex")}${ext}`;
  const objectName = `public/uploads/${key}`;
  const bucket = objectStorageClient.bucket(bucketId);
  const file = bucket.file(objectName);
  await file.save(buffer, { contentType: mimetype, resumable: false });
  return `/uploads/${key}`;
}

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
      shortDescription: "AI-powered financial risk intelligence for banks and credit unions.",
      websiteUrl: "https://www.winnow.ai",
      linkedinUrl: "https://www.linkedin.com/company/winnow-ai",
      solutionsSummary: "Winnow delivers real-time risk scoring, fraud detection, and regulatory compliance automation to financial institutions of all sizes. Our platform integrates with core banking systems to surface actionable insights without disrupting existing workflows.\n\nKey offerings:\n• Adaptive fraud detection with sub-100ms decisioning\n• Regulatory change management and policy mapping\n• AI-driven credit risk scoring models\n• Real-time transaction monitoring and alert management",
    },
    {
      name: "eGain",
      logoUrl: "",
      level: "Silver",
      assignedEvents: [createdEvents["FRC2026"], createdEvents["TLS2026"]].filter(Boolean).map(toLink),
      archiveState: "active",
      allowOnlineMeetings: false,
      shortDescription: "Conversational AI and knowledge automation for financial services teams.",
      websiteUrl: "https://www.egain.com",
      linkedinUrl: "https://www.linkedin.com/company/egain",
      solutionsSummary: "eGain helps banks, credit unions, and wealth management firms modernize customer engagement through AI-powered knowledge management and omnichannel conversation tools.\n\nCore solutions:\n• AI knowledge hub for compliance and product information\n• Agent assist and virtual assistant for contact centers\n• Digital-first engagement across chat, email, and messaging\n• Analytics and coaching for service quality improvement",
    },
  ];

  const createdSponsors: Record<string, string> = {};
  for (const sp of sponsorSeeds) {
    const created = await storage.createSponsor(sp);
    createdSponsors[created.name] = created.id;
  }

  // Seed attendees — distributed across events
  const attendeeSeeds: InsertAttendee[] = [
    { firstName: "Sarah", lastName: "Chen", name: "Sarah Chen", company: "First National Bank", title: "VP of Digital Banking", email: "s.chen@fnb.com", assignedEvent: createdEvents["FRC2026"] },
    { firstName: "Marcus", lastName: "Rivera", name: "Marcus Rivera", company: "TechCredit Union", title: "Chief Risk Officer", email: "m.rivera@techcu.com", assignedEvent: createdEvents["FRC2026"] },
    { firstName: "Priya", lastName: "Nair", name: "Priya Nair", company: "Capital Growth Partners", title: "Head of Treasury", email: "p.nair@cgp.com", assignedEvent: createdEvents["TLS2026"] },
    { firstName: "James", lastName: "Whitfield", name: "James Whitfield", company: "Summit Financial", title: "Director of Compliance", email: "j.whitfield@sf.com", assignedEvent: createdEvents["FRC2026"] },
    { firstName: "Lisa", lastName: "Monroe", name: "Lisa Monroe", company: "Apex Bank", title: "Chief Innovation Officer", email: "l.monroe@apexbank.com", assignedEvent: createdEvents["UBTS2026"] },
    { firstName: "David", lastName: "Park", name: "David Park", company: "Regional Credit Union", title: "EVP Operations", email: "d.park@rcu.com", assignedEvent: createdEvents["TLS2026"] },
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

  // ── File Upload ──────────────────────────────────────────────────────────

  app.post("/api/upload", requireAuth, (req, res) => {
    upload.single("file")(req, res, async (err) => {
      if (err) return res.status(400).json({ message: err.message });
      if (!req.file) return res.status(400).json({ message: "No file provided" });
      try {
        const url = await uploadToObjectStorage(req.file.buffer, req.file.mimetype, req.file.originalname);
        res.json({ url });
      } catch (uploadErr: any) {
        console.error("Object storage upload failed:", uploadErr);
        res.status(500).json({ message: "File upload failed" });
      }
    });
  });

  app.get("/uploads/:key", async (req, res) => {
    try {
      const bucketId = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;
      if (!bucketId) return res.status(500).json({ message: "Storage not configured" });
      const file = objectStorageClient.bucket(bucketId).file(`public/uploads/${req.params.key}`);
      const [exists] = await file.exists();
      if (!exists) return res.status(404).json({ message: "Not found" });
      const [metadata] = await file.getMetadata();
      res.set("Content-Type", (metadata.contentType as string) || "application/octet-stream");
      res.set("Cache-Control", "public, max-age=31536000");
      file.createReadStream().pipe(res);
    } catch (e: any) {
      console.error("Upload serve error:", e);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

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
    req.session.save((err) => {
      if (err) return res.status(500).json({ message: "Session save failed" });
      res.json(stripPassword(user));
    });
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => res.json({ message: "Logged out" }));
  });

  // ── Password Recovery ─────────────────────────────────────────────────────

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const user = await storage.getUserByEmail(email);
    if (!user || !user.isActive) {
      if (process.env.NODE_ENV === "production") {
        return res.json({ message: "If an account exists for that email, reset instructions have been logged to the server." });
      }
      return res.status(404).json({ message: "No account found with that email address" });
    }
    const tokenRecord = await storage.createPasswordResetToken(user.id);
    console.log(`[PASSWORD RESET] Token generated for ${email} — token: ${tokenRecord.token} — expires: ${new Date(tokenRecord.expiresAt).toISOString()}`);
    if (process.env.NODE_ENV === "production") {
      res.json({
        message: "If an account exists for that email, reset instructions have been logged to the server.",
      });
    } else {
      res.json({
        message: "Reset token generated. Use it to set a new password.",
        token: tokenRecord.token,
        expiresAt: new Date(tokenRecord.expiresAt).toISOString(),
      });
    }
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token and newPassword are required" });
    if (newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });
    const record = await storage.getPasswordResetToken(token);
    if (!record) return res.status(400).json({ message: "Invalid or expired reset token" });
    if (record.used) return res.status(400).json({ message: "This reset token has already been used" });
    if (Date.now() > record.expiresAt) return res.status(400).json({ message: "This reset token has expired" });
    await storage.updateUserPassword(record.userId, newPassword);
    await storage.markResetTokenUsed(token);
    res.json({ message: "Password updated successfully" });
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

    const body = { ...req.body };
    if (body.startDate) body.startDate = new Date(body.startDate);
    if (body.endDate) body.endDate = new Date(body.endDate);

    const event = await storage.updateEvent(req.params.id, body);
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

  app.post("/api/events/:id/copy", requireAuth, async (req, res) => {
    const source = await storage.getEvent(req.params.id);
    if (!source) return res.status(404).json({ message: "Event not found" });

    const { copySponsors = false } = req.body;

    const baseSlug = source.slug + "COPY";
    let slug = baseSlug;
    let counter = 2;
    while (await storage.getEventBySlug(slug)) {
      slug = baseSlug + counter;
      counter++;
    }

    const newEvent = await storage.createEvent({
      name: source.name + " (Copy)",
      slug,
      location: source.location,
      startDate: new Date(source.startDate),
      endDate: new Date(source.endDate),
      archiveState: "active",
      logoUrl: source.logoUrl ?? undefined,
      meetingLocations: source.meetingLocations,
      meetingBlocks: source.meetingBlocks,
      primaryColor: source.primaryColor ?? undefined,
      secondaryColor: source.secondaryColor ?? undefined,
      accentColor: source.accentColor ?? undefined,
      buttonColor: source.buttonColor ?? undefined,
      bgAccentColor: source.bgAccentColor ?? undefined,
      schedulingEnabled: source.schedulingEnabled,
      schedulingShutoffAt: source.schedulingShutoffAt ? new Date(source.schedulingShutoffAt) : undefined,
      externalSchedulingLabel: source.externalSchedulingLabel ?? undefined,
      externalSchedulingUrl: source.externalSchedulingUrl ?? undefined,
      externalSchedulingMessage: source.externalSchedulingMessage ?? undefined,
    });

    if (copySponsors) {
      const allSponsors = await storage.getSponsors();
      const sponsorsForEvent = allSponsors.filter((s) =>
        (s.assignedEvents ?? []).some(
          (ae) => ae.eventId === source.id && (ae.archiveState ?? "active") === "active"
        )
      );
      for (const sponsor of sponsorsForEvent) {
        const sourceLink = sponsor.assignedEvents.find((ae) => ae.eventId === source.id);
        const newLink: EventSponsorLink = {
          eventId: newEvent.id,
          sponsorshipLevel: sourceLink?.sponsorshipLevel ?? null,
          archiveState: "active",
          archiveSource: null,
        };
        await storage.updateSponsor(sponsor.id, {
          assignedEvents: [...(sponsor.assignedEvents ?? []), newLink],
        });
      }
    }

    res.status(201).json(newEvent);
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
    const updates = { ...req.body };
    if (Array.isArray(updates.assignedEvents)) {
      updates.assignedEvents = updates.assignedEvents.filter(
        (ae: any) => !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
      );
    }
    const sponsor = await storage.updateSponsor(req.params.id, updates);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    res.json(sponsor);
  });

  app.delete("/api/sponsors/:id", async (req, res) => {
    await storage.deleteSponsor(req.params.id);
    res.sendStatus(204);
  });

  app.post("/api/sponsors/:id/copy", requireAuth, async (req, res) => {
    const source = await storage.getSponsor(req.params.id);
    if (!source) return res.status(404).json({ message: "Sponsor not found" });

    const newSponsor = await storage.createSponsor({
      name: source.name + " (Copy)",
      logoUrl: source.logoUrl ?? undefined,
      level: source.level ?? undefined,
      archiveState: "active",
      allowOnlineMeetings: source.allowOnlineMeetings ?? false,
      shortDescription: source.shortDescription ?? undefined,
      websiteUrl: source.websiteUrl ?? undefined,
      linkedinUrl: source.linkedinUrl ?? undefined,
      solutionsSummary: source.solutionsSummary ?? undefined,
      contactName: source.contactName ?? undefined,
      contactEmail: source.contactEmail ?? undefined,
      contactPhone: source.contactPhone ?? undefined,
      attributes: source.attributes ?? [],
      assignedEvents: (source.assignedEvents ?? []).map((ae) => ({
        eventId: ae.eventId,
        sponsorshipLevel: ae.sponsorshipLevel,
        archiveState: "active" as const,
        archiveSource: null,
      })),
    });

    res.status(201).json(newSponsor);
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

  app.get("/api/attendees/:id/detail", requireAuth, async (req, res) => {
    const detail = await storage.getAttendeeWithDetail(req.params.id);
    if (!detail) return res.status(404).json({ message: "Attendee not found" });
    res.json(detail);
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
      const fullName = ma.name || [ma.firstName, ma.lastName].filter(Boolean).join(" ");
      const created = await storage.createAttendee({
        firstName: ma.firstName,
        lastName: ma.lastName,
        name: fullName,
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

    // Validate location tier eligibility for onsite meetings
    if (parsed.data.meetingType !== "online_request" && parsed.data.location) {
      const [eligEvent, eligSponsor] = await Promise.all([
        storage.getEvent(parsed.data.eventId),
        storage.getSponsor(parsed.data.sponsorId),
      ]);
      if (eligEvent && eligSponsor) {
        const locationDef = eligEvent.meetingLocations.find(
          (l) => l.name === parsed.data.location
        );
        const allowedLevels = locationDef?.allowedSponsorLevels ?? [];
        if (allowedLevels.length > 0) {
          const sponsorLevel = (eligSponsor.assignedEvents ?? []).find(
            (ae) => ae.eventId === parsed.data.eventId
          )?.sponsorshipLevel;
          if (!sponsorLevel || !allowedLevels.includes(sponsorLevel as any)) {
            return res.status(403).json({
              message: "This sponsor's sponsorship tier is not eligible for the selected meeting location.",
            });
          }
        }
      }
    }

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

    // Capture attendee interests if provided (T004)
    const selectedInterests: string[] = Array.isArray(req.body.selectedInterests) ? req.body.selectedInterests : [];
    if (selectedInterests.length > 0) {
      storage.mergeAttendeeInterests(meeting.attendeeId, selectedInterests).catch(() => {});
    }

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
          meetingLink: m.meetingLink ?? null,
          attendee: attendee
            ? { name: attendee.name, company: attendee.company, title: attendee.title, email: attendee.email, linkedinUrl: attendee.linkedinUrl ?? null }
            : { name: "Unknown", company: "—", title: "—", email: "—", linkedinUrl: null },
        };
      })
    );

    const uniqueCompanies = new Set(meetingsWithAttendees.map((m) => m.attendee.company).filter((c) => c !== "—"));
    const notifications = await storage.getNotificationsForSponsorEvent(tokenRecord.sponsorId, tokenRecord.eventId);

    const eventLink = (sponsor.assignedEvents ?? []).find((ae) => ae.eventId === tokenRecord.eventId);
    const sponsorLevel = eventLink?.sponsorshipLevel ?? sponsor.level ?? "";

    res.json({
      sponsor: {
        id: sponsor.id, name: sponsor.name, level: sponsorLevel, logoUrl: sponsor.logoUrl ?? "",
        shortDescription: sponsor.shortDescription ?? null,
        websiteUrl: sponsor.websiteUrl ?? null,
        linkedinUrl: sponsor.linkedinUrl ?? null,
        solutionsSummary: sponsor.solutionsSummary ?? null,
      },
      event: {
        id: event.id, name: event.name, slug: event.slug, location: event.location,
        startDate: event.startDate, endDate: event.endDate,
        logoUrl: event.logoUrl ?? null,
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

  // ── Sponsor Meeting Status Updates (token-gated) ─────────────────────────

  app.patch("/api/sponsor-meetings/:id/status", async (req, res) => {
    const { token, status, meetingLink, sponsorNote } = req.body;
    if (!token) return res.status(401).json({ message: "Token required" });

    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const existing = await storage.getMeeting(req.params.id);
    if (!existing) return res.status(404).json({ message: "Meeting not found" });

    // Security: meeting must belong to the sponsor and event on the token
    if (existing.sponsorId !== tokenRecord.sponsorId || existing.eventId !== tokenRecord.eventId) {
      return res.status(403).json({ message: "Access denied" });
    }

    // Validate allowed status transitions per meeting type/status
    const allowedTransitions: Record<string, string[]> = {
      Scheduled:  ["Completed", "Cancelled"],
      Pending:    ["Confirmed", "Declined", "Cancelled"],
      Confirmed:  ["Completed", "Cancelled"],
    };
    const allowed = allowedTransitions[existing.status as string] ?? [];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Cannot change status from ${existing.status} to ${status}` });
    }

    const updateData: Record<string, unknown> = { status };
    if (meetingLink !== undefined) updateData.meetingLink = meetingLink || null;
    if (sponsorNote !== undefined) updateData.notes = sponsorNote || null;

    const meeting = await storage.updateMeeting(req.params.id, updateData);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });

    // Fire status-change notifications
    let notifType: SponsorNotificationType | null = null;
    if (status === "Confirmed" && existing.meetingType === "online_request") notifType = "request_confirmed";
    else if (status === "Declined" && existing.meetingType === "online_request") notifType = "request_declined";
    else if (status === "Cancelled") notifType = "meeting_cancelled";
    else if (status === "Completed") notifType = "meeting_completed";

    if (notifType) {
      fireNotification(notifType, meeting.id, meeting.sponsorId, meeting.eventId, meeting.attendeeId, meeting.date, meeting.time);
    }

    res.json({ ok: true, status: meeting.status, meetingLink: meeting.meetingLink ?? null });
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

  // ── App Settings ──────────────────────────────────────────────────────────

  app.get("/api/settings", requireAuth, async (_req, res) => {
    res.json(await storage.getSettings());
  });

  app.put("/api/settings", requireAuth, async (req, res) => {
    const settings = await storage.getSettings();
    if (req.session.role !== "admin") {
      if (!settings.allowManagersToEditSettings) {
        return res.status(403).json({ message: "Managers are not allowed to edit settings" });
      }
      // Managers cannot change the access control flags
      delete req.body.allowManagersToArchive;
      delete req.body.allowManagersToEditBranding;
      delete req.body.allowManagersToEditSettings;
    }
    const updated = await storage.updateSettings(req.body);
    res.json(updated);
  });

  // ── App Branding ──────────────────────────────────────────────────────────

  app.get("/api/branding-public", async (_req, res) => {
    res.json(await storage.getBranding());
  });

  app.get("/api/branding", requireAuth, async (_req, res) => {
    res.json(await storage.getBranding());
  });

  app.put("/api/branding", requireAuth, async (req, res) => {
    if (req.session.role !== "admin") {
      const settings = await storage.getSettings();
      if (!settings.allowManagersToEditBranding) {
        return res.status(403).json({ message: "Managers are not allowed to edit branding" });
      }
    }
    const updated = await storage.updateBranding(req.body);
    res.json(updated);
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
      sponsor: { name: sponsor.name, level: ((sponsor.assignedEvents ?? []).find((ae) => ae.eventId === eventId)?.sponsorshipLevel ?? sponsor.level ?? "") },
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

  // ── Eventzilla Webhook — Zapier registration intake ────────────────────────
  app.post("/api/integrations/eventzilla/registration", async (req, res) => {
    const secret = process.env.EVENTZILLA_WEBHOOK_SECRET;
    const incomingSecret = req.headers["x-converge-secret"];

    // Auth check
    if (!incomingSecret) {
      console.log("[eventzilla] 401 — missing x-converge-secret header");
      return res.status(401).json({ ok: false, error: "Missing authentication header" });
    }
    if (!secret || incomingSecret !== secret) {
      console.log("[eventzilla] 401 — invalid secret");
      return res.status(401).json({ ok: false, error: "Invalid authentication" });
    }

    const { eventCode, registrationId, firstName, lastName, email, company, title, status, phone } = req.body ?? {};

    console.log(`[eventzilla] webhook received — eventCode=${eventCode} email=${email} registrationId=${registrationId}`);

    // Validate required fields
    if (!eventCode || !registrationId || !firstName || !lastName || !email) {
      console.log("[eventzilla] 400 — missing required fields");
      return res.status(400).json({ ok: false, error: "Missing required fields: eventCode, registrationId, firstName, lastName, email" });
    }

    // Look up event by slug (eventCode = slug)
    const allEvents = await storage.getEvents();
    const event = allEvents.find((e) => e.slug?.toLowerCase() === String(eventCode).toLowerCase());
    if (!event) {
      console.log(`[eventzilla] 400 — unknown eventCode: ${eventCode}`);
      return res.status(400).json({ ok: false, error: `Unknown eventCode: ${eventCode}` });
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");

    // Upsert: check active attendee first, then archived
    const existing = await storage.getAttendeeByEmailAndEvent(String(email).toLowerCase(), event.id);

    if (existing) {
      // Update existing active attendee
      await storage.updateAttendee(existing.id, {
        firstName:              String(firstName),
        lastName:               String(lastName),
        name:                   fullName,
        company:                company ? String(company) : existing.company,
        title:                  title   ? String(title)   : existing.title,
        phone:                  phone   ? String(phone)   : existing.phone ?? undefined,
        externalSource:         "eventzilla",
        externalRegistrationId: String(registrationId),
      });
      console.log(`[eventzilla] updated attendee ${existing.id} for ${email} / ${eventCode}`);
      return res.json({ ok: true, action: "updated", attendeeId: existing.id, eventCode });
    }

    // Check archived
    const archived = await storage.getArchivedAttendeeByEmailAndEvent(String(email).toLowerCase(), event.id);
    if (archived) {
      await storage.updateAttendee(archived.id, {
        firstName:              String(firstName),
        lastName:               String(lastName),
        name:                   fullName,
        company:                company ? String(company) : archived.company,
        title:                  title   ? String(title)   : archived.title,
        phone:                  phone   ? String(phone)   : archived.phone ?? undefined,
        archiveState:           "active",
        archiveSource:          null,
        externalSource:         "eventzilla",
        externalRegistrationId: String(registrationId),
      });
      console.log(`[eventzilla] reactivated + updated archived attendee ${archived.id} for ${email} / ${eventCode}`);
      return res.json({ ok: true, action: "updated", attendeeId: archived.id, eventCode });
    }

    // Create new attendee
    const created = await storage.createAttendee({
      firstName:              String(firstName),
      lastName:               String(lastName),
      name:                   fullName,
      email:                  String(email).toLowerCase(),
      company:                company ? String(company) : "",
      title:                  title   ? String(title)   : "",
      phone:                  phone   ? String(phone)   : undefined,
      assignedEvent:          event.id,
      archiveState:           "active",
      archiveSource:          null,
      externalSource:         "eventzilla",
      externalRegistrationId: String(registrationId),
    });
    console.log(`[eventzilla] created attendee ${created.id} for ${email} / ${eventCode}`);
    return res.status(201).json({ ok: true, action: "created", attendeeId: created.id, eventCode });
  });

  // ── Data Exchange ─────────────────────────────────────────────────────────

  app.get("/api/admin/data-exchange/logs", requireAuth, async (_req, res) => {
    res.json(await storage.getDataExchangeLogs());
  });

  // Import attendees — expects JSON body: { rows: object[], fileName: string }
  app.post("/api/admin/data-exchange/import/attendees", requireAuth, async (req, res) => {
    const { rows = [], fileName = "upload.csv" } = req.body;
    const adminUser = (req as any).user?.name ?? "admin";
    const allEvents = await storage.getEvents();

    let importedCount = 0;
    let updatedCount = 0;
    const rejected: { row: number; identifier: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      // Validate required fields
      if (!row.email || !row.eventCode || !row.firstName || !row.lastName) {
        rejected.push({ row: rowNum, identifier: row.email || `row ${rowNum}`, reason: "Missing required fields: eventCode, firstName, lastName, email" });
        continue;
      }

      // Validate email format
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        rejected.push({ row: rowNum, identifier: row.email, reason: "Invalid email format" });
        continue;
      }

      // Resolve event
      const event = allEvents.find((e) => e.slug.toLowerCase() === String(row.eventCode).toLowerCase());
      if (!event) {
        rejected.push({ row: rowNum, identifier: row.email, reason: `Unknown eventCode: ${row.eventCode}` });
        continue;
      }

      // Validate status if provided
      const validStatuses = ["active", "archived"];
      if (row.status && !validStatuses.includes(row.status.toLowerCase())) {
        rejected.push({ row: rowNum, identifier: row.email, reason: `Invalid status: ${row.status}` });
        continue;
      }

      const email = String(row.email).toLowerCase();

      // Check for existing active attendee
      const existing = await storage.getAttendeeByEmailAndEvent(email, event.id);
      if (existing) {
        await storage.updateAttendee(existing.id, {
          firstName: row.firstName ?? existing.firstName,
          lastName: row.lastName ?? existing.lastName,
          company: row.company ?? existing.company,
          title: row.title ?? existing.title,
          phone: row.phone ?? existing.phone,
          externalSource: row.source ? String(row.source) : (existing.externalSource ?? "csv"),
          externalRegistrationId: row.externalRegistrationId ? String(row.externalRegistrationId) : existing.externalRegistrationId,
        });
        updatedCount++;
        continue;
      }

      // Check archived
      const archived = await storage.getArchivedAttendeeByEmailAndEvent(email, event.id);
      if (archived) {
        await storage.updateAttendee(archived.id, {
          firstName: row.firstName ?? archived.firstName,
          lastName: row.lastName ?? archived.lastName,
          company: row.company ?? archived.company,
          title: row.title ?? archived.title,
          phone: row.phone ?? archived.phone,
          archiveState: "active",
          archiveSource: null,
          externalSource: row.source ? String(row.source) : (archived.externalSource ?? "csv"),
        });
        updatedCount++;
        continue;
      }

      // Create new
      await storage.createAttendee({
        firstName: String(row.firstName),
        lastName: String(row.lastName),
        name: `${row.firstName} ${row.lastName}`.trim(),
        email,
        company: row.company ? String(row.company) : "",
        title: row.title ? String(row.title) : "",
        phone: row.phone ? String(row.phone) : undefined,
        assignedEvent: event.id,
        archiveState: "active",
        archiveSource: null,
        externalSource: row.source ? String(row.source) : "csv",
        externalRegistrationId: row.externalRegistrationId ? String(row.externalRegistrationId) : undefined,
      });
      importedCount++;
    }

    await storage.createDataExchangeLog({
      category: "attendees",
      operation: "import",
      adminUser,
      fileName,
      totalRows: rows.length,
      importedCount,
      updatedCount,
      rejectedCount: rejected.length,
    });

    res.json({ totalRows: rows.length, importedCount, updatedCount, rejectedCount: rejected.length, rejected });
  });

  // Import sponsors
  app.post("/api/admin/data-exchange/import/sponsors", requireAuth, async (req, res) => {
    const { rows = [], fileName = "upload.csv" } = req.body;
    const adminUser = (req as any).user?.name ?? "admin";
    const allEvents = await storage.getEvents();
    const allSponsors = await storage.getSponsors();

    let importedCount = 0;
    let updatedCount = 0;
    const rejected: { row: number; identifier: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;

      if (!row.sponsorName) {
        rejected.push({ row: rowNum, identifier: `row ${rowNum}`, reason: "Missing required field: sponsorName" });
        continue;
      }

      const validLevels = ["Platinum", "Gold", "Silver", "Bronze"];
      if (row.sponsorshipLevel && !validLevels.includes(row.sponsorshipLevel)) {
        rejected.push({ row: rowNum, identifier: row.sponsorName, reason: `Invalid sponsorship level: ${row.sponsorshipLevel}` });
        continue;
      }

      // Resolve event if eventCode provided
      let event = null;
      if (row.eventCode) {
        event = allEvents.find((e) => e.slug.toLowerCase() === String(row.eventCode).toLowerCase());
        if (!event) {
          rejected.push({ row: rowNum, identifier: row.sponsorName, reason: `Unknown eventCode: ${row.eventCode}` });
          continue;
        }
      }

      // Find existing sponsor by name (case-insensitive)
      const existing = allSponsors.find((s) => s.name.toLowerCase() === String(row.sponsorName).toLowerCase());

      const solutionTypes = [row.solutionType1, row.solutionType2, row.solutionType3].filter(Boolean);

      if (existing) {
        // Update sponsor master fields
        const updates: any = {};
        if (row.logoUrl) updates.logoUrl = row.logoUrl;
        if (row.status === "archived") { updates.archiveState = "archived"; updates.archiveSource = "manual"; }
        else if (row.status === "active") { updates.archiveState = "active"; updates.archiveSource = null; }
        if (row.shortDescription) updates.shortDescription = row.shortDescription;
        if (row.websiteUrl) updates.websiteUrl = row.websiteUrl;
        if (row.linkedinUrl) updates.linkedinUrl = row.linkedinUrl;
        if (row.contactName) updates.contactName = row.contactName;
        if (row.contactEmail) updates.contactEmail = row.contactEmail;
        if (row.contactPhone) updates.contactPhone = row.contactPhone;
        if (solutionTypes.length > 0) updates.attributes = solutionTypes;

        // Update event assignment if event provided
        if (event && row.sponsorshipLevel) {
          const links = existing.assignedEvents ?? [];
          const existingLink = links.find((ae) => ae.eventId === event!.id);
          if (existingLink) {
            updates.assignedEvents = links.map((ae) =>
              ae.eventId === event!.id ? { ...ae, sponsorshipLevel: row.sponsorshipLevel as any } : ae
            );
          } else {
            updates.assignedEvents = [...links, { eventId: event.id, sponsorshipLevel: row.sponsorshipLevel as any, archiveState: "active" as const, archiveSource: null }];
          }
        }

        await storage.updateSponsor(existing.id, updates);
        updatedCount++;
        // Refresh sponsor list for subsequent rows
        const idx = allSponsors.findIndex((s) => s.id === existing.id);
        if (idx >= 0) allSponsors[idx] = { ...allSponsors[idx], ...updates };
      } else {
        // Create new sponsor
        const assignedEvents = event && row.sponsorshipLevel
          ? [{ eventId: event.id, sponsorshipLevel: row.sponsorshipLevel as any, archiveState: "active" as const, archiveSource: null }]
          : [];
        const created = await storage.createSponsor({
          name: String(row.sponsorName),
          logoUrl: row.logoUrl || undefined,
          archiveState: row.status === "archived" ? "archived" : "active",
          archiveSource: null,
          shortDescription: row.shortDescription || undefined,
          websiteUrl: row.websiteUrl || undefined,
          linkedinUrl: row.linkedinUrl || undefined,
          contactName: row.contactName || undefined,
          contactEmail: row.contactEmail || undefined,
          contactPhone: row.contactPhone || undefined,
          assignedEvents,
          allowOnlineMeetings: false,
          attributes: solutionTypes.length > 0 ? solutionTypes : [],
        });
        allSponsors.push(created);
        importedCount++;
      }
    }

    await storage.createDataExchangeLog({ category: "sponsors", operation: "import", adminUser, fileName, totalRows: rows.length, importedCount, updatedCount, rejectedCount: rejected.length });
    res.json({ totalRows: rows.length, importedCount, updatedCount, rejectedCount: rejected.length, rejected });
  });

  // Import meetings
  app.post("/api/admin/data-exchange/import/meetings", requireAuth, async (req, res) => {
    const { rows = [], fileName = "upload.csv" } = req.body;
    const adminUser = (req as any).user?.name ?? "admin";
    const allEvents = await storage.getEvents();
    const allSponsors = await storage.getSponsors();

    let importedCount = 0;
    const rejected: { row: number; identifier: string; reason: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowNum = i + 1;
      const identifier = `${row.sponsorName} / ${row.attendeeEmail} / ${row.date}`;

      if (!row.eventCode || !row.sponsorName || !row.attendeeEmail || !row.attendeeFirstName || !row.attendeeLastName || !row.date || !row.time) {
        rejected.push({ row: rowNum, identifier, reason: "Missing required fields: eventCode, sponsorName, attendeeEmail, attendeeFirstName, attendeeLastName, date, time" });
        continue;
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.attendeeEmail)) {
        rejected.push({ row: rowNum, identifier, reason: "Invalid attendeeEmail format" });
        continue;
      }

      const event = allEvents.find((e) => e.slug.toLowerCase() === String(row.eventCode).toLowerCase());
      if (!event) {
        rejected.push({ row: rowNum, identifier, reason: `Unknown eventCode: ${row.eventCode}` });
        continue;
      }

      const sponsor = allSponsors.find((s) => s.name.toLowerCase() === String(row.sponsorName).toLowerCase());
      if (!sponsor) {
        rejected.push({ row: rowNum, identifier, reason: `Unknown sponsor: ${row.sponsorName}` });
        continue;
      }

      const validTypes = ["onsite", "online_request"];
      const meetingType = row.type && validTypes.includes(row.type) ? row.type : "onsite";

      const validStatuses = ["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed", "Declined"];
      if (row.status && !validStatuses.includes(row.status)) {
        rejected.push({ row: rowNum, identifier, reason: `Invalid status: ${row.status}` });
        continue;
      }

      // Resolve attendee
      const email = String(row.attendeeEmail).toLowerCase();
      let attendeeId: string;
      const existingAttendee = await storage.getAttendeeByEmailAndEvent(email, event.id);
      if (existingAttendee) {
        attendeeId = existingAttendee.id;
      } else {
        const created = await storage.createAttendee({
          firstName: String(row.attendeeFirstName),
          lastName: String(row.attendeeLastName),
          name: `${row.attendeeFirstName} ${row.attendeeLastName}`.trim(),
          email,
          company: row.company ? String(row.company) : "",
          title: row.title ? String(row.title) : "",
          assignedEvent: event.id,
          archiveState: "active",
          archiveSource: null,
          externalSource: "csv",
        });
        attendeeId = created.id;
      }

      await storage.createMeeting({
        eventId: event.id,
        sponsorId: sponsor.id,
        attendeeId,
        meetingType: meetingType as any,
        date: String(row.date),
        time: String(row.time),
        location: row.locationOrPlatform ? String(row.locationOrPlatform) : (meetingType === "online_request" ? "Online" : "TBD"),
        platform: row.locationOrPlatform && meetingType === "online_request" ? String(row.locationOrPlatform) : null,
        preferredTimezone: row.timezone ? String(row.timezone) : null,
        status: row.status ? String(row.status) as any : "Scheduled",
        source: row.source === "public" ? "public" : "admin",
        notes: row.notes ? String(row.notes) : null,
        archiveState: "active",
        archiveSource: null,
      });
      importedCount++;
    }

    await storage.createDataExchangeLog({ category: "meetings", operation: "import", adminUser, fileName, totalRows: rows.length, importedCount, updatedCount: 0, rejectedCount: rejected.length });
    res.json({ totalRows: rows.length, importedCount, updatedCount: 0, rejectedCount: rejected.length, rejected });
  });

  return httpServer;
}
