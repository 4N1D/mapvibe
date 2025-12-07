import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (s3Client) return s3Client;

  s3Client = new S3Client({
    region: process.env.AWS_REGION || "us-east-1",
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  });

  return s3Client;
}

export const S3_PHOTOS_BUCKET = process.env.S3_PHOTOS_BUCKET || "mapvibe-photos-mvp";
export const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "";

export interface PresignedUrlResult {
  uploadUrl: string;
  s3Key: string;
  cdnUrl: string;
  expiresIn: number;
}

export async function getPresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 300
): Promise<PresignedUrlResult> {
  const client = getS3Client();

  // Add photos/ prefix to S3 key to match CloudFront path pattern
  const s3Key = key;

  const command = new PutObjectCommand({
    Bucket: S3_PHOTOS_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(client, command, {
    expiresIn,
    signableHeaders: new Set(["host", "content-type"]),
  });
  const cdnUrl = CLOUDFRONT_DOMAIN
    ? `https://${CLOUDFRONT_DOMAIN}/${s3Key}`
    : `https://${S3_PHOTOS_BUCKET}.s3.${process.env.AWS_REGION || "us-east-1"}.amazonaws.com/${s3Key}`;

  return {
    uploadUrl,
    s3Key,
    cdnUrl,
    expiresIn,
  };
}

export function generatePhotoKey(
  userId: string,
  photoType: string,
  extension: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${photoType}/${userId}/${timestamp}-${random}.${extension}`;
}
