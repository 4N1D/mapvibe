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

      // Check if user already liked this review
      const existingLike = await db
        .selectFrom("likes")
        .select(["id"])
        .where("target_type", "=", "review")
        .where("target_id", "=", reviewId)
        .where("user_id", "=", userId)
        .executeTakeFirst();

      let liked: boolean;
      let newLikeCount: number;

      if (existingLike) {
        // Unlike
        await db
          .deleteFrom("likes")
          .where("target_type", "=", "review")
          .where("target_id", "=", reviewId)
          .where("user_id", "=", userId)
          .execute();

        newLikeCount = Math.max((review.upvote_count ?? 0) - 1, 0);
        liked = false;
      } else {
        // Like
        await db
          .insertInto("likes")
          .values({
            user_id: userId,
            target_type: "review",
            target_id: reviewId,
          })
          .execute();

        newLikeCount = (review.upvote_count ?? 0) + 1;
        liked = true;
      }

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
