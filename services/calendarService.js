// services/calendarService.js
// Calendar utility: ICS generation, Google Calendar links, Outlook links

const MEETING_DURATION_MINUTES = 20;

function pad(n) {
  return String(n).padStart(2, "0");
}

function toIcsDate(date, timeStr) {
  // Combine date (YYYY-MM-DD) + time (HH:MM) → UTC ICS format YYYYMMDDTHHMMSSZ
  // We treat the stored time as-is (no timezone conversion — store as "floating" UTC)
  try {
    const [year, month, day] = (date || "").split("-").map(Number);
    const [hour, minute] = (timeStr || "00:00").split(":").map(Number);
    if (!year || isNaN(hour)) return null;
    return `${year}${pad(month)}${pad(day)}T${pad(hour)}${pad(minute)}00Z`;
  } catch {
    return null;
  }
}

function addMinutes(date, timeStr, minutes) {
  try {
    const [year, month, day] = (date || "").split("-").map(Number);
    const [hour, minute] = (timeStr || "00:00").split(":").map(Number);
    const totalMinutes = hour * 60 + minute + minutes;
    const endHour = Math.floor(totalMinutes / 60) % 24;
    const endMinute = totalMinutes % 60;
    const dayOverflow = Math.floor(totalMinutes / (60 * 24));
    const endDay = day + dayOverflow;
    return `${year}${pad(month)}${pad(endDay)}T${pad(endHour)}${pad(endMinute)}00Z`;
  } catch {
    return null;
  }
}

function escapeIcs(str) {
  if (!str) return "";
  return String(str).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function buildMeetingIcs(meeting, sponsor, attendee, event) {
  try {
    const sponsorName = sponsor?.name ?? "Sponsor";
    const attendeeName = attendee
      ? `${attendee.firstName ?? ""} ${attendee.lastName ?? ""}`.trim() || attendee.name || "Attendee"
      : "Attendee";
    const eventName = event?.name ?? "Event";
    const isOnline = meeting?.meetingType === "online_request";

    const summary = `Meeting with ${sponsorName} at ${eventName}`;

    const locationStr = isOnline
      ? (meeting?.location || meeting?.platform || "Online Meeting")
      : (meeting?.location || `${eventName} — Onsite Meeting`);

    let description = `Scheduled through Converge Concierge.\\n\\nSponsor: ${sponsorName}\\nAttendee: ${attendeeName}\\nMeeting Type: ${isOnline ? "Online" : "Onsite"}\\nEvent: ${eventName}`;
    if (isOnline && meeting?.meetingLink) {
      description += `\\nMeeting Link: ${meeting.meetingLink}`;
    } else if (!isOnline && meeting?.location) {
      description += `\\nLocation: ${meeting.location}`;
    }

    const dtStart = toIcsDate(meeting?.date, meeting?.time);
    if (!dtStart) return null;

    const duration = meeting?.duration ?? MEETING_DURATION_MINUTES;
    const dtEnd = addMinutes(meeting?.date, meeting?.time, duration);
    if (!dtEnd) return null;

    const uid = `${meeting?.id ?? Math.random().toString(36).slice(2)}@concierge.convergeevents.com`;
    const dtstamp = (() => {
      const now = new Date();
      return `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
    })();

    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Converge Concierge//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:REQUEST",
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcs(summary)}`,
      `DESCRIPTION:${escapeIcs(description)}`,
      `LOCATION:${escapeIcs(locationStr)}`,
      "STATUS:CONFIRMED",
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
  } catch (err) {
    console.error("[CALENDAR] ICS generation failed:", err?.message ?? err);
    return null;
  }
}

export function buildGoogleCalendarLink(meeting, sponsor, attendee, event) {
  try {
    const sponsorName = sponsor?.name ?? "Sponsor";
    const attendeeName = attendee
      ? `${attendee.firstName ?? ""} ${attendee.lastName ?? ""}`.trim() || "Attendee"
      : "Attendee";
    const eventName = event?.name ?? "Event";
    const isOnline = meeting?.meetingType === "online_request";

    const title = `Meeting with ${sponsorName} at ${eventName}`;
    const locationStr = isOnline
      ? (meeting?.location || meeting?.platform || "Online Meeting")
      : (meeting?.location || "Onsite");

    let details = `Scheduled through Converge Concierge. Sponsor: ${sponsorName} | Attendee: ${attendeeName} | Event: ${eventName}`;
    if (isOnline && meeting?.meetingLink) {
      details += ` | Link: ${meeting.meetingLink}`;
    }

    const dtStart = toIcsDate(meeting?.date, meeting?.time);
    const dtEnd = addMinutes(meeting?.date, meeting?.time, meeting?.duration ?? MEETING_DURATION_MINUTES);
    if (!dtStart || !dtEnd) return null;

    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: title,
      dates: `${dtStart}/${dtEnd}`,
      location: locationStr,
      details,
    });

    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  } catch (err) {
    console.error("[CALENDAR] Google Calendar link generation failed:", err?.message ?? err);
    return null;
  }
}

export function buildOutlookCalendarLink(meeting, sponsor, attendee, event) {
  try {
    const sponsorName = sponsor?.name ?? "Sponsor";
    const eventName = event?.name ?? "Event";
    const isOnline = meeting?.meetingType === "online_request";

    const title = `Meeting with ${sponsorName} at ${eventName}`;
    const locationStr = isOnline
      ? (meeting?.location || meeting?.platform || "Online Meeting")
      : (meeting?.location || "Onsite");

    const dtStart = toIcsDate(meeting?.date, meeting?.time);
    const dtEnd = addMinutes(meeting?.date, meeting?.time, meeting?.duration ?? MEETING_DURATION_MINUTES);
    if (!dtStart || !dtEnd) return null;

    // Outlook web compose link
    const startIso = dtStart.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z");
    const endIso = dtEnd.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, "$1-$2-$3T$4:$5:$6Z");

    const params = new URLSearchParams({
      path: "/calendar/action/compose",
      rru: "addevent",
      subject: title,
      startdt: startIso,
      enddt: endIso,
      location: locationStr,
    });

    return `https://outlook.live.com/calendar/0/action/compose?${params.toString()}`;
  } catch (err) {
    console.error("[CALENDAR] Outlook Calendar link generation failed:", err?.message ?? err);
    return null;
  }
}

export function buildCalendarLinks(meeting, sponsor, attendee, event) {
  return {
    google: buildGoogleCalendarLink(meeting, sponsor, attendee, event),
    outlook: buildOutlookCalendarLink(meeting, sponsor, attendee, event),
  };
}
