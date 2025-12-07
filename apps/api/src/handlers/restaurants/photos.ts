import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error } from '../../middlewares/response';

type PhotoType = 'food' | 'view' | 'menu' | 'other';

// GET /restaurants/:slug/photos - Fetch photos with optional type filter
export const listHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '50'), 200);
      const offset = parseInt(params.offset || '0');
      const photoType = params.type as PhotoType | undefined;

      // Build query
      let query = db
        .selectFrom('photos')
        .select([
          'id',
          's3_url',
          's3_thumbnail_url',
          's3_medium_url',
          's3_large_url',
          'photo_type',
          'display_order',
          'view_count',
          'created_at',
        ])
        .where('restaurant_id', '=', restaurant.id)
        .where('is_safe', '=', true);

      // Filter by photo type if provided
      if (photoType) {
        query = query.where('photo_type', '=', photoType);
      }

      const photos = await query
        .orderBy('display_order', 'asc')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      // Get counts by type
      const typeCounts = await db
        .selectFrom('photos')
        .select(['photo_type'])
        .select((eb) => eb.fn.count('id').as('count'))
        .where('restaurant_id', '=', restaurant.id)
        .where('is_safe', '=', true)
        .groupBy('photo_type')
        .execute();

      const counts: Record<string, number> = {};
      for (const row of typeCounts) {
        counts[row.photo_type as string] = Number(row.count);
      }

      return success({
        restaurant_id: restaurant.id,
        photos,
        counts,
        pagination: {
          limit,
          offset,
          total: photos.length,
        },
      });
    } catch (err) {
      console.error('[restaurants/photos/list] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /restaurants/:slug/menu - Fetch menu photos only
export const menuHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '50'), 200);
      const offset = parseInt(params.offset || '0');

      // Fetch menu photos only
      const menuPhotos = await db
        .selectFrom('photos')
        .select([
          'id',
          's3_url',
          's3_thumbnail_url',
          's3_medium_url',
          's3_large_url',
          'display_order',
          'view_count',
          'created_at',
        ])
        .where('restaurant_id', '=', restaurant.id)
        .where('photo_type', '=', 'menu')
        .where('is_safe', '=', true)
        .orderBy('display_order', 'asc')
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom('photos')
        .select((eb) => eb.fn.count('id').as('total'))
        .where('restaurant_id', '=', restaurant.id)
        .where('photo_type', '=', 'menu')
        .where('is_safe', '=', true)
        .executeTakeFirst();

      return success({
        restaurant_id: restaurant.id,
        menu_photos: menuPhotos,
        pagination: {
          limit,
          offset,
          total: Number(countResult?.total || 0),
        },
      });
    } catch (err) {
      console.error('[restaurants/menu] Error:', err);
      return error((err as Error).message);
    }
  },
};
