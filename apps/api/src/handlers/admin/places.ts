import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, unauthorized, notFound, error } from '../../middlewares/response';
import { getUserIdFromEvent, isUserAdmin } from '../../utils/auth';
import { sql } from 'kysely';

// GET /admin/places - List all places with filters
export const listPlacesHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};
      
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = parseInt(params.offset || '0');
      const search = params.search || '';
      const status = params.status; // active, inactive, pending

      let query = db
        .selectFrom('restaurants')
        .select([
          'id',
          'name_vi',
          'slug',
          'address',
          'cuisine_types',
          'price_min',
          'price_max',
          'rating_overall',
          'review_count',
          'status',
          'created_at',
          'updated_at',
        ])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('name_vi', 'ilike', `%${search}%`),
            eb('address', 'ilike', `%${search}%`),
          ])
        );
      }

      if (status) {
        query = query.where('status', '=', status);
      }

      const [places, countResult] = await Promise.all([
        query.execute(),
        db.selectFrom('restaurants')
          .select(sql<number>`count(*)::int`.as('total'))
          .executeTakeFirst(),
      ]);

      return success({
        places,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/places] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/places/:id - Get place details
export const getPlaceHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest('Place ID required');
      }

      const db = await getDb();

      const place = await db
        .selectFrom('restaurants')
        .selectAll()
        .where('id', '=', placeId)
        .executeTakeFirst();

      if (!place) {
        return notFound('Place not found');
      }

      // Get related stats
      const [reviewCount, photoCount] = await Promise.all([
        db.selectFrom('review_posts')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('restaurant_id', '=', placeId)
          .executeTakeFirst(),
        db.selectFrom('photos')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('restaurant_id', '=', placeId)
          .executeTakeFirst(),
      ]);

      return success({
        place,
        stats: {
          review_count: reviewCount?.count || 0,
          photo_count: photoCount?.count || 0,
        },
      });
    } catch (err) {
      console.error('[admin/places/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/places/:id - Update place
export const updatePlaceHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest('Place ID required');
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const allowedFields = ['name_vi', 'address', 'district', 'status', 'cuisine_types', 'price_min', 'price_max'];
      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return badRequest('No valid fields to update');
      }

      const db = await getDb();
      updateData.updated_at = new Date();

      const updated = await db
        .updateTable('restaurants')
        .set(updateData)
        .where('id', '=', placeId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return notFound('Place not found');
      }

      return success({ place: updated });
    } catch (err) {
      console.error('[admin/places/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// DELETE /admin/places/:id - Delete place
export const deletePlaceHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest('Place ID required');
      }

      const db = await getDb();

      // Soft delete by setting status to 'deleted'
      const deleted = await db
        .updateTable('restaurants')
        .set({ status: 'deleted', updated_at: new Date() })
        .where('id', '=', placeId)
        .returningAll()
        .executeTakeFirst();

      if (!deleted) {
        return notFound('Place not found');
      }

      return success({ message: 'Place deleted successfully', place: deleted });
    } catch (err) {
      console.error('[admin/places/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};
