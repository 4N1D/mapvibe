/* eslint-disable @typescript-eslint/no-require-imports */

const { sql } = require("kysely");

async function up(db) {
  console.log("Running schema cleanup migration...");

  // 1. Drop FK constraints referencing location_addresses
  console.log("  1. Dropping FK constraints to location_addresses");
  await sql`ALTER TABLE photos DROP CONSTRAINT IF EXISTS 
     photos_location_address_id_fkey`.execute(db);
  await sql`ALTER TABLE review_posts DROP CONSTRAINT IF EXISTS 
     review_posts_location_address_id_fkey`.execute(db);
  await sql`ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS 
     restaurants_created_from_location_id_fkey`.execute(db);

  // 2. Drop columns referencing location_addresses
  console.log("  2. Dropping columns referencing location_addresses");
  await sql`ALTER TABLE photos DROP COLUMN IF EXISTS
     location_address_id`.execute(db);
  await sql`ALTER TABLE review_posts DROP COLUMN IF EXISTS
     location_address_id`.execute(db);
  await sql`ALTER TABLE restaurants DROP COLUMN IF EXISTS
     created_from_location_id`.execute(db);

  // 3. Drop indexes on location_addresses
  console.log("  3. Dropping location_addresses indexes");
  await sql`DROP INDEX IF EXISTS idx_location_status`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_district`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_created_by`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_geo`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_normalized_trgm`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_photos_location`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_review_posts_location`.execute(db);

  // 4. Drop location_addresses table
  console.log("  4. Dropping location_addresses table");
  await sql`DROP TABLE IF EXISTS location_addresses`.execute(db);

  // 5. Drop location_status_enum (no longer needed)
  console.log("  5. Dropping location_status_enum");
  await sql`DROP TYPE IF EXISTS location_status_enum`.execute(db);

  // 6. Rename comments.upvote_count → like_count
  console.log("  6. Renaming comments.upvote_count → like_count");
  await sql`ALTER TABLE comments RENAME COLUMN upvote_count TO
     like_count`.execute(db);

  // 7. Add users.background column
  console.log("  7. Adding users.background column");
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS background
     VARCHAR(500)`.execute(db);

  console.log("✅ Schema cleanup migration completed");
}

async function down(db) {
  console.log("Reverting schema cleanup migration...");

  // 1. Remove users.background
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS background`.execute(db);

  // 2. Rename comments.like_count → upvote_count
  await sql`ALTER TABLE comments RENAME COLUMN like_count TO
     upvote_count`.execute(db);

  // 3. Recreate location_status_enum
  await sql`CREATE TYPE location_status_enum AS ENUM ('pending', 'approved',
     'rejected', 'merged')`.execute(db);

  // 4. Recreate location_addresses table
  await sql`
         CREATE TABLE location_addresses (
           id VARCHAR(50) PRIMARY KEY,
           restaurant_name VARCHAR(255),
           street_address TEXT NOT NULL,
           ward VARCHAR(100),
           district VARCHAR(100) NOT NULL,
           city VARCHAR(100) NOT NULL DEFAULT 'TP. Hồ Chí Minh',
           full_address TEXT,
           normalized_street TEXT,
           user_input_street TEXT,
           geo_lat DOUBLE PRECISION,
           geo_lng DOUBLE PRECISION,
           location GEOGRAPHY(POINT, 4326),
           review_count INT DEFAULT 0,
           avg_upvote_rate NUMERIC(5,2),
           status location_status_enum DEFAULT 'pending',
           restaurant_id VARCHAR(50),
           merged_into_id VARCHAR(50),
           merged_at TIMESTAMP,
           merged_by VARCHAR(50) REFERENCES users(id),
           potential_duplicate_of VARCHAR(50),
           duplicate_check_score NUMERIC(5,2),
           created_by_user_id VARCHAR(50) REFERENCES users(id),
           created_by_ip VARCHAR(45),
           created_at TIMESTAMP DEFAULT NOW(),
           updated_at TIMESTAMP DEFAULT NOW()
         )
       `.execute(db);

  // 5. Add back columns
  await sql`ALTER TABLE photos ADD COLUMN location_address_id VARCHAR(50)
     REFERENCES location_addresses(id)`.execute(db);
  await sql`ALTER TABLE review_posts ADD COLUMN location_address_id VARCHAR(50)
      REFERENCES location_addresses(id)`.execute(db);
  await sql`ALTER TABLE restaurants ADD COLUMN created_from_location_id
     VARCHAR(50) REFERENCES location_addresses(id)`.execute(db);

  // 6. Recreate indexes
  await sql`CREATE INDEX idx_location_status ON
     location_addresses(status)`.execute(db);
  await sql`CREATE INDEX idx_location_district ON
     location_addresses(district)`.execute(db);
  await sql`CREATE INDEX idx_location_created_by ON
     location_addresses(created_by_user_id)`.execute(db);
  await sql`CREATE INDEX idx_location_geo ON location_addresses USING
     GIST(location)`.execute(db);
  await sql`CREATE INDEX idx_review_posts_location ON
     review_posts(location_address_id)`.execute(db);

  console.log("✅ Schema cleanup migration reverted");
}

module.exports = { up, down };
