const { sql } = require("kysely");

async function up(db) {
  console.log("Adding ban_reason column to users table...");

  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS ban_reason TEXT
  `.execute(db);

  console.log("  ✓ ban_reason column added to users table");

  console.log("Migration 020_add_user_ban_reason completed");
}

async function down(db) {
  console.log("Dropping ban_reason column from users table...");

  await sql`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS ban_reason
  `.execute(db);

  console.log("ban_reason column dropped from users table");
}

module.exports = { up, down };
