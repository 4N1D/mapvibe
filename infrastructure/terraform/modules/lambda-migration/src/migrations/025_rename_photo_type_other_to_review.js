const { sql } = require("kysely");

/**
 * Migration: Rename photo_type_enum value 'other' to 'review'
 * 
 * Why: 'review' better describes photos uploaded by users in their reviews
 * - 'comment' = text only, no photos
 * - 'review' = user reviews that can include photos
 * 
 * Approach: Recreate enum because PostgreSQL doesn't allow using new enum 
 * values in the same transaction as ADD VALUE
 */
async function up(db) {
  console.log("Renaming photo_type_enum: 'other' -> 'review'...");

  // Step 1: Change column to TEXT temporarily
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE TEXT`.execute(db);
  console.log("  ✓ Changed photo_type to TEXT");

  // Step 2: Update data from 'other' to 'review'
  const result = await sql`
    UPDATE photos 
    SET photo_type = 'review' 
    WHERE photo_type = 'other'
  `.execute(db);
  console.log(`  ✓ Updated ${result.numAffectedRows || 0} photos from 'other' to 'review'`);

  // Step 3: Drop old enum
  await sql`DROP TYPE IF EXISTS photo_type_enum`.execute(db);
  console.log("  ✓ Dropped old photo_type_enum");

  // Step 4: Create new enum with 'review' instead of 'other'
  await sql`CREATE TYPE photo_type_enum AS ENUM ('food', 'view', 'menu', 'review', 'user_avatar', 'user_background')`.execute(db);
  console.log("  ✓ Created new photo_type_enum with 'review'");

  // Step 5: Convert column back to enum
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE photo_type_enum USING photo_type::photo_type_enum`.execute(db);
  console.log("  ✓ Changed photo_type back to enum");

  console.log("Migration completed successfully");
}

async function down(db) {
  console.log("Reverting photo_type_enum: 'review' -> 'other'...");

  // Step 1: Change column to TEXT
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE TEXT`.execute(db);
  console.log("  ✓ Changed photo_type to TEXT");

  // Step 2: Update data back to 'other'
  const result = await sql`
    UPDATE photos 
    SET photo_type = 'other' 
    WHERE photo_type = 'review'
  `.execute(db);
  console.log(`  ✓ Reverted ${result.numAffectedRows || 0} photos from 'review' to 'other'`);

  // Step 3: Drop enum
  await sql`DROP TYPE IF EXISTS photo_type_enum`.execute(db);

  // Step 4: Recreate old enum with 'other'
  await sql`CREATE TYPE photo_type_enum AS ENUM ('food', 'view', 'menu', 'other', 'user_avatar', 'user_background')`.execute(db);

  // Step 5: Convert back to enum
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE photo_type_enum USING photo_type::photo_type_enum`.execute(db);

  console.log("  ✓ Reverted to old photo_type_enum with 'other'");
}

module.exports = { up, down };
