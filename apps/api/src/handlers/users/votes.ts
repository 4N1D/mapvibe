import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, unauthorized, error } from '../../middlewares/response';
import { getUserIdFromEvent } from '../../utils/auth';

// GET /users/me/votes - Get all votes by current user
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      console.log('[users/me/votes] userId:', userId);

      const votes = await db
        .selectFrom('votes')
        .select(['review_post_id', 'vote_type', 'created_at'])
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();

      return success({ votes });
    } catch (err) {
      console.error('[users/me/votes] Error:', err);
      return error((err as Error).message);
    }
  },
};
