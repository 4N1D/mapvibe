const { sql } = require("kysely");

/**
 * Migration: Add menu_name column to photos table
 * 
 * Purpose: Store name/title for menu photos to display below each menu image
 * Example: "Phở bò tái", "Cơm tấm sườn", "Bún chả Hà Nội"
 */
async function up(db) {
  console.log("Adding menu_name column to photos table...");

  await sql`
    ALTER TABLE photos 
    ADD COLUMN IF NOT EXISTS menu_name VARCHAR(255)
  `.execute(db);
  
  console.log("  ✓ Added menu_name column to photos table");
}

async function down(db) {
  console.log("Removing menu_name column from photos table...");

  await sql`
    ALTER TABLE photos 
    DROP COLUMN IF EXISTS menu_name
  `.execute(db);
  
  console.log("  ✓ Removed menu_name column from photos table");
}

module.exports = { up, down };
