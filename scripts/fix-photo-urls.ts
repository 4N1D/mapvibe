#!/usr/bin/env bun
/**
 * Fix wrong CloudFront URLs in photos table
 */

import { Kysely, PostgresDialect, sql } from "kysely";
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

const OLD_DOMAIN = "d1oasw0quh6m55.cloudfront.net";
const NEW_DOMAIN = "dxuh8yivsgocq.cloudfront.net";

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

  console.log("=== Fixing Photo URLs ===\n");
  console.log(`Old domain: ${OLD_DOMAIN}`);
  console.log(`New domain: ${NEW_DOMAIN}\n`);

  // Find photos with wrong domain
  const wrongPhotos = await db
    .selectFrom("photos")
    .select(["id", "s3_url"])
    .where("s3_url", "like", `%${OLD_DOMAIN}%`)
    .execute();

  console.log(`Found ${wrongPhotos.length} photos with wrong domain.\n`);

  if (wrongPhotos.length === 0) {
    console.log("Nothing to fix!");
    await db.destroy();
    return;
  }

  // Update URLs
  const result = await db
    .updateTable("photos")
    .set({
      s3_url: sql`REPLACE(s3_url, ${OLD_DOMAIN}, ${NEW_DOMAIN})`,
    })
    .where("s3_url", "like", `%${OLD_DOMAIN}%`)
    .executeTakeFirst();

  console.log(`✅ Updated ${result.numUpdatedRows} photos.`);

  // Verify
  const verifyPhotos = await db
    .selectFrom("photos")
    .select(["id", "s3_url"])
    .where("s3_url", "like", `%${NEW_DOMAIN}%`)
    .limit(5)
    .execute();

  console.log("\nSample updated URLs:");
  for (const p of verifyPhotos) {
    console.log(`  ${p.s3_url}`);
  }

  await db.destroy();
}

main().catch(console.error);
