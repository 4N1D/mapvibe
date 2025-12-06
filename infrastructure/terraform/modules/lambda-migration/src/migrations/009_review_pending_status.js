const { sql } = require("kysely");

async function up(db) {
  console.log("Adding 'pending' status to review_status_enum...");

  // Add 'pending' to review_status_enum
  await sql`
    DO $$ BEGIN
      ALTER TYPE review_status_enum ADD VALUE IF NOT EXISTS 'pending' BEFORE 'published';
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `.execute(db);
  console.log("  ✓ Added 'pending' to review_status_enum");

  console.log("Migration 006 completed successfully");
}

async function down(db) {
  // Note: PostgreSQL doesn't support removing enum values easily
  console.log("Rollback: No changes to revert (enum values cannot be removed)");
}

module.exports = { up, down };
