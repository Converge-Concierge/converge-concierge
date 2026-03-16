import type { IStorage } from "./storage";

const AUTOMATIONS = [
  {
    automationKey: "meeting_confirmation",
    name: "Meeting Confirmation",
    category: "Meeting",
    triggerDescription: "Meeting booked or invitation accepted",
    audience: "Attendee + Sponsor",
    templateKey: "meeting_confirmation_attendee",
  },
  {
    automationKey: "meeting_reminder_24h",
    name: "Meeting Reminder — 24 Hours",
    category: "Meeting",
    triggerDescription: "24 hours before scheduled meeting",
    audience: "Meeting Participants",
    templateKey: "meeting_reminder_24",
  },
  {
    automationKey: "meeting_reminder_2h",
    name: "Meeting Reminder — 2 Hours",
    category: "Meeting",
    triggerDescription: "2 hours before scheduled meeting",
    audience: "Meeting Participants",
    templateKey: "meeting_reminder_2",
  },
  {
    automationKey: "info_request_confirmation",
    name: "Info Request Confirmation",
    category: "Info Requests",
    triggerDescription: "Attendee submits information request",
    audience: "Attendee",
    templateKey: "info_request_confirmation_attendee",
  },
  {
    automationKey: "info_request_notification",
    name: "Info Request Notification",
    category: "Info Requests",
    triggerDescription: "Attendee submits information request",
    audience: "Sponsor",
    templateKey: "info_request_notification_sponsor",
  },
  {
    automationKey: "sponsor_dashboard_welcome",
    name: "Sponsor Dashboard Welcome",
    category: "Sponsor",
    triggerDescription: "Admin sends dashboard access to sponsor",
    audience: "Sponsor User",
    templateKey: "sponsor_magic_login",
  },
  {
    automationKey: "deliverable_reminder",
    name: "Deliverable Reminder",
    category: "Sponsor",
    triggerDescription: "Weekly check — Tuesdays 8–10 AM UTC for incomplete deliverables",
    audience: "Sponsor (primary contact)",
    templateKey: null,
  },
  {
    automationKey: "scheduling_invitation",
    name: "Scheduling Invitation",
    category: "Attendee",
    triggerDescription: "Admin or sponsor sends scheduling invitation",
    audience: "Attendee",
    templateKey: "scheduling_invitation",
  },
  {
    automationKey: "meeting_notification_sponsor",
    name: "Meeting Notification (Sponsor)",
    category: "Meeting",
    triggerDescription: "Meeting booked by attendee",
    audience: "Sponsor",
    templateKey: "meeting_notification_sponsor",
  },
];

export async function seedAutomationRules(storage: IStorage): Promise<void> {
  try {
    for (const a of AUTOMATIONS) {
      await storage.upsertAutomationRule(a);
    }
    console.log(`[AUTOMATIONS] Seeded ${AUTOMATIONS.length} automation rules`);
  } catch (err) {
    console.error("[AUTOMATIONS] Seeding failed:", err);
  }
}
