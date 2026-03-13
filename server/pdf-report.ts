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

const CATEGORY_ORDER = [
  "Company Profile",
  "Event Production",
  "Event Participation",
  "Speaking & Content",
  "Meetings & Introductions",
  "Marketing & Branding",
  "Post-Event",
  "Post-Event Deliverables",
  "Compliance",
];

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

function meetingStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string; navy: string }): string {
  if (s === "Completed") return C.green;
  if (s === "Cancelled" || s === "NoShow") return C.red;
  if (s === "Pending") return C.amber;
  if (s === "Confirmed" || s === "Scheduled") return C.blue;
  return C.blue;
}

function deliverableStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string }): string {
  const lower = s.toLowerCase();
  if (lower === "completed" || lower === "complete" || lower === "delivered" || lower === "approved") return C.green;
  if (lower === "in progress" || lower === "scheduled") return C.blue;
  if (lower === "awaiting sponsor input" || lower === "awaiting sponsor" || lower === "overdue") return C.amber;
  if (lower === "issue identified" || lower === "blocked") return C.red;
  if (lower === "available after event" || lower === "not started" || lower === "pending") return C.gray;
  return C.gray;
}

function infoStatusColor(s: string, C: { blue: string; red: string; gray: string; amber: string; green: string }): string {
  if (s === "Closed") return C.gray;
  if (s === "Meeting Scheduled") return C.green;
  if (s === "Not Qualified") return C.gray;
  if (s === "Email Sent" || s === "Contacted") return C.blue;
  return C.blue;
}

function drawSectionHeading(doc: any, y: number, lm: number, cw: number, title: string, navy: string): number {
  const H = 26;
  doc.rect(lm, y, cw, H).fill("#F1F5F9");
  doc.rect(lm, y, 4, H).fill(navy);
  doc.fontSize(8.5).font("Helvetica-Bold").fillColor("#1E293B")
    .text(title, lm + 14, y + 8, { width: cw - 18, lineBreak: false });
  return y + H + 8;
}

function drawCategoryBar(doc: any, y: number, lm: number, cw: number, label: string, accent: string): number {
  const H = 18;
  doc.rect(lm, y, cw, H).fill("#F1F5F9");
  doc.rect(lm, y, 3, H).fill(accent);
  doc.fontSize(7).font("Helvetica-Bold").fillColor(accent)
    .text(label.toUpperCase(), lm + 10, y + 5, { width: cw - 14, lineBreak: false });
  return y + H;
}

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

function drawMetricCard(doc: any, mx: number, my: number, w: number, h: number, value: string, label: string, navy: string, C: any): void {
  doc.rect(mx, my, w, h).fill(C.white).stroke(C.border);
  doc.rect(mx, my, w, 3).fill(navy);
  doc.fontSize(18).font("Helvetica-Bold").fillColor(C.text)
    .text(value, mx + 8, my + 10, { width: w - 16, align: "left", lineBreak: false });
  doc.fontSize(7).font("Helvetica").fillColor(C.textMid)
    .text(label, mx + 8, my + 34, { width: w - 16, lineBreak: false });
}

function drawStatusBadge(doc: any, text: string, x: number, y: number, w: number, color: string, bgColor: string): void {
  const textW = doc.fontSize(6.5).font("Helvetica-Bold").widthOfString(text);
  const badgeW = Math.min(textW + 12, w - 4);
  const badgeH = 14;
  const badgeX = x + 2;
  const badgeY = y + 3;
  doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 3).fill(bgColor);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(color)
    .text(text, badgeX + 6, badgeY + 3, { width: badgeW - 12, lineBreak: false });
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.substring(0, 2), 16),
    g: parseInt(h.substring(2, 4), 16),
    b: parseInt(h.substring(4, 6), 16),
  };
}

function lightenHex(hex: string, factor: number): string {
  const { r, g, b } = hexToRgb(hex);
  const lr = Math.round(r + (255 - r) * factor);
  const lg = Math.round(g + (255 - g) * factor);
  const lb = Math.round(b + (255 - b) * factor);
  return `#${lr.toString(16).padStart(2, "0")}${lg.toString(16).padStart(2, "0")}${lb.toString(16).padStart(2, "0")}`;
}

function deliverableBadgeBg(s: string): string {
  const lower = s.toLowerCase();
  if (lower === "completed" || lower === "complete" || lower === "delivered" || lower === "approved") return "#DCFCE7";
  if (lower === "in progress" || lower === "scheduled") return "#DBEAFE";
  if (lower === "awaiting sponsor input" || lower === "awaiting sponsor" || lower === "overdue") return "#FEF3C7";
  if (lower === "issue identified" || lower === "blocked") return "#FEE2E2";
  return "#F1F5F9";
}

function drawPieChart(
  doc: any,
  cx: number,
  cy: number,
  radius: number,
  slices: { label: string; value: number; color: string }[],
  title: string,
  navy: string,
  C: any,
): number {
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text)
    .text(title, cx - radius - 10, cy - radius - 18, { width: radius * 2 + 20, align: "center" });

  if (total === 0) {
    doc.circle(cx, cy, radius).fill("#F1F5F9");
    doc.fontSize(7.5).font("Helvetica").fillColor(C.gray)
      .text("No meeting data", cx - 40, cy - 5, { width: 80, align: "center" });
    return cy + radius + 14;
  }

  let startAngle = -Math.PI / 2;
  for (const slice of slices) {
    if (slice.value === 0) continue;
    const sliceAngle = (slice.value / total) * 2 * Math.PI;
    const endAngle = startAngle + sliceAngle;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    const largeArc = sliceAngle > Math.PI ? 1 : 0;

    if (slices.filter(s => s.value > 0).length === 1) {
      doc.circle(cx, cy, radius).fill(slice.color);
    } else {
      doc.save();
      doc.path(`M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`)
        .fill(slice.color);
      doc.restore();
    }
    startAngle = endAngle;
  }

  doc.circle(cx, cy, radius * 0.35).fill("#FFFFFF");

  let legendY = cy - radius;
  const legendX = cx + radius + 16;
  for (const slice of slices) {
    if (slice.value === 0) continue;
    const pct = Math.round((slice.value / total) * 100);
    doc.rect(legendX, legendY + 2, 8, 8).fill(slice.color);
    doc.fontSize(7).font("Helvetica").fillColor(C.text)
      .text(`${slice.label}: ${slice.value} (${pct}%)`, legendX + 12, legendY + 2, { width: 140, lineBreak: false });
    legendY += 14;
  }

  return cy + radius + 14;
}

function drawBarChart(
  doc: any,
  x: number,
  y: number,
  chartW: number,
  bars: { label: string; value: number }[],
  title: string,
  barColor: string,
  C: any,
): number {
  const maxVal = Math.max(...bars.map(b => b.value), 1);
  const barH = 18;
  const barGap = 6;
  const labelW = 110;
  const valueW = 36;
  const barAreaW = chartW - labelW - valueW - 10;

  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text)
    .text(title, x, y, { width: chartW });
  y += 18;

  for (const bar of bars) {
    const filledW = maxVal > 0 ? (bar.value / maxVal) * barAreaW : 0;

    doc.fontSize(7).font("Helvetica").fillColor(C.textMid)
      .text(bar.label, x, y + 4, { width: labelW - 6, lineBreak: false, align: "right" });

    doc.roundedRect(x + labelW, y + 2, barAreaW, barH - 4, 2).fill("#F1F5F9");
    if (filledW > 2) {
      doc.roundedRect(x + labelW, y + 2, filledW, barH - 4, 2).fill(barColor);
    }

    doc.fontSize(7).font("Helvetica-Bold").fillColor(C.text)
      .text(String(bar.value), x + labelW + barAreaW + 6, y + 4, { width: valueW, lineBreak: false });

    y += barH + barGap;
  }

  return y + 4;
}


export function buildSponsorReportPDF(data: SponsorReportData): Readable {
  const doc = new PDFDocument({ size: "LETTER", margin: 0, autoFirstPage: true, bufferPages: true });

  const pw  = doc.page.width;
  const ph  = doc.page.height;
  const lm  = 50;
  const rm  = 50;
  const cw  = pw - lm - rm;
  const footerH = 28;
  const contentBottom = ph - footerH - 14;

  const navy   = data.event.primaryColor  || "#0D1E3A";
  const accent = data.event.accentColor   || "#0D9488";

  const C = {
    navy,
    accent,
    text:     "#1E293B",
    textMid:  "#475569",
    textSub:  "#94A3B8",
    border:   "#E2E8F0",
    rowAlt:   "#F8FAFC",
    white:    "#FFFFFF",
    green:    "#16A34A",
    blue:     "#2563EB",
    amber:    "#D97706",
    red:      "#DC2626",
    gray:     "#64748B",
  };

  const { meetings, infoRequests, deliverables, analytics } = data;

  const totalMeetings  = meetings.length;
  const completed      = meetings.filter((m) => m.status === "Completed").length;
  const cancelled      = meetings.filter((m) => m.status === "Cancelled" || m.status === "NoShow").length;
  const scheduled      = meetings.filter((m) => m.status === "Confirmed" || m.status === "Scheduled").length;
  const onsite         = meetings.filter((m) => m.meetingType !== "online_request").length;
  const online         = meetings.filter((m) => m.meetingType === "online_request").length;

  const companySet = new Set<string>();
  for (const m of meetings) { if (m.attendeeCompany) companySet.add(m.attendeeCompany.trim()); }
  for (const r of infoRequests) { if (r.attendeeCompany) companySet.add(r.attendeeCompany.trim()); }
  const uniqueCompanies = companySet.size;

  const completedDeliverables = deliverables.filter((d) => {
    const lower = d.status.toLowerCase();
    return lower === "completed" || lower === "complete" || lower === "delivered" || lower === "approved";
  }).length;

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

  doc.rect(0, 0, pw, 108).fill(navy);
  doc.rect(0, 108, pw, 3).fill(accent);

  doc.fontSize(6.5).font("Helvetica").fillColor(C.textSub)
    .text("CONVERGE EVENTS  ·  CONVERGE CONCIERGE", lm, 14, { characterSpacing: 0.4 });

  doc.fontSize(20).font("Helvetica-Bold").fillColor(C.white)
    .text("Sponsorship Performance Report", lm, 28);

  doc.fontSize(9.5).font("Helvetica").fillColor(C.textSub)
    .text(`${data.sponsor.name}  ·  ${data.sponsor.level} Sponsor`, lm, 60);

  doc.fontSize(8).font("Helvetica").fillColor(C.textSub)
    .text(data.event.name, lm, 76);

  doc.fontSize(7.5).font("Helvetica").fillColor(C.textSub)
    .text(
      `Generated: ${data.generatedAt.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`,
      lm, 92,
    );

  if (data.event.logoBuffer) {
    try {
      doc.image(data.event.logoBuffer, pw - rm - 90, 12, {
        fit: [90, 84],
        align: "right",
        valign: "center",
      });
    } catch (_e) { /* skip */ }
  }

  let y = 126;

  // ── SECTION 1: EVENT & SPONSOR OVERVIEW ──────────────────────────────────

  y = drawSectionHeading(doc, y, lm, cw, "1  ·  EVENT & SPONSOR OVERVIEW", navy);

  const colW = (cw - 12) / 2;

  doc.rect(lm, y, colW, 80).fill(C.rowAlt).stroke(C.border);
  doc.rect(lm, y, colW, 3).fill(navy);
  doc.fontSize(6.5).font("Helvetica-Bold").fillColor(C.textMid).text("EVENT", lm + 12, y + 10);
  doc.fontSize(9.5).font("Helvetica-Bold").fillColor(C.text)
    .text(data.event.name, lm + 12, y + 22, { width: colW - 24, lineBreak: false });
  doc.fontSize(8).font("Helvetica").fillColor(C.textMid)
    .text(`Dates: ${data.event.dateRange}`, lm + 12, y + 40)
    .text(`Location: ${data.event.location}`, lm + 12, y + 55)
    .text(`Event Code: ${data.event.slug}`, lm + 12, y + 66);

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

  // ── SECTION 2: SPONSORSHIP VALUE SUMMARY ────────────────────────────────

  y = drawSectionHeading(doc, y, lm, cw, "2  ·  SPONSORSHIP VALUE SUMMARY", navy);

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

  const topChannel = online > onsite ? "online meetings" : onsite > 0 ? "onsite meetings" : "information requests";
  const narrativeText =
    `During the event engagement period, ${data.sponsor.name} connected with ${uniqueCompanies} unique ` +
    `financial institution${uniqueCompanies !== 1 ? "s" : ""} through ${totalMeetings} scheduled meeting${totalMeetings !== 1 ? "s" : ""} ` +
    `and ${infoRequests.length} information request${infoRequests.length !== 1 ? "s" : ""}. ` +
    `${completed} meeting${completed !== 1 ? "s were" : " was"} completed` +
    (deliverables.length > 0 ? `, and ${completedDeliverables} of ${deliverables.length} sponsorship deliverables have been fulfilled` : "") +
    `. The primary engagement channel was ${topChannel}.`;

  doc.fontSize(8.5).font("Helvetica").fillColor(C.textMid)
    .text(narrativeText, lm, y, { width: cw, lineGap: 2 });
  y += doc.heightOfString(narrativeText, { width: cw, lineGap: 2 }) + 12;

  // ── SECTION 3: SPONSORSHIP ACTIVITY SUMMARY (SIMPLIFIED + CHARTS) ──────

  if (y + 220 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "3  ·  SPONSORSHIP ACTIVITY SUMMARY", navy);

  // A. Clean KPI row — 5 cards
  const kpiMetrics: [string, string][] = [
    ["Meetings Scheduled", String(totalMeetings)],
    ["Meetings Completed", String(completed)],
    ["Information Requests", String(infoRequests.length)],
    ["Profile Views", String(analytics.profileViews)],
    ["Unique Companies", String(uniqueCompanies)],
  ];

  const kpiCols = 5;
  const kpiGap  = 6;
  const kpiW    = (cw - kpiGap * (kpiCols - 1)) / kpiCols;
  const kpiH    = 50;

  for (let i = 0; i < kpiMetrics.length; i++) {
    const mx = lm + i * (kpiW + kpiGap);
    drawMetricCard(doc, mx, y, kpiW, kpiH, kpiMetrics[i][1], kpiMetrics[i][0], navy, C);
  }

  y += kpiH + 16;

  // B. Charts row — Pie chart (left) + Engagement Funnel (right)

  const chartRowStartY = y;
  const chartHalfW = (cw - 20) / 2;

  // Pie chart: Meeting Status Distribution
  const pieSlices = [
    { label: "Completed", value: completed, color: C.green },
    { label: "Scheduled", value: scheduled, color: navy },
    { label: "Cancelled / No-Show", value: cancelled, color: "#CBD5E1" },
  ];

  const pieRadius = 46;
  const pieCx = lm + pieRadius + 10;
  const pieCy = y + pieRadius + 20;

  const pieEndY = drawPieChart(doc, pieCx, pieCy, pieRadius, pieSlices, "Meeting Status Distribution", navy, C);

  // Sponsor Engagement Outcomes (right side)
  const engX = lm + chartHalfW + 20;

  doc.fontSize(8).font("Helvetica-Bold").fillColor(C.text)
    .text("Sponsor Engagement Outcomes", engX, y, { width: chartHalfW });
  doc.fontSize(6.5).font("Helvetica").fillColor(C.textMid)
    .text("Meetings and information requests are the most meaningful engagement signals.", engX, y + 12, { width: chartHalfW });

  const engCardY = y + 28;
  const engCardW = (chartHalfW - 8) / 2;
  const engCardH = 46;

  // Primary outcome cards — Meetings Scheduled + Information Requests
  drawMetricCard(doc, engX, engCardY, engCardW, engCardH, String(totalMeetings), "Meetings Scheduled", navy, C);
  drawMetricCard(doc, engX + engCardW + 8, engCardY, engCardW, engCardH, String(infoRequests.length), "Information Requests", navy, C);

  // Secondary interest signals — smaller muted bar chart
  const sigY = engCardY + engCardH + 12;
  doc.fontSize(7).font("Helvetica-Bold").fillColor(C.textMid)
    .text("INTEREST SIGNALS", engX, sigY, { width: chartHalfW });

  const sigBarY = sigY + 12;
  const sigLabelW = 100;
  const sigBarAreaW = chartHalfW - sigLabelW - 30;
  const sigBarH = 14;
  const sigGap = 4;
  const sigColor = "#CBD5E1";
  const sigMaxVal = Math.max(analytics.profileViews, analytics.meetingCtaClicks, 1);

  const sigBars = [
    { label: "Profile Page Views", value: analytics.profileViews },
    { label: "Meeting Button Clicks", value: analytics.meetingCtaClicks },
  ];

  let sigCurY = sigBarY;
  for (const bar of sigBars) {
    const filledW = sigMaxVal > 0 ? (bar.value / sigMaxVal) * sigBarAreaW : 0;

    doc.fontSize(6.5).font("Helvetica").fillColor(C.textMid)
      .text(bar.label, engX, sigCurY + 2, { width: sigLabelW - 4, lineBreak: false, align: "right" });

    doc.roundedRect(engX + sigLabelW, sigCurY, sigBarAreaW, sigBarH, 2).fill("#F1F5F9");
    if (filledW > 2) {
      doc.roundedRect(engX + sigLabelW, sigCurY, filledW, sigBarH, 2).fill(sigColor);
    }

    doc.fontSize(6.5).font("Helvetica").fillColor(C.textMid)
      .text(String(bar.value), engX + sigLabelW + sigBarAreaW + 4, sigCurY + 2, { width: 24, lineBreak: false });

    sigCurY += sigBarH + sigGap;
  }

  const engEndY = sigCurY + 4;

  y = Math.max(pieEndY, engEndY) + 8;

  // Optional insight line
  if (totalMeetings > 0 || infoRequests.length > 0) {
    const insightText = `This sponsor generated ${completed} completed meeting${completed !== 1 ? "s" : ""} and ${infoRequests.length} information request${infoRequests.length !== 1 ? "s" : ""} from ${uniqueCompanies} unique compan${uniqueCompanies !== 1 ? "ies" : "y"} during the event cycle.`;
    doc.fontSize(7.5).font("Helvetica").fillColor(C.textMid)
      .text(insightText, lm, y, { width: cw, align: "center" });
    y += 18;
  }

  y += 6;

  // ── SECTION 4: SPONSORSHIP DELIVERABLES ──────────────────────────────────

  if (y + 60 > contentBottom) { doc.addPage(); y = 50; }
  y = drawSectionHeading(doc, y, lm, cw, "4  ·  SPONSORSHIP DELIVERABLES", navy);

  if (sortedCategories.length === 0) {
    doc.fontSize(9).font("Helvetica").fillColor(C.textMid)
      .text("No deliverables configured for this sponsorship.", lm, y + 6);
    y += 28;
  } else {

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
        const sBgColor = deliverableBadgeBg(d.status);
        const hasNote  = !!d.sponsorFacingNote;

        let cx = lm;
        const statusColIdx = 3;

        [
          { text: d.deliverableName },
          { text: qtyLabel, color: C.textMid },
          { text: d.ownerType, color: C.textMid },
          null,
          { text: dueLabel, color: C.textMid },
          { text: hasNote ? "Yes" : "—", color: hasNote ? accent : C.textMid },
        ].forEach((cell, j) => {
          const w = dlvScaled[j].w;
          if (j === statusColIdx) {
            drawStatusBadge(doc, d.status, cx, y, w, sColor, sBgColor);
          } else if (cell) {
            doc.fontSize(7.5)
              .font("Helvetica")
              .fillColor(cell.color ?? C.text)
              .text(cell.text, cx + 5, y + 6, { width: w - 10, lineBreak: false });
          }
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
