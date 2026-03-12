import { db } from "./db";
import {
  events, sponsors, attendees, meetings, informationRequests,
  emailTemplates, emailLogs, agreementPackageTemplates,
  agreementDeliverableTemplateItems, agreementDeliverables,
  agreementDeliverableRegistrants, agreementDeliverableSpeakers,
  agreementDeliverableReminders, fileAssets, deliverableLinks,
  deliverableSocialEntries, sponsorUsers, backupJobs,
  appConfig,
} from "@shared/schema";
import type { BackupJob } from "@shared/schema";
import { eq, and, desc, gte } from "drizzle-orm";
import { S3Client, PutObjectCommand, HeadObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { sanitizeSlug } from "./services/fileStorageService";
import { randomUUID } from "crypto";
import { Readable } from "stream";

export const CURRENT_SCHEMA_VERSION = 1;

function getR2Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getR2Bucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured.");
  return bucket;
}

async function uploadToR2(objectKey: string, data: Buffer, contentType = "application/json"): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: data,
    ContentType: contentType,
  }));

  await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));
}

export async function streamR2Object(objectKey: string): Promise<NodeJS.ReadableStream> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));

  if (!response.Body) {
    throw new Error("Object not found in R2 storage");
  }

  if (response.Body instanceof Readable) {
    return response.Body;
  }

  const webStream = response.Body as ReadableStream;
  return Readable.fromWeb(webStream as any);
}

export async function downloadR2Object(objectKey: string): Promise<Buffer> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));

  if (!response.Body) {
    throw new Error("Object not found in R2 storage");
  }

  const chunks: Uint8Array[] = [];
  let stream: NodeJS.ReadableStream;

  if (response.Body instanceof Readable) {
    stream = response.Body;
  } else {
    stream = Readable.fromWeb(response.Body as any);
  }

  for await (const chunk of stream) {
    chunks.push(chunk);
  }

  return Buffer.concat(chunks);
}

export async function checkR2ObjectExists(objectKey: string): Promise<boolean> {
  try {
    const client = getR2Client();
    const bucket = getR2Bucket();
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: objectKey }));
    return true;
  } catch {
    return false;
  }
}

export interface BackupManifest {
  backup_type: "full_system" | "event" | "sponsor_event";
  scope: "global" | "event" | "sponsor_event";
  schema_version: number;
  created_at: string;
  job_id: string;
  event_code?: string;
  sponsor_slug?: string;
  data_files: string[];
  record_counts: Record<string, number>;
}

function nowTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "").slice(0, 17) + "Z";
}

function buildFolderPrefix(type: "full" | "event" | "sponsor_event", eventCode?: string, sponsorSlug?: string): string {
  const ts = nowTimestamp();
  if (type === "full") return `backups/full/${ts}/`;
  if (type === "event") return `backups/events/${eventCode}/${ts}/`;
  return `backups/sponsors/${eventCode}/${sponsorSlug}/${ts}/`;
}

async function createJobRecord(params: {
  backupType: "full" | "event" | "sponsor_event";
  triggerType: "manual" | "scheduled";
  eventId?: string;
  eventCode?: string;
  sponsorId?: string;
  sponsorSlug?: string;
}): Promise<BackupJob> {
  const [job] = await db.insert(backupJobs).values({
    id: randomUUID(),
    backupType: params.backupType,
    status: "in_progress",
    triggerType: params.triggerType,
    eventId: params.eventId ?? null,
    eventCode: params.eventCode ?? null,
    sponsorId: params.sponsorId ?? null,
    sponsorSlug: params.sponsorSlug ?? null,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    startedAt: new Date(),
    createdAt: new Date(),
  }).returning();
  return job;
}

async function completeJob(id: string, result: {
  r2ObjectKey: string;
  manifestKey: string;
  fileSizeBytes: number;
  recordCount: number;
}) {
  await db.update(backupJobs).set({
    status: "completed",
    r2ObjectKey: result.r2ObjectKey,
    manifestKey: result.manifestKey,
    fileSizeBytes: result.fileSizeBytes,
    recordCount: result.recordCount,
    completedAt: new Date(),
  }).where(eq(backupJobs.id, id));
}

async function failJob(id: string, errorMessage: string) {
  await db.update(backupJobs).set({
    status: "failed",
    errorMessage,
    completedAt: new Date(),
  }).where(eq(backupJobs.id, id));
}

async function uploadMultipleFiles(folder: string, files: { name: string; data: any }[]): Promise<{ totalBytes: number; keys: string[] }> {
  let totalBytes = 0;
  const keys: string[] = [];

  for (const file of files) {
    const json = JSON.stringify(file.data, null, 2);
    const buf = Buffer.from(json, "utf-8");
    const key = `${folder}${file.name}`;
    console.log(`[BACKUP] Uploading ${key} (${buf.byteLength} bytes)`);
    await uploadToR2(key, buf);
    totalBytes += buf.byteLength;
    keys.push(key);
  }

  return { totalBytes, keys };
}

export async function runFullBackup(triggerType: "manual" | "scheduled" = "manual"): Promise<BackupJob> {
  const job = await createJobRecord({ backupType: "full", triggerType });
  console.log(`[BACKUP] Starting full backup (job ${job.id})`);

  try {
    const [
      allEvents, allSponsors, allAttendees, allMeetings,
      allInfoRequests, allEmailTemplates, recentEmailLogs,
      allPackageTemplates, allDeliverableTemplateItems,
      allDeliverables, allRegistrants, allSpeakers,
      allDeliverableReminders, allFileAssets, allDeliverableLinks,
      allSocialEntries, allSponsorUsers, configRows,
    ] = await Promise.all([
      db.select().from(events),
      db.select().from(sponsors),
      db.select().from(attendees),
      db.select().from(meetings),
      db.select().from(informationRequests),
      db.select().from(emailTemplates),
      db.select().from(emailLogs).where(gte(emailLogs.sentAt, new Date(Date.now() - 90 * 24 * 60 * 60 * 1000))).orderBy(desc(emailLogs.sentAt)),
      db.select().from(agreementPackageTemplates),
      db.select().from(agreementDeliverableTemplateItems),
      db.select().from(agreementDeliverables),
      db.select().from(agreementDeliverableRegistrants),
      db.select().from(agreementDeliverableSpeakers),
      db.select().from(agreementDeliverableReminders),
      db.select().from(fileAssets),
      db.select().from(deliverableLinks),
      db.select().from(deliverableSocialEntries),
      db.select().from(sponsorUsers),
      db.select().from(appConfig),
    ]);

    const settings = configRows.find((r) => r.key === "settings")?.value ?? null;
    const branding = configRows.find((r) => r.key === "branding")?.value ?? null;

    const folder = buildFolderPrefix("full");

    const recordCounts: Record<string, number> = {
      events: allEvents.length,
      sponsors: allSponsors.length,
      attendees: allAttendees.length,
      meetings: allMeetings.length,
      informationRequests: allInfoRequests.length,
      emailTemplates: allEmailTemplates.length,
      emailLogs: recentEmailLogs.length,
      packageTemplates: allPackageTemplates.length,
      deliverableTemplateItems: allDeliverableTemplateItems.length,
      agreementDeliverables: allDeliverables.length,
      agreementDeliverableRegistrants: allRegistrants.length,
      agreementDeliverableSpeakers: allSpeakers.length,
      agreementDeliverableReminders: allDeliverableReminders.length,
      deliverableLinks: allDeliverableLinks.length,
      deliverableSocialEntries: allSocialEntries.length,
      sponsorUsers: allSponsorUsers.length,
      fileAssets: allFileAssets.length,
    };

    const databasePayload = {
      meta: {
        backupType: "full",
        generatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        jobId: job.id,
      },
      settings,
      branding,
      events: allEvents,
      sponsors: allSponsors,
      sponsorUsers: allSponsorUsers,
      attendees: allAttendees,
      meetings: allMeetings,
      informationRequests: allInfoRequests,
      emailTemplates: allEmailTemplates,
      emailLogs: recentEmailLogs,
      packageTemplates: allPackageTemplates,
      deliverableTemplateItems: allDeliverableTemplateItems,
      agreementDeliverables: allDeliverables,
      agreementDeliverableRegistrants: allRegistrants,
      agreementDeliverableSpeakers: allSpeakers,
      agreementDeliverableReminders: allDeliverableReminders,
      deliverableLinks: allDeliverableLinks,
      deliverableSocialEntries: allSocialEntries,
    };

    const fileMetadataPayload = {
      meta: {
        backupType: "full_file_metadata",
        generatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        jobId: job.id,
      },
      fileAssets: allFileAssets,
    };

    const dataFiles = [
      `${folder}database.json`,
      `${folder}file-metadata.json`,
    ];

    const manifest: BackupManifest = {
      backup_type: "full_system",
      scope: "global",
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: new Date().toISOString(),
      job_id: job.id,
      data_files: dataFiles,
      record_counts: recordCounts,
    };

    const { totalBytes } = await uploadMultipleFiles(folder, [
      { name: "database.json", data: databasePayload },
      { name: "file-metadata.json", data: fileMetadataPayload },
      { name: "manifest.json", data: manifest },
    ]);

    const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
    const manifestKey = `${folder}manifest.json`;

    await completeJob(job.id, {
      r2ObjectKey: `${folder}database.json`,
      manifestKey,
      fileSizeBytes: totalBytes,
      recordCount: totalRecords,
    });

    console.log(`[BACKUP] Full backup completed: ${folder} (${totalBytes} bytes, ${totalRecords} records)`);

    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    console.error(`[BACKUP] Full backup FAILED: ${errorMsg}`);
    await failJob(job.id, errorMsg);
    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  }
}

export async function runEventBackup(eventId: string, triggerType: "manual" | "scheduled" = "manual"): Promise<BackupJob> {
  const [eventRow] = await db.select().from(events).where(eq(events.id, eventId)).limit(1);
  if (!eventRow) throw new Error(`Event ${eventId} not found`);

  const eventCode = eventRow.slug ?? eventRow.id;
  const job = await createJobRecord({
    backupType: "event",
    triggerType,
    eventId,
    eventCode,
  });
  console.log(`[BACKUP] Starting event backup for ${eventCode} (job ${job.id})`);

  try {
    const [
      eventAttendees, eventMeetings, eventInfoRequests,
      eventDeliverables, eventFileAssets, eventDeliverableReminders,
    ] = await Promise.all([
      db.select().from(attendees).where(eq(attendees.assignedEvent, eventId)),
      db.select().from(meetings).where(eq(meetings.eventId, eventId)),
      db.select().from(informationRequests).where(eq(informationRequests.eventId, eventId)),
      db.select().from(agreementDeliverables).where(eq(agreementDeliverables.eventId, eventId)),
      db.select().from(fileAssets).where(eq(fileAssets.eventId, eventId)),
      db.select().from(agreementDeliverableReminders).where(eq(agreementDeliverableReminders.eventId, eventId)),
    ]);

    const sponsorIdSet = new Set<string>([
      ...eventMeetings.map((m) => m.sponsorId).filter(Boolean),
      ...eventInfoRequests.map((r) => r.sponsorId).filter(Boolean),
      ...eventDeliverables.map((d) => d.sponsorId).filter(Boolean),
    ] as string[]);

    const allSponsors = sponsorIdSet.size > 0
      ? await db.select().from(sponsors).then((rows) => rows.filter((s) => sponsorIdSet.has(s.id)))
      : [];

    const folder = buildFolderPrefix("event", eventCode);

    const recordCounts: Record<string, number> = {
      events: 1,
      sponsors: allSponsors.length,
      attendees: eventAttendees.length,
      meetings: eventMeetings.length,
      informationRequests: eventInfoRequests.length,
      agreementDeliverables: eventDeliverables.length,
      agreementDeliverableReminders: eventDeliverableReminders.length,
      fileAssets: eventFileAssets.length,
    };

    const eventPayload = {
      meta: {
        backupType: "event",
        eventId,
        eventCode,
        generatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        jobId: job.id,
      },
      event: eventRow,
      attendees: eventAttendees,
      sponsors: allSponsors,
      meetings: eventMeetings,
      informationRequests: eventInfoRequests,
      agreementDeliverables: eventDeliverables,
      agreementDeliverableReminders: eventDeliverableReminders,
      fileAssets: eventFileAssets,
    };

    const dataFiles = [`${folder}event.json`];

    const manifest: BackupManifest = {
      backup_type: "event",
      scope: "event",
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: new Date().toISOString(),
      job_id: job.id,
      event_code: eventCode,
      data_files: dataFiles,
      record_counts: recordCounts,
    };

    const { totalBytes } = await uploadMultipleFiles(folder, [
      { name: "event.json", data: eventPayload },
      { name: "manifest.json", data: manifest },
    ]);

    const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
    const manifestKey = `${folder}manifest.json`;

    await completeJob(job.id, {
      r2ObjectKey: `${folder}event.json`,
      manifestKey,
      fileSizeBytes: totalBytes,
      recordCount: totalRecords,
    });

    console.log(`[BACKUP] Event backup completed: ${folder} (${totalBytes} bytes)`);

    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    console.error(`[BACKUP] Event backup FAILED for ${eventCode}: ${errorMsg}`);
    await failJob(job.id, errorMsg);
    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  }
}

export async function runSponsorEventBackup(sponsorId: string, eventId: string, triggerType: "manual" | "scheduled" = "manual"): Promise<BackupJob> {
  const [[sponsorRow], [eventRow]] = await Promise.all([
    db.select().from(sponsors).where(eq(sponsors.id, sponsorId)).limit(1),
    db.select().from(events).where(eq(events.id, eventId)).limit(1),
  ]);

  if (!sponsorRow) throw new Error(`Sponsor ${sponsorId} not found`);
  if (!eventRow) throw new Error(`Event ${eventId} not found`);

  const eventCode = eventRow.slug ?? eventRow.id;
  const sponsorSlug = sanitizeSlug(sponsorRow.name);

  const job = await createJobRecord({
    backupType: "sponsor_event",
    triggerType,
    eventId,
    eventCode,
    sponsorId,
    sponsorSlug,
  });
  console.log(`[BACKUP] Starting sponsor backup for ${sponsorSlug}/${eventCode} (job ${job.id})`);

  try {
    const [
      sponsorMeetings, sponsorInfoRequests, sponsorDeliverables,
      sponsorFileAssets, sponsorSponsorUsers, sponsorDeliverableReminders,
    ] = await Promise.all([
      db.select().from(meetings).where(and(eq(meetings.sponsorId, sponsorId), eq(meetings.eventId, eventId))),
      db.select().from(informationRequests).where(and(eq(informationRequests.sponsorId, sponsorId), eq(informationRequests.eventId, eventId))),
      db.select().from(agreementDeliverables).where(and(eq(agreementDeliverables.sponsorId, sponsorId), eq(agreementDeliverables.eventId, eventId))),
      db.select().from(fileAssets).where(and(eq(fileAssets.sponsorId, sponsorId), eq(fileAssets.eventId, eventId))),
      db.select().from(sponsorUsers).where(eq(sponsorUsers.sponsorId, sponsorId)),
      db.select().from(agreementDeliverableReminders).where(and(eq(agreementDeliverableReminders.sponsorId, sponsorId), eq(agreementDeliverableReminders.eventId, eventId))),
    ]);

    const deliverableIds = sponsorDeliverables.map((d) => d.id);
    const [allRegistrants, allSpeakers, allLinks, allSocial] = deliverableIds.length > 0
      ? await Promise.all([
          db.select().from(agreementDeliverableRegistrants),
          db.select().from(agreementDeliverableSpeakers),
          db.select().from(deliverableLinks),
          db.select().from(deliverableSocialEntries),
        ]).then(([r, s, l, se]) => [
          r.filter((x) => deliverableIds.includes(x.deliverableId)),
          s.filter((x) => deliverableIds.includes(x.deliverableId)),
          l.filter((x) => deliverableIds.includes(x.deliverableId)),
          se.filter((x) => deliverableIds.includes(x.deliverableId)),
        ])
      : [[], [], [], []];

    const folder = buildFolderPrefix("sponsor_event", eventCode, sponsorSlug);

    const recordCounts: Record<string, number> = {
      sponsors: 1,
      sponsorUsers: sponsorSponsorUsers.length,
      meetings: sponsorMeetings.length,
      informationRequests: sponsorInfoRequests.length,
      agreementDeliverables: sponsorDeliverables.length,
      agreementDeliverableRegistrants: allRegistrants.length,
      agreementDeliverableSpeakers: allSpeakers.length,
      agreementDeliverableReminders: sponsorDeliverableReminders.length,
      deliverableLinks: allLinks.length,
      deliverableSocialEntries: allSocial.length,
      fileAssets: sponsorFileAssets.length,
    };

    const sponsorPayload = {
      meta: {
        backupType: "sponsor_event",
        sponsorId,
        sponsorSlug,
        eventId,
        eventCode,
        generatedAt: new Date().toISOString(),
        schemaVersion: CURRENT_SCHEMA_VERSION,
        jobId: job.id,
      },
      sponsor: sponsorRow,
      event: eventRow,
      sponsorUsers: sponsorSponsorUsers,
      meetings: sponsorMeetings,
      informationRequests: sponsorInfoRequests,
      agreementDeliverables: sponsorDeliverables,
      agreementDeliverableRegistrants: allRegistrants,
      agreementDeliverableSpeakers: allSpeakers,
      agreementDeliverableReminders: sponsorDeliverableReminders,
      deliverableLinks: allLinks,
      deliverableSocialEntries: allSocial,
      fileAssets: sponsorFileAssets,
    };

    const dataFiles = [`${folder}sponsor.json`];

    const manifest: BackupManifest = {
      backup_type: "sponsor_event",
      scope: "sponsor_event",
      schema_version: CURRENT_SCHEMA_VERSION,
      created_at: new Date().toISOString(),
      job_id: job.id,
      event_code: eventCode,
      sponsor_slug: sponsorSlug,
      data_files: dataFiles,
      record_counts: recordCounts,
    };

    const { totalBytes } = await uploadMultipleFiles(folder, [
      { name: "sponsor.json", data: sponsorPayload },
      { name: "manifest.json", data: manifest },
    ]);

    const totalRecords = Object.values(recordCounts).reduce((a, b) => a + b, 0);
    const manifestKey = `${folder}manifest.json`;

    await completeJob(job.id, {
      r2ObjectKey: `${folder}sponsor.json`,
      manifestKey,
      fileSizeBytes: totalBytes,
      recordCount: totalRecords,
    });

    console.log(`[BACKUP] Sponsor backup completed: ${folder} (${totalBytes} bytes)`);

    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  } catch (err: any) {
    const errorMsg = err?.message ?? String(err);
    console.error(`[BACKUP] Sponsor backup FAILED for ${sponsorSlug}/${eventCode}: ${errorMsg}`);
    await failJob(job.id, errorMsg);
    const [updated] = await db.select().from(backupJobs).where(eq(backupJobs.id, job.id));
    return updated;
  }
}

export async function listBackupJobs(limit = 100): Promise<BackupJob[]> {
  return db.select().from(backupJobs).orderBy(desc(backupJobs.createdAt)).limit(limit);
}

export async function getBackupJob(jobId: string): Promise<BackupJob | null> {
  const [job] = await db.select().from(backupJobs).where(eq(backupJobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function getBackupObjectKey(jobId: string): Promise<string> {
  const [job] = await db.select().from(backupJobs).where(eq(backupJobs.id, jobId)).limit(1);
  if (!job || !job.r2ObjectKey) throw new Error("Backup not found or has no file");
  return job.r2ObjectKey;
}

const NIGHTLY_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const BACKUP_HOUR_UTC = 3;

let lastNightlyRunDate: string | null = null;

async function runNightlyBackup(): Promise<void> {
  const now = new Date();
  const hour = now.getUTCHours();
  const dateKey = now.toISOString().slice(0, 10);

  if (hour !== BACKUP_HOUR_UTC) return;
  if (lastNightlyRunDate === dateKey) return;

  lastNightlyRunDate = dateKey;
  console.log(`[BACKUP] Starting scheduled nightly backups for ${dateKey}`);

  try {
    await runFullBackup("scheduled");
    console.log("[BACKUP] Nightly full backup completed");
  } catch (err: any) {
    console.error("[BACKUP] Nightly full backup failed:", err?.message ?? err);
  }

  try {
    const allEvents = await db.select().from(events);
    for (const event of allEvents) {
      try {
        await runEventBackup(event.id, "scheduled");
        console.log(`[BACKUP] Nightly event backup completed: ${event.slug}`);
      } catch (err: any) {
        console.error(`[BACKUP] Nightly event backup failed for ${event.slug}:`, err?.message ?? err);
      }
    }
  } catch (err: any) {
    console.error("[BACKUP] Nightly event backups failed:", err?.message ?? err);
  }
}

export function startBackupScheduler(): void {
  console.log("[BACKUP] Starting nightly backup scheduler (checks hourly, fires at 3am UTC)");
  setInterval(runNightlyBackup, NIGHTLY_CHECK_INTERVAL_MS);
}
