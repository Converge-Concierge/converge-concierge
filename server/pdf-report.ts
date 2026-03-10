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

export interface ReportInfoRequest {
  id: string;
  attendeeFirstName: string;
  attendeeLastName: string;
  attendeeEmail: string;
  attendeeCompany: string;
  attendeeTitle: string;
  source: string;
  status: string;
  message: string | null;
  createdAt: string;
}

export interface SponsorReportData {
  generatedAt: Date;
  event: {
    name: string;
    slug: string;
    location: string;
    startDate: string;
    endDate: string;
    dateRange: string;
  };
  sponsor: {
    name: string;
    level: string;
  };
  meetings: ReportMeeting[];
  infoRequests: ReportInfoRequest[];
  analytics: {
    profileViews: number;
    meetingCtaClicks: number;
  };
}

// ── Color palette ─────────────────────────────────────────────────────────────

const C = {
  navy:     "#0D1E3A",
  teal:     "#0D9488",
  tealDark: "#0B7A71",
  tealLight:"#CCFBF1",
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
  headerSub:"#94A3B8",
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

function infoStatusColor(s: string) {
  if (s === "Closed") return C.slate;
  if (s === "Meeting Scheduled") return C.teal;
  if (s === "Not Qualified") return C.yellow;
  if (s === "Email Sent" || s === "Contacted") return C.yellow;
  return C.blue;
}

// ── Section heading helper (defined outside builder so it can be used as closure) ──
function drawSectionHeading(doc: any, y: number, lm: number, cw: number, label: string): number {
  doc.rect(lm, y, cw, 24).fill(C.navy);
  doc.rect(lm, y + 24, cw, 3).fill(C.teal);
  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.white).text(label, lm + 10, y + 8);
  return y + 32;
}

// ── PDF Builder ───────────────────────────────────────────────────────────────

export function buildSponsorReportPDF(data: SponsorReportData): Readable {
  const doc = new PDFDocument({ size: "LETTER", margin: 50, autoFirstPage: true, bufferPages: true });
  const pw  = doc.page.width;   // 612
  const ph  = doc.page.height;  // 792
  const lm  = 50;
  const rm  = 50;
  const cw  = pw - lm - rm;     // 512
  const footerH = 34;
  const contentBottom = ph - footerH - 10;

  // ── Derived stats ──────────────────────────────────────────────────────────
  const { meetings, infoRequests, analytics } = data;
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

  // ── Page 1: Header ─────────────────────────────────────────────────────────

  // Navy header band
  doc.rect(0, 0, pw, 92).fill(C.navy);
  // Teal accent strip
  doc.rect(0, 92, pw, 4).fill(C.teal);

  // Left: Converge Events branding
  doc.fontSize(8).font("Helvetica").fillColor(C.headerSub)
    .text("CONVERGE EVENTS  ·  CONVERGE CONCIERGE", lm, 18, { characterSpacing: 0.5 });
  doc.fontSize(20).font("Helvetica-Bold").fillColor(C.white)
    .text("Sponsor Performance Report", lm, 34);
  doc.fontSize(9).font("Helvetica").fillColor(C.headerSub)
    .text(
      `${data.sponsor.name}  ·  ${data.sponsor.level}  ·  ${data.event.slug}`,
      lm, 62,
    );
  // Right: generated date
  doc.fontSize(8).font("Helvetica").fillColor(C.headerSub)
    .text(
      `Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      0, 75,
      { align: "right", width: pw - rm },
    );

  let y = 110;

  // ── Section 1: Overview ────────────────────────────────────────────────────
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 1  ·  EVENT & SPONSOR OVERVIEW");

  const colW = (cw - 16) / 2;

  // Event block
  doc.rect(lm, y, colW, 88).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.teal).text("EVENT", lm + 12, y + 10);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text)
    .text(data.event.name, lm + 12, y + 23, { width: colW - 24, lineBreak: false });
  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(`Code: ${data.event.slug}`, lm + 12, y + 41)
    .text(`Dates: ${data.event.dateRange}`, lm + 12, y + 55)
    .text(`Location: ${data.event.location}`, lm + 12, y + 69);

  // Sponsor block
  const sx = lm + colW + 16;
  doc.rect(sx, y, colW, 88).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.teal).text("SPONSOR", sx + 12, y + 10);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text)
    .text(data.sponsor.name, sx + 12, y + 23, { width: colW - 24, lineBreak: false });
  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(`Sponsorship Level: ${data.sponsor.level}`, sx + 12, y + 41);

  y += 104;

  // ── Section 2: Performance Summary ────────────────────────────────────────
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 2  ·  PERFORMANCE SUMMARY");

  const metrics: [string, string | number][] = [
    ["Meetings Scheduled",    total],
    ["Meetings Completed",    completed],
    ["Pending Online Req.",   pending],
    ["Cancelled / No-Show",   cancelled],
    ["Onsite Meetings",       onsite],
    ["Online Meetings",       online],
    ["Unique Companies Met",  uniqueCompanies],
    ["Total Leads Captured",  totalLeads],
    ["Info Requests",         infoRequests.length],
    ["Profile Views",         analytics.profileViews],
    ["Meeting CTA Clicks",    analytics.meetingCtaClicks],
    ["Unique Attendees",      totalLeads],
  ];

  const mColCount = 4;
  const mColW = cw / mColCount;
  const mRowH = 50;
  const totalMetricRows = Math.ceil(metrics.length / mColCount);

  metrics.forEach(([label, val], i) => {
    const col = i % mColCount;
    const row = Math.floor(i / mColCount);
    const mx  = lm + col * mColW;
    const my  = y + row * mRowH;
    const isAlt = (row + col) % 2 === 1;
    doc.rect(mx, my, mColW, mRowH - 2).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);
    doc.fontSize(16).font("Helvetica-Bold").fillColor(C.teal).text(String(val), mx + 8, my + 8);
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textMid).text(label, mx + 8, my + 32, { width: mColW - 16, lineBreak: false });
  });

  y += totalMetricRows * mRowH + 14;

  // ── Section 3: Top Companies ───────────────────────────────────────────────
  if (topCompanies.length > 0) {
    if (y + 40 + topCompanies.length * 22 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "SECTION 3  ·  TOP COMPANIES ENGAGED");
    topCompanies.forEach(([company, count], i) => {
      const rowY = y + i * 22;
      doc.rect(lm, rowY, cw, 20).fill(i % 2 === 0 ? C.white : C.rowAlt).stroke(C.border);
      doc.fontSize(9).font("Helvetica").fillColor(C.text).text(`${i + 1}.  ${company}`, lm + 10, rowY + 5);
      doc.font("Helvetica-Bold").fillColor(C.teal)
        .text(`${count} meeting${count !== 1 ? "s" : ""}`, lm + 10, rowY + 5, { align: "right", width: cw - 20 });
    });
    y += topCompanies.length * 22 + 14;
  }

  // ── Section 4: Lead Contacts table ────────────────────────────────────────
  if (y + 80 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 4  ·  LEAD CONTACTS");

  if (meetings.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor(C.textMid).text("No meeting contacts recorded.", lm, y + 6);
    y += 24;
  } else {
    const cols = [
      { label: "Name",    w: 88 },
      { label: "Title",   w: 68 },
      { label: "Company", w: 90 },
      { label: "Email",   w: 110 },
      { label: "Type",    w: 48 },
      { label: "Date",    w: 56 },
      { label: "Status",  w: 52 },
    ];
    const totalCols = cols.reduce((s, c) => s + c.w, 0);
    const scale = cw / totalCols;
    const scaled = cols.map((c) => ({ ...c, w: c.w * scale }));

    const drawLeadHeader = (startY: number) => {
      doc.rect(lm, startY, cw, 18).fill(C.teal);
      let hx = lm;
      scaled.forEach(({ label, w }) => {
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.white).text(label, hx + 4, startY + 5, { width: w - 8, lineBreak: false });
        hx += w;
      });
      return startY + 18;
    };

    y = drawLeadHeader(y);

    const sortedMeetings = [...meetings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const ROW_H = 20;
    sortedMeetings.forEach((m, i) => {
      if (y + ROW_H > contentBottom) {
        doc.addPage();
        y = 50;
        y = drawLeadHeader(y);
      }
      doc.rect(lm, y, cw, ROW_H).fill(i % 2 === 1 ? C.rowAlt : C.white).stroke(C.border);
      let cx = lm;
      const isOnline = m.meetingType === "online_request";
      const rowData = [
        m.attendeeName, m.attendeeTitle, m.attendeeCompany, m.attendeeEmail,
        isOnline ? "Online" : "Onsite", m.date, m.status,
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
    y += 14;
  }

  // ── Section 5: Information Requests ───────────────────────────────────────
  if (infoRequests.length > 0) {
    if (y + 80 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "SECTION 5  ·  INFORMATION REQUESTS");

    const irCols = [
      { label: "Name",    w: 100 },
      { label: "Company", w: 100 },
      { label: "Email",   w: 120 },
      { label: "Source",  w: 60 },
      { label: "Status",  w: 72 },
      { label: "Date",    w: 60 },
    ];
    const irTotal = irCols.reduce((s, c) => s + c.w, 0);
    const irScale = cw / irTotal;
    const irScaled = irCols.map((c) => ({ ...c, w: c.w * irScale }));

    const drawIrHeader = (startY: number) => {
      doc.rect(lm, startY, cw, 18).fill(C.teal);
      let hx = lm;
      irScaled.forEach(({ label, w }) => {
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.white).text(label, hx + 4, startY + 5, { width: w - 8, lineBreak: false });
        hx += w;
      });
      return startY + 18;
    };

    y = drawIrHeader(y);

    const ROW_H = 20;
    infoRequests.forEach((req, i) => {
      if (y + ROW_H > contentBottom) {
        doc.addPage();
        y = 50;
        y = drawIrHeader(y);
      }
      doc.rect(lm, y, cw, ROW_H).fill(i % 2 === 1 ? C.rowAlt : C.white).stroke(C.border);
      let cx = lm;
      const fullName = `${req.attendeeFirstName} ${req.attendeeLastName}`.trim();
      const dateStr = new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const rowData = [fullName, req.attendeeCompany, req.attendeeEmail, req.source, req.status, dateStr];
      rowData.forEach((val, j) => {
        const w = irScaled[j].w;
        const color = j === 4 ? infoStatusColor(val) : C.text;
        doc.fontSize(7.5).font(j === 4 ? "Helvetica-Bold" : "Helvetica").fillColor(color)
          .text(val, cx + 4, y + 6, { width: w - 8, lineBreak: false });
        cx += w;
      });
      y += ROW_H;
    });
    y += 14;
  }

  // ── Footer on every page ───────────────────────────────────────────────────
  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(p);
    doc.rect(0, ph - footerH, pw, footerH).fill(C.navy);
    doc.fontSize(7.5).font("Helvetica").fillColor(C.headerSub)
      .text(
        `Converge Events  ·  Confidential — Prepared for ${data.sponsor.name}`,
        lm, ph - footerH + 11,
        { lineBreak: false },
      );
    doc.fillColor(C.headerSub)
      .text(`Page ${p + 1} of ${range.count}`, 0, ph - footerH + 11, { align: "right", width: pw - rm });
  }

  doc.end();
  return doc as unknown as Readable;
}
