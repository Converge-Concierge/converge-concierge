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

// --- Attendee ---
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAttendeeSchema = createInsertSchema(attendees).extend({
  firstName: z.string().default(""),
  lastName: z.string().default(""),
  archiveSource: z.enum(["event", "manual"]).nullable().optional(),
  interests: z.array(z.string()).nullable().optional(),
  notes: z.string().nullable().optional(),
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
  category: text("category", { enum: ["sponsors", "attendees", "meetings"] }).notNull(),
  operation: text("operation", { enum: ["import", "export"] }).notNull(),
  adminUser: text("admin_user").notNull(),
  fileName: text("file_name"),
  totalRows: integer("total_rows").notNull().default(0),
  importedCount: integer("imported_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  rejectedCount: integer("rejected_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type DataExchangeLog = typeof dataExchangeLogs.$inferSelect;

// ── Password Reset Tokens ─────────────────────────────────────────────────────

export const passwordResetTokens = pgTable("password_reset_tokens", {
  token: text("token").primaryKey(),
  userId: varchar("user_id").notNull(),
  expiresAt: bigint("expires_at", { mode: "number" }).notNull(),
  used: boolean("used").notNull().default(false),
});
