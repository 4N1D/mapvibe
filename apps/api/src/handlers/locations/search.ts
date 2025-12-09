import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";
import { sql } from "kysely";

// GET /locations/search?q=query&limit=10
// Search location_addresses and restaurants by name
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const params = event.queryStringParameters || {};
      const query = params.q?.trim();
      const limit = Math.min(parseInt(params.limit || "10"), 20);

      if (!query || query.length < 2) {
        return success({ locations: [] });
      }

      // Search only pending location_addresses (not yet approved)
      // Approved locations are already in restaurants table - users should review there
      const searchPattern = `%${query}%`;

      const result = await sql`
        SELECT 
          la.id,
          la.restaurant_name as name,
          la.full_address as address,
          la.street_address,
          la.ward,
          la.city,
          la.status,
          la.price_min,
          la.price_max,
          la.phone,
          la.opening_hours,
          la.cuisine_types,
          la.features
        FROM location_addresses la
        WHERE la.restaurant_name ILIKE ${searchPattern}
          AND la.status = 'pending'
        ORDER BY la.restaurant_name ASC
        LIMIT ${limit}
      `.execute(db);

      interface LocationRow {
        id: string;
        name: string;
        address: string | null;
        street_address: string | null;
        ward: string | null;
        city: string | null;
        status: string;
        price_min: number | null;
        price_max: number | null;
        phone: string | null;
        opening_hours: string | null;
        cuisine_types: string | null;
        features: string | null;
      }

      const locations = (result.rows as LocationRow[]).map((row) => ({
        id: row.id,
        name: row.name,
        address: row.address || [row.street_address, row.ward, row.city].filter(Boolean).join(", "),
        status: row.status,
        price_min: row.price_min,
        price_max: row.price_max,
        phone: row.phone,
        opening_hours: row.opening_hours ? (typeof row.opening_hours === 'string' ? JSON.parse(row.opening_hours) : row.opening_hours) : null,
        cuisine_types: row.cuisine_types ? (typeof row.cuisine_types === 'string' ? JSON.parse(row.cuisine_types) : row.cuisine_types) : null,
        features: row.features ? (typeof row.features === 'string' ? JSON.parse(row.features) : row.features) : null,
      }));

      return success({ locations });
    } catch (err) {
      console.error("[locations/search] Error:", err);
      return error((err as Error).message);
    }
  },
};
