#!/usr/bin/env bun
/**
 * Interactive script to seed photos for restaurants
 * 
 * Usage:
 *   bun run scripts/seed-photos.ts
 * 
 * Requirements:
 *   - AWS credentials configured
 *   - .env file with DB credentials
 *   - Ảnh nằm trong folder local
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
    
    // Remove surrounding quotes if present
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

// Photo types
type PhotoType = "food" | "view" | "menu" | "review";

const PHOTO_TYPES: PhotoType[] = ["food", "view", "menu", "review"];

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

async function listRestaurants() {
  const restaurants = await db
    .selectFrom("restaurants")
    .select(["id", "name_vi", "address"])
    .orderBy("name_vi")
    .execute();
  
  console.log("\n=== Danh sách Restaurants ===");
  restaurants.forEach((r, i) => {
    console.log(`${i + 1}. [${r.id.substring(0, 8)}...] ${r.name_vi} - ${r.address || "N/A"}`);
  });
  
  return restaurants;
}

async function getExistingUser(): Promise<string | null> {
  const user = await db
    .selectFrom("users")
    .select("id")
    .limit(1)
    .executeTakeFirst();
  return user?.id || null;
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
  console.log("🖼️  Mapvibe Photo Seeder");
  console.log("========================\n");
  
  // Init DB
  console.log("Connecting to database...");
  await initDb();
  console.log("✓ Database connected\n");
  
  // Get admin user
  const adminUserId = await getExistingUser();
  if (!adminUserId) {
    console.log("❌ Không tìm thấy user nào trong database. Vui lòng tạo user trước.");
    process.exit(1);
  }
  console.log(`Using user ID: ${adminUserId}\n`);
  
  // List restaurants
  const restaurants = await listRestaurants();
  if (restaurants.length === 0) {
    console.log("❌ Không có restaurant nào trong database.");
    process.exit(1);
  }
  
  // Select restaurant
  const restaurantIndex = await question("\nChọn restaurant (nhập số): ");
  const selectedRestaurant = restaurants[parseInt(restaurantIndex) - 1];
  if (!selectedRestaurant) {
    console.log("❌ Restaurant không hợp lệ");
    process.exit(1);
  }
  console.log(`\n✓ Đã chọn: ${selectedRestaurant.name_vi}\n`);
  
  // Select photo type
  console.log("=== Loại ảnh ===");
  PHOTO_TYPES.forEach((t, i) => console.log(`${i + 1}. ${t}`));
  const typeIndex = await question("\nChọn loại ảnh (nhập số): ");
  const selectedType = PHOTO_TYPES[parseInt(typeIndex) - 1];
  if (!selectedType) {
    console.log("❌ Loại ảnh không hợp lệ");
    process.exit(1);
  }
  console.log(`\n✓ Loại ảnh: ${selectedType}\n`);
  
  // Get menu name if type is menu
  let menuName: string | null = null;
  if (selectedType === "menu") {
    menuName = await question("Nhập tên menu (VD: 'Menu chính', để trống nếu không có): ");
    menuName = menuName.trim() || null;
  }
  
  // Select folder
  const folderPath = await question("\nNhập đường dẫn folder chứa ảnh: ");
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
  const confirm = await question(`\nUpload ${images.length} ảnh lên S3? (y/n): `);
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
    
    // Generate S3 key
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const s3Key = `${selectedType}/${adminUserId}/${timestamp}-${random}${ext}`;
    
    console.log(`[${i + 1}/${images.length}] Uploading ${imageName}...`);
    
    try {
      // Upload to S3
      const cdnUrl = await uploadToS3(imagePath, s3Key);
      
      // Insert to DB
      const photoId = crypto.randomUUID();
      await db.insertInto("photos").values({
        id: photoId,
        restaurant_id: selectedRestaurant.id,
        uploaded_by: adminUserId,
        photo_type: selectedType,
        menu_name: menuName,
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
