import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

function getS3Client(): S3Client {
  const endpoint = process.env.R2_ENDPOINT;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 credentials are not configured. Set R2_ENDPOINT, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY.");
  }

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function getBucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME is not configured.");
  return bucket;
}

export function sanitizeSlug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 200);
}

export interface BuildKeyParams {
  scope: "sponsor" | "admin";
  eventCode: string;
  category: string;
  filename: string;
  sponsorSlug?: string;
}

export function buildObjectKey({ scope, eventCode, category, filename, sponsorSlug }: BuildKeyParams): string {
  const ts = Date.now();
  const safeFile = sanitizeFilename(filename);
  const storedName = `${ts}-${safeFile}`;
  const safeEvent = sanitizeSlug(eventCode);
  const safeCategory = sanitizeSlug(category);

  if (scope === "admin") {
    return `events/${safeEvent}/admin/${safeCategory}/${storedName}`;
  }
  const safeSlug = sanitizeSlug(sponsorSlug ?? "unknown");
  return `events/${safeEvent}/sponsors/${safeSlug}/${safeCategory}/${storedName}`;
}

export function buildObjectKeyFlat(originalFileName: string): { objectKey: string; storedFileName: string; fileId: string } {
  const fileId = randomUUID();
  const storedFileName = sanitizeFilename(originalFileName);
  const objectKey = `file-assets/${fileId}/${storedFileName}`;
  return { objectKey, storedFileName, fileId };
}

export async function generateUploadUrl(objectKey: string, expiresInSeconds = 900): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new PutObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function generateDownloadUrl(objectKey: string, expiresInSeconds = 3600): Promise<string> {
  const client = getS3Client();
  const bucket = getBucketName();
  const command = new GetObjectCommand({ Bucket: bucket, Key: objectKey });
  return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

export async function deleteObject(objectKey: string): Promise<void> {
  const client = getS3Client();
  const bucket = getBucketName();
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
}
