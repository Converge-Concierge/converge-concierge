import {
  type User, type InsertUser,
  type Event, type InsertEvent,
  type Sponsor, type InsertSponsor,
  type Attendee, type InsertAttendee,
  type Meeting, type InsertMeeting,
  type SponsorToken,
} from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";

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
  getAttendeeByEmail(email: string): Promise<Attendee | undefined>;
  createAttendee(attendee: InsertAttendee): Promise<Attendee>;
  updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined>;
  deleteAttendee(id: string): Promise<void>;

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  getMeetingConflict(eventId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined>;

  // Sponsor tokens
  getSponsorToken(token: string): Promise<SponsorToken | undefined>;
  getSponsorTokensBySponsor(sponsorId: string): Promise<SponsorToken[]>;
  createSponsorToken(sponsorId: string, eventId: string): Promise<SponsorToken>;
  revokeSponsorToken(token: string): Promise<SponsorToken | undefined>;
  deleteSponsorToken(token: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private events: Map<string, Event>;
  private sponsors: Map<string, Sponsor>;
  private attendees: Map<string, Attendee>;
  private meetings: Map<string, Meeting>;
  private sponsorTokens: Map<string, SponsorToken>;

  constructor() {
    this.users = new Map();
    this.events = new Map();
    this.sponsors = new Map();
    this.attendees = new Map();
    this.meetings = new Map();
    this.sponsorTokens = new Map();
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

  async createEvent(insertEvent: InsertEvent): Promise<Event> {
    const id = randomUUID();
    const event: Event = {
      ...insertEvent,
      id,
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

  async createAttendee(insertAttendee: InsertAttendee): Promise<Attendee> {
    const id = randomUUID();
    const attendee: Attendee = { ...insertAttendee, id } as Attendee;
    this.attendees.set(id, attendee);
    return attendee;
  }

  async updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined> {
    const existing = this.attendees.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...updates } as Attendee;
    this.attendees.set(id, updated);
    return updated;
  }

  async deleteAttendee(id: string): Promise<void> {
    this.attendees.delete(id);
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
    const meeting: Meeting = { ...insertMeeting, id } as Meeting;
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

  async getMeetingConflict(eventId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined> {
    return Array.from(this.meetings.values()).find(
      (m) =>
        m.eventId === eventId &&
        m.date === date &&
        m.time === time &&
        m.id !== excludeId
    );
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
}

export const storage = new MemStorage();
