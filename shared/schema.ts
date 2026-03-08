import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
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

// --- Meeting Location ---
export const meetingLocationSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.string(),
});

export type MeetingLocation = z.infer<typeof meetingLocationSchema>;

// --- Meeting Time Block ---
export const meetingTimeBlockSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  date: z.string(), // ISO date string
  startTime: z.string(), // HH:mm
  endTime: z.string(), // HH:mm
});

export type MeetingTimeBlock = z.infer<typeof meetingTimeBlockSchema>;

// --- EventSponsor Relationship Link ---
export const eventSponsorLinkSchema = z.object({
  eventId: z.string(),
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
});

export const insertEventSchema = createInsertSchema(events).extend({
  slug: z.string().min(1, "Event code is required").regex(/^[A-Z0-9]+$/, "Event code must be uppercase letters and numbers only"),
  archiveSource: z.enum(["manual", "event"]).nullable().optional(),
});
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// --- Sponsor ---
export const sponsors = pgTable("sponsors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  level: text("level", { enum: ["Platinum", "Gold", "Silver", "Bronze"] }).notNull(),
  assignedEvents: jsonb("assigned_events").$type<EventSponsorLink[]>().notNull().default([]),
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["manual", "event"] }),
  allowOnlineMeetings: boolean("allow_online_meetings").notNull().default(false),
  shortDescription: text("short_description"),
  websiteUrl: text("website_url"),
  linkedinUrl: text("linkedin_url"),
  solutionsSummary: text("solutions_summary"),
});

export const insertSponsorSchema = createInsertSchema(sponsors).extend({
  assignedEvents: z.array(eventSponsorLinkSchema).default([]),
  archiveSource: z.enum(["manual", "event"]).nullable().optional(),
  allowOnlineMeetings: z.boolean().default(false).optional(),
  shortDescription: z.string().nullable().optional(),
  websiteUrl: z.string().nullable().optional(),
  linkedinUrl: z.string().nullable().optional(),
  solutionsSummary: z.string().nullable().optional(),
});
export type Sponsor = typeof sponsors.$inferSelect;
export type InsertSponsor = z.infer<typeof insertSponsorSchema>;

// --- Attendee ---
export const attendees = pgTable("attendees", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  email: text("email").notNull(),
  linkedinUrl: text("linkedin_url"),
  assignedEvent: varchar("assigned_event").notNull(), // event id
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["event", "manual"] }),
});

export const insertAttendeeSchema = createInsertSchema(attendees).extend({
  archiveSource: z.enum(["event", "manual"]).nullable().optional(),
});
export type Attendee = typeof attendees.$inferSelect;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;

// Manual attendee entry used when scheduling a meeting without a pre-existing record
export const manualAttendeeSchema = z.object({
  name: z.string().min(1),
  company: z.string().min(1),
  title: z.string().min(1),
  email: z.string().email(),
  linkedinUrl: z.string().url().optional().or(z.literal("")),
});

// --- Sponsor Notifications ---
export const SPONSOR_NOTIFICATION_TYPES = [
  "onsite_booked",
  "online_request_submitted",
  "meeting_cancelled",
  "request_confirmed",
  "request_declined",
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
  status: text("status", { enum: ["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed"] }).notNull().default("Scheduled"),
  source: text("source", { enum: ["admin", "public"] }).notNull().default("admin"),
  notes: text("notes"),
  archiveState: text("archive_state", { enum: ["active", "archived"] }).notNull().default("active"),
  archiveSource: text("archive_source", { enum: ["event", "manual"] }),
});

export const insertMeetingSchema = createInsertSchema(meetings).extend({
  archiveSource: z.enum(["event", "manual"]).nullable().optional(),
  source: z.enum(["admin", "public"]).optional().default("admin"),
  meetingType: z.enum(["onsite", "online_request"]).optional().default("onsite"),
  status: z.enum(["Scheduled", "Completed", "Cancelled", "NoShow", "Pending", "Confirmed"]).optional().default("Scheduled"),
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
