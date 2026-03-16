import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb, bigint, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull().default(""),
  email: text("email").notNull().default(""),
  role: text("role", { enum: ["admin", "manager"] }).notNull().default("manager"),
  isActive: boolean("is_active").notNull().default(true),
});

export const insertUserSchema = createInsertSchema(users)
  .pick({ name: true, email: true, password: true, role: true, isActive: true })
  .extend({
    role: z.enum(["admin", "manager"]).default("manager"),
    isActive: z.boolean().default(true),
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Safe user type — password stripped for API responses
export type SafeUser = Omit<User, "password" | "username">;

// --- Sponsorship Levels (defined early, used by location + sponsor schemas) ---
export const SPONSORSHIP_LEVELS = ["Platinum", "Gold", "Silver", "Bronze"] as const;
export type SponsorshipLevel = typeof SPONSORSHIP_LEVELS[number];

// --- Meeting Location ---
export const meetingLocationSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.string(),
  // Empty array = no restriction (all sponsor levels may use this location)
  allowedSponsorLevels: z.array(z.enum(SPONSORSHIP_LEVELS)).default([]),
});

export type MeetingLocation = z.infer<typeof meetingLocationSchema>;

// --- Meeting Time Block ---
export const meetingTimeBlockSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  date: z.string(), // ISO date string
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm
  locationIds: z.array(z.string()).default([]), // which location IDs are available in this block
});

export type MeetingTimeBlock = z.infer<typeof meetingTimeBlockSchema>;

// --- EventSponsor Relationship Link ---

export const eventSponsorLinkSchema = z.object({
  eventId: z.string(),
  sponsorshipLevel: z.enum(SPONSORSHIP_LEVELS).nullable().optional(),
  archiveState: z.enum(["active", "archived"]).default("active"),
  archiveSource: z.enum(["manual", "event"]).nullable().default(null),
  // Per-sponsor-per-event action flags (default true for backward compat)
  onsiteMeetingEnabled: z.boolean().default(true),
  onlineMeetingEnabled: z.boolean().default(true),
  informationRequestEnabled: z.boolean().default(true),
  // Meeting block access: true = use all event blocks, false = use selectedBlockIds only
  useDefaultBlocks: z.boolean().default(true),
  selectedBlockIds: z.array(z.string()).default([]),
});
export type EventSponsorLink = z.infer<typeof eventSponsorLinkSchema>;

// --- Event ---
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  location: text("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["manual", "event"] }),
  logoUrl: text("logo_url"),
  meetingLocations: jsonb("meeting_locations").$type<MeetingLocation[]>().notNull().default([]),
  meetingBlocks: jsonb("meeting_blocks").$type<MeetingTimeBlock[]>().notNull().default([]),
  primaryColor: text("primary_color"),
  secondaryColor: text("secondary_color"),
  accentColor: text("accent_color"),
  buttonColor: text("button_color"),
  bgAccentColor: text("bg_accent_color"),
  schedulingEnabled: boolean("scheduling_enabled").notNull().default(true),
  schedulingShutoffAt: timestamp("scheduling_shutoff_at"),
  externalSchedulingLabel: text("external_scheduling_label"),
  externalSchedulingUrl: text("external_scheduling_url"),
  externalSchedulingMessage: text("external_scheduling_message"),
  websiteUrl: text("website_url"),
  matchmakingEnabled: boolean("matchmaking_enabled").notNull().default(false),
  maxInvitationsPerAttendee: integer("max_invitations_per_attendee").notNull().default(6),
  invitationQuotas: jsonb("invitation_quotas").$type<Record<string, number>>(),
});

export const insertEventSchema = createInsertSchema(events).extend({
  slug: z.string().min(1, "Event code is required").regex(/^[A-Z0-9]+$/, "Event code must be uppercase letters and numbers only"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  archiveSource: z.enum(["manual", "event"]).nullable().optional(),
  primaryColor: z.string().nullable().optional(),
  secondaryColor: z.string().nullable().optional(),
  accentColor: z.string().nullable().optional(),
  buttonColor: z.string().nullable().optional(),
  bgAccentColor: z.string().nullable().optional(),
  schedulingEnabled: z.boolean().default(true).optional(),
  schedulingShutoffAt: z.coerce.date().nullable().optional(),
  externalSchedulingLabel: z.string().nullable().optional(),
  externalSchedulingUrl: z.string().nullable().optional(),
  externalSchedulingMessage: z.string().nullable().optional(),
  websiteUrl: z.string().url("Must be a valid URL").nullable().optional().or(z.literal("")),
  matchmakingEnabled: z.boolean().default(false).optional(),
  maxInvitationsPerAttendee: z.number().int().min(1).default(6).optional(),
  invitationQuotas: z.record(z.string(), z.number()).nullable().optional(),
});
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// --- Sponsor ---
export const SPONSOR_ATTRIBUTES = [
  "Compliance", "Onboarding", "Payments", "Fraud", "Lending",
  "Core Processing", "Treasury", "Member Experience", "AI", "Automation",
] as const;
export type SponsorAttribute = typeof SPONSOR_ATTRIBUTES[number];

export const sponsors = pgTable("sponsors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  level: text("level", { enum: ["Platinum", "Gold", "Silver", "Bronze"] }),
  assignedEvents: jsonb("assigned_events").$type<EventSponsorLink[]>().notNull().default([]),
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["manual", "event"] }),
  allowOnlineMeetings: boolean("allow_online_meetings").notNull().default(false),
  shortDescription: text("short_description"),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  solutionsSummary: text("solutions_summary"),
  contactName: text("contact_name"),
  contactEmail: text("contact_email"),
  contactPhone: text("contact_phone"),
  attributes: jsonb("attributes").$type<string[]>().default([]),
});

export const insertSponsorSchema = createInsertSchema(sponsors).extend({
  assignedEvents: z.array(eventSponsorLinkSchema).default([]),
  archiveSource: z.enum(["manual", "event"]).nullable().optional(),
  allowOnlineMeetings: z.boolean().default(false).optional(),
  shortDescription: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  solutionsSummary: z.string().nullable().optional(),
  contactName: z.string().nullable().optional(),
  contactEmail: z.string().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  attributes: z.array(z.string()).default([]).optional(),
});
export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;

// --- Attendee Category Definitions & Matching Rules ---
export const DEFAULT_ATTENDEE_CATEGORIES = ["PRACTITIONER", "GOVERNMENT_NONPROFIT", "SOLUTION_PROVIDER"] as const;

export const attendeeCategories = pgTable("attendee_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  matchWeight: integer("match_weight").notNull().default(50),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendeeCategorySchema = createInsertSchema(attendeeCategories).extend({
  key: z.string().min(1).max(50),
  label: z.string().min(1).max(100),
  description: z.string().nullable().optional(),
  matchWeight: z.number().int().min(0).max(1000).default(50),
});
export type AttendeeCategoryDef = typeof attendeeCategories.$inferSelect;
export type InsertAttendeeCategoryDef = z.infer<typeof insertAttendeeCategorySchema>;

export const MATCH_TYPES = ["contains", "equals", "starts_with", "ends_with"] as const;
export type MatchType = typeof MATCH_TYPES[number];

export const categoryMatchingRules = pgTable("category_matching_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  categoryKey: text("category_key").notNull(),
  sourceField: text("source_field").notNull().default("ticket_type"),
  matchType: text("match_type", { enum: ["contains", "equals", "starts_with", "ends_with"] }).notNull().default("contains"),
  searchTerm: text("search_term").notNull(),
  priority: integer("priority").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCategoryMatchingRuleSchema = createInsertSchema(categoryMatchingRules).extend({
  categoryKey: z.string().min(1),
  sourceField: z.string().min(1).default("ticket_type"),
  matchType: z.enum(MATCH_TYPES).default("contains"),
  searchTerm: z.string().min(1),
  priority: z.number().int().min(0).default(0),
});
export type CategoryMatchingRule = typeof categoryMatchingRules.$inferSelect;
export type InsertCategoryMatchingRule = z.infer<typeof insertCategoryMatchingRuleSchema>;

// Legacy constant kept for backward compat
export const ATTENDEE_CATEGORIES = ["PRACTITIONER", "GOVERNMENT_NONPROFIT", "SOLUTION_PROVIDER"] as const;
export type AttendeeCategory = string;

export const attendees = pgTable("attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  name: text("name").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  email: text("email").notNull(),
  phone: text("phone"),
  linkedinUrl: text("linkedin_url"),
  assignedEvent: varchar("assigned_event").notNull(), // event id
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["event", "manual"] }),
  externalSource: text("external_source"),
  externalRegistrationId: text("external_registration_id"),
  interests: text("interests").array(),
  notes: text("notes"),
  ticketType: text("ticket_type"),
  attendeeCategory: text("attendee_category"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendeeSchema = createInsertSchema(attendees).extend({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  archiveSource: z.enum(["event", "manual"]).nullable().optional(),
  interests: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
  ticketType: z.string().nullable().optional(),
  attendeeCategory: z.string().nullable().optional(),
});
export type Attendee = typeof attendees.$inferSelect;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;

// Manual attendee entry used when scheduling a meeting without a pre-existing record
export const manualAttendeeSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  name: z.string().min(1).optional(),
  company: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});

// --- Password Reset Token ---
export interface PasswordResetToken {
  token: string;
  userId: string;
  expiresAt: number;
  used: boolean;
}

// --- Sponsor Notifications ---
export const SPONSOR_NOTIFICATION_TYPES = [
  "onsite_booked",
  "online_request_submitted",
  "meeting_cancelled",
  "request_confirmed",
  "request_declined",
  "meeting_completed",
] as const;

export type SponsorNotificationType = typeof SPONSOR_NOTIFICATION_TYPES[number];

export const sponsorNotificationSchema = z.object({
  id: z.string(),
  sponsorId: z.string(),
  eventId: z.string(),
  meetingId: z.string(),
  type: z.enum(SPONSOR_NOTIFICATION_TYPES),
  attendeeName: z.string(),
  attendeeCompany: z.string(),
  eventName: z.string(),
  date: z.string(),
  time: z.string(),
  isRead: z.boolean().default(false),
  createdAt: z.date(),
});

export type SponsorNotification = z.infer<typeof sponsorNotificationSchema>;

// --- Sponsor Access Token ---
export const sponsorTokenSchema = z.object({
  token:     z.string(),
  sponsorId: z.string(),
  eventId:   z.string(),
  isActive:  z.boolean().default(true),
  expiresAt: z.date(),
  createdAt: z.date(),
});

export type SponsorToken = z.infer<typeof sponsorTokenSchema>;

// --- Meeting ---
export const ONLINE_PLATFORMS = ["No Preference", "Microsoft Teams", "Google Meet", "Zoom", "Webex", "Phone"] as const;
export type OnlinePlatform = typeof ONLINE_PLATFORMS[number];

export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  sponsorId: varchar("sponsor_id").notNull(),
  attendeeId: varchar("attendee_id").notNull(),
  meetingType: text("meeting_type", { enum: ["onsite", "online_request"] }).notNull().default("onsite"),
  date: text("date").notNull(), // ISO date string
  time: text("time").notNull(), // HH:mm
  location: text("location").notNull(), // Location name for onsite; "Online" for online requests
  platform: text("platform"),       // Online meeting platform preference
  preferredTimezone: text("preferred_timezone"), // Timezone for online requests
  status: text("status", { enum: ["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed", "Declined"] }).notNull().default("Scheduled"),
  source: text("source", { enum: ["admin", "public"] }).notNull().default("admin"),
  notes: text("notes"),
  meetingLink: varchar("meeting_link"),
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["event", "manual"] }),
  // Nunify sync fields
  nunifyExternalId: text("nunify_external_id"),
  nunifyExportedAt: timestamp("nunify_exported_at"),
  nunifyExportedBy: text("nunify_exported_by"),
  // Reminder tracking
  reminder24SentAt: timestamp("reminder_24_sent_at"),
  reminder2SentAt: timestamp("reminder_2_sent_at"),
});

export const insertMeetingSchema = createInsertSchema(meetings).extend({
  archiveSource: z.enum(["event", "manual"]).nullable().optional(),
  source: z.enum(["admin", "public"]).optional().default("admin"),
  meetingType: z.enum(["onsite", "online_request"]).optional().default("onsite"),
  status: z.enum(["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed", "Declined"]).optional().default("Scheduled"),
  meetingLink: z.string().nullable().optional(),
  platform: z.string().nullable().optional(),
  preferredTimezone: z.string().nullable().optional(),
});
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;

// ── Global App Settings (single record, no DB table) ─────────────────────────

export interface AppSettings {
  defaultTimezone: string;
  defaultMeetingDuration: number;
  onlineWindowStart: string;
  onlineWindowEnd: string;
  allowManagersToArchive: boolean;
  allowManagersToEditBranding: boolean;
  allowManagersToEditSettings: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  defaultTimezone: "America/New_York",
  defaultMeetingDuration: 30,
  onlineWindowStart: "09:00",
  onlineWindowEnd: "17:00",
  allowManagersToArchive: false,
  allowManagersToEditBranding: false,
  allowManagersToEditSettings: false,
};

// ── Global App Branding (single record, no DB table) ─────────────────────────

export interface AppBranding {
  appName: string;
  appLogoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  confirmationLogoUrl: string;
  sponsorDashboardLogoUrl: string;
  publicEventLogoUrl: string;
  internalNotificationEmail: string;
  appBaseUrl: string;
}

export const DEFAULT_BRANDING: AppBranding = {
  appName: "Converge Concierge",
  appLogoUrl: "",
  primaryColor: "#0D1E3A",
  secondaryColor: "#F8FAFC",
  accentColor: "#0D9488",
  confirmationLogoUrl: "",
  sponsorDashboardLogoUrl: "",
  publicEventLogoUrl: "",
  internalNotificationEmail: "",
  appBaseUrl: "",
};

// ── Backup Schedule Config ────────────────────────────────────────────────────

export interface BackupScheduleConfig {
  enabled: boolean;
  timeUtc: string;
  timezone: string;
  lastRunAt: string | null;
  lastRunStatus: "success" | "failed" | null;
  nextRunAt: string | null;
}

export const DEFAULT_BACKUP_SCHEDULE: BackupScheduleConfig = {
  enabled: true,
  timeUtc: "03:00",
  timezone: "UTC",
  lastRunAt: null,
  lastRunStatus: null,
  nextRunAt: null,
};

// ── Email Settings Config ────────────────────────────────────────────────────

export interface EmailSettings {
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  dailyLimit: number;
  globalPaused: boolean;
  pausedAt: string | null;
  pausedBy: string | null;
}

export const DEFAULT_EMAIL_SETTINGS: EmailSettings = {
  senderName: "Converge Concierge",
  senderEmail: "noreply@concierge.convergeevents.com",
  replyToEmail: "events@convergeevents.com",
  dailyLimit: 100,
  globalPaused: false,
  pausedAt: null,
  pausedBy: null,
};

// ── DB tables for singleton config (settings + branding stored by key) ────────

export const appConfig = pgTable("app_config", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
});

// ── Sponsor Tokens ────────────────────────────────────────────────────────────

export const sponsorTokens = pgTable("sponsor_tokens", {
  token: text("token").primaryKey(),
  sponsorId: varchar("sponsor_id").notNull(),
  eventId: varchar("event_id").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Sponsor Notifications ─────────────────────────────────────────────────────

export const sponsorNotifications = pgTable("sponsor_notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  eventId: varchar("event_id").notNull(),
  meetingId: varchar("meeting_id").notNull(),
  type: text("type").notNull(),
  attendeeName: text("attendee_name").notNull(),
  attendeeCompany: text("attendee_company").notNull(),
  eventName: text("event_name").notNull(),
  date: text("date").notNull(),
  time: text("time").notNull(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Data Exchange Logs ────────────────────────────────────────────────────────

export const dataExchangeLogs = pgTable("data_exchange_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category", { enum: ["sponsors", "attendees", "meetings", "nunify-meetings"] }).notNull(),
  operation: text("operation", { enum: ["import", "export"] }).notNull(),
  adminUser: text("admin_user").notNull(),
  fileName: text("file_name"),
  eventId: varchar("event_id"),
  eventCode: text("event_code"),
  totalRows: integer("total_rows").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DataExchangeLog = typeof dataExchangeLogs.$inferSelect;

// ── User Permissions ─────────────────────────────────────────────────────────

export interface UserPermissions {
  // Module-level access (controls nav visibility)
  mod_dashboard: boolean;
  mod_events: boolean;
  mod_sponsors: boolean;
  mod_attendees: boolean;
  mod_meetings: boolean;
  mod_infoRequests: boolean;
  mod_reports: boolean;
  mod_dataExchange: boolean;
  mod_branding: boolean;
  mod_settings: boolean;
  mod_users: boolean;
  mod_accessControl: boolean;
  mod_deliverables: boolean;
  mod_sponsorDashboards: boolean;
  mod_sponsorshipTemplates: boolean;
  mod_emailCenter: boolean;
  mod_dataBackup: boolean;
  mod_dataManagement: boolean;
  mod_agenda: boolean;
  // Events actions
  ev_create: boolean;
  ev_edit: boolean;
  ev_archive: boolean;
  ev_delete: boolean;
  ev_copy: boolean;
  ev_editBranding: boolean;
  ev_editMeetingBlocks: boolean;
  ev_toggleScheduling: boolean;
  // Sponsors actions
  sp_create: boolean;
  sp_edit: boolean;
  sp_archive: boolean;
  sp_delete: boolean;
  sp_copy: boolean;
  sp_export: boolean;
  sp_import: boolean;
  sp_manageContacts: boolean;
  // Attendees actions
  at_create: boolean;
  at_edit: boolean;
  at_archive: boolean;
  at_delete: boolean;
  at_export: boolean;
  at_import: boolean;
  at_viewDetail: boolean;
  at_viewContacts: boolean;
  at_viewInterests: boolean;
  // Meetings actions
  mt_create: boolean;
  mt_edit: boolean;
  mt_cancel: boolean;
  mt_delete: boolean;
  mt_export: boolean;
  mt_import: boolean;
  mt_approvePending: boolean;
  mt_nunifySync: boolean;
  mt_manageInvitations: boolean;
  // Info Requests
  ir_view: boolean;
  ir_edit: boolean;
  ir_delete: boolean;
  // Deliverables
  dl_view: boolean;
  dl_edit: boolean;
  dl_manageStatus: boolean;
  dl_sendReminders: boolean;
  dl_viewFulfillmentQueue: boolean;
  // Sponsorship Templates
  st_viewTemplates: boolean;
  st_editTemplates: boolean;
  st_generateAgreements: boolean;
  // Sponsor Dashboards
  sd_view: boolean;
  sd_sendAccess: boolean;
  sd_manageContacts: boolean;
  // Reports
  rp_view: boolean;
  rp_export: boolean;
  rp_generate: boolean;
  rp_download: boolean;
  rp_viewContactData: boolean;
  // Email Center
  ec_viewTemplates: boolean;
  ec_editTemplates: boolean;
  ec_sendTestEmail: boolean;
  ec_viewLogs: boolean;
  ec_manageAutomations: boolean;
  ec_sendCampaigns: boolean;
  ec_manageSettings: boolean;
  // Data Exchange
  de_exportSponsors: boolean;
  de_exportAttendees: boolean;
  de_exportMeetings: boolean;
  de_importSponsors: boolean;
  de_importAttendees: boolean;
  de_importMeetings: boolean;
  de_nunify: boolean;
  de_viewHistory: boolean;
  // Data Backup
  db_viewStatus: boolean;
  db_runBackups: boolean;
  db_downloadBackups: boolean;
  db_validateBackups: boolean;
  db_accessRestoreTools: boolean;
  // Branding
  br_edit: boolean;
  // Settings
  st_edit: boolean;
  // Users & Access Control
  us_create: boolean;
  us_edit: boolean;
  us_deactivate: boolean;
  us_resetPassword: boolean;
  us_managePermissions: boolean;
  us_manageRoles: boolean;
  // Agenda
  ag_create: boolean;
  ag_edit: boolean;
  ag_delete: boolean;
  ag_import: boolean;
  ag_manageSessionTypes: boolean;
  // Matchmaking & Invitations
  mm_viewDiscovery: boolean;
  mm_manageSettings: boolean;
  mm_viewInvitations: boolean;
  mm_manageInvitations: boolean;
  mm_sendInvitations: boolean;
  mm_viewAnalytics: boolean;
  // Demo Environment
  demo_viewTools: boolean;
  demo_resetEnvironment: boolean;
  demo_runSeed: boolean;
  // Sensitive data
  data_viewAttendeeEmails: boolean;
  data_viewAttendeePhones: boolean;
  data_viewSponsorContacts: boolean;
  data_exportContacts: boolean;
  // Account controls
  account_canSignIn: boolean;
  account_requirePasswordReset: boolean;
}

export const DEFAULT_USER_PERMISSIONS: UserPermissions = {
  mod_dashboard: false, mod_events: false, mod_sponsors: false, mod_attendees: false,
  mod_meetings: false, mod_infoRequests: false, mod_reports: false, mod_dataExchange: false,
  mod_branding: false, mod_settings: false, mod_users: false, mod_accessControl: false,
  mod_deliverables: false, mod_sponsorDashboards: false, mod_sponsorshipTemplates: false,
  mod_emailCenter: false, mod_dataBackup: false, mod_dataManagement: false, mod_agenda: false,
  ev_create: false, ev_edit: false, ev_archive: false, ev_delete: false, ev_copy: false,
  ev_editBranding: false, ev_editMeetingBlocks: false, ev_toggleScheduling: false,
  sp_create: false, sp_edit: false, sp_archive: false, sp_delete: false, sp_copy: false,
  sp_export: false, sp_import: false, sp_manageContacts: false,
  at_create: false, at_edit: false, at_archive: false, at_delete: false, at_export: false,
  at_import: false, at_viewDetail: false, at_viewContacts: false, at_viewInterests: false,
  mt_create: false, mt_edit: false, mt_cancel: false, mt_delete: false, mt_export: false,
  mt_import: false, mt_approvePending: false, mt_nunifySync: false, mt_manageInvitations: false,
  ir_view: false, ir_edit: false, ir_delete: false,
  dl_view: false, dl_edit: false, dl_manageStatus: false, dl_sendReminders: false,
  dl_viewFulfillmentQueue: false,
  st_viewTemplates: false, st_editTemplates: false, st_generateAgreements: false,
  sd_view: false, sd_sendAccess: false, sd_manageContacts: false,
  rp_view: false, rp_export: false, rp_generate: false, rp_download: false,
  rp_viewContactData: false,
  ec_viewTemplates: false, ec_editTemplates: false, ec_sendTestEmail: false, ec_viewLogs: false,
  ec_manageAutomations: false, ec_sendCampaigns: false, ec_manageSettings: false,
  de_exportSponsors: false, de_exportAttendees: false, de_exportMeetings: false,
  de_importSponsors: false, de_importAttendees: false, de_importMeetings: false,
  de_nunify: false, de_viewHistory: false,
  db_viewStatus: false, db_runBackups: false, db_downloadBackups: false,
  db_validateBackups: false, db_accessRestoreTools: false,
  br_edit: false, st_edit: false,
  us_create: false, us_edit: false, us_deactivate: false, us_resetPassword: false,
  us_managePermissions: false, us_manageRoles: false,
  ag_create: false, ag_edit: false, ag_delete: false, ag_import: false,
  ag_manageSessionTypes: false,
  mm_viewDiscovery: false, mm_manageSettings: false, mm_viewInvitations: false,
  mm_manageInvitations: false, mm_sendInvitations: false, mm_viewAnalytics: false,
  demo_viewTools: false, demo_resetEnvironment: false, demo_runSeed: false,
  data_viewAttendeeEmails: false, data_viewAttendeePhones: false,
  data_viewSponsorContacts: false, data_exportContacts: false,
  account_canSignIn: true, account_requirePasswordReset: false,
};

export const ADMIN_PERMISSIONS: UserPermissions = Object.keys(DEFAULT_USER_PERMISSIONS).reduce(
  (acc, key) => ({ ...acc, [key]: true }),
  {} as UserPermissions
);

export const ROLE_PRESETS: Record<string, Partial<UserPermissions>> = {
  "Event Producer": {
    mod_dashboard: true, mod_events: true, mod_sponsors: true, mod_attendees: true,
    mod_meetings: true, mod_infoRequests: true, mod_reports: true, mod_deliverables: true,
    mod_sponsorDashboards: true, mod_sponsorshipTemplates: true, mod_emailCenter: true,
    mod_agenda: true,
    ev_create: true, ev_edit: true, ev_archive: true, ev_copy: true,
    ev_editBranding: true, ev_editMeetingBlocks: true, ev_toggleScheduling: true,
    sp_create: true, sp_edit: true, sp_archive: true, sp_copy: true, sp_export: true,
    sp_import: true, sp_manageContacts: true,
    at_create: true, at_edit: true, at_archive: true, at_export: true, at_import: true,
    at_viewDetail: true, at_viewContacts: true, at_viewInterests: true,
    mt_create: true, mt_edit: true, mt_cancel: true, mt_export: true, mt_import: true,
    mt_approvePending: true, mt_manageInvitations: true,
    ir_view: true, ir_edit: true,
    dl_view: true, dl_edit: true, dl_manageStatus: true, dl_sendReminders: true,
    dl_viewFulfillmentQueue: true,
    st_viewTemplates: true, st_editTemplates: true, st_generateAgreements: true,
    sd_view: true, sd_sendAccess: true, sd_manageContacts: true,
    rp_view: true, rp_export: true, rp_generate: true, rp_download: true,
    rp_viewContactData: true,
    ec_viewTemplates: true, ec_editTemplates: true, ec_sendTestEmail: true, ec_viewLogs: true,
    ec_manageAutomations: true, ec_sendCampaigns: true, ec_manageSettings: true,
    ag_create: true, ag_edit: true, ag_delete: true, ag_import: true,
    ag_manageSessionTypes: true,
    mm_viewDiscovery: true, mm_manageSettings: true, mm_viewInvitations: true,
    mm_manageInvitations: true, mm_sendInvitations: true, mm_viewAnalytics: true,
    data_viewAttendeeEmails: true, data_viewSponsorContacts: true,
    account_canSignIn: true,
  },
  "Sales": {
    mod_dashboard: true, mod_sponsors: true, mod_attendees: true, mod_meetings: true,
    mod_infoRequests: true, mod_reports: true, mod_sponsorDashboards: true,
    sp_create: true, sp_edit: true, sp_export: true, sp_manageContacts: true,
    at_viewDetail: true, at_viewContacts: true, at_viewInterests: true,
    mt_create: true, mt_edit: true, mt_export: true,
    ir_view: true, ir_edit: true,
    sd_view: true, sd_sendAccess: true,
    rp_view: true, rp_export: true, rp_download: true,
    mm_viewDiscovery: true, mm_viewInvitations: true, mm_viewAnalytics: true,
    data_viewAttendeeEmails: true, data_viewSponsorContacts: true,
    account_canSignIn: true,
  },
  "Operations": {
    mod_dashboard: true, mod_events: true, mod_sponsors: true, mod_attendees: true,
    mod_meetings: true, mod_infoRequests: true, mod_deliverables: true, mod_dataExchange: true,
    mod_emailCenter: true, mod_dataManagement: true,
    ev_edit: true, ev_editMeetingBlocks: true,
    sp_edit: true, sp_export: true, sp_import: true,
    at_edit: true, at_export: true, at_import: true, at_viewDetail: true, at_viewContacts: true,
    mt_create: true, mt_edit: true, mt_cancel: true, mt_export: true, mt_import: true,
    mt_approvePending: true, mt_manageInvitations: true,
    ir_view: true, ir_edit: true,
    dl_view: true, dl_edit: true, dl_manageStatus: true, dl_sendReminders: true,
    dl_viewFulfillmentQueue: true,
    ec_viewTemplates: true, ec_viewLogs: true,
    de_exportSponsors: true, de_exportAttendees: true, de_exportMeetings: true,
    de_importSponsors: true, de_importAttendees: true, de_importMeetings: true,
    de_nunify: true, de_viewHistory: true,
    mm_viewInvitations: true, mm_manageInvitations: true,
    data_viewAttendeeEmails: true, data_viewSponsorContacts: true,
    account_canSignIn: true,
  },
  "Read Only": {
    mod_dashboard: true, mod_events: true, mod_sponsors: true, mod_attendees: true,
    mod_meetings: true, mod_infoRequests: true, mod_reports: true, mod_deliverables: true,
    mod_sponsorDashboards: true,
    at_viewDetail: true,
    ir_view: true,
    dl_view: true,
    sd_view: true,
    rp_view: true,
    ec_viewLogs: true,
    mm_viewDiscovery: true, mm_viewInvitations: true, mm_viewAnalytics: true,
    account_canSignIn: true,
  },
};

export const userPermissions = pgTable("user_permissions", {
  userId: varchar("user_id").primaryKey(),
  permissions: jsonb("permissions").$type<UserPermissions>().notNull().default(DEFAULT_USER_PERMISSIONS as any),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  updatedBy: text("updated_by"),
});

export type UserPermissionRecord = typeof userPermissions.$inferSelect;

// ── Permission Audit Logs ─────────────────────────────────────────────────────

export const permissionAuditLogs = pgTable("permission_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  targetUserId: text("target_user_id").notNull(),
  targetUserName: text("target_user_name").notNull(),
  changedBy: text("changed_by").notNull(),
  changedAt: timestamp("changed_at").notNull().defaultNow(),
  field: text("field").notNull(),
  oldValue: text("old_value"),
  newValue: text("new_value"),
});

export type PermissionAuditLog = typeof permissionAuditLogs.$inferSelect;

// ── Information Requests ──────────────────────────────────────────────────────

export const INFORMATION_REQUEST_STATUSES = ["New", "Contacted", "Open", "Email Sent", "Meeting Scheduled", "Closed", "Not Qualified"] as const;
export const SPONSOR_INFO_REQUEST_STATUSES = ["Open", "Email Sent", "Meeting Scheduled", "Closed", "Not Qualified"] as const;
export type InformationRequestStatus = typeof INFORMATION_REQUEST_STATUSES[number];

export const informationRequests = pgTable("information_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id"),
  sponsorId: varchar("sponsor_id").notNull(),
  attendeeId: varchar("attendee_id"),
  attendeeFirstName: text("attendee_first_name").notNull(),
  attendeeLastName: text("attendee_last_name").notNull(),
  attendeeEmail: text("attendee_email").notNull(),
  attendeeCompany: text("attendee_company").notNull(),
  attendeeTitle: text("attendee_title").notNull(),
  message: text("message"),
  consentToShareContact: boolean("consent_to_share_contact").notNull().default(false),
  source: text("source").notNull().default("Public"),
  status: text("status", { enum: INFORMATION_REQUEST_STATUSES }).notNull().default("New"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertInformationRequestSchema = createInsertSchema(informationRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  attendeeEmail: z.string().email("Valid email required"),
  consentToShareContact: z.boolean().refine((v) => v === true, {
    message: "You must consent to sharing your contact information",
  }),
});

export type InsertInformationRequest = z.infer<typeof insertInformationRequestSchema>;
export type InformationRequest = typeof informationRequests.$inferSelect;

// ── Sponsor Analytics ─────────────────────────────────────────────────────────

export const SPONSOR_ANALYTICS_EVENT_TYPES = ["profile_view", "meeting_cta_click"] as const;
export type SponsorAnalyticsEventType = typeof SPONSOR_ANALYTICS_EVENT_TYPES[number];

export const sponsorAnalytics = pgTable("sponsor_analytics", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  eventId: varchar("event_id").notNull(),
  eventType: varchar("event_type").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertSponsorAnalyticsSchema = createInsertSchema(sponsorAnalytics).omit({ id: true, createdAt: true });
export type InsertSponsorAnalytics = z.infer<typeof insertSponsorAnalyticsSchema>;
export type SponsorAnalytics = typeof sponsorAnalytics.$inferSelect;

// ── Email Logs ────────────────────────────────────────────────────────────────

export const EMAIL_LOG_TYPES = [
  "meeting_confirmation_attendee",
  "meeting_notification_sponsor",
  "info_request_notification_sponsor",
  "info_request_confirmation_attendee",
] as const;
export type EmailLogType = typeof EMAIL_LOG_TYPES[number];

export const emailLogs = pgTable("email_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailType: text("email_type").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  subject: text("subject").notNull(),
  htmlContent: text("html_content"),
  eventId: varchar("event_id"),
  sponsorId: varchar("sponsor_id"),
  attendeeId: varchar("attendee_id"),
  status: text("status", { enum: ["sent", "failed", "queued", "delivered", "opened", "clicked", "bounced"] }).notNull(),
  errorMessage: text("error_message"),
  resendOfId: varchar("resend_of_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  source: text("source"),
  templateId: varchar("template_id"),
  providerMessageId: varchar("provider_message_id"),
  deliveredAt: timestamp("delivered_at"),
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
  bouncedAt: timestamp("bounced_at"),
  bounceReason: text("bounce_reason"),
  providerStatus: text("provider_status"),
  messageJobId: varchar("message_job_id"),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

// ── Password Reset Tokens ─────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: varchar("user_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  used: boolean("used").notNull().default(false),
});

// ── Sponsor Users ─────────────────────────────────────────────────────────────

export const sponsorUsers = pgTable("sponsor_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  name: varchar("name").notNull().default(""),
  email: varchar("email").notNull(),
  accessLevel: varchar("access_level").notNull().default("owner"),
  isPrimary: boolean("is_primary").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  loginCount: integer("login_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SponsorUser = typeof sponsorUsers.$inferSelect;
export type InsertSponsorUser = typeof sponsorUsers.$inferInsert;

// ── Sponsor Login Tokens (Magic Link) ─────────────────────────────────────────

export const sponsorLoginTokens = pgTable("sponsor_login_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorUserId: varchar("sponsor_user_id").notNull(),
  sponsorId: varchar("sponsor_id").notNull(),
  tokenHash: varchar("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type SponsorLoginToken = typeof sponsorLoginTokens.$inferSelect;

// ── Email Templates ────────────────────────────────────────────────────────────

export const EMAIL_TEMPLATE_CATEGORIES = ["System", "Operational", "Campaign"] as const;
export type EmailTemplateCategory = typeof EMAIL_TEMPLATE_CATEGORIES[number];

export const emailTemplates = pgTable("email_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateKey: varchar("template_key").notNull().unique(),
  displayName: varchar("display_name").notNull(),
  category: varchar("category").notNull().default("System"),
  subjectTemplate: varchar("subject_template").notNull(),
  htmlTemplate: text("html_template").notNull().default(""),
  textTemplate: text("text_template"),
  description: text("description"),
  variables: text("variables").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;

export const emailTemplateVersions = pgTable("email_template_versions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  templateId: varchar("template_id").notNull(),
  version: integer("version").notNull(),
  displayName: varchar("display_name").notNull(),
  category: varchar("category").notNull().default("System"),
  subjectTemplate: varchar("subject_template").notNull(),
  htmlTemplate: text("html_template").notNull().default(""),
  textTemplate: text("text_template"),
  description: text("description"),
  variables: text("variables").array().notNull().default(sql`'{}'::text[]`),
  isActive: boolean("is_active").notNull().default(true),
  updatedBy: varchar("updated_by"),
  changeNote: text("change_note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type EmailTemplateVersion = typeof emailTemplateVersions.$inferSelect;

// ── Automation Rules ────────────────────────────────────────────────────────────

export const AUTOMATION_CATEGORIES = ["Meeting", "Info Requests", "Sponsor", "Attendee", "System"] as const;
export type AutomationCategory = typeof AUTOMATION_CATEGORIES[number];

export const automationRules = pgTable("automation_rules", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationKey: varchar("automation_key").notNull().unique(),
  name: varchar("name").notNull(),
  category: varchar("category").notNull(),
  triggerDescription: varchar("trigger_description").notNull(),
  audience: varchar("audience").notNull(),
  templateKey: varchar("template_key"),
  eventScope: varchar("event_scope").notNull().default("All Events"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  lastRunAt: timestamp("last_run_at"),
  emailsSent: integer("emails_sent").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  lastError: text("last_error"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AutomationRule = typeof automationRules.$inferSelect;

export const automationLogs = pgTable("automation_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  automationId: varchar("automation_id").notNull(),
  executedAt: timestamp("executed_at").notNull().defaultNow(),
  emailsSent: integer("emails_sent").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  status: varchar("status").notNull().default("success"),
  errorMessage: text("error_message"),
});

export type AutomationLog = typeof automationLogs.$inferSelect;

// ── Agreement Deliverables ─────────────────────────────────────────────────────

export const DELIVERABLE_CATEGORIES = [
  "Company Profile",
  "Event Participation",
  "Speaking & Content",
  "Meetings & Introductions",
  "Marketing & Branding",
  "Post-Event Deliverables",
  "Compliance",
] as const;
export type DeliverableCategory = typeof DELIVERABLE_CATEGORIES[number];

export const DELIVERABLE_OWNER_TYPES = ["Sponsor", "Converge", "Shared"] as const;
export type DeliverableOwnerType = typeof DELIVERABLE_OWNER_TYPES[number];

export const DELIVERABLE_FULFILLMENT_TYPES = [
  "status_only",
  "file_upload",
  "link_proof",
  "quantity_progress",
  "mixed",
] as const;
export type DeliverableFulfillmentType = typeof DELIVERABLE_FULFILLMENT_TYPES[number];

export const DELIVERABLE_DUE_TIMING_TYPES = [
  "before_event",
  "during_event",
  "after_event",
  "specific_date",
  "not_applicable",
] as const;
export type DeliverableDueTimingType = typeof DELIVERABLE_DUE_TIMING_TYPES[number];

export const DELIVERABLE_STATUSES = [
  "Not Started",
  "Awaiting Sponsor Input",
  "In Progress",
  "Scheduled",
  "Delivered",
  "Available After Event",
  "Blocked",
  "Approved",
  "Issue Identified",
  "Needed",
  "Received",
  "Under Review",
] as const;
export type DeliverableStatus = typeof DELIVERABLE_STATUSES[number];

// 2A — Package Templates
export const agreementPackageTemplates = pgTable("agreement_package_templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageName: varchar("package_name").notNull(),
  sponsorshipLevel: varchar("sponsorship_level").notNull(),
  eventId: varchar("event_id"),
  eventFamily: varchar("event_family"),
  year: varchar("year"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  isArchived: boolean("is_archived").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertPackageTemplateSchema = createInsertSchema(agreementPackageTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPackageTemplate = z.infer<typeof insertPackageTemplateSchema>;
export type PackageTemplate = typeof agreementPackageTemplates.$inferSelect;

// 2B — Deliverable Template Items
export const agreementDeliverableTemplateItems = pgTable("agreement_deliverable_template_items", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  packageTemplateId: varchar("package_template_id").notNull(),
  category: varchar("category").notNull(),
  deliverableName: varchar("deliverable_name").notNull(),
  deliverableDescription: text("deliverable_description"),
  defaultQuantity: integer("default_quantity"),
  quantityUnit: varchar("quantity_unit"),
  ownerType: varchar("owner_type").notNull().default("Converge"),
  sponsorEditable: boolean("sponsor_editable").notNull().default(false),
  sponsorVisible: boolean("sponsor_visible").notNull().default(true),
  fulfillmentType: varchar("fulfillment_type").notNull().default("status_only"),
  reminderEligible: boolean("reminder_eligible").notNull().default(true),
  dueTiming: varchar("due_timing").notNull().default("not_applicable"),
  dueOffsetDays: integer("due_offset_days"),
  displayOrder: integer("display_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  sponsorFacingNote: text("sponsor_facing_note"),
  helpTitle: varchar("help_title"),
  helpText: text("help_text"),
  helpLink: varchar("help_link"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertDeliverableTemplateItemSchema = createInsertSchema(agreementDeliverableTemplateItems).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliverableTemplateItem = z.infer<typeof insertDeliverableTemplateItemSchema>;
export type DeliverableTemplateItem = typeof agreementDeliverableTemplateItems.$inferSelect;

// 2C — Sponsor Agreement Deliverables (live instances)
export const agreementDeliverables = pgTable("agreement_deliverables", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  eventId: varchar("event_id").notNull(),
  packageTemplateId: varchar("package_template_id"),
  sponsorshipLevel: varchar("sponsorship_level").notNull(),
  category: varchar("category").notNull(),
  deliverableName: varchar("deliverable_name").notNull(),
  deliverableDescription: text("deliverable_description"),
  quantity: integer("quantity"),
  quantityUnit: varchar("quantity_unit"),
  ownerType: varchar("owner_type").notNull().default("Converge"),
  sponsorEditable: boolean("sponsor_editable").notNull().default(false),
  sponsorVisible: boolean("sponsor_visible").notNull().default(true),
  fulfillmentType: varchar("fulfillment_type").notNull().default("status_only"),
  reminderEligible: boolean("reminder_eligible").notNull().default(true),
  status: varchar("status").notNull().default("Not Started"),
  dueTiming: varchar("due_timing").notNull().default("not_applicable"),
  dueDate: timestamp("due_date"),
  sponsorFacingNote: text("sponsor_facing_note"),
  internalNote: text("internal_note"),
  isOverridden: boolean("is_overridden").notNull().default(false),
  isCustom: boolean("is_custom").notNull().default(false),
  createdFromTemplateItemId: varchar("created_from_template_item_id"),
  displayOrder: integer("display_order").notNull().default(0),
  completedAt: timestamp("completed_at"),
  helpTitle: varchar("help_title"),
  helpText: text("help_text"),
  helpLink: varchar("help_link"),
  registrationAccessCode: varchar("registration_access_code"),
  registrationInstructions: text("registration_instructions"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAgreementDeliverableSchema = createInsertSchema(agreementDeliverables).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgreementDeliverable = z.infer<typeof insertAgreementDeliverableSchema>;
export type AgreementDeliverable = typeof agreementDeliverables.$inferSelect;

// 2D — Sponsor-submitted registrant entries (e.g., VIP registrations / sponsor representatives)
export const agreementDeliverableRegistrants = pgTable("agreement_deliverable_registrants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementDeliverableId: varchar("agreement_deliverable_id").notNull(),
  name: varchar("name").notNull().default(""),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  title: varchar("title"),
  email: varchar("email"),
  conciergeRole: varchar("concierge_role"),
  registrationStatus: varchar("registration_status").notNull().default("Unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertAgreementDeliverableRegistrantSchema = createInsertSchema(agreementDeliverableRegistrants).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgreementDeliverableRegistrant = z.infer<typeof insertAgreementDeliverableRegistrantSchema>;
export type AgreementDeliverableRegistrant = typeof agreementDeliverableRegistrants.$inferSelect;

// 2E — Sponsor-submitted speaker details
export const agreementDeliverableSpeakers = pgTable("agreement_deliverable_speakers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  agreementDeliverableId: varchar("agreement_deliverable_id").notNull(),
  speakerName: varchar("speaker_name").notNull(),
  speakerTitle: varchar("speaker_title"),
  speakerBio: text("speaker_bio"),
  sessionType: varchar("session_type"),
  sessionTitle: varchar("session_title"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertAgreementDeliverableSpeakerSchema = createInsertSchema(agreementDeliverableSpeakers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAgreementDeliverableSpeaker = z.infer<typeof insertAgreementDeliverableSpeakerSchema>;
export type AgreementDeliverableSpeaker = typeof agreementDeliverableSpeakers.$inferSelect;

// 2E — File Assets (files uploaded to Object Storage, linked to sponsors/events/deliverables)
export const FILE_CATEGORIES = ["logos", "headshots", "company-assets", "social-graphics", "session-assets", "promo-assets", "attendee-reports", "sponsor-reports", "contracts", "internal"] as const;
export type FileCategory = typeof FILE_CATEGORIES[number];

export const fileAssets = pgTable("file_assets", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id"),
  sponsorId: varchar("sponsor_id"),
  deliverableId: varchar("deliverable_id"),
  uploadedByUserId: varchar("uploaded_by_user_id"),
  uploadedByRole: varchar("uploaded_by_role").notNull().default("admin"),
  category: varchar("category").notNull(),
  originalFileName: varchar("original_file_name").notNull(),
  storedFileName: varchar("stored_file_name").notNull(),
  objectKey: varchar("object_key").notNull(),
  mimeType: varchar("mime_type").notNull(),
  sizeBytes: integer("size_bytes"),
  visibility: varchar("visibility").notNull().default("sponsor_private"),
  accessScope: varchar("access_scope").notNull().default("deliverable"),
  title: varchar("title"),
  description: text("description"),
  status: varchar("status").notNull().default("active"),
  isLatestVersion: boolean("is_latest_version").notNull().default(true),
  replacesFileAssetId: varchar("replaces_file_asset_id"),
  uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertFileAssetSchema = createInsertSchema(fileAssets).omit({ id: true, uploadedAt: true, updatedAt: true });
export type InsertFileAsset = z.infer<typeof insertFileAssetSchema>;
export type FileAsset = typeof fileAssets.$inferSelect;

// 2E2 — Deliverable Links (sponsor-visible links attached to deliverables)
export const deliverableLinks = pgTable("deliverable_links", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliverableId: varchar("deliverable_id").notNull(),
  title: varchar("title").notNull(),
  url: text("url").notNull(),
  visibility: varchar("visibility").notNull().default("sponsor_private"),
  addedByUserId: varchar("added_by_user_id"),
  addedAt: timestamp("added_at").notNull().defaultNow(),
});
export const insertDeliverableLinkSchema = createInsertSchema(deliverableLinks).omit({ id: true, addedAt: true });
export type InsertDeliverableLink = z.infer<typeof insertDeliverableLinkSchema>;
export type DeliverableLink = typeof deliverableLinks.$inferSelect;

// 2E3 — Deliverable Social Entries (per-item social graphic or social announcement records)
export const SOCIAL_ENTRY_TYPES = ["graphic", "announcement"] as const;
export type SocialEntryType = typeof SOCIAL_ENTRY_TYPES[number];

export const deliverableSocialEntries = pgTable("deliverable_social_entries", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deliverableId: varchar("deliverable_id").notNull(),
  entryType: varchar("entry_type").notNull(),
  entryIndex: integer("entry_index").notNull().default(1),
  title: varchar("title"),
  url: text("url"),
  fileAssetId: varchar("file_asset_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
export const insertDeliverableSocialEntrySchema = createInsertSchema(deliverableSocialEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDeliverableSocialEntry = z.infer<typeof insertDeliverableSocialEntrySchema>;
export type DeliverableSocialEntry = typeof deliverableSocialEntries.$inferSelect;

// 2F — Reminder log (tracks all automated + manual reminder emails sent to sponsors)
export const REMINDER_TYPES = ["weekly_automatic", "manual_admin"] as const;
export type ReminderType = typeof REMINDER_TYPES[number];

export const agreementDeliverableReminders = pgTable("agreement_deliverable_reminders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sponsorId: varchar("sponsor_id").notNull(),
  eventId: varchar("event_id").notNull(),
  recipientEmail: varchar("recipient_email").notNull(),
  reminderType: varchar("reminder_type").notNull().default("manual_admin"),
  sentByRole: varchar("sent_by_role").notNull().default("admin"),
  sentByUserId: varchar("sent_by_user_id"),
  sentAt: timestamp("sent_at").notNull().defaultNow(),
  status: varchar("status").notNull().default("sent"),
  errorMessage: text("error_message"),
  deliverableCount: integer("deliverable_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
export const insertAgreementDeliverableReminderSchema = createInsertSchema(agreementDeliverableReminders).omit({ id: true, createdAt: true });
export type InsertAgreementDeliverableReminder = z.infer<typeof insertAgreementDeliverableReminderSchema>;
export type AgreementDeliverableReminder = typeof agreementDeliverableReminders.$inferSelect;

// ── Meeting Invitations ───────────────────────────────────────────────────────

export const MEETING_INVITATION_STATUSES = ["pending", "accepted", "declined", "expired", "scheduled"] as const;
export type MeetingInvitationStatus = typeof MEETING_INVITATION_STATUSES[number];

export const INVITATION_QUOTAS: Record<string, number> = {
  Platinum: 25,
  Gold: 15,
  Silver: 10,
  Bronze: 5,
};

export const MAX_INVITATIONS_PER_ATTENDEE = 6;

export const meetingInvitations = pgTable("meeting_invitations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  sponsorId: varchar("sponsor_id").notNull(),
  attendeeId: varchar("attendee_id").notNull(),
  sponsorUserId: varchar("sponsor_user_id"),
  status: text("status", { enum: ["pending", "accepted", "declined", "expired", "scheduled"] }).notNull().default("pending"),
  message: text("message"),
  categorySnapshot: text("category_snapshot"),
  matchScore: integer("match_score"),
  secureToken: varchar("secure_token"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
  acceptedAt: timestamp("accepted_at"),
  declinedAt: timestamp("declined_at"),
  expiresAt: timestamp("expires_at"),
});

export const insertMeetingInvitationSchema = createInsertSchema(meetingInvitations).omit({
  id: true, createdAt: true, updatedAt: true,
}).extend({
  status: z.enum(MEETING_INVITATION_STATUSES).default("pending"),
  message: z.string().nullable().optional(),
  categorySnapshot: z.string().nullable().optional(),
  matchScore: z.number().nullable().optional(),
  sponsorUserId: z.string().nullable().optional(),
  secureToken: z.string().nullable().optional(),
  respondedAt: z.coerce.date().nullable().optional(),
  acceptedAt: z.coerce.date().nullable().optional(),
  declinedAt: z.coerce.date().nullable().optional(),
  expiresAt: z.coerce.date().nullable().optional(),
});

export type InsertMeetingInvitation = z.infer<typeof insertMeetingInvitationSchema>;
export type MeetingInvitation = typeof meetingInvitations.$inferSelect;

// ── Scheduled Emails ──────────────────────────────────────────────────────────

export const SCHEDULED_EMAIL_STATUSES = ["Draft", "Scheduled", "Sent", "Cancelled", "Failed"] as const;
export type ScheduledEmailStatus = typeof SCHEDULED_EMAIL_STATUSES[number];

export const scheduledEmails = pgTable("scheduled_emails", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  emailType: text("email_type").notNull(),
  recipientEmail: text("recipient_email").notNull(),
  recipientName: text("recipient_name"),
  subject: text("subject").notNull(),
  templateId: text("template_id"),
  eventId: varchar("event_id"),
  sponsorId: varchar("sponsor_id"),
  attendeeId: varchar("attendee_id"),
  scheduledAt: timestamp("scheduled_at").notNull(),
  sentAt: timestamp("sent_at"),
  status: text("status", { enum: SCHEDULED_EMAIL_STATUSES }).notNull().default("Scheduled"),
  errorMessage: text("error_message"),
  metadata: jsonb("metadata"),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduledEmailSchema = createInsertSchema(scheduledEmails).omit({
  id: true, createdAt: true, updatedAt: true, sentAt: true,
}).extend({
  status: z.enum(SCHEDULED_EMAIL_STATUSES).default("Scheduled"),
  scheduledAt: z.coerce.date(),
  metadata: z.any().nullable().optional(),
});

export type InsertScheduledEmail = z.infer<typeof insertScheduledEmailSchema>;
export type ScheduledEmail = typeof scheduledEmails.$inferSelect;

// ── Backup Jobs ───────────────────────────────────────────────────────────────

export const BACKUP_TYPES = ["full", "event", "sponsor_event"] as const;
export const BACKUP_STATUSES = ["queued", "in_progress", "completed", "failed"] as const;
export const BACKUP_TRIGGER_TYPES = ["manual", "scheduled"] as const;

export const backupJobs = pgTable("backup_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  backupType: varchar("backup_type").notNull(),
  status: varchar("status").notNull().default("queued"),
  triggerType: varchar("trigger_type").notNull().default("manual"),
  eventId: varchar("event_id"),
  eventCode: varchar("event_code"),
  sponsorId: varchar("sponsor_id"),
  sponsorSlug: varchar("sponsor_slug"),
  r2ObjectKey: varchar("r2_object_key"),
  manifestKey: varchar("manifest_key"),
  schemaVersion: integer("schema_version").default(1),
  fileSizeBytes: bigint("file_size_bytes", { mode: "number" }),
  recordCount: integer("record_count"),
  errorMessage: text("error_message"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBackupJobSchema = createInsertSchema(backupJobs).omit({ id: true, createdAt: true });
export type InsertBackupJob = z.infer<typeof insertBackupJobSchema>;
export type BackupJob = typeof backupJobs.$inferSelect;

// ── Agenda Module ─────────────────────────────────────────────────────────────

// Session Types (configurable)
export const sessionTypes = pgTable("session_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  speakerLabelSingular: text("speaker_label_singular").notNull().default("Speaker"),
  speakerLabelPlural: text("speaker_label_plural").notNull().default("Speakers"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertSessionTypeSchema = createInsertSchema(sessionTypes).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSessionType = z.infer<typeof insertSessionTypeSchema>;
export type SessionType = typeof sessionTypes.$inferSelect;

export const DEFAULT_SESSION_TYPES: Omit<InsertSessionType, "displayOrder">[] = [
  { key: "PANEL", label: "Panel", speakerLabelSingular: "Panelist", speakerLabelPlural: "Panelists" },
  { key: "PEER_TO_PEER", label: "Peer-to-Peer", speakerLabelSingular: "Discussion Leader", speakerLabelPlural: "Discussion Leaders" },
  { key: "KEYNOTE", label: "Keynote", speakerLabelSingular: "Speaker", speakerLabelPlural: "Speakers" },
  { key: "NETWORKING", label: "Networking", speakerLabelSingular: "Speaker", speakerLabelPlural: "Speakers" },
  { key: "OTHER", label: "Other", speakerLabelSingular: "Speaker", speakerLabelPlural: "Speakers" },
];

// Agenda Sessions
export const agendaSessions = pgTable("agenda_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  sessionCode: text("session_code"),
  title: text("title").notNull(),
  description: text("description"),
  sessionTypeKey: text("session_type_key").notNull(),
  sessionDate: text("session_date").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  timezone: text("timezone").notNull().default("America/New_York"),
  locationName: text("location_name"),
  locationDetails: text("location_details"),
  sponsorId: varchar("sponsor_id"),
  sponsorNameSnapshot: text("sponsor_name_snapshot"),
  status: text("status", { enum: ["Draft", "Published", "Cancelled"] }).notNull().default("Draft"),
  displayOrder: integer("display_order").notNull().default(0),
  isFeatured: boolean("is_featured").notNull().default(false),
  isPublic: boolean("is_public").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAgendaSessionSchema = createInsertSchema(agendaSessions).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  sessionCode: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  locationName: z.string().nullable().optional(),
  locationDetails: z.string().nullable().optional(),
  sponsorId: z.string().nullable().optional(),
  sponsorNameSnapshot: z.string().nullable().optional(),
  status: z.enum(["Draft", "Published", "Cancelled"]).default("Draft"),
  isFeatured: z.boolean().default(false),
  isPublic: z.boolean().default(true),
});
export type InsertAgendaSession = z.infer<typeof insertAgendaSessionSchema>;
export type AgendaSession = typeof agendaSessions.$inferSelect;

// Agenda Session Speakers
export const agendaSessionSpeakers = pgTable("agenda_session_speakers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull(),
  speakerOrder: integer("speaker_order").notNull().default(1),
  name: text("name").notNull(),
  title: text("title"),
  company: text("company"),
  roleLabel: text("role_label"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAgendaSessionSpeakerSchema = createInsertSchema(agendaSessionSpeakers).omit({ id: true, createdAt: true, updatedAt: true }).extend({
  title: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  roleLabel: z.string().nullable().optional(),
});
export type InsertAgendaSessionSpeaker = z.infer<typeof insertAgendaSessionSpeakerSchema>;
export type AgendaSessionSpeaker = typeof agendaSessionSpeakers.$inferSelect;

// Attendee Saved Sessions (My Agenda)
export const attendeeSavedSessions = pgTable("attendee_saved_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  attendeeId: varchar("attendee_id").notNull(),
  eventId: varchar("event_id").notNull(),
  sessionId: varchar("session_id").notNull(),
  savedAt: timestamp("saved_at").notNull().defaultNow(),
});

export const insertAttendeeSavedSessionSchema = createInsertSchema(attendeeSavedSessions).omit({ id: true, savedAt: true });
export type InsertAttendeeSavedSession = z.infer<typeof insertAttendeeSavedSessionSchema>;
export type AttendeeSavedSession = typeof attendeeSavedSessions.$inferSelect;

// Agenda Import Jobs
export const agendaImportJobs = pgTable("agenda_import_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  fileName: text("file_name").notNull(),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).notNull().default("pending"),
  rowsTotal: integer("rows_total").notNull().default(0),
  rowsCreated: integer("rows_created").notNull().default(0),
  rowsUpdated: integer("rows_updated").notNull().default(0),
  rowsFailed: integer("rows_failed").notNull().default(0),
  errorLog: text("error_log"),
  createdByUserId: varchar("created_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertAgendaImportJobSchema = createInsertSchema(agendaImportJobs).omit({ id: true, createdAt: true, completedAt: true });
export type InsertAgendaImportJob = z.infer<typeof insertAgendaImportJobSchema>;
export type AgendaImportJob = typeof agendaImportJobs.$inferSelect;

// ── Campaigns ─────────────────────────────────────────────────────────────────

export const CAMPAIGN_STATUSES = ["Draft", "Scheduled", "Sending", "Sent", "Cancelled"] as const;
export type CampaignStatus = typeof CAMPAIGN_STATUSES[number];
export const CAMPAIGN_AUDIENCE_TYPES = ["Attendees", "Sponsors"] as const;
export type CampaignAudienceType = typeof CAMPAIGN_AUDIENCE_TYPES[number];

export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull(),
  eventId: varchar("event_id"),
  audienceType: varchar("audience_type").notNull().default("Attendees"),
  audienceFilters: jsonb("audience_filters").notNull().default({}),
  templateId: varchar("template_id"),
  status: varchar("status").notNull().default("Draft"),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  emailsSent: integer("emails_sent").notNull().default(0),
  failures: integer("failures").notNull().default(0),
  audienceSize: integer("audience_size").notNull().default(0),
  createdBy: varchar("created_by"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({ id: true, createdAt: true, updatedAt: true, sentAt: true, emailsSent: true, failures: true });
export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// ── Message Jobs ─────────────────────────────────────────────────────────────

export const MESSAGE_JOB_TYPES = ["SYSTEM", "AUTOMATION", "CAMPAIGN", "MANUAL"] as const;
export type MessageJobType = typeof MESSAGE_JOB_TYPES[number];

export const MESSAGE_JOB_SOURCE_TYPES = ["automation", "campaign", "manual_send", "scheduled_send", "event_action"] as const;
export type MessageJobSourceType = typeof MESSAGE_JOB_SOURCE_TYPES[number];

export const MESSAGE_JOB_TRIGGER_TYPES = ["EVENT_ACTION", "AUTOMATION_RULE", "MANUAL_SEND", "SCHEDULED_SEND", "CAMPAIGN_SEND"] as const;
export type MessageJobTriggerType = typeof MESSAGE_JOB_TRIGGER_TYPES[number];

export const MESSAGE_JOB_STATUSES = ["DRAFT", "SCHEDULED", "RUNNING", "COMPLETED", "FAILED", "CANCELLED"] as const;
export type MessageJobStatus = typeof MESSAGE_JOB_STATUSES[number];

export const messageJobs = pgTable("message_jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobName: text("job_name").notNull(),
  messageType: text("message_type").notNull(),
  sourceType: text("source_type").notNull(),
  sourceId: varchar("source_id"),
  eventId: varchar("event_id"),
  sponsorId: varchar("sponsor_id"),
  attendeeId: varchar("attendee_id"),
  templateId: varchar("template_id"),
  templateKeySnapshot: text("template_key_snapshot"),
  triggerType: text("trigger_type").notNull(),
  triggerName: text("trigger_name"),
  status: text("status").notNull().default("RUNNING"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recipientCount: integer("recipient_count").notNull().default(0),
  sentCount: integer("sent_count").notNull().default(0),
  failedCount: integer("failed_count").notNull().default(0),
  deliveredCount: integer("delivered_count"),
  openedCount: integer("opened_count"),
  clickedCount: integer("clicked_count"),
  createdByUserId: varchar("created_by_user_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertMessageJobSchema = createInsertSchema(messageJobs).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertMessageJob = z.infer<typeof insertMessageJobSchema>;
export type MessageJob = typeof messageJobs.$inferSelect;
