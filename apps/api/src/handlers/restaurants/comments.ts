import crypto from 'crypto';
import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error } from '../../middlewares/response';

interface CreateCommentBody {
  author_id: string;
  text: string;
  parent_comment_id?: string;
}

// GET /restaurants/:slug/comments - Fetch comments list
export const listHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = parseInt(params.offset || '0');

      // Fetch comments with author info, ordered by created_at DESC
      const comments = await db
        .selectFrom('comments')
        .innerJoin('users', 'users.id', 'comments.author_id')
        .select([
          'comments.id',
          'comments.text',
          'comments.parent_comment_id',
          'comments.thread_depth',
          'comments.like_count',
          'comments.created_at',
          'users.id as author_id',
          'users.display_name as author_name',
          'users.avatar as author_avatar',
        ])
        .where('comments.restaurant_id', '=', restaurant.id)
        .where('comments.status', '=', 'published')
        .orderBy('comments.created_at', 'desc')
        .limit(limit)
        .offset(offset)
        .execute();

      // Get total count
      const countResult = await db
        .selectFrom('comments')
        .select((eb) => eb.fn.count('id').as('total'))
        .where('restaurant_id', '=', restaurant.id)
        .where('status', '=', 'published')
        .executeTakeFirst();

      return success({
        restaurant_id: restaurant.id,
        comments,
        pagination: {
          limit,
          offset,
          total: Number(countResult?.total || 0),
        },
      });
    } catch (err) {
      console.error('[restaurants/comments/list] Error:', err);
      return error((err as Error).message);
    }
  },
};

// POST /restaurants/:slug/comments - Create comment
export const createHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      let body: CreateCommentBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { author_id, text, parent_comment_id } = body;

      if (!author_id) {
        return badRequest('author_id is required');
      }

      if (!text || text.trim().length === 0) {
        return badRequest('text is required');
      }

      // Verify author exists
      const author = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', author_id)
        .executeTakeFirst();

      if (!author) {
        return badRequest('Invalid author_id: user does not exist');
      }

      // Verify parent comment exists if provided
      let threadDepth = 0;
      if (parent_comment_id) {
        const parentComment = await db
          .selectFrom('comments')
          .select(['id', 'thread_depth'])
          .where('id', '=', parent_comment_id)
          .where('restaurant_id', '=', restaurant.id)
          .executeTakeFirst();

        if (!parentComment) {
          return badRequest('Invalid parent_comment_id: comment does not exist');
        }
        threadDepth = (parentComment.thread_depth ?? 0) + 1;
      }

      // Create comment
      const [result] = await db
        .insertInto('comments')
        .values({
          id: crypto.randomUUID(),
          restaurant_id: restaurant.id,
          author_id,
          text,
          parent_comment_id: parent_comment_id ?? null,
          thread_depth: threadDepth,
          like_count: 0,
          status: 'published',
        })
        .returningAll()
        .execute();

      return success({ comment: result }, 201);
    } catch (err) {
      console.error('[restaurants/comments/create] Error:', err);
      return error((err as Error).message);
    }
  },
};
