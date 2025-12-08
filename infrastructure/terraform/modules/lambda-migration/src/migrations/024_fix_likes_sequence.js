const { sql } = require("kysely");

async function up(db) {
  console.log("Fixing likes table sequence...");

  // Reset the sequence to max(id) + 1
  await sql`
    SELECT setval('likes_id_seq', COALESCE((SELECT MAX(id) FROM likes), 0) + 1, false)
  `.execute(db);

  console.log("Migration 024_fix_likes_sequence completed");
}

async function down(db) {
  // No rollback needed
  console.log("No rollback needed for sequence fix");
}

module.exports = { up, down };
