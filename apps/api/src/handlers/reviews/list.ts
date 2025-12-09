import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, error } from "../../middlewares/response";
import { sql } from "kysely";

// Helper to extract photo IDs from photos JSON (supports multiple formats)
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
    const categories = photosData as Record<string, unknown[]>;
    for (const category of Object.values(categories)) {
      if (Array.isArray(category)) {
        for (const item of category) {
          if (typeof item === "string") {
            photoIds.push(item);
          } else if (item && typeof item === "object" && "id" in item) {
            photoIds.push((item as { id: string }).id);
          }
        }
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

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");
      const restaurantId = params.restaurant_id;

      let query;
      if (restaurantId) {
        query = sql`
          SELECT
            rp.id,
            rp.author_id,
            u.display_name as author_name,
            u.avatar as author_avatar,
            rp.location_address_id,
            rp.text,
            rp.features,
            rp.photos,
            rp.upvote_count,
            rp.downvote_count,
            rp.comment_count,
            rp.share_count,
            rp.view_count,
            rp.created_at,
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
            la.status as location_status
          FROM review_posts rp
          LEFT JOIN users u ON u.id = rp.author_id
          LEFT JOIN location_addresses la ON la.id = rp.location_address_id
          WHERE rp.restaurant_id = ${restaurantId}
          ORDER BY rp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      } else {
        query = sql`
          SELECT
            rp.id,
            rp.author_id,
            u.display_name as author_name,
            u.avatar as author_avatar,
            rp.location_address_id,
            rp.text,
            rp.features,
            rp.photos,
            rp.upvote_count,
            rp.downvote_count,
            rp.comment_count,
            rp.share_count,
            rp.view_count,
            rp.created_at,
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
            la.status as location_status
          FROM review_posts rp
          LEFT JOIN users u ON u.id = rp.author_id
          LEFT JOIN location_addresses la ON la.id = rp.location_address_id
          ORDER BY rp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const result = await query.execute(db);
      const rawReviews = result.rows as Array<{ id: string; photos?: unknown; [key: string]: unknown }>;

      // Collect all photo IDs from all reviews
      const allPhotoIds: string[] = [];
      const reviewPhotoIdsMap = new Map<string, string[]>();

      for (const review of rawReviews) {
        const photoIds = extractPhotoIds(review.photos);
        if (photoIds.length > 0) {
          reviewPhotoIdsMap.set(review.id, photoIds);
          allPhotoIds.push(...photoIds);
        }
      }

      // Batch lookup all photo URLs from database
      const photoUrlMap = new Map<string, string>();
      if (allPhotoIds.length > 0) {
        const uniqueIds = [...new Set(allPhotoIds)];
        const photoRecords = await db
          .selectFrom("photos")
          .select(["id", "s3_url", "s3_thumbnail_url"])
          .where("id", "in", uniqueIds)
          .execute();

        for (const p of photoRecords) {
          photoUrlMap.set(p.id, p.s3_thumbnail_url || p.s3_url);
        }
      }

      // Build reviews with resolved photo URLs
      const reviews = rawReviews.map((review) => {
        const photoIds = reviewPhotoIdsMap.get(review.id) || [];
        const photos = photoIds
          .map((id) => {
            const url = photoUrlMap.get(id);
            return url ? { url } : null;
          })
          .filter((p): p is { url: string } => p !== null);

        return {
          ...review,
          photos,
        };
      });

      return success({
        count: reviews.length,
        limit,
        offset,
        reviews,
      });
    } catch (err) {
      console.error("[reviews/list] Error:", err);
      return error((err as Error).message);
    }
  },
};
