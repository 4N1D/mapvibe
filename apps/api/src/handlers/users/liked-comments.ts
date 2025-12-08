import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, error, unauthorized } from '../../middlewares/response';
import { getUserIdFromEvent } from '../../utils/auth';

// GET /users/me/liked-comments - Get user's liked comments history
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      const params = event.queryStringParameters || {};
      const page = Math.max(parseInt(params.page || '1'), 1);
      const limit = Math.min(Math.max(parseInt(params.limit || '20'), 1), 100);
      const offset = (page - 1) * limit;

      // Get liked comments with comment details and author info
      const likedComments = await db
        .selectFrom('likes')
        .innerJoin('comments', 'comments.id', 'likes.target_id')
        .innerJoin('users', 'users.id', 'comments.author_id')
        .leftJoin('review_posts', 'review_posts.id', 'comments.review_post_id')
        .select([
          'comments.id',
          'comments.text as content',
          'comments.like_count',
          'comments.created_at as comment_created_at',
          'comments.review_post_id',
          'users.id as author_id',
          'users.display_name as author_name',
          'users.avatar as author_avatar',
          'likes.created_at as liked_at',
          'review_posts.text as review_text',
        ])
        .where('likes.user_id', '=', userId)
        .where('likes.target_type', '=', 'comment')
        .where('comments.status', '=', 'published')
        .orderBy('likes.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom('likes')
        .innerJoin('comments', 'comments.id', 'likes.target_id')
        .select((eb) => eb.fn.count('likes.id').as('total'))
        .where('likes.user_id', '=', userId)
        .where('likes.target_type', '=', 'comment')
        .where('comments.status', '=', 'published')
        .executeTakeFirst();

      const total = Number(countResult?.total || 0);
      const totalPages = Math.ceil(total / limit);

      const comments = likedComments.map((comment) => ({
        id: comment.id,
        content: comment.content,
        like_count: comment.like_count ?? 0,
        created_at: comment.comment_created_at?.toISOString() ?? new Date().toISOString(),
        liked_at: comment.liked_at?.toISOString() ?? new Date().toISOString(),
        review_post_id: comment.review_post_id,
        review_text: comment.review_text ? comment.review_text.substring(0, 100) + '...' : null,
        author: {
          id: comment.author_id,
          name: comment.author_name,
          avatar: comment.author_avatar,
        },
      }));

      return success({
        total,
        page,
        limit,
        total_pages: totalPages,
        comments,
      });
    } catch (err) {
      console.error('[users/liked-comments] Error:', err);
      return error((err as Error).message);
    }
  },
};
