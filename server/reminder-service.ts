import { storage } from "./storage";
import { sendMeetingReminderEmail } from "../services/emailService.js";

const INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

export function startReminderJob(): void {
  console.log("[REMINDERS] Starting meeting reminder job (every 10 min)");
  setInterval(runReminderCheck, INTERVAL_MS);
}

async function runReminderCheck(): Promise<void> {
  try {
    const dueMeetings = await storage.getMeetingsDueForReminders();
    if (dueMeetings.length === 0) return;

    console.log(`[REMINDERS] Processing ${dueMeetings.length} meeting(s) due for reminders`);

    const now = new Date();
    const plus23_5h = new Date(now.getTime() + 23.5 * 60 * 60 * 1000);
    const plus24_5h = new Date(now.getTime() + 24.5 * 60 * 60 * 1000);
    const plus1_5h = new Date(now.getTime() + 1.5 * 60 * 60 * 1000);
    const plus2_5h = new Date(now.getTime() + 2.5 * 60 * 60 * 1000);

    for (const meeting of dueMeetings) {
      try {
        const meetingDt = new Date(`${meeting.date}T${meeting.time}`);
        const needs24 = !meeting.reminder24SentAt && meetingDt >= plus23_5h && meetingDt <= plus24_5h;
        const needs2 = !meeting.reminder2SentAt && meetingDt >= plus1_5h && meetingDt <= plus2_5h;

        const [attendee, sponsor, event] = await Promise.all([
          storage.getAttendee(meeting.attendeeId),
          storage.getSponsor(meeting.sponsorId),
          storage.getEvent(meeting.eventId),
        ]);

        if (needs24) {
          await sendMeetingReminderEmail(storage, attendee, sponsor, meeting, event, "24h");
          await storage.updateMeetingReminderFlags(meeting.id, { reminder24SentAt: new Date() });
          console.log(`[REMINDERS] Sent 24h reminder for meeting ${meeting.id}`);
        }

        if (needs2) {
          await sendMeetingReminderEmail(storage, attendee, sponsor, meeting, event, "2h");
          await storage.updateMeetingReminderFlags(meeting.id, { reminder2SentAt: new Date() });
          console.log(`[REMINDERS] Sent 2h reminder for meeting ${meeting.id}`);
        }
      } catch (err: any) {
        console.error(`[REMINDERS] Error processing meeting ${meeting.id}:`, err?.message ?? err);
      }
    }
  } catch (err: any) {
    console.error("[REMINDERS] Reminder check failed:", err?.message ?? err);
  }
}
