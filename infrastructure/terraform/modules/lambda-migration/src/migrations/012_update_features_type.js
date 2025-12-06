const { sql } = require("kysely");

async function up(db) {

  await sql`
    ALTER TABLE restaurants 
    ALTER COLUMN features TYPE TEXT;
  `.execute(db);

  console.log("  ✓ Updated 'features' to TEXT");

  console.log("Migration for restaurant table schema update completed successfully");
}

async function down(db) {
  console.log("Reverting changes to 'restaurants' table...");

  await sql`
    ALTER TABLE restaurants 
    ALTER COLUMN features TYPE VARCHAR(50);
  `.execute(db);

  console.log("  ✓ Reverted columns types");
}

module.exports = { up, down };