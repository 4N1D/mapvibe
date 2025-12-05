import { getDb } from '../services/db';

/**
 * Recalculates and updates the average ratings for a restaurant
 * based on all reviews in the restaurant_reviews table.
 * This function runs asynchronously after a new review is submitted.
 */
export async function recalculateRestaurantRatings(restaurantId: string): Promise<void> {
  const db = await getDb();

  // Calculate average ratings from all reviews
  const avgResult = await db
    .selectFrom('restaurant_reviews')
    .select((eb) => [
      eb.fn.avg('rating_service').as('avg_service'),
      eb.fn.avg('rating_location').as('avg_location'),
      eb.fn.avg('rating_price').as('avg_price'),
      eb.fn.avg('rating_quality').as('avg_quality'),
      eb.fn.avg('rating_ambiance').as('avg_ambiance'),
      eb.fn.avg('rating_overall').as('avg_overall'),
      eb.fn.count('id').as('review_count'),
    ])
    .where('restaurant_id', '=', restaurantId)
    .executeTakeFirst();

  if (!avgResult) {
    return;
  }

  // Update restaurant with new average ratings
  await db
    .updateTable('restaurants')
    .set({
      rating_service: avgResult.avg_service ? Number(avgResult.avg_service) : null,
      rating_location: avgResult.avg_location ? Number(avgResult.avg_location) : null,
      rating_price: avgResult.avg_price ? Number(avgResult.avg_price) : null,
      rating_quality: avgResult.avg_quality ? Number(avgResult.avg_quality) : null,
      rating_ambiance: avgResult.avg_ambiance ? Number(avgResult.avg_ambiance) : null,
      rating_overall: avgResult.avg_overall ? Number(avgResult.avg_overall) : null,
      review_count: Number(avgResult.review_count),
      updated_at: new Date(),
    })
    .where('id', '=', restaurantId)
    .execute();

  console.log(`[rating] Recalculated ratings for restaurant ${restaurantId}: overall=${avgResult.avg_overall}`);
}
