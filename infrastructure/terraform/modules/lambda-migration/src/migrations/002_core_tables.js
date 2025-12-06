const { sql } = require("kysely");

async function up(db) {
  console.log("Creating core tables...");

  // Users table
  await sql`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20),
      display_name VARCHAR(100) NOT NULL,
      avatar VARCHAR(500),
      bio TEXT,
      reputation INT DEFAULT 0,
      roles JSON DEFAULT '["user"]'::json,
      account_status VARCHAR(20) DEFAULT 'active',
      email_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      last_login_at TIMESTAMP,
      CONSTRAINT check_account_status CHECK (account_status IN ('active', 'suspended', 'banned'))
    )
  `.execute(db);
  console.log("  ✓ users table created");

  // Location addresses table
  await sql`
    CREATE TABLE IF NOT EXISTS location_addresses (
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
      avg_upvote_rate DECIMAL(5,2),
      status location_status_enum DEFAULT 'pending',
      restaurant_id VARCHAR(50),
      merged_into_id VARCHAR(50),
      merged_at TIMESTAMP,
      merged_by VARCHAR(50) REFERENCES users(id),
      potential_duplicate_of VARCHAR(50),
      duplicate_check_score DECIMAL(5,2),
      created_by_user_id VARCHAR(50) REFERENCES users(id),
      created_by_ip VARCHAR(45),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.execute(db);
  console.log("  ✓ location_addresses table created");

  // Street abbreviations
  await sql`
    CREATE TABLE IF NOT EXISTS street_abbreviations (
      id VARCHAR(50) PRIMARY KEY,
      abbreviation VARCHAR(50) NOT NULL,
      full_text VARCHAR(255) NOT NULL,
      usage_count INT DEFAULT 1,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT unique_abbr UNIQUE(abbreviation, full_text)
    )
  `.execute(db);
  console.log("  ✓ street_abbreviations table created");

  // Restaurants table
  await sql`
    CREATE TABLE IF NOT EXISTS restaurants (
      id VARCHAR(50) PRIMARY KEY,
      name_vi VARCHAR(255) NOT NULL,
      slug VARCHAR(255) UNIQUE,
      address TEXT NOT NULL,
      district VARCHAR(100),
      ward VARCHAR(100),
      phone VARCHAR(20),
      website VARCHAR(500),
      geo_lat DOUBLE PRECISION,
      geo_lng DOUBLE PRECISION,
      location GEOGRAPHY(POINT, 4326),
      business_type VARCHAR(50),
      cuisine_types JSON,
      ai_aggregated_info JSON,
      admin_info JSON,
      price_min INT,
      price_max INT,
      opening_hours TEXT,
      description TEXT,
      features VARCHAR(50)[],
      rating_service DECIMAL(3,1) DEFAULT 0,
      rating_location DECIMAL(3,1) DEFAULT 0,
      rating_price DECIMAL(3,1) DEFAULT 0,
      rating_quality DECIMAL(3,1) DEFAULT 0,
      rating_ambiance DECIMAL(3,1) DEFAULT 0,
      rating_overall DECIMAL(3,1) DEFAULT 0,
      rating_count INT DEFAULT 0,
      review_count INT DEFAULT 0,
      favorite_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      search_vector tsvector,
      embedding vector(1536),
      status restaurant_status_enum DEFAULT 'approved',
      created_from_location_id VARCHAR(50) REFERENCES location_addresses(id),
      created_by VARCHAR(50) REFERENCES users(id),
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `.execute(db);
  console.log("  ✓ restaurants table created");

  // Review posts table
  await sql`
    CREATE TABLE IF NOT EXISTS review_posts (
      id VARCHAR(50) PRIMARY KEY,
      author_id VARCHAR(50) NOT NULL REFERENCES users(id),
      location_address_id VARCHAR(50) REFERENCES location_addresses(id),
      restaurant_id VARCHAR(50) REFERENCES restaurants(id),
      text TEXT NOT NULL,
      features VARCHAR(50)[],
      photos JSON,
      upvote_count INT DEFAULT 0,
      downvote_count INT DEFAULT 0,
      upvote_rate DECIMAL(5,2),
      status review_status_enum DEFAULT 'published',
      moderation_result JSON,
      view_count INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      share_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT check_text_length CHECK (char_length(text) >= 100)
    )
  `.execute(db);
  console.log("  ✓ review_posts table created");

  // Restaurant reviews table
  await sql`
    CREATE TABLE IF NOT EXISTS restaurant_reviews (
      id VARCHAR(50) PRIMARY KEY,
      restaurant_id VARCHAR(50) NOT NULL REFERENCES restaurants(id),
      author_id VARCHAR(50) NOT NULL REFERENCES users(id),
      rating_service DECIMAL(3,1) NOT NULL,
      rating_location DECIMAL(3,1) NOT NULL,
      rating_price DECIMAL(3,1) NOT NULL,
      rating_quality DECIMAL(3,1) NOT NULL,
      rating_ambiance DECIMAL(3,1) NOT NULL,
      rating_overall DECIMAL(3,1) NOT NULL,
      text TEXT NOT NULL,
      photos JSON,
      upvote_count INT DEFAULT 0,
      comment_count INT DEFAULT 0,
      view_count INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      CONSTRAINT check_ratings CHECK (
        rating_service >= 1.0 AND rating_service <= 10.0 AND
        rating_location >= 1.0 AND rating_location <= 10.0 AND
        rating_price >= 1.0 AND rating_price <= 10.0 AND
        rating_quality >= 1.0 AND rating_quality <= 10.0 AND
        rating_ambiance >= 1.0 AND rating_ambiance <= 10.0
      ),
      CONSTRAINT check_review_text_length CHECK (char_length(text) >= 100)
    )
  `.execute(db);
  console.log("  ✓ restaurant_reviews table created");

  console.log("Core tables created successfully");
}

async function down(db) {
  await sql`DROP TABLE IF EXISTS restaurant_reviews CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS review_posts CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS restaurants CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS street_abbreviations CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS location_addresses CASCADE`.execute(db);
  await sql`DROP TABLE IF EXISTS users CASCADE`.execute(db);
}

module.exports = { up, down };
