import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, notFound, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";

// POST /restaurants/:id/save - Toggle save/unsave restaurant
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      const restaurantId = event.pathParameters?.id;

      if (!restaurantId) {
        return badRequest("Restaurant ID is required");
      }

      const db = await getDb();

      // Verify restaurant exists
      const restaurant = await db
        .selectFrom("restaurants")
        .select(["id", "name_vi"])
        .where("id", "=", restaurantId)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound("Restaurant not found");
      }

      // Check if already saved
      const existingFavorite = await db
        .selectFrom("favorites")
        .select(["user_id", "restaurant_id"])
        .where("user_id", "=", userId)
        .where("restaurant_id", "=", restaurantId)
        .executeTakeFirst();

      if (existingFavorite) {
        // Remove from favorites
        await db
          .deleteFrom("favorites")
          .where("user_id", "=", userId)
          .where("restaurant_id", "=", restaurantId)
          .execute();

        return success({
          saved: false,
          message: "Restaurant removed from saved",
          restaurant_id: restaurantId,
        });
      } else {
        // Add to favorites
        await db
          .insertInto("favorites")
          .values({
            user_id: userId,
            restaurant_id: restaurantId,
          })
          .execute();

        return success({
          saved: true,
          message: "Restaurant saved",
          restaurant_id: restaurantId,
        });
      }
    } catch (err) {
      console.error("[restaurants/:id/save] Error:", err);
      return error((err as Error).message);
    }
  },
};
