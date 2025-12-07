import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, error } from "../../middlewares/response";

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Parse query parameters
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");
      const status = params.status || "approved";

      // Build query
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
          "rating_count",
          "review_count",
        ])
        .where("status", "=", status)
        .orderBy("rating_overall", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom("restaurants")
        .select(db.fn.count("id").as("total"))
        .where("status", "=", status)
        .executeTakeFirst();

      return success({
        places,
        pagination: {
          limit,
          offset,
          total: parseInt(String(countResult?.total || 0)),
        },
      });
    } catch (err) {
      console.error("[places/list] Error:", err);
      return error((err as Error).message);
    }
  },
};
