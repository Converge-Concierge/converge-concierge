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

// --- Event ---
export const events = pgTable("events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  location: text("location").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
  logoUrl: text("logo_url"),
  meetingLocations: jsonb("meeting_locations").$type<MeetingLocation[]>().notNull().default([]),
  meetingBlocks: jsonb("meeting_blocks").$type<MeetingTimeBlock[]>().notNull().default([]),
});

export const insertEventSchema = createInsertSchema(events).extend({
  slug: z.string().min(1, "Event code is required").regex(/^[A-Z0-9]+$/, "Event code must be uppercase letters and numbers only"),
});
export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

// --- Sponsor ---
export const sponsors = pgTable("sponsors", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  logoUrl: text("logo_url"),
  level: text("level", { enum: ["Platinum", "Gold", "Silver", "Bronze"] }).notNull(),
  assignedEvents: jsonb("assigned_events").$type<string[]>().notNull().default([]), // array of event ids
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
});

export const insertSponsorSchema = createInsertSchema(sponsors);
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
  status: text("status", { enum: ["active", "archived"] }).notNull().default("active"),
});

export const insertAttendeeSchema = createInsertSchema(attendees);
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
export const meetings = pgTable("meetings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  eventId: varchar("event_id").notNull(),
  sponsorId: varchar("sponsor_id").notNull(),
  attendeeId: varchar("attendee_id").notNull(),
  date: text("date").notNull(), // ISO date string
  time: text("time").notNull(), // HH:mm
  location: text("location").notNull(), // Location name or ID
  status: text("status", { enum: ["Scheduled", "Completed", "Cancelled", "NoShow"] }).notNull().default("Scheduled"),
  notes: text("notes"),
});

export const insertMeetingSchema = createInsertSchema(meetings);
export type Meeting = typeof meetings.$inferSelect;
export type InsertMeeting = z.infer<typeof insertMeetingSchema>;
