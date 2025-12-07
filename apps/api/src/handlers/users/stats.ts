import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, unauthorized, error } from '../../middlewares/response';
import { getUserIdFromEvent } from '@/utils/auth';
import { sql } from 'kysely';

// GET /users/me/stats - Get current user's aggregated statistics
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      const db = await getDb();

      // Get all stats in a single query
      const statsQuery = sql`
        SELECT 
          (SELECT COUNT(*) FROM review_posts WHERE author_id = ${userId}) as review_post_count,
          (SELECT COUNT(*) FROM restaurant_reviews WHERE author_id = ${userId}) as restaurant_review_count,
          (SELECT COUNT(*) FROM photos WHERE uploaded_by = ${userId}) as photo_count,
          (SELECT COUNT(*) FROM comments WHERE author_id = ${userId}) as comment_count,
          (SELECT COUNT(*) FROM favorites WHERE user_id = ${userId}) as saved_count
      `;

      const result = await statsQuery.execute(db);
      const stats = result.rows[0] as {
        review_post_count: string;
        restaurant_review_count: string;
        photo_count: string;
        comment_count: string;
        saved_count: string;
      };

      const reviewPostCount = Number(stats?.review_post_count || 0);
      const restaurantReviewCount = Number(stats?.restaurant_review_count || 0);

      return success({
        review_count: reviewPostCount + restaurantReviewCount,
        review_post_count: reviewPostCount,
        restaurant_review_count: restaurantReviewCount,
        photo_count: Number(stats?.photo_count || 0),
        comment_count: Number(stats?.comment_count || 0),
        saved_count: Number(stats?.saved_count || 0),
      });
    } catch (err) {
      console.error('[users/me/stats] Error:', err);
      return error((err as Error).message);
    }
  },
};
