const { sql } = require("kysely");

async function up(db) {
  console.log("Updating restaurant_reviews text constraint to >= 50 characters...");

  await sql`
    ALTER TABLE restaurant_reviews 
    DROP CONSTRAINT IF EXISTS check_review_text_length
  `.execute(db);

  await sql`
    ALTER TABLE restaurant_reviews 
    ADD CONSTRAINT check_review_text_length CHECK (char_length(text) >= 50) NOT VALID
  `.execute(db);
  
  console.log("Migration 023_update_review_text_constraint completed");
}

async function down(db) {
  console.log("Reverting restaurant_reviews text constraint to >= 300 characters...");

  await sql`
    ALTER TABLE restaurant_reviews 
    DROP CONSTRAINT IF EXISTS check_review_text_length
  `.execute(db);

  await sql`
    ALTER TABLE restaurant_reviews 
    ADD CONSTRAINT check_review_text_length CHECK (char_length(text) >= 300)
  `.execute(db);
}

module.exports = { up, down };
