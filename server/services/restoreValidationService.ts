import { downloadR2Object, checkR2ObjectExists, CURRENT_SCHEMA_VERSION } from "../backup-service";
import type { BackupManifest } from "../backup-service";
import type { BackupJob } from "@shared/schema";

export type RestoreReadiness = "ready" | "unvalidated" | "missing_manifest" | "missing_files" | "invalid_manifest" | "schema_mismatch" | "validation_failed" | "not_completed";

export interface ValidationResult {
  restoreReady: RestoreReadiness;
  manifestValid: boolean;
  filesPresent: boolean;
  schemaCompatible: boolean;
  payloadValid: boolean;
  manifest: BackupManifest | null;
  errors: string[];
  warnings: string[];
  checkedAt: string;
}

export interface BackupDetailResult {
  job: BackupJob;
  manifest: BackupManifest | null;
  restoreReady: RestoreReadiness;
  validationSummary: string;
}

const REQUIRED_MANIFEST_FIELDS = ["backup_type", "scope", "schema_version", "created_at", "data_files", "record_counts"];

const REQUIRED_DOMAINS_FULL = ["events", "sponsors", "attendees", "agreementDeliverables", "meetings", "informationRequests", "fileAssets"];
const REQUIRED_DOMAINS_EVENT = ["events", "attendees", "meetings"];
const REQUIRED_DOMAINS_SPONSOR = ["sponsors", "meetings"];

export async function loadManifest(manifestKey: string): Promise<BackupManifest | null> {
  try {
    const buf = await downloadR2Object(manifestKey);
    const parsed = JSON.parse(buf.toString("utf-8"));
    return parsed as BackupManifest;
  } catch {
    return null;
  }
}

export function validateManifestStructure(manifest: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!manifest || typeof manifest !== "object") {
    return { valid: false, errors: ["Manifest is not a valid object"] };
  }

  for (const field of REQUIRED_MANIFEST_FIELDS) {
    if (!(field in manifest)) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (manifest.data_files && !Array.isArray(manifest.data_files)) {
    errors.push("data_files must be an array");
  }

  if (manifest.record_counts && typeof manifest.record_counts !== "object") {
    errors.push("record_counts must be an object");
  }

  if (manifest.backup_type && !["full_system", "event", "sponsor_event"].includes(manifest.backup_type)) {
    errors.push(`Invalid backup_type: ${manifest.backup_type}`);
  }

  return { valid: errors.length === 0, errors };
}

export function checkSchemaCompatibility(manifest: BackupManifest): { compatible: boolean; warnings: string[] } {
  const warnings: string[] = [];

  if (manifest.schema_version > CURRENT_SCHEMA_VERSION) {
    return { compatible: false, warnings: [`Backup schema version ${manifest.schema_version} is newer than current version ${CURRENT_SCHEMA_VERSION}`] };
  }

  if (manifest.schema_version < CURRENT_SCHEMA_VERSION) {
    warnings.push(`Backup uses older schema version ${manifest.schema_version} (current: ${CURRENT_SCHEMA_VERSION}). Migration may be needed.`);
  }

  return { compatible: true, warnings };
}

export async function validateFilesExist(manifest: BackupManifest): Promise<{ allPresent: boolean; missing: string[] }> {
  const missing: string[] = [];

  for (const file of manifest.data_files) {
    const exists = await checkR2ObjectExists(file);
    if (!exists) {
      missing.push(file);
    }
  }

  return { allPresent: missing.length === 0, missing };
}

export async function validatePayloadShape(manifest: BackupManifest): Promise<{ valid: boolean; errors: string[]; warnings: string[] }> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (manifest.data_files.length === 0) {
    return { valid: false, errors: ["No data files in manifest"], warnings };
  }

  const allDomains = new Set<string>();
  const allData: Record<string, any> = {};

  for (const dataFile of manifest.data_files) {
    try {
      const buf = await downloadR2Object(dataFile);
      const parsed = JSON.parse(buf.toString("utf-8"));

      if (!parsed || typeof parsed !== "object") {
        errors.push(`Data file ${dataFile} is not a valid JSON object`);
        continue;
      }

      for (const key of Object.keys(parsed)) {
        allDomains.add(key);
        allData[key] = parsed[key];
      }
    } catch (err: any) {
      errors.push(`Failed to parse data file ${dataFile}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  if (!allData.meta || typeof allData.meta !== "object") {
    errors.push("No data file contains a meta section");
  }

  let requiredDomains: string[] = [];
  if (manifest.backup_type === "full_system") {
    requiredDomains = REQUIRED_DOMAINS_FULL;
  } else if (manifest.backup_type === "event") {
    requiredDomains = REQUIRED_DOMAINS_EVENT;
    if (!allDomains.has("event")) errors.push("Event backup missing 'event' field");
  } else if (manifest.backup_type === "sponsor_event") {
    requiredDomains = REQUIRED_DOMAINS_SPONSOR;
    if (!allDomains.has("sponsor")) errors.push("Sponsor backup missing 'sponsor' field");
  }

  for (const domain of requiredDomains) {
    if (!allDomains.has(domain)) {
      errors.push(`Required domain missing from backup data: ${domain}`);
    }
  }

  for (const [countKey, expectedCount] of Object.entries(manifest.record_counts)) {
    const dataKey = countKey === "events" && manifest.backup_type !== "full_system" ? "event" : countKey;
    if (dataKey in allData) {
      const actual = Array.isArray(allData[dataKey]) ? allData[dataKey].length : (allData[dataKey] ? 1 : 0);
      if (actual !== expectedCount) {
        warnings.push(`Record count mismatch for ${countKey}: manifest says ${expectedCount}, data has ${actual}`);
      }
    }
  }

  return { valid: errors.length === 0, errors, warnings };
}

export async function validateBackup(job: BackupJob): Promise<ValidationResult> {
  const result: ValidationResult = {
    restoreReady: "not_completed",
    manifestValid: false,
    filesPresent: false,
    schemaCompatible: false,
    payloadValid: false,
    manifest: null,
    errors: [],
    warnings: [],
    checkedAt: new Date().toISOString(),
  };

  if (job.status !== "completed") {
    result.errors.push("Backup job has not completed successfully");
    return result;
  }

  if (!job.manifestKey) {
    result.restoreReady = "missing_manifest";
    result.errors.push("No manifest key stored for this backup job (legacy backup without manifest)");
    return result;
  }

  const manifest = await loadManifest(job.manifestKey);
  if (!manifest) {
    result.restoreReady = "missing_manifest";
    result.errors.push("Manifest file not found or could not be parsed in R2");
    return result;
  }
  result.manifest = manifest;

  const structureCheck = validateManifestStructure(manifest);
  result.manifestValid = structureCheck.valid;
  if (!structureCheck.valid) {
    result.restoreReady = "invalid_manifest";
    result.errors.push(...structureCheck.errors);
    return result;
  }

  const schemaCheck = checkSchemaCompatibility(manifest);
  result.schemaCompatible = schemaCheck.compatible;
  result.warnings.push(...schemaCheck.warnings);
  if (!schemaCheck.compatible) {
    result.restoreReady = "schema_mismatch";
    result.errors.push(...schemaCheck.warnings);
    return result;
  }

  const filesCheck = await validateFilesExist(manifest);
  result.filesPresent = filesCheck.allPresent;
  if (!filesCheck.allPresent) {
    result.restoreReady = "missing_files";
    result.errors.push(...filesCheck.missing.map((f) => `Missing data file: ${f}`));
    return result;
  }

  const payloadCheck = await validatePayloadShape(manifest);
  result.payloadValid = payloadCheck.valid;
  result.warnings.push(...payloadCheck.warnings);
  if (!payloadCheck.valid) {
    result.restoreReady = "validation_failed";
    result.errors.push(...payloadCheck.errors);
    return result;
  }

  result.restoreReady = "ready";
  return result;
}

export async function getBackupDetail(job: BackupJob): Promise<BackupDetailResult> {
  let manifest: BackupManifest | null = null;
  let restoreReady: RestoreReadiness = "not_completed";
  let validationSummary = "Not validated";

  if (job.status !== "completed") {
    return { job, manifest, restoreReady, validationSummary: "Backup not completed" };
  }

  if (!job.manifestKey) {
    return { job, manifest, restoreReady: "missing_manifest", validationSummary: "Legacy backup without manifest — run a new backup to get manifest support" };
  }

  manifest = await loadManifest(job.manifestKey);
  if (!manifest) {
    return { job, manifest, restoreReady: "missing_manifest", validationSummary: "Manifest file missing from R2" };
  }

  restoreReady = "unvalidated";
  validationSummary = "Manifest found — run validation to confirm restore readiness";

  return { job, manifest, restoreReady, validationSummary };
}
