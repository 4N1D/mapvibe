const { sql } = require("kysely");

async function up(db) {
  console.log("Creating likes and reports tables...");

  await sql`
    DO $$ BEGIN
      CREATE TYPE report_status_enum AS ENUM ('pending', 'reviewing', 'resolved', 'dismissed');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  await sql`
    DO $$ BEGIN
      CREATE TYPE report_reason_enum AS ENUM ('spam', 'inappropriate', 'harassment', 'misinformation', 'other');
    EXCEPTION
      WHEN duplicate_object THEN null;
    END $$;
  `.execute(db);

  console.log("Enums created");

  await sql`
    CREATE TABLE IF NOT EXISTS likes (
      id              SERIAL PRIMARY KEY,
      user_id         VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type     VARCHAR(20) NOT NULL,
      target_id       VARCHAR(50) NOT NULL,
      created_at      TIMESTAMP DEFAULT NOW(),
      
      CONSTRAINT unique_user_like UNIQUE (user_id, target_type, target_id),
      CONSTRAINT check_target_type CHECK (target_type IN ('comment', 'review', 'photo'))
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_likes_target ON likes(target_type, target_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id)`.execute(db);

  console.log("Likes table created");

  await sql`
    CREATE TABLE IF NOT EXISTS reports (
      id              SERIAL PRIMARY KEY,
      reporter_id     VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      target_type     VARCHAR(20) NOT NULL,
      target_id       VARCHAR(50) NOT NULL,
      reason          report_reason_enum NOT NULL,
      details         TEXT,
      status          report_status_enum DEFAULT 'pending',
      admin_notes     TEXT,
      created_at      TIMESTAMP DEFAULT NOW(),
      reviewed_at     TIMESTAMP,
      reviewed_by     VARCHAR(50) REFERENCES users(id),
      
      CONSTRAINT check_report_target_type CHECK (target_type IN ('comment', 'review', 'user', 'photo'))
    )
  `.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_reports_target ON reports(target_type, target_id)`.execute(
    db
  );
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_status ON reports(status)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports(reporter_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_reports_created ON reports(created_at DESC)`.execute(db);

  console.log("Reports table created");

  await sql`
    CREATE OR REPLACE FUNCTION toggle_like(p_user_id VARCHAR, p_target_type VARCHAR, p_target_id VARCHAR)
    RETURNS TABLE(liked BOOLEAN, like_count INTEGER) AS $$
    DECLARE
      v_liked BOOLEAN;
      v_count INTEGER;
    BEGIN
      IF EXISTS (SELECT 1 FROM likes WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id) THEN
        DELETE FROM likes WHERE user_id = p_user_id AND target_type = p_target_type AND target_id = p_target_id;
        v_liked := FALSE;
      ELSE
        INSERT INTO likes (user_id, target_type, target_id) VALUES (p_user_id, p_target_type, p_target_id);
        v_liked := TRUE;
      END IF;
      
      SELECT COUNT(*)::INTEGER INTO v_count FROM likes WHERE target_type = p_target_type AND target_id = p_target_id;
      
      RETURN QUERY SELECT v_liked, v_count;
    END;
    $$ LANGUAGE plpgsql
  `.execute(db);

  console.log("Helper functions created");
  console.log("Migration 010_likes_reports completed");
}

async function down(db) {
  console.log("Dropping likes and reports tables...");

  await sql`DROP FUNCTION IF EXISTS toggle_like`.execute(db);
  await sql`DROP TABLE IF EXISTS reports`.execute(db);
  await sql`DROP TABLE IF EXISTS likes`.execute(db);
  await sql`DROP TYPE IF EXISTS report_reason_enum`.execute(db);
  await sql`DROP TYPE IF EXISTS report_status_enum`.execute(db);

  console.log(" Likes and reports tables dropped");
}

module.exports = { up, down };
