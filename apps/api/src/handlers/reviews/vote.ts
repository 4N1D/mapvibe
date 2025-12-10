import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";

type VoteType = "upvote" | "downvote";

interface VoteBody {
  user_id: string;
  review_post_id: string;
  vote_type: VoteType;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: VoteBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { user_id, review_post_id, vote_type } = body;

      // Validate required fields
      if (!user_id) {
        return badRequest("user_id is required");
      }

      if (!review_post_id) {
        return badRequest("review_post_id is required");
      }

      if (vote_type !== "upvote" && vote_type !== "downvote") {
        return badRequest('vote_type must be "upvote" or "downvote"');
      }

      // Verify user exists
      const user = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", user_id)
        .executeTakeFirst();

      if (!user) {
        return badRequest("Invalid user_id: user does not exist");
      }

      // Verify review_post exists
      const reviewPost = await db
        .selectFrom("review_posts")
        .select("id")
        .where("id", "=", review_post_id)
        .executeTakeFirst();

      if (!reviewPost) {
        return badRequest("Invalid review_post_id: review post does not exist");
      }

      // Transaction: upsert vote + update counters on review_posts
      const result = await db.transaction().execute(async (trx) => {
        const existing = await trx
          .selectFrom("votes")
          .select(["vote_type"])
          .where("review_post_id", "=", review_post_id)
          .where("user_id", "=", user_id)
          .executeTakeFirst();

        let deltaUp = 0;
        let deltaDown = 0;
        let action: "created" | "removed" | "switched" = "created";

        if (!existing) {
          // New vote
          await trx
            .insertInto("votes")
            .values({
              review_post_id,
              user_id,
              vote_type,
            })
            .execute();

          deltaUp = vote_type === "upvote" ? 1 : 0;
          deltaDown = vote_type === "downvote" ? 1 : 0;
          action = "created";
        } else if (existing.vote_type === vote_type) {
          // Remove existing vote (toggle off)
          await trx
            .deleteFrom("votes")
            .where("review_post_id", "=", review_post_id)
            .where("user_id", "=", user_id)
            .execute();

          deltaUp = vote_type === "upvote" ? -1 : 0;
          deltaDown = vote_type === "downvote" ? -1 : 0;
          action = "removed";
        } else {
          // Switch vote
          await trx
            .updateTable("votes")
            .set({ vote_type })
            .where("review_post_id", "=", review_post_id)
            .where("user_id", "=", user_id)
            .execute();

          deltaUp = vote_type === "upvote" ? 1 : -1;
          deltaDown = vote_type === "downvote" ? 1 : -1;
          action = "switched";
        }

        if (deltaUp !== 0 || deltaDown !== 0) {
          await trx
            .updateTable("review_posts")
            .set((eb) => ({
              upvote_count: eb("upvote_count", "+", deltaUp),
              downvote_count: eb("downvote_count", "+", deltaDown),
              updated_at: new Date(),
            }))
            .where("id", "=", review_post_id)
            .execute();
        }

        const updated = await trx
          .selectFrom("review_posts")
          .selectAll()
          .where("id", "=", review_post_id)
          .executeTakeFirst();

        return {
          review_post: updated,
          vote: {
            user_id,
            review_post_id,
            vote_type: action === "removed" ? null : vote_type,
            action,
          },
        };
      });

      return success(result);
    } catch (err) {
      console.error("[reviews/vote] Error:", err);
      return error((err as Error).message);
    }
  },
};
