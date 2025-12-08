import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, error } from "../../middlewares/response";
import { sql } from "kysely";
import { getUserIdFromEvent } from "../../utils/auth";

function getRankTag(score: number, hoursAge: number): string {
  if (hoursAge <= 24 && score >= 0) {
    return "new";
  }
  if (score >= 10) {
    return "hot";
  }
  if (score >= 3) {
    return "trending";
  }
  return "normal";
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const params = event.queryStringParameters || {};
      const restaurantId = params.restaurant_id;
      const limit = Math.min(parseInt(params.limit || "20"), 100);

      // score =
      //   upvote_count * 2
      //   + comment_count * 1.5
      //   + share_count * 2
      //   + view_count * 0.2
      //   - downvote_count * 1
      //   divided by (hours since creation + 6)

      const baseQuery = sql`
        SELECT
          rp.id,
          rp.author_id,
          u.display_name AS author_name,
          u.avatar AS author_avatar,
          rp.restaurant_id,
          rp.text,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.comment_count,
          rp.share_count,
          rp.view_count,
          rp.created_at,
          EXTRACT(EPOCH FROM (NOW() - rp.created_at)) / 3600.0 AS hours_age,
          (
            (rp.upvote_count * 2.0)
            + (rp.comment_count * 1.5)
            + (rp.share_count * 2.0)
            + (rp.view_count * 0.2)
            - (rp.downvote_count * 1.0)
          ) / (GREATEST(EXTRACT(EPOCH FROM (NOW() - rp.created_at)) / 3600.0, 0) + 6.0)
          AS score,
          COALESCE(la.restaurant_name, r.name_vi) AS restaurant_name,
          COALESCE(la.full_address, r.address) AS restaurant_address,
          COALESCE(la.price_min, r.price_min) AS price_min,
          COALESCE(la.price_max, r.price_max) AS price_max,
          COALESCE(la.opening_hours::text, r.opening_hours::text) AS opening_hours
        FROM review_posts rp
        LEFT JOIN users u ON rp.author_id = u.id
        LEFT JOIN location_addresses la ON rp.location_address_id = la.id
        LEFT JOIN restaurants r ON rp.restaurant_id = r.id
      `;

      const whereClause = restaurantId
        ? sql` WHERE rp.restaurant_id = ${restaurantId} AND (
            (rp.upvote_count * 2.0)
            + (rp.comment_count * 1.5)
            + (rp.share_count * 2.0)
            + (rp.view_count * 0.2)
            - (rp.downvote_count * 1.0)
          ) > 0 `
        : sql` WHERE (
            (rp.upvote_count * 2.0)
            + (rp.comment_count * 1.5)
            + (rp.share_count * 2.0)
            + (rp.view_count * 0.2)
            - (rp.downvote_count * 1.0)
          ) > 0 `;

      const orderLimit = sql` ORDER BY score DESC LIMIT ${limit} `;

      const query = sql`${baseQuery}${whereClause}${orderLimit}`;
      const result = await query.execute(db);

      interface HotReviewRow {
        id: string;
        author_id: string;
        author_name: string;
        author_avatar: string | null;
        restaurant_id: string;
        text: string;
        photos: unknown;
        upvote_count: number;
        downvote_count: number;
        comment_count: number;
        share_count: number;
        view_count: number;
        created_at: string;
        hours_age: string;
        score: string;
        restaurant_name: string | null;
        restaurant_address: string | null;
        price_min: number | null;
        price_max: number | null;
        opening_hours: string | null;
      }

      const userId = getUserIdFromEvent(event);
      let userLikedReviewIds = new Set<string>();

      if (userId && result.rows.length > 0) {
        const reviewIds = (result.rows as HotReviewRow[]).map((r) => r.id);
        const userVotes = await db
          .selectFrom("votes")
          .select("review_post_id")
          .where("user_id", "=", userId)
          .where("review_post_id", "in", reviewIds)
          .where("vote_type", "=", "upvote")
          .execute();
        userLikedReviewIds = new Set(userVotes.map((v) => v.review_post_id));
      }

      const reviews = (result.rows as HotReviewRow[]).map((row) => ({
        id: row.id,
        author_id: row.author_id,
        author_name: row.author_name,
        author_avatar: row.author_avatar,
        restaurant_id: row.restaurant_id,
        text: row.text,
        photos: row.photos,
        upvote_count: row.upvote_count,
        downvote_count: row.downvote_count,
        comment_count: row.comment_count,
        share_count: row.share_count,
        view_count: row.view_count,
        created_at: row.created_at,
        score: row.score,
        tag: getRankTag(parseFloat(row.score), parseFloat(row.hours_age)),
        restaurant_name: row.restaurant_name,
        restaurant_address: row.restaurant_address,
        price_min: row.price_min,
        price_max: row.price_max,
        opening_hours: row.opening_hours,
        user_has_liked: userLikedReviewIds.has(row.id),
      }));

      return success({
        restaurant_id: restaurantId || null,
        count: reviews.length,
        reviews,
      });
    } catch (err) {
      console.error("[reviews/hot] Error:", err);
      return error((err as Error).message);
    }
  },
};
