import crypto from 'crypto';
import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, notFound, error } from '../../middlewares/response';
import { sql } from 'kysely';

interface ApproveLocationBody {
  location_address_id: string;
  admin_id?: string;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: ApproveLocationBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { location_address_id, admin_id } = body;

      if (!location_address_id) {
        return badRequest('location_address_id is required');
      }

      // Fetch the location_address (pending or not yet approved)
      const location = await db
        .selectFrom('location_addresses')
        .selectAll()
        .where('id', '=', location_address_id)
        .executeTakeFirst();

      if (!location) {
        return notFound('Location not found');
      }

      if (location.status === 'approved') {
        return badRequest('Location is already approved');
      }

      const restaurantId = crypto.randomUUID();

      // Generate slug from restaurant name
      const slug = String(location.restaurant_name || 'unnamed')
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9-]/g, '')
        .substring(0, 100) + '-' + restaurantId.substring(0, 8);

      // Execute promotion transaction
      await db.transaction().execute(async (trx) => {
        // Step 1: Create new restaurant record with all ratings set to 10
        await sql`
          INSERT INTO restaurants (
            id,
            name_vi,
            slug,
            address,
            district,
            ward,
            geo_lat,
            geo_lng,
            location,
            cuisine_types,
            price_min,
            price_max,
            rating_service,
            rating_location,
            rating_price,
            rating_quality,
            rating_ambiance,
            rating_overall,
            rating_count,
            review_count,
            status,
            created_from_location_id,
            created_by,
            created_at,
            updated_at
          ) VALUES (
            ${restaurantId},
            ${location.restaurant_name},
            ${slug},
            ${location.street_address},
            ${location.district},
            ${location.ward || null},
            ${location.geo_lat},
            ${location.geo_lng},
            ST_SetSRID(ST_MakePoint(${location.geo_lng}, ${location.geo_lat}), 4326),
            ${location.cuisine_types ? JSON.stringify(location.cuisine_types) : null}::json,
            ${location.price_min || null},
            ${location.price_max || null},
            10,
            10,
            10,
            10,
            10,
            10,
            0,
            0,
            'approved',
            ${location_address_id},
            ${admin_id || null},
            NOW(),
            NOW()
          )
        `.execute(trx);

        // Step 2: Update location_addresses - set status to 'approved' and link restaurant_id
        await sql`
          UPDATE location_addresses
          SET 
            status = 'approved',
            restaurant_id = ${restaurantId},
            updated_at = NOW()
          WHERE id = ${location_address_id}
        `.execute(trx);
      });

      return success({
        message: 'Location approved and promoted to restaurant successfully',
        restaurant: {
          id: restaurantId,
          name: location.restaurant_name,
          slug,
          address: location.street_address,
          district: location.district,
          ratings: {
            rating_service: 10,
            rating_location: 10,
            rating_price: 10,
            rating_quality: 10,
            rating_ambiance: 10,
            rating_overall: 10,
          },
          review_count: 0,
        },
        location_address: {
          id: location_address_id,
          status: 'approved',
        },
      });
    } catch (err) {
      console.error('[reviews/approve-location] Error:', err);
      return error((err as Error).message);
    }
  },
};
