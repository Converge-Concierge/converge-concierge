// services/emailTemplates.js

export function fmtDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr + (dateStr.includes("T") ? "" : "T00:00:00"));
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function fmt12(timeStr) {
  if (!timeStr) return "";
  const [h, m] = timeStr.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 || 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function fmtEventDateRange(startDate, endDate) {
  if (!startDate) return "";
  const s = new Date(startDate);
  const e = new Date(endDate || startDate);
  const opts = { month: "long", day: "numeric" };
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) {
    if (s.getDate() === e.getDate()) {
      return s.toLocaleDateString("en-US", { ...opts, year: "numeric" });
    }
    return `${s.toLocaleDateString("en-US", opts)}–${e.getDate()}, ${s.getFullYear()}`;
  }
  return `${s.toLocaleDateString("en-US", { ...opts, year: "numeric" })} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

const BASE_URL = process.env.REPLIT_DEV_DOMAIN
  ? `https://${process.env.REPLIT_DEV_DOMAIN}`
  : "https://concierge.convergeevents.com";

function header() {
  return `
    <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px 40px 24px; border-bottom: 4px solid #14b8a6;">
      <div style="font-size: 11px; font-weight: 700; letter-spacing: 2px; color: #94a3b8; text-transform: uppercase; margin-bottom: 6px;">Converge Events</div>
      <div style="font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">Converge Concierge</div>
    </div>`;
}

function footer() {
  return `
    <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 40px; text-align: center;">
      <p style="color: #94a3b8; font-size: 12px; margin: 0;">Sent by Converge Concierge for Converge Events</p>
      <p style="color: #cbd5e1; font-size: 11px; margin: 4px 0 0;">noreply@concierge.convergeevents.com</p>
    </div>`;
}

function wrap(bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}</style>
</head>
<body>
  <div style="max-width:600px;margin:32px auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
    ${header()}
    <div style="padding:32px 40px;">
      ${bodyHtml}
    </div>
    ${footer()}
  </div>
</body>
</html>`;
}

function pill(label, color = "#e2e8f0", textColor = "#475569") {
  return `<span style="display:inline-block;background:${color};color:${textColor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:99px;letter-spacing:0.5px;">${label}</span>`;
}

function detailRow(label, value) {
  if (!value) return "";
  return `
    <tr>
      <td style="padding:8px 16px 8px 0;color:#64748b;font-size:13px;font-weight:600;white-space:nowrap;vertical-align:top;">${label}</td>
      <td style="padding:8px 0;color:#0f172a;font-size:13px;vertical-align:top;">${value}</td>
    </tr>`;
}

function ctaButton(label, url) {
  return `
    <div style="text-align:center;margin:28px 0 4px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#ffffff;font-size:14px;font-weight:700;padding:14px 32px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">${label}</a>
    </div>`;
}

function calendarLinks({ google, outlook } = {}) {
  if (!google && !outlook) return "";
  return `
    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 14px;">📅 Add to Calendar</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap;">
        ${google ? `<a href="${google}" target="_blank" style="display:inline-block;background:#ffffff;border:1px solid #d1fae5;color:#065f46;font-size:13px;font-weight:600;padding:9px 18px;border-radius:7px;text-decoration:none;">Google Calendar</a>` : ""}
        ${outlook ? `<a href="${outlook}" target="_blank" style="display:inline-block;background:#ffffff;border:1px solid #dbeafe;color:#1e40af;font-size:13px;font-weight:600;padding:9px 18px;border-radius:7px;text-decoration:none;">Outlook Calendar</a>` : ""}
        <span style="display:inline-block;color:#94a3b8;font-size:12px;padding:9px 0;line-height:1.4;">ICS file attached — open to add to any calendar app.</span>
      </div>
    </div>`;
}

export function meetingConfirmationForAttendee({ attendeeFirstName, sponsorName, eventName, date, time, location, meetingType, eventSlug, calendarLinks: links }) {
  const isOnline = meetingType === "online_request";
  const typeLabel = isOnline ? "Online Meeting Request" : "Onsite Meeting";
  const locationLabel = isOnline ? (location || "Online — details to follow") : location;

  return wrap(`
    <p style="color:#14b8a6;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Meeting Confirmed</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">Hi ${attendeeFirstName || "there"},</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">Your meeting with <strong>${sponsorName}</strong> at <strong>${eventName}</strong> has been confirmed. Here are your details:</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow("Sponsor", sponsorName)}
        ${detailRow("Event", eventName)}
        ${detailRow("Date", fmtDate(date))}
        ${detailRow("Time", fmt12(time))}
        ${detailRow(isOnline ? "Platform" : "Location", locationLabel)}
        ${detailRow("Type", pill(typeLabel, isOnline ? "#ede9fe" : "#e0f2fe", isOnline ? "#6d28d9" : "#0369a1"))}
      </table>
    </div>

    ${calendarLinks(links)}

    ${eventSlug ? ctaButton("View Event Schedule", `${BASE_URL}/event/${eventSlug}`) : ""}

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">If you have any questions, please contact the event team directly.</p>
  `);
}

export function meetingNotificationForSponsor({ sponsorName, attendeeName, attendeeCompany, attendeeTitle, attendeeEmail, date, time, meetingType, location, eventName, sponsorToken, calendarLinks: links }) {
  const isOnline = meetingType === "online_request";
  const typeLabel = isOnline ? "Online Meeting Request" : "Onsite Meeting";
  const locationLabel = isOnline ? (location || "Online — details to follow") : location;

  return wrap(`
    <p style="color:#14b8a6;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">New Meeting Scheduled</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">New meeting with ${attendeeName}</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">A new meeting has been scheduled with an attendee at <strong>${eventName}</strong> for <strong>${sponsorName}</strong>.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px;">Meeting Details</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow("Date", fmtDate(date))}
        ${detailRow("Time", fmt12(time))}
        ${detailRow(isOnline ? "Platform" : "Location", locationLabel)}
        ${detailRow("Type", pill(typeLabel, isOnline ? "#ede9fe" : "#e0f2fe", isOnline ? "#6d28d9" : "#0369a1"))}
      </table>
    </div>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px;">Attendee Information</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow("Name", attendeeName)}
        ${detailRow("Company", attendeeCompany)}
        ${detailRow("Title", attendeeTitle)}
        ${detailRow("Email", attendeeEmail)}
      </table>
    </div>

    ${calendarLinks(links)}

    ${sponsorToken ? ctaButton("Open Sponsor Dashboard", `${BASE_URL}/sponsor-dashboard?token=${sponsorToken}`) : ""}
  `);
}

export function infoRequestNotificationForSponsor({ sponsorName, attendeeFirstName, attendeeLastName, attendeeEmail, attendeeCompany, attendeeTitle, message, eventName, sponsorToken }) {
  const attendeeName = `${attendeeFirstName} ${attendeeLastName}`.trim();

  return wrap(`
    <p style="color:#14b8a6;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">New Information Request</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">Request from ${attendeeName}</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">An attendee at <strong>${eventName}</strong> has requested more information from <strong>${sponsorName}</strong>.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 12px;">Attendee Information</p>
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow("Name", attendeeName)}
        ${detailRow("Company", attendeeCompany)}
        ${detailRow("Title", attendeeTitle)}
        ${detailRow("Email", attendeeEmail)}
      </table>
    </div>

    ${message ? `
    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <p style="color:#64748b;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px;">Their Message</p>
      <p style="color:#0f172a;font-size:14px;line-height:1.6;margin:0;">${message}</p>
    </div>` : ""}

    ${sponsorToken ? ctaButton("View Information Requests", `${BASE_URL}/sponsor-dashboard?token=${sponsorToken}`) : ""}

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">Please follow up with this attendee directly at <a href="mailto:${attendeeEmail}" style="color:#14b8a6;">${attendeeEmail}</a>.</p>
  `);
}

export function infoRequestConfirmationForAttendee({ attendeeFirstName, sponsorName, eventName, eventSlug }) {
  return wrap(`
    <p style="color:#14b8a6;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Request Sent</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">Hi ${attendeeFirstName || "there"},</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">Your information request has been sent to <strong>${sponsorName}</strong> at <strong>${eventName}</strong>. A representative will be in touch with you soon.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;">
        ${detailRow("Sponsor", sponsorName)}
        ${detailRow("Event", eventName)}
        ${detailRow("Status", pill("Request Submitted", "#dcfce7", "#166534"))}
      </table>
    </div>

    ${eventSlug ? ctaButton("View Event Schedule", `${BASE_URL}/event/${eventSlug}`) : ""}

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">If you have questions, please contact the event team directly.</p>
  `);
}

export function passwordResetEmail({ userName, resetUrl }) {
  return wrap(`
    <p style="color:#ef4444;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Password Reset</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">Hi ${userName || "there"},</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">We received a request to reset your Converge Concierge admin password. Click the button below to create a new password.</p>

    <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:16px 24px;margin-bottom:28px;">
      <p style="color:#991b1b;font-size:13px;margin:0;">⏱ This link expires in <strong>1 hour</strong>. If you did not request a password reset, you can safely ignore this email — your password will not change.</p>
    </div>

    ${ctaButton("Reset My Password", resetUrl)}

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
    <p style="font-size:12px;margin:0;word-break:break-all;"><a href="${resetUrl}" style="color:#14b8a6;">${resetUrl}</a></p>

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">This is an automated message from Converge Concierge. Please do not reply to this email.</p>
  `);
}

export function sponsorMagicLoginEmail({ sponsorName, contactName, eventName, loginUrl }) {
  return wrap(`
    <p style="color:#14b8a6;font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;margin:0 0 8px;">Sponsor Dashboard Access</p>
    <h1 style="color:#0f172a;font-size:22px;font-weight:800;margin:0 0 6px;">Hello${contactName ? ` ${contactName}` : ""},</h1>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">Your Converge Concierge sponsor dashboard${eventName ? ` for <strong>${eventName}</strong>` : ""} is ready. Click the secure button below to access your dashboard.</p>

    <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:20px 24px;margin-bottom:28px;">
      <p style="color:#064e3b;font-size:13px;font-weight:600;margin:0 0 10px;">From your dashboard you can:</p>
      <ul style="color:#065f46;font-size:13px;margin:0;padding-left:20px;line-height:1.8;">
        <li>View all scheduled meetings</li>
        <li>Review information requests from attendees</li>
        <li>Track leads and sponsor engagement</li>
        <li>Access reporting and analytics</li>
      </ul>
    </div>

    ${ctaButton("Open Sponsor Dashboard", loginUrl)}

    <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px 20px;margin-top:24px;">
      <p style="color:#92400e;font-size:12px;margin:0;">⏱ This secure link expires in <strong>24 hours</strong>. If you need a new link, contact your event coordinator or request another via the sponsor login page.</p>
    </div>

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">This link is unique to your account — please do not share it. If you did not expect this email, you can safely ignore it.</p>
  `);
}

export function meetingReminderEmail({ recipientFirstName, sponsorName, eventName, meetingDate, meetingTime, meetingLocation, meetingType, windowLabel }) {
  const isVirtual = meetingType === "online_request";
  const timeUntil = windowLabel === "24h" ? "tomorrow" : "in about 2 hours";
  const urgency = windowLabel === "2h" ? "⏰ " : "📅 ";
  return wrap(`
    <p style="color:#475569;font-size:16px;font-weight:600;margin:0 0 6px;">${urgency}Meeting Reminder</p>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">Hi ${recipientFirstName || "there"}, this is a reminder that your meeting${sponsorName ? ` with <strong>${sponsorName}</strong>` : ""} is ${timeUntil}.</p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:20px 24px;margin-bottom:24px;">
      <table style="width:100%;border-collapse:collapse;">
        ${eventName ? `<tr><td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;width:100px;">Event</td><td style="color:#0f172a;font-size:14px;font-weight:500;padding:4px 0;">${eventName}</td></tr>` : ""}
        ${meetingDate ? `<tr><td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">Date</td><td style="color:#0f172a;font-size:14px;font-weight:500;padding:4px 0;">${fmtDate(meetingDate)}</td></tr>` : ""}
        ${meetingTime ? `<tr><td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">Time</td><td style="color:#0f172a;font-size:14px;font-weight:500;padding:4px 0;">${fmt12(meetingTime)}</td></tr>` : ""}
        ${!isVirtual && meetingLocation ? `<tr><td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">Location</td><td style="color:#0f172a;font-size:14px;font-weight:500;padding:4px 0;">${meetingLocation}</td></tr>` : ""}
        <tr><td style="color:#94a3b8;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;padding:4px 0;">Format</td><td style="color:#0f172a;font-size:14px;font-weight:500;padding:4px 0;">${isVirtual ? "Virtual / Online" : "In-Person"}</td></tr>
      </table>
    </div>

    <p style="color:#94a3b8;font-size:12px;margin:0;">If you have questions, please contact your event coordinator.</p>
  `);
}

// ── Deliverable Reminder Email ─────────────────────────────────────────────

export function deliverableReminderEmail({ recipientName, sponsorName, eventName, deliverables, dashboardUrl }) {
  const itemRows = deliverables.map(d => `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e2e8f0;">
        <div style="font-size:14px;font-weight:600;color:#0f172a;">${d.deliverableName}</div>
        ${d.sponsorFacingNote ? `<div style="font-size:12px;color:#64748b;margin-top:2px;">${d.sponsorFacingNote}</div>` : ""}
      </td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;white-space:nowrap;vertical-align:top;">
        <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;background:#fef3c7;color:#92400e;">${d.status}</span>
      </td>
      ${d.dueLabel ? `<td style="padding:10px 0;border-bottom:1px solid #e2e8f0;font-size:12px;color:#64748b;white-space:nowrap;vertical-align:top;">${d.dueLabel}</td>` : `<td style="padding:10px 0;border-bottom:1px solid #e2e8f0;"></td>`}
    </tr>
  `).join("");

  return wrap(`
    <h2 style="font-size:22px;font-weight:800;color:#0f172a;margin:0 0 6px;">Action Needed: Outstanding Sponsorship Items</h2>
    <p style="color:#475569;font-size:15px;margin:0 0 24px;">Hello ${recipientName || "there"},</p>

    <p style="color:#475569;font-size:15px;margin:0 0 16px;">
      To help finalize your sponsorship setup for <strong>${eventName}</strong>, the following items still need your attention:
    </p>

    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;padding:16px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:10px 16px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Deliverable</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Status</th>
            <th style="padding:10px 12px;text-align:left;font-size:11px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:0.05em;">Due</th>
          </tr>
        </thead>
        <tbody style="padding:0 16px;">
          ${itemRows}
        </tbody>
      </table>
    </div>

    <p style="color:#475569;font-size:14px;margin:0 0 24px;">
      You can complete these items directly in your Sponsor Dashboard:
    </p>

    <div style="text-align:center;margin-bottom:24px;">
      <a href="${dashboardUrl}" style="display:inline-block;padding:14px 32px;background:linear-gradient(135deg,#0f172a,#1e3a5f);color:#ffffff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;letter-spacing:-0.3px;">
        Open Sponsor Dashboard →
      </a>
    </div>

    <p style="color:#94a3b8;font-size:12px;margin:0;">
      Thank you for your partnership.<br/>
      The Converge Events Team
    </p>
  `);
}
