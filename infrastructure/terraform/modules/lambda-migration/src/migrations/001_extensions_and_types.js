const { sql } = require("kysely");

async function up(db) {
  console.log("Creating extensions and custom types...");

  // Enable extensions
  await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS vector`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS postgis`.execute(db);
  await sql`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`.execute(db);

  // Create custom types
  await sql`
    DO $$ BEGIN
      CREATE TYPE photo_type_enum AS ENUM ('general', 'space', 'food', 'menu', 'video');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE review_status_enum AS ENUM ('published', 'hidden', 'deleted');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE location_status_enum AS ENUM ('pending', 'approved', 'rejected', 'merged');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE restaurant_status_enum AS ENUM ('approved', 'closed', 'removed');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$
  `.execute(db);

  console.log("Extensions and types created successfully");
}

async function down(db) {
  await sql`DROP TYPE IF EXISTS restaurant_status_enum`.execute(db);
  await sql`DROP TYPE IF EXISTS location_status_enum`.execute(db);
  await sql`DROP TYPE IF EXISTS review_status_enum`.execute(db);
  await sql`DROP TYPE IF EXISTS photo_type_enum`.execute(db);
}

module.exports = { up, down };
