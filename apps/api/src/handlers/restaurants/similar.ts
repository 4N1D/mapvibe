import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error } from '../../middlewares/response';
import { sql } from 'kysely';

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get current restaurant
      const currentRestaurant = await db
        .selectFrom('restaurants')
        .select([
          'id',
          'district',
          'cuisine_types',
          'price_min',
          'price_max',
          'rating_overall',
        ])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!currentRestaurant) {
        return notFound('Restaurant not found');
      }

      // Extract cuisine type names for comparison
      const currentCuisineTypes = (currentRestaurant.cuisine_types as any[] || []).map(
        (ct: any) => ct.name
      );

      // Find similar restaurants
      const similarRestaurants = await db
        .selectFrom('restaurants')
        .select([
          'id',
          'name_vi as name',
          'slug',
          'address',
          'district',
          'ward',
          'price_min',
          'price_max',
          'rating_overall',
          'opening_hours',
          'cuisine_types',
        ])
        .where('id', '!=', currentRestaurant.id)
        .where('status', '=', 'approved')
        .where('district', '=', currentRestaurant.district || '')
        .execute();

      // Calculate similarity score for each restaurant
      const scoredRestaurants = similarRestaurants.map((restaurant) => {
        let score = 0;

        // 1. Cuisine type overlap (most important - 40 points)
        const restaurantCuisineTypes = (restaurant.cuisine_types as any[] || []).map(
          (ct: any) => ct.name
        );
        const cuisineOverlap = currentCuisineTypes.filter((ct) =>
          restaurantCuisineTypes.includes(ct)
        ).length;
        score += cuisineOverlap * 40;

        // 2. Price range similarity (20 points)
        if (restaurant.price_min && restaurant.price_max && currentRestaurant.price_min && currentRestaurant.price_max) {
          const priceDiff = Math.abs(
            (restaurant.price_min + restaurant.price_max) / 2 -
              (currentRestaurant.price_min + currentRestaurant.price_max) / 2
          );
          const maxPrice = Math.max(
            (restaurant.price_min + restaurant.price_max) / 2,
            (currentRestaurant.price_min + currentRestaurant.price_max) / 2
          );
          const priceScore = Math.max(0, 20 - (priceDiff / maxPrice) * 20);
          score += priceScore;
        }

        // 3. Rating similarity (20 points)
        const currentRating = parseFloat(currentRestaurant.rating_overall || '0');
        const restaurantRating = parseFloat(restaurant.rating_overall || '0');
        const ratingDiff = Math.abs(currentRating - restaurantRating);
        const ratingScore = Math.max(0, 20 - ratingDiff * 2);
        score += ratingScore;

        // 4. Same district (already filtered, bonus 20 points)
        score += 20;

        return {
          ...restaurant,
          similarity_score: Math.round(score),
        };
      });

      // Sort by similarity score and take top 5
      const topSimilar = scoredRestaurants
        .sort((a, b) => b.similarity_score - a.similarity_score)
        .slice(0, 5);

      // Fetch images for each similar restaurant
      const restaurantsWithImages = await Promise.all(
        topSimilar.map(async (restaurant) => {
          const photos = await db
            .selectFrom('photos')
            .select(['s3_url'])
            .where('restaurant_id', '=', restaurant.id)
            .where('is_safe', '=', true)
            .orderBy('display_order', 'asc')
            .limit(1)
            .executeTakeFirst();

          return {
            id: restaurant.id,
            name: restaurant.name,
            slug: restaurant.slug,
            address: restaurant.address,
            ward: restaurant.ward,
            district: restaurant.district,
            rating: restaurant.rating_overall,
            priceRange: restaurant.price_min && restaurant.price_max
              ? `${restaurant.price_min.toLocaleString()} vnđ - ${restaurant.price_max.toLocaleString()} vnđ`
              : null,
            hours: restaurant.opening_hours,
            image: photos?.s3_url || null,
            similarity_score: restaurant.similarity_score,
          };
        })
      );

      return success({
        restaurant_id: currentRestaurant.id,
        similar_places: restaurantsWithImages,
      });
    } catch (err) {
      console.error('[restaurants/similar] Error:', err);
      return error((err as Error).message);
    }
  },
};
