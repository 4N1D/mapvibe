import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error } from "../../middlewares/response";

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Get ID or slug from path parameters
      const idOrSlug = event.pathParameters?.id;

      if (!idOrSlug) {
        return badRequest("Place ID or slug is required");
      }

      // Get place by ID or slug
      const place = await db
        .selectFrom("restaurants")
        .selectAll()
        .where((eb) => eb.or([eb("id", "=", idOrSlug), eb("slug", "=", idOrSlug)]))
        .executeTakeFirst();

      if (!place) {
        return notFound("Place not found");
      }

      // Get recent reviews
      const reviews = await db
        .selectFrom("restaurant_reviews")
        .innerJoin("users", "users.id", "restaurant_reviews.author_id")
        .select([
          "restaurant_reviews.id",
          "restaurant_reviews.rating_overall",
          "restaurant_reviews.text",
          "restaurant_reviews.created_at",
          "users.display_name as author_name",
          "users.avatar as author_avatar",
        ])
        .where("restaurant_reviews.restaurant_id", "=", place.id)
        .orderBy("restaurant_reviews.created_at", "desc")
        .limit(5)
        .execute();

      // Get photos
      const photos = await db
        .selectFrom("photos")
        .select(["id", "s3_url", "s3_thumbnail_url", "photo_type"])
        .where("restaurant_id", "=", place.id)
        .where("is_safe", "=", true)
        .orderBy("display_order", "asc")
        .limit(10)
        .execute();

      return success({
        place,
        reviews,
        photos,
      });
    } catch (err) {
      console.error("[places/getById] Error:", err);
      return error((err as Error).message);
    }
  },
};
