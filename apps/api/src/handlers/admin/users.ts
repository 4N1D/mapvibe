import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, unauthorized, notFound, error } from '../../middlewares/response';
import { getUserIdFromEvent, isUserAdmin } from '../../utils/auth';
import { sql } from 'kysely';

// GET /admin/users - List all users with filters
export const listUsersHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(userId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};
      
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = parseInt(params.offset || '0');
      const search = params.search || '';
      const status = params.status; // active, banned, suspended
      const role = params.role; // user, admin

      let query = db
        .selectFrom('users')
        .select([
          'id',
          'email',
          'display_name',
          'avatar',
          'reputation',
          'roles',
          'account_status',
          'email_verified',
          'created_at',
          'last_login_at',
        ])
        .orderBy('created_at', 'desc')
        .limit(limit)
        .offset(offset);

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('email', 'ilike', `%${search}%`),
            eb('display_name', 'ilike', `%${search}%`),
          ])
        );
      }

      if (status) {
        query = query.where('account_status', '=', status);
      }

      if (role) {
        query = query.where('roles', 'like', `%${role}%`);
      }

      const [users, countResult] = await Promise.all([
        query.execute(),
        db.selectFrom('users')
          .select(sql<number>`count(*)::int`.as('total'))
          .executeTakeFirst(),
      ]);

      return success({
        users,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/users] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/users/:id - Get user details
export const getUserHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const adminId = getUserIdFromEvent(event);
      if (!adminId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(adminId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const userId = event.pathParameters?.id;
      if (!userId) {
        return badRequest('User ID required');
      }

      const db = await getDb();

      const user = await db
        .selectFrom('users')
        .selectAll()
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return notFound('User not found');
      }

      // Get user stats
      const [reviewCount, photoCount, commentCount] = await Promise.all([
        db.selectFrom('review_posts')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('author_id', '=', userId)
          .executeTakeFirst(),
        db.selectFrom('photos')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('uploaded_by', '=', userId)
          .executeTakeFirst(),
        db.selectFrom('comments')
          .select(sql<number>`count(*)::int`.as('count'))
          .where('author_id', '=', userId)
          .executeTakeFirst(),
      ]);

      return success({
        user,
        stats: {
          review_count: reviewCount?.count || 0,
          photo_count: photoCount?.count || 0,
          comment_count: commentCount?.count || 0,
        },
      });
    } catch (err) {
      console.error('[admin/users/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/users/:id - Update user (ban/unban/change role)
export const updateUserHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const adminId = getUserIdFromEvent(event);
      if (!adminId) {
        return unauthorized('Authentication required');
      }

      const isAdmin = await isUserAdmin(adminId);
      if (!isAdmin) {
        return unauthorized('Admin access required');
      }

      const userId = event.pathParameters?.id;
      if (!userId) {
        return badRequest('User ID required');
      }

      // Prevent admin from modifying themselves
      if (userId === adminId) {
        return badRequest('Cannot modify your own account');
      }

      let body: { action: string; reason?: string; role?: string };
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { action, reason, role } = body;
      if (!action) {
        return badRequest('Action required (ban, unban, suspend, activate, set_role)');
      }

      const db = await getDb();
      const updateData: Record<string, unknown> = { updated_at: new Date() };

      switch (action) {
        case 'ban':
          updateData.account_status = 'banned';
          updateData.ban_reason = reason || 'Violated terms of service';
          break;
        case 'unban':
        case 'activate':
          updateData.account_status = 'active';
          updateData.ban_reason = null;
          break;
        case 'suspend':
          updateData.account_status = 'suspended';
          updateData.ban_reason = reason || 'Account suspended';
          break;
        case 'set_role':
          if (!role || !['user', 'admin'].includes(role)) {
            return badRequest('Invalid role. Use: user, admin');
          }
          updateData.roles = JSON.stringify([role]);
          break;
        default:
          return badRequest('Invalid action. Use: ban, unban, suspend, activate, set_role');
      }

      const updated = await db
        .updateTable('users')
        .set(updateData)
        .where('id', '=', userId)
        .returning([
          'id',
          'email',
          'display_name',
          'roles',
          'account_status',
          'updated_at',
        ])
        .executeTakeFirst();

      if (!updated) {
        return notFound('User not found');
      }

      return success({ 
        message: `User ${action} successfully`,
        user: updated,
      });
    } catch (err) {
      console.error('[admin/users/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};
