const { sql } = require("kysely");

async function up(db) {
  console.log("Adding 'gender' column to 'users' table...");

  await sql`
    ALTER TABLE users 
    ADD COLUMN IF NOT EXISTS gender VARCHAR(20);
  `.execute(db);

  console.log("  ✓ Added 'gender' column to users table");

  console.log("Migration for adding gender column completed successfully");
}

async function down(db) {
  console.log("Removing 'gender' column from 'users' table...");

  await sql`
    ALTER TABLE users 
    DROP COLUMN IF EXISTS gender;
  `.execute(db);

  console.log("  ✓ Removed 'gender' column from users table");
}

module.exports = { up, down };
