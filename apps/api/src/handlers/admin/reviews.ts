import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, unauthorized, notFound, error } from "../../middlewares/response";
import { getUserIdFromEvent, isUserAdmin } from "../../utils/auth";
import { sql } from "kysely";
import { sendEmbeddingJob } from "../../services/sqs";

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

// GET /admin/reviews - List all reviews with filters
export const listReviewsHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};

      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");
      const status = params.status; // all, reported, hidden
      const _sortBy = params.sort_by || "created_at";
      const _sortOrder = params.sort_order === "asc" ? "asc" : "desc";

      // Build query based on status filter
      let whereClause = sql`WHERE 1=1`;
      if (status === "reported") {
        whereClause = sql`WHERE rp.report_count > 0`;
      } else if (status === "hidden") {
        whereClause = sql`WHERE rp.status = 'hidden'`;
      } else if (status === "rejected") {
        whereClause = sql`WHERE rp.status = 'rejected'`;
      }

      const result = await sql`
        SELECT 
          rp.id,
          rp.author_id,
          u.display_name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          rp.text,
          rp.features,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.comment_count,
          rp.report_count,
          rp.status,
          rp.created_at,
          la.restaurant_name as place_name,
          la.full_address as place_address,
          r.id as restaurant_id
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        LEFT JOIN location_addresses la ON la.id = rp.location_address_id
        LEFT JOIN restaurants r ON r.id = rp.restaurant_id
        ${whereClause}
        ORDER BY rp.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await db
        .selectFrom("review_posts")
        .select(sql<number>`count(*)::int`.as("total"))
        .executeTakeFirst();

      // Process photos to get URLs
      interface ReviewRow {
        id: string;
        photos?: unknown;
        [key: string]: unknown;
      }
      const rawReviews = result.rows as ReviewRow[];
      
      // Collect all photo IDs
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
              if (typeof firstItem === "string") {
                if (firstItem.startsWith("http")) {
                  reviewPhotoMap.set(review.id, photosData);
                } else {
                  reviewPhotoMap.set(review.id, photosData);
                  allPhotoIds.push(...photosData.filter((id: unknown) => typeof id === "string"));
                }
              } else if (firstItem?.url) {
                reviewPhotoMap.set(review.id, photosData.map((p: { url: string }) => p.url));
              }
            }
          } catch {
            // Skip invalid photos
          }
        }
      }

      // Fetch photo URLs from database
      const photoUrlMap = new Map<string, string>();
      const uniquePhotoIds = [...new Set(allPhotoIds)].filter(id => !id.startsWith("http"));
      if (uniquePhotoIds.length > 0) {
        const photosFromDb = await db
          .selectFrom("photos")
          .select(["id", "s3_url", "s3_thumbnail_url"])
          .where("id", "in", uniquePhotoIds)
          .execute();

        for (const photo of photosFromDb) {
          photoUrlMap.set(photo.id, photo.s3_thumbnail_url || photo.s3_url);
        }
      }

      // Build reviews with resolved URLs
      const reviews = rawReviews.map((review) => {
        const photoData = reviewPhotoMap.get(review.id) || [];
        let photos: string[] = [];

        if (photoData.length > 0) {
          const firstItem = photoData[0];
          if (typeof firstItem === "string" && firstItem.startsWith("http")) {
            photos = photoData as string[];
          } else {
            photos = (photoData as string[])
              .map((id) => photoUrlMap.get(id))
              .filter((url): url is string => !!url);
          }
        }

        return { ...review, photos };
      });

      return success({
        reviews,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error("[admin/reviews] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/reviews/:id - Get review details
export const getReviewHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const reviewId = event.pathParameters?.id;
      if (!reviewId) {
        return badRequest("Review ID required");
      }

      const db = await getDb();

      const result = await sql`
        SELECT 
          rp.*,
          u.display_name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          la.restaurant_name as place_name,
          la.full_address as place_address
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        LEFT JOIN location_addresses la ON la.id = rp.location_address_id
        WHERE rp.id = ${reviewId}
      `.execute(db);

      if (result.rows.length === 0) {
        return notFound("Review not found");
      }

      return success({ review: result.rows[0] });
    } catch (err) {
      console.error("[admin/reviews/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/reviews/:id - Update review (approve/hide/delete)
export const updateReviewHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const reviewId = event.pathParameters?.id;
      if (!reviewId) {
        return badRequest("Review ID required");
      }

      let body: { action: string; reason?: string };
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { action } = body;
      if (!action) {
        return badRequest("Action required (hide, delete, restore)");
      }

      const db = await getDb();

      // Handle delete action separately (hard delete)
      if (action === "delete") {
        // Get the review first to know the location_address_id
        const review = await db
          .selectFrom("review_posts")
          .select(["id", "location_address_id"])
          .where("id", "=", reviewId)
          .executeTakeFirst();

        if (!review) {
          return notFound("Review not found");
        }

        const locationAddressId = review.location_address_id;

        // Delete in transaction to ensure data integrity
        await db.transaction().execute(async (trx) => {
          // 1. Get all comment IDs for this review
          const comments = await trx
            .selectFrom("comments")
            .select("id")
            .where("review_post_id", "=", reviewId)
            .execute();
          
          const commentIds = comments.map(c => c.id);
          
          // 2. Delete likes on comments of this review
          if (commentIds.length > 0) {
            await trx
              .deleteFrom("likes")
              .where("target_type", "=", "comment")
              .where("target_id", "in", commentIds)
              .execute();
          }
          
          // 3. Delete comments
          await trx
            .deleteFrom("comments")
            .where("review_post_id", "=", reviewId)
            .execute();
          
          // 4. Delete votes
          await trx
            .deleteFrom("votes")
            .where("review_post_id", "=", reviewId)
            .execute();
          
          // 5. Delete reports targeting this review
          await trx
            .deleteFrom("reports")
            .where("target_type", "=", "review_post")
            .where("target_id", "=", reviewId)
            .execute();
          
          // 6. Delete photos associated with this review
          await trx
            .deleteFrom("photos")
            .where("review_post_id", "=", reviewId)
            .execute();
          
          // 7. Delete the review itself
          await trx
            .deleteFrom("review_posts")
            .where("id", "=", reviewId)
            .execute();

          // 8. Check if location_address has any other reviews, if not delete it
          if (locationAddressId) {
            const remainingReviews = await trx
              .selectFrom("review_posts")
              .select("id")
              .where("location_address_id", "=", locationAddressId)
              .executeTakeFirst();

            if (!remainingReviews) {
              // No more reviews for this location, check if it's linked to a restaurant
              const locationAddress = await trx
                .selectFrom("location_addresses")
                .select(["id", "restaurant_id"])
                .where("id", "=", locationAddressId)
                .executeTakeFirst();

              // Only delete if not linked to a restaurant
              if (locationAddress && !locationAddress.restaurant_id) {
                // Delete photos linked to location_address
                await trx
                  .deleteFrom("photos")
                  .where("location_address_id", "=", locationAddressId)
                  .execute();

                // Delete the location_address
                await trx
                  .deleteFrom("location_addresses")
                  .where("id", "=", locationAddressId)
                  .execute();

                console.log(`[admin/reviews/:id] Deleted orphaned location_address: ${locationAddressId}`);
              }
            }
          }
        });

        return success({
          message: "Review deleted successfully",
          review: { id: reviewId },
        });
      }

      // Handle hide action - set status='hidden' (soft hide, still visible in admin)
      if (action === "hide") {
        const updated = await db
          .updateTable("review_posts")
          .set({ status: "hidden", updated_at: new Date() } as Record<string, unknown>)
          .where("id", "=", reviewId)
          .returningAll()
          .executeTakeFirst();

        if (!updated) {
          return notFound("Review not found");
        }

        return success({
          message: "Review hidden successfully",
          review: updated,
        });
      }

      // Handle restore action - set status back to 'published'
      if (action === "restore") {
        const updated = await db
          .updateTable("review_posts")
          .set({ status: "published", updated_at: new Date() } as Record<string, unknown>)
          .where("id", "=", reviewId)
          .returningAll()
          .executeTakeFirst();

        if (!updated) {
          return notFound("Review not found");
        }

        return success({
          message: "Review restored successfully",
          review: updated,
        });
      }

      return badRequest("Invalid action. Use: hide, delete, restore");
    } catch (err) {
      console.error("[admin/reviews/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/pending - List pending location suggestions
export const listPendingLocationsHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};

      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");

      const result = await sql`
        SELECT 
          la.*,
          u.display_name as submitted_by_name,
          u.email as submitted_by_email
        FROM location_addresses la
        LEFT JOIN users u ON u.id = la.created_by_user_id
        WHERE la.status = 'pending'
        ORDER BY la.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await db
        .selectFrom("location_addresses")
        .select(sql<number>`count(*)::int`.as("total"))
        .where("status", "=", "pending")
        .executeTakeFirst();

      return success({
        locations: result.rows,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error("[admin/locations/pending] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/:id - Get location detail
export const getLocationHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest("Location ID required");
      }

      const db = await getDb();

      const result = await sql`
        SELECT 
          la.*,
          u.display_name as submitted_by_name,
          u.email as submitted_by_email
        FROM location_addresses la
        LEFT JOIN users u ON u.id = la.created_by_user_id
        WHERE la.id = ${locationId}
      `.execute(db);

      if (result.rows.length === 0) {
        return notFound("Location not found");
      }

      return success({ location: result.rows[0] });
    } catch (err) {
      console.error("[admin/locations/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/:id/reviews - Get reviews for a location
export const getLocationReviewsHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest("Location ID required");
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};

      const limit = Math.min(parseInt(params.limit || "50"), 100);
      const offset = parseInt(params.offset || "0");

      const result = await sql`
        SELECT 
          rp.id,
          rp.author_id,
          u.display_name as author_name,
          u.avatar as author_avatar,
          rp.text,
          rp.features,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.status,
          rp.created_at
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        WHERE rp.location_address_id = ${locationId}
        ORDER BY rp.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      // Process reviews to resolve photo URLs
      const rawReviews = result.rows as Array<{ id: string; photos?: unknown; [key: string]: unknown }>;
      const reviewIds = rawReviews.map((r) => r.id);
      const reviewPhotosMap = new Map<string, string[]>();

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
              existing.push(url);
              reviewPhotosMap.set(photo.review_post_id, existing);
            }
          }
        }
      }

      // Fallback to photos column
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
              .map((id) => photoUrlMap.get(id))
              .filter((url): url is string => !!url);
            
            if (photos.length > 0) {
              reviewPhotosMap.set(reviewId, photos);
            }
          }
        }
      }

      const reviews = rawReviews.map((review) => ({
        ...review,
        photos: reviewPhotosMap.get(review.id) || [],
      }));

      const countResult = await sql`
        SELECT count(*)::int as total
        FROM review_posts
        WHERE location_address_id = ${locationId}
      `.execute(db);

      return success({
        reviews,
        pagination: {
          total: (countResult.rows[0] as { total: number } | undefined)?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error("[admin/locations/:id/reviews] Error:", err);
      return error((err as Error).message);
    }
  },
};

interface CuisineType {
  name: string;
  description?: string;
}

interface LocationAddress {
  id: string;
  full_address?: string;
  street_address?: string;
  ward?: string;
  geo_lat?: number;
  geo_lng?: number;
  [key: string]: unknown;
}

interface UpdateLocationBody {
  action: "approve" | "reject";
  reason?: string;
  // Restaurant info for approve action
  name_vi?: string;
  cuisine_types?: CuisineType[];
  price_min?: number | null;
  price_max?: number | null;
  phone?: string;
  opening_hours?: string;
  features?: string[];
  description?: string;
}

// PATCH /admin/locations/:id - Approve/reject location
export const updateLocationHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized("Admin access required");
      }

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest("Location ID required");
      }

      let body: UpdateLocationBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { action, reason } = body;
      if (!["approve", "reject"].includes(action)) {
        return badRequest("Invalid action. Use: approve, reject");
      }

      const db = await getDb();

      // Get the location first
      const location = await db
        .selectFrom("location_addresses")
        .selectAll()
        .where("id", "=", locationId)
        .executeTakeFirst();

      if (!location) {
        return notFound("Location not found");
      }

      if (action === "reject") {
        // Hard delete: remove review_posts and location_addresses
        // Execute each delete separately and ignore errors for missing tables
        const deleteQueries = [
          sql`DELETE FROM votes WHERE review_post_id IN (SELECT id FROM review_posts WHERE location_address_id = ${locationId})`,
          sql`DELETE FROM comments WHERE review_post_id IN (SELECT id FROM review_posts WHERE location_address_id = ${locationId})`,
          sql`DELETE FROM photos WHERE review_post_id IN (SELECT id FROM review_posts WHERE location_address_id = ${locationId})`,
          sql`DELETE FROM review_posts WHERE location_address_id = ${locationId}`,
          sql`DELETE FROM photos WHERE location_address_id = ${locationId}`,
        ];

        for (const query of deleteQueries) {
          try {
            await query.execute(db);
          } catch (e) {
            console.log(`[admin/locations/:id] Query skipped:`, e);
          }
        }

        // Delete the location_address itself
        await sql`DELETE FROM location_addresses WHERE id = ${locationId}`.execute(db);

        return success({
          message: "Location and all related data deleted successfully",
          location: { id: locationId },
        });
      }

      // For approve action - create restaurant and link reviews
      const { name_vi, cuisine_types, price_min, price_max, phone, opening_hours, features, description } =
        body;

      if (!name_vi?.trim()) {
        return badRequest("Restaurant name (name_vi) is required for approval");
      }

      // Generate slug from name
      const slug = name_vi
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/đ/g, "d")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");

      // Create restaurant
      const restaurantId = crypto.randomUUID();
      const restaurant = await db
        .insertInto("restaurants")
        .values({
          id: restaurantId,
          name_vi,
          slug: `${slug}-${Date.now()}`,
          address: (location as LocationAddress).full_address || (location as LocationAddress).street_address,
          ward: (location as LocationAddress).ward,
          geo_lat: (location as LocationAddress).geo_lat,
          geo_lng: (location as LocationAddress).geo_lng,
          cuisine_types: cuisine_types ? JSON.stringify(cuisine_types) : null,
          price_min: price_min || null,
          price_max: price_max || null,
          phone: phone || null,
          opening_hours: opening_hours || null,
          features: features ? JSON.stringify(features) : null,
          description: description || null,
          status: "approved",
          created_by: userId,
          created_from_location_id: locationId,
        } as Record<string, unknown>)
        .returningAll()
        .executeTakeFirst();

      if (!restaurant) {
        return error("Failed to create restaurant");
      }

      // Update location status
      await db
        .updateTable("location_addresses")
        .set({
          status: "approved",
          approved_by: userId,
          approved_at: new Date(),
          restaurant_id: restaurant.id,
          updated_at: new Date(),
        } as Record<string, unknown>)
        .where("id", "=", locationId)
        .execute();

      // Link review_posts to the new restaurant
      await db
        .updateTable("review_posts")
        .set({
          restaurant_id: restaurant.id,
          status: "published",
          updated_at: new Date(),
        } as Record<string, unknown>)
        .where("location_address_id", "=", locationId)
        .execute();

      // Gửi message vào SQS để trigger Lambda Embedding
      // Không await để không block response
      sendEmbeddingJob(restaurant.id).catch((err) => {
        console.error("[admin/locations/:id] Failed to send embedding job:", err);
      });

      return success({
        message: "Location approved and restaurant created successfully",
        restaurant,
      });
    } catch (err) {
      console.error("[admin/locations/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};
