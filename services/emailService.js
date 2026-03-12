// services/emailService.js

import SibApiV3Sdk from "sib-api-v3-sdk";
import {
  meetingConfirmationForAttendee,
  meetingNotificationForSponsor,
  infoRequestNotificationForSponsor,
  infoRequestConfirmationForAttendee,
  passwordResetEmail,
  sponsorMagicLoginEmail,
  meetingReminderEmail,
  deliverableReminderEmail,
} from "./emailTemplates.js";
import {
  buildMeetingIcs,
  buildCalendarLinks,
} from "./calendarService.js";

const client = SibApiV3Sdk.ApiClient.instance;
client.authentications["api-key"].apiKey = process.env.BREVO_API_KEY?.trim();

const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();

// ── Core send function ────────────────────────────────────────────────────────

export async function sendEmail(to, subject, htmlContent, attachments) {
  const isDemo = (process.env.APP_ENV || "").toLowerCase() === "demo";
  if (isDemo) {
    const domain = (to.split("@")[1] || "").toLowerCase();
    const allowedDomains = ["convergeevents.com", "converge.com"];
    if (!allowedDomains.some((d) => domain === d)) {
      console.log(`[DEMO] Email suppressed — to: ${to}, subject: "${subject}" (external recipient blocked in demo mode)`);
      return { messageId: `demo-suppressed-${Date.now()}` };
    }
    console.log(`[DEMO] Email allowed to internal domain — to: ${to}`);
  }

  const email = {
    sender: {
      name: "Converge Concierge",
      email: "noreply@concierge.convergeevents.com",
    },
    to: [{ email: to }],
    subject: subject,
    htmlContent: htmlContent,
  };
  if (attachments && attachments.length > 0) {
    email.attachment = attachments.map(({ name, content }) => ({
      name,
      content,
    }));
  }
  return apiInstance.sendTransacEmail(email);
}

// ── Internal: send + log ──────────────────────────────────────────────────────

async function sendAndLog(storage, { emailType, to, subject, html, eventId, sponsorId, attendeeId, resendOfId, attachments }) {
  let status = "sent";
  let errorMessage = null;
  let providerMessageId = null;
  try {
    const response = await sendEmail(to, subject, html, attachments);
    providerMessageId = response?.messageId ?? null;
    console.log(`[EMAIL] Sent "${emailType}" to ${to} — Subject: ${subject}${providerMessageId ? ` — messageId: ${providerMessageId}` : ""}`);
  } catch (err) {
    status = "failed";
    errorMessage = err?.message || String(err);
    console.error(`[EMAIL] Failed to send "${emailType}" to ${to}: ${errorMessage}`);
  }
  try {
    const id = await storage.createEmailLog({ emailType, recipientEmail: to, subject, htmlContent: html, eventId, sponsorId, attendeeId, status, errorMessage, resendOfId: resendOfId ?? null, providerMessageId });
    return id;
  } catch (logErr) {
    console.error(`[EMAIL LOG] Failed to write email log: ${logErr?.message || logErr}`);
    return null;
  }
}

// ── Workflow helpers ──────────────────────────────────────────────────────────

export async function sendMeetingConfirmationToAttendee(storage, attendee, sponsor, meeting, event) {
  if (!attendee?.email) {
    console.warn(`[EMAIL] No attendee email — skipping meeting confirmation for meeting ${meeting?.id}`);
    return;
  }

  // Build calendar support (non-blocking)
  let calLinks = null;
  let icsAttachment = null;
  try {
    calLinks = buildCalendarLinks(meeting, sponsor, attendee, event);
    const icsContent = buildMeetingIcs(meeting, sponsor, attendee, event);
    if (icsContent) {
      const encoded = Buffer.from(icsContent, "utf-8").toString("base64");
      const sponsorSlug = (sponsor?.name ?? "meeting").toLowerCase().replace(/[^a-z0-9]/g, "-");
      const eventSlug = (event?.slug ?? event?.name ?? "event").toLowerCase().replace(/[^a-z0-9]/g, "-");
      icsAttachment = { name: `${eventSlug}-${sponsorSlug}-meeting.ics`, content: encoded };
    }
  } catch (err) {
    console.warn(`[EMAIL] Calendar generation failed for meeting ${meeting?.id}: ${err?.message ?? err}`);
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
    calendarLinks: calLinks,
  });

  await sendAndLog(storage, {
    emailType: "meeting_confirmation_attendee",
    to: attendee.email,
    subject,
    html,
    eventId: meeting?.eventId,
    sponsorId: meeting?.sponsorId,
    attendeeId: attendee?.id,
    attachments: icsAttachment ? [icsAttachment] : [],
  });
}

export async function sendMeetingNotificationToSponsor(storage, attendee, sponsor, meeting, event, sponsorToken) {
  const contactEmail = sponsor?.contactEmail;
  if (!contactEmail) {
    console.warn(`[EMAIL] Sponsor "${sponsor?.name}" has no contact email — skipping meeting notification for meeting ${meeting?.id}`);
    return;
  }

  // Build calendar support (non-blocking)
  let calLinks = null;
  let icsAttachment = null;
  try {
    calLinks = buildCalendarLinks(meeting, sponsor, attendee, event);
    const icsContent = buildMeetingIcs(meeting, sponsor, attendee, event);
    if (icsContent) {
      const encoded = Buffer.from(icsContent, "utf-8").toString("base64");
      const sponsorSlug = (sponsor?.name ?? "meeting").toLowerCase().replace(/[^a-z0-9]/g, "-");
      const eventSlug = (event?.slug ?? event?.name ?? "event").toLowerCase().replace(/[^a-z0-9]/g, "-");
      icsAttachment = { name: `${eventSlug}-${sponsorSlug}-meeting.ics`, content: encoded };
    }
  } catch (err) {
    console.warn(`[EMAIL] Calendar generation failed (sponsor) for meeting ${meeting?.id}: ${err?.message ?? err}`);
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
    calendarLinks: calLinks,
  });

  await sendAndLog(storage, {
    emailType: "meeting_notification_sponsor",
    to: contactEmail,
    subject,
    html,
    eventId: meeting?.eventId,
    sponsorId: sponsor?.id,
    attendeeId: attendee?.id,
    attachments: icsAttachment ? [icsAttachment] : [],
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
  const sponsorDisplayName = sponsor?.name ? sponsor.name.trim() : "";
  const subject = sponsorDisplayName
    ? `Your information request has been sent to ${sponsorDisplayName}`
    : `Your information request has been sent`;
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

export async function sendPasswordResetEmail(storage, user, rawToken, baseUrl) {
  const toEmail = user?.email;
  if (!toEmail) return;
  const resetUrl = `${baseUrl}/admin/reset-password?token=${rawToken}`;
  const subject = "Reset your Concierge password";
  const html = passwordResetEmail({
    userName: user?.name ?? user?.email ?? "Admin",
    resetUrl,
  });
  await sendAndLog(storage, {
    emailType: "password_reset",
    to: toEmail,
    subject,
    html,
    eventId: null,
    sponsorId: null,
    attendeeId: null,
  });
}

export async function sendSponsorMagicLoginEmail(storage, sponsorUser, sponsor, rawToken, baseUrl, eventName) {
  const toEmail = sponsorUser?.email;
  if (!toEmail) return;
  const loginUrl = `${baseUrl}/sponsor/auth/magic?token=${rawToken}`;
  const subject = `Your Converge Concierge Sponsor Dashboard${eventName ? ` — ${eventName}` : ""}`;
  const html = sponsorMagicLoginEmail({
    sponsorName: sponsor?.name ?? "",
    contactName: sponsorUser?.name || sponsor?.contactName || null,
    eventName: eventName ?? null,
    loginUrl,
  });
  await sendAndLog(storage, {
    emailType: "sponsor_magic_login",
    to: toEmail,
    subject,
    html,
    sponsorId: sponsor?.id ?? null,
    eventId: null,
    attendeeId: null,
  });
}

// ── Deliverable Reminder Email ──────────────────────────────────────────────

export async function sendDeliverableReminderEmail(storage, { sponsor, event, deliverables, recipientName, recipientEmail, sponsorToken }) {
  let BASE_URL;
  try {
    const branding = await storage.getBranding();
    if (branding.appBaseUrl?.trim()) {
      BASE_URL = branding.appBaseUrl.trim().replace(/\/$/, "");
    }
  } catch (_) {}
  if (!BASE_URL) {
    if (process.env.REPLIT_DEPLOYMENT === "1" && process.env.REPLIT_DOMAINS) {
      BASE_URL = `https://${process.env.REPLIT_DOMAINS.split(",")[0]}`;
    } else if (process.env.REPLIT_DEV_DOMAIN) {
      BASE_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`;
    } else {
      BASE_URL = "https://concierge.convergeevents.com";
    }
  }

  const dashboardUrl = `${BASE_URL}/sponsor/dashboard?token=${sponsorToken}&tab=deliverables`;

  const dueMap = { before_event: "Due before event", during_event: "During event", after_event: "After event", not_applicable: "" };
  const emailDeliverables = deliverables.map(d => ({
    deliverableName: d.deliverableName,
    sponsorFacingNote: d.sponsorFacingNote ?? null,
    status: d.status,
    dueLabel: d.dueDate
      ? `Due ${new Date(d.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`
      : (dueMap[d.dueTiming] ?? ""),
  }));

  const subject = `Action Needed: Outstanding Sponsorship Items for ${event?.name ?? "your event"}`;
  const html = deliverableReminderEmail({
    recipientName: recipientName || "there",
    sponsorName: sponsor?.name ?? "",
    eventName: event?.name ?? "",
    deliverables: emailDeliverables,
    dashboardUrl,
  });

  return sendAndLog(storage, {
    emailType: "agreement_deliverables_reminder",
    to: recipientEmail,
    subject,
    html,
    eventId: event?.id ?? null,
    sponsorId: sponsor?.id ?? null,
    attendeeId: null,
  });
}

export async function sendMeetingReminderEmail(storage, attendee, sponsor, meeting, event, windowLabel) {
  const sponsorName = sponsor?.name ?? "";
  const eventName = event?.name ?? "";
  const windowText = windowLabel === "24h" ? "tomorrow" : "in 2 hours";
  const subject = `Reminder: Your meeting ${windowText} with ${sponsorName || "the sponsor"}`;
  const html = meetingReminderEmail({
    recipientFirstName: attendee?.firstName || attendee?.name?.split(" ")[0] || "there",
    sponsorName,
    eventName,
    meetingDate: meeting?.date,
    meetingTime: meeting?.time,
    meetingLocation: meeting?.location,
    meetingType: meeting?.meetingType,
    windowLabel,
  });
  if (attendee?.email) {
    await sendAndLog(storage, {
      emailType: windowLabel === "24h" ? "meeting_reminder_24" : "meeting_reminder_2",
      to: attendee.email,
      subject,
      html,
      eventId: meeting?.eventId ?? null,
      sponsorId: meeting?.sponsorId ?? null,
      attendeeId: attendee.id ?? null,
    });
  }

  const sponsorContactEmail = sponsor?.contactEmail;
  if (sponsorContactEmail) {
    const sponsorHtml = meetingReminderEmail({
      recipientFirstName: sponsor?.contactName ?? sponsor?.name ?? "there",
      sponsorName,
      eventName,
      meetingDate: meeting?.date,
      meetingTime: meeting?.time,
      meetingLocation: meeting?.location,
      meetingType: meeting?.meetingType,
      windowLabel,
    });
    await sendAndLog(storage, {
      emailType: windowLabel === "24h" ? "meeting_reminder_24" : "meeting_reminder_2",
      to: sponsorContactEmail,
      subject: `Reminder: Meeting ${windowText} — ${attendee?.firstName || attendee?.name || "Attendee"}`,
      html: sponsorHtml,
      eventId: meeting?.eventId ?? null,
      sponsorId: meeting?.sponsorId ?? null,
      attendeeId: attendee?.id ?? null,
    });
  }
}

export async function sendInternalDeliverableNotification(storage, { sponsorId, sponsorName, eventId, eventName, deliverableName, action }) {
  const branding = await storage.getBranding();
  const recipientEmail = branding.internalNotificationEmail;
  if (!recipientEmail) return;

  const timestamp = new Date().toISOString();
  const subject = `Sponsor Update: ${sponsorName} — ${deliverableName}`;
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #0D1E3A;">Sponsor Deliverable Update</h2>
      <p><strong>${sponsorName}</strong> has ${action} for <strong>${deliverableName}</strong>.</p>
      ${eventName ? `<p><strong>Event:</strong> ${eventName}</p>` : ""}
      <p><strong>Time:</strong> ${timestamp}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #666;">Please log in to the admin dashboard to review.</p>
    </div>
  `;

  await sendAndLog(storage, {
    emailType: "internal_deliverable_notification",
    to: recipientEmail,
    subject,
    html,
    eventId: eventId ?? null,
    sponsorId: sponsorId ?? null,
    attendeeId: null,
  });
}
