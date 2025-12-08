import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error, unauthorized } from '../../middlewares/response';
import { getUserIdFromEvent } from '../../utils/auth';

// POST /reviews/comments/:commentId/like - Toggle like on review comment
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const commentId = event.pathParameters?.commentId;

      if (!userId) {
        return unauthorized('Authentication required');
      }

      if (!commentId) {
        return badRequest('Comment ID is required');
      }

      // Verify comment exists and is related to a review post
      const comment = await db
        .selectFrom('comments')
        .select(['id', 'like_count', 'review_post_id'])
        .where('id', '=', commentId)
        .where('status', '=', 'published')
        .executeTakeFirst();

      if (!comment) {
        return notFound('Comment not found');
      }

      if (!comment.review_post_id) {
        return badRequest('This comment is not associated with a review post');
      }

      // Check if user already liked this comment
      const existingLike = await db
        .selectFrom('likes')
        .select(['id'])
        .where('target_type', '=', 'comment')
        .where('target_id', '=', commentId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      let liked: boolean;
      let newLikeCount: number;

      if (existingLike) {
        // Unlike - remove the like
        await db
          .deleteFrom('likes')
          .where('target_type', '=', 'comment')
          .where('target_id', '=', commentId)
          .where('user_id', '=', userId)
          .execute();

        newLikeCount = Math.max((comment.like_count ?? 0) - 1, 0);
        liked = false;
      } else {
        // Like - add the like
        await db
          .insertInto('likes')
          .values({
            user_id: userId,
            target_type: 'comment',
            target_id: commentId,
          })
          .execute();

        newLikeCount = (comment.like_count ?? 0) + 1;
        liked = true;
      }

      // Update like_count on comment
      await db
        .updateTable('comments')
        .set({ like_count: newLikeCount })
        .where('id', '=', commentId)
        .execute();

      return success({
        liked,
        like_count: newLikeCount,
      });
    } catch (err) {
      console.error('[reviews/comment-like] Error:', err);
      return error((err as Error).message);
    }
  },
};
