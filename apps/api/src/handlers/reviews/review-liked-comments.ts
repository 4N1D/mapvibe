import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, error } from '../../middlewares/response';
import { getUserIdFromEvent } from '../../utils/auth';

// GET /reviews/:reviewId/liked-comments - Get comment IDs that the user has liked for a specific review
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const reviewId = event.pathParameters?.reviewId;
      const userId = getUserIdFromEvent(event);

      if (!reviewId) {
        return badRequest('Review ID is required');
      }

      // If user is not authenticated, return empty array
      if (!userId) {
        return success({
          review_id: reviewId,
          liked_comment_ids: [],
        });
      }

      // Get all comment IDs for this review that the user has liked
      const likedComments = await db
        .selectFrom('likes')
        .innerJoin('comments', 'comments.id', 'likes.target_id')
        .select(['comments.id'])
        .where('likes.user_id', '=', userId)
        .where('likes.target_type', '=', 'comment')
        .where('comments.review_post_id', '=', reviewId)
        .where('comments.status', '=', 'published')
        .execute();

      const likedCommentIds = likedComments.map((c) => c.id);

      return success({
        review_id: reviewId,
        liked_comment_ids: likedCommentIds,
      });
    } catch (err) {
      console.error('[reviews/review-liked-comments] Error:', err);
      return error((err as Error).message);
    }
  },
};
