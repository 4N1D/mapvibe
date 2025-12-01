const { getDb } = require('../services/db');
const { success, badRequest } = require('../middlewares/response');

async function handle(event) {
  const db = await getDb();
  
  // Parse body
  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch {
    return badRequest('Invalid JSON body');
  }
  
  const { query, district, limit = 20, offset = 0 } = body;
  
  if (!query || query.length < 2) {
    return badRequest('Query must be at least 2 characters');
  }
  
  // Full-text search with trigram similarity
  let searchQuery = db
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
      'review_count',
    ])
    .where('status', '=', 'approved')
    .where((eb) =>
      eb.or([
        eb('name_vi', 'ilike', `%${query}%`),
        eb('address', 'ilike', `%${query}%`),
      ])
    )
    .orderBy('rating_overall', 'desc')
    .limit(Math.min(limit, 100))
    .offset(offset);
  
  if (district) {
    searchQuery = searchQuery.where('district', '=', district);
  }
  
  const places = await searchQuery.execute();
  
  return success({
    query,
    places,
    count: places.length,
  });
}

module.exports = { handle };
