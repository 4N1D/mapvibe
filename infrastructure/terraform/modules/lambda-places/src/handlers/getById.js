const { getDb } = require('../services/db');
const { success, notFound, badRequest } = require('../middlewares/response');

async function handle(event) {
  const db = await getDb();
  
  // Get ID from path parameters
  const id = event.pathParameters?.id;
  
  if (!id) {
    return badRequest('Place ID is required');
  }
  
  const place = await db
    .selectFrom('restaurants')
    .selectAll()
    .where('id', '=', id)
    .executeTakeFirst();
  
  if (!place) {
    return notFound('Place not found');
  }
  
  // Get recent reviews
  const reviews = await db
    .selectFrom('restaurant_reviews')
    .innerJoin('users', 'users.id', 'restaurant_reviews.author_id')
    .select([
      'restaurant_reviews.id',
      'restaurant_reviews.rating_overall',
      'restaurant_reviews.text',
      'restaurant_reviews.created_at',
      'users.display_name as author_name',
      'users.avatar as author_avatar',
    ])
    .where('restaurant_reviews.restaurant_id', '=', id)
    .orderBy('restaurant_reviews.created_at', 'desc')
    .limit(5)
    .execute();
  
  // Get photos
  const photos = await db
    .selectFrom('photos')
    .select(['id', 's3_url', 's3_thumbnail_url', 'photo_type'])
    .where('restaurant_id', '=', id)
    .where('is_safe', '=', true)
    .orderBy('display_order', 'asc')
    .limit(10)
    .execute();
  
  return success({
    place,
    reviews,
    photos,
  });
}

module.exports = { handle };
