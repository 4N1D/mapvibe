const { sql } = require("kysely");

async function up(db) {
  console.log("Creating indexes...");

  // Users indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC)`.execute(db);
  console.log("  ✓ users indexes");

  // Location addresses indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_location_status ON location_addresses(status)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_location_district ON location_addresses(district)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_location_created_by ON location_addresses(created_by_user_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_location_geo ON location_addresses USING GIST(location)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_location_normalized_trgm ON location_addresses USING GIN(normalized_street gin_trgm_ops)`.execute(
    db
  );
  console.log("  ✓ location_addresses indexes");

  // Restaurants indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_status ON restaurants(status)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_district ON restaurants(district)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_rating ON restaurants(rating_overall DESC)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_geo ON restaurants USING GIST(location)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_search ON restaurants USING GIN(search_vector)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurants_name_trgm ON restaurants USING GIN(name_vi gin_trgm_ops)`.execute(
    db
  );
  console.log("  ✓ restaurants indexes");

  // Review posts indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_review_posts_author ON review_posts(author_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_review_posts_restaurant ON review_posts(restaurant_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_review_posts_location ON review_posts(location_address_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_review_posts_status ON review_posts(status)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_review_posts_created ON review_posts(created_at DESC)`.execute(
    db
  );
  console.log("  ✓ review_posts indexes");

  // Restaurant reviews indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant ON restaurant_reviews(restaurant_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_author ON restaurant_reviews(author_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_created ON restaurant_reviews(created_at DESC)`.execute(
    db
  );
  console.log("  ✓ restaurant_reviews indexes");

  // Photos indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_restaurant ON photos(restaurant_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_review ON photos(review_post_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_type ON photos(photo_type)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_photos_uploaded_by ON photos(uploaded_by)`.execute(db);
  console.log("  ✓ photos indexes");

  // Comments indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_review_post ON comments(review_post_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_restaurant_review ON comments(restaurant_review_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_restaurant ON comments(restaurant_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_comment_id)`.execute(
    db
  );
  console.log("  ✓ comments indexes");

  // Audit logs indexes
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action_type, created_at DESC)`.execute(
    db
  );
  console.log("  ✓ audit_logs indexes");

  console.log("All indexes created successfully");
}

async function down(db) {
  // Drop indexes (optional - they'll be dropped with tables anyway)
  console.log("Indexes will be dropped with their tables");
}

module.exports = { up, down };
