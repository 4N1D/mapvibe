import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";

interface CreateCommentBody {
  author_id: string;
  review_post_id?: string;
  restaurant_review_id?: string;
  restaurant_id?: string;
  parent_comment_id?: string;
  text: string;
  correction_type?: string;
  suggested_value?: string;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: CreateCommentBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const {
        author_id,
        review_post_id,
        restaurant_review_id,
        restaurant_id,
        parent_comment_id,
        text,
        correction_type,
        suggested_value,
      } = body;

      // Validate required fields
      if (!author_id) {
        return badRequest("author_id is required");
      }

      if (!text) {
        return badRequest("text is required");
      }

      // Exactly one of review_post_id, restaurant_review_id, or restaurant_id must be provided
      const targetCount = [review_post_id, restaurant_review_id, restaurant_id].filter(
        Boolean
      ).length;
      if (targetCount !== 1) {
        return badRequest(
          "Exactly one of review_post_id, restaurant_review_id, or restaurant_id is required"
        );
      }

      // Verify author exists
      const author = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", author_id)
        .executeTakeFirst();

      if (!author) {
        return badRequest("Invalid author_id: user does not exist");
      }

      // Verify parent comment exists if provided
      let threadDepth = 0;
      if (parent_comment_id) {
        const parentComment = await db
          .selectFrom("comments")
          .select(["id", "thread_depth"])
          .where("id", "=", parent_comment_id)
          .executeTakeFirst();

        if (!parentComment) {
          return badRequest("Invalid parent_comment_id: comment does not exist");
        }
        threadDepth = (parentComment.thread_depth ?? 0) + 1;
      }

      // Verify target exists
      if (review_post_id) {
        const reviewPost = await db
          .selectFrom("review_posts")
          .select("id")
          .where("id", "=", review_post_id)
          .executeTakeFirst();

        if (!reviewPost) {
          return badRequest("Invalid review_post_id: review post does not exist");
        }
      }

      if (restaurant_review_id) {
        const restaurantReview = await db
          .selectFrom("restaurant_reviews")
          .select("id")
          .where("id", "=", restaurant_review_id)
          .executeTakeFirst();

        if (!restaurantReview) {
          return badRequest("Invalid restaurant_review_id: restaurant review does not exist");
        }
      }

      if (restaurant_id) {
        const restaurant = await db
          .selectFrom("restaurants")
          .select("id")
          .where("id", "=", restaurant_id)
          .executeTakeFirst();

        if (!restaurant) {
          return badRequest("Invalid restaurant_id: restaurant does not exist");
        }
      }

      // Create comment and increment comment_count on target
      const result = await db.transaction().execute(async (trx) => {
        const [comment] = await trx
          .insertInto("comments")
          .values({
            id: crypto.randomUUID(),
            review_post_id: review_post_id ?? null,
            restaurant_review_id: restaurant_review_id ?? null,
            restaurant_id: restaurant_id ?? null,
            parent_comment_id: parent_comment_id ?? null,
            thread_depth: threadDepth,
            author_id,
            text,
            correction_type: correction_type ?? null,
            suggested_value: suggested_value ?? null,
            like_count: 0,
            status: "published",
          })
          .returningAll()
          .execute();

        // Increment comment_count on the appropriate target
        if (review_post_id) {
          await trx
            .updateTable("review_posts")
            .set((eb) => ({
              comment_count: eb("comment_count", "+", 1),
              updated_at: new Date(),
            }))
            .where("id", "=", review_post_id)
            .execute();
        }

        if (restaurant_review_id) {
          await trx
            .updateTable("restaurant_reviews")
            .set((eb) => ({
              comment_count: eb("comment_count", "+", 1),
              updated_at: new Date(),
            }))
            .where("id", "=", restaurant_review_id)
            .execute();
        }

        return comment;
      });

      return success({ comment: result }, 201);
    } catch (err) {
      console.error("[reviews/comment] Error:", err);
      return error((err as Error).message);
    }
  },
};
