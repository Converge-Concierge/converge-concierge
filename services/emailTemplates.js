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

export function meetingConfirmationForAttendee({ attendeeFirstName, sponsorName, eventName, date, time, location, meetingType, eventSlug }) {
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

    ${eventSlug ? ctaButton("View Event Schedule", `${BASE_URL}/event/${eventSlug}`) : ""}

    <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">If you have any questions, please contact the event team directly.</p>
  `);
}

export function meetingNotificationForSponsor({ sponsorName, attendeeName, attendeeCompany, attendeeTitle, attendeeEmail, date, time, meetingType, location, eventName, sponsorToken }) {
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
