const { sql } = require("kysely");

async function up(db) {
  console.log("Recreating photo_type_enum with clean values...");

  // Step 1: Alter column to TEXT temporarily
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE TEXT`.execute(db);
  console.log("  ✓ Changed photos.photo_type to TEXT");

  // Step 2: Drop old enum
  await sql`DROP TYPE IF EXISTS photo_type_enum`.execute(db);
  console.log("  ✓ Dropped old photo_type_enum");

  // Step 3: Create new enum with only needed values
  await sql`CREATE TYPE photo_type_enum AS ENUM ('food', 'view', 'menu', 'other', 'user_avatar', 'user_background')`.execute(
    db
  );
  console.log("  ✓ Created new photo_type_enum");

  // Step 4: Convert column back to enum
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE photo_type_enum USING photo_type::photo_type_enum`.execute(
    db
  );
  console.log("  ✓ Changed photos.photo_type back to photo_type_enum");

  console.log("Migration for photo_type_enum completed successfully");
}

async function down(db) {
  console.log("Reverting to old photo_type_enum...");

  // Step 1: Alter column to TEXT temporarily
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE TEXT`.execute(db);

  // Step 2: Drop new enum
  await sql`DROP TYPE IF EXISTS photo_type_enum`.execute(db);

  // Step 3: Recreate old enum
  await sql`CREATE TYPE photo_type_enum AS ENUM ('general', 'space', 'food', 'menu', 'video')`.execute(
    db
  );

  // Step 4: Convert column back to enum (may fail if data has new values)
  await sql`ALTER TABLE photos ALTER COLUMN photo_type TYPE photo_type_enum USING photo_type::photo_type_enum`.execute(
    db
  );

  console.log("  ✓ Reverted to old photo_type_enum");
}

module.exports = { up, down };
