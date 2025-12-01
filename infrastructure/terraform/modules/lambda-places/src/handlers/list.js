const { getDb } = require('../services/db');
const { success, error } = require('../middlewares/response');

async function handle(event) {
  const db = await getDb();
  
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const limit = Math.min(parseInt(params.limit) || 20, 100);
  const offset = parseInt(params.offset) || 0;
  const district = params.district;
  const status = params.status || 'approved';
  
  let query = db
    .selectFrom('restaurants')
    .select([
      'id',
      'name_vi',
      'slug',
      'address',
      'district',
      'geo_lat',
      'geo_lng',
      'cuisine_types',
      'price_min',
      'price_max',
      'rating_overall',
      'rating_count',
      'review_count',
    ])
    .where('status', '=', status)
    .orderBy('rating_overall', 'desc')
    .limit(limit)
    .offset(offset);
  
  if (district) {
    query = query.where('district', '=', district);
  }
  
  const places = await query.execute();
  
  // Get total count
  const countResult = await db
    .selectFrom('restaurants')
    .select(db.fn.count('id').as('total'))
    .where('status', '=', status)
    .executeTakeFirst();
  
  return success({
    places,
    pagination: {
      limit,
      offset,
      total: parseInt(countResult?.total || 0),
    },
  });
}

module.exports = { handle };
