const { sql } = require('kysely');

async function up(db) {
  console.log('Migrating: Setup extensions, adjust vector column, and re-index...');
  
  // Kích hoạt extension unaccent
  await sql`CREATE EXTENSION IF NOT EXISTS unaccent;`.execute(db);

  // Tạo lại index với hsnw cho vector column
  await sql`DROP INDEX IF EXISTS idx_context_eb_hnsw`.execute(db);
  await sql`CREATE INDEX idx_context_eb_hnsw ON restaurants USING hnsw (embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);`.execute(db);
  
  // Tạo hàm immutable wrapper cho unaccent (để dùng được trong Index)
  await sql`CREATE OR REPLACE FUNCTION f_unaccent(text) RETURNS text AS $$
            SELECT public.unaccent('public.unaccent', $1)
            $$ LANGUAGE sql IMMUTABLE;`.execute(db);

  // Tạo lại index với unaccent          
  await sql`DROP INDEX IF EXISTS idx_restaurants_name_trgm;`.execute(db);   
  await sql`CREATE INDEX idx_restaurants_name_trgm ON restaurants USING gin (f_unaccent(name_vi) gin_trgm_ops);`.execute(db);
  
  await sql`CREATE INDEX idx_restaurants_addr_trgm ON restaurants USING gin (f_unaccent(address) gin_trgm_ops);`.execute(db);
  
  // Thay đổi cấu trúc cột Vector
  await sql`ALTER TABLE restaurants
            ALTER COLUMN embedding TYPE vector(1024)
            USING NULL;`.execute(db);
  

  console.log('Extensions and types created successfully');
}

async function down(db) {
  console.log('Reverting migration...');

  // Xóa các Index đã tạo ở bước UP
  await sql`DROP INDEX IF EXISTS idx_context_eb_hnsw`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_restaurants_name_trgm`.execute(db);
  await sql`DROP INDEX IF EXISTS idx_restaurants_addr_trgm`.execute(db);

  // Revert cột vector về trạng thái cũ (1536)
  // Lưu ý: Dữ liệu vẫn sẽ là NULL vì không thể khôi phục embedding đã mất
  await sql`
    ALTER TABLE restaurants
    ALTER COLUMN embedding TYPE vector(1536)
    USING NULL
  `.execute(db);

  // Xóa hàm phụ trợ
  await sql`DROP FUNCTION IF EXISTS f_unaccent(text)`.execute(db);

  // Không nên DROP EXTENSION trong migration của app trừ khi bạn chắc chắn không bảng nào khác dùng nó.
  
  console.log('Migration DOWN completed.');
}

module.exports = { up, down };
