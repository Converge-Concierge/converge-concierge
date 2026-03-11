// services/emailService.js

import SibApiV3Sdk from "sib-api-v3-sdk";
import {
  meetingConfirmationForAttendee,
  meetingNotificationForSponsor,
  infoRequestNotificationForSponsor,
  infoRequestConfirmationForAttendee,
} from "./emailTemplates.js";

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY?.trim();

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// ── Core send function ────────────────────────────────────────────────────────

export async function sendEmail(to, subject, htmlContent) {
  const email = {
    sender: {
      name: "Converge Concierge",
      email: "noreply@concierge.convergeevents.com",
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
  };
  return apiInstance.sendTransacEmail(email);
}

// ── Internal: send + log ──────────────────────────────────────────────────────

async function sendAndLog(storage, { emailType, to, subject, html, eventId, sponsorId, attendeeId }) {
  let status = "sent";
  let errorMessage = null;
  try {
    await sendEmail(to, subject, html);
    console.log(`[EMAIL] Sent "${emailType}" to ${to} — Subject: ${subject}`);
  } catch (err) {
    status = "failed";
    errorMessage = err?.message || String(err);
    console.error(`[EMAIL] Failed to send "${emailType}" to ${to}: ${errorMessage}`);
  }
  try {
    await storage.createEmailLog({ emailType, recipientEmail: to, subject, eventId, sponsorId, attendeeId, status, errorMessage });
  } catch (logErr) {
    console.error(`[EMAIL LOG] Failed to write email log: ${logErr?.message || logErr}`);
  }
}

// ── Workflow helpers ──────────────────────────────────────────────────────────

export async function sendMeetingConfirmationToAttendee(storage, attendee, sponsor, meeting, event) {
  if (!attendee?.email) {
    console.warn(`[EMAIL] No attendee email — skipping meeting confirmation for meeting ${meeting?.id}`);
    return;
  }
  const subject = `Your meeting with ${sponsor?.name ?? "the sponsor"} is confirmed`;
  const html = meetingConfirmationForAttendee({
    attendeeFirstName: attendee.firstName || attendee.name?.split(" ")[0] || attendee.name,
    sponsorName: sponsor?.name ?? "",
    eventName: event?.name ?? "",
    date: meeting?.date,
    time: meeting?.time,
    location: meeting?.location,
    meetingType: meeting?.meetingType,
    eventSlug: event?.slug ?? null,
  });
  await sendAndLog(storage, {
    emailType: "meeting_confirmation_attendee",
    to: attendee.email,
    subject,
    html,
    eventId: meeting?.eventId,
    sponsorId: meeting?.sponsorId,
    attendeeId: attendee?.id,
  });
}

export async function sendMeetingNotificationToSponsor(storage, attendee, sponsor, meeting, event, sponsorToken) {
  const contactEmail = sponsor?.contactEmail;
  if (!contactEmail) {
    console.warn(`[EMAIL] Sponsor "${sponsor?.name}" has no contact email — skipping meeting notification for meeting ${meeting?.id}`);
    return;
  }
  const attendeeName = attendee?.name || `${attendee?.firstName ?? ""} ${attendee?.lastName ?? ""}`.trim() || "Attendee";
  const subject = `New meeting scheduled with ${attendeeName}`;
  const html = meetingNotificationForSponsor({
    sponsorName: sponsor?.name ?? "",
    attendeeName,
    attendeeCompany: attendee?.company ?? "",
    attendeeTitle: attendee?.title ?? "",
    attendeeEmail: attendee?.email ?? "",
    date: meeting?.date,
    time: meeting?.time,
    meetingType: meeting?.meetingType,
    location: meeting?.location,
    eventName: event?.name ?? "",
    sponsorToken: sponsorToken ?? null,
  });
  await sendAndLog(storage, {
    emailType: "meeting_notification_sponsor",
    to: contactEmail,
    subject,
    html,
    eventId: meeting?.eventId,
    sponsorId: sponsor?.id,
    attendeeId: attendee?.id,
  });
}

export async function sendInformationRequestNotificationToSponsor(storage, attendee, sponsor, infoRequest, event, sponsorToken) {
  const contactEmail = sponsor?.contactEmail;
  if (!contactEmail) {
    console.warn(`[EMAIL] Sponsor "${sponsor?.name}" has no contact email — skipping info request notification for request ${infoRequest?.id}`);
    return;
  }
  const firstName = infoRequest?.attendeeFirstName ?? attendee?.firstName ?? "";
  const lastName = infoRequest?.attendeeLastName ?? attendee?.lastName ?? "";
  const subject = `New information request from ${firstName} ${lastName}`.trim();
  const html = infoRequestNotificationForSponsor({
    sponsorName: sponsor?.name ?? "",
    attendeeFirstName: firstName,
    attendeeLastName: lastName,
    attendeeEmail: infoRequest?.attendeeEmail ?? attendee?.email ?? "",
    attendeeCompany: infoRequest?.attendeeCompany ?? attendee?.company ?? "",
    attendeeTitle: infoRequest?.attendeeTitle ?? attendee?.title ?? "",
    message: infoRequest?.message ?? null,
    eventName: event?.name ?? "",
    sponsorToken: sponsorToken ?? null,
  });
  await sendAndLog(storage, {
    emailType: "info_request_notification_sponsor",
    to: contactEmail,
    subject,
    html,
    eventId: infoRequest?.eventId,
    sponsorId: sponsor?.id,
    attendeeId: infoRequest?.attendeeId ?? null,
  });
}

export async function sendInformationRequestConfirmationToAttendee(storage, infoRequest, sponsor, event) {
  const toEmail = infoRequest?.attendeeEmail;
  if (!toEmail) {
    console.warn(`[EMAIL] No attendee email on info request ${infoRequest?.id} — skipping confirmation`);
    return;
  }
  const subject = `Your information request has been sent`;
  const html = infoRequestConfirmationForAttendee({
    attendeeFirstName: infoRequest?.attendeeFirstName ?? "",
    sponsorName: sponsor?.name ?? "",
    eventName: event?.name ?? "",
    eventSlug: event?.slug ?? null,
  });
  await sendAndLog(storage, {
    emailType: "info_request_confirmation_attendee",
    to: toEmail,
    subject,
    html,
    eventId: infoRequest?.eventId,
    sponsorId: sponsor?.id,
    attendeeId: infoRequest?.attendeeId ?? null,
  });
}
