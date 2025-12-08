import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";

// GET /users/me/saved - Get current user's saved restaurants
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      const db = await getDb();

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");

      const saved = await db
        .selectFrom("favorites")
        .innerJoin("restaurants", "restaurants.id", "favorites.restaurant_id")
        .select([
          "restaurants.id as restaurant_id",
          "restaurants.name_vi as name",
          "restaurants.slug",
          "restaurants.address",
          "restaurants.ward",
          "restaurants.rating_overall",
          "restaurants.review_count",
          "restaurants.price_min",
          "restaurants.price_max",
          "favorites.saved_at",
        ])
        .where("favorites.user_id", "=", userId)
        .orderBy("favorites.saved_at", "desc")
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom("favorites")
        .select((eb) => eb.fn.count("restaurant_id").as("total"))
        .where("user_id", "=", userId)
        .executeTakeFirst();

      const total = Number(countResult?.total || 0);

      return success({
        saved,
        total,
        limit,
        offset,
      });
    } catch (err) {
      console.error("[users/me/saved] Error:", err);
      return error((err as Error).message);
    }
  },
};
