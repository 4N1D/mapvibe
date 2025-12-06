import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, error } from '../../middlewares/response';
import { sql } from 'kysely';

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = parseInt(params.offset || '0');
      const restaurantId = params.restaurant_id;

      let query;
      if (restaurantId) {
        query = sql`
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
            created_at
          FROM review_posts
          WHERE restaurant_id = ${restaurantId}
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      } else {
        query = sql`
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
            created_at
          FROM review_posts
          ORDER BY created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const result = await query.execute(db);

      return success({
        restaurant_id: restaurantId || null,
        count: result.rows.length,
        limit,
        offset,
        reviews: result.rows,
      });
    } catch (err) {
      console.error('[reviews/list] Error:', err);
      return error((err as Error).message);
    }
  },
};
