import { eq, and, ne, sql, desc, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { db } from "./db";
import {
  users, events, sponsors, attendees, meetings,
  sponsorTokens, sponsorNotifications, passwordResetTokens, appConfig, dataExchangeLogs,
  sponsorUsers, sponsorLoginTokens, emailTemplates,
  userPermissions, permissionAuditLogs, informationRequests, sponsorAnalytics, emailLogs,
  agreementPackageTemplates, agreementDeliverableTemplateItems, agreementDeliverables,
  agreementDeliverableRegistrants, agreementDeliverableSpeakers,
  type User, type InsertUser,
  type Event, type InsertEvent,
  type Sponsor, type InsertSponsor,
  type Attendee, type InsertAttendee,
  type Meeting, type InsertMeeting,
  type SponsorToken, type SponsorNotification, type SponsorNotificationType,
  type AppSettings, type AppBranding, type PasswordResetToken,
  type DataExchangeLog,
  type UserPermissions, type UserPermissionRecord, type PermissionAuditLog,
  type InformationRequest, type InsertInformationRequest, type InformationRequestStatus,
  type EmailLog,
  type SponsorUser, type SponsorLoginToken,
  type EmailTemplate,
  type PackageTemplate, type InsertPackageTemplate,
  type DeliverableTemplateItem, type InsertDeliverableTemplateItem,
  type AgreementDeliverable, type InsertAgreementDeliverable,
  type AgreementDeliverableRegistrant, type InsertAgreementDeliverableRegistrant,
  type AgreementDeliverableSpeaker, type InsertAgreementDeliverableSpeaker,
  DEFAULT_SETTINGS, DEFAULT_BRANDING, DEFAULT_USER_PERMISSIONS,
} from "@shared/schema";
import type { IStorage, UpdateUser, AttendeeDetail, DataExchangeLogInsert } from "./storage";

function buildFullName(firstName?: string, lastName?: string, fallback?: string): string {
  const first = (firstName ?? "").trim();
  const last = (lastName ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return fallback ?? "";
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export class DatabaseStorage implements IStorage {
  // ── Users ─────────────────────────────────────────────────────────────────

  async getUser(id: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return row;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [row] = await db.select().from(users).where(eq(users.username, username)).limit(1);
    return row;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [row] = await db
      .select()
      .from(users)
      .where(sql`lower(${users.email}) = lower(${email})`)
      .limit(1);
    return row;
  }

  async getUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const email = insertUser.email ?? "";
    const [created] = await db
      .insert(users)
      .values({
        username: email,
        password: insertUser.password,
        name: insertUser.name ?? "",
        email,
        role: (insertUser.role ?? "manager") as "admin" | "manager",
        isActive: insertUser.isActive ?? true,
      })
      .returning();
    return created;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const setData: Partial<typeof users.$inferInsert> = { ...updates };
    if (updates.email !== undefined) {
      setData.username = updates.email;
    }
    const [updated] = await db
      .update(users)
      .set(setData)
      .where(eq(users.id, id))
      .returning();
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // ── Events ────────────────────────────────────────────────────────────────

  async getEvents(): Promise<Event[]> {
    return db.select().from(events);
  }

  async getEvent(id: string): Promise<Event | undefined> {
    const [row] = await db.select().from(events).where(eq(events.id, id)).limit(1);
    return row;
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    const [row] = await db.select().from(events).where(eq(events.slug, slug)).limit(1);
    return row;
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const [created] = await db
      .insert(events)
      .values({
        ...insertEvent,
        archiveState: insertEvent.archiveState ?? "active",
        archiveSource: insertEvent.archiveSource ?? null,
        meetingLocations: insertEvent.meetingLocations ?? [],
        meetingBlocks: insertEvent.meetingBlocks ?? [],
      })
      .returning();
    return created;
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const [updated] = await db
      .update(events)
      .set(updates)
      .where(eq(events.id, id))
      .returning();
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    await db.delete(events).where(eq(events.id, id));
  }

  // ── Sponsors ──────────────────────────────────────────────────────────────

  async getSponsors(): Promise<Sponsor[]> {
    return db.select().from(sponsors);
  }

  async getSponsor(id: string): Promise<Sponsor | undefined> {
    const [row] = await db.select().from(sponsors).where(eq(sponsors.id, id)).limit(1);
    return row;
  }

  async createSponsor(insertSponsor: InsertSponsor): Promise<Sponsor> {
    const [created] = await db
      .insert(sponsors)
      .values({
        ...insertSponsor,
        archiveState: insertSponsor.archiveState ?? "active",
        archiveSource: insertSponsor.archiveSource ?? null,
        assignedEvents: insertSponsor.assignedEvents ?? [],
      })
      .returning();
    return created;
  }

  async updateSponsor(id: string, updates: Partial<InsertSponsor>): Promise<Sponsor | undefined> {
    const [updated] = await db
      .update(sponsors)
      .set(updates)
      .where(eq(sponsors.id, id))
      .returning();
    return updated;
  }

  async deleteSponsor(id: string): Promise<void> {
    await db.delete(sponsors).where(eq(sponsors.id, id));
  }

  // ── Attendees ─────────────────────────────────────────────────────────────

  async getAttendees(): Promise<Attendee[]> {
    return db.select().from(attendees);
  }

  async getAttendee(id: string): Promise<Attendee | undefined> {
    const [row] = await db.select().from(attendees).where(eq(attendees.id, id)).limit(1);
    return row;
  }

  async getAttendeeByEmail(email: string): Promise<Attendee | undefined> {
    const [row] = await db
      .select()
      .from(attendees)
      .where(sql`lower(${attendees.email}) = lower(${email})`)
      .limit(1);
    return row;
  }

  async getAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined> {
    const [row] = await db
      .select()
      .from(attendees)
      .where(
        and(
          sql`lower(${attendees.email}) = lower(${email})`,
          eq(attendees.assignedEvent, eventId),
          eq(attendees.archiveState, "active")
        )
      )
      .limit(1);
    return row;
  }

  async getArchivedAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined> {
    const [row] = await db
      .select()
      .from(attendees)
      .where(
        and(
          sql`lower(${attendees.email}) = lower(${email})`,
          eq(attendees.assignedEvent, eventId),
          eq(attendees.archiveState, "archived")
        )
      )
      .limit(1);
    return row;
  }

  async createAttendee(insertAttendee: InsertAttendee): Promise<Attendee> {
    let { firstName, lastName, name } = insertAttendee as any;
    if (!firstName && !lastName && name) {
      const split = splitName(name);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    const computedName = buildFullName(firstName, lastName, name);
    const [created] = await db
      .insert(attendees)
      .values({
        archiveState: "active",
        archiveSource: null,
        ...insertAttendee,
        firstName: firstName ?? "",
        lastName: lastName ?? "",
        name: computedName,
      })
      .returning();
    return created;
  }

  async updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined> {
    const existing = await this.getAttendee(id);
    if (!existing) return undefined;

    const merged = { ...existing, ...updates } as any;
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      merged.name = buildFullName(merged.firstName, merged.lastName, merged.name);
      updates = { ...updates, name: merged.name };
    }

    const [updated] = await db
      .update(attendees)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(attendees.id, id))
      .returning();
    return updated;
  }

  async deleteAttendee(id: string): Promise<void> {
    await db.delete(attendees).where(eq(attendees.id, id));
  }

  async getAttendeeWithDetail(id: string): Promise<AttendeeDetail | undefined> {
    const attendee = await this.getAttendee(id);
    if (!attendee) return undefined;

    const event = await this.getEvent(attendee.assignedEvent);
    const allMeetings = await db.select().from(meetings).where(eq(meetings.attendeeId, id));

    const meetingsList = await Promise.all(
      allMeetings.map(async (m) => {
        const [sponsor] = await db.select().from(sponsors).where(eq(sponsors.id, m.sponsorId)).limit(1);
        const [ev] = await db.select().from(events).where(eq(events.id, m.eventId)).limit(1);
        return {
          id: m.id,
          sponsorId: m.sponsorId,
          sponsorName: sponsor?.name ?? "Unknown",
          eventId: m.eventId,
          eventName: ev?.name ?? "",
          eventSlug: ev?.slug ?? "",
          date: m.date,
          time: m.time,
          meetingType: m.meetingType,
          status: m.status,
          location: m.location,
          platform: m.platform ?? null,
          source: m.source,
        };
      })
    );

    return {
      ...attendee,
      eventName: event?.name ?? "",
      eventSlug: event?.slug ?? "",
      meetingsList,
    };
  }

  async mergeAttendeeInterests(id: string, newInterests: string[]): Promise<void> {
    const existing = await this.getAttendee(id);
    if (!existing || newInterests.length === 0) return;
    const merged = Array.from(new Set([...(existing.interests ?? []), ...newInterests]));
    await db
      .update(attendees)
      .set({ interests: merged, updatedAt: new Date() })
      .where(eq(attendees.id, id));
  }

  // ── Meetings ──────────────────────────────────────────────────────────────

  async getMeetings(): Promise<Meeting[]> {
    return db.select().from(meetings);
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [row] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    return row;
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const [created] = await db
      .insert(meetings)
      .values({
        archiveState: "active",
        archiveSource: null,
        ...insertMeeting,
      })
      .returning();
    return created;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [updated] = await db
      .update(meetings)
      .set(updates)
      .where(eq(meetings.id, id))
      .returning();
    return updated;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  async getMeetingConflict(eventId: string, sponsorId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    const conditions = [
      eq(meetings.eventId, eventId),
      eq(meetings.sponsorId, sponsorId),
      eq(meetings.date, date),
      eq(meetings.time, time),
      ne(meetings.status, "Cancelled"),
      ne(meetings.status, "NoShow"),
      ne(meetings.archiveState, "archived"),
    ];
    if (excludeId) {
      conditions.push(ne(meetings.id, excludeId));
    }
    const [row] = await db
      .select()
      .from(meetings)
      .where(and(...conditions))
      .limit(1);
    return row;
  }

  async getAttendeeConflict(eventId: string, attendeeId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    const conditions = [
      eq(meetings.eventId, eventId),
      eq(meetings.attendeeId, attendeeId),
      eq(meetings.date, date),
      eq(meetings.time, time),
      ne(meetings.status, "Cancelled"),
      ne(meetings.status, "NoShow"),
      ne(meetings.archiveState, "archived"),
    ];
    if (excludeId) conditions.push(ne(meetings.id, excludeId));
    const [row] = await db.select().from(meetings).where(and(...conditions)).limit(1);
    return row;
  }

  async getLocationConflict(eventId: string, location: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    const conditions = [
      eq(meetings.eventId, eventId),
      eq(meetings.location, location),
      eq(meetings.date, date),
      eq(meetings.time, time),
      ne(meetings.status, "Cancelled"),
      ne(meetings.status, "NoShow"),
      ne(meetings.archiveState, "archived"),
    ];
    if (excludeId) conditions.push(ne(meetings.id, excludeId));
    const [row] = await db.select().from(meetings).where(and(...conditions)).limit(1);
    return row;
  }

  async updateMeetingReminderFlags(id: string, flags: { reminder24SentAt?: Date; reminder2SentAt?: Date }): Promise<void> {
    const updates: Record<string, any> = {};
    if (flags.reminder24SentAt !== undefined) updates.reminder24SentAt = flags.reminder24SentAt;
    if (flags.reminder2SentAt !== undefined) updates.reminder2SentAt = flags.reminder2SentAt;
    if (Object.keys(updates).length === 0) return;
    await db.update(meetings).set(updates).where(eq(meetings.id, id));
  }

  async getMeetingsDueForReminders(): Promise<Meeting[]> {
    const now = new Date();
    const plus23_5h = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const plus24_5h = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    const plus1_5h = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const plus2_5h = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    const allMeetings = await db.select().from(meetings)
      .where(and(
        ne(meetings.status, "Cancelled"),
        ne(meetings.status, "NoShow"),
        ne(meetings.archiveState, "archived"),
      ));

    return allMeetings.filter((m) => {
      if (!m.date || !m.time) return false;
      const meetingDt = new Date(`${m.date}T${m.time}`);
      if (isNaN(meetingDt.getTime())) return false;
      const needs24 = !m.reminder24SentAt && meetingDt >= plus23_5h && meetingDt <= plus24_5h;
      const needs2 = !m.reminder2SentAt && meetingDt >= plus1_5h && meetingDt <= plus2_5h;
      return needs24 || needs2;
    });
  }

  async cascadeArchiveEvent(eventId: string): Promise<void> {
    await db
      .update(attendees)
      .set({ archiveState: "archived", archiveSource: "event" })
      .where(and(eq(attendees.assignedEvent, eventId), eq(attendees.archiveState, "active")));

    await db
      .update(meetings)
      .set({ archiveState: "archived", archiveSource: "event" })
      .where(and(eq(meetings.eventId, eventId), ne(meetings.archiveState, "archived")));

    const allSponsors = await db.select().from(sponsors);
    for (const sponsor of allSponsors) {
      const links = sponsor.assignedEvents ?? [];
      const hasActiveLink = links.some((ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active");
      if (hasActiveLink) {
        const updatedLinks = links.map((ae) =>
          ae.eventId === eventId && (ae.archiveState ?? "active") === "active"
            ? { ...ae, archiveState: "archived" as const, archiveSource: "event" as const }
            : ae
        );
        await db.update(sponsors).set({ assignedEvents: updatedLinks }).where(eq(sponsors.id, sponsor.id));
      }
    }
  }

  async cascadeUnarchiveEvent(eventId: string): Promise<void> {
    await db
      .update(attendees)
      .set({ archiveState: "active", archiveSource: null })
      .where(and(eq(attendees.assignedEvent, eventId), eq(attendees.archiveSource, "event")));

    await db
      .update(meetings)
      .set({ archiveState: "active", archiveSource: null })
      .where(and(eq(meetings.eventId, eventId), eq(meetings.archiveSource, "event")));

    const allSponsors = await db.select().from(sponsors);
    for (const sponsor of allSponsors) {
      const links = sponsor.assignedEvents ?? [];
      const hasEventLink = links.some((ae) => ae.eventId === eventId && ae.archiveSource === "event");
      if (hasEventLink) {
        const updatedLinks = links.map((ae) =>
          ae.eventId === eventId && ae.archiveSource === "event"
            ? { ...ae, archiveState: "active" as const, archiveSource: null }
            : ae
        );
        await db.update(sponsors).set({ assignedEvents: updatedLinks }).where(eq(sponsors.id, sponsor.id));
      }
    }
  }

  // ── Sponsor Tokens ────────────────────────────────────────────────────────

  async getSponsorToken(token: string): Promise<SponsorToken | undefined> {
    const [row] = await db
      .select()
      .from(sponsorTokens)
      .where(eq(sponsorTokens.token, token))
      .limit(1);
    return row ?? undefined;
  }

  async getSponsorTokensBySponsor(sponsorId: string): Promise<SponsorToken[]> {
    return db.select().from(sponsorTokens).where(eq(sponsorTokens.sponsorId, sponsorId));
  }

  async createSponsorToken(sponsorId: string, eventId: string): Promise<SponsorToken> {
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 90);

    const [created] = await db
      .insert(sponsorTokens)
      .values({ token, sponsorId, eventId, isActive: true, expiresAt, createdAt: now })
      .returning();
    return created;
  }

  async revokeSponsorToken(token: string): Promise<SponsorToken | undefined> {
    const [updated] = await db
      .update(sponsorTokens)
      .set({ isActive: false })
      .where(eq(sponsorTokens.token, token))
      .returning();
    return updated ?? undefined;
  }

  async deleteSponsorToken(token: string): Promise<void> {
    await db.delete(sponsorTokens).where(eq(sponsorTokens.token, token));
  }

  // ── Sponsor Notifications ─────────────────────────────────────────────────

  async createNotification(n: Omit<SponsorNotification, "id" | "createdAt">): Promise<SponsorNotification> {
    const [created] = await db
      .insert(sponsorNotifications)
      .values({
        ...n,
        type: n.type as string,
        createdAt: new Date(),
      })
      .returning();
    return {
      ...created,
      type: created.type as SponsorNotificationType,
    };
  }

  async getNotificationsForSponsorEvent(sponsorId: string, eventId: string): Promise<SponsorNotification[]> {
    const rows = await db
      .select()
      .from(sponsorNotifications)
      .where(and(eq(sponsorNotifications.sponsorId, sponsorId), eq(sponsorNotifications.eventId, eventId)))
      .orderBy(desc(sponsorNotifications.createdAt));
    return rows.map((r) => ({ ...r, type: r.type as SponsorNotificationType }));
  }

  async markNotificationRead(id: string): Promise<void> {
    await db
      .update(sponsorNotifications)
      .set({ isRead: true })
      .where(eq(sponsorNotifications.id, id));
  }

  async markAllNotificationsRead(sponsorId: string, eventId: string): Promise<void> {
    await db
      .update(sponsorNotifications)
      .set({ isRead: true })
      .where(
        and(
          eq(sponsorNotifications.sponsorId, sponsorId),
          eq(sponsorNotifications.eventId, eventId),
          eq(sponsorNotifications.isRead, false)
        )
      );
  }

  // ── App Settings ──────────────────────────────────────────────────────────

  async getSettings(): Promise<AppSettings> {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "settings")).limit(1);
    if (!row) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(row.value as Partial<AppSettings>) };
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    const current = await this.getSettings();
    const merged = { ...current, ...updates };
    await db
      .insert(appConfig)
      .values({ key: "settings", value: merged })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: merged } });
    return merged;
  }

  // ── App Branding ──────────────────────────────────────────────────────────

  async getBranding(): Promise<AppBranding> {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "branding")).limit(1);
    if (!row) return { ...DEFAULT_BRANDING };
    return { ...DEFAULT_BRANDING, ...(row.value as Partial<AppBranding>) };
  }

  async updateBranding(updates: Partial<AppBranding>): Promise<AppBranding> {
    const current = await this.getBranding();
    const merged = { ...current, ...updates };
    await db
      .insert(appConfig)
      .values({ key: "branding", value: merged })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: merged } });
    return merged;
  }

  // ── Password Reset Tokens ─────────────────────────────────────────────────

  async createPasswordResetToken(userId: string): Promise<PasswordResetToken> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(and(eq(passwordResetTokens.userId, userId), eq(passwordResetTokens.used, false)));

    const token = randomBytes(32).toString("hex");
    const expiresAt = Date.now() + 60 * 60 * 1000;

    await db.insert(passwordResetTokens).values({ token, userId, expiresAt, used: false });
    return { token, userId, expiresAt, used: false };
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    return row ?? undefined;
  }

  async markResetTokenUsed(token: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.token, token));
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    await db.update(users).set({ password: newPassword }).where(eq(users.id, userId));
  }

  // ── Data Exchange Logs ────────────────────────────────────────────────────

  async createDataExchangeLog(data: DataExchangeLogInsert): Promise<DataExchangeLog> {
    const [created] = await db
      .insert(dataExchangeLogs)
      .values({
        category: data.category,
        operation: data.operation,
        adminUser: data.adminUser,
        fileName: data.fileName ?? null,
        eventId: data.eventId ?? null,
        eventCode: data.eventCode ?? null,
        totalRows: data.totalRows,
        importedCount: data.importedCount,
        updatedCount: data.updatedCount,
        rejectedCount: data.rejectedCount,
      })
      .returning();
    return created;
  }

  async getDataExchangeLogs(): Promise<DataExchangeLog[]> {
    return db.select().from(dataExchangeLogs).orderBy(desc(dataExchangeLogs.createdAt));
  }

  // ── Nunify Meeting Sync ────────────────────────────────────────────────────

  async markMeetingsNunifyExported(meetingIds: string[], adminUser: string): Promise<void> {
    if (meetingIds.length === 0) return;
    await db
      .update(meetings)
      .set({ nunifyExportedAt: new Date(), nunifyExportedBy: adminUser })
      .where(inArray(meetings.id, meetingIds));
  }

  // ── User Permissions ──────────────────────────────────────────────────────

  async getUserPermissions(userId: string): Promise<UserPermissionRecord | undefined> {
    const [row] = await db
      .select()
      .from(userPermissions)
      .where(eq(userPermissions.userId, userId))
      .limit(1);
    return row ?? undefined;
  }

  async upsertUserPermissions(
    userId: string,
    permissions: UserPermissions,
    changedBy: string,
    targetUserName: string,
    previousPermissions?: UserPermissions
  ): Promise<UserPermissionRecord> {
    // Write audit log entries for changed fields
    const prev = previousPermissions ?? DEFAULT_USER_PERMISSIONS;
    const auditEntries: typeof permissionAuditLogs.$inferInsert[] = [];
    for (const key of Object.keys(permissions) as (keyof UserPermissions)[]) {
      if (prev[key] !== permissions[key]) {
        auditEntries.push({
          id: randomUUID(),
          targetUserId: userId,
          targetUserName,
          changedBy,
          field: key,
          oldValue: String(prev[key]),
          newValue: String(permissions[key]),
          changedAt: new Date(),
        });
      }
    }
    if (auditEntries.length > 0) {
      await db.insert(permissionAuditLogs).values(auditEntries);
    }

    const [upserted] = await db
      .insert(userPermissions)
      .values({ userId, permissions, updatedAt: new Date(), updatedBy: changedBy })
      .onConflictDoUpdate({
        target: userPermissions.userId,
        set: { permissions, updatedAt: new Date(), updatedBy: changedBy },
      })
      .returning();
    return upserted;
  }

  async getPermissionAuditLogs(userId?: string): Promise<PermissionAuditLog[]> {
    if (userId) {
      return db
        .select()
        .from(permissionAuditLogs)
        .where(eq(permissionAuditLogs.targetUserId, userId))
        .orderBy(desc(permissionAuditLogs.changedAt))
        .limit(500);
    }
    return db
      .select()
      .from(permissionAuditLogs)
      .orderBy(desc(permissionAuditLogs.changedAt))
      .limit(500);
  }

  async createInformationRequest(data: InsertInformationRequest): Promise<InformationRequest> {
    const [record] = await db
      .insert(informationRequests)
      .values({
        ...data,
        id: randomUUID(),
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();
    return record;
  }

  async getInformationRequest(id: string): Promise<InformationRequest | undefined> {
    const [row] = await db
      .select()
      .from(informationRequests)
      .where(eq(informationRequests.id, id))
      .limit(1);
    return row ?? undefined;
  }

  async listInformationRequests(filters?: { eventId?: string; sponsorId?: string; status?: InformationRequestStatus }): Promise<InformationRequest[]> {
    const conditions = [];
    if (filters?.eventId) conditions.push(eq(informationRequests.eventId, filters.eventId));
    if (filters?.sponsorId) conditions.push(eq(informationRequests.sponsorId, filters.sponsorId));
    if (filters?.status) conditions.push(eq(informationRequests.status, filters.status));

    const query = db.select().from(informationRequests);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(informationRequests.createdAt));
    }
    return query.orderBy(desc(informationRequests.createdAt));
  }

  async updateInformationRequestStatus(id: string, status: InformationRequestStatus): Promise<InformationRequest | undefined> {
    const [updated] = await db
      .update(informationRequests)
      .set({ status, updatedAt: new Date() })
      .where(eq(informationRequests.id, id))
      .returning();
    return updated ?? undefined;
  }

  async createAnalyticsEvent(data: { sponsorId: string; eventId: string; eventType: string }): Promise<void> {
    await db.insert(sponsorAnalytics).values({
      id: randomUUID(),
      sponsorId: data.sponsorId,
      eventId: data.eventId,
      eventType: data.eventType,
      createdAt: new Date(),
    });
  }

  async getAnalyticsSummary(sponsorId: string, eventId: string): Promise<{ profileViews: number; meetingCtaClicks: number }> {
    const rows = await db
      .select()
      .from(sponsorAnalytics)
      .where(and(eq(sponsorAnalytics.sponsorId, sponsorId), eq(sponsorAnalytics.eventId, eventId)));
    return {
      profileViews: rows.filter((r) => r.eventType === "profile_view").length,
      meetingCtaClicks: rows.filter((r) => r.eventType === "meeting_cta_click").length,
    };
  }

  // ── Sponsor Users & Magic Login ───────────────────────────────────────────

  async upsertSponsorUser(data: { sponsorId: string; name: string; email: string; accessLevel?: string; isPrimary?: boolean }): Promise<SponsorUser> {
    const normalizedEmail = data.email.toLowerCase().trim();
    const existing = await db.select().from(sponsorUsers).where(eq(sponsorUsers.email, normalizedEmail)).limit(1);
    if (existing[0]) {
      const [updated] = await db.update(sponsorUsers)
        .set({ sponsorId: data.sponsorId, name: data.name || existing[0].name, updatedAt: new Date() })
        .where(eq(sponsorUsers.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(sponsorUsers).values({
      id: randomUUID(),
      sponsorId: data.sponsorId,
      name: data.name,
      email: normalizedEmail,
      accessLevel: data.accessLevel ?? "owner",
      isPrimary: data.isPrimary ?? false,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async getSponsorUserByEmail(email: string): Promise<SponsorUser | undefined> {
    const [row] = await db.select().from(sponsorUsers).where(eq(sponsorUsers.email, email.toLowerCase().trim())).limit(1);
    return row;
  }

  async getSponsorUsersBySponsor(sponsorId: string): Promise<SponsorUser[]> {
    return db.select().from(sponsorUsers).where(eq(sponsorUsers.sponsorId, sponsorId)).orderBy(sponsorUsers.createdAt);
  }

  async getSponsorUserById(id: string): Promise<SponsorUser | undefined> {
    const [row] = await db.select().from(sponsorUsers).where(eq(sponsorUsers.id, id)).limit(1);
    return row;
  }

  async createSponsorUser(data: { sponsorId: string; name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }): Promise<SponsorUser> {
    const [row] = await db.insert(sponsorUsers).values({
      id: randomUUID(),
      sponsorId: data.sponsorId,
      name: data.name,
      email: data.email.toLowerCase().trim(),
      accessLevel: data.accessLevel,
      isPrimary: data.isPrimary,
      isActive: data.isActive,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateSponsorUser(id: string, data: Partial<{ name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }>): Promise<SponsorUser> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.email !== undefined) updates.email = data.email.toLowerCase().trim();
    if (data.accessLevel !== undefined) updates.accessLevel = data.accessLevel;
    if (data.isPrimary !== undefined) updates.isPrimary = data.isPrimary;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    const [row] = await db.update(sponsorUsers).set(updates).where(eq(sponsorUsers.id, id)).returning();
    return row;
  }

  async setSponsorUserPrimary(id: string, sponsorId: string): Promise<void> {
    await db.update(sponsorUsers).set({ isPrimary: false, updatedAt: new Date() }).where(eq(sponsorUsers.sponsorId, sponsorId));
    await db.update(sponsorUsers).set({ isPrimary: true, updatedAt: new Date() }).where(eq(sponsorUsers.id, id));
  }

  async deleteSponsorUser(id: string): Promise<void> {
    await db.delete(sponsorUsers).where(eq(sponsorUsers.id, id));
  }

  async updateSponsorUserLastLogin(id: string): Promise<void> {
    await db.update(sponsorUsers).set({ lastLoginAt: new Date(), updatedAt: new Date() }).where(eq(sponsorUsers.id, id));
  }

  async getEmailTemplates(): Promise<EmailTemplate[]> {
    return db.select().from(emailTemplates).orderBy(emailTemplates.displayName);
  }

  async getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined> {
    const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, key)).limit(1);
    return row;
  }

  async getEmailTemplateById(id: string): Promise<EmailTemplate | undefined> {
    const [row] = await db.select().from(emailTemplates).where(eq(emailTemplates.id, id)).limit(1);
    return row;
  }

  async upsertEmailTemplate(data: { templateKey: string; displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate?: string | null; description?: string | null; variables?: string[]; isActive?: boolean }): Promise<EmailTemplate> {
    const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, data.templateKey)).limit(1);
    if (existing[0]) {
      const [updated] = await db.update(emailTemplates)
        .set({ displayName: data.displayName, subjectTemplate: data.subjectTemplate, description: data.description ?? null, variables: data.variables ?? existing[0].variables, isActive: data.isActive ?? existing[0].isActive, updatedAt: new Date() })
        .where(eq(emailTemplates.id, existing[0].id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(emailTemplates).values({
      id: randomUUID(),
      templateKey: data.templateKey,
      displayName: data.displayName,
      subjectTemplate: data.subjectTemplate,
      htmlTemplate: data.htmlTemplate,
      textTemplate: data.textTemplate ?? null,
      description: data.description ?? null,
      variables: data.variables ?? [],
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return created;
  }

  async updateEmailTemplate(id: string, data: Partial<{ displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate: string | null; description: string | null; isActive: boolean }>): Promise<EmailTemplate> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.subjectTemplate !== undefined) updates.subjectTemplate = data.subjectTemplate;
    if (data.htmlTemplate !== undefined) updates.htmlTemplate = data.htmlTemplate;
    if (data.textTemplate !== undefined) updates.textTemplate = data.textTemplate;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    const [row] = await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, id)).returning();
    return row;
  }

  async createSponsorLoginToken(data: { sponsorUserId: string; sponsorId: string; tokenHash: string; expiresAt: Date }): Promise<SponsorLoginToken> {
    const [row] = await db.insert(sponsorLoginTokens).values({
      id: randomUUID(),
      sponsorUserId: data.sponsorUserId,
      sponsorId: data.sponsorId,
      tokenHash: data.tokenHash,
      expiresAt: data.expiresAt,
      usedAt: null,
      createdAt: new Date(),
    }).returning();
    return row;
  }

  async getSponsorLoginTokenByHash(tokenHash: string): Promise<SponsorLoginToken | undefined> {
    const [row] = await db.select().from(sponsorLoginTokens).where(eq(sponsorLoginTokens.tokenHash, tokenHash)).limit(1);
    return row;
  }

  async markSponsorLoginTokenUsed(id: string): Promise<void> {
    await db.update(sponsorLoginTokens).set({ usedAt: new Date() }).where(eq(sponsorLoginTokens.id, id));
  }

  async invalidateSponsorLoginTokens(sponsorUserId: string): Promise<void> {
    await db.update(sponsorLoginTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(sponsorLoginTokens.sponsorUserId, sponsorUserId), sql`used_at IS NULL`));
  }

  async createEmailLog(data: { emailType: string; recipientEmail: string; subject: string; htmlContent?: string | null; eventId?: string | null; sponsorId?: string | null; attendeeId?: string | null; status: "sent" | "failed"; errorMessage?: string | null; resendOfId?: string | null; providerMessageId?: string | null }): Promise<string> {
    const id = randomUUID();
    await db.insert(emailLogs).values({
      id,
      emailType: data.emailType,
      recipientEmail: data.recipientEmail,
      subject: data.subject,
      htmlContent: data.htmlContent ?? null,
      eventId: data.eventId ?? null,
      sponsorId: data.sponsorId ?? null,
      attendeeId: data.attendeeId ?? null,
      status: data.status,
      errorMessage: data.errorMessage ?? null,
      resendOfId: data.resendOfId ?? null,
      sentAt: new Date(),
      createdAt: new Date(),
      providerMessageId: data.providerMessageId ?? null,
    });
    return id;
  }

  async getEmailLogByProviderMessageId(providerMessageId: string): Promise<import("@shared/schema").EmailLog | undefined> {
    const rows = await db.select().from(emailLogs).where(eq(emailLogs.providerMessageId, providerMessageId)).limit(1);
    return rows[0];
  }

  async updateEmailLogDelivery(id: string, updates: { status?: string; deliveredAt?: Date; openedAt?: Date; clickedAt?: Date; bouncedAt?: Date; bounceReason?: string; providerStatus?: string }): Promise<void> {
    const set: Record<string, any> = {};
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.deliveredAt !== undefined) set.deliveredAt = updates.deliveredAt;
    if (updates.openedAt !== undefined) set.openedAt = updates.openedAt;
    if (updates.clickedAt !== undefined) set.clickedAt = updates.clickedAt;
    if (updates.bouncedAt !== undefined) set.bouncedAt = updates.bouncedAt;
    if (updates.bounceReason !== undefined) set.bounceReason = updates.bounceReason;
    if (updates.providerStatus !== undefined) set.providerStatus = updates.providerStatus;
    if (Object.keys(set).length > 0) {
      await db.update(emailLogs).set(set).where(eq(emailLogs.id, id));
    }
  }

  async listEmailLogs(filters?: { emailType?: string; status?: string; eventId?: string; search?: string; from?: Date; to?: Date }, limit = 100, offset = 0): Promise<EmailLog[]> {
    const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt));
    return rows.filter((r) => {
      if (filters?.emailType && r.emailType !== filters.emailType) return false;
      if (filters?.status && r.status !== filters.status) return false;
      if (filters?.eventId && r.eventId !== filters.eventId) return false;
      if (filters?.from && r.sentAt < filters.from) return false;
      if (filters?.to && r.sentAt > filters.to) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        if (!r.recipientEmail.toLowerCase().includes(q) && !r.subject.toLowerCase().includes(q) && !r.emailType.toLowerCase().includes(q)) return false;
      }
      return true;
    }).slice(offset, offset + limit);
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    const rows = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
    return rows[0];
  }

  // ── Agreement Package Templates ────────────────────────────────────────────

  async listPackageTemplates(filters?: { sponsorshipLevel?: string; isArchived?: boolean }): Promise<PackageTemplate[]> {
    const rows = await db.select().from(agreementPackageTemplates).orderBy(agreementPackageTemplates.sponsorshipLevel, agreementPackageTemplates.packageName);
    return rows.filter((r) => {
      if (filters?.sponsorshipLevel && r.sponsorshipLevel !== filters.sponsorshipLevel) return false;
      if (filters?.isArchived !== undefined && r.isArchived !== filters.isArchived) return false;
      return true;
    });
  }

  async getPackageTemplate(id: string): Promise<PackageTemplate | undefined> {
    const [row] = await db.select().from(agreementPackageTemplates).where(eq(agreementPackageTemplates.id, id)).limit(1);
    return row;
  }

  async createPackageTemplate(data: InsertPackageTemplate): Promise<PackageTemplate> {
    const [row] = await db.insert(agreementPackageTemplates).values({
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updatePackageTemplate(id: string, data: Partial<InsertPackageTemplate>): Promise<PackageTemplate> {
    const [row] = await db.update(agreementPackageTemplates)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agreementPackageTemplates.id, id))
      .returning();
    return row;
  }

  async archivePackageTemplate(id: string): Promise<PackageTemplate> {
    const [row] = await db.update(agreementPackageTemplates)
      .set({ isArchived: true, isActive: false, updatedAt: new Date() })
      .where(eq(agreementPackageTemplates.id, id))
      .returning();
    return row;
  }

  async duplicatePackageTemplate(id: string, newName: string): Promise<PackageTemplate> {
    const original = await this.getPackageTemplate(id);
    if (!original) throw new Error("Package template not found");
    const items = await this.listDeliverableTemplateItems(id);
    const [newTemplate] = await db.insert(agreementPackageTemplates).values({
      id: randomUUID(),
      packageName: newName,
      sponsorshipLevel: original.sponsorshipLevel,
      eventId: original.eventId,
      eventFamily: original.eventFamily,
      year: original.year,
      description: original.description,
      isActive: true,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    for (const item of items) {
      await db.insert(agreementDeliverableTemplateItems).values({
        id: randomUUID(),
        packageTemplateId: newTemplate.id,
        category: item.category,
        deliverableName: item.deliverableName,
        deliverableDescription: item.deliverableDescription,
        defaultQuantity: item.defaultQuantity,
        quantityUnit: item.quantityUnit,
        ownerType: item.ownerType,
        sponsorEditable: item.sponsorEditable,
        sponsorVisible: item.sponsorVisible,
        fulfillmentType: item.fulfillmentType,
        reminderEligible: item.reminderEligible,
        dueTiming: item.dueTiming,
        dueOffsetDays: item.dueOffsetDays,
        displayOrder: item.displayOrder,
        isActive: item.isActive,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return newTemplate;
  }

  // ── Deliverable Template Items ─────────────────────────────────────────────

  async listDeliverableTemplateItems(packageTemplateId: string): Promise<DeliverableTemplateItem[]> {
    return db.select().from(agreementDeliverableTemplateItems)
      .where(eq(agreementDeliverableTemplateItems.packageTemplateId, packageTemplateId))
      .orderBy(agreementDeliverableTemplateItems.category, agreementDeliverableTemplateItems.displayOrder);
  }

  async getDeliverableTemplateItem(id: string): Promise<DeliverableTemplateItem | undefined> {
    const [row] = await db.select().from(agreementDeliverableTemplateItems).where(eq(agreementDeliverableTemplateItems.id, id)).limit(1);
    return row;
  }

  async createDeliverableTemplateItem(data: InsertDeliverableTemplateItem): Promise<DeliverableTemplateItem> {
    const [row] = await db.insert(agreementDeliverableTemplateItems).values({
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateDeliverableTemplateItem(id: string, data: Partial<InsertDeliverableTemplateItem>): Promise<DeliverableTemplateItem> {
    const [row] = await db.update(agreementDeliverableTemplateItems)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agreementDeliverableTemplateItems.id, id))
      .returning();
    return row;
  }

  async deleteDeliverableTemplateItem(id: string): Promise<void> {
    await db.delete(agreementDeliverableTemplateItems).where(eq(agreementDeliverableTemplateItems.id, id));
  }

  // ── Agreement Deliverables ─────────────────────────────────────────────────

  async listAgreementDeliverables(filters: { sponsorId?: string; eventId?: string; packageTemplateId?: string }): Promise<AgreementDeliverable[]> {
    const conditions = [];
    if (filters.sponsorId) conditions.push(eq(agreementDeliverables.sponsorId, filters.sponsorId));
    if (filters.eventId) conditions.push(eq(agreementDeliverables.eventId, filters.eventId));
    if (filters.packageTemplateId) conditions.push(eq(agreementDeliverables.packageTemplateId, filters.packageTemplateId));
    const query = db.select().from(agreementDeliverables);
    const rows = conditions.length > 0
      ? await query.where(and(...conditions)).orderBy(agreementDeliverables.category, agreementDeliverables.displayOrder)
      : await query.orderBy(agreementDeliverables.category, agreementDeliverables.displayOrder);
    return rows;
  }

  async getAgreementDeliverable(id: string): Promise<AgreementDeliverable | undefined> {
    const [row] = await db.select().from(agreementDeliverables).where(eq(agreementDeliverables.id, id)).limit(1);
    return row;
  }

  async createAgreementDeliverable(data: InsertAgreementDeliverable): Promise<AgreementDeliverable> {
    const [row] = await db.insert(agreementDeliverables).values({
      id: randomUUID(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateAgreementDeliverable(id: string, data: Partial<InsertAgreementDeliverable>): Promise<AgreementDeliverable> {
    const [row] = await db.update(agreementDeliverables)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agreementDeliverables.id, id))
      .returning();
    return row;
  }

  async deleteAgreementDeliverable(id: string): Promise<void> {
    await db.delete(agreementDeliverables).where(eq(agreementDeliverables.id, id));
  }

  async generateAgreementDeliverablesFromTemplate(
    sponsorId: string, eventId: string, packageTemplateId: string, sponsorshipLevel: string
  ): Promise<AgreementDeliverable[]> {
    const existing = await this.listAgreementDeliverables({ sponsorId, eventId });
    if (existing.length > 0) return existing;
    const items = await this.listDeliverableTemplateItems(packageTemplateId);
    const created: AgreementDeliverable[] = [];
    for (const item of items.filter((i) => i.isActive)) {
      const [row] = await db.insert(agreementDeliverables).values({
        id: randomUUID(),
        sponsorId,
        eventId,
        packageTemplateId,
        sponsorshipLevel,
        category: item.category,
        deliverableName: item.deliverableName,
        deliverableDescription: item.deliverableDescription,
        quantity: item.defaultQuantity,
        quantityUnit: item.quantityUnit,
        ownerType: item.ownerType,
        sponsorEditable: item.sponsorEditable,
        sponsorVisible: item.sponsorVisible,
        fulfillmentType: item.fulfillmentType,
        status: "Not Started",
        dueTiming: item.dueTiming,
        dueDate: null,
        sponsorFacingNote: null,
        internalNote: null,
        isOverridden: false,
        isCustom: false,
        createdFromTemplateItemId: item.id,
        displayOrder: item.displayOrder,
        completedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }).returning();
      created.push(row);
    }
    return created;
  }

  async listDeliverableRegistrants(agreementDeliverableId: string): Promise<AgreementDeliverableRegistrant[]> {
    return db.select().from(agreementDeliverableRegistrants)
      .where(eq(agreementDeliverableRegistrants.agreementDeliverableId, agreementDeliverableId))
      .orderBy(agreementDeliverableRegistrants.createdAt);
  }

  async createDeliverableRegistrant(data: InsertAgreementDeliverableRegistrant): Promise<AgreementDeliverableRegistrant> {
    const [row] = await db.insert(agreementDeliverableRegistrants).values({
      ...data, title: data.title ?? null, email: data.email ?? null,
    }).returning();
    return row;
  }

  async updateDeliverableRegistrant(id: string, data: Partial<InsertAgreementDeliverableRegistrant>): Promise<AgreementDeliverableRegistrant> {
    const [row] = await db.update(agreementDeliverableRegistrants)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agreementDeliverableRegistrants.id, id))
      .returning();
    return row;
  }

  async deleteDeliverableRegistrant(id: string): Promise<void> {
    await db.delete(agreementDeliverableRegistrants).where(eq(agreementDeliverableRegistrants.id, id));
  }

  async listDeliverableSpeakers(agreementDeliverableId: string): Promise<AgreementDeliverableSpeaker[]> {
    return db.select().from(agreementDeliverableSpeakers)
      .where(eq(agreementDeliverableSpeakers.agreementDeliverableId, agreementDeliverableId))
      .orderBy(agreementDeliverableSpeakers.createdAt);
  }

  async createDeliverableSpeaker(data: InsertAgreementDeliverableSpeaker): Promise<AgreementDeliverableSpeaker> {
    const [row] = await db.insert(agreementDeliverableSpeakers).values({
      ...data, speakerTitle: data.speakerTitle ?? null, speakerBio: data.speakerBio ?? null,
    }).returning();
    return row;
  }

  async updateDeliverableSpeaker(id: string, data: Partial<InsertAgreementDeliverableSpeaker>): Promise<AgreementDeliverableSpeaker> {
    const [row] = await db.update(agreementDeliverableSpeakers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(agreementDeliverableSpeakers.id, id))
      .returning();
    return row;
  }

  async deleteDeliverableSpeaker(id: string): Promise<void> {
    await db.delete(agreementDeliverableSpeakers).where(eq(agreementDeliverableSpeakers.id, id));
  }
}
