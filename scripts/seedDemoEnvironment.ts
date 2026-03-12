import { db } from "../server/db";
import {
  users, events, sponsors, attendees, meetings,
  informationRequests, agreementDeliverables, sponsorTokens,
  emailLogs, sponsorNotifications, sponsorAnalytics,
  agreementDeliverableRegistrants, agreementDeliverableSpeakers,
  deliverableLinks, deliverableSocialEntries, agreementDeliverableReminders,
  backupJobs, fileAssets, passwordResetTokens, sponsorUsers,
  sponsorLoginTokens, dataExchangeLogs, userPermissions, permissionAuditLogs,
  agreementPackageTemplates, agreementDeliverableTemplateItems, emailTemplates,
} from "../shared/schema";
import type {
  MeetingLocation, MeetingTimeBlock, EventSponsorLink,
} from "../shared/schema";
import { randomUUID } from "crypto";

if (process.env.APP_ENV !== "demo" && !process.argv.includes("--force")) {
  console.error("[SEED] ABORTED — this script only runs when APP_ENV=demo (use --force to override)");
  process.exit(1);
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. DEMO EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

const DEMO_EVENTS = [
  {
    name: "Demo Fintech Risk & Compliance Forum 2026",
    slug: "DEMOFRC2026",
    location: "Drury Lane Theatre & Conference Center, Oak Brook, IL",
    start: "2026-10-05",
    end: "2026-10-07",
    primaryColor: "#1a365d",
    secondaryColor: "#f8fafc",
    accentColor: "#0D9488",
    buttonColor: "#0D9488",
    bgAccentColor: "#f0fdfa",
    categories: ["AI", "Compliance", "Regulatory", "Fraud", "Risk", "Cybersecurity", "Payments"],
  },
  {
    name: "Demo U.S. BankTech Summit 2026",
    slug: "DEMOUSBT2026",
    location: "Austin Convention Center, Austin, TX",
    start: "2026-04-02",
    end: "2026-04-04",
    primaryColor: "#1e3a5f",
    secondaryColor: "#f8fafc",
    accentColor: "#2563eb",
    buttonColor: "#2563eb",
    bgAccentColor: "#eff6ff",
    categories: ["Core Modernization", "AI", "Digital Banking", "CX", "Payments", "Cloud", "Cybersecurity", "RegTech"],
  },
  {
    name: "Demo Treasury Leadership Summit 2026",
    slug: "DEMOTLS2026",
    location: "The Roosevelt Hotel, New York, NY",
    start: "2026-06-18",
    end: "2026-06-20",
    primaryColor: "#2d3748",
    secondaryColor: "#f8fafc",
    accentColor: "#d97706",
    buttonColor: "#d97706",
    bgAccentColor: "#fffbeb",
    categories: ["Treasury", "Cash Management", "Risk", "Liquidity", "Automation", "Payments", "Finance Operations"],
  },
];

function buildMeetingLocations(): MeetingLocation[] {
  return [
    { id: randomUUID(), name: "Booth", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "Work Lounge", allowedSponsorLevels: [] },
    { id: randomUUID(), name: "VIP Room", allowedSponsorLevels: ["Platinum", "Gold"] },
    { id: randomUUID(), name: "Networking Lounge", allowedSponsorLevels: [] },
  ];
}

function buildMeetingBlocks(startDate: string, numDays: number): MeetingTimeBlock[] {
  const blocks: MeetingTimeBlock[] = [];
  for (let dayOff = 0; dayOff < numDays; dayOff++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + dayOff);
    const date = d.toISOString().slice(0, 10);
    blocks.push(
      { id: randomUUID(), date, startTime: "09:00", endTime: "12:00", locationIds: [] },
      { id: randomUUID(), date, startTime: "13:00", endTime: "16:00", locationIds: [] },
      { id: randomUUID(), date, startTime: "16:15", endTime: "17:30", locationIds: [] },
    );
  }
  return blocks;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 2. DEMO SPONSORS — 12 sponsors with specific event assignments
// ═══════════════════════════════════════════════════════════════════════════════

interface SponsorDef {
  name: string;
  level: "Platinum" | "Gold" | "Silver" | "Bronze";
  events: string[];
  shortDescription: string;
  solutionsSummary: string;
  contactName: string;
  contactEmail: string;
  websiteUrl: string;
  reps: { name: string; email: string; role: string }[];
  profile: "high" | "moderate" | "low";
}

const DEMO_SPONSORS: SponsorDef[] = [
  {
    name: "RiskPilot",
    level: "Platinum",
    events: ["DEMOFRC2026"],
    shortDescription: "Enterprise risk intelligence and regulatory compliance platform.",
    solutionsSummary: "RiskPilot delivers AI-powered risk scoring, real-time regulatory monitoring, and compliance automation for banks and credit unions.\n\nKey solutions:\n• Adaptive fraud detection with sub-100ms decisioning\n• Regulatory change management and policy mapping\n• AI-driven credit risk scoring models\n• Real-time transaction monitoring and alert management",
    contactName: "Sarah Collins",
    contactEmail: "sarah.collins@demo.convergeevents.com",
    websiteUrl: "https://www.riskpilot.com",
    reps: [
      { name: "Sarah Collins", email: "sarah.collins@demo.convergeevents.com", role: "owner" },
      { name: "Mark Jensen", email: "mark.jensen@demo.convergeevents.com", role: "representative" },
      { name: "Priya Shah", email: "priya.shah@demo.convergeevents.com", role: "representative" },
      { name: "Daniel Reed", email: "daniel.reed@demo.convergeevents.com", role: "view_only" },
    ],
    profile: "high",
  },
  {
    name: "Summit RegTech",
    level: "Gold",
    events: ["DEMOFRC2026"],
    shortDescription: "Regulatory reporting automation for financial institutions.",
    solutionsSummary: "Summit RegTech simplifies compliance reporting with automated workflows, audit trail generation, and multi-jurisdiction regulatory filing.\n\nCore capabilities:\n• Automated regulatory filing across 50+ jurisdictions\n• Real-time compliance dashboards\n• Audit-ready documentation generation\n• API integrations with core banking systems",
    contactName: "Rebecca Torres",
    contactEmail: "rebecca.torres@demo.convergeevents.com",
    websiteUrl: "https://www.summitregtech.com",
    reps: [
      { name: "Rebecca Torres", email: "rebecca.torres@demo.convergeevents.com", role: "owner" },
      { name: "Chris Andersson", email: "chris.andersson@demo.convergeevents.com", role: "representative" },
      { name: "Nina Patel", email: "nina.patel@demo.convergeevents.com", role: "view_only" },
    ],
    profile: "moderate",
  },
  {
    name: "FuturePay",
    level: "Silver",
    events: ["DEMOFRC2026", "DEMOUSBT2026"],
    shortDescription: "Next-generation payment processing and digital wallet infrastructure.",
    solutionsSummary: "FuturePay provides real-time payment processing, digital wallet APIs, and cross-border settlement for banks and fintechs.\n\nSolutions include:\n• Instant ACH and real-time payment rails\n• White-label digital wallet platform\n• Cross-border settlement with 40+ currencies\n• Fraud-resistant tokenization",
    contactName: "Alex Moreau",
    contactEmail: "alex.moreau@demo.convergeevents.com",
    websiteUrl: "https://www.futurepay.io",
    reps: [
      { name: "Alex Moreau", email: "alex.moreau@demo.convergeevents.com", role: "owner" },
      { name: "Jordan Kim", email: "jordan.kim@demo.convergeevents.com", role: "representative" },
    ],
    profile: "moderate",
  },
  {
    name: "BankGuard",
    level: "Bronze",
    events: ["DEMOFRC2026"],
    shortDescription: "Cybersecurity and threat detection for financial services.",
    solutionsSummary: "BankGuard provides endpoint protection, threat intelligence, and SOC-as-a-service for community banks and credit unions.",
    contactName: "Tom Nakamura",
    contactEmail: "tom.nakamura@demo.convergeevents.com",
    websiteUrl: "https://www.bankguard.io",
    reps: [
      { name: "Tom Nakamura", email: "tom.nakamura@demo.convergeevents.com", role: "owner" },
    ],
    profile: "low",
  },
  {
    name: "CoreNova",
    level: "Platinum",
    events: ["DEMOUSBT2026"],
    shortDescription: "Cloud-native core banking platform for modern financial institutions.",
    solutionsSummary: "CoreNova replaces legacy core systems with a modular, API-first banking platform.\n\nCapabilities:\n• Real-time ledger and transaction processing\n• Open banking API marketplace\n• Configurable product factory for deposits and loans\n• Built-in compliance engine",
    contactName: "Michelle Okafor",
    contactEmail: "michelle.okafor@demo.convergeevents.com",
    websiteUrl: "https://www.corenova.com",
    reps: [
      { name: "Michelle Okafor", email: "michelle.okafor@demo.convergeevents.com", role: "owner" },
      { name: "Ryan Castellano", email: "ryan.castellano@demo.convergeevents.com", role: "representative" },
      { name: "Lena Bjork", email: "lena.bjork@demo.convergeevents.com", role: "representative" },
    ],
    profile: "high",
  },
  {
    name: "EngageCX",
    level: "Gold",
    events: ["DEMOUSBT2026"],
    shortDescription: "Conversational AI and omnichannel customer engagement for banks.",
    solutionsSummary: "EngageCX helps financial institutions modernize member engagement with AI chatbots, intelligent routing, and unified conversation management.\n\nSolutions:\n• AI-powered virtual assistant for banking\n• Omnichannel inbox (chat, email, SMS, social)\n• Real-time sentiment analysis\n• Agent coaching and QA automation",
    contactName: "David Chen",
    contactEmail: "david.chen@demo.convergeevents.com",
    websiteUrl: "https://www.engagecx.com",
    reps: [
      { name: "David Chen", email: "david.chen@demo.convergeevents.com", role: "owner" },
      { name: "Aisha Okonkwo", email: "aisha.okonkwo@demo.convergeevents.com", role: "representative" },
    ],
    profile: "moderate",
  },
  {
    name: "OpenCore Systems",
    level: "Silver",
    events: ["DEMOUSBT2026"],
    shortDescription: "Open-source core banking middleware and integration layer.",
    solutionsSummary: "OpenCore Systems provides middleware that connects legacy cores to modern fintech APIs without full core replacement.",
    contactName: "James Whitmore",
    contactEmail: "james.whitmore@demo.convergeevents.com",
    websiteUrl: "https://www.opencoresystems.com",
    reps: [
      { name: "James Whitmore", email: "james.whitmore@demo.convergeevents.com", role: "owner" },
      { name: "Fatima El-Masri", email: "fatima.elmasri@demo.convergeevents.com", role: "view_only" },
    ],
    profile: "moderate",
  },
  {
    name: "Acme AI",
    level: "Bronze",
    events: ["DEMOUSBT2026"],
    shortDescription: "Applied AI and machine learning solutions for financial services.",
    solutionsSummary: "Acme AI builds custom ML models for fraud detection, credit decisioning, and customer segmentation in banking.",
    contactName: "Elena Rodriguez",
    contactEmail: "elena.rodriguez@demo.convergeevents.com",
    websiteUrl: "https://www.acmeai.com",
    reps: [
      { name: "Elena Rodriguez", email: "elena.rodriguez@demo.convergeevents.com", role: "owner" },
    ],
    profile: "low",
  },
  {
    name: "CloudTreasury",
    level: "Platinum",
    events: ["DEMOTLS2026", "DEMOFRC2026"],
    shortDescription: "Cloud-native treasury management and cash visibility platform.",
    solutionsSummary: "CloudTreasury provides real-time cash visibility, automated forecasting, and multi-bank connectivity for corporate treasury teams.\n\nKey features:\n• Real-time cash position across 200+ banks\n• AI-powered cash flow forecasting\n• Automated bank account management\n• Payment factory with approval workflows",
    contactName: "Victoria Chen",
    contactEmail: "victoria.chen@demo.convergeevents.com",
    websiteUrl: "https://www.cloudtreasury.com",
    reps: [
      { name: "Victoria Chen", email: "victoria.chen@demo.convergeevents.com", role: "owner" },
      { name: "Marcus Webb", email: "marcus.webb@demo.convergeevents.com", role: "representative" },
      { name: "Sophia Lindberg", email: "sophia.lindberg@demo.convergeevents.com", role: "representative" },
      { name: "Omar Hassan", email: "omar.hassan@demo.convergeevents.com", role: "view_only" },
    ],
    profile: "high",
  },
  {
    name: "LedgerFlow",
    level: "Gold",
    events: ["DEMOTLS2026"],
    shortDescription: "Automated reconciliation and financial close platform.",
    solutionsSummary: "LedgerFlow automates bank reconciliation, intercompany netting, and financial close processes.\n\nCapabilities:\n• AI-powered transaction matching\n• Multi-entity consolidation\n• Automated journal entries\n• Real-time close status dashboards",
    contactName: "Raj Chandrasekaran",
    contactEmail: "raj.chandrasekaran@demo.convergeevents.com",
    websiteUrl: "https://www.ledgerflow.com",
    reps: [
      { name: "Raj Chandrasekaran", email: "raj.chandrasekaran@demo.convergeevents.com", role: "owner" },
      { name: "Hannah Brennan", email: "hannah.brennan@demo.convergeevents.com", role: "representative" },
    ],
    profile: "moderate",
  },
  {
    name: "FinOps Insight",
    level: "Silver",
    events: ["DEMOTLS2026"],
    shortDescription: "Cloud cost management and FinOps tooling for financial enterprises.",
    solutionsSummary: "FinOps Insight helps treasury and IT teams optimize cloud spend with real-time cost allocation, chargeback automation, and budget forecasting.",
    contactName: "Kevin O'Brien",
    contactEmail: "kevin.obrien@demo.convergeevents.com",
    websiteUrl: "https://www.finopsinsight.com",
    reps: [
      { name: "Kevin O'Brien", email: "kevin.obrien@demo.convergeevents.com", role: "owner" },
      { name: "Diana Vasquez", email: "diana.vasquez@demo.convergeevents.com", role: "representative" },
    ],
    profile: "moderate",
  },
  {
    name: "Horizon Automation",
    level: "Bronze",
    events: ["DEMOTLS2026"],
    shortDescription: "Robotic process automation for treasury back-office operations.",
    solutionsSummary: "Horizon Automation deploys intelligent bots for cash application, invoice processing, and payment execution in treasury departments.",
    contactName: "Angela Foster",
    contactEmail: "angela.foster@demo.convergeevents.com",
    websiteUrl: "https://www.horizonautomation.com",
    reps: [
      { name: "Angela Foster", email: "angela.foster@demo.convergeevents.com", role: "owner" },
    ],
    profile: "low",
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 3. DEMO ATTENDEES — 90 attendees across three events
// ═══════════════════════════════════════════════════════════════════════════════

interface AttendeeDef {
  firstName: string;
  lastName: string;
  company: string;
  title: string;
  event: string;
  interests: string[];
}

const FRC_ATTENDEES: AttendeeDef[] = [
  { firstName: "Michael", lastName: "Thornton", company: "Midwest Community Bank", title: "Chief Risk Officer", event: "DEMOFRC2026", interests: ["Risk", "Fraud", "AI", "Compliance"] },
  { firstName: "Jennifer", lastName: "Carmichael", company: "Summit Financial", title: "VP Compliance", event: "DEMOFRC2026", interests: ["Compliance", "Regulatory", "Risk"] },
  { firstName: "Robert", lastName: "Nguyen", company: "Great Lakes Bank", title: "CIO", event: "DEMOFRC2026", interests: ["Cybersecurity", "AI", "Risk", "Payments"] },
  { firstName: "Patricia", lastName: "O'Sullivan", company: "Horizon Credit Union", title: "Chief Compliance Officer", event: "DEMOFRC2026", interests: ["Compliance", "Regulatory", "Fraud"] },
  { firstName: "David", lastName: "Fernandez", company: "First National Trust", title: "Head of Risk Management", event: "DEMOFRC2026", interests: ["Risk", "AI", "Fraud", "Cybersecurity"] },
  { firstName: "Lisa", lastName: "Morrison", company: "Regional Capital Bank", title: "VP Regulatory Affairs", event: "DEMOFRC2026", interests: ["Regulatory", "Compliance", "Risk"] },
  { firstName: "Thomas", lastName: "Sato", company: "Evergreen Credit Union", title: "CTO", event: "DEMOFRC2026", interests: ["Cybersecurity", "AI", "Payments"] },
  { firstName: "Amanda", lastName: "Beaumont", company: "Prairie State Financial", title: "Director of Fraud Prevention", event: "DEMOFRC2026", interests: ["Fraud", "AI", "Risk", "Cybersecurity"] },
  { firstName: "William", lastName: "Petrov", company: "NorthBridge Bank", title: "Chief Information Security Officer", event: "DEMOFRC2026", interests: ["Cybersecurity", "Risk", "Compliance"] },
  { firstName: "Maria", lastName: "Adebayo", company: "Apex Federal Credit Union", title: "VP Operations", event: "DEMOFRC2026", interests: ["Compliance", "Payments", "AI"] },
  { firstName: "James", lastName: "Davenport", company: "Heritage Savings Bank", title: "Chief Risk Officer", event: "DEMOFRC2026", interests: ["Risk", "Regulatory", "Fraud"] },
  { firstName: "Sophia", lastName: "Mikkelsen", company: "Community First Bank", title: "Director of Compliance", event: "DEMOFRC2026", interests: ["Compliance", "Regulatory", "AI"] },
  { firstName: "Richard", lastName: "Hashimoto", company: "Gateway Credit Union", title: "VP Risk Analytics", event: "DEMOFRC2026", interests: ["Risk", "AI", "Fraud"] },
  { firstName: "Catherine", lastName: "Sinclair", company: "Patriot National Bank", title: "Chief Data Officer", event: "DEMOFRC2026", interests: ["AI", "Risk", "Cybersecurity", "Payments"] },
  { firstName: "Steven", lastName: "Volkov", company: "Lakeview Financial", title: "Head of Cybersecurity", event: "DEMOFRC2026", interests: ["Cybersecurity", "Fraud", "AI"] },
  { firstName: "Andrea", lastName: "Fischer", company: "Central Plains Bank", title: "VP Payments Strategy", event: "DEMOFRC2026", interests: ["Payments", "AI", "Compliance"] },
  { firstName: "Daniel", lastName: "Goldstein", company: "Mountain View Credit Union", title: "CRO", event: "DEMOFRC2026", interests: ["Risk", "Fraud", "Regulatory", "Compliance"] },
  { firstName: "Rachel", lastName: "Yamamoto", company: "Pacific Trust Bank", title: "Director of Information Security", event: "DEMOFRC2026", interests: ["Cybersecurity", "AI", "Risk"] },
  { firstName: "Nathan", lastName: "Mbeki", company: "Coastal Federal Bank", title: "VP Compliance & Risk", event: "DEMOFRC2026", interests: ["Compliance", "Risk", "Regulatory", "AI"] },
  { firstName: "Lauren", lastName: "Kovalenko", company: "Capital Heights Bank", title: "Chief Compliance Officer", event: "DEMOFRC2026", interests: ["Compliance", "Regulatory", "Fraud"] },
  { firstName: "Andrew", lastName: "Blackwell", company: "FinServ Partners LLC", title: "Managing Director", event: "DEMOFRC2026", interests: ["AI", "Risk", "Payments"] },
  { firstName: "Christine", lastName: "Novak", company: "SafeHaven Insurance", title: "VP Risk Assessment", event: "DEMOFRC2026", interests: ["Risk", "Fraud", "Compliance"] },
  { firstName: "Marcus", lastName: "Tanaka", company: "Valley National Bank", title: "SVP Technology", event: "DEMOFRC2026", interests: ["AI", "Cybersecurity", "Payments"] },
  { firstName: "Elizabeth", lastName: "Ramirez", company: "Silver Oak Financial", title: "Director of Regulatory Compliance", event: "DEMOFRC2026", interests: ["Regulatory", "Compliance", "Risk"] },
  { firstName: "Gregory", lastName: "Ashworth", company: "Union Savings Bank", title: "Chief Technology Officer", event: "DEMOFRC2026", interests: ["Cybersecurity", "AI", "Risk", "Payments"] },
  { firstName: "Samantha", lastName: "Johansson", company: "Northern Star Credit Union", title: "VP Fraud Prevention", event: "DEMOFRC2026", interests: ["Fraud", "AI", "Risk"] },
  { firstName: "Brian", lastName: "Haddad", company: "CrossRoads Bank", title: "Director of IT Security", event: "DEMOFRC2026", interests: ["Cybersecurity", "Compliance", "AI"] },
  { firstName: "Nicole", lastName: "Bergström", company: "Pioneer Financial Group", title: "Chief Innovation Officer", event: "DEMOFRC2026", interests: ["AI", "Payments", "Risk", "Cybersecurity"] },
  { firstName: "Kevin", lastName: "Osei", company: "Cornerstone Community Bank", title: "VP Enterprise Risk", event: "DEMOFRC2026", interests: ["Risk", "Compliance", "Fraud"] },
  { firstName: "Emily", lastName: "Fitzgerald", company: "Riverside Federal CU", title: "Director of Compliance", event: "DEMOFRC2026", interests: ["Compliance", "Regulatory", "AI"] },
];

const USBT_ATTENDEES: AttendeeDef[] = [
  { firstName: "Christopher", lastName: "Wellington", company: "Midwest Community Bank", title: "CTO", event: "DEMOUSBT2026", interests: ["Core Modernization", "AI", "Cloud"] },
  { firstName: "Jessica", lastName: "Garcia", company: "Summit Financial", title: "VP Digital Banking", event: "DEMOUSBT2026", interests: ["Digital Banking", "CX", "AI"] },
  { firstName: "Matthew", lastName: "Ishikawa", company: "Great Lakes Bank", title: "Head of Payments", event: "DEMOUSBT2026", interests: ["Payments", "Core Modernization", "Cloud"] },
  { firstName: "Ashley", lastName: "Callahan", company: "Horizon Credit Union", title: "Chief Innovation Officer", event: "DEMOUSBT2026", interests: ["AI", "Digital Banking", "CX", "Core Modernization"] },
  { firstName: "Ryan", lastName: "Dubois", company: "First National Trust", title: "VP Technology", event: "DEMOUSBT2026", interests: ["Cloud", "Core Modernization", "Cybersecurity"] },
  { firstName: "Megan", lastName: "Steinberg", company: "Regional Capital Bank", title: "Head of Digital Channels", event: "DEMOUSBT2026", interests: ["Digital Banking", "CX", "AI"] },
  { firstName: "Joshua", lastName: "Miyamoto", company: "Evergreen Credit Union", title: "CIO", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "Cybersecurity", "AI"] },
  { firstName: "Brittany", lastName: "Olsen", company: "Prairie State Financial", title: "Director of CX", event: "DEMOUSBT2026", interests: ["CX", "Digital Banking", "AI"] },
  { firstName: "Tyler", lastName: "Mehta", company: "NorthBridge Bank", title: "VP Cloud Infrastructure", event: "DEMOUSBT2026", interests: ["Cloud", "Cybersecurity", "Core Modernization"] },
  { firstName: "Kayla", lastName: "Rossi", company: "Apex Federal Credit Union", title: "VP Payments Innovation", event: "DEMOUSBT2026", interests: ["Payments", "AI", "Digital Banking"] },
  { firstName: "Brandon", lastName: "Schmidt", company: "Heritage Savings Bank", title: "Chief Digital Officer", event: "DEMOUSBT2026", interests: ["Digital Banking", "AI", "CX", "Core Modernization"] },
  { firstName: "Stephanie", lastName: "Alonso", company: "Community First Bank", title: "Director of Engineering", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "AI"] },
  { firstName: "Justin", lastName: "Kwon", company: "Gateway Credit Union", title: "VP Application Development", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "RegTech"] },
  { firstName: "Danielle", lastName: "Bakker", company: "Patriot National Bank", title: "Head of Member Experience", event: "DEMOUSBT2026", interests: ["CX", "Digital Banking", "AI"] },
  { firstName: "Scott", lastName: "Reed", company: "Lakeview Financial", title: "CTO", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "Cybersecurity"] },
  { firstName: "Vanessa", lastName: "Bjork", company: "Central Plains Bank", title: "VP Digital Transformation", event: "DEMOUSBT2026", interests: ["Digital Banking", "AI", "Payments", "CX"] },
  { firstName: "Derek", lastName: "Ito", company: "Mountain View Credit Union", title: "Director of IT", event: "DEMOUSBT2026", interests: ["Cloud", "Cybersecurity", "Core Modernization"] },
  { firstName: "Christina", lastName: "Malone", company: "Pacific Trust Bank", title: "VP Card Services", event: "DEMOUSBT2026", interests: ["Payments", "Digital Banking", "AI"] },
  { firstName: "Patrick", lastName: "Sharma", company: "Coastal Federal Bank", title: "Chief Technology Officer", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "AI", "RegTech"] },
  { firstName: "Monica", lastName: "Torres", company: "Capital Heights Bank", title: "VP Online Banking", event: "DEMOUSBT2026", interests: ["Digital Banking", "CX", "Cloud"] },
  { firstName: "Sean", lastName: "Weber", company: "Valley Tech CU", title: "SVP Technology", event: "DEMOUSBT2026", interests: ["Core Modernization", "AI", "Cloud"] },
  { firstName: "Heather", lastName: "Hassan", company: "FinEdge Partners", title: "Head of Innovation", event: "DEMOUSBT2026", interests: ["AI", "Digital Banking", "Payments", "CX"] },
  { firstName: "Aaron", lastName: "Blake", company: "Granite State Bank", title: "VP Infrastructure", event: "DEMOUSBT2026", interests: ["Cloud", "Cybersecurity", "Core Modernization"] },
  { firstName: "Lindsey", lastName: "Suzuki", company: "Trident Financial", title: "Director of Product", event: "DEMOUSBT2026", interests: ["Digital Banking", "CX", "AI"] },
  { firstName: "Adam", lastName: "Madsen", company: "BluePine Credit Union", title: "Chief Information Officer", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "AI", "Cybersecurity"] },
  { firstName: "Rebecca", lastName: "Basu", company: "Liberty National Bank", title: "VP RegTech", event: "DEMOUSBT2026", interests: ["RegTech", "Compliance", "AI"] },
  { firstName: "Charles", lastName: "Hayes", company: "Keystone Federal CU", title: "Director of IT Operations", event: "DEMOUSBT2026", interests: ["Cloud", "Core Modernization", "Cybersecurity"] },
  { firstName: "Michelle", lastName: "Kato", company: "Westfield Bank", title: "VP Mobile Banking", event: "DEMOUSBT2026", interests: ["Digital Banking", "CX", "Payments"] },
  { firstName: "Travis", lastName: "Russo", company: "Harbor Point CU", title: "Head of Architecture", event: "DEMOUSBT2026", interests: ["Core Modernization", "Cloud", "AI"] },
  { firstName: "Diana", lastName: "Cho", company: "Summit Tech Advisors", title: "Managing Director", event: "DEMOUSBT2026", interests: ["AI", "Core Modernization", "Digital Banking", "CX"] },
];

const TLS_ATTENDEES: AttendeeDef[] = [
  { firstName: "Alexander", lastName: "Palmer", company: "First National Trust", title: "Treasury Director", event: "DEMOTLS2026", interests: ["Treasury", "Cash Management", "Automation"] },
  { firstName: "Sarah", lastName: "Joshi", company: "Summit Financial", title: "VP Treasury Operations", event: "DEMOTLS2026", interests: ["Cash Management", "Payments", "Liquidity"] },
  { firstName: "Benjamin", lastName: "Meyer", company: "Great Lakes Bank", title: "Head of Cash Management", event: "DEMOTLS2026", interests: ["Cash Management", "Automation", "Treasury"] },
  { firstName: "Olivia", lastName: "Cruz", company: "Horizon Credit Union", title: "VP Finance", event: "DEMOTLS2026", interests: ["Finance Operations", "Treasury", "Liquidity"] },
  { firstName: "Jonathan", lastName: "Whitmore", company: "Regional Capital Bank", title: "Treasurer", event: "DEMOTLS2026", interests: ["Treasury", "Risk", "Cash Management", "Liquidity"] },
  { firstName: "Grace", lastName: "Fernandez", company: "Midwest Community Bank", title: "VP Liquidity Management", event: "DEMOTLS2026", interests: ["Liquidity", "Risk", "Treasury"] },
  { firstName: "Kenneth", lastName: "Moreau", company: "Evergreen Credit Union", title: "Director of Finance", event: "DEMOTLS2026", interests: ["Finance Operations", "Treasury", "Automation"] },
  { firstName: "Natalie", lastName: "Patel", company: "NorthBridge Bank", title: "Head of Payments Operations", event: "DEMOTLS2026", interests: ["Payments", "Automation", "Treasury"] },
  { firstName: "George", lastName: "Lindberg", company: "Prairie State Financial", title: "VP Cash Management", event: "DEMOTLS2026", interests: ["Cash Management", "Treasury", "Liquidity"] },
  { firstName: "Angela", lastName: "Kim", company: "Apex Federal Credit Union", title: "Treasury Manager", event: "DEMOTLS2026", interests: ["Treasury", "Cash Management", "Risk"] },
  { firstName: "Eric", lastName: "Steinberg", company: "Heritage Savings Bank", title: "Director of Treasury Operations", event: "DEMOTLS2026", interests: ["Treasury", "Automation", "Payments"] },
  { firstName: "Julia", lastName: "Okonkwo", company: "Community First Bank", title: "VP Finance Operations", event: "DEMOTLS2026", interests: ["Finance Operations", "Cash Management", "Automation"] },
  { firstName: "Philip", lastName: "Johansson", company: "Gateway Credit Union", title: "Chief Financial Officer", event: "DEMOTLS2026", interests: ["Treasury", "Risk", "Liquidity", "Finance Operations"] },
  { firstName: "Victoria", lastName: "Chandra", company: "Patriot National Bank", title: "VP Treasury Technology", event: "DEMOTLS2026", interests: ["Treasury", "Automation", "Payments"] },
  { firstName: "Raymond", lastName: "Nakamura", company: "Lakeview Financial", title: "Head of Banking Operations", event: "DEMOTLS2026", interests: ["Payments", "Treasury", "Automation"] },
  { firstName: "Melissa", lastName: "Callahan", company: "Central Plains Bank", title: "Director of Cash Mgmt", event: "DEMOTLS2026", interests: ["Cash Management", "Liquidity", "Treasury"] },
  { firstName: "Douglas", lastName: "Brennan", company: "Mountain View Credit Union", title: "VP Finance & Treasury", event: "DEMOTLS2026", interests: ["Treasury", "Finance Operations", "Risk"] },
  { firstName: "Sandra", lastName: "Volkov", company: "Pacific Trust Bank", title: "Treasurer", event: "DEMOTLS2026", interests: ["Treasury", "Liquidity", "Cash Management", "Payments"] },
  { firstName: "Henry", lastName: "Adebayo", company: "Coastal Federal Bank", title: "VP Payment Operations", event: "DEMOTLS2026", interests: ["Payments", "Automation", "Treasury"] },
  { firstName: "Cynthia", lastName: "Davenport", company: "Capital Heights Bank", title: "Director of Treasury Services", event: "DEMOTLS2026", interests: ["Treasury", "Cash Management", "Automation"] },
  { firstName: "Frank", lastName: "Tanaka", company: "Silver Oak Financial", title: "Head of ALM", event: "DEMOTLS2026", interests: ["Risk", "Liquidity", "Treasury"] },
  { firstName: "Laura", lastName: "Mikkelsen", company: "Union Savings Bank", title: "VP Corporate Banking", event: "DEMOTLS2026", interests: ["Treasury", "Payments", "Finance Operations"] },
  { firstName: "Howard", lastName: "Ashworth", company: "Northern Star Credit Union", title: "CFO", event: "DEMOTLS2026", interests: ["Treasury", "Risk", "Liquidity", "Finance Operations"] },
  { firstName: "Diane", lastName: "Haddad", company: "CrossRoads Bank", title: "VP Treasury", event: "DEMOTLS2026", interests: ["Treasury", "Cash Management", "Payments"] },
  { firstName: "Roger", lastName: "Bergström", company: "Pioneer Financial Group", title: "Director of Payments", event: "DEMOTLS2026", interests: ["Payments", "Automation", "Treasury"] },
  { firstName: "Barbara", lastName: "Osei", company: "Cornerstone Community Bank", title: "VP Finance", event: "DEMOTLS2026", interests: ["Finance Operations", "Treasury", "Cash Management"] },
  { firstName: "Carl", lastName: "Fitzgerald", company: "Riverside Federal CU", title: "Treasurer", event: "DEMOTLS2026", interests: ["Treasury", "Liquidity", "Risk"] },
  { firstName: "Martha", lastName: "Hashimoto", company: "FinServ Partners LLC", title: "Managing Director, Treasury", event: "DEMOTLS2026", interests: ["Treasury", "Cash Management", "Automation", "Payments"] },
  { firstName: "Phillip", lastName: "Beaumont", company: "SafeHaven Insurance", title: "VP Investment Operations", event: "DEMOTLS2026", interests: ["Risk", "Liquidity", "Treasury"] },
  { firstName: "Carolyn", lastName: "Petrov", company: "Valley National Bank", title: "Director of Cash Operations", event: "DEMOTLS2026", interests: ["Cash Management", "Payments", "Automation"] },
];

const ALL_ATTENDEES = [...FRC_ATTENDEES, ...USBT_ATTENDEES, ...TLS_ATTENDEES];

// ═══════════════════════════════════════════════════════════════════════════════
// 4. DELIVERABLE TEMPLATE ITEMS (for seeding per-sponsor deliverables)
// ═══════════════════════════════════════════════════════════════════════════════

const DELIVERABLE_DEFS = [
  { category: "Company Profile", name: "Company Logo", fulfillmentType: "file_upload", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 1 },
  { category: "Company Profile", name: "Company Description", fulfillmentType: "status_only", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 2 },
  { category: "Company Profile", name: "Sponsor Representatives", fulfillmentType: "registration", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 3 },
  { category: "Company Profile", name: "Product / Solution Categories", fulfillmentType: "status_only", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 4 },
  { category: "Event Production", name: "Registration Access Code", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 5 },
  { category: "Event Production", name: "Exhibit Table Setup", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 6 },
  { category: "Speaking & Content", name: "Sponsored Session Submission", fulfillmentType: "file_upload", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 7 },
  { category: "Speaking & Content", name: "Speaker Information", fulfillmentType: "status_only", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 8 },
  { category: "Marketing & Branding", name: "Company Logo on Website", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 9 },
  { category: "Marketing & Branding", name: "Company Logo on Signage", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 10 },
  { category: "Marketing & Branding", name: "Company Profile in App", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 11 },
  { category: "Marketing & Branding", name: "Social Media Graphics", fulfillmentType: "social_submission", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 12 },
  { category: "Marketing & Branding", name: "Social Announcements", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "before_event", order: 13 },
  { category: "Post-Event", name: "Attendee Contact List", fulfillmentType: "status_only", ownerType: "Converge", sponsorEditable: false, dueTiming: "after_event", order: 14 },
  { category: "Compliance", name: "General Liability COI", fulfillmentType: "file_upload", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 15 },
  { category: "Compliance", name: "Worker's Comp COI", fulfillmentType: "file_upload", ownerType: "Sponsor", sponsorEditable: true, dueTiming: "before_event", order: 16 },
];

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function sanitizeEmail(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9.-]/g, "")
    .replace(/\.+/g, ".");
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLEAR + SEED FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

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
  await db.insert(users).values({ username: "admin@converge.com", name: "Demo Admin", email: "admin@converge.com", password: "password", role: "admin", isActive: true });
  await db.insert(users).values({ username: "manager@converge.com", name: "Sarah Manager", email: "manager@converge.com", password: "password", role: "manager", isActive: true });
  console.log("[SEED] Created 2 users.");
}

async function seedEvents(): Promise<Map<string, string>> {
  console.log("[SEED] Creating events...");
  const slugToId = new Map<string, string>();
  for (const evt of DEMO_EVENTS) {
    const locations = buildMeetingLocations();
    const blocks = buildMeetingBlocks(evt.start, 3);
    const [row] = await db.insert(events).values({
      name: evt.name,
      slug: evt.slug,
      location: evt.location,
      startDate: new Date(evt.start),
      endDate: new Date(evt.end),
      meetingLocations: locations,
      meetingBlocks: blocks,
      schedulingEnabled: true,
      primaryColor: evt.primaryColor,
      secondaryColor: evt.secondaryColor,
      accentColor: evt.accentColor,
      buttonColor: evt.buttonColor,
      bgAccentColor: evt.bgAccentColor,
    }).returning();
    slugToId.set(evt.slug, row.id);
  }
  console.log(`[SEED] Created ${DEMO_EVENTS.length} events.`);
  return slugToId;
}

async function seedSponsors(slugToId: Map<string, string>): Promise<Map<string, { id: string; def: SponsorDef }>> {
  console.log("[SEED] Creating sponsors...");
  const sponsorMap = new Map<string, { id: string; def: SponsorDef }>();
  for (const sp of DEMO_SPONSORS) {
    const assignedEvents: EventSponsorLink[] = sp.events.map(slug => ({
      eventId: slugToId.get(slug)!,
      sponsorshipLevel: sp.level,
      archiveState: "active" as const,
      archiveSource: null,
      onsiteMeetingEnabled: true,
      onlineMeetingEnabled: sp.level === "Platinum" || sp.level === "Gold",
      informationRequestEnabled: true,
      useDefaultBlocks: true,
      selectedBlockIds: [],
    }));
    const [row] = await db.insert(sponsors).values({
      name: sp.name,
      level: sp.level,
      shortDescription: sp.shortDescription,
      solutionsSummary: sp.solutionsSummary,
      contactName: sp.contactName,
      contactEmail: sp.contactEmail,
      assignedEvents,
      allowOnlineMeetings: sp.level === "Platinum" || sp.level === "Gold",
      websiteUrl: sp.websiteUrl,
      attributes: [],
    }).returning();
    sponsorMap.set(sp.name, { id: row.id, def: sp });
  }
  console.log(`[SEED] Created ${DEMO_SPONSORS.length} sponsors.`);
  return sponsorMap;
}

async function seedSponsorUsers(sponsorMap: Map<string, { id: string; def: SponsorDef }>) {
  console.log("[SEED] Creating sponsor users...");
  let count = 0;
  for (const [, { id, def }] of sponsorMap) {
    for (let i = 0; i < def.reps.length; i++) {
      const rep = def.reps[i];
      await db.insert(sponsorUsers).values({
        sponsorId: id,
        name: rep.name,
        email: rep.email,
        accessLevel: rep.role,
        isPrimary: i === 0,
        isActive: true,
      });
      count++;
    }
  }
  console.log(`[SEED] Created ${count} sponsor users.`);
}

async function seedAttendees(slugToId: Map<string, string>): Promise<Map<string, { id: string; def: AttendeeDef }>> {
  console.log("[SEED] Creating attendees...");
  const attendeeMap = new Map<string, { id: string; def: AttendeeDef }>();
  for (const att of ALL_ATTENDEES) {
    const email = `${sanitizeEmail(att.firstName)}.${sanitizeEmail(att.lastName)}@example-demo.com`;
    const [row] = await db.insert(attendees).values({
      firstName: att.firstName,
      lastName: att.lastName,
      name: `${att.firstName} ${att.lastName}`,
      company: att.company,
      title: att.title,
      email,
      assignedEvent: slugToId.get(att.event)!,
      interests: att.interests,
    }).returning();
    attendeeMap.set(`${att.firstName}-${att.lastName}-${att.event}`, { id: row.id, def: att });
  }
  console.log(`[SEED] Created ${ALL_ATTENDEES.length} attendees.`);
  return attendeeMap;
}

async function seedMeetings(
  slugToId: Map<string, string>,
  sponsorMap: Map<string, { id: string; def: SponsorDef }>,
  attendeeMap: Map<string, { id: string; def: AttendeeDef }>,
) {
  console.log("[SEED] Creating meetings...");
  let count = 0;
  const locations = ["Booth", "Work Lounge", "VIP Room", "Networking Lounge"];

  for (const evt of DEMO_EVENTS) {
    const eventId = slugToId.get(evt.slug)!;
    const eventAttendees = Array.from(attendeeMap.values()).filter(a => a.def.event === evt.slug);
    const eventSponsors = Array.from(sponsorMap.values()).filter(s => s.def.events.includes(evt.slug));

    for (const sp of eventSponsors) {
      let meetingCount: number;
      let completedCount: number;
      let pendingCount: number;

      if (sp.def.profile === "high") {
        meetingCount = 10 + Math.floor(Math.random() * 5);
        completedCount = 3;
        pendingCount = 2;
      } else if (sp.def.profile === "moderate") {
        meetingCount = 5 + Math.floor(Math.random() * 4);
        completedCount = 2;
        pendingCount = 2;
      } else {
        meetingCount = 1 + Math.floor(Math.random() * 2);
        completedCount = 0;
        pendingCount = 1;
      }

      const totalSlots = meetingCount + completedCount + pendingCount;
      const usedAttendees = eventAttendees.slice(0, Math.min(totalSlots, eventAttendees.length));

      for (let i = 0; i < totalSlots && i < usedAttendees.length; i++) {
        const att = usedAttendees[i];
        const dayOffset = Math.floor(Math.random() * 3);
        const d = new Date(evt.start);
        d.setDate(d.getDate() + dayOffset);
        const date = d.toISOString().slice(0, 10);
        const hours = 9 + Math.floor(Math.random() * 8);
        const mins = Math.random() > 0.5 ? "00" : "30";
        const time = `${hours.toString().padStart(2, "0")}:${mins}`;

        let status: string;
        if (i < completedCount) status = "Completed";
        else if (i < completedCount + pendingCount) status = "Pending";
        else if (i < completedCount + pendingCount + Math.floor(meetingCount * 0.4)) status = "Confirmed";
        else status = "Scheduled";

        await db.insert(meetings).values({
          eventId,
          sponsorId: sp.id,
          attendeeId: att.id,
          date,
          time,
          location: pick(locations),
          status,
          source: Math.random() > 0.3 ? "admin" : "public",
          meetingType: Math.random() > 0.8 ? "online_request" : "onsite",
        });
        count++;
      }
    }
  }
  console.log(`[SEED] Created ${count} meetings.`);
}

async function seedInfoRequests(
  slugToId: Map<string, string>,
  sponsorMap: Map<string, { id: string; def: SponsorDef }>,
  attendeeMap: Map<string, { id: string; def: AttendeeDef }>,
) {
  console.log("[SEED] Creating information requests...");
  let count = 0;
  const messages = [
    "Interested in learning more about your compliance automation solutions. Can we discuss how they integrate with our existing core?",
    "Would like to schedule a detailed product demo for our risk management team.",
    "Looking for a real-time payment processing solution — can we set up a call next week?",
    "Our credit union is evaluating cybersecurity vendors. Please share pricing and case studies.",
    "We'd like to discuss a potential integration partnership for our digital banking platform.",
    "Can you provide references from community banks that use your treasury management system?",
    "Interested in your AI-driven fraud detection capabilities for our card processing environment.",
    "Our board is prioritizing ESG reporting. Would love to learn about your regulatory compliance tools.",
    "Need to modernize our core banking stack — interested in your cloud-native approach.",
    "Looking for automated reconciliation solutions for our treasury operations.",
    "Want to explore your cash forecasting AI capabilities for our multi-entity treasury.",
    "Our institution needs better regulatory filing automation — can we discuss your platform?",
  ];
  const statuses = ["New", "Contacted", "Open", "Closed"] as const;

  for (const evt of DEMO_EVENTS) {
    const eventId = slugToId.get(evt.slug)!;
    const eventAttendees = Array.from(attendeeMap.values()).filter(a => a.def.event === evt.slug);
    const eventSponsors = Array.from(sponsorMap.values()).filter(s => s.def.events.includes(evt.slug));
    if (eventAttendees.length === 0 || eventSponsors.length === 0) continue;

    const irCount = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < irCount; i++) {
      const att = eventAttendees[i % eventAttendees.length];
      const sp = eventSponsors[i % eventSponsors.length];
      await db.insert(informationRequests).values({
        eventId,
        sponsorId: sp.id,
        attendeeId: att.id,
        attendeeFirstName: att.def.firstName,
        attendeeLastName: att.def.lastName,
        attendeeEmail: `${att.def.firstName.toLowerCase()}.${att.def.lastName.toLowerCase()}@example-demo.com`,
        attendeeCompany: att.def.company,
        attendeeTitle: att.def.title,
        message: messages[count % messages.length],
        consentToShareContact: Math.random() > 0.2,
        source: Math.random() > 0.5 ? "Public" : "Sponsor Dashboard",
        status: statuses[i % statuses.length],
      });
      count++;
    }
  }
  console.log(`[SEED] Created ${count} information requests.`);
}

async function seedDeliverables(
  slugToId: Map<string, string>,
  sponsorMap: Map<string, { id: string; def: SponsorDef }>,
) {
  console.log("[SEED] Creating deliverables...");
  let count = 0;

  for (const [, { id: sponsorId, def }] of sponsorMap) {
    for (const eventSlug of def.events) {
      const eventId = slugToId.get(eventSlug)!;

      for (const del of DELIVERABLE_DEFS) {
        let status: string;
        if (def.profile === "high") {
          if (del.order <= 6) status = "Completed";
          else if (del.order <= 11) status = Math.random() > 0.3 ? "Completed" : "In Progress";
          else if (del.order <= 13) status = "Completed";
          else if (del.category === "Post-Event") status = "Not Started";
          else status = "Completed";
        } else if (def.profile === "moderate") {
          if (del.order <= 3) status = "Completed";
          else if (del.order <= 6) status = Math.random() > 0.5 ? "In Progress" : "Not Started";
          else if (del.order <= 8) status = Math.random() > 0.5 ? "In Progress" : "Not Started";
          else if (del.order <= 11) status = "Completed";
          else if (del.category === "Compliance") status = Math.random() > 0.5 ? "In Progress" : "Not Started";
          else status = Math.random() > 0.5 ? "In Progress" : "Completed";
        } else {
          if (del.order <= 1) status = Math.random() > 0.5 ? "In Progress" : "Not Started";
          else if (del.category === "Event Production") status = "Not Started";
          else if (del.category === "Marketing & Branding") status = "Completed";
          else status = "Not Started";
        }

        const isOverdue = status === "Not Started" && del.dueTiming === "before_event" && def.profile !== "high";

        await db.insert(agreementDeliverables).values({
          sponsorId,
          eventId,
          sponsorshipLevel: def.level,
          category: del.category,
          deliverableName: del.name,
          deliverableDescription: `${del.name} deliverable for ${def.name}.`,
          ownerType: del.ownerType,
          sponsorEditable: del.sponsorEditable,
          sponsorVisible: true,
          fulfillmentType: del.fulfillmentType,
          status: isOverdue ? "Overdue" : status,
          dueTiming: del.dueTiming,
          displayOrder: del.order,
          completedAt: status === "Completed" ? new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)) : undefined,
        });
        count++;
      }
    }
  }
  console.log(`[SEED] Created ${count} deliverables.`);
}

async function seedEmailLogs(
  slugToId: Map<string, string>,
  sponsorMap: Map<string, { id: string; def: SponsorDef }>,
) {
  console.log("[SEED] Creating sample email logs...");
  let count = 0;
  const emailTypes = [
    { type: "sponsor_dashboard_welcome", subject: "Welcome to Converge Concierge" },
    { type: "meeting_confirmation", subject: "Meeting Confirmed" },
    { type: "deliverables_reminder", subject: "Outstanding Deliverables Reminder" },
    { type: "info_request_confirmation", subject: "Information Request Received" },
    { type: "sponsor_access_email", subject: "Your Sponsor Dashboard Access" },
  ];

  for (const [, { id: sponsorId, def }] of sponsorMap) {
    if (def.profile === "low") continue;
    const eventId = slugToId.get(def.events[0])!;
    for (const et of emailTypes.slice(0, def.profile === "high" ? 5 : 3)) {
      await db.insert(emailLogs).values({
        emailType: et.type,
        recipientEmail: def.contactEmail,
        subject: et.subject,
        status: "sent",
        eventId,
        sponsorId,
        sentAt: new Date(Date.now() - Math.floor(Math.random() * 14 * 24 * 60 * 60 * 1000)),
      });
      count++;
    }
  }
  console.log(`[SEED] Created ${count} email logs.`);
}

async function seedBackupJobs(slugToId: Map<string, string>) {
  console.log("[SEED] Creating sample backup job records...");
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  await db.insert(backupJobs).values({
    backupType: "full",
    status: "completed",
    triggerType: "scheduled",
    r2ObjectKey: "demo/backups/full/sample/database.json",
    manifestKey: "demo/backups/full/sample/manifest.json",
    schemaVersion: 1,
    recordCount: 150,
    startedAt: twoDaysAgo,
    completedAt: new Date(twoDaysAgo.getTime() + 30000),
  });

  for (const [slug, eventId] of slugToId) {
    await db.insert(backupJobs).values({
      backupType: "event",
      status: "completed",
      triggerType: "manual",
      eventId,
      eventCode: slug,
      r2ObjectKey: `demo/backups/events/${slug}/sample/database.json`,
      manifestKey: `demo/backups/events/${slug}/sample/manifest.json`,
      schemaVersion: 1,
      recordCount: 50,
      startedAt: yesterday,
      completedAt: new Date(yesterday.getTime() + 20000),
    });
  }
  console.log("[SEED] Created 4 backup job records.");
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  DEMO SEED — Converge Concierge Demo Blueprint");
  console.log("═══════════════════════════════════════════════════════");
  const start = Date.now();

  await clearAllData();

  await seedUsers();
  const slugToId = await seedEvents();
  const sponsorMap = await seedSponsors(slugToId);
  await seedSponsorUsers(sponsorMap);
  const attendeeMap = await seedAttendees(slugToId);
  await seedMeetings(slugToId, sponsorMap, attendeeMap);
  await seedInfoRequests(slugToId, sponsorMap, attendeeMap);
  await seedDeliverables(slugToId, sponsorMap);
  await seedEmailLogs(slugToId, sponsorMap);
  await seedBackupJobs(slugToId);

  const elapsed = ((Date.now() - start) / 1000).toFixed(1);
  console.log("═══════════════════════════════════════════════════════");
  console.log(`  DEMO SEED COMPLETE in ${elapsed}s`);
  console.log(`  Events: ${DEMO_EVENTS.length}`);
  console.log(`  Sponsors: ${DEMO_SPONSORS.length}`);
  console.log(`  Attendees: ${ALL_ATTENDEES.length}`);
  console.log("═══════════════════════════════════════════════════════");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[SEED] Fatal error:", err);
    process.exit(1);
  });
