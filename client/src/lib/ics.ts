// ── ICS / Calendar utilities ──────────────────────────────────────────────────

export interface ICSMeetingData {
  meetingId: string;
  sponsorName: string;
  attendeeName: string;
  eventName: string;
  eventSlug: string;
  date: string;       // ISO date "YYYY-MM-DD"
  time: string;       // "HH:mm"
  location: string;
  meetingType?: "onsite" | "online_request";
  platform?: string | null;
}

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function icsDate(dateStr: string, timeStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  const [h, m] = timeStr.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${y}${pad(mo)}${pad(d)}T${pad(h)}${pad(m)}00`;
}

function addMinutes(timeStr: string, mins: number): string {
  const [h, m] = timeStr.split(":").map(Number);
  const total = h * 60 + m + mins;
  const nh = Math.floor(total / 60) % 24;
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

function escapeICS(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

export function generateICS(m: ICSMeetingData): string {
  const isOnline = m.meetingType === "online_request";
  const endTime = addMinutes(m.time, 30);
  const dtStart = icsDate(m.date, m.time);
  const dtEnd   = icsDate(m.date, endTime);
  const now     = icsDate(new Date().toISOString().slice(0, 10), new Date().toTimeString().slice(0, 5));

  const title    = `${m.sponsorName} × ${m.attendeeName}`;
  const location = isOnline
    ? (m.platform && m.platform !== "No Preference" ? m.platform : "Online Meeting")
    : m.location;
  const description = [
    `Event: ${m.eventName} (${m.eventSlug})`,
    `Sponsor: ${m.sponsorName}`,
    `Attendee: ${m.attendeeName}`,
    isOnline && m.platform ? `Platform: ${m.platform}` : null,
    `Time: ${fmt12(m.time)} – ${fmt12(endTime)}`,
    `Location: ${location}`,
  ].filter(Boolean).join("\\n");

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Converge Concierge//Meeting//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${m.meetingId}@converge-concierge`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(title)}`,
    `DESCRIPTION:${escapeICS(description)}`,
    `LOCATION:${escapeICS(location)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadICS(m: ICSMeetingData): void {
  const content = generateICS(m);
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `meeting-${m.meetingId.slice(0, 8)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(m: ICSMeetingData): string {
  const isOnline = m.meetingType === "online_request";
  const endTime = addMinutes(m.time, 30);
  const [y, mo, d] = m.date.split("-").map(Number);
  const [sh, sm] = m.time.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const start = `${y}${pad(mo)}${pad(d)}T${pad(sh)}${pad(sm)}00`;
  const end   = `${y}${pad(mo)}${pad(d)}T${pad(eh)}${pad(em)}00`;

  const title = encodeURIComponent(`${m.sponsorName} × ${m.attendeeName}`);
  const loc   = encodeURIComponent(isOnline ? (m.platform && m.platform !== "No Preference" ? m.platform : "Online") : m.location);
  const details = encodeURIComponent(`Event: ${m.eventName} (${m.eventSlug})\nSponsor: ${m.sponsorName}`);

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${start}/${end}&location=${loc}&details=${details}`;
}
