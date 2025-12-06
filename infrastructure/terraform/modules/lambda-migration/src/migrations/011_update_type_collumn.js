const { sql } = require("kysely");

async function up(db) {
  console.log("Updating columns and removing ai_aggregated_info in 'restaurants' table...");

  await sql`
    ALTER TABLE restaurants 
    ALTER COLUMN features TYPE TEXT[],
    ALTER COLUMN business_type TYPE TEXT,
    DROP COLUMN IF EXISTS ai_aggregated_info;
  `.execute(db);

  console.log("  ✓ Updated 'features' to TEXT[]");
  console.log("  ✓ Updated 'business_type' to TEXT");
  console.log("  ✓ Dropped 'ai_aggregated_info'");

  console.log("Migration for restaurant table schema update completed successfully");
}

async function down(db) {
  console.log("Reverting changes to 'restaurants' table...");

  // Lưu ý: Việc chuyển từ TEXT về VARCHAR(50) có thể gây lỗi nếu dữ liệu hiện tại dài hơn 50 ký tự.
  // PostgreSQL sẽ báo lỗi nếu có dữ liệu bị cắt bớt mà không có ép kiểu rõ ràng.
  await sql`
    ALTER TABLE restaurants 
    ADD COLUMN IF NOT EXISTS ai_aggregated_info JSON,
    ALTER COLUMN business_type TYPE VARCHAR(50),
    ALTER COLUMN features TYPE VARCHAR(50)[];
  `.execute(db);

  console.log("  ✓ Reverted columns types and added ai_aggregated_info back");
}

module.exports = { up, down };