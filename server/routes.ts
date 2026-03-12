import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertSponsorSchema, insertAttendeeSchema, insertMeetingSchema, manualAttendeeSchema, insertInformationRequestSchema, type InsertEvent, type InsertSponsor, type InsertAttendee, type EventSponsorLink, type SponsorNotificationType, type UserPermissions, type InformationRequestStatus, INFORMATION_REQUEST_STATUSES, DEFAULT_USER_PERMISSIONS, ADMIN_PERMISSIONS } from "@shared/schema";
import { requireAuth, requireAdmin, stripPassword } from "./auth";
import { buildSponsorReportPDF } from "./pdf-report";
import { sendMeetingConfirmationToAttendee, sendMeetingNotificationToSponsor, sendInformationRequestNotificationToSponsor, sendInformationRequestConfirmationToAttendee } from "../services/emailService";
import multer from "multer";
import path from "path";
import { randomBytes, createHash } from "crypto";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { generateUploadUrl, generateDownloadUrl, buildObjectKeyFlat } from "./services/fileStorageService";

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

  // In-memory rate limiting for forgot-password (3 requests per 15 min per email)
  const forgotPasswordAttempts = new Map<string, { count: number; resetAt: number }>();
  function checkForgotPasswordRateLimit(email: string): boolean {
    const now = Date.now();
    const record = forgotPasswordAttempts.get(email);
    if (!record || now > record.resetAt) {
      forgotPasswordAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return true;
    }
    if (record.count >= 3) return false;
    record.count++;
    return true;
  }

  app.post("/api/auth/forgot-password", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const normalizedEmail = String(email).toLowerCase().trim();
    const neutralMessage = "If an account exists for that email, a password reset link has been sent.";

    if (!checkForgotPasswordRateLimit(normalizedEmail)) {
      return res.status(429).json({ message: "Too many reset requests. Please wait 15 minutes before trying again." });
    }

    const user = await storage.getUserByEmail(normalizedEmail);
    if (!user || !user.isActive) {
      return res.json({ message: neutralMessage });
    }

    const tokenRecord = await storage.createPasswordResetToken(user.id);
    console.log(`[PASSWORD RESET] Token generated for ${normalizedEmail} — expires: ${new Date(tokenRecord.expiresAt).toISOString()}`);

    // Send email via Brevo (fire-and-forget)
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://concierge.convergeevents.com";
    try {
      const { sendPasswordResetEmail } = await import("../services/emailService.js");
      sendPasswordResetEmail(storage, user, tokenRecord.token, baseUrl).catch((err: any) => {
        console.error(`[PASSWORD RESET] Failed to send email to ${normalizedEmail}: ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error(`[PASSWORD RESET] Email service import failed: ${err?.message ?? err}`);
    }

    res.json({ message: neutralMessage });
  });

  app.post("/api/auth/reset-password", async (req, res) => {
    const { token, newPassword } = req.body;
    if (!token || !newPassword) return res.status(400).json({ message: "Token and newPassword are required" });
    if (newPassword.length < 8) return res.status(400).json({ message: "Password must be at least 8 characters" });
    const hasUpper = /[A-Z]/.test(newPassword);
    const hasLower = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);
    if (!hasUpper || !hasLower || !hasNumber) {
      return res.status(400).json({ message: "Password must contain at least one uppercase letter, one lowercase letter, and one number" });
    }
    const record = await storage.getPasswordResetToken(token);
    if (!record) return res.status(400).json({ message: "This password reset link is invalid or has expired." });
    if (record.used) return res.status(400).json({ message: "This password reset link has already been used." });
    if (Date.now() > record.expiresAt) return res.status(400).json({ message: "This password reset link has expired. Please request a new one." });
    await storage.updateUserPassword(record.userId, newPassword);
    await storage.markResetTokenUsed(token);
    console.log(`[PASSWORD RESET] Password successfully reset for user ${record.userId}`);
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

  app.post("/api/attendees/prefill-lookup", async (req, res) => {
    const { eventId, email } = req.body ?? {};
    if (!eventId || !email || typeof email !== "string") {
      return res.json({ found: false });
    }
    try {
      const attendee = await storage.getAttendeeByEmailAndEvent(email.toLowerCase().trim(), eventId);
      if (attendee && (attendee.archiveState ?? "active") === "active") {
        const firstName = attendee.firstName || attendee.name?.split(" ")[0] || "";
        const lastName  = attendee.lastName  || attendee.name?.split(" ").slice(1).join(" ") || "";
        console.log(`[PREFILL LOOKUP] Match: ${attendee.email} → ${firstName} ${lastName} (event ${eventId})`);
        return res.json({
          found: true,
          attendee: {
            attendeeId: attendee.id,
            firstName,
            lastName,
            email: attendee.email,
            company: attendee.company ?? "",
            title: attendee.title ?? "",
          },
        });
      }
      console.log(`[PREFILL LOOKUP] No match: ${email} (event ${eventId})`);
      return res.json({ found: false });
    } catch (err) {
      console.error("[PREFILL LOOKUP] Error:", err);
      return res.json({ found: false });
    }
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

    // Per-event action flag validation (T004)
    // Only apply to public bookings (admin bookings bypass these gates)
    if (parsed.data.source === "public") {
      const sponsor = await storage.getSponsor(parsed.data.sponsorId);
      if (sponsor) {
        const link = (sponsor.assignedEvents ?? []).find(
          ae => ae.eventId === parsed.data.eventId && (ae.archiveState ?? "active") === "active"
        );
        if (parsed.data.meetingType === "online_request") {
          const onlineEnabled = link?.onlineMeetingEnabled ?? sponsor.allowOnlineMeetings ?? true;
          if (!onlineEnabled) {
            return res.status(403).json({ message: "Online meetings are not available for this sponsor at this event." });
          }
        } else {
          const onsiteEnabled = link?.onsiteMeetingEnabled ?? true;
          if (!onsiteEnabled) {
            return res.status(403).json({ message: "Onsite meetings are not available for this sponsor at this event." });
          }
        }
      }
    }

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

    // Block access validation: if sponsor has custom blocks, booking must fall within them
    if (parsed.data.source === "public" && parsed.data.meetingType !== "online_request") {
      const [blockEvent, blockSponsor] = await Promise.all([
        storage.getEvent(parsed.data.eventId),
        storage.getSponsor(parsed.data.sponsorId),
      ]);
      if (blockEvent && blockSponsor) {
        const blockLink = (blockSponsor.assignedEvents ?? []).find(
          (ae) => ae.eventId === parsed.data.eventId && (ae.archiveState ?? "active") === "active"
        );
        if (blockLink && blockLink.useDefaultBlocks === false && (blockLink.selectedBlockIds ?? []).length > 0) {
          const allowedBlocks = (blockEvent.meetingBlocks ?? []).filter((b) =>
            blockLink.selectedBlockIds!.includes(b.id)
          );
          const toMinsLocal = (t: string) => { const [h, m] = t.split(":").map(Number); return h * 60 + m; };
          const bookingMins = toMinsLocal(parsed.data.time);
          const inAllowedBlock = allowedBlocks.some(
            (b) =>
              b.date === parsed.data.date &&
              toMinsLocal(b.startTime) <= bookingMins &&
              bookingMins < toMinsLocal(b.endTime)
          );
          if (!inAllowedBlock) {
            return res.status(400).json({ message: "This time slot is not within the sponsor's available meeting blocks." });
          }
        }
      }
    }

    // Only check for slot conflicts on onsite meetings
    if (parsed.data.meetingType !== "online_request") {
      const { eventId, sponsorId, attendeeId, date, time, location } = parsed.data;
      const [sponsorConflict, attendeeConflict, locationConflict] = await Promise.all([
        storage.getMeetingConflict(eventId, sponsorId, date, time),
        storage.getAttendeeConflict(eventId, attendeeId, date, time),
        location ? storage.getLocationConflict(eventId, location, date, time) : Promise.resolve(undefined),
      ]);
      if (sponsorConflict) {
        return res.status(409).json({ conflict: true, message: "This sponsor already has a meeting at this time." });
      }
      if (attendeeConflict) {
        return res.status(409).json({ conflict: true, message: "This attendee already has a meeting at this time." });
      }
      if (locationConflict) {
        return res.status(409).json({ conflict: true, message: "This location is already booked at this time." });
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

    // Send emails (fire-and-forget — never block the meeting response)
    ;(async () => {
      try {
        const [meetingAttendee, meetingSponsor, meetingEvent] = await Promise.all([
          storage.getAttendee(meeting.attendeeId),
          storage.getSponsor(meeting.sponsorId),
          storage.getEvent(meeting.eventId),
        ]);
        // Look up a sponsor token for dashboard link
        const sponsorTokens = await storage.getSponsorTokensBySponsor(meeting.sponsorId).catch(() => []);
        const activeToken = sponsorTokens.find((t: any) => t.isActive && t.eventId === meeting.eventId);
        await Promise.all([
          sendMeetingConfirmationToAttendee(storage, meetingAttendee, meetingSponsor, meeting, meetingEvent),
          sendMeetingNotificationToSponsor(storage, meetingAttendee, meetingSponsor, meeting, meetingEvent, activeToken?.token ?? null),
        ]);
      } catch (err: any) {
        console.error(`[EMAIL] Error sending meeting emails for meeting ${meeting.id}:`, err?.message ?? err);
      }
    })();

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
      const { sponsorId, attendeeId, date, time, location } = merged;
      const [sponsorConflict, attendeeConflict, locationConflict] = await Promise.all([
        storage.getMeetingConflict(eventId, sponsorId, date, time, req.params.id),
        storage.getAttendeeConflict(eventId, attendeeId, date, time, req.params.id),
        location ? storage.getLocationConflict(eventId, location, date, time, req.params.id) : Promise.resolve(undefined),
      ]);
      if (sponsorConflict) {
        return res.status(409).json({ conflict: true, message: "This sponsor already has a meeting at this time." });
      }
      if (attendeeConflict) {
        return res.status(409).json({ conflict: true, message: "This attendee already has a meeting at this time." });
      }
      if (locationConflict) {
        return res.status(409).json({ conflict: true, message: "This location is already booked at this time." });
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

  // ── Sponsor Magic Login ───────────────────────────────────────────────────

  // Rate limiting for sponsor login requests (3 per 15 min per email)
  const sponsorLoginAttempts = new Map<string, { count: number; resetAt: number }>();
  function checkSponsorLoginRateLimit(email: string): boolean {
    const now = Date.now();
    const record = sponsorLoginAttempts.get(email);
    if (!record || now > record.resetAt) {
      sponsorLoginAttempts.set(email, { count: 1, resetAt: now + 15 * 60 * 1000 });
      return true;
    }
    if (record.count >= 3) return false;
    record.count++;
    return true;
  }

  app.post("/api/sponsor/login-request", async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });
    const normalizedEmail = String(email).toLowerCase().trim();
    const neutralMessage = "If an account exists for that email, a secure login link has been sent.";

    if (!checkSponsorLoginRateLimit(normalizedEmail)) {
      return res.status(429).json({ message: "Too many requests. Please wait 15 minutes before trying again." });
    }

    const sponsorUser = await storage.getSponsorUserByEmail(normalizedEmail);
    if (!sponsorUser || !sponsorUser.isActive) {
      return res.json({ message: neutralMessage });
    }

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await storage.invalidateSponsorLoginTokens(sponsorUser.id);
    await storage.createSponsorLoginToken({
      sponsorUserId: sponsorUser.id,
      sponsorId: sponsorUser.sponsorId,
      tokenHash,
      expiresAt,
    });

    const sponsor = await storage.getSponsor(sponsorUser.sponsorId);
    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://concierge.convergeevents.com";

    try {
      const { sendSponsorMagicLoginEmail } = await import("../services/emailService.js");
      sendSponsorMagicLoginEmail(storage, sponsorUser, sponsor, rawToken, baseUrl, null).catch((err: any) => {
        console.error(`[SPONSOR MAGIC LOGIN] Email failed for ${normalizedEmail}: ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error(`[SPONSOR MAGIC LOGIN] Email service import failed: ${err?.message ?? err}`);
    }

    console.log(`[SPONSOR MAGIC LOGIN] Magic link generated for ${normalizedEmail}`);
    res.json({ message: neutralMessage });
  });

  app.get("/api/sponsor/auth/magic", async (req, res) => {
    const { token } = req.query as { token?: string };
    if (!token) return res.redirect("/sponsor/login?error=missing_token");

    const tokenHash = createHash("sha256").update(token).digest("hex");
    const tokenRecord = await storage.getSponsorLoginTokenByHash(tokenHash);

    if (!tokenRecord) return res.redirect("/sponsor/login?error=invalid_token");
    if (tokenRecord.usedAt) return res.redirect("/sponsor/login?error=token_used");
    if (new Date(tokenRecord.expiresAt) < new Date()) return res.redirect("/sponsor/login?error=token_expired");

    await storage.markSponsorLoginTokenUsed(tokenRecord.id);
    await storage.updateSponsorUserLastLogin(tokenRecord.sponsorUserId);

    // Find an active sponsor token to use for the dashboard
    const tokens = await storage.getSponsorTokensBySponsor(tokenRecord.sponsorId);
    const activeToken = tokens.find((t) => t.isActive && new Date(t.expiresAt) > new Date());

    if (!activeToken) {
      return res.redirect("/sponsor/login?error=no_dashboard_access");
    }

    return res.redirect(`/sponsor-access/${activeToken.token}`);
  });

  // Admin action: send dashboard access email to sponsor's primary contact
  app.get("/api/admin/sponsors/:sponsorId/user", requireAdmin, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    if (!sponsor.contactEmail) return res.json({ user: null });
    const sponsorUser = await storage.getSponsorUserByEmail(sponsor.contactEmail);
    res.json({ user: sponsorUser ?? null });
  });

  app.post("/api/admin/sponsors/:sponsorId/send-access-email", requireAdmin, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    if (!sponsor.contactEmail) return res.status(400).json({ message: "Sponsor has no contact email configured" });

    const sponsorUser = await storage.upsertSponsorUser({
      sponsorId: sponsor.id,
      name: sponsor.contactName || sponsor.name,
      email: sponsor.contactEmail,
    });

    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await storage.invalidateSponsorLoginTokens(sponsorUser.id);
    await storage.createSponsorLoginToken({
      sponsorUserId: sponsorUser.id,
      sponsorId: sponsor.id,
      tokenHash,
      expiresAt,
    });

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://concierge.convergeevents.com";

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendSponsorMagicLoginEmail } = await import("../services/emailService.js");
      await sendSponsorMagicLoginEmail(storage, sponsorUser, sponsor, rawToken, baseUrl, null);
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message ?? String(err);
      console.error(`[SPONSOR ACCESS EMAIL] Failed for ${sponsor.contactEmail}: ${emailError}`);
    }

    console.log(`[SPONSOR ACCESS EMAIL] Sent to ${sponsor.contactEmail} for sponsor "${sponsor.name}"`);
    res.json({ ok: emailSent, sentTo: sponsor.contactEmail, error: emailError });
  });

  // ── Sponsor User CRUD ─────────────────────────────────────────────────────

  app.get("/api/admin/sponsors/:sponsorId/users", requireAuth, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const users = await storage.getSponsorUsersBySponsor(req.params.sponsorId);
    res.json(users);
  });

  app.post("/api/admin/sponsors/:sponsorId/users", requireAuth, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const { name, email, accessLevel, isPrimary, isActive } = req.body;
    if (!name?.trim() || !email?.trim()) return res.status(400).json({ message: "Name and email are required" });
    if (!["owner", "editor", "viewer"].includes(accessLevel)) return res.status(400).json({ message: "Invalid access level" });
    const existing = await storage.getSponsorUserByEmail(email.trim());
    if (existing && existing.sponsorId === req.params.sponsorId) return res.status(409).json({ message: "A user with this email already exists for this sponsor" });
    const user = await storage.createSponsorUser({ sponsorId: req.params.sponsorId, name: name.trim(), email: email.trim(), accessLevel, isPrimary: isPrimary === true, isActive: isActive !== false });
    if (isPrimary === true) await storage.setSponsorUserPrimary(user.id, req.params.sponsorId);
    res.json(user);
  });

  app.patch("/api/admin/sponsors/:sponsorId/users/:userId", requireAuth, async (req, res) => {
    const user = await storage.getSponsorUserById(req.params.userId);
    if (!user || user.sponsorId !== req.params.sponsorId) return res.status(404).json({ message: "Sponsor user not found" });
    const { name, email, accessLevel, isPrimary, isActive } = req.body;
    if (accessLevel && !["owner", "editor", "viewer"].includes(accessLevel)) return res.status(400).json({ message: "Invalid access level" });
    const updated = await storage.updateSponsorUser(req.params.userId, { name, email, accessLevel, isPrimary, isActive });
    if (isPrimary === true) await storage.setSponsorUserPrimary(req.params.userId, req.params.sponsorId);
    res.json(updated);
  });

  app.delete("/api/admin/sponsors/:sponsorId/users/:userId", requireAdmin, async (req, res) => {
    const user = await storage.getSponsorUserById(req.params.userId);
    if (!user || user.sponsorId !== req.params.sponsorId) return res.status(404).json({ message: "Sponsor user not found" });
    await storage.deleteSponsorUser(req.params.userId);
    res.json({ ok: true });
  });

  app.post("/api/admin/sponsors/:sponsorId/users/:userId/set-primary", requireAuth, async (req, res) => {
    const user = await storage.getSponsorUserById(req.params.userId);
    if (!user || user.sponsorId !== req.params.sponsorId) return res.status(404).json({ message: "Sponsor user not found" });
    await storage.setSponsorUserPrimary(req.params.userId, req.params.sponsorId);
    res.json({ ok: true });
  });

  app.post("/api/admin/sponsors/:sponsorId/users/:userId/send-access-email", requireAuth, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const sponsorUser = await storage.getSponsorUserById(req.params.userId);
    if (!sponsorUser || sponsorUser.sponsorId !== req.params.sponsorId) return res.status(404).json({ message: "Sponsor user not found" });
    if (!sponsorUser.isActive) return res.status(400).json({ message: "Sponsor user is inactive" });

    const { randomBytes, createHash } = await import("crypto");
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await storage.invalidateSponsorLoginTokens(sponsorUser.id);
    await storage.createSponsorLoginToken({ sponsorUserId: sponsorUser.id, sponsorId: sponsor.id, tokenHash, expiresAt });

    const baseUrl = process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : "https://concierge.convergeevents.com";

    let emailSent = false;
    let emailError: string | null = null;
    try {
      const { sendSponsorMagicLoginEmail } = await import("../services/emailService.js");
      await sendSponsorMagicLoginEmail(storage, sponsorUser, sponsor, rawToken, baseUrl, null);
      emailSent = true;
    } catch (err: any) {
      emailError = err?.message ?? String(err);
    }
    res.json({ ok: emailSent, sentTo: sponsorUser.email, error: emailError });
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
    const [notifications, analyticsData] = await Promise.all([
      storage.getNotificationsForSponsorEvent(tokenRecord.sponsorId, tokenRecord.eventId),
      storage.getAnalyticsSummary(tokenRecord.sponsorId, tokenRecord.eventId),
    ]);

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
      analytics: analyticsData,
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
      Scheduled:  ["Confirmed", "Completed", "Cancelled", "No-Show"],
      Pending:    ["Confirmed", "Declined", "Cancelled", "Scheduled"],
      Confirmed:  ["Scheduled", "Completed", "Cancelled", "No-Show"],
      Completed:  ["Scheduled", "Confirmed", "Cancelled"],
      Cancelled:  ["Scheduled", "Confirmed", "Completed"],
      "No-Show":  ["Scheduled", "Confirmed", "Cancelled"],
      Declined:   ["Scheduled", "Confirmed"],
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

  function fmtReportDate(d: Date | string): string {
    return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(new Date(d));
  }

  function fmtDateRange(start: Date | string, end: Date | string): string {
    const s = new Date(start);
    const e = new Date(end);
    const sMonth = s.toLocaleString("en-US", { month: "long" });
    const eMonth = e.toLocaleString("en-US", { month: "long" });
    const sDay = s.getDate();
    const eDay = e.getDate();
    const year = e.getFullYear();
    if (sMonth === eMonth) return `${sMonth} ${sDay}–${eDay}, ${year}`;
    return `${sMonth} ${sDay} – ${eMonth} ${eDay}, ${year}`;
  }

  async function buildReportData(sponsorId: string, eventId: string) {
    const [sponsor, event, allMeetings, allAttendees, infoRequestsList, analyticsData] = await Promise.all([
      storage.getSponsor(sponsorId),
      storage.getEvent(eventId),
      storage.getMeetings(),
      storage.getAttendees(),
      storage.listInformationRequests({ sponsorId, eventId }),
      storage.getAnalyticsSummary(sponsorId, eventId),
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

    const infoRequests = infoRequestsList.map((r) => ({
      id:                 r.id,
      attendeeFirstName:  r.attendeeFirstName,
      attendeeLastName:   r.attendeeLastName,
      attendeeEmail:      r.attendeeEmail,
      attendeeCompany:    r.attendeeCompany,
      attendeeTitle:      r.attendeeTitle,
      source:             r.source,
      status:             r.status,
      message:            r.message,
      createdAt:          r.createdAt.toISOString(),
    }));

    return {
      generatedAt: new Date(),
      event: {
        name:      event.name,
        slug:      event.slug,
        location:  event.location,
        startDate: fmtReportDate(event.startDate),
        endDate:   fmtReportDate(event.endDate),
        dateRange: fmtDateRange(event.startDate, event.endDate),
      },
      sponsor: { name: sponsor.name, level: ((sponsor.assignedEvents ?? []).find((ae) => ae.eventId === eventId)?.sponsorshipLevel ?? sponsor.level ?? "") },
      meetings,
      infoRequests,
      analytics: analyticsData,
    };
  }

  // Public: record a sponsor analytics event (fire-and-forget from frontend)
  app.post("/api/analytics/sponsor-event", async (req, res) => {
    const { sponsorId, eventId, eventType } = req.body ?? {};
    if (!sponsorId || !eventId || !eventType) return res.status(400).json({ error: "Missing fields" });
    try {
      await storage.createAnalyticsEvent({ sponsorId, eventId, eventType });
    } catch (_e) {
      // Silently fail — analytics should never break the user experience
    }
    res.status(204).end();
  });

  // Token-gated: sponsor downloads their own report
  app.get("/api/sponsor-report/pdf", async (req, res) => {
    const token = req.query.token as string;
    if (!token) return res.status(400).json({ message: "Token required" });

    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const users = await storage.getSponsorUsersBySponsor(tokenRecord.sponsorId);
    if (users && users.length > 0) {
      const primaryOwner = users.find((u) => u.isPrimary && u.accessLevel === "owner" && u.isActive);
      if (!primaryOwner) return res.status(403).json({ message: "You do not have permission to download sponsor data." });
    }

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

  // ── Nunify Meeting Export (mark as exported + create log) ──────────────────
  app.post("/api/admin/data-exchange/export/nunify-meetings", requireAdmin, async (req, res) => {
    const user = (req as any).user;
    const adminUser: string = user?.name || user?.username || "admin";
    const { meetingIds, eventId, eventCode, fileName, totalRows } = req.body;
    if (!Array.isArray(meetingIds) || !eventId) {
      return res.status(400).json({ error: "meetingIds (array) and eventId are required" });
    }
    await storage.markMeetingsNunifyExported(meetingIds, adminUser);
    await storage.createDataExchangeLog({
      category: "nunify-meetings",
      operation: "export",
      adminUser,
      fileName: fileName || "nunify_export.csv",
      eventId,
      eventCode: eventCode || "",
      totalRows: totalRows || meetingIds.length,
      importedCount: 0,
      updatedCount: 0,
      rejectedCount: 0,
    });
    res.json({ success: true, exported: meetingIds.length });
  });

  // ── Nunify Meeting Import ──────────────────────────────────────────────────
  app.post("/api/admin/data-exchange/import/nunify-meetings", requireAdmin, async (req, res) => {
    const user = (req as any).user;
    const adminUser: string = user?.name || user?.username || "admin";
    const { rows, eventId, fileName } = req.body;
    if (!Array.isArray(rows) || !eventId) {
      return res.status(400).json({ error: "rows (array) and eventId are required" });
    }
    const events = await storage.getEvents();
    const event = events.find(e => e.id === eventId);
    if (!event) return res.status(400).json({ error: "Event not found" });

    let importedCount = 0;
    let updatedCount = 0;
    const rejected: { row: number; data: any; error: string }[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (row.mode === "update" && row.existingMeetingId) {
          await storage.updateMeeting(row.existingMeetingId, {
            status: row.status || "Scheduled",
            nunifyExternalId: row.nunifyExternalId || undefined,
          });
          updatedCount++;
        } else {
          await storage.createMeeting({
            eventId: row.eventId,
            sponsorId: row.sponsorId,
            attendeeId: row.attendeeId,
            meetingType: row.meetingType || "onsite",
            date: row.date,
            time: row.time,
            location: row.location,
            status: row.status || "Scheduled",
            source: "admin",
            notes: row.notes || null,
            archiveState: "active",
            archiveSource: null,
            nunifyExternalId: row.nunifyExternalId || null,
          });
          importedCount++;
        }
      } catch (err: any) {
        rejected.push({ row: i + 1, data: row, error: err?.message || "Failed to save meeting" });
      }
    }

    await storage.createDataExchangeLog({
      category: "nunify-meetings",
      operation: "import",
      adminUser,
      fileName: fileName || "nunify_import.csv",
      eventId,
      eventCode: event.slug,
      totalRows: rows.length,
      importedCount,
      updatedCount,
      rejectedCount: rejected.length,
    });
    res.json({ totalRows: rows.length, importedCount, updatedCount, rejectedCount: rejected.length, rejected });
  });

  // ── User Permissions (Admin Only) ─────────────────────────────────────────

  app.get("/api/auth/me/permissions", requireAuth, async (req, res) => {
    const user = (req as any).user;
    if (!user) return res.status(401).json({ error: "Unauthorized" });
    if (user.role === "admin") {
      return res.json({ permissions: ADMIN_PERMISSIONS, isAdmin: true });
    }
    const record = await storage.getUserPermissions(user.id);
    const permissions = (record?.permissions as UserPermissions) ?? DEFAULT_USER_PERMISSIONS;
    res.json({ permissions, isAdmin: false });
  });

  app.get("/api/admin/users/:id/permissions", requireAdmin, async (req, res) => {
    const record = await storage.getUserPermissions(req.params.id);
    const permissions = (record?.permissions as UserPermissions) ?? DEFAULT_USER_PERMISSIONS;
    res.json({ permissions, updatedAt: record?.updatedAt ?? null, updatedBy: record?.updatedBy ?? null });
  });

  app.put("/api/admin/users/:id/permissions", requireAdmin, async (req, res) => {
    const adminUser = (req as any).user;
    const changedBy = adminUser?.name || adminUser?.username || "admin";
    const targetUser = await storage.getUser(req.params.id);
    if (!targetUser) return res.status(404).json({ error: "User not found" });
    if (targetUser.role === "admin") {
      return res.status(400).json({ error: "Cannot modify permissions for admin users" });
    }
    const newPermissions = req.body as UserPermissions;
    // Fetch existing to build audit log
    const existing = await storage.getUserPermissions(req.params.id);
    const prev = existing?.permissions as UserPermissions | undefined;
    const record = await storage.upsertUserPermissions(
      req.params.id,
      { ...DEFAULT_USER_PERMISSIONS, ...newPermissions },
      changedBy,
      targetUser.name || targetUser.username,
      prev
    );
    res.json({ permissions: record.permissions, updatedAt: record.updatedAt, updatedBy: record.updatedBy });
  });

  app.get("/api/admin/permission-audit-logs", requireAdmin, async (req, res) => {
    const userId = req.query.userId as string | undefined;
    const logs = await storage.getPermissionAuditLogs(userId);
    res.json(logs);
  });

  // ── Information Requests ──────────────────────────────────────────────────

  // Public: anyone can submit an information request
  app.post("/api/information-requests", async (req, res) => {
    const parsed = insertInformationRequestSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Validation failed", details: parsed.error.flatten() });

    const sponsor = await storage.getSponsor(parsed.data.sponsorId);
    if (!sponsor) return res.status(404).json({ error: "Sponsor not found" });

    // Information Request Action Flag Validation (T004)
    if (parsed.data.source === "Public" && parsed.data.eventId) {
      const link = (sponsor.assignedEvents ?? []).find(
        ae => ae.eventId === parsed.data.eventId && (ae.archiveState ?? "active") === "active"
      );
      const infoEnabled = link?.informationRequestEnabled ?? true;
      if (!infoEnabled) {
        return res.status(403).json({ error: "Information requests are not available for this sponsor at this event." });
      }
    }

    const record = await storage.createInformationRequest(parsed.data);

    // Send emails (fire-and-forget — never block the info request response)
    ;(async () => {
      try {
        const irEvent = parsed.data.eventId ? await storage.getEvent(parsed.data.eventId) : null;
        const sponsorTokens = await storage.getSponsorTokensBySponsor(sponsor.id).catch(() => []);
        const activeToken = sponsorTokens.find((t: any) => t.isActive && t.eventId === parsed.data.eventId);
        await Promise.all([
          sendInformationRequestNotificationToSponsor(storage, null, sponsor, record, irEvent, activeToken?.token ?? null),
          sendInformationRequestConfirmationToAttendee(storage, record, sponsor, irEvent),
        ]);
      } catch (err: any) {
        console.error(`[EMAIL] Error sending info request emails for request ${record.id}:`, err?.message ?? err);
      }
    })();

    res.status(201).json(record);
  });

  // Admin: list all information requests with optional filters
  app.get("/api/admin/information-requests", requireAuth, async (req, res) => {
    const { eventId, sponsorId, status } = req.query as Record<string, string | undefined>;
    const filters: { eventId?: string; sponsorId?: string; status?: InformationRequestStatus } = {};
    if (eventId) filters.eventId = eventId;
    if (sponsorId) filters.sponsorId = sponsorId;
    if (status && (INFORMATION_REQUEST_STATUSES as readonly string[]).includes(status)) {
      filters.status = status as InformationRequestStatus;
    }
    const requests = await storage.listInformationRequests(filters);
    res.json(requests);
  });

  // Admin: get single information request
  app.get("/api/admin/information-requests/:id", requireAuth, async (req, res) => {
    const record = await storage.getInformationRequest(req.params.id);
    if (!record) return res.status(404).json({ error: "Not found" });
    res.json(record);
  });

  // Admin: update status
  app.patch("/api/admin/information-requests/:id/status", requireAuth, async (req, res) => {
    const { status } = req.body;
    if (!status || !(INFORMATION_REQUEST_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const updated = await storage.updateInformationRequestStatus(req.params.id, status as InformationRequestStatus);
    if (!updated) return res.status(404).json({ error: "Not found" });
    res.json(updated);
  });

  // Sponsor dashboard: get current user context (access level / export permissions)
  app.get("/api/sponsor-dashboard/me", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.json({ sponsorUser: null });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.json({ sponsorUser: null });
    const { tokenRecord } = validation;

    const users = await storage.getSponsorUsersBySponsor(tokenRecord.sponsorId);
    if (!users || users.length === 0) {
      return res.json({ sponsorUser: { accessLevel: "owner", isPrimary: true, isActive: true, _fallback: true } });
    }
    const primaryOwner = users.find((u) => u.isPrimary && u.accessLevel === "owner" && u.isActive);
    if (primaryOwner) {
      return res.json({ sponsorUser: { id: primaryOwner.id, name: primaryOwner.name, email: primaryOwner.email, accessLevel: primaryOwner.accessLevel, isPrimary: primaryOwner.isPrimary, isActive: primaryOwner.isActive } });
    }
    return res.json({ sponsorUser: null });
  });

  // Sponsor dashboard: list information requests for this sponsor/event
  app.get("/api/sponsor-dashboard/information-requests", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const requests = await storage.listInformationRequests({ sponsorId: tokenRecord.sponsorId, eventId: tokenRecord.eventId });
    res.json(requests);
  });

  // Sponsor dashboard: update status
  app.patch("/api/sponsor-dashboard/information-requests/:id/status", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const { status } = req.body;
    if (!status || !(INFORMATION_REQUEST_STATUSES as readonly string[]).includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const existing = await storage.getInformationRequest(req.params.id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    // Sponsor may only update requests belonging to their own sponsor+event
    if (existing.sponsorId !== tokenRecord.sponsorId || existing.eventId !== tokenRecord.eventId) {
      return res.status(403).json({ error: "Access denied" });
    }
    const updated = await storage.updateInformationRequestStatus(req.params.id, status as InformationRequestStatus);
    res.json(updated);
  });

  // ── Sponsor Dashboard: Agreement Deliverables (Phase 2) ───────────────────

  // GET /api/sponsor-dashboard/agreement-deliverables — list sponsor-visible deliverables with child records
  app.get("/api/sponsor-dashboard/agreement-deliverables", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const all = await storage.listAgreementDeliverables({ sponsorId: tokenRecord.sponsorId, eventId: tokenRecord.eventId });
    const visible = all.filter((d) => d.sponsorVisible);

    // Attach child records for each deliverable in parallel
    const withChildren = await Promise.all(visible.map(async (d) => {
      const { internalNote: _drop, ...safe } = d as typeof d & { internalNote: unknown };
      const registrants = await storage.listDeliverableRegistrants(d.id);
      const speakers = await storage.listDeliverableSpeakers(d.id);
      return { ...safe, registrants, speakers };
    }));

    res.json(withChildren);
  });

  // PATCH /api/sponsor-dashboard/agreement-deliverables/:id — sponsor updates text input or status
  app.patch("/api/sponsor-dashboard/agreement-deliverables/:id", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable) return res.status(404).json({ error: "Not found" });
    if (deliverable.sponsorId !== tokenRecord.sponsorId || deliverable.eventId !== tokenRecord.eventId) {
      return res.status(403).json({ error: "Access denied" });
    }
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "This deliverable is not sponsor-editable" });

    const allowed: Record<string, unknown> = {};
    if (req.body.deliverableDescription !== undefined) allowed.deliverableDescription = req.body.deliverableDescription;
    if (req.body.sponsorFacingNote !== undefined) allowed.sponsorFacingNote = req.body.sponsorFacingNote;
    if (req.body.status !== undefined) allowed.status = req.body.status;

    const updated = await storage.updateAgreementDeliverable(req.params.id, allowed);
    const { internalNote: _drop, ...safe } = updated as typeof updated & { internalNote: unknown };
    res.json(safe);
  });

  // GET /api/sponsor-dashboard/agreement-deliverables/:id/registrants
  app.get("/api/sponsor-dashboard/agreement-deliverables/:id/registrants", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });

    res.json(await storage.listDeliverableRegistrants(req.params.id));
  });

  // POST /api/sponsor-dashboard/agreement-deliverables/:id/registrants
  app.post("/api/sponsor-dashboard/agreement-deliverables/:id/registrants", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    const { name, title, email } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: "name is required" });

    const registrant = await storage.createDeliverableRegistrant({ agreementDeliverableId: req.params.id, name: name.trim(), title: title?.trim() ?? null, email: email?.trim() ?? null });

    // Auto-update status if all quantity filled
    const all = await storage.listDeliverableRegistrants(req.params.id);
    if (deliverable.quantity && all.length >= deliverable.quantity) {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Submitted" });
    } else if (deliverable.status === "Not Started" || deliverable.status === "Awaiting Sponsor Input") {
      await storage.updateAgreementDeliverable(req.params.id, { status: "In Progress" });
    }

    res.json(registrant);
  });

  // PATCH /api/sponsor-dashboard/agreement-deliverables/:id/registrants/:rid
  app.patch("/api/sponsor-dashboard/agreement-deliverables/:id/registrants/:rid", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    const { name, title, email } = req.body;
    const updated = await storage.updateDeliverableRegistrant(req.params.rid, { name: name?.trim(), title: title?.trim() ?? null, email: email?.trim() ?? null });
    res.json(updated);
  });

  // DELETE /api/sponsor-dashboard/agreement-deliverables/:id/registrants/:rid
  app.delete("/api/sponsor-dashboard/agreement-deliverables/:id/registrants/:rid", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    await storage.deleteDeliverableRegistrant(req.params.rid);

    // Update status if needed
    const remaining = await storage.listDeliverableRegistrants(req.params.id);
    if (remaining.length === 0) {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Awaiting Sponsor Input" });
    } else if (deliverable.quantity && remaining.length < deliverable.quantity) {
      await storage.updateAgreementDeliverable(req.params.id, { status: "In Progress" });
    }

    res.json({ ok: true });
  });

  // GET /api/sponsor-dashboard/agreement-deliverables/:id/speakers
  app.get("/api/sponsor-dashboard/agreement-deliverables/:id/speakers", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });

    res.json(await storage.listDeliverableSpeakers(req.params.id));
  });

  // POST /api/sponsor-dashboard/agreement-deliverables/:id/speakers
  app.post("/api/sponsor-dashboard/agreement-deliverables/:id/speakers", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    const { speakerName, speakerTitle, speakerBio } = req.body;
    if (!speakerName?.trim()) return res.status(400).json({ error: "speakerName is required" });

    const speaker = await storage.createDeliverableSpeaker({ agreementDeliverableId: req.params.id, speakerName: speakerName.trim(), speakerTitle: speakerTitle?.trim() ?? null, speakerBio: speakerBio?.trim() ?? null });

    if (deliverable.status === "Not Started" || deliverable.status === "Awaiting Sponsor Input") {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Submitted" });
    }

    res.json(speaker);
  });

  // PATCH /api/sponsor-dashboard/agreement-deliverables/:id/speakers/:sid
  app.patch("/api/sponsor-dashboard/agreement-deliverables/:id/speakers/:sid", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    const { speakerName, speakerTitle, speakerBio } = req.body;
    const updated = await storage.updateDeliverableSpeaker(req.params.sid, { speakerName: speakerName?.trim(), speakerTitle: speakerTitle?.trim() ?? null, speakerBio: speakerBio?.trim() ?? null });
    res.json(updated);
  });

  // DELETE /api/sponsor-dashboard/agreement-deliverables/:id/speakers/:sid
  app.delete("/api/sponsor-dashboard/agreement-deliverables/:id/speakers/:sid", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId) return res.status(404).json({ error: "Not found" });
    if (!deliverable.sponsorEditable) return res.status(403).json({ error: "Not editable" });

    await storage.deleteDeliverableSpeaker(req.params.sid);
    if (deliverable.status === "Submitted") {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Awaiting Sponsor Input" });
    }

    res.json({ ok: true });
  });

  // Data Exchange: export information requests as JSON (frontend will convert to CSV)
  app.get("/api/admin/data-exchange/export/information-requests", requireAuth, async (req, res) => {
    const { eventId, sponsorId } = req.query as Record<string, string | undefined>;
    const filters: { eventId?: string; sponsorId?: string } = {};
    if (eventId) filters.eventId = eventId;
    if (sponsorId) filters.sponsorId = sponsorId;
    const requests = await storage.listInformationRequests(filters);
    res.json(requests);
  });

  // ── Email Center Routes (admin-only) ──────────────────────────────────────

  app.get("/api/admin/email-logs", requireAuth, async (req, res) => {
    const { emailType, status, eventId, search, from, to } = req.query as Record<string, string | undefined>;
    const filters: { emailType?: string; status?: string; eventId?: string; search?: string; from?: Date; to?: Date } = {};
    if (emailType) filters.emailType = emailType;
    if (status) filters.status = status;
    if (eventId) filters.eventId = eventId;
    if (search) filters.search = search;
    if (from) filters.from = new Date(from);
    if (to) filters.to = new Date(to);
    const limit = Math.min(parseInt(String(req.query.limit ?? "200")), 500);
    const offset = parseInt(String(req.query.offset ?? "0"));
    const logs = await storage.listEmailLogs(filters, limit, offset);
    res.json(logs);
  });

  app.get("/api/admin/email-logs/:id", requireAuth, async (req, res) => {
    const log = await storage.getEmailLog(req.params.id);
    if (!log) return res.status(404).json({ error: "Email log not found" });
    res.json(log);
  });

  app.post("/api/admin/email-logs/:id/resend", requireAdmin, async (req, res) => {
    const log = await storage.getEmailLog(req.params.id);
    if (!log) return res.status(404).json({ error: "Email log not found" });
    if (!log.htmlContent) return res.status(400).json({ error: "No HTML content stored for this email — cannot resend" });

    let status: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      const { sendEmail } = await import("../services/emailService.js");
      await sendEmail(log.recipientEmail, `[Resend] ${log.subject}`, log.htmlContent);
    } catch (err: any) {
      status = "failed";
      errorMessage = err?.message ?? String(err);
    }
    const newId = await storage.createEmailLog({
      emailType: log.emailType,
      recipientEmail: log.recipientEmail,
      subject: `[Resend] ${log.subject}`,
      htmlContent: log.htmlContent,
      eventId: log.eventId,
      sponsorId: log.sponsorId,
      attendeeId: log.attendeeId,
      status,
      errorMessage,
      resendOfId: log.id,
    });
    const newLog = await storage.getEmailLog(newId);
    res.json({ ok: true, newLogId: newId, status, log: newLog });
  });

  app.post("/api/admin/email-logs/send-test", requireAdmin, async (req, res) => {
    const { to, emailType } = req.body;
    if (!to || !emailType) return res.status(400).json({ error: "to and emailType are required" });

    const { sendEmail } = await import("../services/emailService.js");
    const templates = await import("../services/emailTemplates.js");

    let html: string;
    let subject: string;

    const demoAttendee = { firstName: "Alex", lastName: "Sample", name: "Alex Sample", company: "Example Corp", title: "VP of Innovation", email: to };
    const demoSponsor = { name: "Demo Sponsor", contactEmail: to };
    const demoEvent = { name: "Demo Conference 2026", slug: "DEMO2026" };
    const demoMeeting = { date: "2026-06-15", time: "10:00", meetingType: "onsite", location: "Booth A", eventId: "", sponsorId: "", attendeeId: "" };

    if (emailType === "meeting_confirmation_attendee") {
      subject = "Test: Your meeting is confirmed";
      html = templates.meetingConfirmationForAttendee({ attendeeFirstName: "Alex", sponsorName: "Demo Sponsor", eventName: "Demo Conference 2026", date: "2026-06-15", time: "10:00", location: "Booth A", meetingType: "onsite", eventSlug: "DEMO2026" });
    } else if (emailType === "meeting_notification_sponsor") {
      subject = "Test: New meeting scheduled with Alex Sample";
      html = templates.meetingNotificationForSponsor({ sponsorName: "Demo Sponsor", attendeeName: "Alex Sample", attendeeCompany: "Example Corp", attendeeTitle: "VP of Innovation", attendeeEmail: to, date: "2026-06-15", time: "10:00", meetingType: "onsite", location: "Booth A", eventName: "Demo Conference 2026", sponsorToken: null });
    } else if (emailType === "info_request_notification_sponsor") {
      subject = "Test: New information request from Alex Sample";
      html = templates.infoRequestNotificationForSponsor({ sponsorName: "Demo Sponsor", attendeeFirstName: "Alex", attendeeLastName: "Sample", attendeeEmail: to, attendeeCompany: "Example Corp", attendeeTitle: "VP of Innovation", message: "I would love to learn more about your platform.", eventName: "Demo Conference 2026", sponsorToken: null });
    } else if (emailType === "info_request_confirmation_attendee") {
      subject = "Test: Your information request has been sent";
      html = templates.infoRequestConfirmationForAttendee({ attendeeFirstName: "Alex", sponsorName: "Demo Sponsor", eventName: "Demo Conference 2026", eventSlug: "DEMO2026" });
    } else {
      subject = "Concierge Email Test";
      html = templates.meetingConfirmationForAttendee({ attendeeFirstName: "Admin", sponsorName: "Test Sponsor", eventName: "Test Event", date: "2026-06-15", time: "14:00", location: "Main Hall", meetingType: "onsite", eventSlug: null });
    }

    let sendStatus: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await sendEmail(to, subject, html);
    } catch (err: any) {
      sendStatus = "failed";
      errorMessage = err?.message ?? String(err);
    }
    const logId = await storage.createEmailLog({ emailType: emailType ?? "test_email", recipientEmail: to, subject, htmlContent: html, status: sendStatus, errorMessage });
    res.json({ ok: sendStatus === "sent", status: sendStatus, errorMessage, logId });
  });

  // ── Email Template Management (admin-only) ───────────────────────────────

  const SAMPLE_TEMPLATE_DATA: Record<string, string> = {
    attendee_first_name: "Dan",
    attendee_full_name: "Dan Carmody",
    sponsor_name: "eGain",
    event_name: "The 2026 Fintech Risk & Compliance Forum",
    event_code: "FRC2026",
    meeting_date: "October 5, 2026",
    meeting_time: "10:00 AM",
    meeting_location: "Booth A",
    meeting_type: "Onsite",
    status: "Confirmed",
    event_schedule_url: "https://concierge.convergeevents.com/event/FRC2026",
    sponsor_dashboard_url: "https://concierge.convergeevents.com/sponsor/dashboard",
    sponsor_user_name: "Jane Smith",
    magic_link_url: "https://concierge.convergeevents.com/sponsor/auth/magic?token=sample123",
    user_name: "Admin User",
    reset_url: "https://concierge.convergeevents.com/admin/reset-password?token=sample123",
    recipient_email: "admin@converge.com",
    app_name: "Converge Concierge",
  };

  function substituteTemplateVars(template: string, data: Record<string, string>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => data[key] ?? `{{${key}}}`);
  }

  app.get("/api/admin/email-templates", requireAuth, async (req, res) => {
    const templates = await storage.getEmailTemplates();
    res.json(templates);
  });

  app.get("/api/admin/email-templates/:id", requireAuth, async (req, res) => {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    res.json(template);
  });

  app.patch("/api/admin/email-templates/:id", requireAdmin, async (req, res) => {
    const existing = await storage.getEmailTemplateById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    const { displayName, subjectTemplate, htmlTemplate, textTemplate, description, isActive } = req.body;
    const updated = await storage.updateEmailTemplate(req.params.id, {
      ...(displayName !== undefined && { displayName }),
      ...(subjectTemplate !== undefined && { subjectTemplate }),
      ...(htmlTemplate !== undefined && { htmlTemplate }),
      ...(textTemplate !== undefined && { textTemplate: textTemplate ?? null }),
      ...(description !== undefined && { description: description ?? null }),
      ...(isActive !== undefined && { isActive }),
    });
    res.json(updated);
  });

  app.post("/api/admin/email-templates/:id/preview", requireAuth, async (req, res) => {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    const subject = substituteTemplateVars(template.subjectTemplate, SAMPLE_TEMPLATE_DATA);
    let html = template.htmlTemplate || "";
    if (!html.trim()) {
      html = `<div style="padding:32px;font-family:sans-serif;color:#374151;"><h2 style="margin:0 0 8px;">${template.displayName}</h2><p style="color:#6b7280;">This template has no custom HTML stored yet. Live emails use the code-rendered template.</p><p style="color:#6b7280;margin-top:16px;">Subject: <strong>${subject}</strong></p></div>`;
    } else {
      html = substituteTemplateVars(html, SAMPLE_TEMPLATE_DATA);
    }
    res.json({ subject, html });
  });

  app.post("/api/admin/email-templates/:id/send-test", requireAdmin, async (req, res) => {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: "Recipient email required" });

    const subject = substituteTemplateVars(template.subjectTemplate, SAMPLE_TEMPLATE_DATA);
    let html = template.htmlTemplate || "";
    if (!html.trim()) {
      const { meetingConfirmationForAttendee } = await import("../services/emailTemplates.js");
      html = `<div style="padding:32px;font-family:sans-serif;color:#374151;"><h2>${template.displayName} — Test Email</h2><p>Subject would be: <strong>${subject}</strong></p><p>No custom HTML stored. This template uses the code-rendered default.</p></div>`;
    } else {
      html = substituteTemplateVars(html, SAMPLE_TEMPLATE_DATA);
    }

    const { sendEmail } = await import("../services/emailService.js");
    let sendStatus: "sent" | "failed" = "sent";
    let errorMessage: string | null = null;
    try {
      await sendEmail(email.trim(), `[Test] ${subject}`, html);
    } catch (err: any) {
      sendStatus = "failed";
      errorMessage = err?.message ?? String(err);
    }
    const logId = await storage.createEmailLog({ emailType: `template_test_${template.templateKey}`, recipientEmail: email.trim(), subject: `[Test] ${subject}`, htmlContent: html, status: sendStatus, errorMessage });
    res.json({ ok: sendStatus === "sent", status: sendStatus, errorMessage, logId });
  });

  // ── Email Test Routes (admin-only) ────────────────────────────────────────
  // These routes are for development/QA testing of email templates.
  // Protected behind requireAdmin — do not remove auth guard.

  app.get("/api/admin/test-email/meeting-confirmation", requireAdmin, async (req, res) => {
    try {
      const meetings = await storage.getMeetings();
      const meeting = meetings[0];
      if (!meeting) return res.status(404).json({ error: "No meetings found to test with" });
      const [attendee, sponsor, event] = await Promise.all([
        storage.getAttendee(meeting.attendeeId),
        storage.getSponsor(meeting.sponsorId),
        storage.getEvent(meeting.eventId),
      ]);
      await sendMeetingConfirmationToAttendee(storage, attendee, sponsor, meeting, event);
      res.json({ ok: true, sentTo: attendee?.email, meeting: meeting.id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  app.get("/api/admin/test-email/meeting-sponsor-notification", requireAdmin, async (req, res) => {
    try {
      const meetings = await storage.getMeetings();
      const meeting = meetings[0];
      if (!meeting) return res.status(404).json({ error: "No meetings found to test with" });
      const [attendee, sponsor, event] = await Promise.all([
        storage.getAttendee(meeting.attendeeId),
        storage.getSponsor(meeting.sponsorId),
        storage.getEvent(meeting.eventId),
      ]);
      const tokens = await storage.getSponsorTokensBySponsor(meeting.sponsorId).catch(() => []);
      const token = tokens.find((t: any) => t.isActive)?.token ?? null;
      await sendMeetingNotificationToSponsor(storage, attendee, sponsor, meeting, event, token);
      res.json({ ok: true, sentTo: sponsor?.contactEmail, meeting: meeting.id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  app.get("/api/admin/test-email/info-request-sponsor", requireAdmin, async (req, res) => {
    try {
      const requests = await storage.listInformationRequests({});
      const request = requests[0];
      if (!request) return res.status(404).json({ error: "No information requests found to test with" });
      const [sponsor, event] = await Promise.all([
        storage.getSponsor(request.sponsorId),
        request.eventId ? storage.getEvent(request.eventId) : Promise.resolve(null),
      ]);
      const tokens = await storage.getSponsorTokensBySponsor(request.sponsorId).catch(() => []);
      const token = tokens.find((t: any) => t.isActive)?.token ?? null;
      await sendInformationRequestNotificationToSponsor(storage, null, sponsor, request, event, token);
      res.json({ ok: true, sentTo: sponsor?.contactEmail, requestId: request.id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  app.get("/api/admin/test-email/info-request-attendee", requireAdmin, async (req, res) => {
    try {
      const requests = await storage.listInformationRequests({});
      const request = requests[0];
      if (!request) return res.status(404).json({ error: "No information requests found to test with" });
      const [sponsor, event] = await Promise.all([
        storage.getSponsor(request.sponsorId),
        request.eventId ? storage.getEvent(request.eventId) : Promise.resolve(null),
      ]);
      await sendInformationRequestConfirmationToAttendee(storage, request, sponsor, event);
      res.json({ ok: true, sentTo: request.attendeeEmail, requestId: request.id });
    } catch (err: any) {
      res.status(500).json({ error: err?.message ?? String(err) });
    }
  });

  // ── Brevo delivery tracking webhook ─────────────────────────────────────────
  app.post("/api/webhooks/brevo", async (req, res) => {
    try {
      const secret = process.env.BREVO_WEBHOOK_SECRET;
      if (secret) {
        const providedSecret = req.headers["x-brevo-webhook-secret"] ?? req.query.secret;
        if (providedSecret !== secret) {
          return res.status(401).json({ message: "Invalid webhook secret" });
        }
      }

      const events = Array.isArray(req.body) ? req.body : [req.body];
      for (const event of events) {
        const messageId = event["message-id"] ?? event.messageId ?? event["Message-Id"] ?? null;
        if (!messageId) continue;

        const log = await storage.getEmailLogByProviderMessageId(messageId);
        if (!log) continue;

        const eventType = (event.event ?? "").toLowerCase();
        const ts = event.ts_epoch ? new Date(event.ts_epoch) : (event.date ? new Date(event.date) : new Date());
        const updates: { status?: string; deliveredAt?: Date; openedAt?: Date; clickedAt?: Date; bouncedAt?: Date; bounceReason?: string; providerStatus?: string } = {
          providerStatus: eventType,
        };

        if (eventType === "delivered") {
          updates.status = "delivered";
          updates.deliveredAt = ts;
        } else if (eventType === "opened") {
          updates.status = "opened";
          updates.openedAt = ts;
        } else if (eventType === "clicked") {
          updates.status = "clicked";
          updates.clickedAt = ts;
        } else if (eventType === "bounced" || eventType === "hard_bounce" || eventType === "soft_bounce" || eventType === "blocked" || eventType === "invalid_email") {
          updates.status = "bounced";
          updates.bouncedAt = ts;
          updates.bounceReason = event.reason ?? event.error ?? eventType;
        }

        await storage.updateEmailLogDelivery(log.id, updates);
      }

      res.json({ ok: true });
    } catch (err: any) {
      console.error("[WEBHOOK] Brevo webhook error:", err?.message ?? err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });

  // ── Agreement Deliverables ─────────────────────────────────────────────────

  // Package Templates
  app.get("/api/agreement/package-templates", requireAuth, async (req, res) => {
    try {
      const { sponsorshipLevel, isArchived } = req.query;
      const filters: { sponsorshipLevel?: string; isArchived?: boolean } = {};
      if (sponsorshipLevel) filters.sponsorshipLevel = String(sponsorshipLevel);
      if (isArchived !== undefined) filters.isArchived = isArchived === "true";
      const templates = await storage.listPackageTemplates(filters);
      const result = await Promise.all(templates.map(async (t) => {
        const items = await storage.listDeliverableTemplateItems(t.id);
        return { ...t, deliverableCount: items.filter((i) => i.isActive).length };
      }));
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/agreement/package-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.getPackageTemplate(req.params.id);
      if (!template) return res.status(404).json({ message: "Not found" });
      const items = await storage.listDeliverableTemplateItems(req.params.id);
      res.json({ ...template, items });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/package-templates", requireAuth, async (req, res) => {
    try {
      const template = await storage.createPackageTemplate(req.body);
      res.status(201).json(template);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/agreement/package-templates/:id", requireAuth, async (req, res) => {
    try {
      const template = await storage.updatePackageTemplate(req.params.id, req.body);
      res.json(template);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/package-templates/:id/archive", requireAuth, async (req, res) => {
    try {
      const template = await storage.archivePackageTemplate(req.params.id);
      res.json(template);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/package-templates/:id/duplicate", requireAuth, async (req, res) => {
    try {
      const { newName } = req.body;
      if (!newName) return res.status(400).json({ message: "newName is required" });
      const template = await storage.duplicatePackageTemplate(req.params.id, newName);
      res.status(201).json(template);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Deliverable Template Items
  app.get("/api/agreement/package-templates/:id/items", requireAuth, async (req, res) => {
    try {
      const items = await storage.listDeliverableTemplateItems(req.params.id);
      res.json(items);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/package-templates/:id/items", requireAuth, async (req, res) => {
    try {
      const item = await storage.createDeliverableTemplateItem({ ...req.body, packageTemplateId: req.params.id });
      res.status(201).json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/agreement/template-items/:id", requireAuth, async (req, res) => {
    try {
      const item = await storage.updateDeliverableTemplateItem(req.params.id, req.body);
      res.json(item);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/agreement/template-items/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteDeliverableTemplateItem(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Agreement Deliverables (sponsor-specific instances)
  app.get("/api/agreement/deliverables", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId, packageTemplateId } = req.query;
      const filters: { sponsorId?: string; eventId?: string; packageTemplateId?: string } = {};
      if (sponsorId) filters.sponsorId = String(sponsorId);
      if (eventId) filters.eventId = String(eventId);
      if (packageTemplateId) filters.packageTemplateId = String(packageTemplateId);

      // Enrich with sponsor/event names
      const [deliverables, allSponsors, allEvents] = await Promise.all([
        storage.listAgreementDeliverables(filters),
        storage.getSponsors(),
        storage.getEvents(),
      ]);
      const sponsorMap = new Map(allSponsors.map((s) => [s.id, s.name]));
      const eventMap = new Map(allEvents.map((e) => [e.id, e.name]));
      // Group by sponsor+event for summary
      const groups = new Map<string, { sponsorId: string; eventId: string; items: typeof deliverables }>();
      for (const d of deliverables) {
        const key = `${d.sponsorId}__${d.eventId}`;
        if (!groups.has(key)) groups.set(key, { sponsorId: d.sponsorId, eventId: d.eventId, items: [] });
        groups.get(key)!.items.push(d);
      }
      const summaries = Array.from(groups.values()).map(({ sponsorId: sid, eventId: eid, items }) => {
        const level = items[0]?.sponsorshipLevel ?? "";
        const templateId = items[0]?.packageTemplateId ?? null;
        const delivered = items.filter((i) => i.status === "Delivered" || i.status === "Approved").length;
        const awaitingSponsor = items.filter((i) => i.status === "Awaiting Sponsor Input").length;
        return {
          sponsorId: sid, eventId: eid,
          sponsorName: sponsorMap.get(sid) ?? sid,
          eventName: eventMap.get(eid) ?? eid,
          sponsorshipLevel: level,
          packageTemplateId: templateId,
          totalDeliverables: items.length,
          deliveredCount: delivered,
          awaitingSponsorCount: awaitingSponsor,
          lastUpdated: items.reduce((max, i) => i.updatedAt > max ? i.updatedAt : max, items[0]?.updatedAt ?? new Date()),
        };
      });
      res.json(summaries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/agreement/deliverables/detail", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId } = req.query;
      if (!sponsorId || !eventId) return res.status(400).json({ message: "sponsorId and eventId required" });
      const deliverables = await storage.listAgreementDeliverables({ sponsorId: String(sponsorId), eventId: String(eventId) });
      res.json(deliverables);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/agreement/deliverables/:id", requireAuth, async (req, res) => {
    try {
      const d = await storage.getAgreementDeliverable(req.params.id);
      if (!d) return res.status(404).json({ message: "Not found" });
      res.json(d);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/deliverables", requireAuth, async (req, res) => {
    try {
      const d = await storage.createAgreementDeliverable(req.body);
      res.status(201).json(d);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/agreement/deliverables/:id", requireAuth, async (req, res) => {
    try {
      const updates = { ...req.body, isOverridden: true };
      const d = await storage.updateAgreementDeliverable(req.params.id, updates);
      res.json(d);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/agreement/deliverables/:id", requireAuth, async (req, res) => {
    try {
      await storage.deleteAgreementDeliverable(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/generate", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId, packageTemplateId, sponsorshipLevel } = req.body;
      if (!sponsorId || !eventId || !packageTemplateId || !sponsorshipLevel) {
        return res.status(400).json({ message: "sponsorId, eventId, packageTemplateId, sponsorshipLevel required" });
      }
      const deliverables = await storage.generateAgreementDeliverablesFromTemplate(sponsorId, eventId, packageTemplateId, sponsorshipLevel);
      res.status(201).json(deliverables);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/generate/regenerate", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId, packageTemplateId, sponsorshipLevel } = req.body;
      if (!sponsorId || !eventId || !packageTemplateId || !sponsorshipLevel) {
        return res.status(400).json({ message: "sponsorId, eventId, packageTemplateId, sponsorshipLevel required" });
      }
      // Delete existing then regenerate
      const existing = await storage.listAgreementDeliverables({ sponsorId, eventId });
      for (const d of existing) {
        await storage.deleteAgreementDeliverable(d.id);
      }
      const deliverables = await storage.generateAgreementDeliverablesFromTemplate(sponsorId, eventId, packageTemplateId, sponsorshipLevel);
      res.status(201).json(deliverables);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Reset a deliverable to its template defaults
  app.post("/api/agreement/deliverables/:id/reset", requireAuth, async (req, res) => {
    try {
      const d = await storage.getAgreementDeliverable(req.params.id);
      if (!d) return res.status(404).json({ message: "Not found" });
      if (!d.createdFromTemplateItemId) return res.status(400).json({ message: "No source template item" });
      const templateItem = await storage.getDeliverableTemplateItem(d.createdFromTemplateItemId);
      if (!templateItem) return res.status(404).json({ message: "Template item not found" });
      const updated = await storage.updateAgreementDeliverable(d.id, {
        deliverableName: templateItem.deliverableName,
        deliverableDescription: templateItem.deliverableDescription,
        quantity: templateItem.defaultQuantity,
        quantityUnit: templateItem.quantityUnit,
        ownerType: templateItem.ownerType,
        sponsorEditable: templateItem.sponsorEditable,
        sponsorVisible: templateItem.sponsorVisible,
        fulfillmentType: templateItem.fulfillmentType,
        dueTiming: templateItem.dueTiming,
        dueDate: null,
        sponsorFacingNote: null,
        internalNote: null,
        isOverridden: false,
      });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Seed initial package templates (idempotent)
  app.post("/api/agreement/seed-templates", requireAuth, async (req, res) => {
    try {
      const existing = await storage.listPackageTemplates();
      if (existing.length > 0) return res.json({ message: "Templates already seeded", count: existing.length });

      type ItemDef = { name: string; category: string; qty?: number; unit?: string; ownerType?: string; sponsorEditable?: boolean; fulfillmentType?: string; dueTiming?: string; reminderEligible?: boolean };
      const companyProfile = (items: ItemDef[]) => items;
      const CATEGORIES = { CP: "Company Profile", EP: "Event Participation", SC: "Speaking & Content", MI: "Meetings & Introductions", MB: "Marketing & Branding", PED: "Post-Event Deliverables", CO: "Compliance" };

      const sharedItems: ItemDef[] = [
        { name: "Company Logo", category: CATEGORIES.CP, ownerType: "Sponsor", sponsorEditable: true, fulfillmentType: "file_upload", dueTiming: "before_event" },
        { name: "Company Description", category: CATEGORIES.CP, ownerType: "Sponsor", sponsorEditable: true, fulfillmentType: "file_upload", dueTiming: "before_event" },
        { name: "Sponsor Representatives", category: CATEGORIES.CP, ownerType: "Sponsor", sponsorEditable: true, fulfillmentType: "status_only", dueTiming: "before_event" },
        { name: "Three-Word Company Categories", category: CATEGORIES.CP, ownerType: "Sponsor", sponsorEditable: true, fulfillmentType: "status_only", dueTiming: "before_event" },
        { name: "Meeting Introductions (Pre-Event)", category: CATEGORIES.MI, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
        { name: "Email Introductions (Post-Event)", category: CATEGORIES.MI, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event" },
        { name: "Company Logo on Website and Event Signage", category: CATEGORIES.MB, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
        { name: "Full Attendee Contact List", category: CATEGORIES.PED, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event" },
        { name: "Certificate of Insurance", category: CATEGORIES.CO, ownerType: "Sponsor", sponsorEditable: false, fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true },
      ];

      const seedData: { level: string; name: string; items: ItemDef[] }[] = [
        {
          level: "Platinum", name: "FRC 2026 Platinum",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "VIP Registrations", category: CATEGORIES.EP, qty: 4, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "Premium Exhibit Table", category: CATEGORIES.EP, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            { name: "Speaking Engagement", category: CATEGORIES.SC, qty: 2, unit: "sessions", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 7),
            { name: "Customized Social Media Graphics", category: CATEGORIES.MB, qty: 2, unit: "graphics", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcements", category: CATEGORIES.MB, qty: 2, unit: "posts", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(7, 9),
          ],
        },
        {
          level: "Gold", name: "FRC 2026 Gold",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "VIP Registrations", category: CATEGORIES.EP, qty: 3, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "Premium Exhibit Table", category: CATEGORIES.EP, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            { name: "Speaking Engagement", category: CATEGORIES.SC, qty: 1, unit: "sessions", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 7),
            { name: "Customized Social Media Graphics", category: CATEGORIES.MB, qty: 2, unit: "graphics", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcements", category: CATEGORIES.MB, qty: 2, unit: "posts", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(7, 9),
          ],
        },
        {
          level: "Silver", name: "FRC 2026 Silver",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "Registrations", category: CATEGORIES.EP, qty: 2, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "General Exhibit Table", category: CATEGORIES.EP, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 7),
            { name: "Customized Social Media Graphic", category: CATEGORIES.MB, qty: 1, unit: "graphic", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcement", category: CATEGORIES.MB, qty: 1, unit: "post", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(7, 9),
          ],
        },
        {
          level: "Bronze", name: "FRC 2026 Bronze",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "Registrations", category: CATEGORIES.EP, qty: 2, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "General Exhibit Table", category: CATEGORIES.EP, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            ...sharedItems.slice(6, 7),
            { name: "Customized Social Media Graphic", category: CATEGORIES.MB, qty: 1, unit: "graphic", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcement", category: CATEGORIES.MB, qty: 1, unit: "post", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Partial Attendee Contact List", category: CATEGORIES.PED, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event" },
            ...sharedItems.slice(8, 9),
          ],
        },
      ];

      const createdTemplates = [];
      for (const { level, name, items } of seedData) {
        const template = await storage.createPackageTemplate({
          packageName: name,
          sponsorshipLevel: level,
          eventFamily: "FRC",
          year: "2026",
          isActive: true,
          isArchived: false,
        });
        let order = 0;
        for (const item of items) {
          await storage.createDeliverableTemplateItem({
            packageTemplateId: template.id,
            category: item.category,
            deliverableName: item.name,
            defaultQuantity: item.qty ?? null,
            quantityUnit: item.unit ?? null,
            ownerType: (item.ownerType ?? "Converge") as string,
            sponsorEditable: item.sponsorEditable ?? false,
            sponsorVisible: true,
            fulfillmentType: (item.fulfillmentType ?? "status_only") as string,
            reminderEligible: item.reminderEligible ?? true,
            dueTiming: (item.dueTiming ?? "not_applicable") as string,
            displayOrder: order++,
            isActive: true,
          });
        }
        createdTemplates.push(template);
      }

      res.status(201).json({ message: "Templates seeded", count: createdTemplates.length });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Outstanding Items ──────────────────────────────────────────────────────
  // GET /api/agreement/outstanding-items — all sponsor-responsible incomplete deliverables
  app.get("/api/agreement/outstanding-items", requireAuth, async (req, res) => {
    try {
      const { eventId, sponsorId, category, overdueOnly, reminderEligibleOnly } = req.query as Record<string, string>;

      const OUTSTANDING_STATUSES = ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"];
      const SPONSOR_OWNER_TYPES = ["Sponsor", "Shared"];

      let deliverables = await storage.listAgreementDeliverables({
        eventId: eventId || undefined,
        sponsorId: sponsorId || undefined,
      });

      deliverables = deliverables.filter(d =>
        SPONSOR_OWNER_TYPES.includes(d.ownerType) &&
        OUTSTANDING_STATUSES.includes(d.status) &&
        d.sponsorVisible !== false
      );

      if (category) deliverables = deliverables.filter(d => d.category === category);
      if (overdueOnly === "true") {
        const now = new Date();
        deliverables = deliverables.filter(d => d.dueDate && new Date(d.dueDate) < now);
      }
      if (reminderEligibleOnly === "true") deliverables = deliverables.filter(d => d.reminderEligible);

      const allSponsors = await storage.getSponsors();
      const allEvents = await storage.getEvents();
      const sponsorMap = Object.fromEntries(allSponsors.map(s => [s.id, s]));
      const eventMap = Object.fromEntries(allEvents.map(e => [e.id, e]));

      const uniquePairs = [...new Set(deliverables.map(d => `${d.sponsorId}|${d.eventId}`))];
      const lastReminderMap: Record<string, string | null> = {};
      await Promise.all(uniquePairs.map(async (pair) => {
        const [sid, eid] = pair.split("|");
        const rem = await storage.getLastDeliverableReminder(sid, eid);
        lastReminderMap[pair] = rem ? rem.sentAt.toISOString() : null;
      }));

      const now = new Date();
      const result = deliverables.map(d => {
        const sponsor = sponsorMap[d.sponsorId];
        const event = eventMap[d.eventId];
        const pairKey = `${d.sponsorId}|${d.eventId}`;
        const isOverdue = d.dueDate ? new Date(d.dueDate) < now : false;
        return {
          ...d,
          sponsorName: sponsor?.name ?? "",
          eventName: event?.name ?? "",
          sponsorshipLevel: d.sponsorshipLevel ?? sponsor?.sponsorshipLevel ?? "",
          lastReminderSent: lastReminderMap[pairKey] ?? null,
          isOverdue,
        };
      });

      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/agreement/outstanding-summary — counts for dashboard Needs Attention
  app.get("/api/agreement/outstanding-summary", requireAuth, async (req, res) => {
    try {
      const OUTSTANDING_STATUSES = ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"];
      const SPONSOR_OWNER_TYPES = ["Sponsor", "Shared"];

      const deliverables = await storage.listAgreementDeliverables({});
      const outstanding = deliverables.filter(d =>
        SPONSOR_OWNER_TYPES.includes(d.ownerType) &&
        OUTSTANDING_STATUSES.includes(d.status) &&
        d.sponsorVisible !== false
      );

      const now = new Date();
      const overdue = outstanding.filter(d => d.dueDate && new Date(d.dueDate) < now);
      const uniqueSponsors = new Set(outstanding.map(d => d.sponsorId)).size;

      res.json({ total: outstanding.length, overdueCount: overdue.length, sponsorCount: uniqueSponsors });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ─── Activation Score helpers ────────────────────────────────────────────────
  const COMPLETED_STATUSES = new Set(["Delivered", "Approved", "Completed"]);
  const NA_STATUS = "N/A";
  const OUTSTANDING_INPUT_STATUSES = new Set(["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"]);

  function computeActivationScore(opts: {
    hasLoggedIn: boolean;
    deliverables: { status: string; ownerType: string; sponsorVisible: boolean | null }[];
    meetingCount: number;
    scheduledMeetingCount: number;
    infoRequestCount: number;
    sponsor: { logoUrl?: string | null; shortDescription?: string | null; websiteUrl?: string | null };
  }): { score: number; components: Record<string, number> } {
    // Login (10)
    const loginScore = opts.hasLoggedIn ? 10 : 0;

    // Deliverables completion (25)
    const visibleDeliverables = opts.deliverables.filter(d => d.sponsorVisible !== false && d.status !== NA_STATUS);
    const completedDeliverables = visibleDeliverables.filter(d => COMPLETED_STATUSES.has(d.status));
    const deliverableScore = visibleDeliverables.length > 0
      ? Math.round((completedDeliverables.length / visibleDeliverables.length) * 25)
      : 0;

    // Meeting requests received (20) — any meeting exists
    const meetingRequestScore = opts.meetingCount > 0 ? 20 : 0;

    // Meetings scheduled (20) — any scheduled/completed meeting
    const meetingScheduledScore = opts.scheduledMeetingCount > 0 ? 20 : 0;

    // Information requests received (10)
    const infoRequestScore = opts.infoRequestCount > 0 ? 10 : 0;

    // Sponsor inputs completed (10) — sponsor-owned deliverables not outstanding
    const sponsorOwnedDeliverables = opts.deliverables.filter(
      d => d.ownerType === "Sponsor" && d.sponsorVisible !== false && d.status !== NA_STATUS
    );
    let sponsorInputScore: number;
    if (sponsorOwnedDeliverables.length === 0) {
      sponsorInputScore = 10; // No sponsor inputs = full credit
    } else {
      const completedInputs = sponsorOwnedDeliverables.filter(d => !OUTSTANDING_INPUT_STATUSES.has(d.status));
      sponsorInputScore = Math.round((completedInputs.length / sponsorOwnedDeliverables.length) * 10);
    }

    // Profile completeness (5)
    const profileScore =
      (opts.sponsor.logoUrl ? 2 : 0) +
      (opts.sponsor.shortDescription ? 2 : 0) +
      (opts.sponsor.websiteUrl ? 1 : 0);

    const score = loginScore + deliverableScore + meetingRequestScore + meetingScheduledScore + infoRequestScore + sponsorInputScore + profileScore;
    return {
      score: Math.min(100, score),
      components: {
        login: loginScore,
        deliverables: deliverableScore,
        meetingRequests: meetingRequestScore,
        meetingsScheduled: meetingScheduledScore,
        infoRequests: infoRequestScore,
        sponsorInputs: sponsorInputScore,
        profile: profileScore,
      },
    };
  }

  function activationLabel(score: number): string {
    if (score >= 80) return "Fully Activated";
    if (score >= 60) return "Active";
    if (score >= 40) return "At Risk";
    return "Inactive";
  }

  // GET /api/agreement/activation-metrics — per-sponsor+event activation scores
  app.get("/api/agreement/activation-metrics", requireAuth, async (req, res) => {
    try {
      const [allDeliverables, allMeetings, allInfoRequests, allSponsors, allSponsorUsers] = await Promise.all([
        storage.listAgreementDeliverables({}),
        storage.getMeetings(),
        storage.listInformationRequests(),
        storage.getSponsors(),
        storage.getAllSponsorUsers(),
      ]);

      // Index sponsor users by sponsorId → pick best lastLoginAt and sum loginCount
      const loginBySponsors = new Map<string, { lastLoginAt: Date | null; loginCount: number }>();
      for (const u of allSponsorUsers) {
        const existing = loginBySponsors.get(u.sponsorId);
        const ts = u.lastLoginAt ? new Date(u.lastLoginAt) : null;
        if (!existing) {
          loginBySponsors.set(u.sponsorId, { lastLoginAt: ts, loginCount: u.loginCount ?? 0 });
        } else {
          loginBySponsors.set(u.sponsorId, {
            lastLoginAt: ts && (!existing.lastLoginAt || ts > existing.lastLoginAt) ? ts : existing.lastLoginAt,
            loginCount: existing.loginCount + (u.loginCount ?? 0),
          });
        }
      }

      // Group deliverables by sponsorId+eventId
      const deliverablesByKey = new Map<string, typeof allDeliverables>();
      for (const d of allDeliverables) {
        const key = `${d.sponsorId}:${d.eventId}`;
        if (!deliverablesByKey.has(key)) deliverablesByKey.set(key, []);
        deliverablesByKey.get(key)!.push(d);
      }

      // Group meetings by sponsorId+eventId
      const meetingsByKey = new Map<string, { total: number; scheduled: number }>();
      for (const m of allMeetings) {
        if (!m.sponsorId || !m.eventId) continue;
        const key = `${m.sponsorId}:${m.eventId}`;
        const ex = meetingsByKey.get(key) ?? { total: 0, scheduled: 0 };
        ex.total++;
        if (m.status === "Scheduled" || m.status === "Completed") ex.scheduled++;
        meetingsByKey.set(key, ex);
      }

      // Group info requests by sponsorId+eventId
      const infoByKey = new Map<string, number>();
      for (const r of allInfoRequests) {
        if (!r.eventId) continue;
        const key = `${r.sponsorId}:${r.eventId}`;
        infoByKey.set(key, (infoByKey.get(key) ?? 0) + 1);
      }

      // Build metrics for each unique sponsorId+eventId found in deliverables
      const sponsorMap = new Map(allSponsors.map(s => [s.id, s]));
      const results: {
        sponsorId: string; eventId: string;
        activationScore: number; activationLabel: string;
        completionPct: number; completedDeliverables: number; totalDeliverables: number;
        meetingsScheduled: number; meetingsCompleted: number; meetingRequests: number;
        infoRequestCount: number;
        lastLoginAt: string | null; loginCount: number; hasNeverLoggedIn: boolean;
        scoreComponents: Record<string, number>;
      }[] = [];

      for (const [key, deliverables] of deliverablesByKey) {
        const [sponsorId, eventId] = key.split(":");
        const sponsor = sponsorMap.get(sponsorId);
        if (!sponsor) continue;

        const loginData = loginBySponsors.get(sponsorId) ?? { lastLoginAt: null, loginCount: 0 };
        const meetings = meetingsByKey.get(key) ?? { total: 0, scheduled: 0 };
        const infoCount = infoByKey.get(key) ?? 0;

        const visibleDeliverables = deliverables.filter(d => d.sponsorVisible !== false && d.status !== NA_STATUS);
        const completedCount = visibleDeliverables.filter(d => COMPLETED_STATUSES.has(d.status)).length;
        const completionPct = visibleDeliverables.length > 0 ? Math.round((completedCount / visibleDeliverables.length) * 100) : 0;

        // Count completed meetings vs total meetings
        const allMeetingsForKey = allMeetings.filter(m => m.sponsorId === sponsorId && m.eventId === eventId);
        const meetingsCompleted = allMeetingsForKey.filter(m => m.status === "Completed").length;

        const { score, components } = computeActivationScore({
          hasLoggedIn: !!loginData.lastLoginAt,
          deliverables,
          meetingCount: meetings.total,
          scheduledMeetingCount: meetings.scheduled,
          infoRequestCount: infoCount,
          sponsor: { logoUrl: sponsor.logoUrl, shortDescription: (sponsor as any).shortDescription, websiteUrl: sponsor.websiteUrl },
        });

        results.push({
          sponsorId, eventId,
          activationScore: score,
          activationLabel: activationLabel(score),
          completionPct,
          completedDeliverables: completedCount,
          totalDeliverables: visibleDeliverables.length,
          meetingsScheduled: meetings.scheduled,
          meetingsCompleted,
          meetingRequests: meetings.total,
          infoRequestCount: infoCount,
          lastLoginAt: loginData.lastLoginAt ? loginData.lastLoginAt.toISOString() : null,
          loginCount: loginData.loginCount,
          hasNeverLoggedIn: !loginData.lastLoginAt,
          scoreComponents: components,
        });
      }

      res.json(results);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/agreement/activation-metrics/export.csv
  app.get("/api/agreement/activation-metrics/export.csv", requireAuth, async (req, res) => {
    try {
      const [allDeliverables, allMeetings, allInfoRequests, allSponsors, allSponsorUsers, allEvents] = await Promise.all([
        storage.listAgreementDeliverables({}),
        storage.getMeetings(),
        storage.listInformationRequests(),
        storage.getSponsors(),
        storage.getAllSponsorUsers(),
        storage.getEvents(),
      ]);

      const loginBySponsors = new Map<string, { lastLoginAt: Date | null; loginCount: number }>();
      for (const u of allSponsorUsers) {
        const existing = loginBySponsors.get(u.sponsorId);
        const ts = u.lastLoginAt ? new Date(u.lastLoginAt) : null;
        if (!existing) {
          loginBySponsors.set(u.sponsorId, { lastLoginAt: ts, loginCount: u.loginCount ?? 0 });
        } else {
          loginBySponsors.set(u.sponsorId, {
            lastLoginAt: ts && (!existing.lastLoginAt || ts > existing.lastLoginAt) ? ts : existing.lastLoginAt,
            loginCount: existing.loginCount + (u.loginCount ?? 0),
          });
        }
      }

      const deliverablesByKey = new Map<string, typeof allDeliverables>();
      for (const d of allDeliverables) {
        const key = `${d.sponsorId}:${d.eventId}`;
        if (!deliverablesByKey.has(key)) deliverablesByKey.set(key, []);
        deliverablesByKey.get(key)!.push(d);
      }

      const meetingsByKey = new Map<string, { total: number; scheduled: number; completed: number }>();
      for (const m of allMeetings) {
        if (!m.sponsorId || !m.eventId) continue;
        const key = `${m.sponsorId}:${m.eventId}`;
        const ex = meetingsByKey.get(key) ?? { total: 0, scheduled: 0, completed: 0 };
        ex.total++;
        if (m.status === "Scheduled" || m.status === "Completed") ex.scheduled++;
        if (m.status === "Completed") ex.completed++;
        meetingsByKey.set(key, ex);
      }

      const infoByKey = new Map<string, number>();
      for (const r of allInfoRequests) {
        if (!r.eventId) continue;
        const key = `${r.sponsorId}:${r.eventId}`;
        infoByKey.set(key, (infoByKey.get(key) ?? 0) + 1);
      }

      const sponsorMap = new Map(allSponsors.map(s => [s.id, s]));
      const eventMap = new Map(allEvents.map(e => [e.id, e]));

      const rows: string[] = ["Event,Sponsor,Sponsorship Level,Activation Score,Activation Status,Deliverables Completion %,Completed Deliverables,Total Deliverables,Meetings Scheduled,Meetings Completed,Meeting Requests,Information Requests,Login Count,Last Login"];

      for (const [key, deliverables] of deliverablesByKey) {
        const [sponsorId, eventId] = key.split(":");
        const sponsor = sponsorMap.get(sponsorId);
        const event = eventMap.get(eventId);
        if (!sponsor || !event) continue;

        const loginData = loginBySponsors.get(sponsorId) ?? { lastLoginAt: null, loginCount: 0 };
        const meetings = meetingsByKey.get(key) ?? { total: 0, scheduled: 0, completed: 0 };
        const infoCount = infoByKey.get(key) ?? 0;

        const visibleDeliverables = deliverables.filter(d => d.sponsorVisible !== false && d.status !== NA_STATUS);
        const completedCount = visibleDeliverables.filter(d => COMPLETED_STATUSES.has(d.status)).length;
        const completionPct = visibleDeliverables.length > 0 ? Math.round((completedCount / visibleDeliverables.length) * 100) : 0;

        // Get sponsorship level from the deliverables (first one with a level)
        const level = (deliverables[0] as any).sponsorshipLevel ?? "";

        const { score } = computeActivationScore({
          hasLoggedIn: !!loginData.lastLoginAt,
          deliverables,
          meetingCount: meetings.total,
          scheduledMeetingCount: meetings.scheduled,
          infoRequestCount: infoCount,
          sponsor: { logoUrl: sponsor.logoUrl, shortDescription: (sponsor as any).shortDescription, websiteUrl: sponsor.websiteUrl },
        });

        const lastLogin = loginData.lastLoginAt ? loginData.lastLoginAt.toISOString().split("T")[0] : "Never";
        const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
        rows.push([
          esc(event.name), esc(sponsor.name), esc(level), score, esc(activationLabel(score)),
          `${completionPct}%`, completedCount, visibleDeliverables.length,
          meetings.scheduled, meetings.completed, meetings.total, infoCount,
          loginData.loginCount, esc(lastLogin),
        ].join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=\"sponsor-performance.csv\"");
      res.send(rows.join("\n"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/agreement/reminders/send — manually send grouped reminder to a sponsor for an event
  app.post("/api/agreement/reminders/send", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId } = req.body as { sponsorId?: string; eventId?: string };
      if (!sponsorId || !eventId) return res.status(400).json({ message: "sponsorId and eventId required" });

      const [sponsor, event] = await Promise.all([
        storage.getSponsor(sponsorId),
        storage.getEvent(eventId),
      ]);
      if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
      if (!event) return res.status(404).json({ message: "Event not found" });

      const OUTSTANDING_STATUSES = ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"];
      const allDeliverables = await storage.listAgreementDeliverables({ eventId, sponsorId });
      const outstanding = allDeliverables.filter(d =>
        ["Sponsor", "Shared"].includes(d.ownerType) &&
        OUTSTANDING_STATUSES.includes(d.status) &&
        d.sponsorVisible !== false &&
        d.reminderEligible
      );

      if (outstanding.length === 0) return res.status(400).json({ message: "No reminder-eligible outstanding items for this sponsor/event" });

      // Find the primary sponsor contact (isPrimary first, then owner access level, or first user; fallback to sponsor.contactEmail)
      const sponsorUsers = await storage.getSponsorUsersBySponsor(sponsorId);
      const primaryUser = sponsorUsers.find(u => u.isPrimary) ?? sponsorUsers.find(u => u.accessLevel === "owner") ?? sponsorUsers[0];
      const recipientEmail = primaryUser?.email ?? sponsor.contactEmail ?? null;
      const recipientName = primaryUser?.name ?? null;

      if (!recipientEmail) return res.status(400).json({ message: "No recipient email found for this sponsor" });

      // Get sponsor token for dashboard link
      const tokens = await storage.getSponsorTokensBySponsor(sponsorId);
      const activeToken = tokens.find(t => !t.revokedAt) ?? tokens[0];
      const sponsorToken = activeToken?.token ?? "";

      const { sendDeliverableReminderEmail } = await import("../services/emailService.js");
      await sendDeliverableReminderEmail(storage, {
        sponsor,
        event,
        deliverables: outstanding,
        recipientName,
        recipientEmail,
        sponsorToken,
      });

      const logEntry = await storage.createDeliverableReminder({
        sponsorId,
        eventId,
        recipientEmail,
        reminderType: "manual_admin",
        sentByRole: "admin",
        sentByUserId: (req as any).user?.id ?? null,
        sentAt: new Date(),
        status: "sent",
        errorMessage: null,
        deliverableCount: outstanding.length,
      });

      res.json({ success: true, deliverableCount: outstanding.length, logEntry });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/agreement/reminders — list reminder log entries (filterable)
  app.get("/api/agreement/reminders", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId } = req.query as Record<string, string>;
      const reminders = await storage.listDeliverableReminders({ sponsorId, eventId });
      res.json(reminders);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── File Assets ───────────────────────────────────────────────────────────

  const CATEGORY_RULES: Record<string, { allowedMime: string[]; maxBytes: number }> = {
    "logos":           { allowedMime: ["image/png","image/jpeg","image/jpg","image/svg+xml"], maxBytes: 5*1024*1024 },
    "headshots":       { allowedMime: ["image/png","image/jpeg","image/jpg"], maxBytes: 5*1024*1024 },
    "company-assets":  { allowedMime: ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"], maxBytes: 10*1024*1024 },
    "social-graphics": { allowedMime: ["image/png","image/jpeg","image/jpg","application/pdf"], maxBytes: 10*1024*1024 },
    "session-assets":  { allowedMime: ["image/png","image/jpeg","image/jpg","application/pdf"], maxBytes: 10*1024*1024 },
    "promo-assets":    { allowedMime: ["application/pdf","image/png","image/jpeg","image/jpg"], maxBytes: 10*1024*1024 },
    "attendee-reports":{ allowedMime: ["text/csv","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet","application/pdf"], maxBytes: 15*1024*1024 },
    "sponsor-reports": { allowedMime: ["application/pdf","application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"], maxBytes: 15*1024*1024 },
    "contracts":       { allowedMime: ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"], maxBytes: 10*1024*1024 },
    "internal":        { allowedMime: ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document"], maxBytes: 10*1024*1024 },
  };

  const SPONSOR_UPLOADABLE_CATEGORIES = ["logos","headshots","company-assets"];
  const ADMIN_ONLY_CATEGORIES = ["attendee-reports","sponsor-reports","contracts","internal"];

  function sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
  }

  // POST /api/files/upload-url — generate presigned PUT URL + pending metadata
  app.post("/api/files/upload-url", requireAuth, async (req, res) => {
    try {
      const { category, originalFileName, mimeType, sizeBytes, eventId, sponsorId, deliverableId, visibility, title } = req.body;

      if (!category || !originalFileName || !mimeType) return res.status(400).json({ message: "category, originalFileName, mimeType required" });

      const rules = CATEGORY_RULES[category];
      if (!rules) return res.status(400).json({ message: `Unknown category: ${category}` });
      if (!rules.allowedMime.includes(mimeType)) return res.status(400).json({ message: `File type ${mimeType} not allowed for category ${category}` });
      if (sizeBytes && sizeBytes > rules.maxBytes) return res.status(400).json({ message: `File too large. Max ${rules.maxBytes / 1024 / 1024}MB for ${category}` });

      const user = req.user as any;
      if (ADMIN_ONLY_CATEGORIES.includes(category) && user?.role !== "admin" && user?.role !== "manager") {
        return res.status(403).json({ message: "Only admins can upload to this category" });
      }

      const { fileId, objectKey, storedFileName } = buildObjectKeyFlat(originalFileName);
      const uploadURL = await generateUploadUrl(objectKey, 900);

      res.json({ uploadURL, fileId, objectKey, storedFileName });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/files/confirm — confirm upload completed + create DB record
  app.post("/api/files/confirm", requireAuth, async (req, res) => {
    try {
      const { fileId, objectKey, storedFileName, category, originalFileName, mimeType, sizeBytes, eventId, sponsorId, deliverableId, visibility, title, description, replacesFileAssetId } = req.body;
      if (!fileId || !objectKey || !category || !originalFileName || !mimeType) return res.status(400).json({ message: "Missing required fields" });

      const user = req.user as any;
      const uploadedByRole = (user?.role === "admin" || user?.role === "manager") ? "admin" : "sponsor";

      let fileAsset;
      if (replacesFileAssetId) {
        fileAsset = await storage.replaceFileAsset(replacesFileAssetId, {
          eventId: eventId || null, sponsorId: sponsorId || null, deliverableId: deliverableId || null,
          uploadedByUserId: user?.id || null, uploadedByRole,
          category, originalFileName, storedFileName: storedFileName || originalFileName, objectKey, mimeType,
          sizeBytes: sizeBytes || null, visibility: visibility || "sponsor_private",
          accessScope: "deliverable", title: title || null, description: description || null,
          status: "active", isLatestVersion: true,
        });
      } else {
        fileAsset = await storage.createFileAsset({
          eventId: eventId || null, sponsorId: sponsorId || null, deliverableId: deliverableId || null,
          uploadedByUserId: user?.id || null, uploadedByRole,
          category, originalFileName, storedFileName: storedFileName || originalFileName, objectKey, mimeType,
          sizeBytes: sizeBytes || null, visibility: visibility || "sponsor_private",
          accessScope: "deliverable", title: title || null, description: description || null,
          status: "active", isLatestVersion: true, replacesFileAssetId: null,
        });
      }

      // Auto-update deliverable status if sponsor uploaded a file-based item
      if (deliverableId && uploadedByRole === "sponsor") {
        const deliverable = await storage.getAgreementDeliverable(deliverableId);
        if (deliverable && ["Not Started","Needed","Awaiting Sponsor Input"].includes(deliverable.status)) {
          await storage.updateAgreementDeliverable(deliverableId, { status: "Submitted" });
        }
      }

      res.json(fileAsset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/files/:id/download-url — generate signed GET URL
  app.get("/api/files/:id/download-url", requireAuth, async (req, res) => {
    try {
      const file = await storage.getFileAsset(req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      if (file.status === "archived") return res.status(410).json({ message: "File has been archived" });

      const downloadURL = await generateDownloadUrl(file.objectKey, 3600);
      res.json({ downloadURL, fileName: file.originalFileName, mimeType: file.mimeType });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/files — list files (admin)
  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const { sponsorId, eventId, deliverableId, status } = req.query as Record<string, string>;
      const files = await storage.listFileAssets({ sponsorId, eventId, deliverableId, status: status || "active" });
      res.json(files);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/files/:id — archive a file
  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const file = await storage.getFileAsset(req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      const archived = await storage.archiveFileAsset(req.params.id);
      res.json(archived);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Deliverable Links ──────────────────────────────────────────────────────

  // GET /api/agreement/deliverables/:deliverableId/links
  app.get("/api/agreement/deliverables/:deliverableId/links", requireAuth, async (req, res) => {
    try {
      const links = await storage.listDeliverableLinks(req.params.deliverableId);
      res.json(links);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // POST /api/agreement/deliverables/:deliverableId/links
  app.post("/api/agreement/deliverables/:deliverableId/links", requireAuth, async (req, res) => {
    try {
      const { title, url, visibility } = req.body;
      if (!title || !url) return res.status(400).json({ message: "title and url required" });
      const user = req.user as any;
      const link = await storage.createDeliverableLink({
        deliverableId: req.params.deliverableId, title, url,
        visibility: visibility || "sponsor_private", addedByUserId: user?.id || null,
      });
      res.json(link);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // DELETE /api/agreement/deliverables/:deliverableId/links/:linkId
  app.delete("/api/agreement/deliverables/:deliverableId/links/:linkId", requireAuth, async (req, res) => {
    try {
      await storage.deleteDeliverableLink(req.params.linkId);
      res.json({ success: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  function extractSponsorToken(req: any): string | undefined {
    return (req.headers["x-sponsor-token"] as string) ?? (req.query.token as string);
  }

  // Sponsor-facing: GET /api/sponsor-dashboard/files — list files for a sponsor
  app.get("/api/sponsor-dashboard/files", async (req, res) => {
    try {
      const token = extractSponsorToken(req);
      if (!token) return res.status(401).json({ message: "Unauthorized" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const { tokenRecord } = validation;
      const { deliverableId } = req.query as Record<string, string>;
      if (!deliverableId) return res.status(400).json({ message: "deliverableId required" });
      const files = await storage.listFileAssets({ deliverableId, status: "active" });
      const visible = files.filter(f => f.visibility !== "admin_private");
      res.json(visible);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Sponsor-facing: GET /api/sponsor-dashboard/files/:id/download-url — signed GET URL
  app.get("/api/sponsor-dashboard/files/:id/download-url", async (req, res) => {
    try {
      const token = extractSponsorToken(req);
      if (!token) return res.status(401).json({ message: "Unauthorized" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const { tokenRecord } = validation;

      const file = await storage.getFileAsset(req.params.id);
      if (!file) return res.status(404).json({ message: "File not found" });
      if (file.status === "archived") return res.status(410).json({ message: "File has been archived" });
      if (file.visibility === "admin_private") return res.status(403).json({ message: "Access denied" });
      if (file.sponsorId && file.sponsorId !== tokenRecord.sponsorId) return res.status(403).json({ message: "Access denied" });

      const downloadURL = await generateDownloadUrl(file.objectKey, 3600);
      res.json({ downloadURL, fileName: file.originalFileName, mimeType: file.mimeType });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Sponsor-facing: GET /api/sponsor-dashboard/deliverable-links/:deliverableId
  app.get("/api/sponsor-dashboard/deliverable-links/:deliverableId", async (req, res) => {
    try {
      const token = extractSponsorToken(req);
      if (!token) return res.status(401).json({ message: "Unauthorized" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const links = await storage.listDeliverableLinks(req.params.deliverableId);
      const visible = links.filter(l => l.visibility !== "admin_private");
      res.json(visible);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Sponsor-facing: POST /api/sponsor-dashboard/files/upload-url — sponsor file upload
  app.post("/api/sponsor-dashboard/files/upload-url", async (req, res) => {
    try {
      const token = extractSponsorToken(req);
      if (!token) return res.status(401).json({ message: "Unauthorized" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const { tokenRecord } = validation;

      // Check access level — viewer cannot upload
      const sponsorUser = await storage.getSponsorUserById(tokenRecord.sponsorUserId);
      if (sponsorUser && sponsorUser.accessLevel === "viewer") return res.status(403).json({ message: "Viewer access cannot upload files" });

      const { category, originalFileName, mimeType, sizeBytes } = req.body;
      if (!category || !originalFileName || !mimeType) return res.status(400).json({ message: "category, originalFileName, mimeType required" });
      if (!SPONSOR_UPLOADABLE_CATEGORIES.includes(category)) return res.status(403).json({ message: `Sponsors cannot upload to category: ${category}` });

      const rules = CATEGORY_RULES[category];
      if (!rules.allowedMime.includes(mimeType)) return res.status(400).json({ message: `File type ${mimeType} not allowed for category ${category}` });
      if (sizeBytes && sizeBytes > rules.maxBytes) return res.status(400).json({ message: `File too large. Max ${rules.maxBytes / 1024 / 1024}MB for ${category}` });

      const { fileId, objectKey, storedFileName } = buildObjectKeyFlat(originalFileName);
      const uploadURL = await generateUploadUrl(objectKey, 900);
      res.json({ uploadURL, fileId, objectKey, storedFileName });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // Sponsor-facing: POST /api/sponsor-dashboard/files/confirm
  app.post("/api/sponsor-dashboard/files/confirm", async (req, res) => {
    try {
      const token = extractSponsorToken(req);
      if (!token) return res.status(401).json({ message: "Unauthorized" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const { tokenRecord } = validation;

      const { fileId, objectKey, storedFileName, category, originalFileName, mimeType, sizeBytes, deliverableId, eventId, title, replacesFileAssetId } = req.body;
      if (!fileId || !objectKey || !category || !originalFileName || !mimeType) return res.status(400).json({ message: "Missing required fields" });

      let fileAsset;
      if (replacesFileAssetId) {
        fileAsset = await storage.replaceFileAsset(replacesFileAssetId, {
          eventId: eventId || null, sponsorId: tokenRecord.sponsorId, deliverableId: deliverableId || null,
          uploadedByUserId: null, uploadedByRole: "sponsor",
          category, originalFileName, storedFileName: storedFileName || originalFileName, objectKey, mimeType,
          sizeBytes: sizeBytes || null, visibility: "sponsor_private",
          accessScope: "deliverable", title: title || null, description: null,
          status: "active", isLatestVersion: true,
        });
      } else {
        fileAsset = await storage.createFileAsset({
          eventId: eventId || null, sponsorId: tokenRecord.sponsorId, deliverableId: deliverableId || null,
          uploadedByUserId: null, uploadedByRole: "sponsor",
          category, originalFileName, storedFileName: storedFileName || originalFileName, objectKey, mimeType,
          sizeBytes: sizeBytes || null, visibility: "sponsor_private",
          accessScope: "deliverable", title: title || null, description: null,
          status: "active", isLatestVersion: true, replacesFileAssetId: null,
        });
      }

      if (deliverableId) {
        const deliverable = await storage.getAgreementDeliverable(deliverableId);
        if (deliverable && ["Not Started","Needed","Awaiting Sponsor Input"].includes(deliverable.status)) {
          await storage.updateAgreementDeliverable(deliverableId, { status: "Submitted" });
        }
      }

      res.json(fileAsset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  return httpServer;
}
