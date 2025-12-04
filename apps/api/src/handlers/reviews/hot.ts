import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, error } from '../../middlewares/response';
import { sql } from 'kysely';

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const params = event.queryStringParameters || {};
      const restaurantId = params.restaurant_id;
      const limit = Math.min(parseInt(params.limit || '20'), 100);

      // score =
      //   upvote_count * 2
      //   + comment_count * 1.5
      //   + share_count * 2
      //   + view_count * 0.2
      //   - downvote_count * 1
      //   tất cả chia cho (số giờ từ lúc tạo ra + 6)

      const baseQuery = sql`
        SELECT
          id,
          author_id,
          restaurant_id,
          text,
          features,
          photos,
          upvote_count,
          downvote_count,
          comment_count,
          share_count,
          view_count,
          created_at,
          (
            (upvote_count * 2.0)
            + (comment_count * 1.5)
            + (share_count * 2.0)
            + (view_count * 0.2)
            - (downvote_count * 1.0)
          ) / (GREATEST(EXTRACT(EPOCH FROM (NOW() - created_at)) / 3600.0, 0) + 6.0)
          AS score
        FROM review_posts
      `;

      const whereClause = restaurantId
        ? sql` WHERE restaurant_id = ${restaurantId} AND (
            (upvote_count * 2.0)
            + (comment_count * 1.5)
            + (share_count * 2.0)
            + (view_count * 0.2)
            - (downvote_count * 1.0)
          ) > 0 `
        : sql` WHERE (
            (upvote_count * 2.0)
            + (comment_count * 1.5)
            + (share_count * 2.0)
            + (view_count * 0.2)
            - (downvote_count * 1.0)
          ) > 0 `;

      const orderLimit = sql` ORDER BY score DESC LIMIT ${limit} `;

      const query = sql`${baseQuery}${whereClause}${orderLimit}`;
      const result = await query.execute(db);

      return success({
        restaurant_id: restaurantId || null,
        count: result.rows.length,
        reviews: result.rows,
      });
    } catch (err) {
      console.error('[reviews/hot] Error:', err);
      return error((err as Error).message);
    }
  },
};


