import crypto from 'crypto';
import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, error } from '../../middlewares/response';

interface CreatePlaceBody {
  name_vi: string;
  slug?: string;
  address: string;
  district?: string;
  ward?: string;
  geo_lat: number;
  geo_lng: number;
  cuisine_types?: string[];
  price_min?: number;
  price_max?: number;
  status?: string;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Parse body
      let body: CreatePlaceBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const {
        name_vi,
        slug,
        address,
        district,
        ward,
        geo_lat,
        geo_lng,
        cuisine_types = [],
        price_min,
        price_max,
        status = 'approved',
      } = body;

      // Basic validation
      if (!name_vi || !address || geo_lat == null || geo_lng == null) {
        return badRequest(
          'Missing required fields: name_vi, address, geo_lat, geo_lng'
        );
      }

      const finalSlug =
        slug ||
        String(name_vi)
          .trim()
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9\-]/g, '');

      // Insert into restaurants table
      const [created] = await db
        .insertInto('restaurants')
        .values({
          id: crypto.randomUUID(),
          name_vi,
          slug: finalSlug,
          address,
          district,
          ward,
          geo_lat,
        geo_lng,
        // DB column is JSON – store as valid JSON string
        cuisine_types: Array.isArray(cuisine_types)
          ? JSON.stringify(cuisine_types)
          : JSON.stringify([]),
          price_min,
          price_max,
          status,
        })
        .returningAll()
        .execute();

      return success(created, 201);
    } catch (err) {
      console.error('[places/create] Error:', err);
      return error((err as Error).message);
    }
  },
};


