const { sql } = require("kysely");

async function up(db) {
  console.log("Adding indexes for comment likes queries...");

  // Add composite index for efficiently querying user's liked comments
  await sql`
    CREATE INDEX IF NOT EXISTS idx_likes_user_comment 
    ON likes(user_id, target_id) 
    WHERE target_type = 'comment'
  `.execute(db);

  console.log("  ✓ idx_likes_user_comment index created");

  // Add index for querying likes by target_id when target_type is comment
  await sql`
    CREATE INDEX IF NOT EXISTS idx_likes_comment_target 
    ON likes(target_id) 
    WHERE target_type = 'comment'
  `.execute(db);

  console.log("  ✓ idx_likes_comment_target index created");

  console.log("Migration 019_add_comment_likes_index completed");
}

async function down(db) {
  console.log("Dropping comment likes indexes...");

  await sql`DROP INDEX IF EXISTS idx_likes_user_comment`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_likes_comment_target`.execute(db);

  console.log("Comment likes indexes dropped");
}

module.exports = { up, down };
