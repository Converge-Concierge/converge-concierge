import { db } from "../db";
import { downloadR2Object } from "../backup-service";
import type { BackupManifest } from "../backup-service";
import { loadManifest, validateBackup } from "./restoreValidationService";
import type { BackupJob } from "@shared/schema";
import {
  events, sponsors, attendees, meetings, informationRequests,
  agreementDeliverables, agreementDeliverableRegistrants,
  agreementDeliverableSpeakers, agreementDeliverableReminders,
  fileAssets, deliverableLinks, deliverableSocialEntries,
  sponsorUsers, emailTemplates,
} from "@shared/schema";
import { eq } from "drizzle-orm";

export interface ConflictEntry {
  domain: string;
  id: string;
  identifier: string;
  existsInDb: boolean;
}

export interface DryRunResult {
  valid: boolean;
  backupType: string;
  scope: string;
  schemaVersion: number;
  createdAt: string;
  entityCounts: Record<string, number>;
  conflicts: ConflictEntry[];
  conflictSummary: string;
  restoreOrder: string[];
  errors: string[];
  warnings: string[];
}

const RESTORE_ORDER_FULL = [
  "settings",
  "branding",
  "events",
  "sponsors",
  "sponsorUsers",
  "attendees",
  "emailTemplates",
  "agreementDeliverables",
  "agreementDeliverableRegistrants",
  "agreementDeliverableSpeakers",
  "agreementDeliverableReminders",
  "meetings",
  "informationRequests",
  "deliverableLinks",
  "deliverableSocialEntries",
  "fileAssets",
];

const RESTORE_ORDER_EVENT = [
  "event",
  "sponsors",
  "attendees",
  "agreementDeliverables",
  "agreementDeliverableReminders",
  "meetings",
  "informationRequests",
  "fileAssets",
];

const RESTORE_ORDER_SPONSOR = [
  "sponsor",
  "event",
  "sponsorUsers",
  "agreementDeliverables",
  "agreementDeliverableRegistrants",
  "agreementDeliverableSpeakers",
  "agreementDeliverableReminders",
  "meetings",
  "informationRequests",
  "deliverableLinks",
  "deliverableSocialEntries",
  "fileAssets",
];

async function checkExistingRecords(domain: string, ids: string[]): Promise<Set<string>> {
  const existing = new Set<string>();
  if (ids.length === 0) return existing;

  const tableMap: Record<string, any> = {
    events,
    sponsors,
    attendees,
    meetings,
    informationRequests,
    agreementDeliverables,
    fileAssets,
    sponsorUsers,
    emailTemplates,
  };

  const table = tableMap[domain];
  if (!table) return existing;

  try {
    const rows = await db.select({ id: table.id }).from(table);
    const dbIds = new Set(rows.map((r: any) => r.id));
    for (const id of ids) {
      if (dbIds.has(id)) existing.add(id);
    }
  } catch {
    // table might not have simple id lookup
  }

  return existing;
}

function extractIds(data: any, key: string): string[] {
  if (!data[key]) return [];
  if (Array.isArray(data[key])) {
    return data[key].map((r: any) => r.id).filter(Boolean);
  }
  if (data[key]?.id) return [data[key].id];
  return [];
}

function extractIdentifier(data: any, key: string): Map<string, string> {
  const map = new Map<string, string>();
  if (!data[key]) return map;

  if (Array.isArray(data[key])) {
    for (const r of data[key]) {
      const ident = r.slug || r.code || r.email || r.name || r.id || "unknown";
      map.set(r.id, ident);
    }
  } else if (data[key]?.id) {
    const r = data[key];
    map.set(r.id, r.slug || r.code || r.email || r.name || r.id || "unknown");
  }

  return map;
}

export async function dryRunRestore(job: BackupJob): Promise<DryRunResult> {
  const result: DryRunResult = {
    valid: false,
    backupType: "",
    scope: "",
    schemaVersion: 0,
    createdAt: "",
    entityCounts: {},
    conflicts: [],
    conflictSummary: "",
    restoreOrder: [],
    errors: [],
    warnings: [],
  };

  if (job.status !== "completed") {
    result.errors.push("Backup job has not completed successfully");
    return result;
  }

  if (!job.manifestKey) {
    result.errors.push("No manifest key — legacy backup without manifest support");
    return result;
  }

  const validation = await validateBackup(job);
  if (validation.restoreReady !== "ready") {
    result.errors.push(`Backup not restore-ready: ${validation.restoreReady}`);
    result.errors.push(...validation.errors);
    return result;
  }

  const manifest = validation.manifest!;
  result.backupType = manifest.backup_type;
  result.scope = manifest.scope;
  result.schemaVersion = manifest.schema_version;
  result.createdAt = manifest.created_at;
  result.entityCounts = { ...manifest.record_counts };

  if (manifest.backup_type === "full_system") {
    result.restoreOrder = RESTORE_ORDER_FULL;
  } else if (manifest.backup_type === "event") {
    result.restoreOrder = RESTORE_ORDER_EVENT;
  } else {
    result.restoreOrder = RESTORE_ORDER_SPONSOR;
  }

  const mainDataFile = manifest.data_files[0];
  let data: any;
  try {
    const buf = await downloadR2Object(mainDataFile);
    data = JSON.parse(buf.toString("utf-8"));
  } catch (err: any) {
    result.errors.push(`Failed to load data file: ${err.message}`);
    return result;
  }

  const conflictDomains = manifest.backup_type === "full_system"
    ? ["events", "sponsors", "attendees", "meetings", "informationRequests", "agreementDeliverables", "fileAssets", "sponsorUsers", "emailTemplates"]
    : manifest.backup_type === "event"
    ? ["attendees", "meetings", "informationRequests", "agreementDeliverables", "fileAssets"]
    : ["meetings", "informationRequests", "agreementDeliverables", "fileAssets", "sponsorUsers"];

  for (const domain of conflictDomains) {
    const dataKey = domain === "events" && manifest.backup_type !== "full_system" ? "event" : domain;
    const ids = extractIds(data, dataKey);
    const identifiers = extractIdentifier(data, dataKey);

    if (ids.length === 0) continue;

    const existing = await checkExistingRecords(domain, ids);

    for (const id of ids) {
      if (existing.has(id)) {
        result.conflicts.push({
          domain,
          id,
          identifier: identifiers.get(id) || id,
          existsInDb: true,
        });
      }
    }
  }

  if (manifest.backup_type === "event" && data.event?.id) {
    try {
      const [existingEvent] = await db.select({ id: events.id }).from(events).where(eq(events.id, data.event.id)).limit(1);
      if (existingEvent) {
        result.conflicts.push({
          domain: "events",
          id: data.event.id,
          identifier: data.event.slug || data.event.code || data.event.name || data.event.id,
          existsInDb: true,
        });
      }
    } catch {}
  }

  if (manifest.backup_type === "sponsor_event" && data.sponsor?.id) {
    try {
      const [existingSponsor] = await db.select({ id: sponsors.id }).from(sponsors).where(eq(sponsors.id, data.sponsor.id)).limit(1);
      if (existingSponsor) {
        result.conflicts.push({
          domain: "sponsors",
          id: data.sponsor.id,
          identifier: data.sponsor.name || data.sponsor.id,
          existsInDb: true,
        });
      }
    } catch {}
  }

  const uniqueConflicts = result.conflicts.filter(
    (c, i, arr) => arr.findIndex((x) => x.domain === c.domain && x.id === c.id) === i
  );
  result.conflicts = uniqueConflicts;

  const conflictsByDomain: Record<string, number> = {};
  for (const c of result.conflicts) {
    conflictsByDomain[c.domain] = (conflictsByDomain[c.domain] || 0) + 1;
  }
  result.conflictSummary = result.conflicts.length === 0
    ? "No conflicts detected"
    : `${result.conflicts.length} conflict(s): ${Object.entries(conflictsByDomain).map(([d, n]) => `${n} ${d}`).join(", ")}`;

  if (result.conflicts.length > 0) {
    result.warnings.push("Existing records will need to be handled during restore (skip, merge, or replace)");
  }

  result.valid = result.errors.length === 0;
  result.warnings.push(...validation.warnings);

  return result;
}
