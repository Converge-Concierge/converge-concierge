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
  DEFAULT_SETTINGS, DEFAULT_BRANDING,
} from "@shared/schema";
import { randomUUID, randomBytes } from "crypto";

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
  getAttendeeByEmail(email: string): Promise<Attendee | undefined>;
  getAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined>;
  getArchivedAttendeeByEmailAndEvent(email: string, eventId: string): Promise<Attendee | undefined>;
  createAttendee(attendee: InsertAttendee): Promise<Attendee>;
  updateAttendee(id: string, updates: Partial<InsertAttendee>): Promise<Attendee | undefined>;
  deleteAttendee(id: string): Promise<void>;

  // Meetings
  getMeetings(): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(meeting: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, updates: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;
  getMeetingConflict(eventId: string, sponsorId: string, date: string, time: string, excludeId?: string): Promise<Meeting | undefined>;
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
}

export const storage = new MemStorage();
