import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";

interface BatchGetBody {
  ids: string[];
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Parse body
      let body: BatchGetBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const ids = Array.isArray(body.ids) ? body.ids : [];

      if (!ids.length) {
        return badRequest('Field "ids" must be a non-empty array');
      }

      const limitedIds = ids.slice(0, 100);

      const places = await db
        .selectFrom("restaurants")
        .select([
          "id",
          "name_vi",
          "slug",
          "address",
          "district",
          "geo_lat",
          "geo_lng",
          "cuisine_types",
          "price_min",
          "price_max",
          "rating_overall",
          "rating_count",
          "review_count",
          "status",
        ])
        .where("id", "in", limitedIds)
        .execute();

      return success({
        requestedIds: limitedIds,
        count: places.length,
        places,
      });
    } catch (err) {
      console.error("[places/batch] Error:", err);
      return error((err as Error).message);
    }
  },
};
