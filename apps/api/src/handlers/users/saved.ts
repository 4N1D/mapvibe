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

      const savedRaw = await db
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

      // Get cover photos for all restaurants
      const restaurantIds = savedRaw.map((s) => s.restaurant_id);
      const coverMap = new Map<string, string>();

      if (restaurantIds.length > 0) {
        // Try getting photos directly linked to restaurants
        const directPhotos = await db
          .selectFrom("photos")
          .select(["restaurant_id", "s3_url", "s3_thumbnail_url"])
          .where("restaurant_id", "in", restaurantIds)
          .orderBy("created_at", "desc")
          .execute();

        for (const photo of directPhotos) {
          if (photo.restaurant_id && !coverMap.has(photo.restaurant_id)) {
            coverMap.set(photo.restaurant_id, photo.s3_thumbnail_url || photo.s3_url);
          }
        }

        // For restaurants without direct photos, try via location_addresses
        const missingIds = restaurantIds.filter((id) => !coverMap.has(id));
        if (missingIds.length > 0) {
          // Get location_address_ids linked to these restaurants
          const locationAddresses = await db
            .selectFrom("location_addresses")
            .select(["id", "restaurant_id"])
            .where("restaurant_id", "in", missingIds)
            .execute();

          const locationToRestaurant = new Map<string, string>();
          for (const la of locationAddresses) {
            if (la.restaurant_id) {
              locationToRestaurant.set(la.id, la.restaurant_id);
            }
          }

          // Get photos via location_address_id
          if (locationToRestaurant.size > 0) {
            const locationPhotos = await db
              .selectFrom("photos")
              .select(["location_address_id", "s3_url", "s3_thumbnail_url"])
              .where("location_address_id", "in", [...locationToRestaurant.keys()])
              .orderBy("created_at", "desc")
              .execute();

            for (const photo of locationPhotos) {
              if (photo.location_address_id) {
                const restaurantId = locationToRestaurant.get(photo.location_address_id);
                if (restaurantId && !coverMap.has(restaurantId)) {
                  coverMap.set(restaurantId, photo.s3_thumbnail_url || photo.s3_url);
                }
              }
            }
          }
        }

        // Still missing? Try from review_posts
        const stillMissingIds = restaurantIds.filter((id) => !coverMap.has(id));
        if (stillMissingIds.length > 0) {
          const reviewPhotos = await db
            .selectFrom("review_posts")
            .select(["restaurant_id", "photos"])
            .where("restaurant_id", "in", stillMissingIds)
            .where("photos", "is not", null)
            .orderBy("created_at", "desc")
            .execute();

          for (const rp of reviewPhotos) {
            if (rp.restaurant_id && !coverMap.has(rp.restaurant_id) && rp.photos) {
              try {
                const photosData = typeof rp.photos === "string" ? JSON.parse(rp.photos) : rp.photos;
                let firstPhotoUrl: string | null = null;

                if (Array.isArray(photosData) && photosData.length > 0) {
                  const first = photosData[0];
                  if (typeof first === "string" && first.startsWith("http")) {
                    firstPhotoUrl = first;
                  } else if (first?.url) {
                    firstPhotoUrl = first.url;
                  }
                }

                if (firstPhotoUrl) {
                  coverMap.set(rp.restaurant_id, firstPhotoUrl);
                }
              } catch {
                // Skip invalid photos
              }
            }
          }
        }
      }

      const saved = savedRaw.map((s) => ({
        ...s,
        cover_url: coverMap.get(s.restaurant_id) || null,
      }));

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
