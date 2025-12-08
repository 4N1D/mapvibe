import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent, isUserAdmin } from "../../utils/auth";
import { sql } from "kysely";

// GET /admin/stats - Dashboard statistics
export const statsHandler: Handler = {
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

      // Get counts in parallel
      const [usersCount, placesCount, reviewsCount, photosCount, pendingReviews, recentActivity] =
        await Promise.all([
          // Total users
          db
            .selectFrom("users")
            .select(sql<number>`count(*)::int`.as("count"))
            .executeTakeFirst(),

          // Total places
          db
            .selectFrom("restaurants")
            .select(sql<number>`count(*)::int`.as("count"))
            .executeTakeFirst(),

          // Total reviews
          db
            .selectFrom("review_posts")
            .select(sql<number>`count(*)::int`.as("count"))
            .executeTakeFirst(),

          // Total photos
          db
            .selectFrom("photos")
            .select(sql<number>`count(*)::int`.as("count"))
            .executeTakeFirst(),

          // Pending location reviews
          db
            .selectFrom("location_addresses")
            .select(sql<number>`count(*)::int`.as("count"))
            .where("status", "=", "pending")
            .executeTakeFirst(),

          // Recent activity (last 7 days)
          sql`
          SELECT 
            (SELECT count(*) FROM users WHERE created_at > NOW() - INTERVAL '7 days')::int as new_users,
            (SELECT count(*) FROM review_posts WHERE created_at > NOW() - INTERVAL '7 days')::int as new_reviews,
            (SELECT count(*) FROM photos WHERE created_at > NOW() - INTERVAL '7 days')::int as new_photos
        `.execute(db),
        ]);

      const activity = recentActivity.rows[0] as {
        new_users: number;
        new_reviews: number;
        new_photos: number;
      };

      return success({
        stats: {
          total_users: usersCount?.count || 0,
          total_places: placesCount?.count || 0,
          total_reviews: reviewsCount?.count || 0,
          total_photos: photosCount?.count || 0,
          pending_locations: pendingReviews?.count || 0,
        },
        recent_activity: {
          new_users_7d: activity?.new_users || 0,
          new_reviews_7d: activity?.new_reviews || 0,
          new_photos_7d: activity?.new_photos || 0,
        },
      });
    } catch (err) {
      console.error("[admin/stats] Error:", err);
      return error((err as Error).message);
    }
  },
};
