const { sql } = require("kysely");

async function up(db) {
  console.log("Restoring location_addresses table...");

  // 1. Recreate location_status_enum
  console.log("  1. Creating location_status_enum");
  await sql`CREATE TYPE location_status_enum AS ENUM ('pending', 'approved',
     'rejected', 'merged')`.execute(db);

  // 2. Recreate location_addresses table
  console.log("  2. Creating location_addresses table");
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

  // 3. Add back columns to other tables
  console.log("  3. Adding FK columns back");
  await sql`ALTER TABLE photos ADD COLUMN location_address_id VARCHAR(50) REFERENCES
     location_addresses(id)`.execute(db);
  await sql`ALTER TABLE review_posts ADD COLUMN location_address_id VARCHAR(50)
     REFERENCES location_addresses(id)`.execute(db);
  await sql`ALTER TABLE restaurants ADD COLUMN created_from_location_id VARCHAR(50)
     REFERENCES location_addresses(id)`.execute(db);

  // 4. Recreate indexes
  console.log("  4. Creating indexes");
  await sql`CREATE INDEX idx_location_status ON
     location_addresses(status)`.execute(db);
  await sql`CREATE INDEX idx_location_district ON
     location_addresses(district)`.execute(db);
  await sql`CREATE INDEX idx_location_created_by ON
     location_addresses(created_by_user_id)`.execute(db);
  await sql`CREATE INDEX idx_location_geo ON location_addresses USING
     GIST(location)`.execute(db);
  await sql`CREATE INDEX idx_location_normalized_trgm ON location_addresses USING
     GIN(normalized_street gin_trgm_ops)`.execute(db);
  await sql`CREATE INDEX idx_photos_location ON
     photos(location_address_id)`.execute(db);
  await sql`CREATE INDEX idx_review_posts_location ON
     review_posts(location_address_id)`.execute(db);

  console.log("✅ location_addresses table restored");
}

async function down(db) {
  // Same as 006_schema_cleanup up()
  console.log("Dropping location_addresses...");

  await sql`ALTER TABLE photos DROP CONSTRAINT IF EXISTS
     photos_location_address_id_fkey`.execute(db);
  await sql`ALTER TABLE review_posts DROP CONSTRAINT IF EXISTS
     review_posts_location_address_id_fkey`.execute(db);
  await sql`ALTER TABLE restaurants DROP CONSTRAINT IF EXISTS
     restaurants_created_from_location_id_fkey`.execute(db);

  await sql`ALTER TABLE photos DROP COLUMN IF EXISTS location_address_id`.execute(db);
  await sql`ALTER TABLE review_posts DROP COLUMN IF EXISTS
     location_address_id`.execute(db);
  await sql`ALTER TABLE restaurants DROP COLUMN IF EXISTS
     created_from_location_id`.execute(db);

  await sql`DROP INDEX IF EXISTS idx_location_status`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_district`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_created_by`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_geo`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_location_normalized_trgm`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_photos_location`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_review_posts_location`.execute(db);

  await sql`DROP TABLE IF EXISTS location_addresses`.execute(db);
  await sql`DROP TYPE IF EXISTS location_status_enum`.execute(db);

  console.log("✅ location_addresses dropped");
}

module.exports = { up, down };
