import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";

interface SearchBody {
  query: string;
  limit?: number;
  offset?: number;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Parse body
      let body: SearchBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { query, limit = 20, offset = 0 } = body;

      if (!query || query.length < 2) {
        return badRequest("Query must be at least 2 characters");
      }

      // Full-text search with ILIKE
      const places = await db
        .selectFrom("restaurants")
        .select([
          "id",
          "name_vi",
          "slug",
          "address",
          "geo_lat",
          "geo_lng",
          "cuisine_types",
          "price_min",
          "price_max",
          "rating_overall",
          "review_count",
        ])
        .where("status", "=", "approved")
        .where((eb) =>
          eb.or([eb("name_vi", "ilike", `%${query}%`), eb("address", "ilike", `%${query}%`)])
        )
        .orderBy("rating_overall", "desc")
        .limit(Math.min(limit, 100))
        .offset(offset)
        .execute();

      return success({
        query,
        places,
        count: places.length,
      });
    } catch (err) {
      console.error("[places/search] Error:", err);
      return error((err as Error).message);
    }
  },
};
