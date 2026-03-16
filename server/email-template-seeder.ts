import type { IStorage } from "./storage";

const COMMON_MEETING_VARS = [
  "attendee_first_name",
  "attendee_full_name",
  "sponsor_name",
  "event_name",
  "event_code",
  "meeting_date",
  "meeting_time",
  "meeting_location",
  "meeting_type",
  "status",
  "event_schedule_url",
];

const TEMPLATES = [
  {
    templateKey: "meeting_confirmation_attendee",
    displayName: "Meeting Confirmation (Attendee)",
    category: "System",
    subjectTemplate: "Your meeting is confirmed: {{sponsor_name}} at {{event_name}}",
    description: "Sent to the attendee when a meeting is confirmed. Includes calendar links and ICS attachment.",
    variables: COMMON_MEETING_VARS,
  },
  {
    templateKey: "meeting_notification_sponsor",
    displayName: "Meeting Notification (Sponsor)",
    category: "System",
    subjectTemplate: "New meeting scheduled: {{attendee_full_name}} at {{event_name}}",
    description: "Sent to the sponsor contact when a new meeting is booked.",
    variables: COMMON_MEETING_VARS,
  },
  {
    templateKey: "info_request_notification_sponsor",
    displayName: "Info Request Notification (Sponsor)",
    category: "System",
    subjectTemplate: "New information request from {{attendee_full_name}}",
    description: "Sent to the sponsor when an attendee submits an information request.",
    variables: [
      "attendee_first_name",
      "attendee_full_name",
      "sponsor_name",
      "event_name",
      "event_code",
      "status",
      "sponsor_dashboard_url",
    ],
  },
  {
    templateKey: "info_request_confirmation_attendee",
    displayName: "Info Request Confirmation (Attendee)",
    category: "System",
    subjectTemplate: "Your information request has been sent to {{sponsor_name}}",
    description: "Sent to the attendee confirming their information request was received. Includes a link to view the event schedule.",
    variables: [
      "attendee_first_name",
      "sponsor_name",
      "event_name",
      "event_code",
      "event_schedule_url",
    ],
  },
  {
    templateKey: "sponsor_magic_login",
    displayName: "Sponsor Dashboard Welcome",
    category: "Operational",
    subjectTemplate: "Welcome to the {{event_name}} Sponsor Dashboard",
    description: "Welcome email sent to sponsors when their dashboard access link is created. Guides them through the short setup process.",
    variables: [
      "sponsor_user_name",
      "sponsor_name",
      "event_name",
      "magic_link_url",
    ],
  },
  {
    templateKey: "password_reset",
    displayName: "Password Reset",
    category: "System",
    subjectTemplate: "Reset your Concierge password",
    description: "Sent when an admin requests a password reset. Contains a one-time reset link valid for 15 minutes.",
    variables: [
      "user_name",
      "reset_url",
    ],
  },
  {
    templateKey: "test_email",
    displayName: "Test Email",
    category: "System",
    subjectTemplate: "Test email from Converge Concierge",
    description: "Test email template used by admin to verify email delivery is working.",
    variables: [
      "recipient_email",
      "app_name",
    ],
  },
  {
    templateKey: "meeting_reminder_24",
    displayName: "Meeting Reminder — 24 Hours",
    category: "Operational",
    subjectTemplate: "Reminder: Your meeting tomorrow with {{sponsor_name}}",
    description: "Sent to attendees and sponsors 24 hours before a scheduled meeting.",
    variables: [
      "recipient_first_name",
      "sponsor_name",
      "event_name",
      "meeting_date",
      "meeting_time",
      "meeting_location",
      "meeting_type",
    ],
  },
  {
    templateKey: "scheduling_invitation",
    displayName: "Scheduling Invitation",
    category: "Operational",
    subjectTemplate: "You're invited to schedule meetings at {{event_name}}",
    description: "Sent to attendees inviting them to schedule meetings with sponsors at the event. Contains a direct link to the event scheduling page.",
    variables: [
      "attendee_first_name",
      "attendee_full_name",
      "event_name",
      "event_code",
      "scheduling_url",
    ],
  },
  {
    templateKey: "meeting_reminder_2",
    displayName: "Meeting Reminder — 2 Hours",
    category: "Operational",
    subjectTemplate: "Reminder: Your meeting in 2 hours with {{sponsor_name}}",
    description: "Sent to attendees and sponsors 2 hours before a scheduled meeting.",
    variables: [
      "recipient_first_name",
      "sponsor_name",
      "event_name",
      "meeting_date",
      "meeting_time",
      "meeting_location",
      "meeting_type",
    ],
  },
];

export async function seedEmailTemplates(storage: IStorage): Promise<void> {
  try {
    for (const t of TEMPLATES) {
      await storage.upsertEmailTemplate({
        templateKey: t.templateKey,
        displayName: t.displayName,
        subjectTemplate: t.subjectTemplate,
        htmlTemplate: "",
        description: t.description,
        variables: t.variables,
        isActive: true,
      });
    }
    const { db } = await import("./db");
    const { emailTemplates } = await import("@shared/schema");
    const { eq } = await import("drizzle-orm");
    for (const t of TEMPLATES) {
      await db.update(emailTemplates)
        .set({ category: t.category })
        .where(eq(emailTemplates.templateKey, t.templateKey));
    }
    console.log(`[EMAIL TEMPLATES] Seeded ${TEMPLATES.length} templates with categories`);
  } catch (err) {
    console.error("[EMAIL TEMPLATES] Seeding failed:", err);
  }
}
