import { sql } from "kysely";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error, unauthorized } from "../../middlewares/response";
import { getUserIdFromEvent } from "../../utils/auth";

// POST /restaurants/reviews/:reviewId/like - Toggle like on restaurant review
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const reviewId = event.pathParameters?.reviewId;

      if (!userId) {
        return unauthorized("Authentication required");
      }

      if (!reviewId) {
        return badRequest("Review ID is required");
      }

      // Verify review exists
      const review = await db
        .selectFrom("restaurant_reviews")
        .select(["id", "upvote_count"])
        .where("id", "=", reviewId)
        .executeTakeFirst();

      if (!review) {
        return notFound("Review not found");
      }

      // Use the toggle_like function from database
      const result = await sql<{ liked: boolean; like_count: number }>`
        SELECT * FROM toggle_like(${userId}, 'review', ${reviewId})
      `.execute(db);

      const { liked, like_count: newLikeCount } = result.rows[0];

      // Update upvote_count on restaurant_reviews
      await db
        .updateTable("restaurant_reviews")
        .set({ upvote_count: newLikeCount })
        .where("id", "=", reviewId)
        .execute();

      return success({
        liked,
        like_count: newLikeCount,
      });
    } catch (err) {
      console.error("[restaurants/review-like] Error:", err);
      return error((err as Error).message);
    }
  },
};
