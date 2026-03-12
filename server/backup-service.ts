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

async function uploadBackupToR2(objectKey: string, data: Buffer): Promise<void> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  console.log(`[BACKUP] Uploading to R2: bucket=${bucket}, key=${objectKey} (${data.byteLength} bytes)`);

  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: objectKey,
    Body: data,
    ContentType: "application/json",
  }));

  console.log(`[BACKUP] Upload complete, verifying object exists...`);

  await client.send(new HeadObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));

  console.log(`[BACKUP] Object verified in R2: ${objectKey}`);
}

export async function streamBackupObject(objectKey: string): Promise<NodeJS.ReadableStream> {
  const client = getR2Client();
  const bucket = getR2Bucket();

  const response = await client.send(new GetObjectCommand({
    Bucket: bucket,
    Key: objectKey,
  }));

  if (!response.Body) {
    throw new Error("Backup file not found in R2 storage");
  }

  if (response.Body instanceof Readable) {
    return response.Body;
  }

  const webStream = response.Body as ReadableStream;
  return Readable.fromWeb(webStream as any);
}

function nowKey(): string {
  return new Date().toISOString().replace(/[:.]/g, "").replace("T", "T").slice(0, 17) + "Z";
}

function buildObjectKey(type: "full" | "event" | "sponsor_event", eventCode?: string, sponsorSlug?: string): string {
  const ts = nowKey();
  if (type === "full") return `backups/full/full-backup-${ts}.json`;
  if (type === "event") return `backups/events/${eventCode}/event-${eventCode}-backup-${ts}.json`;
  return `backups/sponsors/${eventCode}/${sponsorSlug}/sponsor-${eventCode}-${sponsorSlug}-backup-${ts}.json`;
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
    startedAt: new Date(),
    createdAt: new Date(),
  }).returning();
  return job;
}

async function completeJob(id: string, result: { objectKey: string; fileSizeBytes: number; recordCount: number }) {
  await db.update(backupJobs).set({
    status: "completed",
    r2ObjectKey: result.objectKey,
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

export async function runFullBackup(triggerType: "manual" | "scheduled" = "manual"): Promise<BackupJob> {
  const job = await createJobRecord({ backupType: "full", triggerType });
  console.log(`[BACKUP] Starting full backup (job ${job.id})`);

  try {
    console.log(`[BACKUP] Creating JSON snapshot...`);
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

    const payload = {
      meta: {
        backupType: "full",
        generatedAt: new Date().toISOString(),
        version: "1",
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
      fileAssets: allFileAssets,
      deliverableLinks: allDeliverableLinks,
      deliverableSocialEntries: allSocialEntries,
    };

    const json = JSON.stringify(payload, null, 2);
    const buf = Buffer.from(json, "utf-8");
    const objectKey = buildObjectKey("full");

    console.log(`[BACKUP] Uploading to R2...`);
    await uploadBackupToR2(objectKey, buf);

    const recordCount =
      allEvents.length + allSponsors.length + allAttendees.length +
      allMeetings.length + allInfoRequests.length + allDeliverables.length +
      allFileAssets.length;

    await completeJob(job.id, { objectKey, fileSizeBytes: buf.byteLength, recordCount });
    console.log(`[BACKUP] Full backup completed: ${objectKey} (${buf.byteLength} bytes, ${recordCount} records)`);

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

  const job = await createJobRecord({
    backupType: "event",
    triggerType,
    eventId,
    eventCode: eventRow.slug ?? eventRow.id,
  });
  const eventCode = eventRow.slug ?? eventRow.id;
  console.log(`[BACKUP] Starting event backup for ${eventCode} (job ${job.id})`);

  try {
    console.log(`[BACKUP] Creating JSON snapshot for event ${eventCode}...`);
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

    const payload = {
      meta: {
        backupType: "event",
        eventId,
        eventCode,
        generatedAt: new Date().toISOString(),
        version: "1",
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

    const json = JSON.stringify(payload, null, 2);
    const buf = Buffer.from(json, "utf-8");
    const objectKey = buildObjectKey("event", eventCode);

    console.log(`[BACKUP] Uploading event backup to R2...`);
    await uploadBackupToR2(objectKey, buf);

    const recordCount =
      eventAttendees.length + eventMeetings.length + eventInfoRequests.length +
      eventDeliverables.length + eventFileAssets.length;

    await completeJob(job.id, { objectKey, fileSizeBytes: buf.byteLength, recordCount });
    console.log(`[BACKUP] Event backup completed: ${objectKey} (${buf.byteLength} bytes)`);

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
    console.log(`[BACKUP] Creating JSON snapshot for sponsor ${sponsorSlug}...`);
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

    const payload = {
      meta: {
        backupType: "sponsor_event",
        sponsorId,
        sponsorSlug,
        eventId,
        eventCode,
        generatedAt: new Date().toISOString(),
        version: "1",
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

    const json = JSON.stringify(payload, null, 2);
    const buf = Buffer.from(json, "utf-8");
    const objectKey = buildObjectKey("sponsor_event", eventCode, sponsorSlug);

    console.log(`[BACKUP] Uploading sponsor backup to R2...`);
    await uploadBackupToR2(objectKey, buf);

    const recordCount =
      sponsorMeetings.length + sponsorInfoRequests.length +
      sponsorDeliverables.length + sponsorFileAssets.length;

    await completeJob(job.id, { objectKey, fileSizeBytes: buf.byteLength, recordCount });
    console.log(`[BACKUP] Sponsor backup completed: ${objectKey} (${buf.byteLength} bytes)`);

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
