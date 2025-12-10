#!/usr/bin/env bun
/**
 * Interactive script to seed photos for review posts
 * Photos will be linked to location_addresses via the review post
 * 
 * Usage:
 *   bun run scripts/seed-review-photos.ts
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import crypto from "crypto";

// Load env
const envPath = path.join(import.meta.dir, "../.env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmedLine = line.trim();
    if (!trimmedLine || trimmedLine.startsWith("#")) continue;
    
    const eqIndex = trimmedLine.indexOf("=");
    if (eqIndex === -1) continue;
    
    const key = trimmedLine.substring(0, eqIndex).trim();
    let value = trimmedLine.substring(eqIndex + 1).trim();
    
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    
    process.env[key] = value;
  }
}

// Config
const S3_BUCKET = process.env.S3_PHOTOS_BUCKET || "mapvibe-photos-mvp";
const CLOUDFRONT_DOMAIN = process.env.CLOUDFRONT_DOMAIN || "";
const AWS_REGION = process.env.AWS_REGION || "us-east-1";

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif"];

// Database connection
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let db: Kysely<Record<string, any>>;

async function initDb() {
  db = new Kysely({
    dialect: new PostgresDialect({
      pool: new Pool({
        host: process.env.DB_HOST || "localhost",
        port: parseInt(process.env.DB_PORT || "5432"),
        database: process.env.DB_NAME || "mapvibe",
        user: process.env.DB_USER || "postgres",
        password: process.env.DB_PASSWORD || "",
        ssl: process.env.DB_HOST?.includes("rds") ? { rejectUnauthorized: false } : undefined,
      }),
    }),
  });
}

// S3 client
const s3Client = new S3Client({ region: AWS_REGION });

// Readline interface
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function getCdnUrl(s3Key: string): string {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${s3Key}`;
  }
  return `https://${S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/${s3Key}`;
}

function getContentType(ext: string): string {
  const types: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return types[ext.toLowerCase()] || "image/jpeg";
}

async function uploadToS3(filePath: string, s3Key: string): Promise<string> {
  const fileBuffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath);
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: getContentType(ext),
    })
  );
  
  return getCdnUrl(s3Key);
}

async function listReviewPosts() {
  const reviews = await db
    .selectFrom("review_posts as rp")
    .leftJoin("location_addresses as la", "la.id", "rp.location_address_id")
    .leftJoin("users as u", "u.id", "rp.author_id")
    .select([
      "rp.id",
      "rp.author_id",
      "rp.location_address_id",
      "rp.text",
      "rp.created_at",
      "la.restaurant_name",
      "la.street_address",
      "u.display_name as author_name",
    ])
    .orderBy("rp.created_at", "desc")
    .execute();
  
  console.log("\n=== Danh sách Review Posts ===");
  reviews.forEach((r, i) => {
    const textSnippet = r.text ? r.text.substring(0, 50) + "..." : "N/A";
    const location = r.restaurant_name || r.street_address || "Unknown location";
    console.log(`${i + 1}. [${r.id.substring(0, 10)}...] by ${r.author_name || "Unknown"}`);
    console.log(`   📍 ${location}`);
    console.log(`   📝 ${textSnippet}`);
    console.log("");
  });
  
  return reviews;
}

function listImagesInFolder(folderPath: string): string[] {
  if (!fs.existsSync(folderPath)) {
    console.log(`Folder không tồn tại: ${folderPath}`);
    return [];
  }
  
  const files = fs.readdirSync(folderPath);
  return files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return ALLOWED_EXTENSIONS.includes(ext);
  });
}

async function main() {
  console.log("🖼️  Mapvibe Review Photo Seeder");
  console.log("================================\n");
  
  // Init DB
  console.log("Connecting to database...");
  await initDb();
  console.log("✓ Database connected\n");
  
  // List review posts
  const reviews = await listReviewPosts();
  if (reviews.length === 0) {
    console.log("❌ Không có review post nào trong database.");
    process.exit(1);
  }
  
  // Select review post
  const reviewIndex = await question("Chọn review post (nhập số): ");
  const selectedReview = reviews[parseInt(reviewIndex) - 1];
  if (!selectedReview) {
    console.log("❌ Review post không hợp lệ");
    process.exit(1);
  }
  
  const locationName = selectedReview.restaurant_name || selectedReview.street_address || "Unknown";
  console.log(`\n✓ Đã chọn review của: ${selectedReview.author_name}`);
  console.log(`  📍 Location: ${locationName}`);
  console.log(`  🔗 Location Address ID: ${selectedReview.location_address_id || "None"}\n`);
  
  // Select folder
  const folderPath = await question("Nhập đường dẫn folder chứa ảnh: ");
  const absolutePath = path.isAbsolute(folderPath) 
    ? folderPath 
    : path.resolve(process.cwd(), folderPath);
  
  const images = listImagesInFolder(absolutePath);
  if (images.length === 0) {
    console.log("❌ Không tìm thấy ảnh nào trong folder");
    process.exit(1);
  }
  
  console.log(`\n=== Tìm thấy ${images.length} ảnh ===`);
  images.forEach((img, i) => console.log(`${i + 1}. ${img}`));
  
  // Confirm upload
  const confirm = await question(`\nUpload ${images.length} ảnh cho review này? (y/n): `);
  if (confirm.toLowerCase() !== "y") {
    console.log("Đã hủy.");
    process.exit(0);
  }
  
  // Upload and insert
  console.log("\n=== Bắt đầu upload ===\n");
  
  for (let i = 0; i < images.length; i++) {
    const imageName = images[i];
    const imagePath = path.join(absolutePath, imageName);
    const ext = path.extname(imageName);
    
    // Generate S3 key - use 'review' folder
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const s3Key = `review/${selectedReview.author_id}/${timestamp}-${random}${ext}`;
    
    console.log(`[${i + 1}/${images.length}] Uploading ${imageName}...`);
    
    try {
      // Upload to S3
      const cdnUrl = await uploadToS3(imagePath, s3Key);
      
      // Insert to DB - link to review_post and location_address
      const photoId = crypto.randomUUID();
      await db.insertInto("photos").values({
        id: photoId,
        location_address_id: selectedReview.location_address_id || null,
        restaurant_id: null,
        review_post_id: selectedReview.id,
        uploaded_by: selectedReview.author_id,
        photo_type: "review",
        menu_name: null,
        s3_url: cdnUrl,
        s3_thumbnail_url: null,
        s3_medium_url: null,
        s3_large_url: null,
        is_safe: true,
        is_blurry: false,
        display_order: i + 1,
        view_count: 0,
      }).execute();
      
      console.log(`  ✓ Uploaded: ${cdnUrl}`);
    } catch (err) {
      console.error(`  ❌ Failed: ${(err as Error).message}`);
    }
  }
  
  console.log("\n✅ Hoàn thành!");
  
  rl.close();
  await db.destroy();
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
