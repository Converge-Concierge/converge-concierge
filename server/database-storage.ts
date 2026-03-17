import { eq, and, ne, sql, desc, inArray } from "drizzle-orm";
import { randomBytes, randomUUID } from "crypto";
import { db } from "./db";
import {
  users, events, sponsors, attendees, meetings,
  sponsorTokens, sponsorNotifications, passwordResetTokens, appConfig, dataExchangeLogs,
  sponsorUsers, sponsorLoginTokens, emailTemplates,
  userPermissions, permissionAuditLogs, informationRequests, sponsorAnalytics, emailLogs,
  agreementPackageTemplates, agreementDeliverableTemplateItems, agreementDeliverables,
  agreementDeliverableRegistrants, agreementDeliverableSpeakers, agreementDeliverableReminders,
  fileAssets, deliverableLinks, deliverableSocialEntries, meetingInvitations,
  sessionTypes, agendaSessions, agendaSessionSpeakers, attendeeSavedSessions, agendaImportJobs,
  emailTemplateVersions, automationRules, automationLogs, campaigns, messageJobs,
  eventInterestTopics, attendeeInterestTopicSelections, sponsorInterestTopicSelections, sessionInterestTopicSelections,
  attendeeTokens, type AttendeeToken,
  pendingConciergeProfiles, pendingConciergeTopics, pendingConciergeSessions, pendingConciergeMeetingRequests,
  type PendingConciergeProfile, type PendingConciergeTopic, type PendingConciergeSession, type PendingConciergeMeetingRequest,
  type EventInterestTopic, type InsertEventInterestTopic,
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
  type EmailTemplate, type EmailTemplateVersion,
  type AutomationRule, type AutomationLog,
  type PackageTemplate, type InsertPackageTemplate,
  type DeliverableTemplateItem, type InsertDeliverableTemplateItem,
  type AgreementDeliverable, type InsertAgreementDeliverable,
  type AgreementDeliverableRegistrant, type InsertAgreementDeliverableRegistrant,
  type AgreementDeliverableSpeaker, type InsertAgreementDeliverableSpeaker,
  type AgreementDeliverableReminder, type InsertAgreementDeliverableReminder,
  type FileAsset, type InsertFileAsset,
  type DeliverableLink, type InsertDeliverableLink,
  type DeliverableSocialEntry, type InsertDeliverableSocialEntry,
  type MeetingInvitation, type InsertMeetingInvitation, type MeetingInvitationStatus,
  type AttendeeCategoryDef, type InsertAttendeeCategoryDef,
  type CategoryMatchingRule, type InsertCategoryMatchingRule,
  type SessionType, type InsertSessionType,
  type AgendaSession, type InsertAgendaSession,
  type AgendaSessionSpeaker, type InsertAgendaSessionSpeaker,
  type AttendeeSavedSession, type InsertAttendeeSavedSession,
  type AgendaImportJob, type InsertAgendaImportJob,
  type Campaign, type InsertCampaign,
  attendeeCategories, categoryMatchingRules,
  scheduledEmails,
  type ScheduledEmail, type InsertScheduledEmail,
  DEFAULT_SETTINGS, DEFAULT_BRANDING, DEFAULT_USER_PERMISSIONS, DEFAULT_BACKUP_SCHEDULE, DEFAULT_EMAIL_SETTINGS,
  type BackupScheduleConfig, type EmailSettings,
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

    const tokens = await this.getAttendeeTokensByAttendee(id);
    const eventToken = tokens
      .filter((t) => t.eventId === attendee.assignedEvent)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null;

    return {
      ...attendee,
      eventName: event?.name ?? "",
      eventSlug: event?.slug ?? "",
      meetingsList,
      conciergeToken: eventToken
        ? {
            token: eventToken.token,
            isActive: eventToken.isActive,
            onboardingCompletedAt: eventToken.onboardingCompletedAt,
            onboardingSkippedAt: eventToken.onboardingSkippedAt,
            createdAt: eventToken.createdAt,
          }
        : null,
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

  async updateInformationRequest(id: string, data: Partial<any>): Promise<InformationRequest | undefined> {
    const [updated] = await db
      .update(informationRequests)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(informationRequests.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteInformationRequest(id: string): Promise<boolean> {
    const result = await db.delete(informationRequests).where(eq(informationRequests.id, id)).returning();
    return result.length > 0;
  }

  async createScheduledEmail(data: InsertScheduledEmail): Promise<ScheduledEmail> {
    const [created] = await db.insert(scheduledEmails).values(data).returning();
    return created;
  }

  async listScheduledEmails(filters?: { eventId?: string; sponsorId?: string; status?: string }): Promise<ScheduledEmail[]> {
    const conditions: any[] = [];
    if (filters?.eventId) conditions.push(eq(scheduledEmails.eventId, filters.eventId));
    if (filters?.sponsorId) conditions.push(eq(scheduledEmails.sponsorId, filters.sponsorId));
    if (filters?.status) conditions.push(eq(scheduledEmails.status, filters.status));
    const query = db.select().from(scheduledEmails);
    if (conditions.length > 0) {
      return query.where(and(...conditions)).orderBy(desc(scheduledEmails.scheduledAt));
    }
    return query.orderBy(desc(scheduledEmails.scheduledAt));
  }

  async getScheduledEmail(id: string): Promise<ScheduledEmail | undefined> {
    const [record] = await db.select().from(scheduledEmails).where(eq(scheduledEmails.id, id));
    return record ?? undefined;
  }

  async updateScheduledEmail(id: string, data: Partial<any>): Promise<ScheduledEmail | undefined> {
    const [updated] = await db
      .update(scheduledEmails)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(scheduledEmails.id, id))
      .returning();
    return updated ?? undefined;
  }

  async deleteScheduledEmail(id: string): Promise<boolean> {
    const result = await db.delete(scheduledEmails).where(eq(scheduledEmails.id, id)).returning();
    return result.length > 0;
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
    await db.update(sponsorUsers).set({
      lastLoginAt: new Date(),
      loginCount: sql`login_count + 1`,
      updatedAt: new Date(),
    }).where(eq(sponsorUsers.id, id));
  }

  async getAllSponsorUsers(): Promise<SponsorUser[]> {
    return db.select().from(sponsorUsers);
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

  async updateEmailTemplate(id: string, data: Partial<{ displayName: string; category: string; subjectTemplate: string; htmlTemplate: string; textTemplate: string | null; description: string | null; isActive: boolean; variables: string[] }>, updatedBy?: string): Promise<EmailTemplate> {
    const existing = await this.getEmailTemplateById(id);
    if (existing) {
      const maxVersion = await db.select({ max: sql<number>`COALESCE(MAX(version), 0)` }).from(emailTemplateVersions).where(eq(emailTemplateVersions.templateId, id));
      const nextVersion = (maxVersion[0]?.max ?? 0) + 1;
      await db.insert(emailTemplateVersions).values({
        id: randomUUID(),
        templateId: id,
        version: nextVersion,
        displayName: existing.displayName,
        category: existing.category,
        subjectTemplate: existing.subjectTemplate,
        htmlTemplate: existing.htmlTemplate,
        textTemplate: existing.textTemplate,
        description: existing.description,
        variables: existing.variables,
        isActive: existing.isActive,
        updatedBy: updatedBy ?? null,
      });
    }
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.displayName !== undefined) updates.displayName = data.displayName;
    if (data.category !== undefined) updates.category = data.category;
    if (data.subjectTemplate !== undefined) updates.subjectTemplate = data.subjectTemplate;
    if (data.htmlTemplate !== undefined) updates.htmlTemplate = data.htmlTemplate;
    if (data.textTemplate !== undefined) updates.textTemplate = data.textTemplate;
    if (data.description !== undefined) updates.description = data.description;
    if (data.isActive !== undefined) updates.isActive = data.isActive;
    if (data.variables !== undefined) updates.variables = data.variables;
    const [row] = await db.update(emailTemplates).set(updates).where(eq(emailTemplates.id, id)).returning();
    return row;
  }

  async getEmailTemplateVersions(templateId: string): Promise<EmailTemplateVersion[]> {
    return db.select().from(emailTemplateVersions).where(eq(emailTemplateVersions.templateId, templateId)).orderBy(sql`version DESC`);
  }

  async restoreEmailTemplateVersion(templateId: string, versionId: string, restoredBy?: string): Promise<EmailTemplate> {
    const [version] = await db.select().from(emailTemplateVersions).where(and(eq(emailTemplateVersions.id, versionId), eq(emailTemplateVersions.templateId, templateId))).limit(1);
    if (!version) throw new Error("Version not found");
    return this.updateEmailTemplate(templateId, {
      displayName: version.displayName,
      category: version.category,
      subjectTemplate: version.subjectTemplate,
      htmlTemplate: version.htmlTemplate,
      textTemplate: version.textTemplate,
      description: version.description,
      isActive: version.isActive,
      variables: version.variables,
    }, restoredBy ? `${restoredBy} (restored v${version.version})` : `Restored v${version.version}`);
  }

  // ── Automation Rules ──────────────────────────────────────────────────────

  async getAutomationRules(): Promise<AutomationRule[]> {
    return db.select().from(automationRules).orderBy(automationRules.category, automationRules.name);
  }

  async getAutomationRuleByKey(key: string): Promise<AutomationRule | undefined> {
    const [row] = await db.select().from(automationRules).where(eq(automationRules.automationKey, key)).limit(1);
    return row;
  }

  async upsertAutomationRule(data: { automationKey: string; name: string; category: string; triggerDescription: string; audience: string; templateKey?: string | null; eventScope?: string }): Promise<AutomationRule> {
    const existing = await this.getAutomationRuleByKey(data.automationKey);
    if (existing) {
      const [updated] = await db.update(automationRules)
        .set({ name: data.name, category: data.category, triggerDescription: data.triggerDescription, audience: data.audience, templateKey: data.templateKey ?? existing.templateKey, eventScope: data.eventScope ?? existing.eventScope, updatedAt: new Date() })
        .where(eq(automationRules.id, existing.id))
        .returning();
      return updated;
    }
    const [created] = await db.insert(automationRules).values({
      id: randomUUID(),
      automationKey: data.automationKey,
      name: data.name,
      category: data.category,
      triggerDescription: data.triggerDescription,
      audience: data.audience,
      templateKey: data.templateKey ?? null,
      eventScope: data.eventScope ?? "All Events",
    }).returning();
    return created;
  }

  async updateAutomationRule(id: string, data: Partial<{ isEnabled: boolean }>): Promise<AutomationRule> {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.isEnabled !== undefined) updates.isEnabled = data.isEnabled;
    const [row] = await db.update(automationRules).set(updates).where(eq(automationRules.id, id)).returning();
    return row;
  }

  async setAllAutomationsEnabled(enabled: boolean): Promise<void> {
    await db.update(automationRules).set({ isEnabled: enabled, updatedAt: new Date() });
  }

  async recordAutomationExecution(automationKey: string, emailsSent: number, failures: number, errorMessage?: string | null): Promise<void> {
    const rule = await this.getAutomationRuleByKey(automationKey);
    if (!rule) return;
    await db.update(automationRules).set({
      lastRunAt: new Date(),
      emailsSent: sql`${automationRules.emailsSent} + ${emailsSent}`,
      failures: sql`${automationRules.failures} + ${failures}`,
      lastError: errorMessage ?? null,
      updatedAt: new Date(),
    }).where(eq(automationRules.id, rule.id));
    await db.insert(automationLogs).values({
      id: randomUUID(),
      automationId: rule.id,
      emailsSent,
      failures,
      status: failures > 0 ? "partial" : "success",
      errorMessage: errorMessage ?? null,
    });
  }

  async getAutomationLogs(automationId: string, limit = 10): Promise<AutomationLog[]> {
    return db.select().from(automationLogs).where(eq(automationLogs.automationId, automationId)).orderBy(sql`executed_at DESC`).limit(limit);
  }

  // ── Campaigns ───────────────────────────────────────────────────────────

  async listCampaigns(filters?: { eventId?: string; status?: string; audienceType?: string }): Promise<Campaign[]> {
    const conditions = [];
    if (filters?.eventId) conditions.push(eq(campaigns.eventId, filters.eventId));
    if (filters?.status) conditions.push(eq(campaigns.status, filters.status));
    if (filters?.audienceType) conditions.push(eq(campaigns.audienceType, filters.audienceType));
    return db.select().from(campaigns)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const [row] = await db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return row;
  }

  async createCampaign(data: InsertCampaign): Promise<Campaign> {
    const [row] = await db.insert(campaigns).values({
      ...data,
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();
    return row;
  }

  async updateCampaign(id: string, data: Partial<InsertCampaign & { status?: string; sentAt?: Date; emailsSent?: number; failures?: number; audienceSize?: number }>): Promise<Campaign> {
    const [row] = await db.update(campaigns).set({ ...data, updatedAt: new Date() }).where(eq(campaigns.id, id)).returning();
    return row;
  }

  async deleteCampaign(id: string): Promise<void> {
    await db.delete(campaigns).where(eq(campaigns.id, id));
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

  async createEmailLog(data: { emailType: string; recipientEmail: string; subject: string; htmlContent?: string | null; eventId?: string | null; sponsorId?: string | null; attendeeId?: string | null; status: "sent" | "failed"; errorMessage?: string | null; resendOfId?: string | null; providerMessageId?: string | null; source?: string | null; templateId?: string | null; messageJobId?: string | null }): Promise<string> {
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
      source: data.source ?? null,
      templateId: data.templateId ?? null,
      messageJobId: data.messageJobId ?? null,
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

  async listEmailLogs(filters?: { emailType?: string; status?: string; eventId?: string; sponsorId?: string; source?: string; search?: string; from?: Date; to?: Date }, limit = 100, offset = 0): Promise<EmailLog[]> {
    const rows = await db.select().from(emailLogs).orderBy(desc(emailLogs.sentAt));
    let sponsorNameMap: Map<string, string> | null = null;
    if (filters?.search) {
      const allSponsors = await db.select({ id: sponsors.id, name: sponsors.name }).from(sponsors);
      sponsorNameMap = new Map(allSponsors.map(s => [s.id, s.name]));
    }
    return rows.filter((r) => {
      if (filters?.emailType && r.emailType !== filters.emailType) return false;
      if (filters?.status && r.status !== filters.status) return false;
      if (filters?.eventId && r.eventId !== filters.eventId) return false;
      if (filters?.sponsorId && r.sponsorId !== filters.sponsorId) return false;
      if (filters?.source && r.source !== filters.source) return false;
      if (filters?.from && r.sentAt < filters.from) return false;
      if (filters?.to && r.sentAt > filters.to) return false;
      if (filters?.search) {
        const q = filters.search.toLowerCase();
        const sponsorName = r.sponsorId && sponsorNameMap ? (sponsorNameMap.get(r.sponsorId) ?? "") : "";
        if (!r.recipientEmail.toLowerCase().includes(q) && !r.subject.toLowerCase().includes(q) && !r.emailType.toLowerCase().includes(q) && !sponsorName.toLowerCase().includes(q)) return false;
      }
      return true;
    }).slice(offset, offset + limit);
  }

  async getEmailLog(id: string): Promise<EmailLog | undefined> {
    const rows = await db.select().from(emailLogs).where(eq(emailLogs.id, id));
    return rows[0];
  }

  // ── Message Jobs ────────────────────────────────────────────────────────────

  async createMessageJob(data: { jobName: string; messageType: string; sourceType: string; sourceId?: string | null; eventId?: string | null; sponsorId?: string | null; attendeeId?: string | null; templateId?: string | null; templateKeySnapshot?: string | null; triggerType: string; triggerName?: string | null; status?: string; scheduledAt?: Date | null; startedAt?: Date | null; recipientCount?: number; createdByUserId?: string | null; notes?: string | null }): Promise<string> {
    const id = randomUUID();
    await db.insert(messageJobs).values({
      id,
      jobName: data.jobName,
      messageType: data.messageType,
      sourceType: data.sourceType,
      sourceId: data.sourceId ?? null,
      eventId: data.eventId ?? null,
      sponsorId: data.sponsorId ?? null,
      attendeeId: data.attendeeId ?? null,
      templateId: data.templateId ?? null,
      templateKeySnapshot: data.templateKeySnapshot ?? null,
      triggerType: data.triggerType,
      triggerName: data.triggerName ?? null,
      status: data.status ?? "RUNNING",
      scheduledAt: data.scheduledAt ?? null,
      startedAt: data.startedAt ?? new Date(),
      recipientCount: data.recipientCount ?? 0,
      createdByUserId: data.createdByUserId ?? null,
      notes: data.notes ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return id;
  }

  async updateMessageJob(id: string, updates: Partial<{ status: string; completedAt: Date; recipientCount: number; sentCount: number; failedCount: number; notes: string }>): Promise<void> {
    const set: Record<string, any> = { updatedAt: new Date() };
    if (updates.status !== undefined) set.status = updates.status;
    if (updates.completedAt !== undefined) set.completedAt = updates.completedAt;
    if (updates.recipientCount !== undefined) set.recipientCount = updates.recipientCount;
    if (updates.sentCount !== undefined) set.sentCount = updates.sentCount;
    if (updates.failedCount !== undefined) set.failedCount = updates.failedCount;
    if (updates.notes !== undefined) set.notes = updates.notes;
    await db.update(messageJobs).set(set).where(eq(messageJobs.id, id));
  }

  async getMessageJob(id: string): Promise<import("@shared/schema").MessageJob | undefined> {
    const rows = await db.select().from(messageJobs).where(eq(messageJobs.id, id)).limit(1);
    return rows[0];
  }

  async listMessageJobs(filters?: { messageType?: string; status?: string; eventId?: string; sponsorId?: string; sourceType?: string; search?: string; from?: Date; to?: Date }, limit = 50, offset = 0): Promise<import("@shared/schema").MessageJob[]> {
    const rows = await db.select().from(messageJobs).orderBy(desc(messageJobs.createdAt));
    let filtered = rows;
    if (filters) {
      if (filters.messageType) filtered = filtered.filter(r => r.messageType === filters.messageType);
      if (filters.status) filtered = filtered.filter(r => r.status === filters.status);
      if (filters.eventId) filtered = filtered.filter(r => r.eventId === filters.eventId);
      if (filters.sponsorId) filtered = filtered.filter(r => r.sponsorId === filters.sponsorId);
      if (filters.sourceType) filtered = filtered.filter(r => r.sourceType === filters.sourceType);
      if (filters.from) { const f = filters.from; filtered = filtered.filter(r => r.createdAt >= f); }
      if (filters.to) { const t = filters.to; filtered = filtered.filter(r => r.createdAt <= t); }
      if (filters.search) {
        const s = filters.search.toLowerCase();
        filtered = filtered.filter(r =>
          r.jobName.toLowerCase().includes(s) ||
          (r.triggerName && r.triggerName.toLowerCase().includes(s)) ||
          (r.templateKeySnapshot && r.templateKeySnapshot.toLowerCase().includes(s))
        );
      }
    }
    return filtered.slice(offset, offset + limit);
  }

  async getMessageJobEmailLogs(jobId: string): Promise<import("@shared/schema").EmailLog[]> {
    return db.select().from(emailLogs).where(eq(emailLogs.messageJobId, jobId)).orderBy(desc(emailLogs.sentAt));
  }

  // ── Event Interest Topics ──────────────────────────────────────────────────

  async createEventInterestTopic(data: InsertEventInterestTopic): Promise<EventInterestTopic> {
    const [row] = await db.insert(eventInterestTopics).values({ id: randomUUID(), ...data }).returning();
    return row;
  }

  async updateEventInterestTopic(id: string, updates: Partial<InsertEventInterestTopic>): Promise<EventInterestTopic | undefined> {
    const [row] = await db.update(eventInterestTopics).set({ ...updates, updatedAt: new Date() }).where(eq(eventInterestTopics.id, id)).returning();
    return row;
  }

  async deleteEventInterestTopic(id: string): Promise<void> {
    await db.delete(eventInterestTopics).where(eq(eventInterestTopics.id, id));
  }

  async getEventInterestTopic(id: string): Promise<EventInterestTopic | undefined> {
    const [row] = await db.select().from(eventInterestTopics).where(eq(eventInterestTopics.id, id)).limit(1);
    return row;
  }

  async getEventInterestTopics(eventId: string, filters?: { status?: string; isActive?: boolean }): Promise<EventInterestTopic[]> {
    let rows = await db.select().from(eventInterestTopics)
      .where(eq(eventInterestTopics.eventId, eventId))
      .orderBy(eventInterestTopics.displayOrder, eventInterestTopics.topicLabel);
    if (filters?.status) rows = rows.filter(r => r.status === filters.status);
    if (filters?.isActive !== undefined) rows = rows.filter(r => r.isActive === filters.isActive);
    return rows;
  }

  async upsertAttendeeTopics(attendeeId: string, eventId: string, topicIds: string[]): Promise<void> {
    await db.delete(attendeeInterestTopicSelections).where(
      and(eq(attendeeInterestTopicSelections.attendeeId, attendeeId), eq(attendeeInterestTopicSelections.eventId, eventId))
    );
    if (topicIds.length > 0) {
      await db.insert(attendeeInterestTopicSelections).values(
        topicIds.map(topicId => ({ id: randomUUID(), attendeeId, eventId, topicId }))
      );
    }
  }

  async getAttendeeTopics(attendeeId: string, eventId: string): Promise<import("@shared/schema").AttendeeInterestTopicSelection[]> {
    return db.select().from(attendeeInterestTopicSelections).where(
      and(eq(attendeeInterestTopicSelections.attendeeId, attendeeId), eq(attendeeInterestTopicSelections.eventId, eventId))
    );
  }

  async upsertSponsorTopics(sponsorId: string, eventId: string, topicIds: string[]): Promise<void> {
    await db.delete(sponsorInterestTopicSelections).where(
      and(eq(sponsorInterestTopicSelections.sponsorId, sponsorId), eq(sponsorInterestTopicSelections.eventId, eventId))
    );
    if (topicIds.length > 0) {
      await db.insert(sponsorInterestTopicSelections).values(
        topicIds.map(topicId => ({ id: randomUUID(), sponsorId, eventId, topicId }))
      );
    }
  }

  async getSponsorTopics(sponsorId: string, eventId: string): Promise<import("@shared/schema").SponsorInterestTopicSelection[]> {
    return db.select().from(sponsorInterestTopicSelections).where(
      and(eq(sponsorInterestTopicSelections.sponsorId, sponsorId), eq(sponsorInterestTopicSelections.eventId, eventId))
    );
  }

  async upsertSessionTopics(sessionId: string, eventId: string, topicIds: string[]): Promise<void> {
    await db.delete(sessionInterestTopicSelections).where(eq(sessionInterestTopicSelections.sessionId, sessionId));
    if (topicIds.length > 0) {
      await db.insert(sessionInterestTopicSelections).values(
        topicIds.map(topicId => ({ id: randomUUID(), sessionId, eventId, topicId }))
      );
    }
  }

  async getSessionTopics(sessionId: string): Promise<import("@shared/schema").SessionInterestTopicSelection[]> {
    return db.select().from(sessionInterestTopicSelections).where(eq(sessionInterestTopicSelections.sessionId, sessionId));
  }

  async countTopicUsage(topicId: string): Promise<{ attendees: number; sponsors: number; sessions: number }> {
    const [a] = await db.select({ count: sql<number>`count(*)::int` }).from(attendeeInterestTopicSelections).where(eq(attendeeInterestTopicSelections.topicId, topicId));
    const [s] = await db.select({ count: sql<number>`count(*)::int` }).from(sponsorInterestTopicSelections).where(eq(sponsorInterestTopicSelections.topicId, topicId));
    const [se] = await db.select({ count: sql<number>`count(*)::int` }).from(sessionInterestTopicSelections).where(eq(sessionInterestTopicSelections.topicId, topicId));
    return { attendees: a?.count ?? 0, sponsors: s?.count ?? 0, sessions: se?.count ?? 0 };
  }

  async bulkCountTopicUsage(topicIds: string[]): Promise<Map<string, { attendees: number; sponsors: number; sessions: number }>> {
    const result = new Map<string, { attendees: number; sponsors: number; sessions: number }>();
    if (topicIds.length === 0) return result;
    topicIds.forEach(id => result.set(id, { attendees: 0, sponsors: 0, sessions: 0 }));
    const aRows = await db.select({ topicId: attendeeInterestTopicSelections.topicId, count: sql<number>`count(*)::int` })
      .from(attendeeInterestTopicSelections).where(inArray(attendeeInterestTopicSelections.topicId, topicIds))
      .groupBy(attendeeInterestTopicSelections.topicId);
    const sRows = await db.select({ topicId: sponsorInterestTopicSelections.topicId, count: sql<number>`count(*)::int` })
      .from(sponsorInterestTopicSelections).where(inArray(sponsorInterestTopicSelections.topicId, topicIds))
      .groupBy(sponsorInterestTopicSelections.topicId);
    const seRows = await db.select({ topicId: sessionInterestTopicSelections.topicId, count: sql<number>`count(*)::int` })
      .from(sessionInterestTopicSelections).where(inArray(sessionInterestTopicSelections.topicId, topicIds))
      .groupBy(sessionInterestTopicSelections.topicId);
    aRows.forEach(r => { const e = result.get(r.topicId); if (e) e.attendees = r.count; });
    sRows.forEach(r => { const e = result.get(r.topicId); if (e) e.sponsors = r.count; });
    seRows.forEach(r => { const e = result.get(r.topicId); if (e) e.sessions = r.count; });
    return result;
  }

  async countSessionTopicsForEvent(eventId: string): Promise<{ sessionId: string; count: number }[]> {
    const rows = await db.select({
      sessionId: sessionInterestTopicSelections.sessionId,
      count: sql<number>`count(*)::int`,
    })
      .from(sessionInterestTopicSelections)
      .where(eq(sessionInterestTopicSelections.eventId, eventId))
      .groupBy(sessionInterestTopicSelections.sessionId);
    return rows.map(r => ({ sessionId: r.sessionId, count: r.count ?? 0 }));
  }

  // ── Attendee Tokens ───────────────────────────────────────────────────────

  async createAttendeeToken(attendeeId: string, eventId: string): Promise<AttendeeToken> {
    const token = randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const [created] = await db.insert(attendeeTokens)
      .values({ token, attendeeId, eventId, isActive: true, expiresAt, createdAt: new Date() })
      .returning();
    return created;
  }

  async getAttendeeToken(token: string): Promise<AttendeeToken | undefined> {
    const [row] = await db.select().from(attendeeTokens).where(eq(attendeeTokens.token, token)).limit(1);
    return row ?? undefined;
  }

  async getAttendeeTokensByAttendee(attendeeId: string): Promise<AttendeeToken[]> {
    return db.select().from(attendeeTokens).where(eq(attendeeTokens.attendeeId, attendeeId));
  }

  async updateAttendeeToken(token: string, updates: Partial<Pick<AttendeeToken, "isActive" | "onboardingCompletedAt" | "onboardingSkippedAt">>): Promise<AttendeeToken | undefined> {
    const [row] = await db.update(attendeeTokens).set(updates).where(eq(attendeeTokens.token, token)).returning();
    return row ?? undefined;
  }

  // ── Pending Concierge Profiles ─────────────────────────────────────────────

  async createPendingConciergeProfile(eventId: string, source = "welcome_flow"): Promise<PendingConciergeProfile> {
    const [row] = await db.insert(pendingConciergeProfiles).values({ eventId, source }).returning();
    return row;
  }

  async getPendingConciergeProfile(profileId: string): Promise<PendingConciergeProfile | undefined> {
    const [row] = await db.select().from(pendingConciergeProfiles).where(eq(pendingConciergeProfiles.id, profileId)).limit(1);
    return row ?? undefined;
  }

  async updatePendingConciergeProfile(profileId: string, updates: Partial<Pick<PendingConciergeProfile, "email" | "onboardingStep" | "isCompleted" | "matchedAttendeeId">>): Promise<void> {
    await db.update(pendingConciergeProfiles).set({ ...updates, updatedAt: new Date() }).where(eq(pendingConciergeProfiles.id, profileId));
  }

  async getPendingConciergeTopics(profileId: string): Promise<PendingConciergeTopic[]> {
    return db.select().from(pendingConciergeTopics).where(eq(pendingConciergeTopics.pendingProfileId, profileId));
  }

  async setPendingConciergeTopics(profileId: string, topicIds: string[]): Promise<void> {
    await db.delete(pendingConciergeTopics).where(eq(pendingConciergeTopics.pendingProfileId, profileId));
    if (topicIds.length > 0) {
      await db.insert(pendingConciergeTopics).values(topicIds.map((topicId) => ({ pendingProfileId: profileId, topicId })));
    }
  }

  async getPendingConciergeSessions(profileId: string): Promise<PendingConciergeSession[]> {
    return db.select().from(pendingConciergeSessions).where(eq(pendingConciergeSessions.pendingProfileId, profileId));
  }

  async addPendingConciergeSession(profileId: string, sessionId: string): Promise<void> {
    const existing = await db.select().from(pendingConciergeSessions)
      .where(and(eq(pendingConciergeSessions.pendingProfileId, profileId), eq(pendingConciergeSessions.sessionId, sessionId))).limit(1);
    if (existing.length === 0) {
      await db.insert(pendingConciergeSessions).values({ pendingProfileId: profileId, sessionId });
    }
  }

  async removePendingConciergeSession(profileId: string, sessionId: string): Promise<void> {
    await db.delete(pendingConciergeSessions)
      .where(and(eq(pendingConciergeSessions.pendingProfileId, profileId), eq(pendingConciergeSessions.sessionId, sessionId)));
  }

  async getPendingConciergeMeetingRequests(profileId: string): Promise<PendingConciergeMeetingRequest[]> {
    return db.select().from(pendingConciergeMeetingRequests).where(eq(pendingConciergeMeetingRequests.pendingProfileId, profileId));
  }

  async addPendingConciergeMeetingRequest(profileId: string, sponsorId: string, requestType: string): Promise<void> {
    const existing = await db.select().from(pendingConciergeMeetingRequests)
      .where(and(eq(pendingConciergeMeetingRequests.pendingProfileId, profileId), eq(pendingConciergeMeetingRequests.sponsorId, sponsorId), eq(pendingConciergeMeetingRequests.requestType, requestType))).limit(1);
    if (existing.length === 0) {
      await db.insert(pendingConciergeMeetingRequests).values({ pendingProfileId: profileId, sponsorId, requestType });
    }
  }

  async getPendingConciergeProfilesByEmail(eventId: string, email: string): Promise<PendingConciergeProfile[]> {
    return db.select().from(pendingConciergeProfiles)
      .where(and(eq(pendingConciergeProfiles.eventId, eventId), eq(pendingConciergeProfiles.email, email.toLowerCase())));
  }

  async searchPendingConciergeProfiles(params: { eventId?: string; email?: string }): Promise<PendingConciergeProfile[]> {
    const conditions: ReturnType<typeof eq>[] = [];
    if (params.eventId) conditions.push(eq(pendingConciergeProfiles.eventId, params.eventId));
    if (params.email) conditions.push(eq(pendingConciergeProfiles.email, params.email.toLowerCase()));
    if (conditions.length === 0) {
      return db.select().from(pendingConciergeProfiles).orderBy(desc(pendingConciergeProfiles.createdAt)).limit(200);
    }
    return db.select().from(pendingConciergeProfiles).where(and(...conditions)).orderBy(desc(pendingConciergeProfiles.createdAt));
  }

  async resetPendingConciergeProfile(profileId: string): Promise<void> {
    await db.update(pendingConciergeProfiles)
      .set({ isCompleted: false, onboardingStep: "topics", updatedAt: new Date() })
      .where(eq(pendingConciergeProfiles.id, profileId));
  }

  async reconcilePendingConciergeProfiles(eventId: string, email: string, attendeeId: string): Promise<void> {
    const profiles = await this.getPendingConciergeProfilesByEmail(eventId, email.toLowerCase());
    const unmatched = profiles.filter((p) => !p.matchedAttendeeId);
    for (const profile of unmatched) {
      // Copy topic selections to attendee
      const profileTopics = await this.getPendingConciergeTopics(profile.id);
      if (profileTopics.length > 0) {
        const topicIds = profileTopics.map((t) => t.topicId);
        await this.upsertAttendeeTopics(attendeeId, eventId, topicIds);
      }
      // Copy saved sessions
      const savedSessions = await this.getPendingConciergeSessions(profile.id);
      for (const s of savedSessions) {
        try {
          await db.insert(attendeeSavedSessions).values({ attendeeId, eventId, sessionId: s.sessionId }).onConflictDoNothing();
        } catch { /* ignore duplicates */ }
      }
      // Mark profile as matched
      await this.updatePendingConciergeProfile(profile.id, { matchedAttendeeId: attendeeId, isCompleted: true });
    }
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
        sponsorFacingNote: item.sponsorFacingNote,
        helpTitle: item.helpTitle,
        helpText: item.helpText,
        helpLink: item.helpLink,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return newTemplate;
  }

  // ── Deliverable Template Items ─────────────────────────────────────────────

  async listDeliverableTemplateItems(packageTemplateId: string): Promise<DeliverableTemplateItem[]> {
    return db.select().from(agreementDeliverableTemplateItems)
      .where(and(
        eq(agreementDeliverableTemplateItems.packageTemplateId, packageTemplateId),
        eq(agreementDeliverableTemplateItems.isActive, true),
      ))
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
        sponsorFacingNote: item.sponsorFacingNote ?? null,
        internalNote: null,
        isOverridden: false,
        isCustom: false,
        createdFromTemplateItemId: item.id,
        displayOrder: item.displayOrder,
        completedAt: null,
        helpTitle: item.helpTitle,
        helpText: item.helpText,
        helpLink: item.helpLink,
        registrationAccessCode: null,
        registrationInstructions: null,
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
      ...data,
      firstName: data.firstName ?? null,
      lastName: data.lastName ?? null,
      title: data.title ?? null,
      email: data.email ?? null,
      conciergeRole: data.conciergeRole ?? null,
      registrationStatus: data.registrationStatus ?? "Unknown",
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
      ...data,
      speakerTitle: data.speakerTitle ?? null,
      speakerBio: data.speakerBio ?? null,
      sessionType: data.sessionType ?? null,
      sessionTitle: data.sessionTitle ?? null,
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

  async listDeliverableReminders(filters: { sponsorId?: string; eventId?: string }): Promise<AgreementDeliverableReminder[]> {
    const conditions = [];
    if (filters.sponsorId) conditions.push(eq(agreementDeliverableReminders.sponsorId, filters.sponsorId));
    if (filters.eventId) conditions.push(eq(agreementDeliverableReminders.eventId, filters.eventId));
    const q = db.select().from(agreementDeliverableReminders).orderBy(desc(agreementDeliverableReminders.sentAt));
    return conditions.length ? q.where(and(...conditions)) : q;
  }

  async getLastDeliverableReminder(sponsorId: string, eventId: string): Promise<AgreementDeliverableReminder | undefined> {
    const [row] = await db.select().from(agreementDeliverableReminders)
      .where(and(
        eq(agreementDeliverableReminders.sponsorId, sponsorId),
        eq(agreementDeliverableReminders.eventId, eventId),
      ))
      .orderBy(desc(agreementDeliverableReminders.sentAt))
      .limit(1);
    return row;
  }

  async createDeliverableReminder(data: InsertAgreementDeliverableReminder): Promise<AgreementDeliverableReminder> {
    const [row] = await db.insert(agreementDeliverableReminders).values({
      ...data,
      sentByUserId: data.sentByUserId ?? null,
      errorMessage: data.errorMessage ?? null,
    }).returning();
    return row;
  }

  // ── File Assets ────────────────────────────────────────────────────────────

  async listFileAssets(filters: { sponsorId?: string; eventId?: string; deliverableId?: string; status?: string }): Promise<FileAsset[]> {
    let query = db.select().from(fileAssets).$dynamic();
    const conditions = [];
    if (filters.sponsorId) conditions.push(eq(fileAssets.sponsorId, filters.sponsorId));
    if (filters.eventId) conditions.push(eq(fileAssets.eventId, filters.eventId));
    if (filters.deliverableId) conditions.push(eq(fileAssets.deliverableId, filters.deliverableId));
    if (filters.status) conditions.push(eq(fileAssets.status, filters.status));
    if (conditions.length > 0) query = query.where(and(...conditions));
    return query.orderBy(desc(fileAssets.uploadedAt));
  }

  async getFileAsset(id: string): Promise<FileAsset | undefined> {
    const [row] = await db.select().from(fileAssets).where(eq(fileAssets.id, id));
    return row;
  }

  async createFileAsset(data: InsertFileAsset): Promise<FileAsset> {
    const [row] = await db.insert(fileAssets).values({
      ...data,
      eventId: data.eventId ?? null,
      sponsorId: data.sponsorId ?? null,
      deliverableId: data.deliverableId ?? null,
      uploadedByUserId: data.uploadedByUserId ?? null,
      sizeBytes: data.sizeBytes ?? null,
      title: data.title ?? null,
      description: data.description ?? null,
      replacesFileAssetId: data.replacesFileAssetId ?? null,
    }).returning();
    return row;
  }

  async updateFileAsset(id: string, data: Partial<InsertFileAsset>): Promise<FileAsset> {
    const [row] = await db.update(fileAssets).set({ ...data, updatedAt: new Date() }).where(eq(fileAssets.id, id)).returning();
    return row;
  }

  async archiveFileAsset(id: string): Promise<FileAsset> {
    const [row] = await db.update(fileAssets).set({ status: "archived", updatedAt: new Date() }).where(eq(fileAssets.id, id)).returning();
    return row;
  }

  async replaceFileAsset(oldId: string, newData: InsertFileAsset): Promise<FileAsset> {
    await db.update(fileAssets).set({ status: "replaced", isLatestVersion: false, updatedAt: new Date() }).where(eq(fileAssets.id, oldId));
    const [row] = await db.insert(fileAssets).values({
      ...newData,
      replacesFileAssetId: oldId,
      status: "active",
      isLatestVersion: true,
      eventId: newData.eventId ?? null,
      sponsorId: newData.sponsorId ?? null,
      deliverableId: newData.deliverableId ?? null,
      uploadedByUserId: newData.uploadedByUserId ?? null,
      sizeBytes: newData.sizeBytes ?? null,
      title: newData.title ?? null,
      description: newData.description ?? null,
    }).returning();
    return row;
  }

  // ── Deliverable Links ──────────────────────────────────────────────────────

  async listDeliverableLinks(deliverableId: string): Promise<DeliverableLink[]> {
    return db.select().from(deliverableLinks).where(eq(deliverableLinks.deliverableId, deliverableId)).orderBy(deliverableLinks.addedAt);
  }

  async createDeliverableLink(data: InsertDeliverableLink): Promise<DeliverableLink> {
    const [row] = await db.insert(deliverableLinks).values({
      ...data,
      addedByUserId: data.addedByUserId ?? null,
    }).returning();
    return row;
  }

  async deleteDeliverableLink(id: string): Promise<void> {
    await db.delete(deliverableLinks).where(eq(deliverableLinks.id, id));
  }

  // ── Deliverable Social Entries ──────────────────────────────────────────────

  async listDeliverableSocialEntries(deliverableId: string): Promise<DeliverableSocialEntry[]> {
    return db.select().from(deliverableSocialEntries)
      .where(eq(deliverableSocialEntries.deliverableId, deliverableId))
      .orderBy(deliverableSocialEntries.entryIndex);
  }

  async getDeliverableSocialEntry(id: string): Promise<DeliverableSocialEntry | undefined> {
    const [row] = await db.select().from(deliverableSocialEntries).where(eq(deliverableSocialEntries.id, id)).limit(1);
    return row;
  }

  async createDeliverableSocialEntry(data: InsertDeliverableSocialEntry): Promise<DeliverableSocialEntry> {
    const [row] = await db.insert(deliverableSocialEntries).values({
      ...data,
      title: data.title ?? null,
      url: data.url ?? null,
      fileAssetId: data.fileAssetId ?? null,
      notes: data.notes ?? null,
    }).returning();
    return row;
  }

  async updateDeliverableSocialEntry(id: string, data: Partial<InsertDeliverableSocialEntry>): Promise<DeliverableSocialEntry> {
    const [row] = await db.update(deliverableSocialEntries)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(deliverableSocialEntries.id, id))
      .returning();
    return row;
  }

  async deleteDeliverableSocialEntry(id: string): Promise<void> {
    await db.delete(deliverableSocialEntries).where(eq(deliverableSocialEntries.id, id));
  }

  // ── Attendee CSV Helper ────────────────────────────────────────────────────

  async generateAttendeeContactListCsv(deliverableId: string, type: "full" | "partial" = "full"): Promise<string> {
    const deliverable = await this.getAgreementDeliverable(deliverableId);
    if (!deliverable) return "";

    const registrants = await this.listDeliverableRegistrants(deliverableId);
    const allSponsors = await this.getSponsors();
    const sponsorMap = new Map(allSponsors.map(s => [s.id, s.name]));
    const sponsorName = sponsorMap.get(deliverable.sponsorId) ?? deliverable.sponsorId;

    function csvSafe(val: string): string {
      let s = val;
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
      return s.includes(",") || s.includes('"') || s.includes("\n") ? `"${s.replace(/"/g, '""')}"` : s;
    }

    const fullHeaders = ["sponsorName","sponsorshipLevel","deliverableName","name","firstName","lastName","email","title","conciergeRole","registrationStatus"];
    const partialHeaders = ["firstName","lastName","email","registrationStatus"];
    const headers = type === "partial" ? partialHeaders : fullHeaders;

    const csvLines = [headers.join(",")];
    for (const r of registrants) {
      const row: Record<string, string> = {
        sponsorName,
        sponsorshipLevel: deliverable.sponsorshipLevel,
        deliverableName: deliverable.deliverableName,
        name: r.name ?? "",
        firstName: r.firstName ?? "",
        lastName: r.lastName ?? "",
        email: r.email ?? "",
        title: r.title ?? "",
        conciergeRole: r.conciergeRole ?? "",
        registrationStatus: r.registrationStatus ?? "Unknown",
      };
      csvLines.push(headers.map(h => csvSafe(row[h] ?? "")).join(","));
    }

    return csvLines.join("\n");
  }

  // ── Internal Notification Email ─────────────────────────────────────────────

  async getInternalNotificationEmail(): Promise<string> {
    const branding = await this.getBranding();
    return branding.internalNotificationEmail ?? "";
  }

  async setInternalNotificationEmail(email: string): Promise<void> {
    await this.updateBranding({ internalNotificationEmail: email });
  }

  async getBackupSchedule(): Promise<BackupScheduleConfig> {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "backup_schedule")).limit(1);
    if (!row) return { ...DEFAULT_BACKUP_SCHEDULE };
    return { ...DEFAULT_BACKUP_SCHEDULE, ...(row.value as Partial<BackupScheduleConfig>) };
  }

  async updateBackupSchedule(updates: Partial<BackupScheduleConfig>): Promise<BackupScheduleConfig> {
    const current = await this.getBackupSchedule();
    const merged = { ...current, ...updates };
    await db
      .insert(appConfig)
      .values({ key: "backup_schedule", value: merged })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: merged } });
    return merged;
  }

  // ── Email Settings ─────────────────────────────────────────────────────────

  async getEmailSettings(): Promise<EmailSettings> {
    const [row] = await db.select().from(appConfig).where(eq(appConfig.key, "email_settings")).limit(1);
    if (!row) return { ...DEFAULT_EMAIL_SETTINGS };
    return { ...DEFAULT_EMAIL_SETTINGS, ...(row.value as Partial<EmailSettings>) };
  }

  async updateEmailSettings(updates: Partial<EmailSettings>): Promise<EmailSettings> {
    const current = await this.getEmailSettings();
    const merged = { ...current, ...updates };
    await db
      .insert(appConfig)
      .values({ key: "email_settings", value: merged })
      .onConflictDoUpdate({ target: appConfig.key, set: { value: merged } });
    return merged;
  }

  // ── Meeting Invitations ────────────────────────────────────────────────────

  async createMeetingInvitation(data: InsertMeetingInvitation): Promise<MeetingInvitation> {
    const [inv] = await db.insert(meetingInvitations).values(data).returning();
    return inv;
  }

  async getMeetingInvitation(id: string): Promise<MeetingInvitation | undefined> {
    const [inv] = await db.select().from(meetingInvitations).where(eq(meetingInvitations.id, id));
    return inv;
  }

  async getMeetingInvitationByToken(token: string): Promise<MeetingInvitation | undefined> {
    const [inv] = await db.select().from(meetingInvitations).where(eq(meetingInvitations.secureToken, token));
    return inv;
  }

  async listMeetingInvitations(filters: { eventId?: string; sponsorId?: string; attendeeId?: string; status?: MeetingInvitationStatus }): Promise<MeetingInvitation[]> {
    const conditions: any[] = [];
    if (filters.eventId) conditions.push(eq(meetingInvitations.eventId, filters.eventId));
    if (filters.sponsorId) conditions.push(eq(meetingInvitations.sponsorId, filters.sponsorId));
    if (filters.attendeeId) conditions.push(eq(meetingInvitations.attendeeId, filters.attendeeId));
    if (filters.status) conditions.push(eq(meetingInvitations.status, filters.status));
    if (conditions.length === 0) return db.select().from(meetingInvitations).orderBy(desc(meetingInvitations.createdAt));
    return db.select().from(meetingInvitations).where(and(...conditions)).orderBy(desc(meetingInvitations.createdAt));
  }

  async updateMeetingInvitation(id: string, updates: Partial<InsertMeetingInvitation>): Promise<MeetingInvitation | undefined> {
    const [inv] = await db.update(meetingInvitations).set({ ...updates, updatedAt: new Date() }).where(eq(meetingInvitations.id, id)).returning();
    return inv;
  }

  async countSponsorInvitations(sponsorId: string, eventId: string): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(meetingInvitations)
      .where(and(eq(meetingInvitations.sponsorId, sponsorId), eq(meetingInvitations.eventId, eventId)));
    return row?.count ?? 0;
  }

  async countAttendeeInvitations(attendeeId: string, eventId: string): Promise<number> {
    const [row] = await db.select({ count: sql<number>`count(*)::int` }).from(meetingInvitations)
      .where(and(eq(meetingInvitations.attendeeId, attendeeId), eq(meetingInvitations.eventId, eventId)));
    return row?.count ?? 0;
  }

  async getAttendeeCategories(): Promise<AttendeeCategoryDef[]> {
    return db.select().from(attendeeCategories).orderBy(attendeeCategories.sortOrder);
  }
  async getAttendeeCategory(id: string): Promise<AttendeeCategoryDef | undefined> {
    const [row] = await db.select().from(attendeeCategories).where(eq(attendeeCategories.id, id)).limit(1);
    return row;
  }
  async getAttendeeCategoryByKey(key: string): Promise<AttendeeCategoryDef | undefined> {
    const [row] = await db.select().from(attendeeCategories).where(eq(attendeeCategories.key, key)).limit(1);
    return row;
  }
  async createAttendeeCategory(data: InsertAttendeeCategoryDef): Promise<AttendeeCategoryDef> {
    const [row] = await db.insert(attendeeCategories).values(data).returning();
    return row;
  }
  async updateAttendeeCategory(id: string, updates: Partial<InsertAttendeeCategoryDef>): Promise<AttendeeCategoryDef | undefined> {
    const [row] = await db.update(attendeeCategories).set({ ...updates, updatedAt: new Date() }).where(eq(attendeeCategories.id, id)).returning();
    return row;
  }
  async deleteAttendeeCategory(id: string): Promise<void> {
    await db.delete(attendeeCategories).where(eq(attendeeCategories.id, id));
  }

  async getCategoryMatchingRules(): Promise<CategoryMatchingRule[]> {
    return db.select().from(categoryMatchingRules).orderBy(categoryMatchingRules.priority);
  }
  async getCategoryMatchingRule(id: string): Promise<CategoryMatchingRule | undefined> {
    const [row] = await db.select().from(categoryMatchingRules).where(eq(categoryMatchingRules.id, id)).limit(1);
    return row;
  }
  async createCategoryMatchingRule(data: InsertCategoryMatchingRule): Promise<CategoryMatchingRule> {
    const [row] = await db.insert(categoryMatchingRules).values(data).returning();
    return row;
  }
  async updateCategoryMatchingRule(id: string, updates: Partial<InsertCategoryMatchingRule>): Promise<CategoryMatchingRule | undefined> {
    const [row] = await db.update(categoryMatchingRules).set({ ...updates, updatedAt: new Date() }).where(eq(categoryMatchingRules.id, id)).returning();
    return row;
  }
  async deleteCategoryMatchingRule(id: string): Promise<void> {
    await db.delete(categoryMatchingRules).where(eq(categoryMatchingRules.id, id));
  }

  // ── Agenda: Session Types ───────────────────────────────────────────────

  async getSessionTypes(): Promise<SessionType[]> {
    return db.select().from(sessionTypes).orderBy(sessionTypes.displayOrder);
  }
  async getSessionType(id: string): Promise<SessionType | undefined> {
    const [row] = await db.select().from(sessionTypes).where(eq(sessionTypes.id, id)).limit(1);
    return row;
  }
  async getSessionTypeByKey(key: string): Promise<SessionType | undefined> {
    const [row] = await db.select().from(sessionTypes).where(eq(sessionTypes.key, key)).limit(1);
    return row;
  }
  async createSessionType(data: InsertSessionType): Promise<SessionType> {
    const [row] = await db.insert(sessionTypes).values(data).returning();
    return row;
  }
  async updateSessionType(id: string, updates: Partial<InsertSessionType>): Promise<SessionType | undefined> {
    const [row] = await db.update(sessionTypes).set({ ...updates, updatedAt: new Date() }).where(eq(sessionTypes.id, id)).returning();
    return row;
  }
  async deleteSessionType(id: string): Promise<void> {
    await db.delete(sessionTypes).where(eq(sessionTypes.id, id));
  }

  // ── Agenda: Sessions ────────────────────────────────────────────────────

  async getAgendaSessions(eventId?: string): Promise<AgendaSession[]> {
    if (eventId) {
      return db.select().from(agendaSessions).where(eq(agendaSessions.eventId, eventId)).orderBy(agendaSessions.sessionDate, agendaSessions.startTime, agendaSessions.displayOrder);
    }
    return db.select().from(agendaSessions).orderBy(agendaSessions.sessionDate, agendaSessions.startTime, agendaSessions.displayOrder);
  }
  async getAgendaSession(id: string): Promise<AgendaSession | undefined> {
    const [row] = await db.select().from(agendaSessions).where(eq(agendaSessions.id, id)).limit(1);
    return row;
  }
  async getAgendaSessionByCode(eventId: string, sessionCode: string): Promise<AgendaSession | undefined> {
    const [row] = await db.select().from(agendaSessions).where(and(eq(agendaSessions.eventId, eventId), eq(agendaSessions.sessionCode, sessionCode))).limit(1);
    return row;
  }
  async createAgendaSession(data: InsertAgendaSession): Promise<AgendaSession> {
    const [row] = await db.insert(agendaSessions).values(data).returning();
    return row;
  }
  async updateAgendaSession(id: string, updates: Partial<InsertAgendaSession>): Promise<AgendaSession | undefined> {
    const [row] = await db.update(agendaSessions).set({ ...updates, updatedAt: new Date() }).where(eq(agendaSessions.id, id)).returning();
    return row;
  }
  async deleteAgendaSession(id: string): Promise<void> {
    await db.delete(agendaSessionSpeakers).where(eq(agendaSessionSpeakers.sessionId, id));
    await db.delete(attendeeSavedSessions).where(eq(attendeeSavedSessions.sessionId, id));
    await db.delete(agendaSessions).where(eq(agendaSessions.id, id));
  }

  // ── Agenda: Session Speakers ────────────────────────────────────────────

  async getSessionSpeakers(sessionId: string): Promise<AgendaSessionSpeaker[]> {
    return db.select().from(agendaSessionSpeakers).where(eq(agendaSessionSpeakers.sessionId, sessionId)).orderBy(agendaSessionSpeakers.speakerOrder);
  }
  async createSessionSpeaker(data: InsertAgendaSessionSpeaker): Promise<AgendaSessionSpeaker> {
    const [row] = await db.insert(agendaSessionSpeakers).values(data).returning();
    return row;
  }
  async updateSessionSpeaker(id: string, updates: Partial<InsertAgendaSessionSpeaker>): Promise<AgendaSessionSpeaker | undefined> {
    const [row] = await db.update(agendaSessionSpeakers).set({ ...updates, updatedAt: new Date() }).where(eq(agendaSessionSpeakers.id, id)).returning();
    return row;
  }
  async deleteSessionSpeaker(id: string): Promise<void> {
    await db.delete(agendaSessionSpeakers).where(eq(agendaSessionSpeakers.id, id));
  }
  async deleteSessionSpeakersBySession(sessionId: string): Promise<void> {
    await db.delete(agendaSessionSpeakers).where(eq(agendaSessionSpeakers.sessionId, sessionId));
  }

  // ── Agenda: Attendee Saved Sessions ─────────────────────────────────────

  async getAttendeeSavedSessions(attendeeId: string, eventId: string): Promise<AttendeeSavedSession[]> {
    return db.select().from(attendeeSavedSessions).where(and(eq(attendeeSavedSessions.attendeeId, attendeeId), eq(attendeeSavedSessions.eventId, eventId)));
  }
  async createAttendeeSavedSession(data: InsertAttendeeSavedSession): Promise<AttendeeSavedSession> {
    const [row] = await db.insert(attendeeSavedSessions).values(data).returning();
    return row;
  }
  async deleteAttendeeSavedSession(id: string): Promise<void> {
    await db.delete(attendeeSavedSessions).where(eq(attendeeSavedSessions.id, id));
  }
  async countAttendeeSavedSessions(attendeeId: string, eventId: string): Promise<number> {
    const result = await db.select({ count: sql<number>`count(*)::int` }).from(attendeeSavedSessions).where(and(eq(attendeeSavedSessions.attendeeId, attendeeId), eq(attendeeSavedSessions.eventId, eventId)));
    return result[0]?.count ?? 0;
  }

  // ── Agenda: Import Jobs ─────────────────────────────────────────────────

  async getAgendaImportJobs(eventId?: string): Promise<AgendaImportJob[]> {
    if (eventId) {
      return db.select().from(agendaImportJobs).where(eq(agendaImportJobs.eventId, eventId)).orderBy(desc(agendaImportJobs.createdAt));
    }
    return db.select().from(agendaImportJobs).orderBy(desc(agendaImportJobs.createdAt));
  }
  async createAgendaImportJob(data: InsertAgendaImportJob): Promise<AgendaImportJob> {
    const [row] = await db.insert(agendaImportJobs).values(data).returning();
    return row;
  }
  async updateAgendaImportJob(id: string, updates: Partial<InsertAgendaImportJob>): Promise<AgendaImportJob | undefined> {
    const [row] = await db.update(agendaImportJobs).set(updates).where(eq(agendaImportJobs.id, id)).returning();
    return row;
  }
}
