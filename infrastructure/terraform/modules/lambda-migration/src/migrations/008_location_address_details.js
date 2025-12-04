const { sql } = require("kysely");

async function up(db) {
  console.log("Adding cuisine_types, price_min, price_max to location_addresses...");

  await sql`
    ALTER TABLE location_addresses
    ADD COLUMN IF NOT EXISTS cuisine_types JSON,
    ADD COLUMN IF NOT EXISTS price_min INT,
    ADD COLUMN IF NOT EXISTS price_max INT
  `.execute(db);

  console.log("✅ location_addresses columns added");
}

async function down(db) {
  console.log("Removing cuisine_types, price_min, price_max from location_addresses...");

  await sql`
    ALTER TABLE location_addresses
    DROP COLUMN IF EXISTS cuisine_types,
    DROP COLUMN IF EXISTS price_min,
    DROP COLUMN IF EXISTS price_max
  `.execute(db);

  console.log("✅ location_addresses columns removed");
}

module.exports = { up, down };
