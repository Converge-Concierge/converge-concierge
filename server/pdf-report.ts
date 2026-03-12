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

export interface ReportDeliverable {
  id: string;
  category: string;
  deliverableName: string;
  quantity: number | null;
  quantityUnit: string | null;
  ownerType: string;
  status: string;
  dueTiming: string;
  dueDate: string | null;
  sponsorFacingNote: string | null;
  fulfillmentType: string;
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
    primaryColor: string | null;
    accentColor: string | null;
    logoBuffer: Buffer | null;
  };
  sponsor: {
    name: string;
    level: string;
  };
  meetings: ReportMeeting[];
  infoRequests: ReportInfoRequest[];
  deliverables: ReportDeliverable[];
  analytics: {
    profileViews: number;
    meetingCtaClicks: number;
  };
}

// ── Category sort order ────────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "Company Profile",
  "Event Participation",
  "Speaking & Content",
  "Meetings & Introductions",
  "Marketing & Branding",
  "Post-Event Deliverables",
  "Compliance",
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function statusColor(s: string, accent: string, navy: string) {
  if (s === "Completed") return "#22C55E";
  if (s === "Cancelled" || s === "NoShow") return "#EF4444";
  if (s === "Pending")   return "#8B5CF6";
  if (s === "Confirmed") return accent;
  return "#3B82F6";
}

function deliverableStatusColor(s: string, accent: string): string {
  if (s === "Delivered" || s === "Approved") return "#22C55E";
  if (s === "In Progress" || s === "Scheduled") return accent;
  if (s === "Awaiting Sponsor Input") return "#F59E0B";
  if (s === "Available After Event") return "#3B82F6";
  if (s === "Issue Identified" || s === "Blocked") return "#EF4444";
  return "#64748B";
}

function infoStatusColor(s: string, accent: string): string {
  if (s === "Closed") return "#64748B";
  if (s === "Meeting Scheduled") return accent;
  if (s === "Not Qualified") return "#F59E0B";
  if (s === "Email Sent" || s === "Contacted") return "#F59E0B";
  return "#3B82F6";
}

function formatDueTiming(timing: string, dueDate: string | null): string {
  if (dueDate) {
    try {
      return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { /* fallback below */ }
  }
  if (!timing || timing === "not_applicable") return "—";
  return timing.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Section heading helper ────────────────────────────────────────────────────

function drawSectionHeading(doc: any, y: number, lm: number, cw: number, label: string, navy: string, accent: string): number {
  doc.rect(lm, y, cw, 24).fill(navy);
  doc.rect(lm, y + 24, cw, 3).fill(accent);
  doc.fontSize(8).font("Helvetica-Bold").fillColor("#FFFFFF").text(label, lm + 10, y + 8);
  return y + 32;
}

function drawCategoryBar(doc: any, y: number, lm: number, cw: number, label: string, accent: string): number {
  doc.rect(lm, y, cw, 18).fill(accent + "22");
  doc.rect(lm, y, 3, 18).fill(accent);
  doc.fontSize(7.5).font("Helvetica-Bold").fillColor(accent).text(label.toUpperCase(), lm + 10, y + 5);
  return y + 18;
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

  // ── Event-aware color palette ───────────────────────────────────────────────
  const navy   = data.event.primaryColor  || "#0D1E3A";
  const accent = data.event.accentColor   || "#0D9488";

  const C = {
    navy,
    accent,
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

  // ── Derived stats ──────────────────────────────────────────────────────────
  const { meetings, infoRequests, deliverables, analytics } = data;
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

  // Group deliverables by category
  const deliverablesByCategory: Record<string, ReportDeliverable[]> = {};
  for (const d of deliverables) {
    const cat = d.category || "Other";
    if (!deliverablesByCategory[cat]) deliverablesByCategory[cat] = [];
    deliverablesByCategory[cat].push(d);
  }
  const sortedCategories = [
    ...CATEGORY_ORDER.filter((c) => deliverablesByCategory[c]),
    ...Object.keys(deliverablesByCategory).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];

  // ── Page 1: Header ─────────────────────────────────────────────────────────

  // Primary-color header band
  doc.rect(0, 0, pw, 100).fill(C.navy);
  // Accent strip
  doc.rect(0, 100, pw, 4).fill(C.accent);

  // Left block: branding + title
  doc.fontSize(7.5).font("Helvetica").fillColor(C.headerSub)
    .text("CONVERGE EVENTS  ·  CONVERGE CONCIERGE", lm, 16, { characterSpacing: 0.5 });
  doc.fontSize(19).font("Helvetica-Bold").fillColor(C.white)
    .text("Sponsorship Performance Report", lm, 32);
  doc.fontSize(9).font("Helvetica").fillColor(C.headerSub)
    .text(
      `${data.sponsor.name}  ·  ${data.sponsor.level}  ·  ${data.event.slug}`,
      lm, 62,
    );
  doc.fontSize(7.5).font("Helvetica").fillColor(C.headerSub)
    .text(
      `Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      lm, 80,
    );

  // Right block: event logo if available
  if (data.event.logoBuffer) {
    try {
      doc.image(data.event.logoBuffer, pw - rm - 80, 14, {
        fit: [80, 72],
        align: "right",
        valign: "center",
      });
    } catch (_e) {
      // Logo embed failed — skip silently
    }
  }

  let y = 120;

  // ── Section 1: Event & Sponsor Overview ────────────────────────────────────
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 1  ·  EVENT & SPONSOR OVERVIEW", C.navy, C.accent);

  const colW = (cw - 16) / 2;

  // Event block
  doc.rect(lm, y, colW, 88).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.accent).text("EVENT", lm + 12, y + 10);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text)
    .text(data.event.name, lm + 12, y + 23, { width: colW - 24, lineBreak: false });
  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(`Code: ${data.event.slug}`, lm + 12, y + 41)
    .text(`Dates: ${data.event.dateRange}`, lm + 12, y + 55)
    .text(`Location: ${data.event.location}`, lm + 12, y + 69);

  // Sponsor block
  const sx = lm + colW + 16;
  doc.rect(sx, y, colW, 88).fill(C.rowAlt).stroke(C.border);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.accent).text("SPONSOR", sx + 12, y + 10);
  doc.fontSize(10).font("Helvetica-Bold").fillColor(C.text)
    .text(data.sponsor.name, sx + 12, y + 23, { width: colW - 24, lineBreak: false });
  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(`Sponsorship Level: ${data.sponsor.level}`, sx + 12, y + 41);

  y += 104;

  // ── Section 2: Sponsorship Activity Summary ────────────────────────────────
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 2  ·  SPONSORSHIP ACTIVITY SUMMARY", C.navy, C.accent);

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
    doc.fontSize(16).font("Helvetica-Bold").fillColor(C.accent).text(String(val), mx + 8, my + 8);
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textMid).text(label, mx + 8, my + 32, { width: mColW - 16, lineBreak: false });
  });

  y += totalMetricRows * mRowH + 14;

  // ── Section 3: Sponsorship Deliverables ───────────────────────────────────
  if (sortedCategories.length > 0) {
    if (y + 60 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "SECTION 3  ·  SPONSORSHIP DELIVERABLES", C.navy, C.accent);

    const dlvCols = [
      { label: "Deliverable",   w: 180 },
      { label: "Qty",           w: 36 },
      { label: "Owner",         w: 64 },
      { label: "Status",        w: 90 },
      { label: "Due",           w: 100 },
      { label: "Note",          w: 42 },
    ];
    const dlvTotal = dlvCols.reduce((s, c) => s + c.w, 0);
    const dlvScale = cw / dlvTotal;
    const dlvScaled = dlvCols.map((c) => ({ ...c, w: c.w * dlvScale }));

    const drawDlvHeader = (startY: number) => {
      doc.rect(lm, startY, cw, 16).fill(C.navy + "CC");
      let hx = lm;
      dlvScaled.forEach(({ label, w }) => {
        doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.white).text(label, hx + 4, startY + 4, { width: w - 8, lineBreak: false });
        hx += w;
      });
      return startY + 16;
    };

    const DLV_ROW_H = 20;

    for (const cat of sortedCategories) {
      const items = deliverablesByCategory[cat];
      if (!items || items.length === 0) continue;

      const blockNeeded = 20 + items.length * DLV_ROW_H;
      if (y + blockNeeded > contentBottom) {
        doc.addPage();
        y = 50;
        y = drawDlvHeader(y);
      } else {
        y = drawCategoryBar(doc, y, lm, cw, cat, C.accent);
      }

      items.forEach((d, i) => {
        if (y + DLV_ROW_H > contentBottom) {
          doc.addPage();
          y = 50;
          y = drawDlvHeader(y);
        }
        const isAlt = i % 2 === 1;
        doc.rect(lm, y, cw, DLV_ROW_H).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);

        const qtyLabel = d.quantity != null && d.quantity > 0
          ? d.quantityUnit ? `${d.quantity} ${d.quantityUnit}` : String(d.quantity)
          : "—";

        const dueLabel = formatDueTiming(d.dueTiming, d.dueDate);
        const sColor = deliverableStatusColor(d.status, C.accent);
        const hasNote = !!d.sponsorFacingNote;

        let cx = lm;
        const rowData: { text: string; bold?: boolean; color?: string }[] = [
          { text: d.deliverableName },
          { text: qtyLabel, color: C.textMid },
          { text: d.ownerType, color: C.textMid },
          { text: d.status, bold: true, color: sColor },
          { text: dueLabel, color: C.textMid },
          { text: hasNote ? "Yes" : "—", color: hasNote ? C.accent : C.textMid },
        ];

        rowData.forEach(({ text, bold, color }, j) => {
          const w = dlvScaled[j].w;
          doc.fontSize(7.5)
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fillColor(color ?? C.text)
            .text(text, cx + 4, y + 6, { width: w - 8, lineBreak: false });
          cx += w;
        });

        y += DLV_ROW_H;
      });

      y += 4; // spacing between categories
    }

    y += 10;
  }

  // ── Section 4: Top Companies ───────────────────────────────────────────────
  if (topCompanies.length > 0) {
    if (y + 40 + topCompanies.length * 22 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "SECTION 4  ·  TOP COMPANIES ENGAGED", C.navy, C.accent);
    topCompanies.forEach(([company, count], i) => {
      const rowY = y + i * 22;
      doc.rect(lm, rowY, cw, 20).fill(i % 2 === 0 ? C.white : C.rowAlt).stroke(C.border);
      doc.fontSize(9).font("Helvetica").fillColor(C.text).text(`${i + 1}.  ${company}`, lm + 10, rowY + 5);
      doc.font("Helvetica-Bold").fillColor(C.accent)
        .text(`${count} meeting${count !== 1 ? "s" : ""}`, lm + 10, rowY + 5, { align: "right", width: cw - 20 });
    });
    y += topCompanies.length * 22 + 14;
  }

  // ── Section 5: Lead Contacts table ────────────────────────────────────────
  if (y + 80 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "SECTION 5  ·  LEAD CONTACTS", C.navy, C.accent);

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
      doc.rect(lm, startY, cw, 18).fill(C.accent);
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
        const color = j === 6 ? statusColor(val, C.accent, C.navy) : j === 4 && isOnline ? C.violet : C.text;
        doc.fontSize(7.5).font(j === 6 ? "Helvetica-Bold" : "Helvetica").fillColor(color)
          .text(val, cx + 4, y + 6, { width: w - 8, lineBreak: false });
        cx += w;
      });
      y += ROW_H;
    });
    y += 14;
  }

  // ── Section 6: Information Requests ───────────────────────────────────────
  if (infoRequests.length > 0) {
    if (y + 80 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "SECTION 6  ·  INFORMATION REQUESTS", C.navy, C.accent);

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
      doc.rect(lm, startY, cw, 18).fill(C.accent);
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
        const color = j === 4 ? infoStatusColor(val, C.accent) : C.text;
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
