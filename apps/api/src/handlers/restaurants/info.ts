import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error } from '../../middlewares/response';

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug with all static and aggregated information
      const restaurant = await db
        .selectFrom('restaurants')
        .selectAll()
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      return success({
        id: restaurant.id,
        name: restaurant.name_vi,
        slug: restaurant.slug,
        address: restaurant.address,
        district: restaurant.district,
        ward: restaurant.ward,
        phone: restaurant.phone,
        opening_hours: restaurant.opening_hours,
        geo_lat: restaurant.geo_lat,
        geo_lng: restaurant.geo_lng,
        rating_overall: restaurant.rating_overall,
        rating_price: restaurant.rating_price,
        rating_ambiance: restaurant.rating_ambiance,
        rating_quality: restaurant.rating_quality,
        review_count: restaurant.review_count,
        features: restaurant.features,
        cuisine_types: restaurant.cuisine_types,
        price_min: restaurant.price_min,
        price_max: restaurant.price_max,
        status: restaurant.status,
        created_at: restaurant.created_at,
        updated_at: restaurant.updated_at,
      });
    } catch (err) {
      console.error('[restaurants/info] Error:', err);
      return error((err as Error).message);
    }
  },
};
