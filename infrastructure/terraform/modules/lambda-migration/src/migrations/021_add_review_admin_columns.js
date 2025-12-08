const { sql } = require("kysely");

async function up(db) {
  console.log("Adding admin-related columns to review_posts table...");

  // Add report_count column
  await sql`
    ALTER TABLE review_posts 
    ADD COLUMN IF NOT EXISTS report_count INT DEFAULT 0
  `.execute(db);
  console.log("  ✓ report_count column added");

  // Add hidden_reason column
  await sql`
    ALTER TABLE review_posts 
    ADD COLUMN IF NOT EXISTS hidden_reason TEXT
  `.execute(db);
  console.log("  ✓ hidden_reason column added");

  console.log("Migration 021_add_review_admin_columns completed");
}

async function down(db) {
  console.log("Dropping admin-related columns from review_posts table...");

  await sql`
    ALTER TABLE review_posts 
    DROP COLUMN IF EXISTS report_count
  `.execute(db);

  await sql`
    ALTER TABLE review_posts 
    DROP COLUMN IF EXISTS hidden_reason
  `.execute(db);

  console.log("Admin-related columns dropped from review_posts table");
}

module.exports = { up, down };
