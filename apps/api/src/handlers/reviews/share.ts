import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, error } from '../../middlewares/response';
import { getUserIdFromEvent } from '@/utils/auth';

interface ShareBody {
  review_post_id: string;
  platform?: 'facebook' | 'twitter' | 'copy_link' | 'other';
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const userId = getUserIdFromEvent(event);

      let body: ShareBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { review_post_id, platform = 'other' } = body;

      if (!review_post_id) {
        return badRequest('review_post_id is required');
      }

      const reviewPost = await db
        .selectFrom('review_posts')
        .select(['id', 'share_count'])
        .where('id', '=', review_post_id)
        .executeTakeFirst();

      if (!reviewPost) {
        return badRequest('Invalid review_post_id: review post does not exist');
      }

      await db
        .updateTable('review_posts')
        .set((eb) => ({
          share_count: eb('share_count', '+', 1),
          updated_at: new Date(),
        }))
        .where('id', '=', review_post_id)
        .execute();

      const updated = await db
        .selectFrom('review_posts')
        .select(['id', 'share_count'])
        .where('id', '=', review_post_id)
        .executeTakeFirst();

      const baseUrl = process.env.FRONTEND_URL || 'https://mapvibe.site';
      const shareUrl = `${baseUrl}/reviews/${review_post_id}`;

      return success({
        review_post_id,
        share_count: updated?.share_count ?? reviewPost.share_count + 1,
        platform,
        shared_by: userId || 'anonymous',
        url: shareUrl,
      });
    } catch (err) {
      console.error('[reviews/share] Error:', err);
      return error((err as Error).message);
    }
  },
};
