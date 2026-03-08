import PDFDocument from "pdfkit";
import type { Readable } from "stream";

export interface ReportMeeting {
  id: string;
  date: string;
  time: string;
  location: string;
  status: string;
  meetingType: string;
  attendeeName: string;
  attendeeTitle: string;
  attendeeCompany: string;
  attendeeEmail: string;
  attendeeLinkedin: string;
}

export interface SponsorReportData {
  generatedAt: Date;
  event: {
    name: string;
    slug: string;
    location: string;
    startDate: string;
    endDate: string;
  };
  sponsor: {
    name: string;
    level: string;
  };
  meetings: ReportMeeting[];
}

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  navy:     "#0D1E3A",
  teal:     "#0D9488",
  tealDark: "#0B7A71",
  slate:    "#64748B",
  border:   "#E2E8F0",
  rowAlt:   "#F8FAFC",
  white:    "#FFFFFF",
  red:      "#EF4444",
  green:    "#22C55E",
  blue:     "#3B82F6",
  violet:   "#8B5CF6",
  yellow:   "#F59E0B",
  text:     "#1E293B",
  textMid:  "#475569",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function statusColor(s: string) {
  if (s === "Completed") return C.green;
  if (s === "Cancelled" || s === "NoShow") return C.red;
  if (s === "Pending")   return C.violet;
  if (s === "Confirmed") return C.teal;
  return C.blue;
}

// ── PDF Builder ───────────────────────────────────────────────────────────────

export function buildSponsorReportPDF(data: SponsorReportData): Readable {
  const doc = new PDFDocument({ size: "LETTER", margin: 50, autoFirstPage: true });
  const pw  = doc.page.width;   // 612
  const lm  = 50;               // left margin
  const rm  = 50;               // right margin
  const cw  = pw - lm - rm;     // content width: 512

  // ── Derived stats ───────────────────────────────────────────────────────────
  const { meetings } = data;
  const total      = meetings.length;
  const completed  = meetings.filter((m) => m.status === "Completed").length;
  const pending    = meetings.filter((m) => m.status === "Pending").length;
  const cancelled  = meetings.filter((m) => m.status === "Cancelled" || m.status === "NoShow").length;
  const onsite     = meetings.filter((m) => m.meetingType !== "online_request").length;
  const online     = meetings.filter((m) => m.meetingType === "online_request").length;

  const companyCount: Record<string, number> = {};
  for (const m of meetings) {
    if (m.attendeeCompany) companyCount[m.attendeeCompany] = (companyCount[m.attendeeCompany] ?? 0) + 1;
  }
  const uniqueCompanies = Object.keys(companyCount).length;
  const topCompanies = Object.entries(companyCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const leadMap = new Map<string, ReportMeeting>();
  for (const m of meetings) {
    const key = m.attendeeEmail || m.attendeeName;
    if (!leadMap.has(key)) leadMap.set(key, m);
  }
  const totalLeads = leadMap.size;

  // ── Header bar ──────────────────────────────────────────────────────────────
  doc.rect(0, 0, pw, 80).fill(C.navy);
  doc.fontSize(22).font("Helvetica-Bold").fillColor(C.white).text("Converge Concierge", lm, 22);
  doc.fontSize(10).font("Helvetica").fillColor("#94A3B8").text("Sponsor Performance Report", lm, 48);
  doc.fontSize(9).fillColor("#94A3B8").text(`Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, lm, 62);

  let y = 104;

  // ── Two-column info block ────────────────────────────────────────────────────
  const colW = (cw - 16) / 2;

  // Event block
  doc.rect(lm, y, colW, 90).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.teal).text("EVENT INFORMATION", lm + 12, y + 12);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text).text(data.event.name, lm + 12, y + 26, { width: colW - 24, lineBreak: false });
  doc.fontSize(9).font("Helvetica").fillColor(C.textMid)
    .text(`Code: ${data.event.slug}`, lm + 12, y + 44)
    .text(`Location: ${data.event.location}`, lm + 12, y + 58)
    .text(`Dates: ${data.event.startDate} – ${data.event.endDate}`, lm + 12, y + 72);

  // Sponsor block
  const sx = lm + colW + 16;
  doc.rect(sx, y, colW, 90).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.teal).text("SPONSOR INFORMATION", sx + 12, y + 12);
  doc.fontSize(11).font("Helvetica-Bold").fillColor(C.text).text(data.sponsor.name, sx + 12, y + 26, { width: colW - 24 });
  doc.fontSize(9).font("Helvetica").fillColor(C.textMid).text(`Sponsorship Level: ${data.sponsor.level}`, sx + 12, y + 44);

  y += 106;

  // ── Section heading helper ────────────────────────────────────────────────────
  function sectionHeading(label: string) {
    doc.rect(lm, y, cw, 26).fill(C.navy);
    doc.fontSize(9).font("Helvetica-Bold").fillColor(C.white).text(label, lm + 10, y + 8);
    y += 32;
  }

  // ── Meeting Summary ──────────────────────────────────────────────────────────
  sectionHeading("MEETING SUMMARY");

  const metrics = [
    ["Total Meetings",          String(total)],
    ["Completed",               String(completed)],
    ["Pending Online Requests", String(pending)],
    ["Cancelled / No-Show",     String(cancelled)],
    ["Onsite Meetings",         String(onsite)],
    ["Online Meetings",         String(online)],
    ["Unique Companies Met",    String(uniqueCompanies)],
    ["Total Leads Captured",    String(totalLeads)],
  ];

  const mColW = cw / 4;
  metrics.forEach(([label, val], i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const mx  = lm + col * mColW;
    const my  = y + row * 52;
    const isAlt = (row + col) % 2 === 1;
    doc.rect(mx, my, mColW, 50).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);
    doc.fontSize(16).font("Helvetica-Bold").fillColor(C.teal).text(val, mx + 8, my + 8);
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textMid).text(label, mx + 8, my + 33, { width: mColW - 16 });
  });

  y += Math.ceil(metrics.length / 4) * 52 + 16;

  // ── Top Companies ────────────────────────────────────────────────────────────
  if (topCompanies.length > 0) {
    sectionHeading("TOP COMPANIES MET");
    topCompanies.forEach(([company, count], i) => {
      const rowY = y + i * 22;
      doc.rect(lm, rowY, cw, 20).fill(i % 2 === 0 ? C.white : C.rowAlt).stroke(C.border);
      doc.fontSize(9).font("Helvetica").fillColor(C.text).text(`${i + 1}. ${company}`, lm + 10, rowY + 5);
      doc.font("Helvetica-Bold").fillColor(C.teal).text(`${count} meeting${count !== 1 ? "s" : ""}`, lm + 10, rowY + 5, { align: "right", width: cw - 20 });
    });
    y += topCompanies.length * 22 + 16;
  }

  // ── Lead Contacts table ───────────────────────────────────────────────────────
  if (y + 80 > doc.page.height - 80) { doc.addPage(); y = 50; }

  sectionHeading("LEAD CONTACTS");

  const cols = [
    { label: "Name",         w: 90 },
    { label: "Title",        w: 70 },
    { label: "Company",      w: 90 },
    { label: "Email",        w: 110 },
    { label: "Type",         w: 50 },
    { label: "Date",         w: 60 },
    { label: "Status",       w: 52 },
  ];
  const totalCols = cols.reduce((s, c) => s + c.w, 0);
  const scale = cw / totalCols;
  const scaled = cols.map((c) => ({ ...c, w: c.w * scale }));

  // Table header
  doc.rect(lm, y, cw, 18).fill(C.teal);
  let cx = lm;
  scaled.forEach(({ label, w }) => {
    doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.white).text(label, cx + 4, y + 5, { width: w - 8, lineBreak: false });
    cx += w;
  });
  y += 18;

  // Table rows
  const sortedMeetings = [...meetings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  const ROW_H = 20;
  sortedMeetings.forEach((m, i) => {
    if (y + ROW_H > doc.page.height - 50) {
      doc.addPage();
      y = 50;
      // Re-draw header
      doc.rect(lm, y, cw, 18).fill(C.teal);
      let hx = lm;
      scaled.forEach(({ label, w: hw }) => {
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor(C.white).text(label, hx + 4, y + 5, { width: hw - 8, lineBreak: false });
        hx += hw;
      });
      y += 18;
    }

    const isAlt = i % 2 === 1;
    doc.rect(lm, y, cw, ROW_H).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);
    cx = lm;
    const isOnline = m.meetingType === "online_request";
    const rowData = [
      m.attendeeName,
      m.attendeeTitle,
      m.attendeeCompany,
      m.attendeeEmail,
      isOnline ? "Online" : "Onsite",
      m.date,
      m.status,
    ];
    rowData.forEach((val, j) => {
      const w = scaled[j].w;
      const color = j === 6 ? statusColor(val) : j === 4 && isOnline ? C.violet : C.text;
      doc.fontSize(7.5).font(j === 6 ? "Helvetica-Bold" : "Helvetica").fillColor(color)
        .text(val, cx + 4, y + 6, { width: w - 8, lineBreak: false });
      cx += w;
    });
    y += ROW_H;
  });

  // ── Footer ────────────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange();
  for (let p = 0; p < pages.count; p++) {
    doc.switchToPage(p);
    doc.rect(0, doc.page.height - 36, pw, 36).fill(C.navy);
    doc.fontSize(8).font("Helvetica").fillColor("#94A3B8")
      .text("Converge Concierge — Confidential Sponsor Report", lm, doc.page.height - 24);
    doc.fillColor("#94A3B8")
      .text(`Page ${p + 1} of ${pages.count}`, 0, doc.page.height - 24, { align: "right", width: pw - rm });
  }

  doc.end();
  return doc as unknown as Readable;
}
