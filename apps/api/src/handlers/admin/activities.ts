import { sql } from 'kysely';
import { getDb } from '@/services/db';
import { success, badRequest, error } from '@/middlewares/response';
import { Handler, APIGatewayResponse, APIGatewayEvent } from '@/types';

// GET /admin/activities - List user activities
export const listActivitiesHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '50'), 200);
      const offset = parseInt(params.offset || '0');
      const userId = params.user_id;
      const activityType = params.activity_type;
      const dateFrom = params.date_from; // YYYY-MM-DD
      const dateTo = params.date_to; // YYYY-MM-DD

      let whereClause = sql`WHERE 1=1`;
      
      if (userId) {
        whereClause = sql`${whereClause} AND ua.user_id = ${userId}`;
      }
      if (activityType) {
        whereClause = sql`${whereClause} AND ua.activity_type = ${activityType}`;
      }
      if (dateFrom) {
        whereClause = sql`${whereClause} AND ua.created_at >= ${dateFrom}::date`;
      }
      if (dateTo) {
        whereClause = sql`${whereClause} AND ua.created_at < (${dateTo}::date + INTERVAL '1 day')`;
      }

      const activities = await sql`
        SELECT 
          ua.id,
          ua.user_id,
          u.display_name as user_name,
          u.email as user_email,
          u.avatar as user_avatar,
          ua.session_id,
          ua.activity_type,
          ua.target_type,
          ua.target_id,
          ua.metadata,
          ua.ip_address,
          ua.user_agent,
          ua.page_url,
          ua.referrer,
          ua.created_at
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        ${whereClause}
        ORDER BY ua.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      // Get total count
      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM user_activities ua
        ${whereClause}
      `.execute(db);

      return success({
        activities: activities.rows,
        pagination: {
          total: parseInt((countResult.rows[0] as any).total),
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/activities/list] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/activities/stats - Activity statistics
export const activityStatsHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const params = event.queryStringParameters || {};
      const days = Math.min(parseInt(params.days || '7'), 30);

      // Activities by type (last N days)
      const byType = await sql`
        SELECT 
          activity_type,
          COUNT(*) as count,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_activities
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
        GROUP BY activity_type
        ORDER BY count DESC
      `.execute(db);

      // Activities by day
      const byDay = await sql`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_activities,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT session_id) as sessions
        FROM user_activities
        WHERE created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `.execute(db);

      // Hourly distribution (for today)
      const byHour = await sql`
        SELECT 
          EXTRACT(HOUR FROM created_at) as hour,
          COUNT(*) as count
        FROM user_activities
        WHERE created_at >= CURRENT_DATE
        GROUP BY EXTRACT(HOUR FROM created_at)
        ORDER BY hour
      `.execute(db);

      // Top active users
      const topUsers = await sql`
        SELECT 
          ua.user_id,
          u.display_name,
          u.email,
          u.avatar,
          COUNT(*) as activity_count,
          MAX(ua.created_at) as last_active
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        WHERE ua.created_at >= NOW() - INTERVAL '${sql.raw(days.toString())} days'
          AND ua.user_id IS NOT NULL
        GROUP BY ua.user_id, u.display_name, u.email, u.avatar
        ORDER BY activity_count DESC
        LIMIT 10
      `.execute(db);

      // Recent online users (active in last 15 minutes)
      const onlineUsers = await sql`
        SELECT DISTINCT ON (ua.user_id)
          ua.user_id,
          u.display_name,
          u.avatar,
          ua.activity_type,
          ua.page_url,
          ua.created_at as last_seen
        FROM user_activities ua
        LEFT JOIN users u ON ua.user_id = u.id
        WHERE ua.created_at >= NOW() - INTERVAL '15 minutes'
          AND ua.user_id IS NOT NULL
        ORDER BY ua.user_id, ua.created_at DESC
      `.execute(db);

      // Summary stats
      const summary = await sql`
        SELECT 
          COUNT(*) as total_activities_today,
          COUNT(DISTINCT user_id) as unique_users_today,
          COUNT(DISTINCT session_id) as sessions_today
        FROM user_activities
        WHERE created_at >= CURRENT_DATE
      `.execute(db);

      return success({
        summary: summary.rows[0],
        by_type: byType.rows,
        by_day: byDay.rows,
        by_hour: byHour.rows,
        top_users: topUsers.rows,
        online_users: onlineUsers.rows,
      });
    } catch (err) {
      console.error('[admin/activities/stats] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/activities/user/:userId - Get activities for specific user
export const userActivitiesHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = event.pathParameters?.userId;
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '50'), 200);
      const offset = parseInt(params.offset || '0');

      if (!userId) {
        return badRequest('User ID is required');
      }

      const activities = await sql`
        SELECT 
          ua.id,
          ua.activity_type,
          ua.target_type,
          ua.target_id,
          ua.metadata,
          ua.ip_address,
          ua.page_url,
          ua.created_at
        FROM user_activities ua
        WHERE ua.user_id = ${userId}
        ORDER BY ua.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM user_activities
        WHERE user_id = ${userId}
      `.execute(db);

      // User summary
      const userSummary = await sql`
        SELECT 
          MIN(created_at) as first_activity,
          MAX(created_at) as last_activity,
          COUNT(*) as total_activities,
          COUNT(DISTINCT DATE(created_at)) as active_days
        FROM user_activities
        WHERE user_id = ${userId}
      `.execute(db);

      return success({
        activities: activities.rows,
        summary: userSummary.rows[0],
        pagination: {
          total: parseInt((countResult.rows[0] as any).total),
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/activities/user] Error:', err);
      return error((err as Error).message);
    }
  },
};
