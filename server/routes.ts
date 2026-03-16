import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { insertEventSchema, insertSponsorSchema, insertAttendeeSchema, insertMeetingSchema, manualAttendeeSchema, insertInformationRequestSchema, insertAttendeeCategorySchema, insertCategoryMatchingRuleSchema, insertScheduledEmailSchema, insertSessionTypeSchema, insertAgendaSessionSchema, DEFAULT_ATTENDEE_CATEGORIES, type InsertEvent, type InsertSponsor, type InsertAttendee, type EventSponsorLink, type SponsorNotificationType, type UserPermissions, type InformationRequestStatus, INFORMATION_REQUEST_STATUSES, DEFAULT_USER_PERMISSIONS, ADMIN_PERMISSIONS, INVITATION_QUOTAS, MAX_INVITATIONS_PER_ATTENDEE } from "@shared/schema";
import { normalizeAttendeeCategory, rankAttendees, categoryLabel, setCategoryWeights, setCategoryLabels } from "./services/matchmakingService";
import { evaluateRules, testRulesAgainstValue } from "./services/categoryRuleEngine";
import { requireAuth, requireAdmin, stripPassword } from "./auth";
import { buildSponsorReportPDF } from "./pdf-report";
import { sendEmail, sendMeetingConfirmationToAttendee, sendMeetingNotificationToSponsor, sendInformationRequestNotificationToSponsor, sendInformationRequestConfirmationToAttendee, sendInternalDeliverableNotification as sendInternalNotification, isAutomationEnabled, recordAutomationSend, createMessageJobForSend, completeMessageJob } from "../services/emailService";
import multer from "multer";
import path from "path";
import { randomBytes, createHash } from "crypto";
import { objectStorageClient } from "./replit_integrations/object_storage/objectStorage";
import { generateUploadUrl, generateDownloadUrl, buildObjectKeyFlat } from "./services/fileStorageService";
import { runFullBackup, runEventBackup, runSponsorEventBackup, listBackupJobs, getBackupJob, getBackupObjectKey, streamR2Object } from "./backup-service";
import { validateBackup, getBackupDetail } from "./services/restoreValidationService";
import { dryRunRestore } from "./services/restoreImportService";
import { isDemoMode, getAppEnv } from "./services/demoModeService";
import { db } from "./db";
import { events as eventsTable, sponsors as sponsorsTable, attendees as attendeesTable, meetings as meetingsTable, informationRequests as informationRequestsTable } from "@shared/schema";
import { sql } from "drizzle-orm";

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

async function deriveAttendeeCategory(sourceData: Record<string, string | null | undefined>): Promise<string | null> {
  const rules = await storage.getCategoryMatchingRules();
  const categories = await storage.getAttendeeCategories();
  const activeRules = rules.filter(r => r.isActive);
  if (activeRules.length > 0) {
    const result = evaluateRules(sourceData, activeRules, categories);
    if (result.categoryKey) return result.categoryKey;
  }
  return normalizeAttendeeCategory((sourceData.ticket_type ?? sourceData.ticketType ?? "") as string);
}

async function refreshCategoryConfig() {
  try {
    const cats = await storage.getAttendeeCategories();
    if (cats.length > 0) {
      const weights: Record<string, number> = {};
      const labels: Record<string, string> = {};
      for (const c of cats) {
        weights[c.key] = c.matchWeight;
        labels[c.key] = c.label;
      }
      setCategoryWeights(weights);
      setCategoryLabels(labels);
    }
  } catch {}
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedData().catch(console.error);
  seedUsers().catch(console.error);

  async function getAppBaseUrl(): Promise<string> {
    if (process.env.BASE_APP_URL?.trim()) return process.env.BASE_APP_URL.trim().replace(/\/$/, "");
    const branding = await storage.getBranding();
    if (branding.appBaseUrl?.trim()) return branding.appBaseUrl.trim().replace(/\/$/, "");
    if (process.env.REPLIT_DEPLOYMENT === "1" && process.env.REPLIT_DOMAINS) {
      return `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
    }
    if (process.env.REPLIT_DEV_DOMAIN) return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    return "https://concierge.convergeevents.com";
  }

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
    const baseUrl = await getAppBaseUrl();
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

  async function autoAssignDeliverables(
    sponsorId: string,
    eventAssignments: Array<{ eventId: string; sponsorshipLevel: string }>,
    skipExisting: boolean
  ): Promise<{
    autoGenerated: Array<{ eventId: string; level: string; templateId: string; templateName: string }>;
    warnings: Array<{ eventId: string; level: string; reason: string }>;
  }> {
    const allTemplates = await storage.listPackageTemplates({ isArchived: false });
    const autoGenerated: Array<{ eventId: string; level: string; templateId: string; templateName: string }> = [];
    const warnings: Array<{ eventId: string; level: string; reason: string }> = [];
    for (const ae of eventAssignments) {
      const level = ae.sponsorshipLevel;
      if (!level || level === "None") continue;
      if (skipExisting) {
        const existing = await storage.listAgreementDeliverables({ sponsorId, eventId: ae.eventId });
        if (existing.length > 0) continue;
      }
      const template =
        allTemplates.find((t) => t.eventId === ae.eventId && t.sponsorshipLevel === level && t.isActive) ??
        allTemplates.find((t) => !t.eventId && t.sponsorshipLevel === level && t.isActive);
      if (!template) {
        warnings.push({ eventId: ae.eventId, level, reason: `No active Sponsorship Template found for "${level}" level. The sponsor was saved, but deliverables were not generated for this event.` });
        continue;
      }
      try {
        await storage.generateAgreementDeliverablesFromTemplate(sponsorId, ae.eventId, template.id, level);
        autoGenerated.push({ eventId: ae.eventId, level, templateId: template.id, templateName: template.packageName });
      } catch (err) {
        warnings.push({ eventId: ae.eventId, level, reason: String(err) });
      }
    }
    return { autoGenerated, warnings };
  }

  app.post("/api/sponsors", async (req, res) => {
    const parsed = insertSponsorSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error });
    const sponsor = await storage.createSponsor(parsed.data);
    const eventAssignments = (parsed.data.assignedEvents ?? [])
      .filter((ae) => ae.sponsorshipLevel && ae.sponsorshipLevel !== "None")
      .map((ae) => ({ eventId: ae.eventId, sponsorshipLevel: ae.sponsorshipLevel as string }));
    const { autoGenerated, warnings } = await autoAssignDeliverables(sponsor.id, eventAssignments, false);

    if (sponsor.contactEmail) {
      try {
        await storage.upsertSponsorUser({
          sponsorId: sponsor.id,
          name: sponsor.contactName ?? "",
          email: sponsor.contactEmail.toLowerCase().trim(),
          accessLevel: "owner",
          isPrimary: true,
        });
      } catch (err: any) {
        console.error(`[SPONSOR CREATE] Auto-create sponsor user failed: ${err?.message ?? err}`);
      }
    }

    res.status(201).json({ sponsor, autoGenerated, warnings });
  });

  app.patch("/api/sponsors/:id", async (req, res) => {
    const updates = { ...req.body };
    const prevSponsor = await storage.getSponsor(req.params.id);
    const prevLevels: Record<string, string> = {};
    for (const ae of prevSponsor?.assignedEvents ?? []) {
      if (ae.sponsorshipLevel) prevLevels[ae.eventId] = ae.sponsorshipLevel;
    }
    if (Array.isArray(updates.assignedEvents)) {
      updates.assignedEvents = updates.assignedEvents.filter(
        (ae: any) => !!ae.sponsorshipLevel && ae.sponsorshipLevel !== "None"
      );
    }
    const sponsor = await storage.updateSponsor(req.params.id, updates);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const newAssignments = (sponsor.assignedEvents ?? [])
      .filter((ae) => ae.sponsorshipLevel && ae.sponsorshipLevel !== "None")
      .map((ae) => ({ eventId: ae.eventId, sponsorshipLevel: ae.sponsorshipLevel as string }));
    const levelChangedWarnings: Array<{ eventId: string; level: string; reason: string }> = [];
    const toGenerate: Array<{ eventId: string; sponsorshipLevel: string }> = [];
    for (const ae of newAssignments) {
      const oldLevel = prevLevels[ae.eventId];
      if (oldLevel && oldLevel !== ae.sponsorshipLevel) {
        const existing = await storage.listAgreementDeliverables({ sponsorId: sponsor.id, eventId: ae.eventId });
        if (existing.length > 0) {
          levelChangedWarnings.push({
            eventId: ae.eventId,
            level: ae.sponsorshipLevel,
            reason: `Sponsorship level changed from ${oldLevel} to ${ae.sponsorshipLevel}, but existing deliverables were not regenerated. Use "Regenerate from Template" in the Deliverables section if needed.`,
          });
          continue;
        }
      }
      toGenerate.push(ae);
    }
    const { autoGenerated, warnings } = await autoAssignDeliverables(sponsor.id, toGenerate, true);

    if (sponsor.contactEmail && (updates.contactEmail || updates.contactName)) {
      try {
        const existingUsers = await storage.getSponsorUsersBySponsor(sponsor.id);
        const primaryUser = existingUsers.find(u => u.isPrimary);
        const prevEmail = prevSponsor?.contactEmail?.toLowerCase().trim();
        if (primaryUser && prevEmail && primaryUser.email === prevEmail) {
          await storage.updateSponsorUser(primaryUser.id, {
            name: sponsor.contactName ?? "",
            email: sponsor.contactEmail.toLowerCase().trim(),
          });
        } else if (!primaryUser && sponsor.contactEmail) {
          await storage.upsertSponsorUser({
            sponsorId: sponsor.id,
            name: sponsor.contactName ?? "",
            email: sponsor.contactEmail.toLowerCase().trim(),
            accessLevel: "owner",
            isPrimary: true,
          });
        }
      } catch (err: any) {
        console.error(`[SPONSOR UPDATE] Sync sponsor user failed: ${err?.message ?? err}`);
      }
    }

    res.json({ sponsor, autoGenerated, warnings: [...warnings, ...levelChangedWarnings] });
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
    const UPDATABLE_FIELDS = [
      "firstName", "lastName", "name", "email", "company", "title", "phone",
      "linkedinUrl", "assignedEvent", "archiveState", "archiveSource",
      "externalSource", "externalRegistrationId", "interests", "notes",
      "ticketType", "attendeeCategory",
    ];
    try {
      const raw = req.body ?? {};
      const updates: Record<string, any> = {};
      for (const key of UPDATABLE_FIELDS) {
        if (key in raw) updates[key] = raw[key];
      }
      if (updates.attendeeCategory === "") updates.attendeeCategory = null;
      if (updates.ticketType === "") updates.ticketType = null;

      if (updates.attendeeCategory) {
        const configuredCategories = await storage.getAttendeeCategories();
        const validKeys = new Set(configuredCategories.filter(c => c.isActive).map(c => c.key));
        const raw = String(updates.attendeeCategory);
        const normalized = raw.toUpperCase().replace(/[\s/]+/g, "_").replace(/-/g, "_");
        if (validKeys.has(raw)) {
          updates.attendeeCategory = raw;
        } else if (validKeys.has(normalized)) {
          updates.attendeeCategory = normalized;
        } else {
          return res.status(400).json({ message: `Invalid attendee category. "${raw}" is not a configured active attendee category.` });
        }
      }

      console.log(`[attendees] PATCH ${req.params.id}:`, JSON.stringify(updates));
      const attendee = await storage.updateAttendee(req.params.id, updates);
      if (!attendee) return res.status(404).json({ message: "Attendee not found" });
      res.json(attendee);
    } catch (err: any) {
      console.error(`[attendees] PATCH error for ${req.params.id}:`, err.message, err.stack);
      res.status(500).json({ message: "Failed to update attendee", detail: err.message });
    }
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

  app.post("/api/admin/attendees/:id/send-scheduling-email", requireAuth, async (req, res) => {
    try {
      if (!await isAutomationEnabled(storage, "scheduling_invitation")) {
        return res.status(400).json({ message: "The Scheduling Invitation automation is currently disabled" });
      }
      const attendee = await storage.getAttendee(req.params.id);
      if (!attendee) return res.status(404).json({ message: "Attendee not found" });
      if (!attendee.email) return res.status(400).json({ message: "Attendee has no email address" });
      if (!attendee.assignedEvent) return res.status(400).json({ message: "Attendee has no assigned event" });

      const event = await storage.getEvent(attendee.assignedEvent);
      if (!event) return res.status(404).json({ message: "Assigned event not found" });

      if (!event.schedulingEnabled) {
        return res.status(400).json({ message: `Scheduling is not enabled for ${event.name}` });
      }

      const baseUrl = await getAppBaseUrl();
      // Generate a personal concierge token so the invitation opens the new attendee experience
      const inviteToken = await storage.createAttendeeToken(attendee.id, attendee.assignedEvent);
      const schedulingUrl = `${baseUrl}/attendee-access/${inviteToken.token}`;
      const firstName = attendee.firstName || attendee.name?.split(" ")[0] || attendee.name || "Attendee";

      const template = await storage.getEmailTemplateByKey("scheduling_invitation");
      let subject = `You're invited to schedule meetings at ${event.name}`;
      let html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Hello ${firstName},</h2>
          <p>You've been invited to schedule meetings with our sponsors at <strong>${event.name}</strong>.</p>
          <p>Use the link below to browse available sponsors and book your meetings:</p>
          <p style="text-align: center; margin: 24px 0;">
            <a href="${schedulingUrl}" style="background-color: #0D9488; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600;">
              Schedule Your Meetings
            </a>
          </p>
          <p style="font-size: 13px; color: #6b7280;">
            Or copy this link: <a href="${schedulingUrl}">${schedulingUrl}</a>
          </p>
          ${event.startDate ? `<p style="font-size: 13px; color: #6b7280;">Event dates: ${new Date(event.startDate).toLocaleDateString()} – ${event.endDate ? new Date(event.endDate).toLocaleDateString() : "TBD"}</p>` : ""}
        </div>
      `;

      if (template?.htmlTemplate && template.htmlTemplate.trim()) {
        const vars: Record<string, string> = {
          attendee_first_name: firstName,
          attendee_full_name: attendee.name || `${attendee.firstName || ""} ${attendee.lastName || ""}`.trim(),
          event_name: event.name,
          event_code: event.slug,
          scheduling_url: schedulingUrl,
        };
        subject = (template.subjectTemplate || subject).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
        html = template.htmlTemplate.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
      }

      const messageJobId = await createMessageJobForSend(storage, {
        jobName: `Scheduling Invitation – ${attendee.name || attendee.email} – ${event.slug || event.name}`,
        messageType: "MANUAL",
        sourceType: "manual_send",
        eventId: event.id,
        attendeeId: attendee.id,
        templateId: template?.id || null,
        templateKeySnapshot: "scheduling_invitation",
        triggerType: "MANUAL_SEND",
        triggerName: "Send scheduling email",
        recipientCount: 1,
        createdByUserId: req.session?.userId || null,
      });

      let status: "sent" | "failed" = "sent";
      let errorMessage: string | null = null;
      let providerMessageId: string | null = null;
      try {
        const result = await sendEmail(attendee.email, subject, html);
        providerMessageId = result?.messageId ?? null;
      } catch (err: any) {
        status = "failed";
        errorMessage = err?.message ?? String(err);
      }

      await storage.createEmailLog({
        emailType: "scheduling_invitation",
        recipientEmail: attendee.email,
        subject,
        htmlContent: html,
        eventId: event.id,
        attendeeId: attendee.id,
        status,
        errorMessage,
        providerMessageId,
        source: "Automation – Scheduling Invitation",
        messageJobId,
      });

      await completeMessageJob(storage, messageJobId, status === "sent" ? 1 : 0, status === "failed" ? 1 : 0);
      await recordAutomationSend(storage, "scheduling_invitation", status === "sent" ? 1 : 0, status === "failed" ? 1 : 0, errorMessage);

      if (status === "failed") {
        return res.status(500).json({ message: `Failed to send email: ${errorMessage}` });
      }

      res.json({ message: "Scheduling email sent", recipientEmail: attendee.email });
    } catch (err: any) {
      console.error("[SEND SCHEDULING EMAIL] Error:", err);
      res.status(500).json({ message: err.message ?? "Failed to send scheduling email" });
    }
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
        const jobId = await createMessageJobForSend(storage, {
          jobName: `Meeting Booked – ${meetingAttendee?.name || "Attendee"} × ${meetingSponsor?.name || "Sponsor"}`,
          messageType: "SYSTEM", sourceType: "event_action",
          eventId: meeting.eventId, sponsorId: meeting.sponsorId, attendeeId: meeting.attendeeId,
          triggerType: "EVENT_ACTION", triggerName: "Meeting booked",
          recipientCount: 2,
        });
        const sponsorTokens = await storage.getSponsorTokensBySponsor(meeting.sponsorId).catch(() => []);
        const activeToken = sponsorTokens.find((t: any) => t.isActive && t.eventId === meeting.eventId);
        let sentCount = 0; let failedCount = 0;
        try {
          await sendMeetingConfirmationToAttendee(storage, meetingAttendee, meetingSponsor, meeting, meetingEvent);
          sentCount++;
        } catch { failedCount++; }
        try {
          await sendMeetingNotificationToSponsor(storage, meetingAttendee, meetingSponsor, meeting, meetingEvent, activeToken?.token ?? null);
          sentCount++;
        } catch { failedCount++; }
        await completeMessageJob(storage, jobId, sentCount, failedCount);
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

  // ── Admin Sponsor Dashboards ─────────────────────────────────────────────

  app.get("/api/admin/sponsor-dashboards", requireAdmin, async (_req, res) => {
    const allSponsors = await storage.getSponsors();
    const allEvents = await storage.getEvents();
    const allSponsorUsers = await storage.getAllSponsorUsers();

    const eventMap = new Map(allEvents.map(e => [e.id, e]));
    const sponsorUserMap = new Map<string, typeof allSponsorUsers[0][]>();
    for (const su of allSponsorUsers) {
      if (!sponsorUserMap.has(su.sponsorId)) sponsorUserMap.set(su.sponsorId, []);
      sponsorUserMap.get(su.sponsorId)!.push(su);
    }

    const allTokens: import("@shared/schema").SponsorToken[] = [];
    for (const s of allSponsors) {
      const t = await storage.getSponsorTokensBySponsor(s.id);
      allTokens.push(...t);
    }
    const tokenMap = new Map<string, typeof allTokens[0]>();
    for (const t of allTokens) {
      const key = `${t.sponsorId}:${t.eventId}`;
      const existing = tokenMap.get(key);
      if (!existing || (t.isActive && !existing.isActive)) tokenMap.set(key, t);
    }

    interface DashboardRow {
      sponsorId: string;
      sponsorName: string;
      sponsorLogoUrl: string | null;
      eventId: string;
      eventName: string;
      eventSlug: string;
      eventAccentColor: string | null;
      sponsorshipLevel: string;
      primaryContact: { name: string; email: string } | null;
      status: string;
      tokenIsActive: boolean;
      hasToken: boolean;
      lastAccessSent: string | null;
      lastLogin: string | null;
    }

    const rows: DashboardRow[] = [];
    for (const sponsor of allSponsors) {
      if (sponsor.archiveState === "archived") continue;
      for (const ae of sponsor.assignedEvents ?? []) {
        if (ae.archiveState === "archived") continue;
        if (!ae.sponsorshipLevel || ae.sponsorshipLevel === "None") continue;
        const event = eventMap.get(ae.eventId);
        if (!event || event.archiveState === "archived") continue;

        const users = sponsorUserMap.get(sponsor.id) ?? [];
        const primaryUser = users.find(u => u.isPrimary && u.isActive) ?? users.find(u => u.isActive);
        const primaryContact = primaryUser
          ? { name: primaryUser.name, email: primaryUser.email }
          : (sponsor.contactEmail ? { name: sponsor.contactName ?? "", email: sponsor.contactEmail } : null);

        const tokenKey = `${sponsor.id}:${ae.eventId}`;
        const token = tokenMap.get(tokenKey);
        const hasToken = !!token;
        const tokenIsActive = token?.isActive ?? false;

        let status = "Ready";
        if (!primaryContact) {
          status = "No Contact Assigned";
        } else if (tokenIsActive) {
          const loginedUser = users.find(u => u.lastLoginAt);
          status = loginedUser ? "Active" : "Access Sent";
        } else if (hasToken && !tokenIsActive) {
          status = "Inactive";
        }

        rows.push({
          sponsorId: sponsor.id,
          sponsorName: sponsor.name,
          sponsorLogoUrl: sponsor.logoUrl ?? null,
          eventId: ae.eventId,
          eventName: event.name,
          eventSlug: event.slug,
          eventAccentColor: event.accentColor ?? event.primaryColor ?? null,
          sponsorshipLevel: ae.sponsorshipLevel,
          primaryContact,
          status,
          tokenIsActive,
          hasToken,
          tokenValue: token?.token ?? null,
          lastAccessSent: token?.createdAt ? new Date(token.createdAt).toISOString() : null,
          lastLogin: primaryUser?.lastLoginAt ? new Date(primaryUser.lastLoginAt).toISOString() : null,
        });
      }
    }
    res.json(rows);
  });

  app.post("/api/admin/sponsor-dashboards/send-access", requireAdmin, async (req, res) => {
    const { sponsorId, eventId } = req.body;
    if (!sponsorId || !eventId) return res.status(400).json({ message: "sponsorId and eventId are required" });

    const sponsor = await storage.getSponsor(sponsorId);
    const event = await storage.getEvent(eventId);
    if (!sponsor || !event) return res.status(404).json({ message: "Sponsor or event not found" });

    let users = await storage.getSponsorUsersBySponsor(sponsorId);
    let primaryUser = users.find(u => u.isPrimary && u.isActive) ?? users.find(u => u.isActive);

    if (!primaryUser && sponsor.contactEmail) {
      primaryUser = await storage.upsertSponsorUser({
        sponsorId: sponsor.id,
        name: sponsor.contactName ?? "",
        email: sponsor.contactEmail.toLowerCase().trim(),
        accessLevel: "owner",
        isPrimary: true,
      });
    }

    if (!primaryUser) {
      return res.status(400).json({ message: "No contact assigned to this sponsor. Add a main contact first." });
    }

    const existingTokens = await storage.getSponsorTokensBySponsor(sponsorId);
    const activeForEvent = existingTokens.find(t => t.eventId === eventId && t.isActive);
    if (activeForEvent) await storage.revokeSponsorToken(activeForEvent.token);
    const sponsorToken = await storage.createSponsorToken(sponsorId, eventId);

    const rawLoginToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawLoginToken).digest("hex");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await storage.invalidateSponsorLoginTokens(primaryUser.id);
    await storage.createSponsorLoginToken({
      sponsorUserId: primaryUser.id,
      sponsorId: sponsor.id,
      tokenHash,
      expiresAt,
    });

    const baseUrl = await getAppBaseUrl();
    console.log(`[SEND ACCESS] Sending dashboard access for "${sponsor.name}" → ${primaryUser.email} (baseUrl: ${baseUrl})`);

    try {
      const { sendSponsorMagicLoginEmail } = await import("../services/emailService.js");
      await sendSponsorMagicLoginEmail(storage, primaryUser, sponsor, rawLoginToken, baseUrl, event.name);
    } catch (err: any) {
      console.error(`[SEND ACCESS] Email failed: ${err?.message ?? err}`);
    }

    res.json({ ok: true, status: "Access sent", token: sponsorToken.token });
  });

  app.post("/api/admin/sponsor-dashboards/backfill", requireAdmin, async (_req, res) => {
    const allSponsors = await storage.getSponsors();
    let created = 0;
    for (const sponsor of allSponsors) {
      if (sponsor.archiveState === "archived") continue;
      if (!sponsor.contactEmail) continue;
      const existing = await storage.getSponsorUsersBySponsor(sponsor.id);
      if (existing.length > 0) continue;
      await storage.upsertSponsorUser({
        sponsorId: sponsor.id,
        name: sponsor.contactName ?? "",
        email: sponsor.contactEmail.toLowerCase().trim(),
        accessLevel: "owner",
        isPrimary: true,
      });
      created++;
    }
    res.json({ ok: true, created, message: `Created ${created} sponsor dashboard contacts from main contacts.` });
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
    const baseUrl = await getAppBaseUrl();
    console.log(`[SPONSOR MAGIC LOGIN] Generating magic link for ${normalizedEmail} (baseUrl: ${baseUrl})`);

    try {
      const { sendSponsorMagicLoginEmail } = await import("../services/emailService.js");
      sendSponsorMagicLoginEmail(storage, sponsorUser, sponsor, rawToken, baseUrl, null).catch((err: any) => {
        console.error(`[SPONSOR MAGIC LOGIN] Email failed for ${normalizedEmail}: ${err?.message ?? err}`);
      });
    } catch (err: any) {
      console.error(`[SPONSOR MAGIC LOGIN] Email service import failed: ${err?.message ?? err}`);
    }
    res.json({ message: neutralMessage });
  });

  app.get("/api/sponsor/auth/magic", async (req, res) => {
    try {
      const { token } = req.query as { token?: string };
      if (!token) {
        console.log("[MAGIC AUTH] Missing token in request");
        return res.redirect("/sponsor/login?error=missing_token");
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");
      const tokenRecord = await storage.getSponsorLoginTokenByHash(tokenHash);

      if (!tokenRecord) {
        console.log(`[MAGIC AUTH] Invalid token (hash: ${tokenHash.slice(0, 8)}…)`);
        return res.redirect("/sponsor/login?error=invalid_token");
      }
      if (tokenRecord.usedAt) {
        console.log(`[MAGIC AUTH] Token already used (sponsorUser: ${tokenRecord.sponsorUserId})`);
        return res.redirect("/sponsor/login?error=token_used");
      }
      if (new Date(tokenRecord.expiresAt) < new Date()) {
        console.log(`[MAGIC AUTH] Token expired (expired: ${tokenRecord.expiresAt})`);
        return res.redirect("/sponsor/login?error=token_expired");
      }

      await storage.markSponsorLoginTokenUsed(tokenRecord.id);
      await storage.updateSponsorUserLastLogin(tokenRecord.sponsorUserId);

      const tokens = await storage.getSponsorTokensBySponsor(tokenRecord.sponsorId);
      const activeToken = tokens.find((t) => t.isActive && new Date(t.expiresAt) > new Date());

      if (!activeToken) {
        console.log(`[MAGIC AUTH] No active dashboard token for sponsor ${tokenRecord.sponsorId}`);
        return res.redirect("/sponsor/login?error=no_dashboard_access");
      }

      console.log(`[MAGIC AUTH] Success — redirecting to dashboard (sponsor: ${tokenRecord.sponsorId}, token: ${activeToken.token.slice(0, 8)}…)`);
      return res.redirect(`/sponsor-access/${activeToken.token}`);
    } catch (err: any) {
      console.error(`[MAGIC AUTH] Unexpected error: ${err?.message ?? err}`);
      return res.redirect("/sponsor/login?error=server_error");
    }
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

    const baseUrl = await getAppBaseUrl();
    console.log(`[SPONSOR ACCESS EMAIL] Sending to ${sponsor.contactEmail} for sponsor "${sponsor.name}" (baseUrl: ${baseUrl})`);

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

    res.json({ ok: emailSent, sentTo: sponsor.contactEmail, error: emailError });
  });

  // ── Sponsor User CRUD ─────────────────────────────────────────────────────

  app.get("/api/admin/sponsors/:sponsorId/allowed-report-recipients", requireAuth, async (req, res) => {
    const sponsor = await storage.getSponsor(req.params.sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    const users = await storage.getSponsorUsersBySponsor(req.params.sponsorId);
    const recipients: { email: string; name: string; source: string }[] = [];
    const seen = new Set<string>();
    for (const u of users) {
      if (u.email && u.isActive && !seen.has(u.email.toLowerCase())) {
        seen.add(u.email.toLowerCase());
        recipients.push({ email: u.email, name: u.name || u.email, source: u.isPrimary ? "Primary Contact" : u.accessLevel === "owner" ? "Owner" : "Team Member" });
      }
    }
    if (sponsor.contactEmail && !seen.has(sponsor.contactEmail.toLowerCase())) {
      seen.add(sponsor.contactEmail.toLowerCase());
      recipients.push({ email: sponsor.contactEmail, name: sponsor.contactName || sponsor.contactEmail, source: "Sponsor Contact" });
    }
    res.json({ recipients, sponsorName: sponsor.name });
  });

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

    const baseUrl = await getAppBaseUrl();
    console.log(`[SPONSOR USER ACCESS] Sending to ${sponsorUser.email} for sponsor "${sponsor.name}" (baseUrl: ${baseUrl})`);

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
        accentColor: event.accentColor ?? null,
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
    const branding = await storage.getBranding();
    const { internalNotificationEmail: _omit, ...publicBranding } = branding;
    res.json(publicBranding);
  });

  app.get("/api/app-env", (_req, res) => {
    res.json({ env: getAppEnv(), isDemoMode: isDemoMode() });
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
    if (req.body.appBaseUrl && typeof req.body.appBaseUrl === "string") {
      const url = req.body.appBaseUrl.trim();
      if (url && !url.startsWith("https://")) {
        return res.status(400).json({ message: "Production URL must start with https://" });
      }
      req.body.appBaseUrl = url.replace(/\/$/, "");
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

  async function fetchLogoBuffer(url: string | null | undefined): Promise<Buffer | null> {
    if (!url) return null;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (!res.ok) return null;
      const ct = res.headers.get("content-type") ?? "";
      if (!ct.startsWith("image/")) return null;
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    } catch {
      return null;
    }
  }

  async function buildReportData(sponsorId: string, eventId: string) {
    const [sponsor, event, allMeetings, allAttendees, infoRequestsList, analyticsData, rawDeliverables] = await Promise.all([
      storage.getSponsor(sponsorId),
      storage.getEvent(eventId),
      storage.getMeetings(),
      storage.getAttendees(),
      storage.listInformationRequests({ sponsorId, eventId }),
      storage.getAnalyticsSummary(sponsorId, eventId),
      storage.listAgreementDeliverables({ sponsorId, eventId }),
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

    // Only include sponsor-visible deliverables in the report
    const deliverables = rawDeliverables
      .filter((d) => d.sponsorVisible !== false)
      .map((d) => ({
        id:               d.id,
        category:         d.category,
        deliverableName:  d.deliverableName,
        quantity:         d.quantity ?? null,
        quantityUnit:     d.quantityUnit ?? null,
        ownerType:        d.ownerType,
        status:           d.status,
        dueTiming:        d.dueTiming,
        dueDate:          d.dueDate ? d.dueDate.toISOString() : null,
        sponsorFacingNote: d.sponsorFacingNote ?? null,
        fulfillmentType:  d.fulfillmentType,
      }));

    const logoBuffer = await fetchLogoBuffer(event.logoUrl);

    return {
      generatedAt: new Date(),
      event: {
        name:         event.name,
        slug:         event.slug,
        location:     event.location,
        startDate:    fmtReportDate(event.startDate),
        endDate:      fmtReportDate(event.endDate),
        dateRange:    fmtDateRange(event.startDate, event.endDate),
        primaryColor: event.primaryColor ?? null,
        accentColor:  event.accentColor ?? null,
        logoBuffer,
      },
      sponsor: { name: sponsor.name, level: ((sponsor.assignedEvents ?? []).find((ae) => ae.eventId === eventId)?.sponsorshipLevel ?? sponsor.level ?? "") },
      meetings,
      infoRequests,
      deliverables,
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

    const sponsorSlug = data.sponsor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const eventSlug = data.event.slug.toLowerCase();
    const filename = `${eventSlug}-${sponsorSlug}-sponsorship-performance-report.pdf`;
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

    const sponsorSlug = data.sponsor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const eventSlug = data.event.slug.toLowerCase();
    const filename = `${eventSlug}-${sponsorSlug}-sponsorship-performance-report.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

    const pdf = buildSponsorReportPDF(data);
    (pdf as any).pipe(res);
  });

  // ── Eventzilla Webhook — Zapier registration intake ────────────────────────
  app.post("/api/integrations/eventzilla/registration", async (req, res) => {
    if (isDemoMode()) {
      console.log("[DEMO] Eventzilla webhook blocked in demo mode");
      return res.status(200).json({ ok: true, message: "Demo mode — webhook logged but not processed" });
    }
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

    const { eventCode, registrationId, firstName, lastName, email, company, title, status, phone,
      ticketType: rawTicketType, attendee_category: rawCategoryField } = req.body ?? {};

    const rawTicket = rawTicketType ? String(rawTicketType) : (rawCategoryField ? String(rawCategoryField) : null);

    console.log(`[eventzilla] webhook received — eventCode=${eventCode} email=${email} registrationId=${registrationId} rawTicketType=${rawTicket}`);

    if (!eventCode || !registrationId || !firstName || !lastName || !email) {
      console.log("[eventzilla] 400 — missing required fields");
      return res.status(400).json({ ok: false, error: "Missing required fields: eventCode, registrationId, firstName, lastName, email" });
    }

    const allEvents = await storage.getEvents();
    const event = allEvents.find((e) => e.slug?.toLowerCase() === String(eventCode).toLowerCase());
    if (!event) {
      console.log(`[eventzilla] 400 — unknown eventCode: ${eventCode}`);
      return res.status(400).json({ ok: false, error: `Unknown eventCode: ${eventCode}` });
    }

    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const existing = await storage.getAttendeeByEmailAndEvent(String(email).toLowerCase(), event.id);

    let normalizedCategory: string | null = null;
    if (rawTicket) {
      normalizedCategory = await deriveAttendeeCategory({
        ticket_type: rawTicket,
        company: company ? String(company) : undefined,
        title: title ? String(title) : undefined,
      });
      if (normalizedCategory) {
        console.log(`[eventzilla] ticket type "${rawTicket}" → category ${normalizedCategory}`);
      } else {
        console.log(`[eventzilla] ⚠ Unmapped attendee ticket type: "${rawTicket}" — category will be null`);
      }
    }

    const ticketAndCategory = {
      ...(rawTicket ? { ticketType: rawTicket } : {}),
      ...(normalizedCategory ? { attendeeCategory: normalizedCategory } : {}),
    };

    if (existing) {
      await storage.updateAttendee(existing.id, {
        firstName:              String(firstName),
        lastName:               String(lastName),
        name:                   fullName,
        company:                company ? String(company) : existing.company,
        title:                  title   ? String(title)   : existing.title,
        phone:                  phone   ? String(phone)   : existing.phone ?? undefined,
        externalSource:         "eventzilla",
        externalRegistrationId: String(registrationId),
        ...ticketAndCategory,
      });
      console.log(`[eventzilla] updated attendee ${existing.id} for ${email} / ${eventCode}`);
      await storage.reconcilePendingConciergeProfiles(event.id, String(email).toLowerCase(), existing.id).catch((e) => console.error("[eventzilla] reconcile error", e));
      return res.json({ ok: true, action: "updated", attendeeId: existing.id, eventCode });
    }

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
        ...ticketAndCategory,
      });
      console.log(`[eventzilla] reactivated + updated archived attendee ${archived.id} for ${email} / ${eventCode}`);
      await storage.reconcilePendingConciergeProfiles(event.id, String(email).toLowerCase(), archived.id).catch((e) => console.error("[eventzilla] reconcile error", e));
      return res.json({ ok: true, action: "updated", attendeeId: archived.id, eventCode });
    }

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
      ticketType:             rawTicket ?? undefined,
      attendeeCategory:       normalizedCategory ?? undefined,
    });
    console.log(`[eventzilla] created attendee ${created.id} for ${email} / ${eventCode}`);
    await storage.reconcilePendingConciergeProfiles(event.id, String(email).toLowerCase(), created.id).catch((e) => console.error("[eventzilla] reconcile error", e));
    return res.status(201).json({ ok: true, action: "created", attendeeId: created.id, eventCode });
  });

  // ── Anonymous Welcome Flow (Pending Concierge) ───────────────────────────

  // POST /api/public/welcome/:slug/start — create a pending profile for the wizard
  app.post("/api/public/welcome/:slug/start", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      const profile = await storage.createPendingConciergeProfile(event.id, "welcome_flow");
      return res.json({ profileId: profile.id, eventId: event.id });
    } catch (e) {
      console.error("[welcome] start error", e);
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/welcome/:slug/event — public event data for wizard header
  app.get("/api/public/welcome/:slug/event", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      return res.json({ id: event.id, name: event.name, startDate: event.startDate, endDate: event.endDate, venue: event.location, logoUrl: event.logoUrl });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/welcome/:slug/topics — event interest topics for card 1
  app.get("/api/public/welcome/:slug/topics", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      const topics = await storage.getEventInterestTopics(event.id);
      return res.json(topics);
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/welcome/:slug/sessions — sessions for card 3
  app.get("/api/public/welcome/:slug/sessions", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      const sessions = await storage.getAgendaSessions(event.id);
      return res.json(sessions);
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/welcome/:slug/sponsors — sponsors for card 4
  app.get("/api/public/welcome/:slug/sponsors", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      const allSponsors = await storage.getSponsors();
      const eventSponsors = allSponsors.filter((s: any) => (s.assignedEvents ?? []).some((ae: any) => ae.eventId === event.id) && s.archiveState === "active");
      const withTopics = await Promise.all(
        eventSponsors.map(async (s) => {
          const topicRows = await storage.getSponsorTopics(s.id, event.id);
          return { ...s, topicIds: topicRows.map((t: any) => t.topicId) };
        })
      );
      return res.json(withTopics);
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/pending/:profileId — get pending profile state
  app.get("/api/public/pending/:profileId", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const topics = await storage.getPendingConciergeTopics(profile.id);
      const sessions = await storage.getPendingConciergeSessions(profile.id);
      const meetingRequests = await storage.getPendingConciergeMeetingRequests(profile.id);
      return res.json({ profile, topics: topics.map((t) => t.topicId), sessions: sessions.map((s) => s.sessionId), meetingRequests });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // PATCH /api/public/pending/:profileId/topics — save topic selections
  app.patch("/api/public/pending/:profileId/topics", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { topicIds } = req.body as { topicIds: string[] };
      if (!Array.isArray(topicIds)) return res.status(400).json({ error: "topicIds must be an array" });
      await storage.setPendingConciergeTopics(profile.id, topicIds);
      await storage.updatePendingConciergeProfile(profile.id, { onboardingStep: "email" });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // PATCH /api/public/pending/:profileId/email — save email (card 2)
  app.patch("/api/public/pending/:profileId/email", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { email } = req.body as { email: string };
      if (!email || typeof email !== "string") return res.status(400).json({ error: "email required" });
      const lowerEmail = email.toLowerCase().trim();
      await storage.updatePendingConciergeProfile(profile.id, { email: lowerEmail, onboardingStep: "sessions" });
      // Check if this email already has a real attendee — return token if so
      const attendee = await storage.getAttendeeByEmailAndEvent(lowerEmail, profile.eventId);
      if (attendee) {
        const tokenRecord = await storage.createAttendeeToken(attendee.id, profile.eventId);
        await storage.reconcilePendingConciergeProfiles(profile.eventId, lowerEmail, attendee.id).catch(() => {});
        return res.json({ ok: true, matched: true, token: tokenRecord.token, attendeeId: attendee.id });
      }
      return res.json({ ok: true, matched: false });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // PATCH /api/public/pending/:profileId/sessions — save session (add or remove)
  app.patch("/api/public/pending/:profileId/sessions", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { sessionId, action } = req.body as { sessionId: string; action: "add" | "remove" };
      if (!sessionId) return res.status(400).json({ error: "sessionId required" });
      if (action === "remove") {
        await storage.removePendingConciergeSession(profile.id, sessionId);
      } else {
        await storage.addPendingConciergeSession(profile.id, sessionId);
      }
      await storage.updatePendingConciergeProfile(profile.id, { onboardingStep: "sponsors" });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // POST /api/public/pending/:profileId/meeting-request — add a sponsor meeting/info request
  app.post("/api/public/pending/:profileId/meeting-request", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const { sponsorId, requestType } = req.body as { sponsorId: string; requestType: string };
      if (!sponsorId || !requestType) return res.status(400).json({ error: "sponsorId and requestType required" });
      await storage.addPendingConciergeMeetingRequest(profile.id, sponsorId, requestType);
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // POST /api/public/pending/:profileId/complete — mark wizard as done
  app.post("/api/public/pending/:profileId/complete", async (req, res) => {
    try {
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      await storage.updatePendingConciergeProfile(profile.id, { isCompleted: true, onboardingStep: "complete" });
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // GET /api/public/welcome/:slug/recommended-sessions/:profileId — topic-matched sessions for card 2 preview
  app.get("/api/public/welcome/:slug/recommended-sessions/:profileId", async (req, res) => {
    try {
      const event = await storage.getEventBySlug(req.params.slug);
      if (!event) return res.status(404).json({ error: "Event not found" });
      const profile = await storage.getPendingConciergeProfile(req.params.profileId);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      const profileTopics = await storage.getPendingConciergeTopics(profile.id);
      const topicIds = new Set(profileTopics.map((t) => t.topicId));
      const sessions = await storage.getAgendaSessions(event.id);
      // Score by how many topic tags match
      const scored = sessions.map((s) => {
        const tags: string[] = (s as any).topicTags ?? [];
        const score = tags.filter((t) => topicIds.has(t)).length;
        return { ...s, matchScore: score };
      }).filter((s) => s.matchScore > 0).sort((a, b) => b.matchScore - a.matchScore);
      return res.json(scored.slice(0, 6));
    } catch (e) {
      return res.status(500).json({ error: "Internal error" });
    }
  });

  // ── Attendee Category Definitions CRUD ───────────────────────────────────
  app.get("/api/admin/attendee-categories", requireAuth, async (_req, res) => {
    const categories = await storage.getAttendeeCategories();
    res.json(categories);
  });

  app.post("/api/admin/attendee-categories", requireAdmin, async (req, res) => {
    const parsed = insertAttendeeCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await storage.getAttendeeCategoryByKey(parsed.data.key);
    if (existing) return res.status(409).json({ error: `Category key "${parsed.data.key}" already exists` });
    const created = await storage.createAttendeeCategory(parsed.data);
    await refreshCategoryConfig();
    res.status(201).json(created);
  });

  app.patch("/api/admin/attendee-categories/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    const updates = req.body;
    const updated = await storage.updateAttendeeCategory(id, updates);
    if (!updated) return res.status(404).json({ error: "Category not found" });
    await refreshCategoryConfig();
    res.json(updated);
  });

  app.delete("/api/admin/attendee-categories/:id", requireAdmin, async (req, res) => {
    const cat = await storage.getAttendeeCategory(req.params.id);
    if (cat) {
      const rules = await storage.getCategoryMatchingRules();
      const dependentRules = rules.filter(r => r.categoryKey === cat.key);
      if (dependentRules.length > 0) {
        return res.status(409).json({ error: `Cannot delete: ${dependentRules.length} matching rule(s) reference this category. Delete or reassign them first.` });
      }
    }
    await storage.deleteAttendeeCategory(req.params.id);
    await refreshCategoryConfig();
    res.json({ ok: true });
  });

  // ── Agenda: Session Types CRUD ──────────────────────────────────────────

  app.get("/api/admin/session-types", requireAuth, async (_req, res) => {
    const types = await storage.getSessionTypes();
    res.json(types);
  });

  app.post("/api/admin/session-types", requireAuth, async (req, res) => {
    const parsed = insertSessionTypeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const existing = await storage.getSessionTypeByKey(parsed.data.key);
    if (existing) return res.status(409).json({ error: "Session type key already exists" });
    const st = await storage.createSessionType(parsed.data);
    res.status(201).json(st);
  });

  app.patch("/api/admin/session-types/:id", requireAuth, async (req, res) => {
    const allowed = ["label", "speakerLabelSingular", "speakerLabelPlural", "isActive", "displayOrder"];
    const updates: any = {};
    for (const k of allowed) { if (req.body[k] !== undefined) updates[k] = req.body[k]; }
    if (Object.keys(updates).length === 0) return res.status(400).json({ error: "No valid fields to update" });
    const st = await storage.updateSessionType(req.params.id, updates);
    if (!st) return res.status(404).json({ error: "Session type not found" });
    res.json(st);
  });

  app.delete("/api/admin/session-types/:id", requireAuth, async (req, res) => {
    await storage.deleteSessionType(req.params.id);
    res.json({ success: true });
  });

  // ── Agenda: Sessions CRUD ─────────────────────────────────────────────

  app.get("/api/admin/agenda-sessions", requireAuth, async (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    const sessions = await storage.getAgendaSessions(eventId);
    const sessionsWithSpeakers = await Promise.all(
      sessions.map(async (s) => ({
        ...s,
        speakers: await storage.getSessionSpeakers(s.id),
      }))
    );
    res.json(sessionsWithSpeakers);
  });

  app.get("/api/admin/agenda-sessions/:id", requireAuth, async (req, res) => {
    const session = await storage.getAgendaSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    const speakers = await storage.getSessionSpeakers(session.id);
    res.json({ ...session, speakers });
  });

  app.post("/api/admin/agenda-sessions", requireAuth, async (req, res) => {
    const { speakers, ...sessionData } = req.body;
    const parsed = insertAgendaSessionSchema.safeParse(sessionData);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    if (parsed.data.sponsorId) {
      const sponsor = await storage.getSponsor(parsed.data.sponsorId);
      if (sponsor) parsed.data.sponsorNameSnapshot = sponsor.name;
    }

    const session = await storage.createAgendaSession(parsed.data);

    if (speakers && Array.isArray(speakers)) {
      for (let i = 0; i < speakers.length; i++) {
        const sp = speakers[i];
        if (sp.name?.trim()) {
          await storage.createSessionSpeaker({
            sessionId: session.id,
            speakerOrder: i + 1,
            name: sp.name.trim(),
            title: sp.title || null,
            company: sp.company || null,
            roleLabel: sp.roleLabel || null,
          });
        }
      }
    }

    const result = await storage.getAgendaSession(session.id);
    const spk = await storage.getSessionSpeakers(session.id);
    res.status(201).json({ ...result, speakers: spk });
  });

  app.patch("/api/admin/agenda-sessions/:id", requireAuth, async (req, res) => {
    const { speakers, ...sessionData } = req.body;
    const allowed = ["eventId", "title", "description", "sessionCode", "sessionTypeKey", "sessionDate", "startTime", "endTime", "timezone", "locationName", "locationDetails", "sponsorId", "sponsorNameSnapshot", "status", "isFeatured", "isPublic"];
    const updates: any = {};
    for (const k of allowed) { if (sessionData[k] !== undefined) updates[k] = sessionData[k]; }

    if (updates.sponsorId) {
      const sponsor = await storage.getSponsor(updates.sponsorId);
      if (sponsor) updates.sponsorNameSnapshot = sponsor.name;
    }

    const session = await storage.updateAgendaSession(req.params.id, updates);
    if (!session) return res.status(404).json({ error: "Session not found" });

    if (speakers && Array.isArray(speakers)) {
      await storage.deleteSessionSpeakersBySession(session.id);
      for (let i = 0; i < speakers.length; i++) {
        const sp = speakers[i];
        if (sp.name?.trim()) {
          await storage.createSessionSpeaker({
            sessionId: session.id,
            speakerOrder: i + 1,
            name: sp.name.trim(),
            title: sp.title || null,
            company: sp.company || null,
            roleLabel: sp.roleLabel || null,
          });
        }
      }
    }

    const spk = await storage.getSessionSpeakers(session.id);
    res.json({ ...session, speakers: spk });
  });

  app.delete("/api/admin/agenda-sessions/:id", requireAuth, async (req, res) => {
    await storage.deleteAgendaSession(req.params.id);
    res.json({ success: true });
  });

  // ── Agenda: CSV Import ────────────────────────────────────────────────

  app.get("/api/admin/agenda-csv-template", requireAuth, (_req, res) => {
    const headers = [
      "EventCode", "SessionCode", "SessionTitle", "SessionDescription", "SessionType",
      "SessionDate", "StartTime", "EndTime", "Timezone", "LocationName", "LocationDetails",
      "Sponsor", "Speaker1Name", "Speaker1Title", "Speaker1Company",
      "Speaker2Name", "Speaker2Title", "Speaker2Company",
      "Speaker3Name", "Speaker3Title", "Speaker3Company",
      "Speaker4Name", "Speaker4Title", "Speaker4Company",
      "Speaker5Name", "Speaker5Title", "Speaker5Company",
      "Status", "Featured", "IsPublic",
    ];
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=agenda_template.csv");
    res.send(headers.join(",") + "\n");
  });

  app.get("/api/admin/agenda-sessions/export-csv", requireAuth, async (req, res) => {
    const eventId = req.query.eventId as string | undefined;
    const sessions = await storage.getAgendaSessions(eventId);
    const allEvents = await storage.getEvents();

    const headers = [
      "EventCode", "SessionCode", "SessionTitle", "SessionDescription", "SessionType",
      "SessionDate", "StartTime", "EndTime", "Timezone", "LocationName", "LocationDetails",
      "Sponsor", "Speaker1Name", "Speaker1Title", "Speaker1Company",
      "Speaker2Name", "Speaker2Title", "Speaker2Company",
      "Speaker3Name", "Speaker3Title", "Speaker3Company",
      "Speaker4Name", "Speaker4Title", "Speaker4Company",
      "Speaker5Name", "Speaker5Title", "Speaker5Company",
      "Status", "Featured", "IsPublic",
    ];

    const escape = (v: string | null | undefined) => {
      if (!v) return "";
      if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
      return v;
    };

    const rows = await Promise.all(sessions.map(async (s) => {
      const speakers = await storage.getSessionSpeakers(s.id);
      const event = allEvents.find(e => e.id === s.eventId);
      const cols: string[] = [
        event?.slug || "", s.sessionCode || "", escape(s.title), escape(s.description), s.sessionTypeKey,
        s.sessionDate, s.startTime, s.endTime, s.timezone, escape(s.locationName), escape(s.locationDetails),
        escape(s.sponsorNameSnapshot),
      ];
      for (let i = 0; i < 5; i++) {
        const sp = speakers.find(sp => sp.speakerOrder === i + 1);
        cols.push(escape(sp?.name), escape(sp?.title), escape(sp?.company));
      }
      cols.push(s.status, s.isFeatured ? "true" : "false", s.isPublic ? "true" : "false");
      return cols.join(",");
    }));

    const csv = headers.join(",") + "\n" + rows.join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=agenda_export${eventId ? "_" + (allEvents.find(e => e.id === eventId)?.slug || eventId) : ""}.csv`);
    res.send(csv);
  });

  app.post("/api/admin/agenda-sessions/import-csv", requireAuth, async (req, res) => {
    const { csvData, eventId } = req.body;
    if (!csvData || !eventId) return res.status(400).json({ error: "csvData and eventId are required" });

    const event = await storage.getEvent(eventId);
    if (!event) return res.status(404).json({ error: "Event not found" });

    const allEvents = await storage.getEvents();
    const allSponsors = await storage.getSponsors();
    const sessionTypesAll = await storage.getSessionTypes();

    const lines = csvData.trim().split("\n");
    if (lines.length < 2) return res.status(400).json({ error: "CSV must have header row and at least one data row" });

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
          else { inQuotes = !inQuotes; }
        } else if (ch === ',' && !inQuotes) { result.push(current.trim()); current = ""; }
        else { current += ch; }
      }
      result.push(current.trim());
      return result;
    };

    const headers = parseCSVLine(lines[0]);
    const colIndex = (name: string) => headers.findIndex(h => h.toLowerCase().replace(/[_\s]/g, "") === name.toLowerCase().replace(/[_\s]/g, ""));

    const job = await storage.createAgendaImportJob({
      eventId,
      fileName: "csv-upload",
      status: "processing",
      rowsTotal: lines.length - 1,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsFailed: 0,
      createdByUserId: (req.user as any)?.id || null,
    });

    let created = 0, updated = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;
      try {
        const cols = parseCSVLine(line);
        const get = (name: string) => { const idx = colIndex(name); return idx >= 0 ? (cols[idx] || "").trim() : ""; };

        const rowEventCode = get("EventCode") || event.slug;
        const rowEvent = allEvents.find(e => e.slug === rowEventCode);
        if (!rowEvent) { errors.push(`Row ${i}: unknown event code "${rowEventCode}"`); failed++; continue; }
        if (rowEvent.id !== eventId) { errors.push(`Row ${i}: event code "${rowEventCode}" does not match selected event`); failed++; continue; }

        const title = get("SessionTitle");
        if (!title) { errors.push(`Row ${i}: title is required`); failed++; continue; }

        const sessionTypeKey = get("SessionType") || "OTHER";
        const stMatch = sessionTypesAll.find(st => st.key.toUpperCase() === sessionTypeKey.toUpperCase() || st.label.toLowerCase() === sessionTypeKey.toLowerCase());
        const finalTypeKey = stMatch?.key || "OTHER";

        const sessionDate = get("SessionDate");
        const startTime = get("StartTime");
        const endTime = get("EndTime");
        if (!sessionDate || !startTime || !endTime) { errors.push(`Row ${i}: date, start time, and end time are required`); failed++; continue; }

        const timezone = get("Timezone") || "America/New_York";
        const locationName = get("LocationName") || null;
        const locationDetails = get("LocationDetails") || null;
        const sponsorName = get("Sponsor");
        let sponsorId: string | null = null;
        let sponsorNameSnapshot: string | null = null;
        if (sponsorName) {
          const sp = allSponsors.find(s => s.name.toLowerCase() === sponsorName.toLowerCase());
          if (sp) { sponsorId = sp.id; sponsorNameSnapshot = sp.name; }
          else { sponsorNameSnapshot = sponsorName; }
        }

        const sessionCode = get("SessionCode") || null;
        const status = get("Status") || "Draft";
        const featured = get("Featured")?.toLowerCase() === "true" || get("Featured") === "1";
        const isPublic = get("IsPublic") ? (get("IsPublic").toLowerCase() === "true" || get("IsPublic") === "1") : true;

        let existingSession = sessionCode ? await storage.getAgendaSessionByCode(eventId, sessionCode) : null;
        if (!existingSession) {
          const allSessions = await storage.getAgendaSessions(eventId);
          existingSession = allSessions.find(s => s.title === title && s.sessionDate === sessionDate && s.startTime === startTime) || null;
        }

        const sessionPayload: any = {
          eventId, title, sessionTypeKey: finalTypeKey, sessionDate, startTime, endTime, timezone,
          locationName, locationDetails, sponsorId, sponsorNameSnapshot,
          status: ["Draft", "Published", "Cancelled"].includes(status) ? status : "Draft",
          isFeatured: featured, isPublic,
          ...(sessionCode ? { sessionCode } : {}),
        };

        let sessionId: string;
        if (existingSession) {
          await storage.updateAgendaSession(existingSession.id, sessionPayload);
          await storage.deleteSessionSpeakersBySession(existingSession.id);
          sessionId = existingSession.id;
          updated++;
        } else {
          const newSession = await storage.createAgendaSession(sessionPayload);
          sessionId = newSession.id;
          created++;
        }

        for (let s = 1; s <= 5; s++) {
          const spName = get(`Speaker${s}Name`);
          if (spName) {
            await storage.createSessionSpeaker({
              sessionId,
              speakerOrder: s,
              name: spName,
              title: get(`Speaker${s}Title`) || null,
              company: get(`Speaker${s}Company`) || null,
            });
          }
        }
      } catch (err: any) {
        errors.push(`Row ${i}: ${err.message}`);
        failed++;
      }
    }

    await storage.updateAgendaImportJob(job.id, {
      status: "completed",
      rowsCreated: created,
      rowsUpdated: updated,
      rowsFailed: failed,
      errorLog: errors.length > 0 ? errors.join("\n") : null,
    });

    res.json({ created, updated, failed, errors, total: lines.length - 1, jobId: job.id });
  });

  // ── Agenda: ICS Calendar Export ────────────────────────────────────────

  app.get("/api/agenda-sessions/:id/ics", async (req, res) => {
    const session = await storage.getAgendaSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Session not found" });
    if (!session.isPublic || session.status !== "Published") return res.status(403).json({ error: "Session not available for export" });

    const event = await storage.getEvent(session.eventId);
    const formatDT = (date: string, time: string) => {
      const d = date.replace(/-/g, "");
      const t = time.replace(/:/g, "") + "00";
      return d + "T" + t;
    };

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Converge Concierge//Agenda//EN\r\nBEGIN:VEVENT\r\n";
    ics += `DTSTART;TZID=${session.timezone}:${formatDT(session.sessionDate, session.startTime)}\r\n`;
    ics += `DTEND;TZID=${session.timezone}:${formatDT(session.sessionDate, session.endTime)}\r\n`;
    ics += `SUMMARY:${session.title.replace(/\n/g, "\\n")}\r\n`;
    if (session.description) ics += `DESCRIPTION:${session.description.replace(/\n/g, "\\n").substring(0, 500)}\r\n`;
    if (session.locationName) ics += `LOCATION:${session.locationName}${session.locationDetails ? " - " + session.locationDetails : ""}\r\n`;
    ics += `UID:agenda-${session.id}@converge\r\n`;
    ics += "END:VEVENT\r\nEND:VCALENDAR\r\n";

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${event?.slug || "session"}-${session.sessionCode || session.id}.ics`);
    res.send(ics);
  });

  // ── Category Matching Rules CRUD ────────────────────────────────────────
  app.get("/api/admin/category-rules", requireAdmin, async (_req, res) => {
    const rules = await storage.getCategoryMatchingRules();
    res.json(rules);
  });

  app.post("/api/admin/category-rules", requireAdmin, async (req, res) => {
    const parsed = insertCategoryMatchingRuleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const cat = await storage.getAttendeeCategoryByKey(parsed.data.categoryKey);
    if (!cat) return res.status(400).json({ error: `Category key "${parsed.data.categoryKey}" does not exist` });
    if (!cat.isActive) return res.status(400).json({ error: `Category "${parsed.data.categoryKey}" is inactive` });
    const created = await storage.createCategoryMatchingRule(parsed.data);
    res.status(201).json(created);
  });

  app.patch("/api/admin/category-rules/:id", requireAdmin, async (req, res) => {
    const { id } = req.params;
    if (req.body.categoryKey) {
      const cat = await storage.getAttendeeCategoryByKey(req.body.categoryKey);
      if (!cat) return res.status(400).json({ error: `Category key "${req.body.categoryKey}" does not exist` });
    }
    const updated = await storage.updateCategoryMatchingRule(id, req.body);
    if (!updated) return res.status(404).json({ error: "Rule not found" });
    res.json(updated);
  });

  app.delete("/api/admin/category-rules/:id", requireAdmin, async (req, res) => {
    await storage.deleteCategoryMatchingRule(req.params.id);
    res.json({ ok: true });
  });

  // ── Test rules against a value ──────────────────────────────────────────
  app.post("/api/admin/category-rules/test", requireAdmin, async (req, res) => {
    const { value, sourceField } = req.body;
    if (!value || typeof value !== "string") return res.status(400).json({ error: "value is required" });
    const rules = await storage.getCategoryMatchingRules();
    const categories = await storage.getAttendeeCategories();
    const results = testRulesAgainstValue(value, sourceField ?? "ticket_type", rules, categories);
    res.json(results);
  });

  // ── Seed default categories (idempotent) ────────────────────────────────
  app.post("/api/admin/attendee-categories/seed-defaults", requireAdmin, async (_req, res) => {
    const defaults = [
      { key: "PRACTITIONER", label: "Practitioner", description: "Finance practitioners and industry professionals", sortOrder: 0, matchWeight: 100 },
      { key: "GOVERNMENT_NONPROFIT", label: "Government / Nonprofit", description: "Government and nonprofit organization representatives", sortOrder: 1, matchWeight: 70 },
      { key: "SOLUTION_PROVIDER", label: "Solution Provider", description: "Technology and service solution providers", sortOrder: 2, matchWeight: 20 },
    ];
    let created = 0;
    let skipped = 0;
    for (const def of defaults) {
      const existing = await storage.getAttendeeCategoryByKey(def.key);
      if (existing) { skipped++; continue; }
      await storage.createAttendeeCategory(def);
      created++;
    }
    await refreshCategoryConfig();
    res.json({ ok: true, created, skipped });
  });

  // ── Backfill using DB-driven rules ──────────────────────────────────────
  app.post("/api/admin/attendees/backfill-categories", requireAdmin, async (req, res) => {
    const adminUser = (req as any).user?.name ?? "admin";
    const forceAll = req.body?.forceAll === true;
    console.log(`[backfill] Category backfill triggered by ${adminUser}, forceAll=${forceAll}`);

    const allAttendees = await storage.getAttendees();
    const rules = await storage.getCategoryMatchingRules();
    const activeRules = rules.filter(r => r.isActive);
    const categories = await storage.getAttendeeCategories();
    const validKeys = new Set(categories.map(c => c.key));

    let updated = 0;
    let skipped = 0;
    const unmapped: string[] = [];

    for (const att of allAttendees) {
      if (!forceAll && att.attendeeCategory && validKeys.has(att.attendeeCategory)) {
        skipped++;
        continue;
      }

      const sourceData: Record<string, string> = {};
      if (att.ticketType) sourceData.ticket_type = att.ticketType;
      if (att.attendeeCategory) sourceData.attendee_category = att.attendeeCategory;
      if (att.company) sourceData.company = att.company;
      if (att.title) sourceData.title = att.title;

      let derived: string | null = null;
      if (activeRules.length > 0) {
        const result = evaluateRules(sourceData, activeRules, categories);
        derived = result.categoryKey;
      }
      if (!derived) {
        derived = normalizeAttendeeCategory(att.ticketType ?? "");
      }

      if (derived) {
        await storage.updateAttendee(att.id, { attendeeCategory: derived });
        updated++;
        console.log(`[backfill] ${att.id} → ${derived}`);
      } else {
        if (att.ticketType) unmapped.push(att.ticketType);
        skipped++;
      }
    }

    res.json({ ok: true, updated, skipped, unmapped: [...new Set(unmapped)] });
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
      const csvTicketType = row.ticketType || row.ticket_type || null;
      const csvCategory = row.attendeeCategory || row.attendee_category || row.category || null;
      const csvCategoryFields: Record<string, string> = {};
      if (csvTicketType) csvCategoryFields.ticketType = String(csvTicketType);
      if (csvCategory) {
        const upper = String(csvCategory).toUpperCase().replace(/[\s/]+/g, "_").replace(/-/g, "_");
        csvCategoryFields.attendeeCategory = upper;
      }
      if (!csvCategoryFields.attendeeCategory) {
        const derived = await deriveAttendeeCategory({
          ticket_type: csvTicketType ? String(csvTicketType) : undefined,
          attendee_category: csvCategory ? String(csvCategory) : undefined,
          company: row.company ? String(row.company) : undefined,
          title: row.title ? String(row.title) : undefined,
        });
        if (derived) csvCategoryFields.attendeeCategory = derived;
      }

      if (existing) {
        try {
          await storage.updateAttendee(existing.id, {
            firstName: row.firstName ?? existing.firstName,
            lastName: row.lastName ?? existing.lastName,
            company: row.company ?? existing.company,
            title: row.title ?? existing.title,
            phone: row.phone ?? existing.phone,
            linkedinUrl: row.linkedinUrl ?? existing.linkedinUrl,
            externalSource: row.source ? String(row.source) : (existing.externalSource ?? "csv"),
            externalRegistrationId: row.externalRegistrationId ? String(row.externalRegistrationId) : existing.externalRegistrationId,
            ...csvCategoryFields,
          });
          updatedCount++;
        } catch (rowErr: any) {
          rejected.push({ row: rowNum, identifier: email, reason: `Update error: ${rowErr.message}` });
        }
        continue;
      }

      const archived = await storage.getArchivedAttendeeByEmailAndEvent(email, event.id);
      if (archived) {
        try {
          await storage.updateAttendee(archived.id, {
            firstName: row.firstName ?? archived.firstName,
            lastName: row.lastName ?? archived.lastName,
            company: row.company ?? archived.company,
            title: row.title ?? archived.title,
            phone: row.phone ?? archived.phone,
            linkedinUrl: row.linkedinUrl ?? archived.linkedinUrl,
            archiveState: "active",
            archiveSource: null,
            externalSource: row.source ? String(row.source) : (archived.externalSource ?? "csv"),
            ...csvCategoryFields,
          });
          updatedCount++;
        } catch (rowErr: any) {
          rejected.push({ row: rowNum, identifier: email, reason: `Update error: ${rowErr.message}` });
        }
        continue;
      }

      const interestsArr = row.interests
        ? String(row.interests).split(";").map((s: string) => s.trim()).filter(Boolean)
        : undefined;

      try {
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
          linkedinUrl: row.linkedinUrl ? String(row.linkedinUrl) : undefined,
          interests: interestsArr,
          notes: row.notes ? String(row.notes) : undefined,
          ...csvCategoryFields,
        });
        importedCount++;
      } catch (rowErr: any) {
        rejected.push({ row: rowNum, identifier: email, reason: `Create error: ${rowErr.message}` });
      }
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
        const jobId = await createMessageJobForSend(storage, {
          jobName: `Info Request – ${sponsor.name}`,
          messageType: "SYSTEM", sourceType: "event_action",
          eventId: parsed.data.eventId || null, sponsorId: sponsor.id,
          triggerType: "EVENT_ACTION", triggerName: "Information request submitted",
          recipientCount: 2,
        });
        const sponsorTokens = await storage.getSponsorTokensBySponsor(sponsor.id).catch(() => []);
        const activeToken = sponsorTokens.find((t: any) => t.isActive && t.eventId === parsed.data.eventId);
        let sentCount = 0; let failedCount = 0;
        try {
          await sendInformationRequestNotificationToSponsor(storage, null, sponsor, record, irEvent, activeToken?.token ?? null);
          sentCount++;
        } catch { failedCount++; }
        try {
          await sendInformationRequestConfirmationToAttendee(storage, record, sponsor, irEvent);
          sentCount++;
        } catch { failedCount++; }
        await completeMessageJob(storage, jobId, sentCount, failedCount);
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

  // Admin: edit information request (full update)
  app.patch("/api/admin/information-requests/:id", requireAdmin, async (req, res) => {
    try {
      const allowedFields = ["attendeeFirstName", "attendeeLastName", "attendeeEmail", "attendeeCompany", "attendeeTitle", "message", "status", "notes"];
      const updates: Record<string, any> = {};
      for (const key of allowedFields) {
        if (key in req.body) updates[key] = req.body[key];
      }
      if (updates.status && !(INFORMATION_REQUEST_STATUSES as readonly string[]).includes(updates.status)) {
        return res.status(400).json({ error: "Invalid status" });
      }
      const updated = await storage.updateInformationRequest(req.params.id, updates);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Admin: delete information request
  app.delete("/api/admin/information-requests/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteInformationRequest(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Scheduled Emails ──────────────────────────────────────────────────────
  app.get("/api/admin/scheduled-emails", requireAuth, async (_req, res) => {
    try {
      const emails = await storage.listScheduledEmails();
      res.json(emails);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/scheduled-emails", requireAdmin, async (req, res) => {
    try {
      const parsed = insertScheduledEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ error: "Invalid data", details: parsed.error.flatten().fieldErrors });
      }

      if (parsed.data.emailType === "sponsor_report" && parsed.data.sponsorId) {
        const sponsor = await storage.getSponsor(parsed.data.sponsorId);
        if (sponsor) {
          const users = await storage.getSponsorUsersBySponsor(parsed.data.sponsorId);
          const allowedEmails = new Set<string>();
          users.filter(u => u.isActive && u.email).forEach(u => allowedEmails.add(u.email.toLowerCase()));
          if (sponsor.contactEmail) allowedEmails.add(sponsor.contactEmail.toLowerCase());
          if (!allowedEmails.has(parsed.data.recipientEmail.toLowerCase())) {
            return res.status(400).json({ error: "Recipient is not a registered team member for this sponsor. Only sponsor contacts, owners, and team members can receive reports." });
          }
        }
      }

      const email = await storage.createScheduledEmail(parsed.data);
      res.status(201).json(email);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.patch("/api/admin/scheduled-emails/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getScheduledEmail(req.params.id);
      if (!existing) return res.status(404).json({ error: "Not found" });

      const mergedType = req.body.emailType ?? existing.emailType;
      const mergedSponsorId = req.body.sponsorId !== undefined ? req.body.sponsorId : existing.sponsorId;
      const mergedRecipient = req.body.recipientEmail ?? existing.recipientEmail;

      if (mergedType === "sponsor_report" && mergedSponsorId) {
        const sponsor = await storage.getSponsor(mergedSponsorId);
        if (sponsor) {
          const users = await storage.getSponsorUsersBySponsor(mergedSponsorId);
          const allowedEmails = new Set<string>();
          users.filter(u => u.isActive && u.email).forEach(u => allowedEmails.add(u.email.toLowerCase()));
          if (sponsor.contactEmail) allowedEmails.add(sponsor.contactEmail.toLowerCase());
          if (!allowedEmails.has(mergedRecipient.toLowerCase())) {
            return res.status(400).json({ error: "Recipient is not a registered team member for this sponsor. Only sponsor contacts, owners, and team members can receive reports." });
          }
        }
      }

      const updated = await storage.updateScheduledEmail(req.params.id, req.body);
      if (!updated) return res.status(404).json({ error: "Not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.delete("/api/admin/scheduled-emails/:id", requireAdmin, async (req, res) => {
    try {
      const deleted = await storage.deleteScheduledEmail(req.params.id);
      if (!deleted) return res.status(404).json({ error: "Not found" });
      res.json({ success: true });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Sponsor Health ──────────────────────────────────────────────────────────
  app.get("/api/admin/sponsor-health", requireAuth, async (_req, res) => {
    try {
      const allSponsors = await storage.getSponsors();
      const allEvents = await storage.getEvents();
      const allMeetings = await storage.getMeetings();
      const allInfoRequests = await storage.listInformationRequests();

      const healthData = allSponsors
        .filter(s => (s.archiveState ?? "active") === "active")
        .map(sponsor => {
          const sponsorEvents = (sponsor.assignedEvents ?? []).filter((ae: any) => (ae.archiveState ?? "active") === "active").map((ae: any) => ae.eventId);
          const sponsorMeetings = allMeetings.filter(m => m.sponsorId === sponsor.id);
          const sponsorInfoReqs = allInfoRequests.filter(ir => ir.sponsorId === sponsor.id);
          const completedMeetings = sponsorMeetings.filter(m => m.status === "Completed");
          const totalMeetings = sponsorMeetings.length;
          const totalInfoRequests = sponsorInfoReqs.length;
          const hasLogo = !!sponsor.logoUrl;
          const hasDescription = !!sponsor.shortDescription;
          const hasProfile = hasLogo && hasDescription;

          let riskLevel: "healthy" | "attention" | "at_risk" = "healthy";
          const issues: string[] = [];
          if (totalMeetings === 0) { issues.push("No meetings scheduled"); riskLevel = "attention"; }
          if (totalInfoRequests === 0) { issues.push("No info requests"); }
          if (!hasProfile) { issues.push("Missing profile info"); riskLevel = "attention"; }
          if (sponsorEvents.length === 0) { issues.push("No events assigned"); riskLevel = "at_risk"; }
          if (issues.length >= 3) riskLevel = "at_risk";

          return {
            sponsorId: sponsor.id,
            sponsorName: sponsor.name,
            level: sponsor.level,
            assignedEvents: sponsorEvents.length,
            totalMeetings,
            completedMeetings: completedMeetings.length,
            totalInfoRequests,
            hasLogo,
            hasDescription,
            riskLevel,
            issues,
          };
        });

      const summary = {
        total: healthData.length,
        healthy: healthData.filter(h => h.riskLevel === "healthy").length,
        attention: healthData.filter(h => h.riskLevel === "attention").length,
        atRisk: healthData.filter(h => h.riskLevel === "at_risk").length,
      };

      res.json({ sponsors: healthData, summary });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
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

  async function fireInternalNotification(sponsorId: string, deliverableName: string, action: string, eventId?: string) {
    try {
      const sponsor = await storage.getSponsor(sponsorId);
      const sponsorName = sponsor?.name ?? "Unknown Sponsor";
      let eventName = "";
      if (eventId) {
        const event = await storage.getEvent(eventId);
        eventName = event?.name ?? "";
      }
      await sendInternalNotification(storage, { sponsorId, sponsorName, eventId, eventName, deliverableName, action });
    } catch (err) {
      console.error("Failed to send internal notification:", err);
    }
  }

  // GET /api/sponsor-dashboard/event-topics — returns event interest topics (new model) with fallback to sponsor attributes
  app.get("/api/sponsor-dashboard/event-topics", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const allEventTopics = await storage.getEventInterestTopics(tokenRecord.eventId);
    const interestTopics = allEventTopics.filter(t => t.status === "APPROVED" && t.isActive);
    const pendingSuggestions = allEventTopics.filter(t =>
      t.topicSource === "SPONSOR_SUGGESTED" &&
      t.status === "PENDING" &&
      t.suggestedBySponsorId === tokenRecord.sponsorId
    );

    if (interestTopics.length > 0) {
      return res.json({ topics: interestTopics.map(t => t.topicLabel), interestTopics, pendingSuggestions, eventId: tokenRecord.eventId, sponsorId: tokenRecord.sponsorId });
    }

    const allSponsors = await storage.getSponsors();
    const eventSponsors = allSponsors.filter(s =>
      s.assignedEvents?.some(e => e.eventId === tokenRecord.eventId)
    );
    const topicSet = new Set<string>();
    for (const s of eventSponsors) {
      if (s.attributes && Array.isArray(s.attributes)) {
        for (const a of s.attributes) {
          if (typeof a === "string" && a.trim()) topicSet.add(a.trim());
        }
      }
    }
    res.json({ topics: Array.from(topicSet).sort(), interestTopics: [], pendingSuggestions, eventId: tokenRecord.eventId, sponsorId: tokenRecord.sponsorId });
  });

  // GET /api/admin/sponsors/:sponsorId/topic-selections — admin view of sponsor's topic selections per event
  app.get("/api/admin/sponsors/:sponsorId/topic-selections", requireAuth, async (req, res) => {
    try {
      const { sponsorId } = req.params;
      const allSponsors = await storage.getSponsors();
      const sponsor = allSponsors.find(s => s.id === sponsorId);
      if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

      const eventIds = (sponsor.assignedEvents ?? []).map(ae => ae.eventId);
      const results = await Promise.all(eventIds.map(async (eventId) => {
        const [selections, allTopics] = await Promise.all([
          storage.getSponsorTopics(sponsorId, eventId),
          storage.getEventInterestTopics(eventId),
        ]);
        const selectedTopicIds = new Set(selections.map(s => s.topicId));
        const selectedTopics = allTopics.filter(t => selectedTopicIds.has(t.id));
        const pendingSuggestions = allTopics.filter(t =>
          t.topicSource === "SPONSOR_SUGGESTED" &&
          t.status === "PENDING" &&
          t.suggestedBySponsorId === sponsorId
        );
        return { eventId, selectedTopics, pendingSuggestions };
      }));
      res.json(results);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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

    const NOTIFY_DELIVERABLE_NAMES = ["company description", "company logo", "sponsor representatives", "three-word company categories"];
    const nameLC = deliverable.deliverableName.toLowerCase();
    if (allowed.status === "Submitted" || NOTIFY_DELIVERABLE_NAMES.some(n => nameLC.includes(n))) {
      const action = allowed.status === "Submitted" ? "submitted their response" : "updated their input";
      fireInternalNotification(deliverable.sponsorId, deliverable.deliverableName, action, deliverable.eventId).catch(() => {});
    }

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

    const { name, firstName, lastName, title, email, conciergeRole, registrationStatus } = req.body;
    if (!firstName?.trim() && !name?.trim()) return res.status(400).json({ error: "firstName is required" });

    const derivedName = name?.trim() || `${(firstName ?? "").trim()} ${(lastName ?? "").trim()}`.trim();
    const registrant = await storage.createDeliverableRegistrant({
      agreementDeliverableId: req.params.id,
      name: derivedName,
      title: title?.trim() ?? null,
      email: email?.trim() ?? null,
      firstName: firstName?.trim() ?? null,
      lastName: lastName?.trim() ?? null,
      conciergeRole: conciergeRole?.trim() ?? null,
      registrationStatus: registrationStatus ?? "pending",
    });

    // Auto-update status if all quantity filled
    const all = await storage.listDeliverableRegistrants(req.params.id);
    if (deliverable.quantity && all.length >= deliverable.quantity) {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Submitted" });
      fireInternalNotification(deliverable.sponsorId, deliverable.deliverableName, "submitted all registrants", deliverable.eventId).catch(() => {});
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

    const { name, firstName, lastName, title, email, conciergeRole, registrationStatus } = req.body;
    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name?.trim();
    if (firstName !== undefined) updates.firstName = firstName?.trim() ?? null;
    if (lastName !== undefined) updates.lastName = lastName?.trim() ?? null;
    if (title !== undefined) updates.title = title?.trim() ?? null;
    if (email !== undefined) updates.email = email?.trim() ?? null;
    if (conciergeRole !== undefined) updates.conciergeRole = conciergeRole?.trim() ?? null;
    if (registrationStatus !== undefined) updates.registrationStatus = registrationStatus;
    const updated = await storage.updateDeliverableRegistrant(req.params.rid, updates);
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

    const { speakerName, speakerTitle, speakerBio, sessionType, sessionTitle } = req.body;
    if (!speakerName?.trim()) return res.status(400).json({ error: "speakerName is required" });

    const speaker = await storage.createDeliverableSpeaker({
      agreementDeliverableId: req.params.id,
      speakerName: speakerName.trim(),
      speakerTitle: speakerTitle?.trim() ?? null,
      speakerBio: speakerBio?.trim() ?? null,
      sessionType: sessionType?.trim() ?? null,
      sessionTitle: sessionTitle?.trim() ?? null,
    });

    if (deliverable.status === "Not Started" || deliverable.status === "Awaiting Sponsor Input") {
      await storage.updateAgreementDeliverable(req.params.id, { status: "Submitted" });
      fireInternalNotification(deliverable.sponsorId, deliverable.deliverableName, "submitted speaker information", deliverable.eventId).catch(() => {});
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

    const { speakerName, speakerTitle, speakerBio, sessionType, sessionTitle } = req.body;
    const updates: Record<string, unknown> = {};
    if (speakerName !== undefined) updates.speakerName = speakerName?.trim();
    if (speakerTitle !== undefined) updates.speakerTitle = speakerTitle?.trim() ?? null;
    if (speakerBio !== undefined) updates.speakerBio = speakerBio?.trim() ?? null;
    if (sessionType !== undefined) updates.sessionType = sessionType?.trim() ?? null;
    if (sessionTitle !== undefined) updates.sessionTitle = sessionTitle?.trim() ?? null;
    const updated = await storage.updateDeliverableSpeaker(req.params.sid, updates);
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

  // GET /api/sponsor-dashboard/agreement-deliverables/:id/social-entries — sponsor reads social entries
  app.get("/api/sponsor-dashboard/agreement-deliverables/:id/social-entries", async (req, res) => {
    const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
    if (!token) return res.status(401).json({ message: "No token provided" });
    const validation = await validateSponsorToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const deliverable = await storage.getAgreementDeliverable(req.params.id);
    if (!deliverable || deliverable.sponsorId !== tokenRecord.sponsorId || deliverable.eventId !== tokenRecord.eventId) {
      return res.status(404).json({ error: "Not found" });
    }
    if (!deliverable.sponsorVisible) return res.status(404).json({ error: "Not found" });

    const entries = await storage.listDeliverableSocialEntries(req.params.id);
    res.json(entries);
  });

  // GET /api/admin/attendee-csv — export registrants as CSV for a given eventId
  app.get("/api/admin/attendee-csv", requireAuth, async (req, res) => {
    try {
      const { eventId } = req.query as Record<string, string | undefined>;
      if (!eventId) return res.status(400).json({ message: "eventId required" });

      const deliverables = await storage.listAgreementDeliverables({ eventId });
      const registrationDeliverables = deliverables.filter(d =>
        d.fulfillmentType === "quantity_progress" || d.deliverableName.toLowerCase().includes("registration")
      );

      const allSponsors = await storage.getSponsors();
      const sponsorMap = new Map(allSponsors.map(s => [s.id, s.name]));

      function csvSafe(val: string): string {
        let s = val;
        if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
        return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
      }

      const rows: Array<Record<string, string>> = [];
      for (const d of registrationDeliverables) {
        const registrants = await storage.listDeliverableRegistrants(d.id);
        for (const r of registrants) {
          rows.push({
            sponsorName: sponsorMap.get(d.sponsorId) ?? d.sponsorId,
            sponsorshipLevel: d.sponsorshipLevel,
            deliverableName: d.deliverableName,
            name: r.name ?? "",
            firstName: r.firstName ?? "",
            lastName: r.lastName ?? "",
            email: r.email ?? "",
            title: r.title ?? "",
            conciergeRole: r.conciergeRole ?? "",
            registrationStatus: r.registrationStatus ?? "pending",
          });
        }
      }

      const headers = ["sponsorName","sponsorshipLevel","deliverableName","name","firstName","lastName","email","title","conciergeRole","registrationStatus"];
      const csvLines = [headers.join(",")];
      for (const row of rows) {
        csvLines.push(headers.map(h => csvSafe(row[h] ?? "")).join(","));
      }

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="attendees-${eventId}.csv"`);
      res.send(csvLines.join("\n"));
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // GET /api/agreement/deliverables/:id/attendee-csv — export registrants for a single deliverable as CSV
  app.get("/api/agreement/deliverables/:id/attendee-csv", requireAuth, async (req, res) => {
    try {
      const deliverable = await storage.getAgreementDeliverable(req.params.id);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });

      const type = (req.query.type as string) === "partial" ? "partial" : "full";
      const csv = await storage.generateAttendeeContactListCsv(req.params.id, type);

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="attendees-${req.params.id}.csv"`);
      res.send(csv);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
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
    const { emailType, status, eventId, sponsorId, source, search, from, to } = req.query as Record<string, string | undefined>;
    const filters: { emailType?: string; status?: string; eventId?: string; sponsorId?: string; source?: string; search?: string; from?: Date; to?: Date } = {};
    if (emailType) filters.emailType = emailType;
    if (status) filters.status = status;
    if (eventId) filters.eventId = eventId;
    if (sponsorId) filters.sponsorId = sponsorId;
    if (source) filters.source = source;
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
      source: "Manual",
      templateId: log.templateId,
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
    const logId = await storage.createEmailLog({ emailType: emailType ?? "test_email", recipientEmail: to, subject, htmlContent: html, status: sendStatus, errorMessage, source: "Manual" });
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

  async function renderCodeTemplate(templateKey: string): Promise<string | null> {
    const t = await import("../services/emailTemplates.js");
    const sampleData = {
      attendeeFirstName: "Dan", attendeeName: "Dan Carmody", attendeeLastName: "Carmody",
      attendeeCompany: "Apex Financial Group", attendeeTitle: "VP of Innovation",
      attendeeEmail: "dan.carmody@example.com", sponsorName: "eGain",
      eventName: "The 2026 Fintech Risk & Compliance Forum", eventSlug: "FRC2026",
      date: "October 5, 2026", time: "10:00 AM", location: "Booth A", meetingType: "Onsite",
      sponsorToken: "sample-token-abc123",
      message: "I'd love to learn more about your AI knowledge hub and how it integrates with existing contact center platforms.",
      userName: "Admin User", resetUrl: "https://concierge.convergeevents.com/admin/reset-password?token=sample123",
      contactName: "Jane Smith", loginUrl: "https://concierge.convergeevents.com/sponsor/auth/magic?token=sample123",
      recipientFirstName: "Dan", meetingDate: "October 5, 2026", meetingTime: "10:00 AM",
      meetingLocation: "Booth A", windowLabel: "24 hours",
      recipientName: "Jane Smith", deliverables: [
        { name: "Company Logo", status: "Pending", dueDate: "September 20, 2026" },
        { name: "Sponsor Representatives", status: "Not Started", dueDate: "September 25, 2026" },
      ],
      dashboardUrl: "https://concierge.convergeevents.com/sponsor/dashboard",
    };
    const map: Record<string, () => string> = {
      meeting_confirmation_attendee: () => t.meetingConfirmationForAttendee(sampleData),
      meeting_notification_sponsor: () => t.meetingNotificationForSponsor(sampleData),
      meeting_reminder_24: () => t.meetingReminderEmail({ ...sampleData, windowLabel: "24 hours" }),
      meeting_reminder_2: () => t.meetingReminderEmail({ ...sampleData, windowLabel: "2 hours" }),
      info_request_notification_sponsor: () => t.infoRequestNotificationForSponsor(sampleData),
      info_request_confirmation_attendee: () => t.infoRequestConfirmationForAttendee(sampleData),
      password_reset: () => t.passwordResetEmail(sampleData),
      sponsor_magic_login: () => t.sponsorMagicLoginEmail(sampleData),
      deliverable_reminder: () => t.deliverableReminderEmail(sampleData),
    };
    const fn = map[templateKey];
    return fn ? fn() : null;
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
    const { displayName, category, subjectTemplate, htmlTemplate, textTemplate, description, isActive } = req.body;
    const validCategories = ["System", "Operational", "Campaign"];
    if (category !== undefined && !validCategories.includes(category)) {
      return res.status(400).json({ message: `Invalid category. Must be one of: ${validCategories.join(", ")}` });
    }
    const updatedBy = (req as any).user?.name || (req as any).user?.email || (req.session as any)?.userId || undefined;
    const updated = await storage.updateEmailTemplate(req.params.id, {
      ...(displayName !== undefined && { displayName }),
      ...(category !== undefined && { category }),
      ...(subjectTemplate !== undefined && { subjectTemplate }),
      ...(htmlTemplate !== undefined && { htmlTemplate }),
      ...(textTemplate !== undefined && { textTemplate: textTemplate ?? null }),
      ...(description !== undefined && { description: description ?? null }),
      ...(isActive !== undefined && { isActive }),
    }, updatedBy);
    res.json(updated);
  });

  app.get("/api/admin/email-templates/:id/versions", requireAuth, async (req, res) => {
    const versions = await storage.getEmailTemplateVersions(req.params.id);
    res.json(versions);
  });

  app.post("/api/admin/email-templates/:id/restore/:versionId", requireAdmin, async (req, res) => {
    const restoredBy = (req as any).user?.name || (req as any).user?.email || (req.session as any)?.userId || undefined;
    try {
      const updated = await storage.restoreEmailTemplateVersion(req.params.id, req.params.versionId, restoredBy);
      res.json(updated);
    } catch (err: any) {
      res.status(404).json({ message: err?.message ?? "Restore failed" });
    }
  });

  app.post("/api/admin/email-templates/:id/preview", requireAuth, async (req, res) => {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    const subjectOverride: string | undefined = req.body?.subjectTemplate;
    const htmlOverride: string | undefined = req.body?.htmlTemplate;
    const subject = substituteTemplateVars(subjectOverride ?? template.subjectTemplate, SAMPLE_TEMPLATE_DATA);
    const rawHtml = (htmlOverride ?? template.htmlTemplate) || "";
    let html: string;
    let source: "code" | "custom";
    if (!rawHtml.trim()) {
      const codeHtml = await renderCodeTemplate(template.templateKey);
      html = codeHtml ?? `<div style="padding:32px;font-family:sans-serif;color:#374151;"><h2 style="margin:0 0 8px;">${template.displayName}</h2><p style="color:#6b7280;">No code-rendered template available for this template key.</p></div>`;
      source = "code";
    } else {
      html = substituteTemplateVars(rawHtml, SAMPLE_TEMPLATE_DATA);
      source = "custom";
    }
    res.json({ subject, html, source });
  });

  app.post("/api/admin/email-templates/:id/send-test", requireAdmin, async (req, res) => {
    const template = await storage.getEmailTemplateById(req.params.id);
    if (!template) return res.status(404).json({ message: "Template not found" });
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: "Recipient email required" });

    const subject = substituteTemplateVars(template.subjectTemplate, SAMPLE_TEMPLATE_DATA);
    let html = template.htmlTemplate || "";
    if (!html.trim()) {
      const codeHtml = await renderCodeTemplate(template.templateKey);
      html = codeHtml ?? `<div style="padding:32px;font-family:sans-serif;color:#374151;"><h2>${template.displayName} — Test Email</h2><p>No code-rendered template available for key: ${template.templateKey}</p></div>`;
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
    const logId = await storage.createEmailLog({ emailType: `template_test_${template.templateKey}`, recipientEmail: email.trim(), subject: `[Test] ${subject}`, htmlContent: html, status: sendStatus, errorMessage, source: "Manual" });
    res.json({ ok: sendStatus === "sent", status: sendStatus, errorMessage, logId });
  });

  // ── Automation Rules API ─────────────────────────────────────────────────

  app.get("/api/admin/automations", requireAuth, async (_req, res) => {
    const rules = await storage.getAutomationRules();
    res.json(rules);
  });

  app.patch("/api/admin/automations/:id", requireAdmin, async (req, res) => {
    const { isEnabled } = req.body;
    if (typeof isEnabled !== "boolean") return res.status(400).json({ message: "isEnabled must be a boolean" });
    const updated = await storage.updateAutomationRule(req.params.id, { isEnabled });
    res.json(updated);
  });

  app.post("/api/admin/automations/pause-all", requireAdmin, async (_req, res) => {
    await storage.setAllAutomationsEnabled(false);
    res.json({ ok: true, message: "All automations paused" });
  });

  app.post("/api/admin/automations/resume-all", requireAdmin, async (_req, res) => {
    await storage.setAllAutomationsEnabled(true);
    res.json({ ok: true, message: "All automations resumed" });
  });

  app.get("/api/admin/automations/:id/logs", requireAuth, async (req, res) => {
    const logs = await storage.getAutomationLogs(req.params.id, 20);
    res.json(logs);
  });

  // ── Campaign Routes ─────────────────────────────────────────────────────

  app.get("/api/admin/campaigns", requireAuth, async (req, res) => {
    const filters: { eventId?: string; status?: string; audienceType?: string } = {};
    if (typeof req.query.eventId === "string") filters.eventId = req.query.eventId;
    if (typeof req.query.status === "string") filters.status = req.query.status;
    if (typeof req.query.audienceType === "string") filters.audienceType = req.query.audienceType;
    const list = await storage.listCampaigns(filters);
    res.json(list);
  });

  app.get("/api/admin/campaigns/:id", requireAuth, async (req, res) => {
    const c = await storage.getCampaign(req.params.id);
    if (!c) return res.status(404).json({ message: "Campaign not found" });
    res.json(c);
  });

  app.post("/api/admin/campaigns", requireAdmin, async (req, res) => {
    try {
      const { name, eventId, audienceType, audienceFilters, templateId, status, scheduledAt } = req.body;
      if (!name || typeof name !== "string") return res.status(400).json({ message: "Campaign name is required" });
      const validStatuses = ["Draft", "Scheduled"];
      const validAudience = ["Attendees", "Sponsors"];
      const safeStatus = validStatuses.includes(status) ? status : "Draft";
      const safeAudience = validAudience.includes(audienceType) ? audienceType : "Attendees";
      const c = await storage.createCampaign({
        name,
        eventId: eventId || null,
        audienceType: safeAudience,
        audienceFilters: audienceFilters || {},
        templateId: templateId || null,
        status: safeStatus,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        audienceSize: 0,
        createdBy: (req as any).user?.id ?? null,
      });
      res.status(201).json(c);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to create campaign" });
    }
  });

  app.patch("/api/admin/campaigns/:id", requireAdmin, async (req, res) => {
    try {
      const existing = await storage.getCampaign(req.params.id);
      if (!existing) return res.status(404).json({ message: "Campaign not found" });
      if (existing.status === "Sent" || existing.status === "Sending") {
        return res.status(400).json({ message: "Cannot edit a campaign that has already been sent" });
      }
      const updates: any = {};
      const allowedFields = ["name", "eventId", "audienceType", "audienceFilters", "templateId", "status", "scheduledAt", "audienceSize"];
      for (const f of allowedFields) {
        if (req.body[f] !== undefined) updates[f] = req.body[f];
      }
      if (updates.scheduledAt) updates.scheduledAt = new Date(updates.scheduledAt);
      const c = await storage.updateCampaign(req.params.id, updates);
      res.json(c);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to update campaign" });
    }
  });

  app.delete("/api/admin/campaigns/:id", requireAdmin, async (req, res) => {
    const existing = await storage.getCampaign(req.params.id);
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    if (existing.status === "Sent" || existing.status === "Sending") {
      return res.status(400).json({ message: "Cannot delete a sent campaign" });
    }
    await storage.deleteCampaign(req.params.id);
    res.sendStatus(204);
  });

  app.post("/api/admin/campaigns/:id/cancel", requireAdmin, async (req, res) => {
    const existing = await storage.getCampaign(req.params.id);
    if (!existing) return res.status(404).json({ message: "Campaign not found" });
    if (existing.status === "Sent" || existing.status === "Sending") {
      return res.status(400).json({ message: "Cannot cancel a campaign that has already been sent" });
    }
    const c = await storage.updateCampaign(req.params.id, { status: "Cancelled" });
    res.json(c);
  });

  app.post("/api/admin/campaigns/:id/preview-audience", requireAuth, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      const audienceType = campaign.audienceType || "Attendees";
      const filters = (campaign.audienceFilters || {}) as Record<string, any>;
      const eventId = campaign.eventId || undefined;

      if (audienceType === "Attendees") {
        let list = await storage.getAttendees();
        if (filters.category) list = list.filter((a: any) => a.attendeeCategory === filters.category);
        if (filters.company) list = list.filter((a: any) => a.company?.toLowerCase().includes(filters.company.toLowerCase()));
        if (filters.hasEmail !== undefined) {
          list = filters.hasEmail ? list.filter((a: any) => !!a.email) : list;
        } else {
          list = list.filter((a: any) => !!a.email);
        }
        if (filters.meetingsScheduled === "0" || filters.meetingsScheduled === "1+") {
          const allMeetings = await storage.getMeetings();
          const relevantMeetings = eventId ? allMeetings.filter((m: any) => m.eventId === eventId) : allMeetings;
          const attendeesWithMeetings = new Set(relevantMeetings.map((m: any) => m.attendeeId));
          if (filters.meetingsScheduled === "0") {
            list = list.filter((a: any) => !attendeesWithMeetings.has(a.id));
          } else {
            list = list.filter((a: any) => attendeesWithMeetings.has(a.id));
          }
        }
        if (filters.infoRequests === "0" || filters.infoRequests === "1+") {
          const allRequests = await storage.listInformationRequests();
          const withRequests = new Set(allRequests.filter((ir: any) => !eventId || ir.eventId === eventId).map((ir: any) => ir.attendeeId));
          if (filters.infoRequests === "0") {
            list = list.filter((a: any) => !withRequests.has(a.id));
          } else {
            list = list.filter((a: any) => withRequests.has(a.id));
          }
        }
        if (filters.profileComplete === "true") {
          list = list.filter((a: any) => a.firstName && a.lastName && a.company && a.title && a.email);
        } else if (filters.profileComplete === "false") {
          list = list.filter((a: any) => !a.firstName || !a.lastName || !a.company || !a.title);
        }
        list = list.filter((a: any) => a.archiveState !== "archived");
        const preview = list.slice(0, 20).map((a: any) => ({ id: a.id, name: a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim(), email: a.email, company: a.company }));
        res.json({ count: list.length, preview });
      } else {
        let list = await storage.getSponsors();
        if (eventId) {
          list = list.filter((s: any) => {
            const ae = s.assignedEvents;
            if (!Array.isArray(ae)) return false;
            return ae.some((e: any) => e.eventId === eventId);
          });
        }
        if (filters.level) {
          list = list.filter((s: any) => {
            const ae = s.assignedEvents;
            if (!Array.isArray(ae)) return false;
            return ae.some((e: any) => (!eventId || e.eventId === eventId) && e.sponsorshipLevel === filters.level);
          });
        }
        list = list.filter((s: any) => s.archiveState !== "archived" && !!s.contactEmail);
        const preview = list.slice(0, 20).map((s: any) => ({ id: s.id, name: s.name, email: s.contactEmail, company: s.name }));
        res.json({ count: list.length, preview });
      }
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to preview audience" });
    }
  });

  app.post("/api/admin/campaigns/:id/send", requireAdmin, async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "Sent" || campaign.status === "Sending") {
        return res.status(400).json({ message: "Campaign has already been sent" });
      }
      if (campaign.status === "Cancelled") {
        return res.status(400).json({ message: "Cancelled campaigns cannot be sent" });
      }
      if (!campaign.templateId) {
        return res.status(400).json({ message: "Campaign must have a template selected" });
      }
      const template = await storage.getEmailTemplateByKey(campaign.templateId)
        || (await storage.getEmailTemplateById?.(campaign.templateId));
      if (!template) return res.status(400).json({ message: "Template not found" });

      await storage.updateCampaign(campaign.id, { status: "Sending" });

      const audienceType = campaign.audienceType || "Attendees";
      const filters = (campaign.audienceFilters || {}) as Record<string, any>;
      const eventId = campaign.eventId || undefined;

      let recipients: Array<{ id: string; email: string; name: string; firstName?: string; company?: string; eventId?: string }> = [];

      if (audienceType === "Attendees") {
        let list = await storage.getAttendees();
        if (filters.category) list = list.filter((a: any) => a.attendeeCategory === filters.category);
        if (filters.company) list = list.filter((a: any) => a.company?.toLowerCase().includes(filters.company.toLowerCase()));
        list = list.filter((a: any) => !!a.email && a.archiveState !== "archived");
        if (filters.meetingsScheduled === "0" || filters.meetingsScheduled === "1+") {
          const allMeetings = await storage.getMeetings();
          const relevantMeetings = eventId ? allMeetings.filter((m: any) => m.eventId === eventId) : allMeetings;
          const withMeetings = new Set(relevantMeetings.map((m: any) => m.attendeeId));
          if (filters.meetingsScheduled === "0") {
            list = list.filter((a: any) => !withMeetings.has(a.id));
          } else {
            list = list.filter((a: any) => withMeetings.has(a.id));
          }
        }
        if (filters.infoRequests === "0" || filters.infoRequests === "1+") {
          const allRequests = await storage.listInformationRequests();
          const withReqs = new Set(allRequests.filter((ir: any) => !eventId || ir.eventId === eventId).map((ir: any) => ir.attendeeId));
          if (filters.infoRequests === "0") {
            list = list.filter((a: any) => !withReqs.has(a.id));
          } else {
            list = list.filter((a: any) => withReqs.has(a.id));
          }
        }
        if (filters.profileComplete === "true") {
          list = list.filter((a: any) => a.firstName && a.lastName && a.company && a.title && a.email);
        } else if (filters.profileComplete === "false") {
          list = list.filter((a: any) => !a.firstName || !a.lastName || !a.company || !a.title);
        }
        recipients = list.map((a: any) => ({
          id: a.id, email: a.email!, name: a.name || `${a.firstName || ""} ${a.lastName || ""}`.trim(),
          firstName: a.firstName || a.name?.split(" ")[0] || "", company: a.company || "",
          eventId: a.assignedEvent || eventId,
        }));
      } else {
        let list = await storage.getSponsors();
        if (eventId) list = list.filter((s: any) => Array.isArray(s.assignedEvents) && s.assignedEvents.some((e: any) => e.eventId === eventId));
        if (filters.level) list = list.filter((s: any) => Array.isArray(s.assignedEvents) && s.assignedEvents.some((e: any) => (!eventId || e.eventId === eventId) && e.sponsorshipLevel === filters.level));
        list = list.filter((s: any) => s.archiveState !== "archived" && !!s.contactEmail);
        recipients = list.map((s: any) => ({ id: s.id, email: s.contactEmail!, name: s.contactName || s.name, firstName: s.contactName?.split(" ")[0] || s.name, company: s.name, eventId }));
      }

      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const todayLogs = await storage.listEmailLogs({ emailType: "campaign", from: todayStart, to: todayEnd }, 10000, 0);
      const sentToday = new Set<string>();
      for (const log of todayLogs) sentToday.add(log.recipientEmail);
      const skippedByRateLimit = recipients.filter(r => sentToday.has(r.email)).length;
      recipients = recipients.filter(r => !sentToday.has(r.email));

      let event: any = null;
      if (eventId) event = await storage.getEvent(eventId);

      let emailsSent = 0;
      let failures = 0;
      const campaignSource = `Campaign – ${campaign.name}`;

      const messageJobId = await createMessageJobForSend(storage, {
        jobName: `Campaign Send – ${campaign.name}${event ? ` – ${event?.slug || event?.name}` : ""}`,
        messageType: "CAMPAIGN",
        sourceType: "campaign",
        sourceId: campaign.id,
        eventId: eventId || null,
        templateId: template.id,
        templateKeySnapshot: template.displayName || template.key,
        triggerType: "CAMPAIGN_SEND",
        triggerName: campaign.name,
        recipientCount: recipients.length,
        createdByUserId: req.session?.userId || null,
      });

      for (const r of recipients) {
        try {
          const vars: Record<string, string> = {
            attendee_first_name: r.firstName || r.name?.split(" ")[0] || "",
            attendee_full_name: r.name || "",
            recipient_name: r.name || "",
            company: r.company || "",
            event_name: event?.name || "",
            event_code: event?.slug || "",
            sponsor_name: r.company || "",
          };
          const subject = (template.subjectTemplate || "").replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");
          const html = (template.htmlTemplate || "").replace(/\{\{(\w+)\}\}/g, (_, k: string) => vars[k] ?? "");

          let status: "sent" | "failed" = "sent";
          let errorMessage: string | null = null;
          let providerMessageId: string | null = null;
          try {
            const result = await sendEmail(r.email, subject, html);
            providerMessageId = result?.messageId ?? null;
          } catch (err: any) {
            status = "failed";
            errorMessage = err?.message ?? String(err);
          }

          await storage.createEmailLog({
            emailType: "campaign",
            recipientEmail: r.email,
            subject,
            htmlContent: html,
            eventId: r.eventId || event?.id || null,
            sponsorId: audienceType === "Sponsors" ? r.id : null,
            attendeeId: audienceType === "Attendees" ? r.id : null,
            status,
            errorMessage,
            providerMessageId,
            source: campaignSource,
            templateId: template.id,
            messageJobId,
          });

          if (status === "sent") emailsSent++;
          else failures++;
        } catch (err: any) {
          console.error(`[CAMPAIGN] Error sending to ${r.email}:`, err?.message ?? err);
          failures++;
        }
      }

      await completeMessageJob(storage, messageJobId, emailsSent, failures);

      await storage.updateCampaign(campaign.id, {
        status: "Sent",
        sentAt: new Date(),
        emailsSent,
        failures,
        audienceSize: recipients.length + skippedByRateLimit,
      });

      res.json({ message: "Campaign sent", emailsSent, failures, totalRecipients: recipients.length, skippedByRateLimit });
    } catch (err: any) {
      console.error("[CAMPAIGN SEND] Error:", err);
      try {
        const current = await storage.getCampaign(req.params.id);
        if (current && current.status === "Sending") {
          await storage.updateCampaign(req.params.id, { status: "Draft" });
        }
      } catch (_) {}
      res.status(500).json({ message: err.message ?? "Failed to send campaign" });
    }
  });

  // ── Email Settings Routes ────────────────────────────────────────────────

  app.get("/api/admin/email-settings", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getEmailSettings();
      res.json(settings);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to get email settings" });
    }
  });

  app.patch("/api/admin/email-settings", requireAdmin, async (req, res) => {
    try {
      const { senderName, senderEmail, replyToEmail, dailyLimit } = req.body;
      const updates: Record<string, any> = {};
      if (senderName !== undefined) {
        if (typeof senderName !== "string" || senderName.trim().length === 0) {
          return res.status(400).json({ message: "senderName must be a non-empty string" });
        }
        updates.senderName = senderName.trim();
      }
      if (senderEmail !== undefined) {
        if (typeof senderEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
          return res.status(400).json({ message: "senderEmail must be a valid email address" });
        }
        updates.senderEmail = senderEmail.trim();
      }
      if (replyToEmail !== undefined) {
        if (typeof replyToEmail !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(replyToEmail)) {
          return res.status(400).json({ message: "replyToEmail must be a valid email address" });
        }
        updates.replyToEmail = replyToEmail.trim();
      }
      if (dailyLimit !== undefined) {
        const limit = Number(dailyLimit);
        if (!Number.isFinite(limit) || limit < 1 || limit > 10000) {
          return res.status(400).json({ message: "dailyLimit must be a number between 1 and 10000" });
        }
        updates.dailyLimit = limit;
      }
      const result = await storage.updateEmailSettings(updates);
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to update email settings" });
    }
  });

  app.post("/api/admin/email-settings/pause", requireAdmin, async (req, res) => {
    try {
      const result = await storage.updateEmailSettings({
        globalPaused: true,
        pausedAt: new Date().toISOString(),
        pausedBy: req.session?.userId ?? null,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to pause emails" });
    }
  });

  app.post("/api/admin/email-settings/resume", requireAdmin, async (req, res) => {
    try {
      const result = await storage.updateEmailSettings({
        globalPaused: false,
        pausedAt: null,
        pausedBy: null,
      });
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to resume emails" });
    }
  });

  app.get("/api/admin/email-stats", requireAdmin, async (_req, res) => {
    try {
      const settings = await storage.getEmailSettings();

      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const todayLogs = await storage.listEmailLogs({ from: todayStart, to: todayEnd }, 10000, 0);
      const sentToday = todayLogs.filter((l: any) => l.status === "sent").length;
      const failedToday = todayLogs.filter((l: any) => l.status === "failed").length;

      const history: Array<{ date: string; sent: number; failed: number }> = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
        const dayLogs = await storage.listEmailLogs({ from: dayStart, to: dayEnd }, 10000, 0);
        history.push({
          date: d.toISOString().split("T")[0],
          sent: dayLogs.filter((l: any) => l.status === "sent").length,
          failed: dayLogs.filter((l: any) => l.status === "failed").length,
        });
      }

      const recentFailures = await storage.listEmailLogs({ status: "failed" }, 20, 0);

      let systemStatus = "Operational";
      if (settings.globalPaused) {
        systemStatus = "Paused";
      } else if (failedToday > 5) {
        systemStatus = "Delivery Issues Detected";
      }

      res.json({
        dailyLimit: settings.dailyLimit,
        sentToday,
        failedToday,
        globalPaused: settings.globalPaused,
        pausedAt: settings.pausedAt,
        systemStatus,
        history,
        recentFailures: recentFailures.slice(0, 10),
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to get email stats" });
    }
  });

  // ── Message Jobs Routes ────────────────────────────────────────────────────

  app.get("/api/admin/message-jobs", requireAdmin, async (req, res) => {
    try {
      const filters: Record<string, any> = {};
      if (req.query.messageType) filters.messageType = req.query.messageType;
      if (req.query.status) filters.status = req.query.status;
      if (req.query.eventId) filters.eventId = req.query.eventId;
      if (req.query.sponsorId) filters.sponsorId = req.query.sponsorId;
      if (req.query.sourceType) filters.sourceType = req.query.sourceType;
      if (req.query.search) filters.search = req.query.search;
      if (req.query.from) filters.from = new Date(req.query.from as string);
      if (req.query.to) filters.to = new Date(req.query.to as string);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;
      const jobs = await storage.listMessageJobs(filters, limit, offset);

      const events = await storage.getEvents();
      const sponsors = await storage.getSponsors();
      const eventMap = new Map(events.map((e: any) => [e.id, e]));
      const sponsorMap = new Map(sponsors.map((s: any) => [s.id, s]));

      const enriched = jobs.map((j: any) => ({
        ...j,
        eventName: j.eventId ? eventMap.get(j.eventId)?.name ?? null : null,
        eventSlug: j.eventId ? eventMap.get(j.eventId)?.slug ?? null : null,
        sponsorName: j.sponsorId ? sponsorMap.get(j.sponsorId)?.name ?? null : null,
      }));

      res.json(enriched);
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to list message jobs" });
    }
  });

  app.get("/api/admin/message-jobs/:id", requireAdmin, async (req, res) => {
    try {
      const job = await storage.getMessageJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Message job not found" });

      const childEmails = await storage.getMessageJobEmailLogs(req.params.id);

      let eventName: string | null = null;
      let eventSlug: string | null = null;
      let sponsorName: string | null = null;
      let attendeeName: string | null = null;
      let createdByName: string | null = null;

      if (job.eventId) {
        const ev = await storage.getEvent(job.eventId);
        if (ev) { eventName = ev.name; eventSlug = ev.slug; }
      }
      if (job.sponsorId) {
        const sp = await storage.getSponsor(job.sponsorId);
        if (sp) sponsorName = sp.name;
      }
      if (job.attendeeId) {
        const att = await storage.getAttendee(job.attendeeId);
        if (att) attendeeName = att.name || `${att.firstName || ""} ${att.lastName || ""}`.trim();
      }
      if (job.createdByUserId) {
        const user = await storage.getUser(job.createdByUserId);
        if (user) createdByName = user.name;
      }

      res.json({
        ...job,
        eventName,
        eventSlug,
        sponsorName,
        attendeeName,
        createdByName,
        childEmails,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message ?? "Failed to get message job" });
    }
  });

  // ── Event Interest Topics ─────────────────────────────────────────────────

  function normalizeTopicKey(label: string): string {
    return label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
  }

  // Public: approved + active topics for attendee/sponsor selection
  app.get("/api/events/:eventId/interest-topics", async (req, res) => {
    try {
      const topics = await storage.getEventInterestTopics(req.params.eventId, { status: "APPROVED", isActive: true });
      res.json(topics);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: all topics for an event (with usage counts)
  app.get("/api/admin/events/:eventId/interest-topics", requireAdmin, async (req, res) => {
    try {
      const topics = await storage.getEventInterestTopics(req.params.eventId);
      if (topics.length === 0) return res.json([]);
      const usageMap = await storage.bulkCountTopicUsage(topics.map(t => t.id));
      const result = topics.map(t => ({ ...t, usage: usageMap.get(t.id) ?? { attendees: 0, sponsors: 0, sessions: 0 } }));
      res.json(result);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: create a single topic
  app.post("/api/admin/events/:eventId/interest-topics", requireAdmin, async (req, res) => {
    try {
      const { topicLabel, topicDescription, topicSource, status, displayOrder, isActive } = req.body;
      if (!topicLabel?.trim()) return res.status(400).json({ message: "topicLabel is required" });
      const topicKey = normalizeTopicKey(topicLabel);
      const existing = await storage.getEventInterestTopics(req.params.eventId);
      const dup = existing.find(t => t.topicKey === topicKey);
      if (dup) return res.status(409).json({ message: `Duplicate topic: "${dup.topicLabel}" already exists for this event`, existingId: dup.id });
      const topic = await storage.createEventInterestTopic({
        eventId: req.params.eventId,
        topicKey,
        topicLabel: topicLabel.trim(),
        topicDescription: topicDescription ?? null,
        topicSource: topicSource ?? "ADMIN_DEFINED",
        status: status ?? "APPROVED",
        displayOrder: displayOrder ?? (existing.length),
        isActive: isActive ?? true,
        createdByUserId: (req.user as any)?.id ?? null,
        suggestedBySponsorId: null,
      });
      res.status(201).json(topic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: bulk-add topics (paste multi-line text)
  app.post("/api/admin/events/:eventId/interest-topics/bulk", requireAdmin, async (req, res) => {
    try {
      const { lines, status = "APPROVED" } = req.body as { lines: string[]; status?: string };
      if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ message: "lines array is required" });
      const existing = await storage.getEventInterestTopics(req.params.eventId);
      const existingKeys = new Set(existing.map(t => t.topicKey));
      const results: { label: string; key: string; status: "created" | "duplicate" }[] = [];
      let orderOffset = existing.length;
      for (const raw of lines) {
        const label = raw.trim();
        if (!label) continue;
        const key = normalizeTopicKey(label);
        if (existingKeys.has(key)) { results.push({ label, key, status: "duplicate" }); continue; }
        await storage.createEventInterestTopic({
          eventId: req.params.eventId,
          topicKey: key,
          topicLabel: label,
          topicDescription: null,
          topicSource: "ADMIN_DEFINED",
          status,
          displayOrder: orderOffset++,
          isActive: true,
          createdByUserId: (req.user as any)?.id ?? null,
          suggestedBySponsorId: null,
        });
        existingKeys.add(key);
        results.push({ label, key, status: "created" });
      }
      res.json({ results, created: results.filter(r => r.status === "created").length, duplicates: results.filter(r => r.status === "duplicate").length });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: update a topic
  app.patch("/api/admin/interest-topics/:id", requireAdmin, async (req, res) => {
    try {
      const topic = await storage.getEventInterestTopic(req.params.id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      const updates: Record<string, any> = {};
      if (req.body.topicLabel !== undefined) { updates.topicLabel = req.body.topicLabel.trim(); updates.topicKey = normalizeTopicKey(req.body.topicLabel); }
      if (req.body.topicDescription !== undefined) updates.topicDescription = req.body.topicDescription;
      if (req.body.status !== undefined) updates.status = req.body.status;
      if (req.body.isActive !== undefined) updates.isActive = req.body.isActive;
      if (req.body.displayOrder !== undefined) updates.displayOrder = req.body.displayOrder;
      const updated = await storage.updateEventInterestTopic(req.params.id, updates);
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Admin: delete a topic (only if no usage)
  app.delete("/api/admin/interest-topics/:id", requireAdmin, async (req, res) => {
    try {
      const topic = await storage.getEventInterestTopic(req.params.id);
      if (!topic) return res.status(404).json({ message: "Topic not found" });
      if (req.query.force !== "true") {
        const usage = await storage.countTopicUsage(req.params.id);
        if (usage.attendees + usage.sponsors + usage.sessions > 0) {
          return res.status(409).json({ message: `Cannot delete — topic is in use (${usage.attendees} attendees, ${usage.sponsors} sponsors, ${usage.sessions} sessions)`, usage });
        }
      }
      await storage.deleteEventInterestTopic(req.params.id);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Attendee topic selections (public — attendee context)
  app.get("/api/attendees/:attendeeId/topic-selections", async (req, res) => {
    try {
      const { eventId } = req.query as Record<string, string>;
      if (!eventId) return res.status(400).json({ message: "eventId required" });
      const selections = await storage.getAttendeeTopics(req.params.attendeeId, eventId);
      res.json(selections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/attendees/:attendeeId/topic-selections", async (req, res) => {
    try {
      const { eventId, topicIds } = req.body as { eventId: string; topicIds: string[] };
      if (!eventId || !Array.isArray(topicIds)) return res.status(400).json({ message: "eventId and topicIds[] required" });
      await storage.upsertAttendeeTopics(req.params.attendeeId, eventId, topicIds);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Sponsor topic selections (sponsor-token authenticated)
  app.get("/api/sponsor-dashboard/topic-selections", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "Sponsor token required" });
      const tokenRecord = await storage.getSponsorToken(token);
      if (!tokenRecord) return res.status(401).json({ message: "Invalid token" });
      const selections = await storage.getSponsorTopics(tokenRecord.sponsorId, tokenRecord.eventId);
      res.json(selections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/sponsor-dashboard/topic-selections", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "Sponsor token required" });
      const tokenRecord = await storage.getSponsorToken(token);
      if (!tokenRecord) return res.status(401).json({ message: "Invalid token" });
      const { topicIds } = req.body as { topicIds: string[] };
      if (!Array.isArray(topicIds)) return res.status(400).json({ message: "topicIds[] required" });
      await storage.upsertSponsorTopics(tokenRecord.sponsorId, tokenRecord.eventId, topicIds);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Sponsor topic suggestion (sponsor-token authenticated)
  app.post("/api/sponsor-dashboard/suggest-topic", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "Sponsor token required" });
      const tokenRecord = await storage.getSponsorToken(token);
      if (!tokenRecord) return res.status(401).json({ message: "Invalid token" });
      const { topicLabel } = req.body as { topicLabel: string };
      if (!topicLabel?.trim()) return res.status(400).json({ message: "topicLabel is required" });
      const topicKey = normalizeTopicKey(topicLabel);
      const existing = await storage.getEventInterestTopics(tokenRecord.eventId);
      const dup = existing.find(t => t.topicKey === topicKey);
      if (dup) return res.status(409).json({ message: "A similar topic already exists", existingId: dup.id, existingLabel: dup.topicLabel });
      const topic = await storage.createEventInterestTopic({
        eventId: tokenRecord.eventId,
        topicKey,
        topicLabel: topicLabel.trim(),
        topicDescription: null,
        topicSource: "SPONSOR_SUGGESTED",
        status: "PENDING",
        displayOrder: existing.length,
        isActive: false,
        suggestedBySponsorId: tokenRecord.sponsorId,
        createdByUserId: null,
      });
      res.status(201).json(topic);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Session topic selections (admin)
  app.get("/api/admin/sessions/:sessionId/topic-selections", requireAuth, async (req, res) => {
    try {
      const selections = await storage.getSessionTopics(req.params.sessionId);
      res.json(selections);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  app.post("/api/admin/sessions/:sessionId/topic-selections", requireAuth, async (req, res) => {
    try {
      const { eventId, topicIds } = req.body as { eventId: string; topicIds: string[] };
      if (!eventId || !Array.isArray(topicIds)) return res.status(400).json({ message: "eventId and topicIds[] required" });
      await storage.upsertSessionTopics(req.params.sessionId, eventId, topicIds);
      res.json({ ok: true });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Session topic counts by event (admin)
  app.get("/api/admin/events/:eventId/session-topic-counts", requireAuth, async (req, res) => {
    try {
      const counts = await storage.countSessionTopicsForEvent(req.params.eventId);
      res.json(counts);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
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
      const enriched = await Promise.all(deliverables.map(async (d) => {
        const registrants = await storage.listDeliverableRegistrants(d.id);
        const speakers = await storage.listDeliverableSpeakers(d.id);
        const socialEntries = await storage.listDeliverableSocialEntries(d.id);
        return {
          ...d,
          registrantCount: registrants.length,
          speakerCount: speakers.length,
          socialEntryCount: socialEntries.length,
        };
      }));
      res.json(enriched);
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
        sponsorFacingNote: templateItem.sponsorFacingNote ?? null,
        internalNote: null,
        isOverridden: false,
        helpTitle: templateItem.helpTitle,
        helpText: templateItem.helpText,
        helpLink: templateItem.helpLink,
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
        { name: "Meeting Introduction List (Pre-Event)", category: CATEGORIES.MI, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", qty: 1 },
        { name: "Email Introduction List (Post-Event)", category: CATEGORIES.MI, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event", qty: 1 },
        { name: "Company Logo on Website", category: CATEGORIES.MB, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", qty: 1 },
        { name: "Company Logo on Signage", category: CATEGORIES.MB, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
        { name: "Company Profile in Event App", category: CATEGORIES.MB, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", qty: 1 },
        { name: "Full Attendee Contact List", category: CATEGORIES.PED, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event" },
        { name: "General Liability \u2013 Certificate of Insurance", category: CATEGORIES.CO, ownerType: "Sponsor", sponsorEditable: false, fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true, qty: 1 },
        { name: "Worker\u2019s Compensation \u2013 Certificate of Insurance", category: CATEGORIES.CO, ownerType: "Sponsor", sponsorEditable: false, fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true, qty: 1 },
      ];

      const seedData: { level: string; name: string; items: ItemDef[] }[] = [
        {
          level: "Platinum", name: "FRC 2026 Platinum",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "VIP Registrations", category: CATEGORIES.EP, qty: 4, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "Premium Exhibit Table", category: CATEGORIES.EP, qty: 1, unit: "table", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            { name: "Speaking Engagement", category: CATEGORIES.SC, qty: 2, unit: "sessions", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 9),
            { name: "Customized Social Media Graphics", category: CATEGORIES.MB, qty: 2, unit: "graphics", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcements", category: CATEGORIES.MB, qty: 2, unit: "posts", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(9, 12),
          ],
        },
        {
          level: "Gold", name: "FRC 2026 Gold",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "VIP Registrations", category: CATEGORIES.EP, qty: 3, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "Premium Exhibit Table", category: CATEGORIES.EP, qty: 1, unit: "table", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            { name: "Speaking Engagement", category: CATEGORIES.SC, qty: 1, unit: "sessions", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event", reminderEligible: true },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 9),
            { name: "Customized Social Media Graphics", category: CATEGORIES.MB, qty: 2, unit: "graphics", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcements", category: CATEGORIES.MB, qty: 2, unit: "posts", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(9, 12),
          ],
        },
        {
          level: "Silver", name: "FRC 2026 Silver",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "Registrations", category: CATEGORIES.EP, qty: 2, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "General Exhibit Table", category: CATEGORIES.EP, qty: 1, unit: "table", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            ...sharedItems.slice(4, 6),
            ...sharedItems.slice(6, 9),
            { name: "Customized Social Media Graphic", category: CATEGORIES.MB, qty: 1, unit: "graphic", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcement", category: CATEGORIES.MB, qty: 1, unit: "post", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            ...sharedItems.slice(9, 12),
          ],
        },
        {
          level: "Bronze", name: "FRC 2026 Bronze",
          items: [
            ...sharedItems.slice(0, 4),
            { name: "Registrations", category: CATEGORIES.EP, qty: 2, unit: "registrations", ownerType: "Converge", fulfillmentType: "quantity_progress", dueTiming: "before_event" },
            { name: "General Exhibit Table", category: CATEGORIES.EP, qty: 1, unit: "table", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "during_event" },
            ...sharedItems.slice(6, 9),
            { name: "Customized Social Media Graphic", category: CATEGORIES.MB, qty: 1, unit: "graphic", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Social Media Sponsorship Announcement", category: CATEGORIES.MB, qty: 1, unit: "post", ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "before_event" },
            { name: "Partial Attendee Contact List", category: CATEGORIES.PED, ownerType: "Converge", fulfillmentType: "status_only", dueTiming: "after_event" },
            ...sharedItems.slice(10, 12),
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

  // ── Admin Speaker CRUD (cookie-auth) ─────────────────────────────────────

  app.get("/api/agreement/deliverables/:id/speakers", requireAuth, async (req, res) => {
    try {
      const speakers = await storage.listDeliverableSpeakers(req.params.id);
      res.json(speakers);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/deliverables/:id/speakers", requireAuth, async (req, res) => {
    try {
      const deliverable = await storage.getAgreementDeliverable(req.params.id);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      const { speakerName, speakerTitle, speakerBio, sessionType, sessionTitle } = req.body;
      if (!speakerName?.trim()) return res.status(400).json({ message: "speakerName is required" });
      const speaker = await storage.createDeliverableSpeaker({
        agreementDeliverableId: req.params.id,
        speakerName: speakerName.trim(),
        speakerTitle: speakerTitle?.trim() ?? null,
        speakerBio: speakerBio?.trim() ?? null,
        sessionType: sessionType?.trim() ?? null,
        sessionTitle: sessionTitle?.trim() ?? null,
      });
      res.status(201).json(speaker);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/agreement/deliverables/:id/speakers/:sid", requireAuth, async (req, res) => {
    try {
      await storage.deleteDeliverableSpeaker(req.params.sid);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Admin Social Entries CRUD ────────────────────────────────────────────

  app.get("/api/agreement/deliverables/:id/social-entries", requireAuth, async (req, res) => {
    try {
      const entries = await storage.listDeliverableSocialEntries(req.params.id);
      res.json(entries);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/agreement/deliverables/:id/social-entries", requireAuth, async (req, res) => {
    try {
      const deliverable = await storage.getAgreementDeliverable(req.params.id);
      if (!deliverable) return res.status(404).json({ message: "Deliverable not found" });
      const { entryType, entryIndex } = req.body;
      if (!entryType || !["graphic", "announcement"].includes(entryType)) {
        return res.status(400).json({ message: "entryType must be 'graphic' or 'announcement'" });
      }
      if (entryIndex === undefined || typeof entryIndex !== "number") {
        return res.status(400).json({ message: "entryIndex (number) is required" });
      }
      const entry = await storage.createDeliverableSocialEntry({ ...req.body, deliverableId: req.params.id });
      res.status(201).json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/agreement/social-entries/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getDeliverableSocialEntry(req.params.id);
      if (!existing) return res.status(404).json({ message: "Social entry not found" });
      if (req.body.entryType && !["graphic", "announcement"].includes(req.body.entryType)) {
        return res.status(400).json({ message: "entryType must be 'graphic' or 'announcement'" });
      }
      const entry = await storage.updateDeliverableSocialEntry(req.params.id, req.body);
      res.json(entry);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.delete("/api/agreement/social-entries/:id", requireAuth, async (req, res) => {
    try {
      const existing = await storage.getDeliverableSocialEntry(req.params.id);
      if (!existing) return res.status(404).json({ message: "Social entry not found" });
      await storage.deleteDeliverableSocialEntry(req.params.id);
      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Fulfillment Queue ─────────────────────────────────────────────────────

  // GET /api/agreement/fulfillment-queue — all deliverables with enrichment for operational queue
  app.get("/api/agreement/fulfillment-queue", requireAuth, async (req, res) => {
    try {
      const { eventId, sponsorId, category, ownerType, status, dueTiming, overdueOnly, remindableOnly, neverReminded, search } = req.query as Record<string, string>;

      let deliverables = await storage.listAgreementDeliverables({
        eventId: eventId || undefined,
        sponsorId: sponsorId || undefined,
      });

      if (category) deliverables = deliverables.filter(d => d.category === category);
      if (ownerType) deliverables = deliverables.filter(d => d.ownerType === ownerType);
      if (status) deliverables = deliverables.filter(d => d.status === status);
      if (dueTiming) deliverables = deliverables.filter(d => d.dueTiming === dueTiming);
      if (remindableOnly === "true") deliverables = deliverables.filter(d => d.reminderEligible);

      const now = new Date();
      if (overdueOnly === "true") {
        deliverables = deliverables.filter(d => d.dueDate && new Date(d.dueDate) < now);
      }

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

      const registrantCounts: Record<string, number> = {};
      const quantityDeliverables = deliverables.filter(d => d.fulfillmentType === "quantity_progress");
      await Promise.all(quantityDeliverables.map(async (d) => {
        const regs = await storage.listDeliverableRegistrants(d.id);
        registrantCounts[d.id] = regs.length;
      }));

      let result = deliverables.map(d => {
        const sponsor = sponsorMap[d.sponsorId];
        const event = eventMap[d.eventId];
        const pairKey = `${d.sponsorId}|${d.eventId}`;
        const isOverdue = d.dueDate ? new Date(d.dueDate) < now : false;
        const lastReminderSent = lastReminderMap[pairKey] ?? null;
        return {
          ...d,
          sponsorName: sponsor?.name ?? "",
          eventName: event?.name ?? "",
          eventSlug: event?.slug ?? "",
          sponsorshipLevel: d.sponsorshipLevel ?? sponsor?.level ?? "",
          lastReminderSent,
          isOverdue,
          quantityFulfilled: registrantCounts[d.id] ?? 0,
        };
      });

      if (neverReminded === "true") {
        result = result.filter(d => !d.lastReminderSent);
      }

      if (search) {
        const q = search.toLowerCase();
        result = result.filter(d =>
          d.deliverableName.toLowerCase().includes(q) ||
          d.sponsorName.toLowerCase().includes(q) ||
          d.eventName.toLowerCase().includes(q) ||
          (d.eventSlug || "").toLowerCase().includes(q)
        );
      }

      res.json(result);
    } catch (err: unknown) { res.status(500).json({ message: err instanceof Error ? err.message : "Unknown error" }); }
  });

  // POST /api/agreement/fulfillment-queue/bulk-status — bulk update status on multiple deliverables
  app.post("/api/agreement/fulfillment-queue/bulk-status", requireAuth, async (req, res) => {
    try {
      const { ids, status } = req.body as { ids?: string[]; status?: string };
      if (!ids?.length || !status) return res.status(400).json({ message: "ids[] and status required" });

      await Promise.all(ids.map(id => storage.updateAgreementDeliverable(id, { status })));
      res.json({ updated: ids.length });
    } catch (err: unknown) { res.status(500).json({ message: err instanceof Error ? err.message : "Unknown error" }); }
  });

  // POST /api/agreement/fulfillment-queue/bulk-remind — grouped bulk reminders (one email per sponsor/event pair)
  app.post("/api/agreement/fulfillment-queue/bulk-remind", requireAuth, async (req, res) => {
    try {
      const { ids } = req.body as { ids?: string[] };
      if (!ids?.length) return res.status(400).json({ message: "ids[] required" });

      const deliverables = (await Promise.all(ids.map(id => storage.getAgreementDeliverable(id)))).filter(Boolean) as Awaited<ReturnType<typeof storage.getAgreementDeliverable>>[];

      const groups: Record<string, typeof deliverables> = {};
      for (const d of deliverables) {
        if (!d) continue;
        const key = `${d.sponsorId}|${d.eventId}`;
        if (!groups[key]) groups[key] = [];
        groups[key].push(d);
      }

      const { sendDeliverableReminderEmail } = await import("../services/emailService.js");
      const results: { sponsorId: string; eventId: string; sent: boolean; error?: string }[] = [];

      for (const [key, items] of Object.entries(groups)) {
        const [sponsorId, eventId] = key.split("|");
        try {
          const [sponsor, event] = await Promise.all([storage.getSponsor(sponsorId), storage.getEvent(eventId)]);
          if (!sponsor || !event) { results.push({ sponsorId, eventId, sent: false, error: "Sponsor or event not found" }); continue; }

          const sponsorUsers = await storage.getSponsorUsersBySponsor(sponsorId);
          const primaryUser = sponsorUsers.find(u => u.isPrimary) ?? sponsorUsers.find(u => u.accessLevel === "owner") ?? sponsorUsers[0];
          const recipientEmail = primaryUser?.email ?? sponsor.contactEmail ?? null;
          if (!recipientEmail) { results.push({ sponsorId, eventId, sent: false, error: "No recipient email" }); continue; }

          const tokens = await storage.getSponsorTokensBySponsor(sponsorId);
          const activeToken = tokens.find(t => !t.revokedAt) ?? tokens[0];
          const sponsorToken = activeToken?.token ?? "";

          await sendDeliverableReminderEmail(storage, {
            sponsor,
            event,
            deliverables: items.filter(Boolean) as NonNullable<typeof items[number]>[],
            recipientName: primaryUser?.name ?? null,
            recipientEmail,
            sponsorToken,
          });

          await storage.createDeliverableReminder({
            sponsorId, eventId, recipientEmail,
            reminderType: "manual_admin", sentByRole: "admin",
            sentByUserId: (req as any).user?.id ?? null,
            sentAt: new Date(), status: "sent", errorMessage: null,
            deliverableCount: items.length,
          });

          results.push({ sponsorId, eventId, sent: true });
        } catch (e: unknown) {
          results.push({ sponsorId, eventId, sent: false, error: e instanceof Error ? e.message : "Unknown error" });
        }
      }

      const sentCount = results.filter(r => r.sent).length;
      res.json({ sentCount, groupCount: Object.keys(groups).length, results });
    } catch (err: unknown) { res.status(500).json({ message: err instanceof Error ? err.message : "Unknown error" }); }
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
    "registration-docs": { allowedMime: ["application/pdf","application/vnd.openxmlformats-officedocument.wordprocessingml.document","image/png","image/jpeg","image/jpg"], maxBytes: 15*1024*1024 },
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
          fireInternalNotification(tokenRecord.sponsorId, deliverable.deliverableName, "uploaded a file", deliverable.eventId).catch(() => {});
        }
      }

      res.json(fileAsset);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Meeting Invitations — Sponsor Dashboard ────────────────────────────────

  app.get("/api/sponsor-dashboard/discovery/attendees", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "No token provided" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const tokenRecord = validation.tokenRecord;

      const event = await storage.getEvent(tokenRecord.eventId);
      if (!event || !event.matchmakingEnabled) return res.json({ attendees: [], matchmakingEnabled: false });

      const sponsor = await storage.getSponsor(tokenRecord.sponsorId);
      if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

      const allAttendees = (await storage.getAttendees()).filter(
        a => a.assignedEvent === event.id && a.archiveState === "active"
      );

      const ranked = rankAttendees(allAttendees, sponsor);

      const sponsorLevel = sponsor.level || "Bronze";
      const quotas = event.invitationQuotas || INVITATION_QUOTAS;
      const invitationLimit = quotas[sponsorLevel] ?? INVITATION_QUOTAS[sponsorLevel] ?? 5;
      const sentCount = await storage.countSponsorInvitations(sponsor.id, event.id);

      const existingInvitations = await storage.listMeetingInvitations({ sponsorId: sponsor.id, eventId: event.id });
      const invitedAttendeeIds = new Set(existingInvitations.map(i => i.attendeeId));

      const safeAttendees = ranked.map(r => ({
        id: r.attendee.id,
        name: r.attendee.name,
        firstName: r.attendee.firstName,
        lastName: r.attendee.lastName,
        company: r.attendee.company,
        title: r.attendee.title,
        attendeeCategory: r.attendee.attendeeCategory,
        interests: r.attendee.interests || [],
        matchScore: r.score,
        matchReasons: r.reasons,
        invited: invitedAttendeeIds.has(r.attendee.id),
      }));

      const categoryCounts = {
        practitioner: allAttendees.filter(a => a.attendeeCategory === "PRACTITIONER").length,
        governmentNonprofit: allAttendees.filter(a => a.attendeeCategory === "GOVERNMENT_NONPROFIT").length,
        solutionProvider: allAttendees.filter(a => a.attendeeCategory === "SOLUTION_PROVIDER").length,
      };

      res.json({
        matchmakingEnabled: true,
        attendees: safeAttendees,
        categoryCounts,
        invitationsUsed: sentCount,
        invitationLimit,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/sponsor-dashboard/invitations", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "No token provided" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const tokenRecord = validation.tokenRecord;
      const invitations = await storage.listMeetingInvitations({
        sponsorId: tokenRecord.sponsorId,
        eventId: tokenRecord.eventId,
      });
      const attendeeIds = [...new Set(invitations.map(i => i.attendeeId))];
      const allAttendees = await storage.getAttendees();
      const attendeeMap = new Map(allAttendees.map(a => [a.id, a]));
      const enriched = invitations.map(inv => {
        const att = attendeeMap.get(inv.attendeeId);
        return {
          ...inv,
          attendeeName: att?.name ?? "Unknown",
          attendeeCompany: att?.company ?? "",
          attendeeTitle: att?.title ?? "",
          attendeeCategory: att?.attendeeCategory ?? null,
        };
      });
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/sponsor-dashboard/invitations", async (req, res) => {
    try {
      const token = req.headers["x-sponsor-token"] as string ?? req.query.token as string;
      if (!token) return res.status(401).json({ message: "No token provided" });
      const validation = await validateSponsorToken(token);
      if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
      const tokenRecord = validation.tokenRecord;

      const { attendeeId, message } = req.body;
      if (!attendeeId) return res.status(400).json({ message: "attendeeId required" });

      const event = await storage.getEvent(tokenRecord.eventId);
      if (!event || !event.matchmakingEnabled) return res.status(400).json({ message: "Matchmaking not enabled for this event" });

      const sponsor = await storage.getSponsor(tokenRecord.sponsorId);
      if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

      const sponsorLevel = sponsor.level || "Bronze";
      const quotas = event.invitationQuotas || INVITATION_QUOTAS;
      const invitationLimit = quotas[sponsorLevel] ?? INVITATION_QUOTAS[sponsorLevel] ?? 5;
      const sentCount = await storage.countSponsorInvitations(sponsor.id, event.id);
      if (sentCount >= invitationLimit) return res.status(400).json({ message: "Invitation quota exceeded" });

      const attendee = await storage.getAttendee(attendeeId);
      if (!attendee || attendee.assignedEvent !== event.id) return res.status(404).json({ message: "Attendee not found" });

      const maxPerAttendee = event.maxInvitationsPerAttendee ?? MAX_INVITATIONS_PER_ATTENDEE;
      const attendeeInvCount = await storage.countAttendeeInvitations(attendeeId, event.id);
      if (attendeeInvCount >= maxPerAttendee) return res.status(400).json({ message: "This attendee has reached their invitation limit" });

      const existing = await storage.listMeetingInvitations({ sponsorId: sponsor.id, eventId: event.id, attendeeId });
      if (existing.length > 0) return res.status(400).json({ message: "Invitation already sent to this attendee" });

      const secureToken = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

      const { score } = rankAttendees([attendee], sponsor)[0] || { score: 0 };

      const invitation = await storage.createMeetingInvitation({
        eventId: event.id,
        sponsorId: sponsor.id,
        attendeeId,
        message: message || null,
        categorySnapshot: attendee.attendeeCategory || null,
        matchScore: score,
        secureToken,
        expiresAt,
        status: "pending",
      });

      const baseUrl = await getAppBaseUrl();
      const inviteUrl = `${baseUrl}/meeting-invitation/${secureToken}`;

      try {
        await sendEmail({
          to: attendee.email,
          subject: `A Sponsor Would Like to Meet With You at ${event.name}`,
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#0D1E3A;">Meeting Invitation</h2>
              <p><strong>${sponsor.name}</strong> would like to schedule a meeting with you at <strong>${event.name}</strong>.</p>
              ${sponsor.shortDescription ? `<p style="color:#64748b;">${sponsor.shortDescription}</p>` : ""}
              ${message ? `<p><em>"${message}"</em></p>` : ""}
              <div style="margin:24px 0;">
                <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#0D9488;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">View Invitation</a>
              </div>
              <p style="color:#94a3b8;font-size:12px;">This invitation expires in 14 days.</p>
            </div>
          `,
        });
      } catch (emailErr) {
        console.error("[invitations] failed to send invitation email:", emailErr);
      }

      res.status(201).json(invitation);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Public Invitation Response Pages ─────────────────────────────────────

  app.get("/api/meeting-invitation/:token", async (req, res) => {
    try {
      const invitation = await storage.getMeetingInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        if (invitation.status === "pending") {
          await storage.updateMeetingInvitation(invitation.id, { status: "expired" });
        }
        return res.status(410).json({ message: "Invitation has expired" });
      }

      const sponsor = await storage.getSponsor(invitation.sponsorId);
      const event = await storage.getEvent(invitation.eventId);
      const attendee = await storage.getAttendee(invitation.attendeeId);

      const meetingBlocks = event?.meetingBlocks || [];
      const meetingLocations = event?.meetingLocations || [];

      res.json({
        id: invitation.id,
        status: invitation.status,
        message: invitation.message,
        sponsorName: sponsor?.name ?? "Sponsor",
        sponsorDescription: sponsor?.shortDescription ?? "",
        sponsorSolutions: sponsor?.solutionsSummary ?? "",
        eventName: event?.name ?? "Event",
        eventLocation: event?.location ?? "",
        eventStartDate: event?.startDate,
        eventEndDate: event?.endDate,
        attendeeName: attendee?.name ?? "",
        meetingBlocks,
        meetingLocations,
      });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/meeting-invitation/:token/accept", async (req, res) => {
    try {
      const invitation = await storage.getMeetingInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") return res.status(400).json({ message: `Invitation is already ${invitation.status}` });
      if (invitation.expiresAt && new Date(invitation.expiresAt) < new Date()) {
        await storage.updateMeetingInvitation(invitation.id, { status: "expired" });
        return res.status(410).json({ message: "Invitation has expired" });
      }

      const { date, time, location } = req.body;
      if (!date || !time) return res.status(400).json({ message: "date and time are required" });

      const event = await storage.getEvent(invitation.eventId);
      if (!event) return res.status(404).json({ message: "Event not found" });

      const validBlocks = event.meetingBlocks || [];
      const blockMatch = validBlocks.some((b: any) => b.date === date && time >= b.startTime && time < b.endTime);
      if (!blockMatch) return res.status(400).json({ message: "Selected time slot is not within an available meeting block" });

      if (location && location !== "TBD") {
        const validLocations = (event.meetingLocations || []).map((l: any) => l.name);
        if (!validLocations.includes(location)) return res.status(400).json({ message: "Invalid meeting location" });
      }

      const [sponsorConflict, attendeeConflict, locationConflict] = await Promise.all([
        storage.getMeetingConflict(invitation.eventId, invitation.sponsorId, date, time),
        storage.getAttendeeConflict(invitation.eventId, invitation.attendeeId, date, time),
        location && location !== "TBD" ? storage.getLocationConflict(invitation.eventId, location, date, time) : Promise.resolve(undefined),
      ]);
      if (sponsorConflict) return res.status(409).json({ conflict: true, message: "This sponsor already has a meeting at this time." });
      if (attendeeConflict) return res.status(409).json({ conflict: true, message: "You already have a meeting at this time." });
      if (locationConflict) return res.status(409).json({ conflict: true, message: "This location is already booked at this time." });

      const meeting = await storage.createMeeting({
        eventId: invitation.eventId,
        sponsorId: invitation.sponsorId,
        attendeeId: invitation.attendeeId,
        meetingType: "onsite",
        date,
        time,
        location: location || "TBD",
        status: "Scheduled",
        source: "public",
        notes: invitation.message ? `Invitation message: ${invitation.message}` : undefined,
      });

      await storage.updateMeetingInvitation(invitation.id, {
        status: "scheduled",
        respondedAt: new Date(),
        acceptedAt: new Date(),
      });

      const sponsor = await storage.getSponsor(invitation.sponsorId);
      const attendee = await storage.getAttendee(invitation.attendeeId);

      if (sponsor && event && attendee) {
        try {
          await sendMeetingNotificationToSponsor(storage, attendee, sponsor, meeting, event, null);
          await storage.createNotification({
            sponsorId: sponsor.id,
            eventId: event.id,
            meetingId: meeting.id,
            type: "onsite_booked" as SponsorNotificationType,
            attendeeName: attendee.name,
            attendeeCompany: attendee.company,
            eventName: event.name,
            date: meeting.date,
            time: meeting.time,
            isRead: false,
          });
        } catch (e) { console.error("[invitations] notification error:", e); }
      }

      res.json({ ok: true, meetingId: meeting.id });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/meeting-invitation/:token/decline", async (req, res) => {
    try {
      const invitation = await storage.getMeetingInvitationByToken(req.params.token);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") return res.status(400).json({ message: `Invitation is already ${invitation.status}` });

      await storage.updateMeetingInvitation(invitation.id, {
        status: "declined",
        respondedAt: new Date(),
        declinedAt: new Date(),
      });

      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Admin: Meeting Invitations ───────────────────────────────────────────

  app.get("/api/admin/meeting-invitations", requireAuth, async (req, res) => {
    try {
      const { eventId, sponsorId } = req.query;
      const invitations = await storage.listMeetingInvitations({
        eventId: eventId as string | undefined,
        sponsorId: sponsorId as string | undefined,
      });
      const allAttendees = await storage.getAttendees();
      const allSponsors = await storage.getSponsors();
      const attendeeMap = new Map(allAttendees.map(a => [a.id, a]));
      const sponsorMap = new Map(allSponsors.map(s => [s.id, s]));
      const enriched = invitations.map(inv => {
        const att = attendeeMap.get(inv.attendeeId);
        const sp = sponsorMap.get(inv.sponsorId);
        return {
          ...inv,
          attendeeName: att?.name ?? "Unknown",
          attendeeCompany: att?.company ?? "",
          attendeeEmail: att?.email ?? "",
          sponsorName: sp?.name ?? "Unknown",
        };
      });
      res.json(enriched);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.patch("/api/admin/meeting-invitations/:id", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      if (!status) return res.status(400).json({ message: "status required" });
      const validStatuses = ["pending", "sent", "viewed", "accepted", "scheduled", "declined", "expired", "cancelled"];
      if (!validStatuses.includes(status)) return res.status(400).json({ message: `Invalid status. Must be one of: ${validStatuses.join(", ")}` });
      const updated = await storage.updateMeetingInvitation(req.params.id, { status });
      if (!updated) return res.status(404).json({ message: "Invitation not found" });
      res.json(updated);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/meeting-invitations/:id/resend", requireAuth, async (req, res) => {
    try {
      const invitation = await storage.getMeetingInvitation(req.params.id);
      if (!invitation) return res.status(404).json({ message: "Invitation not found" });
      if (invitation.status !== "pending") return res.status(400).json({ message: "Can only resend pending invitations" });

      const attendee = await storage.getAttendee(invitation.attendeeId);
      const sponsor = await storage.getSponsor(invitation.sponsorId);
      const event = await storage.getEvent(invitation.eventId);
      if (!attendee || !sponsor || !event) return res.status(404).json({ message: "Related records not found" });

      const baseUrl = await getAppBaseUrl();
      const inviteUrl = `${baseUrl}/meeting-invitation/${invitation.secureToken}`;

      await sendEmail({
        to: attendee.email,
        subject: `Reminder: ${sponsor.name} Would Like to Meet at ${event.name}`,
        html: `
          <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
            <h2 style="color:#0D1E3A;">Meeting Invitation Reminder</h2>
            <p><strong>${sponsor.name}</strong> would like to schedule a meeting with you at <strong>${event.name}</strong>.</p>
            ${sponsor.shortDescription ? `<p style="color:#64748b;">${sponsor.shortDescription}</p>` : ""}
            <div style="margin:24px 0;">
              <a href="${inviteUrl}" style="display:inline-block;padding:12px 24px;background-color:#0D9488;color:white;text-decoration:none;border-radius:6px;font-weight:bold;">View Invitation</a>
            </div>
          </div>
        `,
      });

      res.json({ ok: true });
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  // ── Data Backup Routes ────────────────────────────────────────────────────

  app.get("/api/admin/backups", requireAdmin, async (_req, res) => {
    try {
      const jobs = await listBackupJobs(200);
      res.json(jobs);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/backups/full", requireAdmin, async (_req, res) => {
    try {
      const job = await runFullBackup("manual");
      res.json(job);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/backups/event/:eventId", requireAdmin, async (_req, res) => {
    res.status(410).json({ message: "Event-level backups are no longer supported. Use Full System Backup instead." });
  });

  app.post("/api/admin/backups/sponsor/:sponsorId/:eventId", requireAdmin, async (_req, res) => {
    res.status(410).json({ message: "Sponsor-level backups are no longer supported. Use Full System Backup instead." });
  });

  app.get("/api/admin/backups/:id/download", requireAdmin, async (req, res) => {
    try {
      const objectKey = await getBackupObjectKey(req.params.id);
      const stream = await streamR2Object(objectKey);
      const filename = objectKey.split("/").pop() ?? "backup.json";
      res.set("Content-Type", "application/json");
      res.set("Content-Disposition", `attachment; filename="${filename}"`);
      stream.pipe(res);
    } catch (err: any) { res.status(404).json({ message: err.message }); }
  });

  app.get("/api/admin/backups/:id/detail", requireAdmin, async (req, res) => {
    try {
      const job = await getBackupJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Backup job not found" });
      const detail = await getBackupDetail(job);
      res.json(detail);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/backups/:id/validate", requireAdmin, async (req, res) => {
    try {
      const job = await getBackupJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Backup job not found" });
      console.log(`[RESTORE] Admin initiated validation for backup ${job.id}`);
      const result = await validateBackup(job);
      console.log(`[RESTORE] Validation result for ${job.id}: ${result.restoreReady}`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.post("/api/admin/backups/:id/dry-run", requireAdmin, async (req, res) => {
    try {
      const job = await getBackupJob(req.params.id);
      if (!job) return res.status(404).json({ message: "Backup job not found" });
      console.log(`[RESTORE] Admin initiated dry-run restore for backup ${job.id}`);
      const result = await dryRunRestore(job);
      console.log(`[RESTORE] Dry-run result for ${job.id}: valid=${result.valid}, conflicts=${result.conflicts.length}`);
      res.json(result);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/backup-schedule", requireAdmin, async (_req, res) => {
    try {
      const schedule = await storage.getBackupSchedule();
      res.json(schedule);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.put("/api/admin/backup-schedule", requireAdmin, async (req, res) => {
    try {
      const { enabled, timeUtc, timezone } = req.body;
      const updates: any = {};
      if (typeof enabled === "boolean") updates.enabled = enabled;
      if (typeof timeUtc === "string") updates.timeUtc = timeUtc;
      if (typeof timezone === "string") updates.timezone = timezone;
      const newTime = updates.timeUtc ?? (await storage.getBackupSchedule()).timeUtc ?? "03:00";
      const [h, m] = newTime.split(":").map(Number);
      const isEnabled = updates.enabled ?? (await storage.getBackupSchedule()).enabled;
      if (isEnabled) {
        const now = new Date();
        const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h, m || 0, 0));
        if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
        updates.nextRunAt = next.toISOString();
      } else {
        updates.nextRunAt = null;
      }
      const schedule = await storage.updateBackupSchedule(updates);
      res.json(schedule);
    } catch (err: any) { res.status(500).json({ message: err.message }); }
  });

  app.get("/api/admin/demo/status", requireAdmin, async (_req, res) => {
    if (!isDemoMode()) {
      return res.status(404).json({ message: "Not in demo mode" });
    }
    const [eventCount] = await db.select({ count: sql<number>`count(*)` }).from(eventsTable);
    const [sponsorCount] = await db.select({ count: sql<number>`count(*)` }).from(sponsorsTable);
    const [attendeeCount] = await db.select({ count: sql<number>`count(*)` }).from(attendeesTable);
    const [meetingCount] = await db.select({ count: sql<number>`count(*)` }).from(meetingsTable);
    const [irCount] = await db.select({ count: sql<number>`count(*)` }).from(informationRequestsTable);
    res.json({
      isDemoMode: true,
      counts: {
        events: Number(eventCount.count),
        sponsors: Number(sponsorCount.count),
        attendees: Number(attendeeCount.count),
        meetings: Number(meetingCount.count),
        informationRequests: Number(irCount.count),
      },
    });
  });

  let demoResetInProgress = false;
  app.post("/api/admin/demo/reset", requireAdmin, async (_req, res) => {
    if (!isDemoMode()) {
      return res.status(403).json({ message: "Demo reset is only available in demo mode" });
    }
    if (demoResetInProgress) {
      return res.status(409).json({ message: "A demo reset is already in progress. Please wait." });
    }
    try {
      demoResetInProgress = true;
      console.log("[DEMO] Admin initiated demo environment reset...");
      const { execSync } = await import("child_process");
      console.log("[DEMO] Step 1/2 — Updating database schema...");
      execSync("npm run db:push", {
        cwd: process.cwd(),
        stdio: "pipe",
        timeout: 60000,
        env: { ...process.env },
      });
      console.log("[DEMO] Step 2/2 — Reseeding demo data...");
      execSync("npx tsx scripts/seedDemoEnvironment.ts --force", {
        cwd: process.cwd(),
        stdio: "pipe",
        timeout: 60000,
        env: { ...process.env, APP_ENV: "demo" },
      });
      console.log("[DEMO] Demo environment reset complete.");
      res.json({ ok: true, message: "Demo environment has been reset with fresh data." });
    } catch (err: any) {
      console.error("[DEMO] Reset failed:", err.message);
      res.status(500).json({ message: "Demo reset failed. Please check the server logs." });
    } finally {
      demoResetInProgress = false;
    }
  });

  // ── Attendee Concierge Portal ─────────────────────────────────────────────

  function getAttendeeToken(req: any): string | undefined {
    return (req.headers["x-attendee-token"] as string | undefined) ?? (req.query.token as string | undefined);
  }

  async function validateAttendeeToken(token: string): Promise<
    { ok: false; status: number; message: string } | { ok: true; tokenRecord: NonNullable<Awaited<ReturnType<typeof storage.getAttendeeToken>>> }
  > {
    const tokenRecord = await storage.getAttendeeToken(token);
    if (!tokenRecord) return { ok: false, status: 401, message: "Invalid access token" };
    if (!tokenRecord.isActive) return { ok: false, status: 403, message: "Access token has been revoked" };
    if (new Date(tokenRecord.expiresAt) < new Date()) return { ok: false, status: 403, message: "Access token has expired" };
    return { ok: true, tokenRecord };
  }

  // Validate token endpoint (used by the access page to authenticate)
  app.get("/api/attendee-access/:token", async (req, res) => {
    const validation = await validateAttendeeToken(req.params.token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    const attendee = await storage.getAttendee(tokenRecord.attendeeId);
    const event = await storage.getEvent(tokenRecord.eventId);
    if (!attendee || !event) return res.status(404).json({ message: "Attendee or event not found" });
    return res.json({ ok: true, attendeeId: attendee.id, eventId: event.id });
  });

  // Get attendee + event + onboarding state
  app.get("/api/attendee-portal/me", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    const [attendee, event] = await Promise.all([
      storage.getAttendee(tokenRecord.attendeeId),
      storage.getEvent(tokenRecord.eventId),
    ]);
    if (!attendee || !event) return res.status(404).json({ message: "Attendee or event not found" });
    return res.json({
      attendee: { id: attendee.id, firstName: attendee.firstName, lastName: attendee.lastName, name: attendee.name, company: attendee.company, title: attendee.title, email: attendee.email },
      event: { id: event.id, name: event.name, startDate: event.startDate, endDate: event.endDate, location: event.location },
      onboarding: {
        completedAt: tokenRecord.onboardingCompletedAt,
        skippedAt: tokenRecord.onboardingSkippedAt,
        isDone: !!(tokenRecord.onboardingCompletedAt || tokenRecord.onboardingSkippedAt),
      },
    });
  });

  // Get active approved topics for the attendee's event
  app.get("/api/attendee-portal/topics", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    const topics = await storage.getEventInterestTopics(tokenRecord.eventId, { status: "Approved", isActive: true });
    return res.json(topics);
  });

  // Get attendee's current topic selections
  app.get("/api/attendee-portal/topic-selections", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    const selections = await storage.getAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId);
    return res.json(selections);
  });

  // Save topic selections and mark onboarding complete
  app.post("/api/attendee-portal/topic-selections", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;
    const { topicIds } = req.body as { topicIds: string[] };
    if (!Array.isArray(topicIds)) return res.status(400).json({ message: "topicIds must be an array" });
    await storage.upsertAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId, topicIds);
    await storage.updateAttendeeToken(token, { onboardingCompletedAt: new Date() });
    return res.json({ ok: true });
  });

  // Skip onboarding
  app.post("/api/attendee-portal/skip-onboarding", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    await storage.updateAttendeeToken(token, { onboardingSkippedAt: new Date() });
    return res.json({ ok: true });
  });

  // Recommended sessions — sessions whose topics overlap with attendee's topic selections
  app.get("/api/attendee-portal/recommended-sessions", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [attendeeTopics, sessions, allEventTopics, sessionTypes] = await Promise.all([
      storage.getAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId),
      storage.getAgendaSessions(tokenRecord.eventId),
      storage.getEventInterestTopics(tokenRecord.eventId),
      storage.getSessionTypes(),
    ]);
    const topicLabelMap = new Map(allEventTopics.map((t) => [t.id, t.topicLabel]));
    const typeMap = new Map(sessionTypes.map((t) => [t.key, t]));
    const attendeeTopicIds = new Set(attendeeTopics.map((t) => t.topicId));
    const publishedSessions = sessions.filter((s) => s.status === "Published" && s.isPublic);

    const scoredSessions = await Promise.all(
      publishedSessions.map(async (session) => {
        const [sessionTopics, speakers] = await Promise.all([
          storage.getSessionTopics(session.id),
          storage.getSessionSpeakers(session.id),
        ]);
        const overlapping = sessionTopics.filter((t) => attendeeTopicIds.has(t.topicId));
        const featuredBonus = session.isFeatured ? 0.5 : 0;
        const score = overlapping.length + featuredBonus;
        const type = typeMap.get(session.sessionTypeKey);
        return { session, overlap: overlapping.length, score, overlapping, speakers, type };
      })
    );

    const results = scoredSessions
      .filter((s) => s.overlap > 0 || attendeeTopicIds.size === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ session, overlap, overlapping, speakers, type }) => ({
        id: session.id,
        title: session.title,
        description: session.description,
        sessionDate: session.sessionDate,
        startTime: session.startTime,
        endTime: session.endTime,
        locationName: session.locationName,
        isFeatured: session.isFeatured,
        sessionTypeLabel: type?.label ?? session.sessionTypeKey,
        overlapScore: overlap,
        overlapTopicLabels: overlapping.map((t) => topicLabelMap.get(t.topicId) ?? "").filter(Boolean),
        speakers: speakers.map((sp) => ({ name: sp.name, title: sp.title })),
      }));

    return res.json(results);
  });

  // Recommended sponsors — sponsors whose topics overlap with attendee's topic selections
  app.get("/api/attendee-portal/recommended-sponsors", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [attendeeTopics, allSponsors, allEventTopics, allMeetings] = await Promise.all([
      storage.getAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId),
      storage.getSponsors(),
      storage.getEventInterestTopics(tokenRecord.eventId),
      storage.getMeetings(),
    ]);
    const topicLabelMap = new Map(allEventTopics.map((t) => [t.id, t.topicLabel]));
    const attendeeTopicIds = new Set(attendeeTopics.map((t) => t.topicId));
    const eventSponsors = allSponsors.filter((s) =>
      (s.assignedEvents ?? []).some((link: any) => link.eventId === tokenRecord.eventId && link.archiveState !== "archived")
    );
    const myMeetings = allMeetings.filter((m) => m.attendeeId === tokenRecord.attendeeId && m.eventId === tokenRecord.eventId);
    const engagedSponsorIds = new Set(
      myMeetings.filter((m) => ["Confirmed", "Declined", "Cancelled", "NoShow"].includes(m.status ?? "")).map((m) => m.sponsorId)
    );

    const scoredSponsors = await Promise.all(
      eventSponsors.map(async (sponsor) => {
        const sponsorTopics = await storage.getSponsorTopics(sponsor.id, tokenRecord.eventId);
        const overlapping = sponsorTopics.filter((t) => attendeeTopicIds.has(t.topicId));
        const completenessBonus = (sponsor.logoUrl ? 0.3 : 0) + (sponsor.shortDescription ? 0.2 : 0);
        const engagedPenalty = engagedSponsorIds.has(sponsor.id) ? -2 : 0;
        const score = overlapping.length + completenessBonus + engagedPenalty;
        return { sponsor, overlap: overlapping.length, score, overlapping };
      })
    );

    const results = scoredSponsors
      .filter((s) => s.overlap > 0 || attendeeTopicIds.size === 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
      .map(({ sponsor, overlap, overlapping }) => ({
        id: sponsor.id,
        name: sponsor.name,
        category: sponsor.category,
        logoUrl: sponsor.logoUrl,
        shortDescription: sponsor.shortDescription,
        overlapScore: overlap,
        overlapTopicLabels: overlapping.map((t) => topicLabelMap.get(t.topicId) ?? "").filter(Boolean),
      }));

    return res.json(results);
  });

  // Suggested meetings — highest-overlap sponsors with no existing active meeting
  app.get("/api/attendee-portal/suggested-meetings", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [attendeeTopics, allSponsors, allEventTopics, allMeetings, allInfoRequests] = await Promise.all([
      storage.getAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId),
      storage.getSponsors(),
      storage.getEventInterestTopics(tokenRecord.eventId),
      storage.getMeetings(),
      storage.listInformationRequests({ eventId: tokenRecord.eventId }),
    ]);
    const topicLabelMap = new Map(allEventTopics.map((t) => [t.id, t.topicLabel]));
    const attendeeTopicIds = new Set(attendeeTopics.map((t) => t.topicId));
    if (attendeeTopicIds.size === 0) return res.json([]);

    const eventSponsors = allSponsors.filter((s) =>
      (s.assignedEvents ?? []).some((link: any) => link.eventId === tokenRecord.eventId && link.archiveState !== "archived")
    );
    const myMeetings = allMeetings.filter((m) => m.attendeeId === tokenRecord.attendeeId && m.eventId === tokenRecord.eventId);
    const sponsorsWithAnyMeeting = new Set(
      myMeetings.filter((m) => !["Cancelled", "NoShow"].includes(m.status ?? "")).map((m) => m.sponsorId)
    );
    const myInfoRequests = (allInfoRequests ?? []).filter((r: any) => r.attendeeId === tokenRecord.attendeeId);
    const sponsorsWithInfoRequest = new Set(myInfoRequests.map((r: any) => r.sponsorId));

    const scoredSponsors = await Promise.all(
      eventSponsors
        .filter((s) => !sponsorsWithAnyMeeting.has(s.id))
        .map(async (sponsor) => {
          const sponsorTopics = await storage.getSponsorTopics(sponsor.id, tokenRecord.eventId);
          const overlapping = sponsorTopics.filter((t) => attendeeTopicIds.has(t.topicId));
          return { sponsor, overlap: overlapping.length, overlapping, hasInfoRequest: sponsorsWithInfoRequest.has(sponsor.id) };
        })
    );

    const results = scoredSponsors
      .filter((s) => s.overlap > 0)
      .sort((a, b) => b.overlap - a.overlap)
      .slice(0, 3)
      .map(({ sponsor, overlap, overlapping }) => ({
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl,
        shortDescription: sponsor.shortDescription,
        overlapScore: overlap,
        overlapTopicLabels: overlapping.map((t) => topicLabelMap.get(t.topicId) ?? "").filter(Boolean),
      }));

    return res.json(results);
  });

  // Admin: generate concierge link for an attendee
  app.post("/api/admin/attendees/:id/generate-concierge-link", requireAuth, async (req, res) => {
    const attendee = await storage.getAttendee(req.params.id);
    if (!attendee) return res.status(404).json({ message: "Attendee not found" });
    const eventId = attendee.assignedEvent;
    if (!eventId) return res.status(400).json({ message: "Attendee is not assigned to an event" });
    const tokenRecord = await storage.createAttendeeToken(attendee.id, eventId);
    const BASE_APP_URL = process.env.BASE_APP_URL ?? "https://concierge.convergeevents.com";
    const link = `${BASE_APP_URL}/attendee-access/${tokenRecord.token}`;
    return res.json({ ok: true, token: tokenRecord.token, link });
  });

  // Admin: check saved session count for an attendee
  app.get("/api/admin/attendees/:id/saved-session-count", requireAuth, async (req, res) => {
    const attendee = await storage.getAttendee(req.params.id);
    if (!attendee) return res.status(404).json({ message: "Attendee not found" });
    const eventId = attendee.assignedEvent;
    if (!eventId) return res.json({ count: 0 });
    const count = await storage.countAttendeeSavedSessions(attendee.id, eventId);
    return res.json({ count });
  });

  // Admin: batch saved-session counts for multiple attendees (POST body: { attendeeIds[], eventId })
  app.post("/api/admin/attendees/saved-session-counts-batch", requireAuth, async (req, res) => {
    const { attendeeIds, eventId } = req.body as { attendeeIds: string[]; eventId?: string };
    if (!Array.isArray(attendeeIds) || attendeeIds.length === 0) return res.json({});
    const counts: Record<string, number> = {};
    await Promise.all(
      attendeeIds.map(async (id) => {
        let eid = eventId;
        if (!eid) {
          const att = await storage.getAttendee(id);
          eid = att?.assignedEvent ?? undefined;
        }
        counts[id] = eid ? await storage.countAttendeeSavedSessions(id, eid) : 0;
      }),
    );
    return res.json(counts);
  });

  // Admin: view saved sessions for an attendee
  app.get("/api/admin/attendees/:id/saved-sessions", requireAuth, async (req, res) => {
    const attendee = await storage.getAttendee(req.params.id);
    if (!attendee) return res.status(404).json({ message: "Attendee not found" });
    const eventId = attendee.assignedEvent;
    if (!eventId) return res.json([]);
    const saved = await storage.getAttendeeSavedSessions(attendee.id, eventId);
    const sessionTypes = await storage.getSessionTypes();
    const typeMap = new Map(sessionTypes.map((t) => [t.key, t]));
    const result = await Promise.all(
      saved.map(async (s) => {
        const session = await storage.getAgendaSession(s.sessionId);
        if (!session) return null;
        const speakers = await storage.getSessionSpeakers(session.id);
        const typeInfo = session.sessionTypeKey ? typeMap.get(session.sessionTypeKey) : null;
        return {
          savedId: s.id,
          savedAt: s.createdAt,
          ...session,
          speakers,
          sessionTypeLabel: typeInfo?.label ?? session.sessionTypeKey ?? "Session",
          speakerLabelPlural: typeInfo?.speakerLabelPlural ?? "Speakers",
        };
      }),
    );
    return res.json(result.filter(Boolean));
  });

  // ── Attendee Portal: Sponsors + Interactions (Phase C) ──────────────────

  // Full sponsor directory for the attendee's event with relevance scoring
  app.get("/api/attendee-portal/sponsors", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [attendeeTopics, allSponsors, eventTopics] = await Promise.all([
      storage.getAttendeeTopics(tokenRecord.attendeeId, tokenRecord.eventId),
      storage.getSponsors(),
      storage.getEventInterestTopics(tokenRecord.eventId),
    ]);

    const attendeeTopicIds = new Set(attendeeTopics.map((t) => t.topicId));
    const topicLabelMap = new Map(eventTopics.map((t: any) => [t.id, t.topicLabel]));

    const eventSponsors = allSponsors.filter(
      (s) =>
        s.archiveState !== "archived" &&
        (s.assignedEvents ?? []).some(
          (link: any) => link.eventId === tokenRecord.eventId && link.archiveState !== "archived"
        )
    );

    const scored = await Promise.all(
      eventSponsors.map(async (sponsor) => {
        const sponsorTopics = await storage.getSponsorTopics(sponsor.id, tokenRecord.eventId);
        const overlapTopics = sponsorTopics.filter((t) => attendeeTopicIds.has(t.topicId));
        return {
          id: sponsor.id,
          name: sponsor.name,
          logoUrl: sponsor.logoUrl ?? null,
          level: sponsor.level ?? null,
          shortDescription: sponsor.shortDescription ?? null,
          websiteUrl: sponsor.websiteUrl ?? null,
          linkedinUrl: sponsor.linkedinUrl ?? null,
          solutionsSummary: sponsor.solutionsSummary ?? null,
          overlapScore: overlapTopics.length,
          overlapTopicLabels: overlapTopics.map((t) => topicLabelMap.get(t.topicId) ?? "").filter(Boolean),
          topicIds: sponsorTopics.map((t) => t.topicId),
          topicLabels: sponsorTopics.map((t) => ({ id: t.topicId, label: topicLabelMap.get(t.topicId) ?? "" })),
        };
      })
    );

    scored.sort((a, b) => b.overlapScore - a.overlapScore);
    return res.json(scored);
  });

  // Attendee's existing sponsor interactions (meetings + info requests) by sponsorId
  app.get("/api/attendee-portal/sponsor-interactions", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [allMeetings, allInfoRequests] = await Promise.all([
      storage.getMeetings(),
      storage.listInformationRequests({ eventId: tokenRecord.eventId }),
    ]);

    const meetings: Record<string, { status: string; meetingId: string }> = {};
    for (const m of allMeetings) {
      if (
        m.attendeeId === tokenRecord.attendeeId &&
        m.eventId === tokenRecord.eventId &&
        m.archiveState !== "archived"
      ) {
        meetings[m.sponsorId] = { status: m.status, meetingId: m.id };
      }
    }

    const infoRequests: Record<string, { status: string; requestId: string }> = {};
    for (const ir of allInfoRequests) {
      if (ir.attendeeId === tokenRecord.attendeeId) {
        infoRequests[ir.sponsorId] = { status: ir.status, requestId: ir.id };
      }
    }

    return res.json({ meetings, infoRequests });
  });

  // Request a meeting with a sponsor (attendee-initiated, idempotent)
  app.post("/api/attendee-portal/request-meeting", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const { sponsorId } = req.body as { sponsorId: string };
    if (!sponsorId) return res.status(400).json({ message: "sponsorId required" });

    const sponsor = await storage.getSponsor(sponsorId);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });

    // Idempotency: check for existing active meeting
    const allMeetings = await storage.getMeetings();
    const existing = allMeetings.find(
      (m) =>
        m.attendeeId === tokenRecord.attendeeId &&
        m.sponsorId === sponsorId &&
        m.eventId === tokenRecord.eventId &&
        m.archiveState !== "archived" &&
        !["Cancelled", "Declined"].includes(m.status)
    );
    if (existing) return res.json({ ok: true, meeting: existing, alreadyExisted: true });

    // Create online_request meeting (date/time are placeholders — admin follows up)
    const today = new Date().toISOString().split("T")[0];
    const meeting = await storage.createMeeting({
      eventId: tokenRecord.eventId,
      sponsorId,
      attendeeId: tokenRecord.attendeeId,
      meetingType: "online_request",
      status: "Pending",
      date: today,
      time: "09:00",
      location: "Online",
      source: "public",
    });

    return res.status(201).json({ ok: true, meeting, alreadyExisted: false });
  });

  // Request information from a sponsor (attendee-initiated, idempotent)
  app.post("/api/attendee-portal/request-info", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const { sponsorId } = req.body as { sponsorId: string };
    if (!sponsorId) return res.status(400).json({ message: "sponsorId required" });

    const [sponsor, attendee] = await Promise.all([
      storage.getSponsor(sponsorId),
      storage.getAttendee(tokenRecord.attendeeId),
    ]);
    if (!sponsor) return res.status(404).json({ message: "Sponsor not found" });
    if (!attendee) return res.status(404).json({ message: "Attendee not found" });

    // Idempotency: check for existing info request
    const existing = await storage.listInformationRequests({ eventId: tokenRecord.eventId, sponsorId });
    const alreadyRequested = existing.find((ir) => ir.attendeeId === tokenRecord.attendeeId);
    if (alreadyRequested) return res.json({ ok: true, record: alreadyRequested, alreadyExisted: true });

    const record = await storage.createInformationRequest({
      eventId: tokenRecord.eventId,
      sponsorId,
      attendeeId: tokenRecord.attendeeId,
      attendeeFirstName: attendee.firstName || attendee.name?.split(" ")[0] || "",
      attendeeLastName: attendee.lastName || attendee.name?.split(" ").slice(1).join(" ") || "",
      attendeeEmail: attendee.email || "",
      attendeeCompany: attendee.company || "",
      attendeeTitle: attendee.title || "",
      consentToShareContact: true,
      source: "Attendee Concierge",
    });

    // Fire-and-forget email notifications
    ;(async () => {
      try {
        const irEvent = await storage.getEvent(tokenRecord.eventId);
        const sponsorTokens = await storage.getSponsorTokensBySponsor(sponsor.id).catch(() => []);
        const activeToken = sponsorTokens.find((t: any) => t.isActive && t.eventId === tokenRecord.eventId);
        await sendInformationRequestNotificationToSponsor(storage, null, sponsor, record, irEvent, activeToken?.token ?? null).catch(() => {});
        await sendInformationRequestConfirmationToAttendee(storage, record, sponsor, irEvent).catch(() => {});
      } catch {}
    })();

    return res.status(201).json({ ok: true, record, alreadyExisted: false });
  });

  // Attendee's meetings with sponsor name/logo enrichment
  app.get("/api/attendee-portal/meetings", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [allMeetings, allSponsors] = await Promise.all([storage.getMeetings(), storage.getSponsors()]);
    const sponsorMap = new Map(allSponsors.map((s) => [s.id, s]));

    const attendeeMeetings = allMeetings
      .filter((m) => m.attendeeId === tokenRecord.attendeeId && m.eventId === tokenRecord.eventId && m.archiveState !== "archived")
      .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
      .map((m) => {
        const sponsor = sponsorMap.get(m.sponsorId);
        return {
          id: m.id,
          sponsorId: m.sponsorId,
          sponsorName: sponsor?.name ?? "Unknown Sponsor",
          sponsorLogoUrl: sponsor?.logoUrl ?? null,
          date: m.date,
          time: m.time,
          location: m.location,
          meetingType: m.meetingType,
          status: m.status,
          source: m.source,
          notes: m.notes ?? null,
          meetingLink: m.meetingLink ?? null,
        };
      });

    return res.json(attendeeMeetings);
  });

  // Attendee accept a meeting invitation (admin-created meeting → Confirmed)
  app.post("/api/attendee-portal/meetings/:id/accept", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const meeting = await storage.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.attendeeId !== tokenRecord.attendeeId) return res.status(403).json({ message: "Forbidden" });
    if (meeting.eventId !== tokenRecord.eventId) return res.status(403).json({ message: "Forbidden" });

    const updated = await storage.updateMeeting(meeting.id, { status: "Confirmed" });
    return res.json({ ok: true, meeting: updated });
  });

  // Attendee decline a meeting invitation
  app.post("/api/attendee-portal/meetings/:id/decline", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const meeting = await storage.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.attendeeId !== tokenRecord.attendeeId) return res.status(403).json({ message: "Forbidden" });
    if (meeting.eventId !== tokenRecord.eventId) return res.status(403).json({ message: "Forbidden" });

    const updated = await storage.updateMeeting(meeting.id, { status: "Declined" });
    return res.json({ ok: true, meeting: updated });
  });

  // ICS for a single meeting (attendee)
  app.get("/api/attendee-portal/meetings/:id/ics", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const meeting = await storage.getMeeting(req.params.id);
    if (!meeting) return res.status(404).json({ message: "Meeting not found" });
    if (meeting.attendeeId !== tokenRecord.attendeeId) return res.status(403).json({ message: "Forbidden" });

    const [event, allSponsors] = await Promise.all([storage.getEvent(meeting.eventId), storage.getSponsors()]);
    const sponsor = allSponsors.find((s) => s.id === meeting.sponsorId);

    const formatDT = (date: string, time: string) => date.replace(/-/g, "") + "T" + time.replace(/:/g, "") + "00";
    // Compute endTime (+1 hour default since meetings table has no endTime column)
    const addHour = (time: string) => {
      const [h, m] = time.split(":").map(Number);
      const end = new Date(2000, 0, 1, h + 1, m);
      return `${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}`;
    };

    const summary = `Meeting – ${sponsor?.name ?? "Sponsor"} @ ${event?.name ?? "Event"}`;
    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Converge Concierge//Meeting//EN\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\n";
    ics += `DTSTART:${formatDT(meeting.date, meeting.time)}\r\n`;
    ics += `DTEND:${formatDT(meeting.date, addHour(meeting.time))}\r\n`;
    ics += `SUMMARY:${summary}\r\n`;
    if (meeting.location) ics += `LOCATION:${meeting.location}\r\n`;
    if (meeting.notes) ics += `DESCRIPTION:${meeting.notes.replace(/\n/g, "\\n").substring(0, 500)}\r\n`;
    if (meeting.meetingLink) ics += `URL:${meeting.meetingLink}\r\n`;
    ics += `UID:meeting-${meeting.id}@converge\r\n`;
    ics += "END:VEVENT\r\nEND:VCALENDAR\r\n";

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=meeting-${meeting.id}.ics`);
    return res.send(ics);
  });

  // ── Attendee Portal: Agenda (Phase B) ────────────────────────────────────

  // Full event agenda — published + public sessions with speakers + session type
  app.get("/api/attendee-portal/agenda", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [allSessions, sessionTypes] = await Promise.all([
      storage.getAgendaSessions(tokenRecord.eventId),
      storage.getSessionTypes(),
    ]);

    const typeMap = new Map(sessionTypes.map((t) => [t.key, t]));
    const publishedPublic = allSessions.filter((s) => s.status === "Published" && s.isPublic);

    const sessions = await Promise.all(
      publishedPublic.map(async (session) => {
        const speakers = await storage.getSessionSpeakers(session.id);
        const type = typeMap.get(session.sessionTypeKey);
        return {
          id: session.id,
          title: session.title,
          description: session.description,
          sessionTypeKey: session.sessionTypeKey,
          sessionTypeLabel: type?.label ?? session.sessionTypeKey,
          speakerLabelPlural: type?.speakerLabelPlural ?? "Speakers",
          sessionDate: session.sessionDate,
          startTime: session.startTime,
          endTime: session.endTime,
          timezone: session.timezone,
          locationName: session.locationName,
          locationDetails: session.locationDetails,
          sponsorId: session.sponsorId,
          sponsorName: session.sponsorNameSnapshot,
          isFeatured: session.isFeatured,
          speakers: speakers.map((sp) => ({ id: sp.id, name: sp.name, title: sp.title, company: sp.company, roleLabel: sp.roleLabel, speakerOrder: sp.speakerOrder })),
        };
      })
    );

    return res.json(sessions);
  });

  // Attendee saved sessions — with full session detail
  app.get("/api/attendee-portal/saved-sessions", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const [saved, sessionTypes] = await Promise.all([
      storage.getAttendeeSavedSessions(tokenRecord.attendeeId, tokenRecord.eventId),
      storage.getSessionTypes(),
    ]);
    const typeMap = new Map(sessionTypes.map((t) => [t.key, t]));

    const results = await Promise.all(
      saved.map(async (s) => {
        const session = await storage.getAgendaSession(s.sessionId);
        if (!session) return null;
        const speakers = await storage.getSessionSpeakers(session.id);
        const type = typeMap.get(session.sessionTypeKey);
        return {
          savedId: s.id,
          savedAt: s.savedAt,
          id: session.id,
          title: session.title,
          description: session.description,
          sessionTypeKey: session.sessionTypeKey,
          sessionTypeLabel: type?.label ?? session.sessionTypeKey,
          speakerLabelPlural: type?.speakerLabelPlural ?? "Speakers",
          sessionDate: session.sessionDate,
          startTime: session.startTime,
          endTime: session.endTime,
          timezone: session.timezone,
          locationName: session.locationName,
          locationDetails: session.locationDetails,
          sponsorId: session.sponsorId,
          sponsorName: session.sponsorNameSnapshot,
          speakers: speakers.map((sp) => ({ id: sp.id, name: sp.name, title: sp.title, company: sp.company, roleLabel: sp.roleLabel })),
        };
      })
    );

    return res.json(results.filter(Boolean));
  });

  // Save a session to My Agenda (idempotent)
  app.post("/api/attendee-portal/saved-sessions", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const { sessionId } = req.body as { sessionId: string };
    if (!sessionId) return res.status(400).json({ message: "sessionId required" });

    const session = await storage.getAgendaSession(sessionId);
    if (!session || session.eventId !== tokenRecord.eventId || session.status !== "Published") {
      return res.status(404).json({ message: "Session not found or not available" });
    }

    // Idempotent — check if already saved
    const existing = await storage.getAttendeeSavedSessions(tokenRecord.attendeeId, tokenRecord.eventId);
    const alreadySaved = existing.find((s) => s.sessionId === sessionId);
    if (alreadySaved) return res.json({ ok: true, savedId: alreadySaved.id, alreadyExisted: true });

    const saved = await storage.createAttendeeSavedSession({
      attendeeId: tokenRecord.attendeeId,
      eventId: tokenRecord.eventId,
      sessionId,
    });
    return res.json({ ok: true, savedId: saved.id, alreadyExisted: false });
  });

  // Remove a session from My Agenda by sessionId
  app.delete("/api/attendee-portal/saved-sessions/:sessionId", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const existing = await storage.getAttendeeSavedSessions(tokenRecord.attendeeId, tokenRecord.eventId);
    const record = existing.find((s) => s.sessionId === req.params.sessionId);
    if (!record) return res.status(404).json({ message: "Session not in My Agenda" });

    await storage.deleteAttendeeSavedSession(record.id);
    return res.json({ ok: true });
  });

  // Download My Agenda as combined ICS
  app.get("/api/attendee-portal/my-agenda/ics", async (req, res) => {
    const token = getAttendeeToken(req);
    if (!token) return res.status(401).json({ message: "Missing attendee token" });
    const validation = await validateAttendeeToken(token);
    if (!validation.ok) return res.status(validation.status).json({ message: validation.message });
    const { tokenRecord } = validation;

    const saved = await storage.getAttendeeSavedSessions(tokenRecord.attendeeId, tokenRecord.eventId);
    const formatDT = (date: string, time: string) => date.replace(/-/g, "") + "T" + time.replace(/:/g, "") + "00";

    let ics = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//Converge Concierge//My Agenda//EN\r\nCALSCALE:GREGORIAN\r\n";

    for (const s of saved) {
      const session = await storage.getAgendaSession(s.sessionId);
      if (!session || session.status !== "Published") continue;
      ics += "BEGIN:VEVENT\r\n";
      ics += `DTSTART;TZID=${session.timezone}:${formatDT(session.sessionDate, session.startTime)}\r\n`;
      ics += `DTEND;TZID=${session.timezone}:${formatDT(session.sessionDate, session.endTime)}\r\n`;
      ics += `SUMMARY:${session.title.replace(/\n/g, "\\n")}\r\n`;
      if (session.description) ics += `DESCRIPTION:${session.description.replace(/\n/g, "\\n").substring(0, 500)}\r\n`;
      if (session.locationName) ics += `LOCATION:${session.locationName}${session.locationDetails ? " - " + session.locationDetails : ""}\r\n`;
      ics += `UID:agenda-${session.id}@converge\r\n`;
      ics += "END:VEVENT\r\n";
    }

    ics += "END:VCALENDAR\r\n";
    const event = await storage.getEvent(tokenRecord.eventId);
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename=${event?.slug || "my-agenda"}-my-agenda.ics`);
    res.send(ics);
  });

  await refreshCategoryConfig();

  return httpServer;
}
