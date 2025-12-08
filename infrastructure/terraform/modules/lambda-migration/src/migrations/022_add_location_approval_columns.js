const { sql } = require("kysely");

async function up(db) {
  console.log("Adding approval-related columns to location_addresses table...");

  // Add rejection_reason column
  await sql`
    ALTER TABLE location_addresses 
    ADD COLUMN IF NOT EXISTS rejection_reason TEXT
  `.execute(db);
  console.log("  ✓ rejection_reason column added");

  // Add approved_by column
  await sql`
    ALTER TABLE location_addresses 
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(50) REFERENCES users(id)
  `.execute(db);
  console.log("  ✓ approved_by column added");

  // Add approved_at column
  await sql`
    ALTER TABLE location_addresses 
    ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP
  `.execute(db);
  console.log("  ✓ approved_at column added");

  console.log("Migration 022_add_location_approval_columns completed");
}

async function down(db) {
  console.log("Dropping approval-related columns from location_addresses table...");

  await sql`
    ALTER TABLE location_addresses 
    DROP COLUMN IF EXISTS rejection_reason
  `.execute(db);

  await sql`
    ALTER TABLE location_addresses 
    DROP COLUMN IF EXISTS approved_by
  `.execute(db);

  await sql`
    ALTER TABLE location_addresses 
    DROP COLUMN IF EXISTS approved_at
  `.execute(db);

  console.log("Approval-related columns dropped from location_addresses table");
}

module.exports = { up, down };
