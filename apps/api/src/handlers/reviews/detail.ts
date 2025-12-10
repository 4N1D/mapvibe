import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error } from "../../middlewares/response";
import { sql } from "kysely";

// Helper to extract photo IDs from photos JSON
function extractPhotoIds(photos: unknown): string[] {
  if (!photos) return [];

  let photosData = photos;
  if (typeof photosData === "string") {
    try {
      photosData = JSON.parse(photosData);
    } catch {
      return [];
    }
  }

  const photoIds: string[] = [];

  // Handle object format {general: [...], food: [...], menu: [...]}
  if (photosData && typeof photosData === "object" && !Array.isArray(photosData)) {
    const categories = photosData as Record<string, string[]>;
    for (const category of Object.values(categories)) {
      if (Array.isArray(category)) {
        photoIds.push(...category);
      }
    }
  }
  // Handle array format
  else if (Array.isArray(photosData)) {
    for (const p of photosData) {
      if (typeof p === "string") {
        photoIds.push(p);
      } else if (p && typeof p === "object" && "id" in p) {
        photoIds.push((p as { id: string }).id);
      }
    }
  }

  return photoIds;
}

// GET /reviews/:reviewId - Get review detail by ID
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const reviewId = event.pathParameters?.reviewId;

      if (!reviewId) {
        return badRequest("Review ID is required");
      }

      const query = sql`
        SELECT
          rp.id,
          rp.author_id,
          u.display_name as author_name,
          u.avatar as author_avatar,
          rp.location_address_id,
          rp.restaurant_id,
          rp.text,
          rp.features,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.comment_count,
          rp.share_count,
          rp.view_count,
          rp.created_at,
          rp.updated_at,
          la.restaurant_name as location_name,
          la.street_address as location_street_address,
          la.ward as location_ward,
          la.city as location_city,
          la.full_address as location_full_address,
          la.geo_lat as location_geo_lat,
          la.geo_lng as location_geo_lng,
          la.cuisine_types as location_cuisine_types,
          la.price_min as location_price_min,
          la.price_max as location_price_max,
          la.phone as location_phone,
          la.opening_hours as location_opening_hours,
          la.restaurant_id as location_restaurant_id,
          la.review_count as location_review_count,
          la.avg_upvote_rate as location_avg_upvote_rate,
          la.status as location_status,
          r.slug as restaurant_slug
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        LEFT JOIN location_addresses la ON la.id = rp.location_address_id
        LEFT JOIN restaurants r ON r.id = COALESCE(rp.restaurant_id, la.restaurant_id)
        WHERE rp.id = ${reviewId}
      `;

      const result = await query.execute(db);

      if (!result.rows || result.rows.length === 0) {
        return notFound("Review not found");
      }

      // Increment view count
      await db
        .updateTable("review_posts")
        .set((eb) => ({
          view_count: eb("view_count", "+", 1),
        }))
        .where("id", "=", reviewId)
        .execute();

      const row = result.rows[0] as Record<string, unknown>;

      // Extract photo IDs and fetch URLs
      const photoIds = extractPhotoIds(row.photos);
      let photos: Array<{ url: string; caption?: string }> = [];

      if (photoIds.length > 0) {
        const photosFromDb = await db
          .selectFrom("photos")
          .select(["id", "s3_url", "s3_thumbnail_url", "s3_medium_url"])
          .where("id", "in", photoIds)
          .execute();

        // Maintain order and map to URLs
        const photoUrlMap = new Map<string, { url: string }>();
        for (const photo of photosFromDb) {
          photoUrlMap.set(photo.id, {
            url: photo.s3_medium_url || photo.s3_url,
          });
        }

        photos = photoIds
          .map((id) => photoUrlMap.get(id))
          .filter((p): p is { url: string } => p !== undefined);
      }

      const review = {
        ...row,
        photos,
      };

      return success({ review });
    } catch (err) {
      console.error("[reviews/detail] Error:", err);
      return error((err as Error).message);
    }
  },
};
