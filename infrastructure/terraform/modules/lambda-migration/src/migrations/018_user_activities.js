const { sql } = require("kysely");

async function up(db) {
  console.log("Creating user_activities table...");

  // Create activity type enum
  await sql`
    DO $$ BEGIN
      CREATE TYPE activity_type_enum AS ENUM (
        'login', 'logout', 'register',
        'view_place', 'view_review', 'view_profile',
        'search', 'search_nearby',
        'create_review', 'edit_review', 'delete_review',
        'create_comment', 'edit_comment', 'delete_comment',
        'like', 'unlike',
        'report', 'share',
        'upload_photo', 'delete_photo',
        'follow', 'unfollow',
        'update_profile', 'update_avatar',
        'page_view', 'other'
      );
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  console.log("Activity type enum created");

  // Create user_activities table
  await sql`
    CREATE TABLE IF NOT EXISTS user_activities (
      id              SERIAL PRIMARY KEY,
      user_id         VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL,
      session_id      VARCHAR(100),
      activity_type   activity_type_enum NOT NULL,
      target_type     VARCHAR(50),
      target_id       VARCHAR(100),
      metadata        JSONB DEFAULT '{}',
      ip_address      INET,
      user_agent      TEXT,
      referrer        TEXT,
      page_url        TEXT,
      created_at      TIMESTAMP DEFAULT NOW()
    )
  `.execute(db);

  console.log("user_activities table created");

  // Create indexes for efficient querying
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_user ON user_activities(user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_type ON user_activities(activity_type)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_created ON user_activities(created_at DESC)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_target ON user_activities(target_type, target_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_session ON user_activities(session_id)`.execute(db);
  
  // Composite index for common queries
  await sql`CREATE INDEX IF NOT EXISTS idx_activities_user_created ON user_activities(user_id, created_at DESC)`.execute(db);

  console.log("Indexes created");

  // Create a view for activity stats (for dashboard)
  await sql`
    CREATE OR REPLACE VIEW activity_stats AS
    SELECT 
      DATE(created_at) as date,
      activity_type,
      COUNT(*) as count,
      COUNT(DISTINCT user_id) as unique_users
    FROM user_activities
    WHERE created_at >= NOW() - INTERVAL '30 days'
    GROUP BY DATE(created_at), activity_type
    ORDER BY date DESC, count DESC
  `.execute(db);

  console.log("Activity stats view created");

  console.log("Migration 018_user_activities completed");
}

async function down(db) {
  console.log("Dropping user_activities table...");

  await sql`DROP VIEW IF EXISTS activity_stats`.execute(db);
  await sql`DROP TABLE IF EXISTS user_activities`.execute(db);
  await sql`DROP TYPE IF EXISTS activity_type_enum`.execute(db);

  console.log("user_activities table dropped");
}

module.exports = { up, down };
