const { sql } = require("kysely");

async function up(db) {
  console.log("Adding phone and opening_hours to location_addresses...");

  await sql`
    ALTER TABLE location_addresses
    ADD COLUMN IF NOT EXISTS phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS opening_hours JSON
  `.execute(db);

  console.log("✅ phone and opening_hours columns added to location_addresses");
}

async function down(db) {
  console.log("Removing phone and opening_hours from location_addresses...");

  await sql`
    ALTER TABLE location_addresses
    DROP COLUMN IF EXISTS phone,
    DROP COLUMN IF EXISTS opening_hours
  `.execute(db);

  console.log("✅ phone and opening_hours columns removed from location_addresses");
}

module.exports = { up, down };
