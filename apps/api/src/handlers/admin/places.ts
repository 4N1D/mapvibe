import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, unauthorized, notFound, error } from "../../middlewares/response";
import { getUserIdFromEvent, isUserAdmin } from "../../utils/auth";
import { sql } from "kysely";
import { sendEmbeddingJob } from "../../services/sqs";

// GET /admin/places - List all places with filters
export const listPlacesHandler: Handler = {
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
      const search = params.search || "";
      const status = params.status; // active, inactive, pending

      let query = db
        .selectFrom("restaurants")
        .select([
          "id",
          "name_vi",
          "slug",
          "address",
          "cuisine_types",
          "price_min",
          "price_max",
          "rating_overall",
          "review_count",
          "status",
          "created_at",
          "updated_at",
        ])
        .orderBy("created_at", "desc")
        .limit(limit)
        .offset(offset);

      if (search) {
        query = query.where((eb) =>
          eb.or([eb("name_vi", "ilike", `%${search}%`), eb("address", "ilike", `%${search}%`)])
        );
      }

      if (status) {
        query = query.where("status", "=", status);
      }

      const [places, countResult] = await Promise.all([
        query.execute(),
        db
          .selectFrom("restaurants")
          .select(sql<number>`count(*)::int`.as("total"))
          .executeTakeFirst(),
      ]);

      return success({
        places,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error("[admin/places] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/places/:id - Get place details
export const getPlaceHandler: Handler = {
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

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest("Place ID required");
      }

      const db = await getDb();

      const place = await db
        .selectFrom("restaurants")
        .selectAll()
        .where("id", "=", placeId)
        .executeTakeFirst();

      if (!place) {
        return notFound("Place not found");
      }

      // Get related stats
      const [reviewCount, photoCount] = await Promise.all([
        db
          .selectFrom("review_posts")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("restaurant_id", "=", placeId)
          .executeTakeFirst(),
        db
          .selectFrom("photos")
          .select(sql<number>`count(*)::int`.as("count"))
          .where("restaurant_id", "=", placeId)
          .executeTakeFirst(),
      ]);

      return success({
        place,
        stats: {
          review_count: reviewCount?.count || 0,
          photo_count: photoCount?.count || 0,
        },
      });
    } catch (err) {
      console.error("[admin/places/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/places/:id - Update place
export const updatePlaceHandler: Handler = {
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

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest("Place ID required");
      }

      let body: Record<string, unknown>;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const allowedFields = [
        "name_vi",
        "address",
        "district",
        "status",
        "cuisine_types",
        "price_min",
        "price_max",
      ];
      const updateData: Record<string, unknown> = {};

      for (const field of allowedFields) {
        if (body[field] !== undefined) {
          updateData[field] = body[field];
        }
      }

      if (Object.keys(updateData).length === 0) {
        return badRequest("No valid fields to update");
      }

      const db = await getDb();
      updateData.updated_at = new Date();

      const updated = await db
        .updateTable("restaurants")
        .set(updateData)
        .where("id", "=", placeId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return notFound("Place not found");
      }

      // Gửi message vào SQS để trigger Lambda Embedding khi restaurant được update
      // Không await để không block response
      sendEmbeddingJob(placeId).catch((err) => {
        console.error("[admin/places/:id] Failed to send embedding job:", err);
      });

      return success({ place: updated });
    } catch (err) {
      console.error("[admin/places/:id] Error:", err);
      return error((err as Error).message);
    }
  },
};

// DELETE /admin/places/:id - Delete place (hard delete)
export const deletePlaceHandler: Handler = {
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

      const placeId = event.pathParameters?.id;
      if (!placeId) {
        return badRequest("Place ID required");
      }

      const db = await getDb();

      // Check if place exists first
      const existing = await db
        .selectFrom("restaurants")
        .select(["id", "name_vi"])
        .where("id", "=", placeId)
        .executeTakeFirst();

      if (!existing) {
        return notFound("Place not found");
      }

      console.log(`[admin/places/:id] Cascade deleting place: ${placeId}, name: ${existing.name_vi}`);

      // CASCADE DELETE: restaurant → location_addresses → review_posts
      // Step 1: Delete data related to review_posts (via restaurant_id OR via location_address_id)
      const deleteReviewRelatedQueries = [
        // Delete votes for reviews linked directly to restaurant
        sql`DELETE FROM votes WHERE review_post_id IN (SELECT id FROM review_posts WHERE restaurant_id = ${placeId})`,
        // Delete votes for reviews linked via location_addresses
        sql`DELETE FROM votes WHERE review_post_id IN (
          SELECT id FROM review_posts WHERE location_address_id IN (
            SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
          )
        )`,
        // Delete comments for reviews linked directly to restaurant
        sql`DELETE FROM comments WHERE review_post_id IN (SELECT id FROM review_posts WHERE restaurant_id = ${placeId})`,
        // Delete comments for reviews linked via location_addresses
        sql`DELETE FROM comments WHERE review_post_id IN (
          SELECT id FROM review_posts WHERE location_address_id IN (
            SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
          )
        )`,
        // Delete photos for reviews linked directly to restaurant
        sql`DELETE FROM photos WHERE review_post_id IN (SELECT id FROM review_posts WHERE restaurant_id = ${placeId})`,
        // Delete photos for reviews linked via location_addresses
        sql`DELETE FROM photos WHERE review_post_id IN (
          SELECT id FROM review_posts WHERE location_address_id IN (
            SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
          )
        )`,
      ];

      for (const query of deleteReviewRelatedQueries) {
        try {
          await query.execute(db);
        } catch (e) {
          console.log(`[admin/places/:id] Query skipped:`, e);
        }
      }

      // Step 2: Delete review_posts (both direct and via location_addresses)
      const deleteReviewPostsQueries = [
        sql`DELETE FROM review_posts WHERE restaurant_id = ${placeId}`,
        sql`DELETE FROM review_posts WHERE location_address_id IN (
          SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
        )`,
      ];

      for (const query of deleteReviewPostsQueries) {
        try {
          await query.execute(db);
        } catch (e) {
          console.log(`[admin/places/:id] Query skipped:`, e);
        }
      }

      // Step 3: Delete photos linked to location_addresses
      try {
        await sql`DELETE FROM photos WHERE location_address_id IN (
          SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
        )`.execute(db);
      } catch (e) {
        console.log(`[admin/places/:id] Query skipped:`, e);
      }

      // Step 4: Delete other restaurant-related data
      const deleteRestaurantRelatedQueries = [
        sql`DELETE FROM photos WHERE restaurant_id = ${placeId}`,
        sql`DELETE FROM restaurant_reviews WHERE restaurant_id = ${placeId}`,
        sql`DELETE FROM favorites WHERE restaurant_id = ${placeId}`,
      ];

      for (const query of deleteRestaurantRelatedQueries) {
        try {
          await query.execute(db);
        } catch (e) {
          console.log(`[admin/places/:id] Query skipped:`, e);
        }
      }

      // Step 5: Get location_address IDs before deleting restaurant
      const locationIds = await sql`
        SELECT id FROM location_addresses WHERE restaurant_id = ${placeId}
      `.execute(db);
      const locationAddressIds = (locationIds.rows as { id: string }[]).map(r => r.id);

      // Step 6: Delete the restaurant itself (must be before location_addresses due to created_from_location_id FK)
      await sql`DELETE FROM restaurants WHERE id = ${placeId}`.execute(db);

      // Step 7: Delete location_addresses (after restaurant is deleted)
      if (locationAddressIds.length > 0) {
        for (const locId of locationAddressIds) {
          try {
            await sql`DELETE FROM location_addresses WHERE id = ${locId}`.execute(db);
          } catch (e) {
            console.log(`[admin/places/:id] Failed to delete location_address ${locId}:`, e);
          }
        }
      }

      console.log(`[admin/places/:id] Delete result: success`);

      return success({ message: "Place deleted successfully", place: { id: placeId, name_vi: existing.name_vi } });
    } catch (err) {
      console.error("[admin/places/:id DELETE] Error:", err);
      return error((err as Error).message);
    }
  },
};
