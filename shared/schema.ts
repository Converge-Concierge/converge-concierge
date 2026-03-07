import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// --- Meeting Location ---
export const meetingLocationSchema = z.object({
  id: z.string().uuid().default(() => crypto.randomUUID()),
  name: z.enum(["Booth", "Work Lounge", "VIP Room", "Networking Lounge"]),
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

export const insertEventSchema = createInsertSchema(events);
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
  assignedEvent: varchar("assigned_event").notNull(), // event id
});

export const insertAttendeeSchema = createInsertSchema(attendees);
export type Attendee = typeof attendees.$inferSelect;
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;

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
