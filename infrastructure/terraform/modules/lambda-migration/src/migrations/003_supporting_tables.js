const { sql } = require("kysely");

async function up(db) {
  console.log("Creating supporting tables...");

  // Photos table
  await sql`
    CREATE TABLE IF NOT EXISTS photos (
      id VARCHAR(50) PRIMARY KEY,
      location_address_id VARCHAR(50) REFERENCES location_addresses(id),
      restaurant_id VARCHAR(50) REFERENCES restaurants(id),
      review_post_id VARCHAR(50) REFERENCES review_posts(id),
      uploaded_by VARCHAR(50) NOT NULL REFERENCES users(id),
      photo_type photo_type_enum NOT NULL,
      s3_url TEXT NOT NULL,
      s3_thumbnail_url TEXT,
      s3_medium_url TEXT,
      s3_large_url TEXT,
      width INT,
      height INT,
      file_size INT,
      ocr_text TEXT,
      ocr_structured JSON,
      moderation_labels JSON,
      is_safe BOOLEAN DEFAULT TRUE,
      is_blurry BOOLEAN DEFAULT FALSE,
      display_order INT DEFAULT 0,
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      processed_at TIMESTAMP
    )
  `.execute(db);
  console.log("  ✓ photos table created");

  // Comments table
  await sql`
    CREATE TABLE IF NOT EXISTS comments (
      id VARCHAR(50) PRIMARY KEY,
      review_post_id VARCHAR(50) REFERENCES review_posts(id),
      restaurant_review_id VARCHAR(50) REFERENCES restaurant_reviews(id),
      restaurant_id VARCHAR(50) REFERENCES restaurants(id),
      parent_comment_id VARCHAR(50) REFERENCES comments(id),
      thread_depth INT DEFAULT 0,
      author_id VARCHAR(50) NOT NULL REFERENCES users(id),
      text TEXT NOT NULL,
      correction_type VARCHAR(50),
      suggested_value TEXT,
      upvote_count INT DEFAULT 0,
      status review_status_enum DEFAULT 'published',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT check_parent CHECK (
        (review_post_id IS NOT NULL)::int +
        (restaurant_review_id IS NOT NULL)::int +
        (restaurant_id IS NOT NULL)::int = 1
      )
    )
  `.execute(db);
  console.log("  ✓ comments table created");

  // Votes table
  await sql`
    CREATE TABLE IF NOT EXISTS votes (
      review_post_id VARCHAR(50) NOT NULL REFERENCES review_posts(id) ON DELETE CASCADE,
      user_id VARCHAR(50) NOT NULL REFERENCES users(id),
      vote_type VARCHAR(10) NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (review_post_id, user_id),
      CONSTRAINT check_vote_type CHECK (vote_type IN ('upvote', 'downvote'))
    )
  `.execute(db);
  console.log("  ✓ votes table created");

  // Favorites table
  await sql`
    CREATE TABLE IF NOT EXISTS favorites (
      user_id VARCHAR(50) NOT NULL REFERENCES users(id),
      restaurant_id VARCHAR(50) NOT NULL REFERENCES restaurants(id),
      saved_at TIMESTAMP DEFAULT NOW(),
      PRIMARY KEY (user_id, restaurant_id)
    )
  `.execute(db);
  console.log("  ✓ favorites table created");

  // Restaurant edit suggestions
  await sql`
    CREATE TABLE IF NOT EXISTS restaurant_edit_suggestions (
      id VARCHAR(50) PRIMARY KEY,
      restaurant_id VARCHAR(50) NOT NULL REFERENCES restaurants(id),
      suggested_by VARCHAR(50) NOT NULL REFERENCES users(id),
      field_name VARCHAR(50) NOT NULL,
      current_value TEXT,
      suggested_value TEXT,
      reason TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      reviewed_by VARCHAR(50) REFERENCES users(id),
      reviewed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.execute(db);
  console.log("  ✓ restaurant_edit_suggestions table created");

  // Audit logs
  await sql`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50) REFERENCES users(id),
      user_email VARCHAR(255),
      user_role VARCHAR(50),
      action_type VARCHAR(50) NOT NULL,
      entity_type VARCHAR(50),
      entity_id VARCHAR(50),
      changes JSON,
      reason TEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `.execute(db);
  console.log("  ✓ audit_logs table created");

  console.log("Supporting tables created successfully");
}

async function down(db) {
  await sql`DROP TABLE IF EXISTS audit_logs CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS restaurant_edit_suggestions CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS favorites CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS votes CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS comments CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS photos CASCADE`.execute(db);
}

module.exports = { up, down };
