import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";
import { sql } from "kysely";

// GET /users/me/reviews - Get current user's reviews (both review_posts and restaurant_reviews)
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
      const type = params.type; // 'review_post' or 'restaurant_review'

      // Union query to get both types of reviews
      const query = sql`
        (
          SELECT 
            rp.id,
            'review_post' as type,
            rp.text,
            rp.photos,
            rp.features,
            rp.upvote_count,
            rp.downvote_count,
            rp.comment_count,
            rp.share_count,
            rp.view_count,
            rp.restaurant_id,
            r.name_vi as restaurant_name,
            r.slug as restaurant_slug,
            rp.location_address_id,
            NULL::DECIMAL as rating_overall,
            NULL::DECIMAL as rating_price,
            NULL::DECIMAL as rating_quality,
            NULL::DECIMAL as rating_ambiance,
            rp.created_at
          FROM review_posts rp
          LEFT JOIN restaurants r ON r.id = rp.restaurant_id
          WHERE rp.author_id = ${userId}
          ${type === "review_post" ? sql`` : type === "restaurant_review" ? sql`AND 1=0` : sql``}
        )
        UNION ALL
        (
          SELECT 
            rr.id,
            'restaurant_review' as type,
            rr.text,
            rr.photos,
            NULL as features,
            rr.upvote_count,
            0 as downvote_count,
            rr.comment_count,
            0 as share_count,
            0 as view_count,
            rr.restaurant_id,
            r.name_vi as restaurant_name,
            r.slug as restaurant_slug,
            NULL as location_address_id,
            rr.rating_overall,
            rr.rating_price,
            rr.rating_quality,
            rr.rating_ambiance,
            rr.created_at
          FROM restaurant_reviews rr
          LEFT JOIN restaurants r ON r.id = rr.restaurant_id
          WHERE rr.author_id = ${userId}
          ${type === "restaurant_review" ? sql`` : type === "review_post" ? sql`AND 1=0` : sql``}
        )
        ORDER BY created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `;

      const result = await query.execute(db);

      // Get total counts
      const countQuery = sql`
        SELECT 
          (SELECT COUNT(*) FROM review_posts WHERE author_id = ${userId}) +
          (SELECT COUNT(*) FROM restaurant_reviews WHERE author_id = ${userId}) as total,
          (SELECT COUNT(*) FROM review_posts WHERE author_id = ${userId}) as review_post_count,
          (SELECT COUNT(*) FROM restaurant_reviews WHERE author_id = ${userId}) as restaurant_review_count
      `;

      const countResult = await countQuery.execute(db);
      const counts = countResult.rows[0] as {
        total: string;
        review_post_count: string;
        restaurant_review_count: string;
      };

      const rawReviews = result.rows as Array<{ id: string; photos?: unknown; [key: string]: unknown }>;

      // Collect all photo IDs from all reviews
      const allPhotoIds: string[] = [];
      const reviewPhotoMap = new Map<string, string[]>();

      for (const review of rawReviews) {
        if (review.photos) {
          try {
            const photosData = typeof review.photos === "string"
              ? JSON.parse(review.photos)
              : review.photos;

            if (Array.isArray(photosData) && photosData.length > 0) {
              const firstItem = photosData[0];
              
              // Check if it's already a URL
              if (typeof firstItem === "string" && 
                  (firstItem.startsWith("http://") || firstItem.startsWith("https://"))) {
                // Already URLs - store directly
                reviewPhotoMap.set(review.id, photosData);
              } else if (typeof firstItem === "string") {
                // Photo IDs - collect for batch lookup
                const ids = photosData.filter((id: unknown) => typeof id === "string");
                reviewPhotoMap.set(review.id, ids);
                allPhotoIds.push(...ids);
              }
            } else if (photosData && typeof photosData === "object" && !Array.isArray(photosData)) {
              // Handle object format {general: [...], food: [...], menu: [...]}
              const categories = photosData as Record<string, unknown[]>;
              const ids: string[] = [];
              for (const category of Object.values(categories)) {
                if (Array.isArray(category)) {
                  for (const item of category) {
                    if (typeof item === "string") {
                      ids.push(item);
                    } else if (item && typeof item === "object" && "id" in item) {
                      ids.push((item as { id: string }).id);
                    }
                  }
                }
              }
              if (ids.length > 0) {
                reviewPhotoMap.set(review.id, ids);
                allPhotoIds.push(...ids);
              }
            }
          } catch {
            // Skip invalid photos
          }
        }
      }

      // Batch lookup all photo URLs
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
        const photoData = reviewPhotoMap.get(review.id) || [];
        let photos: Array<{ url: string }> = [];

        if (photoData.length > 0) {
          const firstItem = photoData[0];
          if (firstItem.startsWith("http://") || firstItem.startsWith("https://")) {
            // Already URLs
            photos = photoData.map((url) => ({ url }));
          } else {
            // Map IDs to URLs
            photos = photoData
              .map((id) => {
                const url = photoUrlMap.get(id);
                return url ? { url } : null;
              })
              .filter((p): p is { url: string } => p !== null);
          }
        }

        return {
          ...review,
          photos,
        };
      });

      return success({
        reviews,
        total: Number(counts?.total || 0),
        review_post_count: Number(counts?.review_post_count || 0),
        restaurant_review_count: Number(counts?.restaurant_review_count || 0),
        limit,
        offset,
      });
    } catch (err) {
      console.error("[users/me/reviews] Error:", err);
      return error((err as Error).message);
    }
  },
};
