const { sql } = require("kysely");

async function up(db) {
  console.log("Updating text length constraints to 300 characters...");

  // Drop old constraint and add new one for review_posts
  // Using NOT VALID to skip checking existing rows
  await sql`
    ALTER TABLE review_posts 
    DROP CONSTRAINT IF EXISTS check_text_length
  `.execute(db);
  
  await sql`
    ALTER TABLE review_posts 
    ADD CONSTRAINT check_text_length CHECK (char_length(text) >= 300) NOT VALID
  `.execute(db);
  console.log("  ✓ Updated review_posts constraint to >= 300 chars (NOT VALID for existing rows)");

  // Drop old constraint and add new one for restaurant_reviews
  await sql`
    ALTER TABLE restaurant_reviews 
    DROP CONSTRAINT IF EXISTS check_review_text_length
  `.execute(db);
  
  await sql`
    ALTER TABLE restaurant_reviews 
    ADD CONSTRAINT check_review_text_length CHECK (char_length(text) >= 300) NOT VALID
  `.execute(db);
  console.log("  ✓ Updated restaurant_reviews constraint to >= 300 chars (NOT VALID for existing rows)");

  console.log("Migration completed successfully");
  console.log("Note: Existing rows with text < 300 chars are preserved. New rows must have >= 300 chars.");
}

async function down(db) {
  console.log("Reverting text length constraints to 100 characters...");

  // Revert review_posts
  await sql`
    ALTER TABLE review_posts 
    DROP CONSTRAINT IF EXISTS check_text_length
  `.execute(db);
  
  await sql`
    ALTER TABLE review_posts 
    ADD CONSTRAINT check_text_length CHECK (char_length(text) >= 100)
  `.execute(db);

  // Revert restaurant_reviews
  await sql`
    ALTER TABLE restaurant_reviews 
    DROP CONSTRAINT IF EXISTS check_review_text_length
  `.execute(db);
  
  await sql`
    ALTER TABLE restaurant_reviews 
    ADD CONSTRAINT check_review_text_length CHECK (char_length(text) >= 100)
  `.execute(db);

  console.log("  ✓ Reverted constraints to >= 100 chars");
}

module.exports = { up, down };
