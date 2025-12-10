const { sql } = require("kysely");

async function up(db) {
  console.log("Dropping district column from restaurants and location_addresses...");

  // Drop district column from restaurants table
  await sql`ALTER TABLE restaurants DROP COLUMN IF EXISTS district`.execute(db);
  console.log("  ✓ Dropped district column from restaurants");

  // Drop district column from location_addresses table
  await sql`ALTER TABLE location_addresses DROP COLUMN IF EXISTS district`.execute(db);
  console.log("  ✓ Dropped district column from location_addresses");

  console.log("Migration completed successfully");
}

async function down(db) {
  console.log("Re-adding district column to restaurants and location_addresses...");

  // Add district column back to restaurants table
  await sql`ALTER TABLE restaurants ADD COLUMN IF NOT EXISTS district VARCHAR(100)`.execute(db);
  console.log("  ✓ Added district column to restaurants");

  // Add district column back to location_addresses table
  await sql`ALTER TABLE location_addresses ADD COLUMN IF NOT EXISTS district VARCHAR(100)`.execute(
    db
  );
  console.log("  ✓ Added district column to location_addresses");
}

module.exports = { up, down };
