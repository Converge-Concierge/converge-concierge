import { storage } from "./storage";
import { sendMeetingReminderEmail, sendDeliverableReminderEmail, isAutomationEnabled } from "../services/emailService.js";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const WEEKLY_INTERVAL_MS = 60 * 60 * 1000; // 1 hour check for weekly job

export function startReminderJob(): void {
  console.log("[REMINDERS] Starting meeting reminder job (every 10 min)");
  setInterval(runReminderCheck, INTERVAL_MS);
  console.log("[REMINDERS] Starting weekly deliverable reminder job (hourly check, fires Tue 8-10am UTC)");
  setInterval(runWeeklyDeliverableReminders, WEEKLY_INTERVAL_MS);
}

async function runReminderCheck(): Promise<void> {
  try {
    const dueMeetings = await storage.getMeetingsDueForReminders();
    if (dueMeetings.length === 0) return;

    console.log(`[REMINDERS] Processing ${dueMeetings.length} meeting(s) due for reminders`);

    const is24hEnabled = await isAutomationEnabled(storage, "meeting_reminder_24h");
    const is2hEnabled = await isAutomationEnabled(storage, "meeting_reminder_2h");

    if (!is24hEnabled && !is2hEnabled) {
      console.log("[REMINDERS] All meeting reminder automations disabled — skipping");
      return;
    }

    const now = new Date();
    const plus23_5h = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const plus24_5h = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    const plus1_5h = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const plus2_5h = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    let sent24 = 0, sent2 = 0, failures24 = 0, failures2 = 0;

    for (const meeting of dueMeetings) {
      try {
        const meetingDt = new Date(`${meeting.date}T${meeting.time}`);
        const needs24 = is24hEnabled && !meeting.reminder24SentAt && meetingDt >= plus23_5h && meetingDt <= plus24_5h;
        const needs2 = is2hEnabled && !meeting.reminder2SentAt && meetingDt >= plus1_5h && meetingDt <= plus2_5h;

        const [attendee, sponsor, event] = await Promise.all([
          storage.getAttendee(meeting.attendeeId),
          storage.getSponsor(meeting.sponsorId),
          storage.getEvent(meeting.eventId),
        ]);

        if (needs24) {
          try {
            await sendMeetingReminderEmail(storage, attendee, sponsor, meeting, event, "24h");
            await storage.updateMeetingReminderFlags(meeting.id, { reminder24SentAt: new Date() });
            console.log(`[REMINDERS] Sent 24h reminder for meeting ${meeting.id}`);
            sent24++;
          } catch (e: any) { failures24++; }
        }

        if (needs2) {
          try {
            await sendMeetingReminderEmail(storage, attendee, sponsor, meeting, event, "2h");
            await storage.updateMeetingReminderFlags(meeting.id, { reminder2SentAt: new Date() });
            console.log(`[REMINDERS] Sent 2h reminder for meeting ${meeting.id}`);
            sent2++;
          } catch (e: any) { failures2++; }
        }
      } catch (err: any) {
        console.error(`[REMINDERS] Error processing meeting ${meeting.id}:`, err?.message ?? err);
      }
    }

    if (sent24 > 0 || failures24 > 0) {
      await storage.recordAutomationExecution("meeting_reminder_24h", sent24, failures24);
    }
    if (sent2 > 0 || failures2 > 0) {
      await storage.recordAutomationExecution("meeting_reminder_2h", sent2, failures2);
    }
  } catch (err: any) {
    console.error("[REMINDERS] Reminder check failed:", err?.message ?? err);
  }
}

// ── Weekly Deliverable Reminders ────────────────────────────────────────────
// Fires on Tuesday 8–10am UTC; sends one grouped email per sponsor per event
// for all reminder-eligible outstanding items. Skips if reminder already sent
// in the past 6 days for that sponsor+event.

async function runWeeklyDeliverableReminders(): Promise<void> {
  try {
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 2 = Tuesday
    const hour = now.getUTCHours();
    if (dayOfWeek !== 2 || hour < 8 || hour >= 10) return;

    if (!await isAutomationEnabled(storage, "deliverable_reminder")) {
      console.log("[WEEKLY-REMINDERS] Deliverable reminder automation disabled — skipping");
      return;
    }

    console.log("[WEEKLY-REMINDERS] Tuesday 8-10am UTC window — running deliverable reminders");

    const OUTSTANDING_STATUSES = ["Awaiting Sponsor Input", "Not Started", "Needed", "Issue Identified", "Blocked"];
    const deliverables = await storage.listAgreementDeliverables({});
    const outstanding = deliverables.filter(d =>
      ["Sponsor", "Shared"].includes(d.ownerType) &&
      OUTSTANDING_STATUSES.includes(d.status) &&
      d.sponsorVisible !== false &&
      d.reminderEligible
    );

    if (outstanding.length === 0) {
      console.log("[WEEKLY-REMINDERS] No outstanding reminder-eligible items");
      return;
    }

    // Group by sponsorId+eventId
    const groups = new Map<string, typeof outstanding>();
    for (const d of outstanding) {
      const key = `${d.sponsorId}|${d.eventId}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(d);
    }

    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
    let sent = 0;
    let skipped = 0;

    for (const [key, items] of groups) {
      const [sponsorId, eventId] = key.split("|");
      try {
        // Check if reminder already sent this week
        const lastReminder = await storage.getLastDeliverableReminder(sponsorId, eventId);
        if (lastReminder && (now.getTime() - lastReminder.sentAt.getTime()) < SIX_DAYS_MS) {
          skipped++;
          continue;
        }

        const [sponsor, event] = await Promise.all([
          storage.getSponsor(sponsorId),
          storage.getEvent(eventId),
        ]);
        if (!sponsor || !event) continue;

        const sponsorUsers = await storage.getSponsorUsersBySponsor(sponsorId);
        const primaryUser = sponsorUsers.find(u => u.isPrimary) ?? sponsorUsers.find(u => u.accessLevel === "owner") ?? sponsorUsers[0];
        const recipientEmail = primaryUser?.email ?? (sponsor as any).contactEmail ?? null;
        if (!recipientEmail) { skipped++; continue; }

        const recipientName = primaryUser?.name ?? null;
        const tokens = await storage.getSponsorTokensBySponsor(sponsorId);
        const activeToken = tokens.find(t => !t.revokedAt) ?? tokens[0];
        const sponsorToken = activeToken?.token ?? "";

        await sendDeliverableReminderEmail(storage, {
          sponsor,
          event,
          deliverables: items,
          recipientName,
          recipientEmail,
          sponsorToken,
        });

        await storage.createDeliverableReminder({
          sponsorId,
          eventId,
          recipientEmail,
          reminderType: "weekly_automatic",
          sentByRole: "system",
          sentByUserId: null,
          sentAt: new Date(),
          status: "sent",
          errorMessage: null,
          deliverableCount: items.length,
        });

        console.log(`[WEEKLY-REMINDERS] Sent reminder to ${recipientEmail} for sponsor ${sponsor.name} (${items.length} items)`);
        sent++;
      } catch (err: any) {
        console.error(`[WEEKLY-REMINDERS] Error for ${key}:`, err?.message ?? err);
        try {
          await storage.createDeliverableReminder({
            sponsorId,
            eventId,
            recipientEmail: "",
            reminderType: "weekly_automatic",
            sentByRole: "system",
            sentByUserId: null,
            sentAt: new Date(),
            status: "error",
            errorMessage: err?.message ?? String(err),
            deliverableCount: items.length,
          });
        } catch (_) {}
      }
    }

    console.log(`[WEEKLY-REMINDERS] Done — sent: ${sent}, skipped: ${skipped}`);
    if (sent > 0 || skipped > 0) {
      await storage.recordAutomationExecution("deliverable_reminder", sent, 0);
    }
  } catch (err: any) {
    console.error("[WEEKLY-REMINDERS] Job failed:", err?.message ?? err);
  }
}
