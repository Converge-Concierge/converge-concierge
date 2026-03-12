import { db } from "../server/db";
import {
  users, events, sponsors, attendees, meetings,
  informationRequests, agreementDeliverables, sponsorTokens,
  emailLogs, sponsorNotifications, sponsorAnalytics,
  agreementDeliverableRegistrants, agreementDeliverableSpeakers,
  deliverableLinks, deliverableSocialEntries, agreementDeliverableReminders,
  backupJobs, fileAssets, passwordResetTokens, sponsorUsers,
  sponsorLoginTokens, dataExchangeLogs, userPermissions, permissionAuditLogs,
  agreementPackageTemplates, agreementDeliverableTemplateItems,
} from "../shared/schema";
import type {
  MeetingLocation, MeetingTimeBlock, EventSponsorLink,
} from "../shared/schema";
import { sql } from "drizzle-orm";
import { randomUUID } from "crypto";

if (process.env.APP_ENV !== "demo" && !process.argv.includes("--force")) {
  console.error("[SEED] ABORTED — this script only runs when APP_ENV=demo (use --force to override)");
  process.exit(1);
}

const EVENT_NAMES = [
  { name: "Converge 2026 — New York", slug: "NYC2026", location: "Javits Center, New York, NY", start: "2026-06-15", end: "2026-06-17" },
  { name: "Converge 2026 — London", slug: "LON2026", location: "ExCeL London, London, UK", start: "2026-09-22", end: "2026-09-24" },
  { name: "FinTech Connect 2026", slug: "FTC2026", location: "Moscone Center, San Francisco, CA", start: "2026-11-03", end: "2026-11-05" },
];

function buildMeetingLocations(): MeetingLocation[] {
  return [
    { id: randomUUID(), name: "Meeting Room A", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "Meeting Room B", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "Lounge Table 1", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "Lounge Table 2", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "Executive Suite", allowedSponsorLevels: ["Platinum", "Gold"] },
  ];
}

function buildMeetingBlocks(startDate: string): MeetingTimeBlock[] {
  const dates = [startDate];
  const d = new Date(startDate);
  d.setDate(d.getDate() + 1);
  dates.push(d.toISOString().slice(0, 10));
  d.setDate(d.getDate() + 1);
  dates.push(d.toISOString().slice(0, 10));

  const blocks: MeetingTimeBlock[] = [];
  for (const date of dates) {
    blocks.push(
      { id: randomUUID(), date, startTime: "09:00", endTime: "09:30", locationIds: [] },
      { id: randomUUID(), date, startTime: "09:45", endTime: "10:15", locationIds: [] },
      { id: randomUUID(), date, startTime: "10:30", endTime: "11:00", locationIds: [] },
      { id: randomUUID(), date, startTime: "11:15", endTime: "11:45", locationIds: [] },
      { id: randomUUID(), date, startTime: "13:15", endTime: "13:45", locationIds: [] },
      { id: randomUUID(), date, startTime: "14:00", endTime: "14:30", locationIds: [] },
      { id: randomUUID(), date, startTime: "14:45", endTime: "15:15", locationIds: [] },
      { id: randomUUID(), date, startTime: "15:30", endTime: "16:00", locationIds: [] },
      { id: randomUUID(), date, startTime: "16:15", endTime: "16:45", locationIds: [] },
    );
  }
  return blocks;
}

const SPONSOR_DATA = [
  { name: "Meridian Capital Partners", level: "Platinum", shortDescription: "Global investment banking and financial advisory services.", contactName: "Victoria Chen", contactEmail: "vchen@meridiancap.com" },
  { name: "Apex Payments", level: "Platinum", shortDescription: "Enterprise payment processing and digital wallet infrastructure.", contactName: "James Hartwell", contactEmail: "j.hartwell@apexpay.io" },
  { name: "BlueStar Analytics", level: "Gold", shortDescription: "AI-driven market intelligence and predictive analytics platform.", contactName: "Priya Sharma", contactEmail: "priya@bluestaranalytics.com" },
  { name: "TrustBridge Security", level: "Gold", shortDescription: "Cybersecurity and fraud prevention for financial institutions.", contactName: "Marcus Webb", contactEmail: "mwebb@trustbridge.com" },
  { name: "NexGen Compliance", level: "Gold", shortDescription: "Regulatory compliance automation and reporting solutions.", contactName: "Sarah Mitchell", contactEmail: "smitchell@nexgencompliance.com" },
  { name: "Quantum Ledger", level: "Silver", shortDescription: "Distributed ledger technology for institutional settlement.", contactName: "David Park", contactEmail: "dpark@quantumledger.io" },
  { name: "Horizon Wealth Tech", level: "Silver", shortDescription: "Digital wealth management and robo-advisory platform.", contactName: "Elena Rodriguez", contactEmail: "elena@horizonwt.com" },
  { name: "CloudVault Financial", level: "Silver", shortDescription: "Cloud-native core banking infrastructure.", contactName: "Tom Nakamura", contactEmail: "tnakamura@cloudvault.finance" },
  { name: "Pinnacle Risk Solutions", level: "Bronze", shortDescription: "Enterprise risk management and stress testing tools.", contactName: "Angela Foster", contactEmail: "afoster@pinnaclerisk.com" },
  { name: "DataStream Markets", level: "Bronze", shortDescription: "Real-time market data feeds and trading analytics.", contactName: "Robert Chang", contactEmail: "rchang@datastreammarkets.com" },
  { name: "GreenLedger ESG", level: "Bronze", shortDescription: "ESG scoring and sustainable finance reporting platform.", contactName: "Olivia Dupont", contactEmail: "odupont@greenledger.co" },
  { name: "FinOps Automation", level: "Bronze", shortDescription: "Cloud cost management and FinOps tooling for enterprises.", contactName: "Kevin O'Brien", contactEmail: "kobrien@finopsauto.com" },
];

const FIRST_NAMES = [
  "Alexander", "Maria", "Chen", "Aisha", "William", "Sophia", "Raj", "Emma", "Takeshi",
  "Isabella", "Oluwaseun", "Charlotte", "Dmitri", "Fatima", "Lucas", "Hannah", "Arjun",
  "Grace", "Mohammed", "Zoe", "Nathan", "Camille", "Sanjay", "Emily", "Pierre",
  "Yuki", "Michael", "Ananya", "Oscar", "Layla", "Daniel", "Sofia", "Ibrahim",
  "Nadia", "Thomas", "Mei", "Benjamin", "Aaliya", "Patrick", "Diana",
  "Christopher", "Valentina", "Hiroshi", "Ava", "Carlos", "Freya", "Vincent",
  "Amara", "Sebastian", "Leila", "Gabriel", "Chloe", "Fernando", "Isla",
  "Andrei", "Miriam", "Joshua", "Sana", "Rafael", "Eloise",
  "Samuel", "Priya", "Noah", "Carmen", "Leo", "Ingrid",
  "Omar", "Astrid", "Ryan", "Keira", "Ethan", "Catalina",
  "Hugo", "Simone", "Dylan", "Lena", "Jack", "Riya",
  "Felix", "Julia",
];

const LAST_NAMES = [
  "Whitmore", "Fernandez", "Okonkwo", "Nakamura", "Patel", "Morrison", "Kim",
  "Andersson", "El-Masri", "Beaumont", "Chandrasekaran", "O'Sullivan",
  "Volkov", "Davenport", "Hashimoto", "Sinclair", "Mbeki", "Petrov",
  "Carmichael", "Nguyen", "Blackwell", "Moreau", "Tanaka", "Fitzgerald",
  "Vasquez", "Bergström", "Adebayo", "Fischer", "Ramirez", "Chandra",
  "Thornton", "Sato", "Mikkelsen", "Goldstein", "Haddad", "Kovalenko",
  "Brennan", "Yamamoto", "Johansson", "Abdi",
  "Wellington", "Garcia", "Ishikawa", "Lindberg", "Osei",
  "Castellano", "Kumar", "Novak", "Ashworth", "Dubois",
  "Steinberg", "Miyamoto", "Olsen", "Mehta", "Callahan",
  "Rossi", "Schmidt", "Alonso", "Kwon", "Bakker",
  "Reed", "Bjork", "Ito", "Malone", "Sharma",
  "Torres", "Weber", "Hassan", "Blake", "Suzuki",
  "Madsen", "Basu", "Hayes", "Kato", "Russo",
  "Cho", "Palmer", "Joshi", "Meyer", "Cruz",
];

const COMPANIES = [
  "JPMorgan Chase", "Goldman Sachs", "Barclays", "Deutsche Bank", "HSBC",
  "Morgan Stanley", "Citigroup", "BNP Paribas", "UBS", "Credit Suisse",
  "BlackRock", "Fidelity Investments", "Vanguard Group", "State Street",
  "Stripe", "Square Financial", "Adyen", "Wise (TransferWise)", "Revolut",
  "Plaid", "Marqeta", "Green Dot", "SoFi Technologies", "Robinhood",
  "Coinbase", "Chainalysis", "Ripple Labs", "Circle Financial",
  "Mastercard", "Visa Inc.", "American Express", "PayPal",
  "Capital One", "Ally Financial", "Wells Fargo", "Bank of America",
  "Charles Schwab", "TD Ameritrade", "Interactive Brokers", "Betterment",
];

const TITLES = [
  "Chief Technology Officer", "VP of Engineering", "Head of Digital Transformation",
  "Chief Information Officer", "Director of FinTech Strategy",
  "SVP, Product Management", "Head of Innovation", "Chief Data Officer",
  "VP of Business Development", "Managing Director", "Head of Partnerships",
  "Chief Risk Officer", "Director of Compliance", "VP of Operations",
  "Head of Capital Markets Technology", "Chief Product Officer",
  "Director of Quantitative Research", "SVP, Digital Banking",
  "Head of Payments Infrastructure", "Chief Marketing Officer",
];

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

function randomEmail(first: string, last: string, company: string): string {
  const sanitized = company.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 12);
  return `${first.toLowerCase()}.${last.toLowerCase()}@${sanitized}.com`;
}

async function clearAllData() {
  console.log("[SEED] Clearing existing data...");
  await db.delete(agreementDeliverableReminders);
  await db.delete(deliverableSocialEntries);
  await db.delete(deliverableLinks);
  await db.delete(agreementDeliverableSpeakers);
  await db.delete(agreementDeliverableRegistrants);
  await db.delete(agreementDeliverables);
  await db.delete(agreementDeliverableTemplateItems);
  await db.delete(agreementPackageTemplates);
  await db.delete(fileAssets);
  await db.delete(emailLogs);
  await db.delete(sponsorAnalytics);
  await db.delete(informationRequests);
  await db.delete(meetings);
  await db.delete(sponsorNotifications);
  await db.delete(sponsorLoginTokens);
  await db.delete(sponsorUsers);
  await db.delete(sponsorTokens);
  await db.delete(dataExchangeLogs);
  await db.delete(attendees);
  await db.delete(sponsors);
  await db.delete(events);
  await db.delete(permissionAuditLogs);
  await db.delete(userPermissions);
  await db.delete(passwordResetTokens);
  await db.delete(backupJobs);
  await db.delete(users);
  console.log("[SEED] All data cleared.");
}

async function seedUsers() {
  console.log("[SEED] Creating users...");
  const created = [];
  created.push(
    (await db.insert(users).values({ name: "Demo Admin", email: "admin@converge.com", password: "password", role: "admin", isActive: true }).returning())[0]
  );
  created.push(
    (await db.insert(users).values({ name: "Sarah Manager", email: "manager@converge.com", password: "password", role: "manager", isActive: true }).returning())[0]
  );
  console.log(`[SEED] Created ${created.length} users.`);
  return created;
}

async function seedEvents() {
  console.log("[SEED] Creating events...");
  const created = [];
  for (const evt of EVENT_NAMES) {
    const locations = buildMeetingLocations();
    const blocks = buildMeetingBlocks(evt.start);
    const [row] = await db.insert(events).values({
      name: evt.name,
      slug: evt.slug,
      location: evt.location,
      startDate: new Date(evt.start),
      endDate: new Date(evt.end),
      meetingLocations: locations,
      meetingBlocks: blocks,
      schedulingEnabled: true,
      primaryColor: "#1a365d",
      secondaryColor: "#2d3748",
      accentColor: "#3182ce",
      buttonColor: "#2b6cb0",
      bgAccentColor: "#ebf4ff",
    }).returning();
    created.push(row);
  }
  console.log(`[SEED] Created ${created.length} events.`);
  return created;
}

async function seedSponsors(eventIds: string[]) {
  console.log("[SEED] Creating sponsors...");
  const created = [];
  for (const sp of SPONSOR_DATA) {
    const assignedEvents: EventSponsorLink[] = pickN(eventIds, Math.random() > 0.3 ? 2 : 1).map(eid => ({
      eventId: eid,
      sponsorshipLevel: sp.level as "Platinum" | "Gold" | "Silver" | "Bronze",
      archiveState: "active" as const,
      archiveSource: null,
      onsiteMeetingEnabled: true,
      onlineMeetingEnabled: Math.random() > 0.5,
      informationRequestEnabled: true,
      useDefaultBlocks: true,
      selectedBlockIds: [],
    }));
    const [row] = await db.insert(sponsors).values({
      name: sp.name,
      level: sp.level as "Platinum" | "Gold" | "Silver" | "Bronze",
      shortDescription: sp.shortDescription,
      contactName: sp.contactName,
      contactEmail: sp.contactEmail,
      assignedEvents,
      allowOnlineMeetings: Math.random() > 0.5,
      websiteUrl: `https://www.${sp.name.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
      attributes: pickN(["AI/ML", "Payments", "RegTech", "Blockchain", "Cloud", "Data Analytics", "Cybersecurity", "ESG"], 3),
    }).returning();
    created.push(row);
  }
  console.log(`[SEED] Created ${created.length} sponsors.`);
  return created;
}

async function seedAttendees(eventIds: string[]) {
  console.log("[SEED] Creating attendees...");
  const created = [];
  const usedEmails = new Set<string>();
  for (let i = 0; i < 80; i++) {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const company = COMPANIES[i % COMPANIES.length];
    let email = randomEmail(firstName, lastName, company);
    let attempt = 0;
    while (usedEmails.has(email)) {
      attempt++;
      email = randomEmail(firstName, `${lastName}${attempt}`, company);
    }
    usedEmails.add(email);
    const eventId = pick(eventIds);
    const [row] = await db.insert(attendees).values({
      firstName,
      lastName,
      name: `${firstName} ${lastName}`,
      company,
      title: pick(TITLES),
      email,
      assignedEvent: eventId,
      interests: pickN(["AI/ML", "Payments", "Risk Management", "Digital Banking", "Blockchain", "RegTech", "ESG", "Cloud Infrastructure"], 3),
    }).returning();
    created.push(row);
  }
  console.log(`[SEED] Created ${created.length} attendees.`);
  return created;
}

async function seedMeetings(
  eventRows: { id: string; slug: string; startDate: Date; endDate: Date }[],
  sponsorRows: { id: string; assignedEvents: EventSponsorLink[] }[],
  attendeeRows: { id: string; assignedEvent: string }[],
) {
  console.log("[SEED] Creating meetings...");
  const created = [];
  const statuses = ["Scheduled", "Confirmed", "Completed", "Pending"] as const;
  for (const evt of eventRows) {
    const evtAttendees = attendeeRows.filter(a => a.assignedEvent === evt.id);
    const evtSponsors = sponsorRows.filter(s => s.assignedEvents.some(ae => ae.eventId === evt.id));

    const meetingCount = Math.min(evtAttendees.length, evtSponsors.length * 3, 25);
    for (let i = 0; i < meetingCount; i++) {
      const sponsor = evtSponsors[i % evtSponsors.length];
      const attendee = evtAttendees[i % evtAttendees.length];
      const dayOffset = Math.floor(Math.random() * 3);
      const date = new Date(evt.startDate);
      date.setDate(date.getDate() + dayOffset);
      const block = pick(MEETING_BLOCKS);
      const location = pick(MEETING_LOCATIONS);

      const [row] = await db.insert(meetings).values({
        eventId: evt.id,
        sponsorId: sponsor.id,
        attendeeId: attendee.id,
        date: date.toISOString().slice(0, 10),
        time: block.startTime,
        location: location.name,
        status: pick([...statuses]),
        source: Math.random() > 0.3 ? "admin" : "public",
      }).returning();
      created.push(row);
    }
  }
  console.log(`[SEED] Created ${created.length} meetings.`);
  return created;
}

async function seedInfoRequests(
  eventRows: { id: string }[],
  sponsorRows: { id: string; assignedEvents: EventSponsorLink[] }[],
  attendeeRows: { id: string; assignedEvent: string; firstName: string; lastName: string; email: string; company: string; title: string }[],
) {
  console.log("[SEED] Creating information requests...");
  const created = [];
  const messages = [
    "Interested in learning more about your payment processing solutions.",
    "Would like to schedule a detailed product demo for our team.",
    "Looking for compliance automation tools — can we set up a call?",
    "Our firm is evaluating new risk management platforms. Please share pricing.",
    "We'd like to discuss a potential integration partnership.",
    "Can you provide case studies relevant to mid-size banks?",
    "Interested in your ESG reporting capabilities.",
    "Need real-time market data feeds for our trading desk.",
  ];
  const irStatuses = ["New", "Contacted", "Qualified", "Closed"] as const;

  for (let i = 0; i < 20; i++) {
    const attendee = pick(attendeeRows);
    const evtSponsors = sponsorRows.filter(s => s.assignedEvents.some(ae => ae.eventId === attendee.assignedEvent));
    if (evtSponsors.length === 0) continue;
    const sponsor = pick(evtSponsors);
    const [row] = await db.insert(informationRequests).values({
      eventId: attendee.assignedEvent,
      sponsorId: sponsor.id,
      attendeeId: attendee.id,
      attendeeFirstName: attendee.firstName,
      attendeeLastName: attendee.lastName,
      attendeeEmail: attendee.email,
      attendeeCompany: attendee.company,
      attendeeTitle: attendee.title,
      message: pick(messages),
      consentToShareContact: Math.random() > 0.3,
      source: Math.random() > 0.5 ? "Public" : "Sponsor Dashboard",
      status: pick([...irStatuses]),
    }).returning();
    created.push(row);
  }
  console.log(`[SEED] Created ${created.length} information requests.`);
  return created;
}

async function seedDeliverables(
  eventRows: { id: string }[],
  sponsorRows: { id: string; assignedEvents: EventSponsorLink[] }[],
) {
  console.log("[SEED] Creating agreement deliverables...");
  const created = [];
  const deliverableTypes = [
    { category: "Branding", name: "Logo on Event Website", fulfillmentType: "file_upload" },
    { category: "Branding", name: "Banner Ad — Main Stage", fulfillmentType: "status_only" },
    { category: "Content", name: "Sponsored Session Submission", fulfillmentType: "file_upload" },
    { category: "Content", name: "Blog Post Contribution", fulfillmentType: "status_only" },
    { category: "Networking", name: "VIP Dinner Invitation List", fulfillmentType: "registration" },
    { category: "Networking", name: "Meeting Room Allocation", fulfillmentType: "status_only" },
    { category: "Digital", name: "Social Media Promotion Package", fulfillmentType: "social_submission" },
    { category: "Digital", name: "Email Blast to Attendees", fulfillmentType: "status_only" },
  ];
  const dStatuses = ["Not Started", "In Progress", "Completed", "Overdue"];

  for (const sponsor of sponsorRows) {
    for (const ae of sponsor.assignedEvents) {
      const subset = pickN(deliverableTypes, Math.floor(Math.random() * 3) + 3);
      let order = 0;
      for (const dt of subset) {
        const [row] = await db.insert(agreementDeliverables).values({
          sponsorId: sponsor.id,
          eventId: ae.eventId,
          sponsorshipLevel: "Gold",
          category: dt.category,
          deliverableName: dt.name,
          deliverableDescription: `${dt.name} for the event.`,
          ownerType: Math.random() > 0.5 ? "Converge" : "Sponsor",
          sponsorEditable: dt.fulfillmentType !== "status_only",
          sponsorVisible: true,
          fulfillmentType: dt.fulfillmentType,
          status: pick(dStatuses),
          dueTiming: "before_event",
          displayOrder: order++,
        }).returning();
        created.push(row);
      }
    }
  }
  console.log(`[SEED] Created ${created.length} deliverables.`);
  return created;
}

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  DEMO SEED — Populating demo environment");
  console.log("═══════════════════════════════════════════════════════");
  const start = Date.now();

  await clearAllData();

  const userRows = await seedUsers();
  const eventRows = await seedEvents();
  const sponsorRows = await seedSponsors(eventRows.map(e => e.id));
  const attendeeRows = await seedAttendees(eventRows.map(e => e.id));
  await seedMeetings(eventRows, sponsorRows, attendeeRows);
  await seedInfoRequests(eventRows, sponsorRows, attendeeRows as any);
  await seedDeliverables(eventRows, sponsorRows);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  DEMO SEED COMPLETE in ${elapsed}s`);
  console.log(`  Users: ${userRows.length}`);
  console.log(`  Events: ${eventRows.length}`);
  console.log(`  Sponsors: ${sponsorRows.length}`);
  console.log(`  Attendees: ${attendeeRows.length}`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[SEED] Fatal error:", err);
    process.exit(1);
  });
