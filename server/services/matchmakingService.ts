import type { Attendee, Sponsor, AttendeeCategory } from "@shared/schema";

const CATEGORY_WEIGHTS: Record<string, number> = {
  PRACTITIONER: 100,
  GOVERNMENT_NONPROFIT: 70,
  SOLUTION_PROVIDER: 20,
};

export function normalizeAttendeeCategory(ticketType: string | null | undefined): AttendeeCategory | null {
  if (!ticketType) return null;
  const t = ticketType.toLowerCase();
  if (t.includes("practitioner")) return "PRACTITIONER";
  if (t.includes("government") || t.includes("non-profit") || t.includes("nonprofit")) return "GOVERNMENT_NONPROFIT";
  if (t.includes("solution provider")) return "SOLUTION_PROVIDER";
  return null;
}

export function categoryLabel(cat: string | null | undefined): string {
  if (!cat) return "Unknown";
  switch (cat) {
    case "PRACTITIONER": return "Practitioner";
    case "GOVERNMENT_NONPROFIT": return "Government / Non-Profit";
    case "SOLUTION_PROVIDER": return "Solution Provider";
    default: return cat;
  }
}

export interface MatchResult {
  attendee: Attendee;
  score: number;
  reasons: string[];
}

export function computeMatchScore(
  attendee: Attendee,
  sponsor: Sponsor,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  const cat = attendee.attendeeCategory || null;
  if (cat && CATEGORY_WEIGHTS[cat]) {
    score += CATEGORY_WEIGHTS[cat];
    if (cat === "PRACTITIONER") {
      reasons.push("Practitioner attendee");
    } else if (cat === "GOVERNMENT_NONPROFIT") {
      reasons.push("Government / Non-Profit attendee");
    }
  }

  const sponsorAttrs = (sponsor.attributes as string[]) || [];
  const attendeeInterests = attendee.interests || [];
  if (sponsorAttrs.length > 0 && attendeeInterests.length > 0) {
    const sponsorSet = new Set(sponsorAttrs.map(a => a.toLowerCase()));
    const matched = attendeeInterests.filter(i => sponsorSet.has(i.toLowerCase()));
    if (matched.length > 0) {
      score += matched.length * 15;
      reasons.push(`Interested in ${matched.slice(0, 2).join(", ")}`);
    }
  }

  const title = (attendee.title || "").toLowerCase();
  const seniorKeywords = ["vp", "vice president", "director", "chief", "cto", "cfo", "cio", "ceo", "svp", "evp", "head of", "president", "treasurer"];
  if (seniorKeywords.some(kw => title.includes(kw))) {
    score += 10;
    reasons.push("Senior leadership role");
  }

  return { score, reasons };
}

export function rankAttendees(
  attendees: Attendee[],
  sponsor: Sponsor,
): MatchResult[] {
  return attendees
    .map(attendee => {
      const { score, reasons } = computeMatchScore(attendee, sponsor);
      return { attendee, score, reasons };
    })
    .sort((a, b) => b.score - a.score);
}
