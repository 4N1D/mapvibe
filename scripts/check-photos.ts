#!/usr/bin/env bun
/**
 * Check photos in database
 */

import { Kysely, PostgresDialect } from "kysely";
import { Pool } from "pg";
import * as fs from "fs";
import * as path from "path";

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

async function main() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = new Kysely<Record<string, any>>({
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

  console.log("=== Checking Photos in Database ===\n");

  // Get recent photos
  const photos = await db
    .selectFrom("photos")
    .innerJoin("restaurants", "restaurants.id", "photos.restaurant_id")
    .select([
      "photos.id",
      "photos.restaurant_id",
      "restaurants.name_vi",
      "restaurants.slug",
      "photos.photo_type",
      "photos.s3_url",
      "photos.is_safe",
      "photos.created_at",
    ])
    .orderBy("photos.created_at", "desc")
    .limit(10)
    .execute();

  if (photos.length === 0) {
    console.log("No photos found in database.");
  } else {
    console.log(`Found ${photos.length} recent photos:\n`);
    for (const p of photos) {
      console.log(`ID: ${p.id}`);
      console.log(`Restaurant: ${p.name_vi} (slug: ${p.slug || "NO SLUG!"})`);
      console.log(`Type: ${p.photo_type}`);
      console.log(`URL: ${p.s3_url}`);
      console.log(`is_safe: ${p.is_safe}`);
      console.log(`Created: ${p.created_at}`);
      console.log("---");
    }
  }

  // Check restaurants without slug
  const noSlug = await db
    .selectFrom("restaurants")
    .select(["id", "name_vi"])
    .where("slug", "is", null)
    .limit(5)
    .execute();

  if (noSlug.length > 0) {
    console.log("\n⚠️  Restaurants WITHOUT slug:");
    for (const r of noSlug) {
      console.log(`  - ${r.name_vi} (${r.id})`);
    }
  }

  await db.destroy();
}

main().catch(console.error);
