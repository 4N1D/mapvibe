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
            AND (la.status IS NULL OR la.status != 'rejected')
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
          WHERE (la.status IS NULL OR la.status != 'rejected')
          ORDER BY rp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const result = await query.execute(db);
      const rawReviews = result.rows as Array<{ id: string; photos?: unknown; [key: string]: unknown }>;

      // Get all review IDs
      const reviewIds = rawReviews.map((r) => r.id);

      // First try: Query photos directly from photos table by review_post_id
      const reviewPhotosMap = new Map<string, Array<{ url: string }>>();
      
      if (reviewIds.length > 0) {
        const photosFromTable = await db
          .selectFrom("photos")
          .select(["id", "review_post_id", "s3_url", "s3_thumbnail_url"])
          .where("review_post_id", "in", reviewIds)
          .orderBy("created_at", "asc")
          .execute();

        for (const photo of photosFromTable) {
          if (photo.review_post_id) {
            const url = photo.s3_thumbnail_url || photo.s3_url;
            if (url) {
              const existing = reviewPhotosMap.get(photo.review_post_id) || [];
              existing.push({ url });
              reviewPhotosMap.set(photo.review_post_id, existing);
            }
          }
        }
      }

      // Fallback: For reviews without photos from table, try extracting from JSON field
      const reviewsNeedingJsonPhotos = rawReviews.filter(
        (r) => !reviewPhotosMap.has(r.id) && r.photos
      );

      if (reviewsNeedingJsonPhotos.length > 0) {
        const allPhotoIds: string[] = [];
        const reviewPhotoIdsMap = new Map<string, string[]>();

        for (const review of reviewsNeedingJsonPhotos) {
          const photoIds = extractPhotoIds(review.photos);
          if (photoIds.length > 0) {
            reviewPhotoIdsMap.set(review.id, photoIds);
            allPhotoIds.push(...photoIds);
          }
        }

        if (allPhotoIds.length > 0) {
          const uniqueIds = [...new Set(allPhotoIds)];
          const photoRecords = await db
            .selectFrom("photos")
            .select(["id", "s3_url", "s3_thumbnail_url"])
            .where("id", "in", uniqueIds)
            .execute();

          const photoUrlMap = new Map<string, string>();
          for (const p of photoRecords) {
            photoUrlMap.set(p.id, p.s3_thumbnail_url || p.s3_url);
          }

          for (const [reviewId, photoIds] of reviewPhotoIdsMap) {
            const photos = photoIds
              .map((id) => {
                const url = photoUrlMap.get(id);
                return url ? { url } : null;
              })
              .filter((p): p is { url: string } => p !== null);
            
            if (photos.length > 0) {
              reviewPhotosMap.set(reviewId, photos);
            }
          }
        }
      }

      // Build reviews with resolved photo URLs
      const reviews = rawReviews.map((review) => {
        const photos = reviewPhotosMap.get(review.id) || [];
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
