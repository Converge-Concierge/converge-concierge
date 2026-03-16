import {
  type User, type InsertUser,
  type Event, type InsertEvent,
  type Sponsor, type InsertSponsor,
  type Attendee, type InsertAttendee,
  type Meeting, type InsertMeeting,
  type SponsorToken,
  type SponsorNotification, type SponsorNotificationType,
  type AppSettings, type AppBranding,
  type PasswordResetToken,
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
  DEFAULT_SETTINGS, DEFAULT_BRANDING, DEFAULT_USER_PERMISSIONS,
} from "@shared/schema";

export interface AttendeeDetailMeeting {
  id: string;
  sponsorId: string;
  sponsorName: string;
  eventId: string;
  eventName: string;
  eventSlug: string;
  date: string;
  time: string;
  meetingType: string;
  status: string;
  location: string;
  platform: string | null;
  source: string;
}

export interface AttendeeDetail extends Attendee {
  eventName: string;
  eventSlug: string;
  meetingsList: AttendeeDetailMeeting[];
}

export interface DataExchangeLogInsert {
  category: "sponsors" | "attendees" | "meetings" | "nunify-meetings";
  operation: "import" | "export";
  adminUser: string;
  fileName?: string;
  eventId?: string;
  eventCode?: string;
  totalRows: number;
  importedCount: number;
  updatedCount: number;
  rejectedCount: number;
}

export interface NunifyMeetingRow {
  Id?: string;
  Title: string;
  Attendees: string;
  "Attendees Emails": string;
  Date: string;
  "Start Time": string;
  "End Time": string;
  "Meeting Room": string;
  Description: string;
  Status: string;
}
import { randomUUID, randomBytes } from "crypto";
import { DatabaseStorage } from "./database-storage";

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

export type UpdateUser = Partial<Omit<InsertUser, "password"> & { password?: string }>;

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: UpdateUser): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // Events
  getEvents(): Promise<Event[]>;
  getEvent(id: string): Promise<Event | undefined>;
  getEventBySlug(slug: string): Promise<Event | undefined>;
  createEvent(event: InsertEvent): Promise<Event>;
  updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined>;
  deleteEvent(id: string): Promise<void>;

  // Sponsors
  getSponsors(): Promise<Sponsor[]>;
  getSponsor(id: string): Promise<Sponsor | undefined>;
  createSponsor(sponsor: InsertSponsor): Promise<Sponsor>;
  updateSponsor(id: string, updates: Partial<InsertSponsor>): Promise<Sponsor | undefined>;
  deleteSponsor(id: string): Promise<void>;

  // Attendees
  getAttendees(): Promise<Attendee[]>;
  getAttendee(id: string): Promise<Attendee | undefined>;
  getAttendeeWithDetail(id: string): Promise<AttendeeDetail | undefined>;
  getAttendeeByEmail(email: string): Promise<Attendee | undefined>;
  getAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined>;
  getArchivedAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined>;
  createAttendee(attendee: InsertAttendee): Promise<Attendee>;
  updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined>;
  deleteAttendee(id: string): Promise<void>;
  mergeAttendeeInterests(id: string, newInterests: string[]): Promise<void>;

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  getMeetingConflict(eventId: string, sponsorId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined>;
  getAttendeeConflict(eventId: string, attendeeId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined>;
  getLocationConflict(eventId: string, location: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined>;
  updateMeetingReminderFlags(id: string, flags: { reminder24SentAt?: Date; reminder2SentAt?: Date }): Promise<void>;
  getMeetingsDueForReminders(): Promise<Meeting[]>;
  cascadeArchiveEvent(eventId: string): Promise<void>;
  cascadeUnarchiveEvent(eventId: string): Promise<void>;

  // Sponsor tokens
  getSponsorToken(token: string): Promise<SponsorToken | undefined>;
  getSponsorTokensBySponsor(sponsorId: string): Promise<SponsorToken[]>;
  createSponsorToken(sponsorId: string, eventId: string): Promise<SponsorToken>;
  revokeSponsorToken(token: string): Promise<SponsorToken | undefined>;
  deleteSponsorToken(token: string): Promise<void>;

  // Sponsor notifications
  createNotification(n: Omit<SponsorNotification, "id" | "createdAt">): Promise<SponsorNotification>;
  getNotificationsForSponsorEvent(sponsorId: string, eventId: string): Promise<SponsorNotification[]>;
  markNotificationRead(id: string): Promise<void>;
  markAllNotificationsRead(sponsorId: string, eventId: string): Promise<void>;

  // App settings (single global record)
  getSettings(): Promise<AppSettings>;
  updateSettings(updates: Partial<AppSettings>): Promise<AppSettings>;

  // App branding (single global record)
  getBranding(): Promise<AppBranding>;
  updateBranding(updates: Partial<AppBranding>): Promise<AppBranding>;

  // Password reset tokens
  createPasswordResetToken(userId: string): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markResetTokenUsed(token: string): Promise<void>;
  updateUserPassword(userId: string, newPassword: string): Promise<void>;

  // Data exchange logs
  createDataExchangeLog(data: DataExchangeLogInsert): Promise<DataExchangeLog>;
  getDataExchangeLogs(): Promise<DataExchangeLog[]>;

  // Nunify meeting sync
  markMeetingsNunifyExported(meetingIds: string[], adminUser: string): Promise<void>;

  // User permissions
  getUserPermissions(userId: string): Promise<UserPermissionRecord | undefined>;
  upsertUserPermissions(userId: string, permissions: UserPermissions, changedBy: string, targetUserName: string, previousPermissions?: UserPermissions): Promise<UserPermissionRecord>;
  getPermissionAuditLogs(userId?: string): Promise<PermissionAuditLog[]>;

  // Information Requests
  createInformationRequest(data: InsertInformationRequest): Promise<InformationRequest>;
  getInformationRequest(id: string): Promise<InformationRequest | undefined>;
  listInformationRequests(filters?: { eventId?: string; sponsorId?: string; status?: InformationRequestStatus }): Promise<InformationRequest[]>;
  updateInformationRequestStatus(id: string, status: InformationRequestStatus): Promise<InformationRequest | undefined>;
  updateInformationRequest(id: string, data: Partial<{ attendeeFirstName: string; attendeeLastName: string; attendeeEmail: string; attendeeCompany: string; attendeeTitle: string; message: string | null; status: InformationRequestStatus; notes: string | null }>): Promise<InformationRequest | undefined>;
  deleteInformationRequest(id: string): Promise<boolean>;

  // Scheduled Emails
  createScheduledEmail(data: import("@shared/schema").InsertScheduledEmail): Promise<import("@shared/schema").ScheduledEmail>;
  listScheduledEmails(filters?: { eventId?: string; sponsorId?: string; status?: string }): Promise<import("@shared/schema").ScheduledEmail[]>;
  getScheduledEmail(id: string): Promise<import("@shared/schema").ScheduledEmail | undefined>;
  updateScheduledEmail(id: string, data: Partial<{ status: string; scheduledAt: Date; subject: string; recipientEmail: string; recipientName: string; errorMessage: string | null; sentAt: Date | null }>): Promise<import("@shared/schema").ScheduledEmail | undefined>;
  deleteScheduledEmail(id: string): Promise<boolean>;

  // Sponsor analytics
  createAnalyticsEvent(data: { sponsorId: string; eventId: string; eventType: string }): Promise<void>;
  getAnalyticsSummary(sponsorId: string, eventId: string): Promise<{ profileViews: number; meetingCtaClicks: number }>;

  // Email logs
  createEmailLog(data: { emailType: string; recipientEmail: string; subject: string; htmlContent?: string | null; eventId?: string | null; sponsorId?: string | null; attendeeId?: string | null; status: "sent" | "failed"; errorMessage?: string | null; resendOfId?: string | null; providerMessageId?: string | null; source?: string | null; templateId?: string | null }): Promise<string>;
  listEmailLogs(filters?: { emailType?: string; status?: string; eventId?: string; sponsorId?: string; source?: string; search?: string; from?: Date; to?: Date }, limit?: number, offset?: number): Promise<EmailLog[]>;
  getEmailLog(id: string): Promise<EmailLog | undefined>;
  getEmailLogByProviderMessageId(providerMessageId: string): Promise<EmailLog | undefined>;
  updateEmailLogDelivery(id: string, updates: { status?: string; deliveredAt?: Date; openedAt?: Date; clickedAt?: Date; bouncedAt?: Date; bounceReason?: string; providerStatus?: string }): Promise<void>;

  // Sponsor Users & Magic Login
  upsertSponsorUser(data: { sponsorId: string; name: string; email: string; accessLevel?: string; isPrimary?: boolean }): Promise<SponsorUser>;
  getSponsorUserByEmail(email: string): Promise<SponsorUser | undefined>;
  getSponsorUsersBySponsor(sponsorId: string): Promise<SponsorUser[]>;
  getSponsorUserById(id: string): Promise<SponsorUser | undefined>;
  createSponsorUser(data: { sponsorId: string; name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }): Promise<SponsorUser>;
  updateSponsorUser(id: string, data: Partial<{ name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }>): Promise<SponsorUser>;
  setSponsorUserPrimary(id: string, sponsorId: string): Promise<void>;
  deleteSponsorUser(id: string): Promise<void>;
  updateSponsorUserLastLogin(id: string): Promise<void>;
  getAllSponsorUsers(): Promise<SponsorUser[]>;
  createSponsorLoginToken(data: { sponsorUserId: string; sponsorId: string; tokenHash: string; expiresAt: Date }): Promise<SponsorLoginToken>;
  getSponsorLoginTokenByHash(tokenHash: string): Promise<SponsorLoginToken | undefined>;
  markSponsorLoginTokenUsed(id: string): Promise<void>;
  invalidateSponsorLoginTokens(sponsorUserId: string): Promise<void>;

  // Email Templates
  getEmailTemplates(): Promise<EmailTemplate[]>;
  getEmailTemplateByKey(key: string): Promise<EmailTemplate | undefined>;
  getEmailTemplateById(id: string): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(data: { templateKey: string; displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate?: string | null; description?: string | null; variables?: string[]; isActive?: boolean }): Promise<EmailTemplate>;
  updateEmailTemplate(id: string, data: Partial<{ displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate: string | null; description: string | null; isActive: boolean }>): Promise<EmailTemplate>;

  // ── Agreement Deliverables ────────────────────────────────────────────────
  listPackageTemplates(filters?: { sponsorshipLevel?: string; isArchived?: boolean }): Promise<PackageTemplate[]>;
  getPackageTemplate(id: string): Promise<PackageTemplate | undefined>;
  createPackageTemplate(data: InsertPackageTemplate): Promise<PackageTemplate>;
  updatePackageTemplate(id: string, data: Partial<InsertPackageTemplate>): Promise<PackageTemplate>;
  archivePackageTemplate(id: string): Promise<PackageTemplate>;
  duplicatePackageTemplate(id: string, newName: string): Promise<PackageTemplate>;

  listDeliverableTemplateItems(packageTemplateId: string): Promise<DeliverableTemplateItem[]>;
  getDeliverableTemplateItem(id: string): Promise<DeliverableTemplateItem | undefined>;
  createDeliverableTemplateItem(data: InsertDeliverableTemplateItem): Promise<DeliverableTemplateItem>;
  updateDeliverableTemplateItem(id: string, data: Partial<InsertDeliverableTemplateItem>): Promise<DeliverableTemplateItem>;
  deleteDeliverableTemplateItem(id: string): Promise<void>;

  listAgreementDeliverables(filters: { sponsorId?: string; eventId?: string; packageTemplateId?: string }): Promise<AgreementDeliverable[]>;
  getAgreementDeliverable(id: string): Promise<AgreementDeliverable | undefined>;
  createAgreementDeliverable(data: InsertAgreementDeliverable): Promise<AgreementDeliverable>;
  updateAgreementDeliverable(id: string, data: Partial<InsertAgreementDeliverable>): Promise<AgreementDeliverable>;
  deleteAgreementDeliverable(id: string): Promise<void>;
  generateAgreementDeliverablesFromTemplate(sponsorId: string, eventId: string, packageTemplateId: string, sponsorshipLevel: string): Promise<AgreementDeliverable[]>;

  listDeliverableRegistrants(agreementDeliverableId: string): Promise<AgreementDeliverableRegistrant[]>;
  createDeliverableRegistrant(data: InsertAgreementDeliverableRegistrant): Promise<AgreementDeliverableRegistrant>;
  updateDeliverableRegistrant(id: string, data: Partial<InsertAgreementDeliverableRegistrant>): Promise<AgreementDeliverableRegistrant>;
  deleteDeliverableRegistrant(id: string): Promise<void>;

  listDeliverableSpeakers(agreementDeliverableId: string): Promise<AgreementDeliverableSpeaker[]>;
  createDeliverableSpeaker(data: InsertAgreementDeliverableSpeaker): Promise<AgreementDeliverableSpeaker>;
  updateDeliverableSpeaker(id: string, data: Partial<InsertAgreementDeliverableSpeaker>): Promise<AgreementDeliverableSpeaker>;
  deleteDeliverableSpeaker(id: string): Promise<void>;

  listDeliverableReminders(filters: { sponsorId?: string; eventId?: string }): Promise<AgreementDeliverableReminder[]>;
  getLastDeliverableReminder(sponsorId: string, eventId: string): Promise<AgreementDeliverableReminder | undefined>;
  createDeliverableReminder(data: InsertAgreementDeliverableReminder): Promise<AgreementDeliverableReminder>;

  // ── File Assets ────────────────────────────────────────────────────────────
  listFileAssets(filters: { sponsorId?: string; eventId?: string; deliverableId?: string; status?: string }): Promise<FileAsset[]>;
  getFileAsset(id: string): Promise<FileAsset | undefined>;
  createFileAsset(data: InsertFileAsset): Promise<FileAsset>;
  updateFileAsset(id: string, data: Partial<InsertFileAsset>): Promise<FileAsset>;
  archiveFileAsset(id: string): Promise<FileAsset>;
  replaceFileAsset(oldId: string, newData: InsertFileAsset): Promise<FileAsset>;

  // ── Deliverable Links ──────────────────────────────────────────────────────
  listDeliverableLinks(deliverableId: string): Promise<DeliverableLink[]>;
  createDeliverableLink(data: InsertDeliverableLink): Promise<DeliverableLink>;
  deleteDeliverableLink(id: string): Promise<void>;

  // ── Deliverable Social Entries ─────────────────────────────────────────────
  listDeliverableSocialEntries(deliverableId: string): Promise<DeliverableSocialEntry[]>;
  getDeliverableSocialEntry(id: string): Promise<DeliverableSocialEntry | undefined>;
  createDeliverableSocialEntry(data: InsertDeliverableSocialEntry): Promise<DeliverableSocialEntry>;
  updateDeliverableSocialEntry(id: string, data: Partial<InsertDeliverableSocialEntry>): Promise<DeliverableSocialEntry>;
  deleteDeliverableSocialEntry(id: string): Promise<void>;

  // ── Attendee CSV Helpers ────────────────────────────────────────────────────
  generateAttendeeContactListCsv(deliverableId: string, type?: "full" | "partial"): Promise<string>;

  // ── Internal Notification Email ─────────────────────────────────────────────
  getInternalNotificationEmail(): Promise<string>;
  setInternalNotificationEmail(email: string): Promise<void>;

  // ── Backup Schedule ───────────────────────────────────────────────────────
  getBackupSchedule(): Promise<import("@shared/schema").BackupScheduleConfig>;
  updateBackupSchedule(updates: Partial<import("@shared/schema").BackupScheduleConfig>): Promise<import("@shared/schema").BackupScheduleConfig>;

  // ── Meeting Invitations ────────────────────────────────────────────────────
  createMeetingInvitation(data: InsertMeetingInvitation): Promise<MeetingInvitation>;
  getMeetingInvitation(id: string): Promise<MeetingInvitation | undefined>;
  getMeetingInvitationByToken(token: string): Promise<MeetingInvitation | undefined>;
  listMeetingInvitations(filters: { eventId?: string; sponsorId?: string; attendeeId?: string; status?: MeetingInvitationStatus }): Promise<MeetingInvitation[]>;
  updateMeetingInvitation(id: string, updates: Partial<InsertMeetingInvitation>): Promise<MeetingInvitation | undefined>;
  countSponsorInvitations(sponsorId: string, eventId: string): Promise<number>;
  countAttendeeInvitations(attendeeId: string, eventId: string): Promise<number>;

  // ── Attendee Category Definitions ────────────────────────────────────────
  getAttendeeCategories(): Promise<AttendeeCategoryDef[]>;
  getAttendeeCategory(id: string): Promise<AttendeeCategoryDef | undefined>;
  getAttendeeCategoryByKey(key: string): Promise<AttendeeCategoryDef | undefined>;
  createAttendeeCategory(data: InsertAttendeeCategoryDef): Promise<AttendeeCategoryDef>;
  updateAttendeeCategory(id: string, updates: Partial<InsertAttendeeCategoryDef>): Promise<AttendeeCategoryDef | undefined>;
  deleteAttendeeCategory(id: string): Promise<void>;

  // ── Category Matching Rules ──────────────────────────────────────────────
  getCategoryMatchingRules(): Promise<CategoryMatchingRule[]>;
  getCategoryMatchingRule(id: string): Promise<CategoryMatchingRule | undefined>;
  createCategoryMatchingRule(data: InsertCategoryMatchingRule): Promise<CategoryMatchingRule>;
  updateCategoryMatchingRule(id: string, updates: Partial<InsertCategoryMatchingRule>): Promise<CategoryMatchingRule | undefined>;
  deleteCategoryMatchingRule(id: string): Promise<void>;

  // ── Agenda: Session Types ───────────────────────────────────────────────
  getSessionTypes(): Promise<SessionType[]>;
  getSessionType(id: string): Promise<SessionType | undefined>;
  getSessionTypeByKey(key: string): Promise<SessionType | undefined>;
  createSessionType(data: InsertSessionType): Promise<SessionType>;
  updateSessionType(id: string, updates: Partial<InsertSessionType>): Promise<SessionType | undefined>;
  deleteSessionType(id: string): Promise<void>;

  // ── Agenda: Sessions ────────────────────────────────────────────────────
  getAgendaSessions(eventId?: string): Promise<AgendaSession[]>;
  getAgendaSession(id: string): Promise<AgendaSession | undefined>;
  getAgendaSessionByCode(eventId: string, sessionCode: string): Promise<AgendaSession | undefined>;
  createAgendaSession(data: InsertAgendaSession): Promise<AgendaSession>;
  updateAgendaSession(id: string, updates: Partial<InsertAgendaSession>): Promise<AgendaSession | undefined>;
  deleteAgendaSession(id: string): Promise<void>;

  // ── Agenda: Session Speakers ────────────────────────────────────────────
  getSessionSpeakers(sessionId: string): Promise<AgendaSessionSpeaker[]>;
  createSessionSpeaker(data: InsertAgendaSessionSpeaker): Promise<AgendaSessionSpeaker>;
  updateSessionSpeaker(id: string, updates: Partial<InsertAgendaSessionSpeaker>): Promise<AgendaSessionSpeaker | undefined>;
  deleteSessionSpeaker(id: string): Promise<void>;
  deleteSessionSpeakersBySession(sessionId: string): Promise<void>;

  // ── Agenda: Attendee Saved Sessions ─────────────────────────────────────
  getAttendeeSavedSessions(attendeeId: string, eventId: string): Promise<AttendeeSavedSession[]>;
  createAttendeeSavedSession(data: InsertAttendeeSavedSession): Promise<AttendeeSavedSession>;
  deleteAttendeeSavedSession(id: string): Promise<void>;
  countAttendeeSavedSessions(attendeeId: string, eventId: string): Promise<number>;

  // ── Agenda: Import Jobs ─────────────────────────────────────────────────
  getAgendaImportJobs(eventId?: string): Promise<AgendaImportJob[]>;
  createAgendaImportJob(data: InsertAgendaImportJob): Promise<AgendaImportJob>;
  updateAgendaImportJob(id: string, updates: Partial<InsertAgendaImportJob>): Promise<AgendaImportJob | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private events: Map<string, Event>;
  private sponsors: Map<string, Sponsor>;
  private attendees: Map<string, Attendee>;
  private meetings: Map<string, Meeting>;
  private sponsorTokens: Map<string, SponsorToken>;
  private notifications: Map<string, SponsorNotification>;
  private appSettings: AppSettings;
  private appBranding: AppBranding;
  private passwordResetTokens: Map<string, PasswordResetToken>;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.sponsors = new Map();
    this.attendees = new Map();
    this.meetings = new Map();
    this.sponsorTokens = new Map();
    this.notifications = new Map();
    this.appSettings = { ...DEFAULT_SETTINGS };
    this.appBranding = { ...DEFAULT_BRANDING };
    this.passwordResetTokens = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find((u) => u.username === username);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (u) => u.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = {
      id,
      username: insertUser.email ?? "",
      password: insertUser.password,
      name: insertUser.name ?? "",
      email: insertUser.email ?? "",
      role: (insertUser.role ?? "manager") as "admin" | "manager",
      isActive: insertUser.isActive ?? true,
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: string, updates: UpdateUser): Promise<User | undefined> {
    const existing = this.users.get(id);
    if (!existing) return undefined;
    const updated: User = { ...existing, ...updates };
    this.users.set(id, updated);
    return updated;
  }

  async deleteUser(id: string): Promise<void> {
    this.users.delete(id);
  }

  // Events
  async getEvents(): Promise<Event[]> {
    return Array.from(this.events.values());
  }

  async getEvent(id: string): Promise<Event | undefined> {
    return this.events.get(id);
  }

  async getEventBySlug(slug: string): Promise<Event | undefined> {
    return Array.from(this.events.values()).find((e) => e.slug === slug);
  }

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      id,
      archiveState: insertEvent.archiveState ?? "active",
      archiveSource: insertEvent.archiveSource ?? null,
      meetingLocations: insertEvent.meetingLocations || [],
      meetingBlocks: insertEvent.meetingBlocks || [],
    } as Event;
    this.events.set(id, event);
    return event;
  }

  async updateEvent(id: string, updates: Partial<InsertEvent>): Promise<Event | undefined> {
    const existing = this.events.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates } as Event;
    this.events.set(id, updated);
    return updated;
  }

  async deleteEvent(id: string): Promise<void> {
    this.events.delete(id);
  }

  // Sponsors
  async getSponsors(): Promise<Sponsor[]> {
    return Array.from(this.sponsors.values());
  }

  async getSponsor(id: string): Promise<Sponsor | undefined> {
    return this.sponsors.get(id);
  }

  async createSponsor(insertSponsor: InsertSponsor): Promise<Sponsor> {
    const id = randomUUID();
    const sponsor: Sponsor = {
      ...insertSponsor,
      id,
      archiveState: insertSponsor.archiveState ?? "active",
      archiveSource: insertSponsor.archiveSource ?? null,
      assignedEvents: insertSponsor.assignedEvents || [],
    } as Sponsor;
    this.sponsors.set(id, sponsor);
    return sponsor;
  }

  async updateSponsor(id: string, updates: Partial<InsertSponsor>): Promise<Sponsor | undefined> {
    const existing = this.sponsors.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates } as Sponsor;
    this.sponsors.set(id, updated);
    return updated;
  }

  async deleteSponsor(id: string): Promise<void> {
    this.sponsors.delete(id);
  }

  // Attendees
  async getAttendees(): Promise<Attendee[]> {
    return Array.from(this.attendees.values());
  }

  async getAttendee(id: string): Promise<Attendee | undefined> {
    return this.attendees.get(id);
  }

  async getAttendeeByEmail(email: string): Promise<Attendee | undefined> {
    return Array.from(this.attendees.values()).find(
      (a) => a.email.toLowerCase() === email.toLowerCase()
    );
  }

  async getAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined> {
    return Array.from(this.attendees.values()).find(
      (a) =>
        a.email.toLowerCase() === email.toLowerCase() &&
        a.assignedEvent === eventId &&
        (a.archiveState ?? "active") === "active"
    );
  }

  async getArchivedAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined> {
    return Array.from(this.attendees.values()).find(
      (a) =>
        a.email.toLowerCase() === email.toLowerCase() &&
        a.assignedEvent === eventId &&
        a.archiveState === "archived"
    );
  }

  async createAttendee(insertAttendee: InsertAttendee): Promise<Attendee> {
    const id = randomUUID();
    // Ensure firstName/lastName/name are all consistent
    let { firstName, lastName, name } = insertAttendee as any;
    if (!firstName && !lastName && name) {
      const split = splitName(name);
      firstName = split.firstName;
      lastName = split.lastName;
    }
    const computedName = buildFullName(firstName, lastName, name);
    const attendee: Attendee = {
      archiveState: "active",
      archiveSource: null,
      ...insertAttendee,
      firstName: firstName ?? "",
      lastName: lastName ?? "",
      name: computedName,
      id,
    } as Attendee;
    this.attendees.set(id, attendee);
    return attendee;
  }

  async updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined> {
    const existing = this.attendees.get(id);
    if (!existing) return undefined;
    const merged = { ...existing, ...updates } as any;
    // Recompute name if firstName or lastName changed
    if (updates.firstName !== undefined || updates.lastName !== undefined) {
      merged.name = buildFullName(merged.firstName, merged.lastName, merged.name);
    }
    this.attendees.set(id, merged);
    return merged;
  }

  async deleteAttendee(id: string): Promise<void> {
    this.attendees.delete(id);
  }

  async getAttendeeWithDetail(id: string): Promise<AttendeeDetail | undefined> {
    const attendee = this.attendees.get(id);
    if (!attendee) return undefined;
    const event = this.events.get(attendee.assignedEvent);
    const meetingsList = Array.from(this.meetings.values())
      .filter((m) => m.attendeeId === id)
      .map((m) => {
        const sponsor = this.sponsors.get(m.sponsorId);
        const ev = this.events.get(m.eventId);
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
      });
    return { ...attendee, eventName: event?.name ?? "", eventSlug: event?.slug ?? "", meetingsList };
  }

  async mergeAttendeeInterests(id: string, newInterests: string[]): Promise<void> {
    const existing = this.attendees.get(id);
    if (!existing) return;
    const merged = Array.from(new Set([...(existing.interests ?? []), ...newInterests]));
    this.attendees.set(id, { ...existing, interests: merged, updatedAt: new Date() });
  }

  // Meetings
  async getMeetings(): Promise<Meeting[]> {
    return Array.from(this.meetings.values());
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    return this.meetings.get(id);
  }

  async createMeeting(insertMeeting: InsertMeeting): Promise<Meeting> {
    const id = randomUUID();
    const meeting: Meeting = {
      archiveState: "active",
      archiveSource: null,
      ...insertMeeting,
      id,
    } as Meeting;
    this.meetings.set(id, meeting);
    return meeting;
  }

  async updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const existing = this.meetings.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates } as Meeting;
    this.meetings.set(id, updated);
    return updated;
  }

  async deleteMeeting(id: string): Promise<void> {
    this.meetings.delete(id);
  }

  async getMeetingConflict(eventId: string, sponsorId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    return Array.from(this.meetings.values()).find(
      (m) =>
        m.eventId === eventId &&
        m.sponsorId === sponsorId &&
        m.date === date &&
        m.time === time &&
        m.id !== excludeId &&
        m.status !== "Cancelled" &&
        m.status !== "NoShow" &&
        (m.archiveState ?? "active") !== "archived"
    );
  }

  async getAttendeeConflict(eventId: string, attendeeId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    return Array.from(this.meetings.values()).find(
      (m) => m.eventId === eventId && m.attendeeId === attendeeId && m.date === date && m.time === time && m.id !== excludeId && m.status !== "Cancelled" && m.status !== "NoShow" && (m.archiveState ?? "active") !== "archived"
    );
  }

  async getLocationConflict(eventId: string, location: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    return Array.from(this.meetings.values()).find(
      (m) => m.eventId === eventId && m.location === location && m.date === date && m.time === time && m.id !== excludeId && m.status !== "Cancelled" && m.status !== "NoShow" && (m.archiveState ?? "active") !== "archived"
    );
  }

  async updateMeetingReminderFlags(id: string, flags: { reminder24SentAt?: Date; reminder2SentAt?: Date }): Promise<void> {
    const m = this.meetings.get(id);
    if (m) this.meetings.set(id, { ...m, ...flags });
  }

  async getMeetingsDueForReminders(): Promise<Meeting[]> { return []; }

  // Event lifecycle cascade
  async cascadeArchiveEvent(eventId: string): Promise<void> {
    // Archive active EventAttendee relationships for this event
    for (const att of this.attendees.values()) {
      if (att.assignedEvent === eventId && (att.archiveState ?? "active") === "active") {
        this.attendees.set(att.id, { ...att, archiveState: "archived", archiveSource: "event" });
      }
    }

    // Archive operational meetings for this event (preserve workflow status)
    for (const meeting of this.meetings.values()) {
      if (meeting.eventId === eventId && (meeting.archiveState ?? "active") !== "archived") {
        this.meetings.set(meeting.id, { ...meeting, archiveState: "archived", archiveSource: "event" });
      }
    }

    // Archive active EventSponsor relationship links for this event
    for (const sponsor of this.sponsors.values()) {
      const links = sponsor.assignedEvents ?? [];
      const hasActiveLink = links.some((ae) => ae.eventId === eventId && (ae.archiveState ?? "active") === "active");
      if (hasActiveLink) {
        const updatedLinks = links.map((ae) =>
          ae.eventId === eventId && (ae.archiveState ?? "active") === "active"
            ? { ...ae, archiveState: "archived" as const, archiveSource: "event" as const }
            : ae
        );
        this.sponsors.set(sponsor.id, { ...sponsor, assignedEvents: updatedLinks });
      }
    }
  }

  async cascadeUnarchiveEvent(eventId: string): Promise<void> {
    // Only restore EventAttendee relationships cascade-archived by this event
    for (const att of this.attendees.values()) {
      if (att.assignedEvent === eventId && att.archiveSource === "event") {
        this.attendees.set(att.id, { ...att, archiveState: "active", archiveSource: null });
      }
    }

    // Only restore meetings cascade-archived by this event
    for (const meeting of this.meetings.values()) {
      if (meeting.eventId === eventId && meeting.archiveSource === "event") {
        this.meetings.set(meeting.id, { ...meeting, archiveState: "active", archiveSource: null });
      }
    }

    // Only restore EventSponsor relationship links cascade-archived by this event
    for (const sponsor of this.sponsors.values()) {
      const links = sponsor.assignedEvents ?? [];
      const hasEventLink = links.some((ae) => ae.eventId === eventId && ae.archiveSource === "event");
      if (hasEventLink) {
        const updatedLinks = links.map((ae) =>
          ae.eventId === eventId && ae.archiveSource === "event"
            ? { ...ae, archiveState: "active" as const, archiveSource: null }
            : ae
        );
        this.sponsors.set(sponsor.id, { ...sponsor, assignedEvents: updatedLinks });
      }
    }
  }

  // Sponsor tokens
  async getSponsorToken(token: string): Promise<SponsorToken | undefined> {
    return this.sponsorTokens.get(token);
  }

  async getSponsorTokensBySponsor(sponsorId: string): Promise<SponsorToken[]> {
    return Array.from(this.sponsorTokens.values()).filter((t) => t.sponsorId === sponsorId);
  }

  async createSponsorToken(sponsorId: string, eventId: string): Promise<SponsorToken> {
    const token = randomBytes(32).toString("hex");
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + 90);

    const record: SponsorToken = {
      token,
      sponsorId,
      eventId,
      isActive: true,
      createdAt: now,
      expiresAt,
    };
    this.sponsorTokens.set(token, record);
    return record;
  }

  async revokeSponsorToken(token: string): Promise<SponsorToken | undefined> {
    const existing = this.sponsorTokens.get(token);
    if (!existing) return undefined;
    const updated: SponsorToken = { ...existing, isActive: false };
    this.sponsorTokens.set(token, updated);
    return updated;
  }

  async deleteSponsorToken(token: string): Promise<void> {
    this.sponsorTokens.delete(token);
  }

  // Sponsor notifications
  async createNotification(n: Omit<SponsorNotification, "id" | "createdAt">): Promise<SponsorNotification> {
    const id = randomUUID();
    const notif: SponsorNotification = { ...n, id, createdAt: new Date() };
    this.notifications.set(id, notif);
    return notif;
  }

  async getNotificationsForSponsorEvent(sponsorId: string, eventId: string): Promise<SponsorNotification[]> {
    return Array.from(this.notifications.values())
      .filter((n) => n.sponsorId === sponsorId && n.eventId === eventId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async markNotificationRead(id: string): Promise<void> {
    const n = this.notifications.get(id);
    if (n) this.notifications.set(id, { ...n, isRead: true });
  }

  async markAllNotificationsRead(sponsorId: string, eventId: string): Promise<void> {
    for (const [id, n] of Array.from(this.notifications.entries())) {
      if (n.sponsorId === sponsorId && n.eventId === eventId && !n.isRead) {
        this.notifications.set(id, { ...n, isRead: true });
      }
    }
  }

  // App settings
  async getSettings(): Promise<AppSettings> {
    return { ...this.appSettings };
  }

  async updateSettings(updates: Partial<AppSettings>): Promise<AppSettings> {
    this.appSettings = { ...this.appSettings, ...updates };
    return { ...this.appSettings };
  }

  // App branding
  async getBranding(): Promise<AppBranding> {
    return { ...this.appBranding };
  }

  async updateBranding(updates: Partial<AppBranding>): Promise<AppBranding> {
    this.appBranding = { ...this.appBranding, ...updates };
    return { ...this.appBranding };
  }

  // Password reset tokens
  async createPasswordResetToken(userId: string): Promise<PasswordResetToken> {
    // Invalidate any existing tokens for this user
    for (const [k, t] of Array.from(this.passwordResetTokens.entries())) {
      if (t.userId === userId && !t.used) {
        this.passwordResetTokens.set(k, { ...t, used: true });
      }
    }
    const token = randomBytes(32).toString("hex");
    const record: PasswordResetToken = {
      token,
      userId,
      expiresAt: Date.now() + 60 * 60 * 1000, // 1 hour
      used: false,
    };
    this.passwordResetTokens.set(token, record);
    return record;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return this.passwordResetTokens.get(token);
  }

  async markResetTokenUsed(token: string): Promise<void> {
    const t = this.passwordResetTokens.get(token);
    if (t) this.passwordResetTokens.set(token, { ...t, used: true });
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) this.users.set(userId, { ...user, password: newPassword });
  }

  async createDataExchangeLog(data: DataExchangeLogInsert): Promise<DataExchangeLog> {
    const id = randomUUID();
    const log: DataExchangeLog = {
      id, ...data,
      fileName: data.fileName ?? null,
      eventId: data.eventId ?? null,
      eventCode: data.eventCode ?? null,
      createdAt: new Date()
    };
    return log;
  }

  async getDataExchangeLogs(): Promise<DataExchangeLog[]> {
    return [];
  }

  async markMeetingsNunifyExported(_meetingIds: string[], _adminUser: string): Promise<void> {}

  async getUserPermissions(_userId: string): Promise<UserPermissionRecord | undefined> {
    return undefined;
  }

  async upsertUserPermissions(userId: string, permissions: UserPermissions, changedBy: string, targetUserName: string): Promise<UserPermissionRecord> {
    return { userId, permissions, updatedAt: new Date(), updatedBy: changedBy };
  }

  async getPermissionAuditLogs(_userId?: string): Promise<PermissionAuditLog[]> {
    return [];
  }

  private informationRequests: Map<string, InformationRequest> = new Map();

  async createInformationRequest(data: InsertInformationRequest): Promise<InformationRequest> {
    const id = randomUUID();
    const record: InformationRequest = {
      ...data,
      id,
      eventId: data.eventId ?? null,
      attendeeId: data.attendeeId ?? null,
      message: data.message ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.informationRequests.set(id, record);
    return record;
  }

  async getInformationRequest(id: string): Promise<InformationRequest | undefined> {
    return this.informationRequests.get(id);
  }

  async listInformationRequests(filters?: { eventId?: string; sponsorId?: string; status?: InformationRequestStatus }): Promise<InformationRequest[]> {
    let results = Array.from(this.informationRequests.values());
    if (filters?.eventId) results = results.filter(r => r.eventId === filters.eventId);
    if (filters?.sponsorId) results = results.filter(r => r.sponsorId === filters.sponsorId);
    if (filters?.status) results = results.filter(r => r.status === filters.status);
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async updateInformationRequestStatus(id: string, status: InformationRequestStatus): Promise<InformationRequest | undefined> {
    const existing = this.informationRequests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, status, updatedAt: new Date() };
    this.informationRequests.set(id, updated);
    return updated;
  }

  async updateInformationRequest(id: string, data: Partial<any>): Promise<InformationRequest | undefined> {
    const existing = this.informationRequests.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...data, updatedAt: new Date() };
    this.informationRequests.set(id, updated);
    return updated;
  }

  async deleteInformationRequest(id: string): Promise<boolean> {
    return this.informationRequests.delete(id);
  }

  async createScheduledEmail(data: any): Promise<any> { return { id: "mem-stub", ...data, createdAt: new Date(), updatedAt: new Date() }; }
  async listScheduledEmails(_filters?: any): Promise<any[]> { return []; }
  async getScheduledEmail(_id: string): Promise<any> { return undefined; }
  async updateScheduledEmail(_id: string, _data: any): Promise<any> { return undefined; }
  async deleteScheduledEmail(_id: string): Promise<boolean> { return false; }

  async createAnalyticsEvent(_data: { sponsorId: string; eventId: string; eventType: string }): Promise<void> {}

  async getAnalyticsSummary(_sponsorId: string, _eventId: string): Promise<{ profileViews: number; meetingCtaClicks: number }> {
    return { profileViews: 0, meetingCtaClicks: 0 };
  }

  async createEmailLog(_data: { emailType: string; recipientEmail: string; subject: string; htmlContent?: string | null; eventId?: string | null; sponsorId?: string | null; attendeeId?: string | null; status: "sent" | "failed"; errorMessage?: string | null; resendOfId?: string | null; providerMessageId?: string | null; source?: string | null; templateId?: string | null }): Promise<string> { return randomUUID(); }
  async listEmailLogs(_filters?: { emailType?: string; status?: string; eventId?: string; sponsorId?: string; source?: string; search?: string; from?: Date; to?: Date }, _limit?: number, _offset?: number): Promise<EmailLog[]> { return []; }
  async getEmailLog(_id: string): Promise<EmailLog | undefined> { return undefined; }
  async getEmailLogByProviderMessageId(_providerMessageId: string): Promise<EmailLog | undefined> { return undefined; }
  async updateEmailLogDelivery(_id: string, _updates: { status?: string; deliveredAt?: Date; openedAt?: Date; clickedAt?: Date; bouncedAt?: Date; bounceReason?: string; providerStatus?: string }): Promise<void> {}

  async upsertSponsorUser(_data: { sponsorId: string; name: string; email: string; accessLevel?: string; isPrimary?: boolean }): Promise<SponsorUser> { return { id: randomUUID(), sponsorId: _data.sponsorId, name: _data.name, email: _data.email, accessLevel: _data.accessLevel ?? "owner", isPrimary: _data.isPrimary ?? false, isActive: true, lastLoginAt: null, loginCount: 0, createdAt: new Date(), updatedAt: new Date() }; }
  async getSponsorUserByEmail(_email: string): Promise<SponsorUser | undefined> { return undefined; }
  async getSponsorUsersBySponsor(_sponsorId: string): Promise<SponsorUser[]> { return []; }
  async getSponsorUserById(_id: string): Promise<SponsorUser | undefined> { return undefined; }
  async createSponsorUser(_data: { sponsorId: string; name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }): Promise<SponsorUser> { return { id: randomUUID(), ..._data, lastLoginAt: null, loginCount: 0, createdAt: new Date(), updatedAt: new Date() }; }
  async updateSponsorUser(_id: string, _data: Partial<{ name: string; email: string; accessLevel: string; isPrimary: boolean; isActive: boolean }>): Promise<SponsorUser> { return { id: _id, sponsorId: "", name: "", email: "", accessLevel: "owner", isPrimary: false, isActive: true, lastLoginAt: null, loginCount: 0, createdAt: new Date(), updatedAt: new Date() }; }
  async setSponsorUserPrimary(_id: string, _sponsorId: string): Promise<void> {}
  async deleteSponsorUser(_id: string): Promise<void> {}
  async updateSponsorUserLastLogin(_id: string): Promise<void> {}
  async getAllSponsorUsers(): Promise<SponsorUser[]> { return []; }
  async createSponsorLoginToken(_data: { sponsorUserId: string; sponsorId: string; tokenHash: string; expiresAt: Date }): Promise<SponsorLoginToken> { return { id: randomUUID(), ..._data, usedAt: null, createdAt: new Date() }; }
  async getSponsorLoginTokenByHash(_tokenHash: string): Promise<SponsorLoginToken | undefined> { return undefined; }
  async markSponsorLoginTokenUsed(_id: string): Promise<void> {}
  async invalidateSponsorLoginTokens(_sponsorUserId: string): Promise<void> {}

  async getEmailTemplates(): Promise<EmailTemplate[]> { return []; }
  async getEmailTemplateByKey(_key: string): Promise<EmailTemplate | undefined> { return undefined; }
  async getEmailTemplateById(_id: string): Promise<EmailTemplate | undefined> { return undefined; }
  async upsertEmailTemplate(data: { templateKey: string; displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate?: string | null; description?: string | null; variables?: string[]; isActive?: boolean }): Promise<EmailTemplate> { return { id: randomUUID(), ...data, textTemplate: data.textTemplate ?? null, description: data.description ?? null, variables: data.variables ?? [], isActive: data.isActive ?? true, createdAt: new Date(), updatedAt: new Date() }; }
  async updateEmailTemplate(_id: string, _data: Partial<{ displayName: string; subjectTemplate: string; htmlTemplate: string; textTemplate: string | null; description: string | null; isActive: boolean }>): Promise<EmailTemplate> { return { id: _id, templateKey: "", displayName: "", subjectTemplate: "", htmlTemplate: "", textTemplate: null, description: null, variables: [], isActive: true, createdAt: new Date(), updatedAt: new Date() }; }

  async listPackageTemplates(_filters?: { sponsorshipLevel?: string; isArchived?: boolean }): Promise<PackageTemplate[]> { return []; }
  async getPackageTemplate(_id: string): Promise<PackageTemplate | undefined> { return undefined; }
  async createPackageTemplate(data: InsertPackageTemplate): Promise<PackageTemplate> { return { id: randomUUID(), ...data, eventId: data.eventId ?? null, eventFamily: data.eventFamily ?? null, year: data.year ?? null, description: data.description ?? null, isActive: data.isActive ?? true, isArchived: data.isArchived ?? false, createdAt: new Date(), updatedAt: new Date() }; }
  async updatePackageTemplate(_id: string, _data: Partial<InsertPackageTemplate>): Promise<PackageTemplate> { return { id: _id, packageName: "", sponsorshipLevel: "", eventId: null, eventFamily: null, year: null, description: null, isActive: true, isArchived: false, createdAt: new Date(), updatedAt: new Date() }; }
  async archivePackageTemplate(_id: string): Promise<PackageTemplate> { return { id: _id, packageName: "", sponsorshipLevel: "", eventId: null, eventFamily: null, year: null, description: null, isActive: false, isArchived: true, createdAt: new Date(), updatedAt: new Date() }; }
  async duplicatePackageTemplate(_id: string, _newName: string): Promise<PackageTemplate> { return { id: randomUUID(), packageName: _newName, sponsorshipLevel: "", eventId: null, eventFamily: null, year: null, description: null, isActive: true, isArchived: false, createdAt: new Date(), updatedAt: new Date() }; }

  async listDeliverableTemplateItems(_packageTemplateId: string): Promise<DeliverableTemplateItem[]> { return []; }
  async getDeliverableTemplateItem(_id: string): Promise<DeliverableTemplateItem | undefined> { return undefined; }
  async createDeliverableTemplateItem(data: InsertDeliverableTemplateItem): Promise<DeliverableTemplateItem> { return { id: randomUUID(), ...data, deliverableDescription: data.deliverableDescription ?? null, defaultQuantity: data.defaultQuantity ?? null, quantityUnit: data.quantityUnit ?? null, dueOffsetDays: data.dueOffsetDays ?? null, createdAt: new Date(), updatedAt: new Date() }; }
  async updateDeliverableTemplateItem(_id: string, _data: Partial<InsertDeliverableTemplateItem>): Promise<DeliverableTemplateItem> { return { id: _id, packageTemplateId: "", category: "", deliverableName: "", deliverableDescription: null, defaultQuantity: null, quantityUnit: null, ownerType: "Converge", sponsorEditable: false, sponsorVisible: true, fulfillmentType: "status_only", reminderEligible: false, dueTiming: "not_applicable", dueOffsetDays: null, displayOrder: 0, isActive: true, helpTitle: null, helpText: null, helpLink: null, createdAt: new Date(), updatedAt: new Date() }; }
  async deleteDeliverableTemplateItem(_id: string): Promise<void> {}

  async listAgreementDeliverables(_filters: { sponsorId?: string; eventId?: string; packageTemplateId?: string }): Promise<AgreementDeliverable[]> { return []; }
  async getAgreementDeliverable(_id: string): Promise<AgreementDeliverable | undefined> { return undefined; }
  async createAgreementDeliverable(data: InsertAgreementDeliverable): Promise<AgreementDeliverable> { return { id: randomUUID(), ...data, packageTemplateId: data.packageTemplateId ?? null, deliverableDescription: data.deliverableDescription ?? null, quantity: data.quantity ?? null, quantityUnit: data.quantityUnit ?? null, dueDate: data.dueDate ?? null, sponsorFacingNote: data.sponsorFacingNote ?? null, internalNote: data.internalNote ?? null, createdFromTemplateItemId: data.createdFromTemplateItemId ?? null, completedAt: data.completedAt ?? null, createdAt: new Date(), updatedAt: new Date() }; }
  async updateAgreementDeliverable(_id: string, _data: Partial<InsertAgreementDeliverable>): Promise<AgreementDeliverable> { return { id: _id, sponsorId: "", eventId: "", packageTemplateId: null, sponsorshipLevel: "", category: "", deliverableName: "", deliverableDescription: null, quantity: null, quantityUnit: null, ownerType: "Converge", sponsorEditable: false, sponsorVisible: true, fulfillmentType: "status_only", status: "Not Started", dueTiming: "not_applicable", dueDate: null, sponsorFacingNote: null, internalNote: null, isOverridden: false, isCustom: false, createdFromTemplateItemId: null, displayOrder: 0, completedAt: null, helpTitle: null, helpText: null, helpLink: null, registrationAccessCode: null, registrationInstructions: null, createdAt: new Date(), updatedAt: new Date() }; }
  async deleteAgreementDeliverable(_id: string): Promise<void> {}
  async generateAgreementDeliverablesFromTemplate(_sponsorId: string, _eventId: string, _packageTemplateId: string, _sponsorshipLevel: string): Promise<AgreementDeliverable[]> { return []; }

  async listDeliverableRegistrants(_id: string): Promise<AgreementDeliverableRegistrant[]> { return []; }
  async createDeliverableRegistrant(data: InsertAgreementDeliverableRegistrant): Promise<AgreementDeliverableRegistrant> { return { id: randomUUID(), ...data, firstName: data.firstName ?? null, lastName: data.lastName ?? null, title: data.title ?? null, email: data.email ?? null, conciergeRole: data.conciergeRole ?? null, registrationStatus: data.registrationStatus ?? "Unknown", createdAt: new Date(), updatedAt: new Date() }; }
  async updateDeliverableRegistrant(_id: string, _data: Partial<InsertAgreementDeliverableRegistrant>): Promise<AgreementDeliverableRegistrant> { return { id: _id, agreementDeliverableId: "", name: "", firstName: null, lastName: null, title: null, email: null, conciergeRole: null, registrationStatus: "Unknown", createdAt: new Date(), updatedAt: new Date() }; }
  async deleteDeliverableRegistrant(_id: string): Promise<void> {}

  async listDeliverableSpeakers(_id: string): Promise<AgreementDeliverableSpeaker[]> { return []; }
  async createDeliverableSpeaker(data: InsertAgreementDeliverableSpeaker): Promise<AgreementDeliverableSpeaker> { return { id: randomUUID(), ...data, speakerTitle: data.speakerTitle ?? null, speakerBio: data.speakerBio ?? null, sessionType: data.sessionType ?? null, sessionTitle: data.sessionTitle ?? null, createdAt: new Date(), updatedAt: new Date() }; }
  async updateDeliverableSpeaker(_id: string, _data: Partial<InsertAgreementDeliverableSpeaker>): Promise<AgreementDeliverableSpeaker> { return { id: _id, agreementDeliverableId: "", speakerName: "", speakerTitle: null, speakerBio: null, sessionType: null, sessionTitle: null, createdAt: new Date(), updatedAt: new Date() }; }
  async deleteDeliverableSpeaker(_id: string): Promise<void> {}

  async listDeliverableReminders(_filters: { sponsorId?: string; eventId?: string }): Promise<AgreementDeliverableReminder[]> { return []; }
  async getLastDeliverableReminder(_sponsorId: string, _eventId: string): Promise<AgreementDeliverableReminder | undefined> { return undefined; }
  async createDeliverableReminder(data: InsertAgreementDeliverableReminder): Promise<AgreementDeliverableReminder> { return { id: randomUUID(), ...data, sentByUserId: data.sentByUserId ?? null, errorMessage: data.errorMessage ?? null, createdAt: new Date() } as AgreementDeliverableReminder; }

  async listFileAssets(_filters: { sponsorId?: string; eventId?: string; deliverableId?: string; status?: string }): Promise<FileAsset[]> { return []; }
  async getFileAsset(_id: string): Promise<FileAsset | undefined> { return undefined; }
  async createFileAsset(data: InsertFileAsset): Promise<FileAsset> { return { id: randomUUID(), ...data, eventId: data.eventId ?? null, sponsorId: data.sponsorId ?? null, deliverableId: data.deliverableId ?? null, uploadedByUserId: data.uploadedByUserId ?? null, sizeBytes: data.sizeBytes ?? null, title: data.title ?? null, description: data.description ?? null, replacesFileAssetId: data.replacesFileAssetId ?? null, uploadedAt: new Date(), updatedAt: new Date() } as FileAsset; }
  async updateFileAsset(_id: string, _data: Partial<InsertFileAsset>): Promise<FileAsset> { return this.createFileAsset({ category: "", originalFileName: "", storedFileName: "", objectKey: "", mimeType: "" }); }
  async archiveFileAsset(_id: string): Promise<FileAsset> { return this.createFileAsset({ category: "", originalFileName: "", storedFileName: "", objectKey: "", mimeType: "" }); }
  async replaceFileAsset(_oldId: string, newData: InsertFileAsset): Promise<FileAsset> { return this.createFileAsset(newData); }

  async listDeliverableLinks(_deliverableId: string): Promise<DeliverableLink[]> { return []; }
  async createDeliverableLink(data: InsertDeliverableLink): Promise<DeliverableLink> { return { id: randomUUID(), ...data, addedByUserId: data.addedByUserId ?? null, addedAt: new Date() } as DeliverableLink; }
  async deleteDeliverableLink(_id: string): Promise<void> {}

  async listDeliverableSocialEntries(_deliverableId: string): Promise<DeliverableSocialEntry[]> { return []; }
  async getDeliverableSocialEntry(_id: string): Promise<DeliverableSocialEntry | undefined> { return undefined; }
  async createDeliverableSocialEntry(data: InsertDeliverableSocialEntry): Promise<DeliverableSocialEntry> { return { id: randomUUID(), ...data, title: data.title ?? null, url: data.url ?? null, fileAssetId: data.fileAssetId ?? null, notes: data.notes ?? null, createdAt: new Date(), updatedAt: new Date() }; }
  async updateDeliverableSocialEntry(_id: string, _data: Partial<InsertDeliverableSocialEntry>): Promise<DeliverableSocialEntry> { return { id: _id, deliverableId: "", entryType: "graphic", entryIndex: 1, title: null, url: null, fileAssetId: null, notes: null, createdAt: new Date(), updatedAt: new Date() }; }
  async deleteDeliverableSocialEntry(_id: string): Promise<void> {}

  async generateAttendeeContactListCsv(_deliverableId: string, _type?: "full" | "partial"): Promise<string> { return ""; }
  async getInternalNotificationEmail(): Promise<string> { return ""; }
  async setInternalNotificationEmail(_email: string): Promise<void> {}
  async getBackupSchedule(): Promise<import("@shared/schema").BackupScheduleConfig> { return { ...require("@shared/schema").DEFAULT_BACKUP_SCHEDULE }; }
  async updateBackupSchedule(updates: Partial<import("@shared/schema").BackupScheduleConfig>): Promise<import("@shared/schema").BackupScheduleConfig> { return { ...require("@shared/schema").DEFAULT_BACKUP_SCHEDULE, ...updates }; }

  async createMeetingInvitation(data: InsertMeetingInvitation): Promise<MeetingInvitation> { return { id: randomUUID(), ...data, sponsorUserId: data.sponsorUserId ?? null, message: data.message ?? null, categorySnapshot: data.categorySnapshot ?? null, matchScore: data.matchScore ?? null, secureToken: data.secureToken ?? null, respondedAt: null, acceptedAt: null, declinedAt: null, expiresAt: data.expiresAt ?? null, createdAt: new Date(), updatedAt: new Date() } as MeetingInvitation; }
  async getMeetingInvitation(_id: string): Promise<MeetingInvitation | undefined> { return undefined; }
  async getMeetingInvitationByToken(_token: string): Promise<MeetingInvitation | undefined> { return undefined; }
  async listMeetingInvitations(_filters: { eventId?: string; sponsorId?: string; attendeeId?: string; status?: MeetingInvitationStatus }): Promise<MeetingInvitation[]> { return []; }
  async updateMeetingInvitation(_id: string, _updates: Partial<InsertMeetingInvitation>): Promise<MeetingInvitation | undefined> { return undefined; }
  async countSponsorInvitations(_sponsorId: string, _eventId: string): Promise<number> { return 0; }
  async countAttendeeInvitations(_attendeeId: string, _eventId: string): Promise<number> { return 0; }

  private catDefs = new Map<string, AttendeeCategoryDef>();
  private catRules = new Map<string, CategoryMatchingRule>();

  async getAttendeeCategories(): Promise<AttendeeCategoryDef[]> { return [...this.catDefs.values()].sort((a, b) => a.sortOrder - b.sortOrder); }
  async getAttendeeCategory(id: string): Promise<AttendeeCategoryDef | undefined> { return this.catDefs.get(id); }
  async getAttendeeCategoryByKey(key: string): Promise<AttendeeCategoryDef | undefined> { return [...this.catDefs.values()].find(c => c.key === key); }
  async createAttendeeCategory(data: InsertAttendeeCategoryDef): Promise<AttendeeCategoryDef> {
    const cat = { id: randomUUID(), ...data, description: data.description ?? null, isActive: data.isActive ?? true, sortOrder: data.sortOrder ?? 0, matchWeight: data.matchWeight ?? 50, createdAt: new Date(), updatedAt: new Date() } as AttendeeCategoryDef;
    this.catDefs.set(cat.id, cat);
    return cat;
  }
  async updateAttendeeCategory(id: string, updates: Partial<InsertAttendeeCategoryDef>): Promise<AttendeeCategoryDef | undefined> {
    const existing = this.catDefs.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() } as AttendeeCategoryDef;
    this.catDefs.set(id, updated);
    return updated;
  }
  async deleteAttendeeCategory(id: string): Promise<void> { this.catDefs.delete(id); }

  async getCategoryMatchingRules(): Promise<CategoryMatchingRule[]> { return [...this.catRules.values()].sort((a, b) => a.priority - b.priority); }
  async getCategoryMatchingRule(id: string): Promise<CategoryMatchingRule | undefined> { return this.catRules.get(id); }
  async createCategoryMatchingRule(data: InsertCategoryMatchingRule): Promise<CategoryMatchingRule> {
    const rule = { id: randomUUID(), ...data, sourceField: data.sourceField ?? "ticket_type", matchType: data.matchType ?? "contains", isActive: data.isActive ?? true, priority: data.priority ?? 0, createdAt: new Date(), updatedAt: new Date() } as CategoryMatchingRule;
    this.catRules.set(rule.id, rule);
    return rule;
  }
  async updateCategoryMatchingRule(id: string, updates: Partial<InsertCategoryMatchingRule>): Promise<CategoryMatchingRule | undefined> {
    const existing = this.catRules.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates, updatedAt: new Date() } as CategoryMatchingRule;
    this.catRules.set(id, updated);
    return updated;
  }
  async deleteCategoryMatchingRule(id: string): Promise<void> { this.catRules.delete(id); }

  async getSessionTypes(): Promise<SessionType[]> { return []; }
  async getSessionType(_id: string): Promise<SessionType | undefined> { return undefined; }
  async getSessionTypeByKey(_key: string): Promise<SessionType | undefined> { return undefined; }
  async createSessionType(data: InsertSessionType): Promise<SessionType> { return { id: randomUUID(), ...data, isActive: data.isActive ?? true, displayOrder: data.displayOrder ?? 0, createdAt: new Date(), updatedAt: new Date() } as SessionType; }
  async updateSessionType(_id: string, _updates: Partial<InsertSessionType>): Promise<SessionType | undefined> { return undefined; }
  async deleteSessionType(_id: string): Promise<void> {}

  async getAgendaSessions(_eventId?: string): Promise<AgendaSession[]> { return []; }
  async getAgendaSession(_id: string): Promise<AgendaSession | undefined> { return undefined; }
  async getAgendaSessionByCode(_eventId: string, _sessionCode: string): Promise<AgendaSession | undefined> { return undefined; }
  async createAgendaSession(data: InsertAgendaSession): Promise<AgendaSession> { return { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() } as AgendaSession; }
  async updateAgendaSession(_id: string, _updates: Partial<InsertAgendaSession>): Promise<AgendaSession | undefined> { return undefined; }
  async deleteAgendaSession(_id: string): Promise<void> {}

  async getSessionSpeakers(_sessionId: string): Promise<AgendaSessionSpeaker[]> { return []; }
  async createSessionSpeaker(data: InsertAgendaSessionSpeaker): Promise<AgendaSessionSpeaker> { return { id: randomUUID(), ...data, createdAt: new Date(), updatedAt: new Date() } as AgendaSessionSpeaker; }
  async updateSessionSpeaker(_id: string, _updates: Partial<InsertAgendaSessionSpeaker>): Promise<AgendaSessionSpeaker | undefined> { return undefined; }
  async deleteSessionSpeaker(_id: string): Promise<void> {}
  async deleteSessionSpeakersBySession(_sessionId: string): Promise<void> {}

  async getAttendeeSavedSessions(_attendeeId: string, _eventId: string): Promise<AttendeeSavedSession[]> { return []; }
  async createAttendeeSavedSession(data: InsertAttendeeSavedSession): Promise<AttendeeSavedSession> { return { id: randomUUID(), ...data, savedAt: new Date() } as AttendeeSavedSession; }
  async deleteAttendeeSavedSession(_id: string): Promise<void> {}
  async countAttendeeSavedSessions(_attendeeId: string, _eventId: string): Promise<number> { return 0; }

  async getAgendaImportJobs(_eventId?: string): Promise<AgendaImportJob[]> { return []; }
  async createAgendaImportJob(data: InsertAgendaImportJob): Promise<AgendaImportJob> { return { id: randomUUID(), ...data, createdAt: new Date(), completedAt: null } as AgendaImportJob; }
  async updateAgendaImportJob(_id: string, _updates: Partial<InsertAgendaImportJob>): Promise<AgendaImportJob | undefined> { return undefined; }
}

export const storage = new DatabaseStorage();
