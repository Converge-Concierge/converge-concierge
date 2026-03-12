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

// ── Category sort order ───────────────────────────────────────────────────────

const CATEGORY_ORDER = [
  "Company Profile",
  "Event Participation",
  "Speaking & Content",
  "Meetings & Introductions",
  "Marketing & Branding",
  "Post-Event Deliverables",
  "Compliance",
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt12(t: string) {
  const [h, m] = t.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}

function formatDueTiming(timing: string, dueDate: string | null): string {
  if (dueDate) {
    try {
      return new Date(dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch { /* fallback */ }
  }
  if (!timing || timing === "not_applicable") return "—";
  const map: Record<string, string> = {
    before_event: "Before Event",
    during_event: "During Event",
    after_event: "After Event",
    ongoing: "Ongoing",
  };
  return map[timing] ?? timing.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Status color — ONLY used for status text/badge coloring
function meetingStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string; navy: string }): string {
  if (s === "Completed") return C.green;
  if (s === "Cancelled" || s === "NoShow") return C.red;
  if (s === "Pending") return C.amber;
  if (s === "Confirmed" || s === "Scheduled") return C.blue;
  return C.blue;
}

function deliverableStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string }): string {
  if (s === "Delivered" || s === "Approved") return C.green;
  if (s === "In Progress" || s === "Scheduled") return C.blue;
  if (s === "Awaiting Sponsor Input") return C.amber;
  if (s === "Available After Event") return C.gray;
  if (s === "Issue Identified" || s === "Blocked") return C.red;
  return C.gray;
}

function infoStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string }): string {
  if (s === "Closed") return C.gray;
  if (s === "Meeting Scheduled") return C.green;
  if (s === "Not Qualified") return C.gray;
  if (s === "Email Sent" || s === "Contacted") return C.blue;
  return C.blue;
}

// ── Drawing Primitives ────────────────────────────────────────────────────────

// Unified section heading: light neutral bg + left primary accent bar + dark bold text
function drawSectionHeading(doc: any, y: number, lm: number, cw: number, title: string, navy: string): number {
  const H = 26;
  doc.rect(lm, y, cw, H).fill("#F1F5F9");
  doc.rect(lm, y, 4, H).fill(navy);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#1E293B")
    .text(title, lm + 14, y + 8, { width: cw - 18, lineBreak: false });
  return y + H + 8;
}

// Category bar for deliverables: neutral bg + accent left bar + accent bold text
function drawCategoryBar(doc: any, y: number, lm: number, cw: number, label: string, accent: string): number {
  const H = 18;
  doc.rect(lm, y, cw, H).fill("#F1F5F9");
  doc.rect(lm, y, 3, H).fill(accent);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(accent)
    .text(label.toUpperCase(), lm + 10, y + 5, { width: cw - 14, lineBreak: false });
  return y + H;
}

// Universal table header row: primary color bg + white text
function drawTableHeader(doc: any, y: number, lm: number, navy: string, cols: { label: string; w: number }[]): number {
  const H = 18;
  const totalW = cols.reduce((s, c) => s + c.w, 0);
  doc.rect(lm, y, totalW, H).fill(navy);
  let hx = lm;
  for (const { label, w } of cols) {
    doc.fontSize(7).font("Helvetica-Bold").fillColor("#FFFFFF")
      .text(label, hx + 5, y + 5, { width: w - 10, lineBreak: false });
    hx += w;
  }
  return y + H;
}

// Metric card: white bg + top primary accent bar + dark number + muted label
function drawMetricCard(doc: any, mx: number, my: number, w: number, h: number, value: string, label: string, navy: string, C: any): void {
  doc.rect(mx, my, w, h).fill(C.white).stroke(C.border);
  doc.rect(mx, my, w, 3).fill(navy);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(C.text)
    .text(value, mx + 8, my + 10, { width: w - 16, align: "left", lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(C.textMid)
    .text(label, mx + 8, my + 34, { width: w - 16, lineBreak: false });
}

// Status pill: colored text only (no heavy background)
function drawStatusPill(doc: any, text: string, x: number, y: number, w: number, color: string): void {
  doc.fontSize(7).font("Helvetica-Bold").fillColor(color)
    .text(text, x, y, { width: w, lineBreak: false });
}

// ── PDF Builder ───────────────────────────────────────────────────────────────

export function buildSponsorReportPDF(data: SponsorReportData): Readable {
  const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: true, bufferPages: true });

  const pw  = doc.page.width;   // 612
  const ph  = doc.page.height;  // 792
  const lm  = 50;
  const rm  = 50;
  const cw  = pw - lm - rm;     // 512
  const footerH = 28;
  const contentBottom = ph - footerH - 14;

  // ── Event-aware color palette — strictly controlled ───────────────────────
  const navy   = data.event.primaryColor  || "#0D1E3A";
  const accent = data.event.accentColor   || "#0D9488";

  const C = {
    navy,
    accent,
    text:     "#1E293B",   // ALL body text, metric numbers, table data — never colored for data
    textMid:  "#475569",   // labels, secondary text
    textSub:  "#94A3B8",   // very muted — header sub-branding, page numbers
    border:   "#E2E8F0",   // table / card borders
    rowAlt:   "#F8FAFC",   // alternating table row background
    white:    "#FFFFFF",
    // Status colors — ONLY for status indicators, never generic text
    green:    "#16A34A",
    blue:     "#2563EB",
    amber:    "#D97706",
    red:      "#DC2626",
    gray:     "#64748B",
  };

  // ── Derived stats ─────────────────────────────────────────────────────────
  const { meetings, infoRequests, deliverables, analytics } = data;

  const totalMeetings  = meetings.length;
  const completed      = meetings.filter((m) => m.status === "Completed").length;
  const pending        = meetings.filter((m) => m.status === "Pending").length;
  const cancelled      = meetings.filter((m) => m.status === "Cancelled" || m.status === "NoShow").length;
  const onsite         = meetings.filter((m) => m.meetingType !== "online_request").length;
  const online         = meetings.filter((m) => m.meetingType === "online_request").length;
  const confirmed      = meetings.filter((m) => m.status === "Confirmed" || m.status === "Scheduled").length;

  // Unique companies across meetings + info requests
  const companySet = new Set<string>();
  for (const m of meetings) { if (m.attendeeCompany) companySet.add(m.attendeeCompany.trim()); }
  for (const r of infoRequests) { if (r.attendeeCompany) companySet.add(r.attendeeCompany.trim()); }
  const uniqueCompanies = companySet.size;

  // Companies from meetings only (for top companies table)
  const companyCount: Record<string, number> = {};
  for (const m of meetings) {
    if (m.attendeeCompany) companyCount[m.attendeeCompany] = (companyCount[m.attendeeCompany] ?? 0) + 1;
  }
  const topCompanies = Object.entries(companyCount).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // Unique leads
  const leadMap = new Map<string, ReportMeeting>();
  for (const m of meetings) {
    const key = m.attendeeEmail || m.attendeeName;
    if (!leadMap.has(key)) leadMap.set(key, m);
  }

  // Deliverables completion
  const completedDeliverables = deliverables.filter((d) => d.status === "Delivered" || d.status === "Approved").length;

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

  // ── PAGE 1 HEADER ─────────────────────────────────────────────────────────

  // Primary-color header band
  doc.rect(0, 0, pw, 108).fill(navy);
  // Thin accent divider below header
  doc.rect(0, 108, pw, 3).fill(accent);

  // Small branding label (top-left)
  doc.fontSize(6.5).font("Helvetica").fillColor(C.textSub)
    .text("CONVERGE EVENTS  ·  CONVERGE CONCIERGE", lm, 14, { characterSpacing: 0.4 });

  // Report title (large, white)
  doc.fontSize(20).font("Helvetica-Bold").fillColor(C.white)
    .text("Sponsorship Performance Report", lm, 28);

  // Sponsor · Level line
  doc.fontSize(9.5).font("Helvetica").fillColor(C.textSub)
    .text(`${data.sponsor.name}  ·  ${data.sponsor.level} Sponsor`, lm, 60);

  // Event name
  doc.fontSize(8).font("Helvetica").fillColor(C.textSub)
    .text(data.event.name, lm, 76);

  // Generated date
  doc.fontSize(7.5).font("Helvetica").fillColor(C.textSub)
    .text(
      `Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      lm, 92,
    );

  // Event logo — right side of header band
  if (data.event.logoBuffer) {
    try {
      doc.image(data.event.logoBuffer, pw - rm - 90, 12, {
        fit: [90, 84],
        align: "right",
        valign: "center",
      });
    } catch (_e) {
      // logo embed failed — skip silently
    }
  }

  let y = 126;

  // ── SECTION 1: EVENT & SPONSOR OVERVIEW ──────────────────────────────────

  y = drawSectionHeading(doc, y, lm, cw, "1  ·  EVENT & SPONSOR OVERVIEW", navy);

  const colW = (cw - 12) / 2;

  // Event card
  doc.rect(lm, y, colW, 80).fill(C.rowAlt).stroke(C.border);
  doc.rect(lm, y, colW, 3).fill(navy);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.textMid).text("EVENT", lm + 12, y + 10);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(C.text)
    .text(data.event.name, lm + 12, y + 22, { width: colW - 24, lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(C.textMid)
    .text(`Dates: ${data.event.dateRange}`, lm + 12, y + 40)
    .text(`Location: ${data.event.location}`, lm + 12, y + 55)
    .text(`Event Code: ${data.event.slug}`, lm + 12, y + 66);

  // Sponsor card
  const sx = lm + colW + 12;
  doc.rect(sx, y, colW, 80).fill(C.rowAlt).stroke(C.border);
  doc.rect(sx, y, colW, 3).fill(accent);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.textMid).text("SPONSOR", sx + 12, y + 10);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(C.text)
    .text(data.sponsor.name, sx + 12, y + 22, { width: colW - 24, lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(C.textMid)
    .text(`Sponsorship Level: ${data.sponsor.level}`, sx + 12, y + 40)
    .text(`Unique Companies Engaged: ${uniqueCompanies}`, sx + 12, y + 55)
    .text(`Meetings Scheduled: ${totalMeetings}`, sx + 12, y + 66);

  y += 96;

  // ── SECTION 2: SPONSORSHIP VALUE SUMMARY (NEW) ────────────────────────────

  y = drawSectionHeading(doc, y, lm, cw, "2  ·  SPONSORSHIP VALUE SUMMARY", navy);

  // 6 value metrics in 3-per-row layout
  const valueMetrics: [string, string][] = [
    ["Companies Engaged",       String(uniqueCompanies)],
    ["Meetings Scheduled",      String(totalMeetings)],
    ["Meetings Completed",      String(completed)],
    ["Information Requests",    String(infoRequests.length)],
    ["Total Engagement Actions", String(totalMeetings + infoRequests.length)],
    ["Deliverables Completed",  deliverables.length > 0 ? `${completedDeliverables} of ${deliverables.length}` : "N/A"],
  ];

  const vmCols   = 3;
  const vmGap    = 8;
  const vmW      = (cw - vmGap * (vmCols - 1)) / vmCols;
  const vmH      = 50;
  const vmRows   = Math.ceil(valueMetrics.length / vmCols);

  for (let i = 0; i < valueMetrics.length; i++) {
    const col = i % vmCols;
    const row = Math.floor(i / vmCols);
    const mx  = lm + col * (vmW + vmGap);
    const my  = y + row * (vmH + vmGap);
    drawMetricCard(doc, mx, my, vmW, vmH, valueMetrics[i][1], valueMetrics[i][0], navy, C);
  }

  y += vmRows * (vmH + vmGap) + 4;

  // Narrative paragraph
  const topChannel = online > onsite ? "online meetings" : onsite > 0 ? "onsite meetings" : "information requests";
  const narrativeLines = [
    `During the event engagement period, ${data.sponsor.name} connected with ${uniqueCompanies} unique ` +
    `financial institution${uniqueCompanies !== 1 ? "s" : ""} through ${totalMeetings} scheduled meeting${totalMeetings !== 1 ? "s" : ""} ` +
    `and ${infoRequests.length} information request${infoRequests.length !== 1 ? "s" : ""}. ` +
    `${completed} meeting${completed !== 1 ? "s were" : " was"} completed, and ` +
    (deliverables.length > 0
      ? `${completedDeliverables} of ${deliverables.length} sponsorship deliverables have been fulfilled. `
      : "") +
    (uniqueCompanies > 0 ? `The primary engagement channel was ${topChannel}.` : ""),
  ];

  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(narrativeLines[0], lm, y, { width: cw, lineGap: 2 });
  y += 38;

  // ── SECTION 3: SPONSORSHIP ACTIVITY SUMMARY ───────────────────────────────

  if (y + 80 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "3  ·  SPONSORSHIP ACTIVITY SUMMARY", navy);

  const activityMetrics: [string, string | number][] = [
    ["Meetings Scheduled",    totalMeetings],
    ["Meetings Completed",    completed],
    ["Confirmed / Scheduled", confirmed],
    ["Pending Online Req.",   pending],
    ["Cancelled / No-Show",   cancelled],
    ["Onsite Meetings",       onsite],
    ["Online Meetings",       online],
    ["Unique Companies",      uniqueCompanies],
    ["Info Requests Received",infoRequests.length],
    ["Unique Contacts",       leadMap.size],
    ["Profile Views",         analytics.profileViews],
    ["Meeting CTA Clicks",    analytics.meetingCtaClicks],
  ];

  const amCols  = 4;
  const amGap   = 0;
  const amW     = cw / amCols;
  const amH     = 52;
  const amRows  = Math.ceil(activityMetrics.length / amCols);

  for (let i = 0; i < activityMetrics.length; i++) {
    const col = i % amCols;
    const row = Math.floor(i / amCols);
    const mx  = lm + col * amW;
    const my  = y + row * amH;
    const isAlt = (row + col) % 2 === 1;
    doc.rect(mx, my, amW, amH - 1).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);
    doc.rect(mx, my, amW, 3).fill(navy);
    doc.fontSize(17).font("Helvetica-Bold").fillColor(C.text)
      .text(String(activityMetrics[i][1]), mx + 8, my + 8, { width: amW - 16, lineBreak: false });
    doc.fontSize(7).font("Helvetica").fillColor(C.textMid)
      .text(activityMetrics[i][0], mx + 8, my + 33, { width: amW - 16, lineBreak: false });
  }

  y += amRows * amH + 16;

  // ── SECTION 4: SPONSORSHIP DELIVERABLES ──────────────────────────────────

  if (sortedCategories.length > 0) {
    if (y + 60 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "4  ·  SPONSORSHIP DELIVERABLES", navy);

    const dlvCols = [
      { label: "Deliverable",  w: 182 },
      { label: "Qty",          w: 36 },
      { label: "Owner",        w: 62 },
      { label: "Status",       w: 96 },
      { label: "Due",          w: 94 },
      { label: "Note",         w: 42 },
    ];
    const dlvTotal = dlvCols.reduce((s, c) => s + c.w, 0);
    const dlvScale = cw / dlvTotal;
    const dlvScaled = dlvCols.map((c) => ({ ...c, w: c.w * dlvScale }));

    const drawDlvHeader = (startY: number) => {
      doc.rect(lm, startY, cw, 18).fill(navy);
      let hx = lm;
      for (const { label, w } of dlvScaled) {
        doc.fontSize(7).font("Helvetica-Bold").fillColor(C.white)
          .text(label, hx + 5, startY + 5, { width: w - 10, lineBreak: false });
        hx += w;
      }
      return startY + 18;
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
        y = drawCategoryBar(doc, y, lm, cw, cat, accent);
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
        const sColor   = deliverableStatusColor(d.status, C);
        const hasNote  = !!d.sponsorFacingNote;

        let cx = lm;
        const rowCells: { text: string; bold?: boolean; color?: string }[] = [
          { text: d.deliverableName },
          { text: qtyLabel,   color: C.textMid },
          { text: d.ownerType, color: C.textMid },
          { text: d.status,   bold: true, color: sColor },
          { text: dueLabel,   color: C.textMid },
          { text: hasNote ? "Yes" : "—", color: hasNote ? accent : C.textMid },
        ];

        rowCells.forEach(({ text, bold, color }, j) => {
          const w = dlvScaled[j].w;
          doc.fontSize(7.5)
            .font(bold ? "Helvetica-Bold" : "Helvetica")
            .fillColor(color ?? C.text)
            .text(text, cx + 5, y + 6, { width: w - 10, lineBreak: false });
          cx += w;
        });

        y += DLV_ROW_H;
      });

      y += 5;
    }
    y += 10;
  }

  // ── SECTION 5: MEETING ACTIVITY ───────────────────────────────────────────

  if (y + 60 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "5  ·  MEETING ACTIVITY", navy);

  if (meetings.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor(C.textMid).text("No meetings recorded for this event.", lm, y + 6);
    y += 28;
  } else {
    const mtgCols = [
      { label: "Company",       w: 110 },
      { label: "Contact",       w: 96 },
      { label: "Title",         w: 90 },
      { label: "Meeting Type",  w: 70 },
      { label: "Date",          w: 58 },
      { label: "Status",        w: 88 },
    ];
    const mtgTotal = mtgCols.reduce((s, c) => s + c.w, 0);
    const mtgScale = cw / mtgTotal;
    const mtgScaled = mtgCols.map((c) => ({ ...c, w: c.w * mtgScale }));

    const drawMtgHeader = (startY: number) => drawTableHeader(doc, startY, lm, navy, mtgScaled);

    y = drawMtgHeader(y);

    const sortedMeetings = [...meetings].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
    const ROW_H = 20;

    sortedMeetings.forEach((m, i) => {
      if (y + ROW_H > contentBottom) {
        doc.addPage();
        y = 50;
        y = drawMtgHeader(y);
      }
      const isAlt = i % 2 === 1;
      doc.rect(lm, y, cw, ROW_H).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);

      const isOnline = m.meetingType === "online_request";
      const sColor   = meetingStatusColor(m.status, C);

      let cx = lm;
      const cells: { text: string; color?: string; bold?: boolean }[] = [
        { text: m.attendeeCompany },
        { text: m.attendeeName },
        { text: m.attendeeTitle,  color: C.textMid },
        { text: isOnline ? "Online" : "Onsite", color: C.textMid },
        { text: m.date,           color: C.textMid },
        { text: m.status,         bold: true, color: sColor },
      ];

      cells.forEach(({ text, color, bold }, j) => {
        const w = mtgScaled[j].w;
        doc.fontSize(7.5)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(color ?? C.text)
          .text(text, cx + 5, y + 6, { width: w - 10, lineBreak: false });
        cx += w;
      });

      y += ROW_H;
    });
    y += 14;
  }

  // ── SECTION 6: INFORMATION REQUESTS ──────────────────────────────────────

  if (infoRequests.length > 0) {
    if (y + 60 > contentBottom) { doc.addPage(); y = 50; }
    y = drawSectionHeading(doc, y, lm, cw, "6  ·  INFORMATION REQUESTS", navy);

    const irCols = [
      { label: "Name",    w: 104 },
      { label: "Company", w: 104 },
      { label: "Email",   w: 126 },
      { label: "Source",  w: 60 },
      { label: "Status",  w: 72 },
      { label: "Date",    w: 46 },
    ];
    const irTotal = irCols.reduce((s, c) => s + c.w, 0);
    const irScale = cw / irTotal;
    const irScaled = irCols.map((c) => ({ ...c, w: c.w * irScale }));

    const drawIrHeader = (startY: number) => drawTableHeader(doc, startY, lm, navy, irScaled);

    y = drawIrHeader(y);

    const ROW_H = 20;
    infoRequests.forEach((req, i) => {
      if (y + ROW_H > contentBottom) {
        doc.addPage();
        y = 50;
        y = drawIrHeader(y);
      }
      const isAlt = i % 2 === 1;
      doc.rect(lm, y, cw, ROW_H).fill(isAlt ? C.rowAlt : C.white).stroke(C.border);

      let cx = lm;
      const fullName = `${req.attendeeFirstName} ${req.attendeeLastName}`.trim();
      const dateStr  = new Date(req.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const sColor   = infoStatusColor(req.status, C);

      const cells: { text: string; color?: string; bold?: boolean }[] = [
        { text: fullName },
        { text: req.attendeeCompany },
        { text: req.attendeeEmail,  color: C.textMid },
        { text: req.source,         color: C.textMid },
        { text: req.status,         bold: true, color: sColor },
        { text: dateStr,            color: C.textMid },
      ];

      cells.forEach(({ text, color, bold }, j) => {
        const w = irScaled[j].w;
        doc.fontSize(7.5)
          .font(bold ? "Helvetica-Bold" : "Helvetica")
          .fillColor(color ?? C.text)
          .text(text, cx + 5, y + 6, { width: w - 10, lineBreak: false });
        cx += w;
      });

      y += ROW_H;
    });
    y += 14;
  }

  // ── FOOTER on every page ──────────────────────────────────────────────────

  const range = doc.bufferedPageRange();
  for (let p = 0; p < range.count; p++) {
    doc.switchToPage(p);
    doc.rect(0, ph - footerH, pw, footerH).fill("#F1F5F9");
    doc.rect(0, ph - footerH, pw, 1).fill(C.border);
    doc.fontSize(7).font("Helvetica").fillColor(C.textMid)
      .text(
        `Converge Events  ·  Converge Concierge Platform  ·  Confidential — Prepared for ${data.sponsor.name}`,
        lm, ph - footerH + 10,
        { lineBreak: false },
      );
    doc.fillColor(C.textMid)
      .text(
        `Page ${p + 1} of ${range.count}`,
        0, ph - footerH + 10,
        { align: "right", width: pw - rm },
      );
  }

  doc.end();
  return doc as unknown as Readable;
}
