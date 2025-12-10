import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";

// GET /users/me/photos - Get current user's uploaded photos
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
      const photoType = params.photo_type;

      let query = db
        .selectFrom("photos")
        .leftJoin("restaurants", "restaurants.id", "photos.restaurant_id")
        .select([
          "photos.id",
          "photos.s3_url",
          "photos.s3_thumbnail_url",
          "photos.photo_type",
          "photos.restaurant_id",
          "restaurants.name_vi as restaurant_name",
          "restaurants.slug as restaurant_slug",
          "photos.review_post_id",
          "photos.location_address_id",
          "photos.view_count",
          "photos.created_at",
        ])
        .where("photos.uploaded_by", "=", userId)
        .orderBy("photos.created_at", "desc")
        .limit(limit)
        .offset(offset);

      if (photoType) {
        query = query.where("photos.photo_type", "=", photoType);
      }

      const photos = await query.execute();

      // Get total count
      let countQuery = db
        .selectFrom("photos")
        .select((eb) => eb.fn.count("id").as("total"))
        .where("uploaded_by", "=", userId);

      if (photoType) {
        countQuery = countQuery.where("photo_type", "=", photoType);
      }

      const countResult = await countQuery.executeTakeFirst();
      const total = Number(countResult?.total || 0);

      return success({
        photos,
        total,
        limit,
        offset,
      });
    } catch (err) {
      console.error("[users/me/photos] Error:", err);
      return error((err as Error).message);
    }
  },
};
