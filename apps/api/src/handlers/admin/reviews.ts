import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, unauthorized, notFound, error } from '../../middlewares/response';
import { getUserIdFromEvent, isUserAdmin } from '../../utils/auth';
import { sql } from 'kysely';

// GET /admin/reviews - List all reviews with filters
export const listReviewsHandler: Handler = {
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
      const status = params.status; // all, reported, hidden
      const sortBy = params.sort_by || 'created_at';
      const sortOrder = params.sort_order === 'asc' ? 'asc' : 'desc';

      // Build query based on status filter
      let whereClause = sql``;
      if (status === 'reported') {
        whereClause = sql`WHERE rp.report_count > 0`;
      } else if (status === 'hidden') {
        whereClause = sql`WHERE rp.status = 'hidden'`;
      }

      const result = await sql`
        SELECT 
          rp.id,
          rp.author_id,
          u.display_name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          rp.text,
          rp.features,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.comment_count,
          rp.report_count,
          rp.status,
          rp.created_at,
          la.restaurant_name as place_name,
          la.full_address as place_address,
          r.id as restaurant_id
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        LEFT JOIN location_addresses la ON la.id = rp.location_address_id
        LEFT JOIN restaurants r ON r.id = rp.restaurant_id
        ${whereClause}
        ORDER BY rp.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await db.selectFrom('review_posts')
        .select(sql<number>`count(*)::int`.as('total'))
        .executeTakeFirst();

      return success({
        reviews: result.rows,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/reviews] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/reviews/:id - Get review details
export const getReviewHandler: Handler = {
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

      const reviewId = event.pathParameters?.id;
      if (!reviewId) {
        return badRequest('Review ID required');
      }

      const db = await getDb();

      const result = await sql`
        SELECT 
          rp.*,
          u.display_name as author_name,
          u.email as author_email,
          u.avatar as author_avatar,
          la.restaurant_name as place_name,
          la.full_address as place_address
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        LEFT JOIN location_addresses la ON la.id = rp.location_address_id
        WHERE rp.id = ${reviewId}
      `.execute(db);

      if (result.rows.length === 0) {
        return notFound('Review not found');
      }

      return success({ review: result.rows[0] });
    } catch (err) {
      console.error('[admin/reviews/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/reviews/:id - Update review (approve/hide/delete)
export const updateReviewHandler: Handler = {
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

      const reviewId = event.pathParameters?.id;
      if (!reviewId) {
        return badRequest('Review ID required');
      }

      let body: { action: string; reason?: string };
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { action, reason } = body;
      if (!action) {
        return badRequest('Action required (approve, hide, delete, restore)');
      }

      const db = await getDb();
      const updateData: Record<string, unknown> = { updated_at: new Date() };

      switch (action) {
        case 'approve':
          updateData.status = 'approved';
          updateData.report_count = 0;
          break;
        case 'hide':
          updateData.status = 'hidden';
          updateData.hidden_reason = reason || 'Violated community guidelines';
          break;
        case 'delete':
          updateData.status = 'deleted';
          updateData.hidden_reason = reason || 'Deleted by admin';
          break;
        case 'restore':
          updateData.status = 'active';
          updateData.hidden_reason = null;
          break;
        default:
          return badRequest('Invalid action. Use: approve, hide, delete, restore');
      }

      const updated = await db
        .updateTable('review_posts')
        .set(updateData)
        .where('id', '=', reviewId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return notFound('Review not found');
      }

      return success({ 
        message: `Review ${action}d successfully`,
        review: updated,
      });
    } catch (err) {
      console.error('[admin/reviews/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/pending - List pending location suggestions
export const listPendingLocationsHandler: Handler = {
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

      const result = await sql`
        SELECT 
          la.*,
          u.display_name as submitted_by_name,
          u.email as submitted_by_email
        FROM location_addresses la
        LEFT JOIN users u ON u.id = la.created_by_user_id
        WHERE la.status = 'pending'
        ORDER BY la.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await db.selectFrom('location_addresses')
        .select(sql<number>`count(*)::int`.as('total'))
        .where('status', '=', 'pending')
        .executeTakeFirst();

      return success({
        locations: result.rows,
        pagination: {
          total: countResult?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/locations/pending] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/:id - Get location detail
export const getLocationHandler: Handler = {
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

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest('Location ID required');
      }

      const db = await getDb();

      const result = await sql`
        SELECT 
          la.*,
          u.display_name as submitted_by_name,
          u.email as submitted_by_email
        FROM location_addresses la
        LEFT JOIN users u ON u.id = la.created_by_user_id
        WHERE la.id = ${locationId}
      `.execute(db);

      if (result.rows.length === 0) {
        return notFound('Location not found');
      }

      return success({ location: result.rows[0] });
    } catch (err) {
      console.error('[admin/locations/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/locations/:id/reviews - Get reviews for a location
export const getLocationReviewsHandler: Handler = {
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

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest('Location ID required');
      }

      const db = await getDb();
      const params = event.queryStringParameters || {};
      
      const limit = Math.min(parseInt(params.limit || '50'), 100);
      const offset = parseInt(params.offset || '0');

      const result = await sql`
        SELECT 
          rp.id,
          rp.author_id,
          u.display_name as author_name,
          u.avatar as author_avatar,
          rp.text,
          rp.features,
          rp.photos,
          rp.upvote_count,
          rp.downvote_count,
          rp.status,
          rp.created_at
        FROM review_posts rp
        LEFT JOIN users u ON u.id = rp.author_id
        WHERE rp.location_address_id = ${locationId}
        ORDER BY rp.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      const countResult = await sql`
        SELECT count(*)::int as total
        FROM review_posts
        WHERE location_address_id = ${locationId}
      `.execute(db);

      return success({
        reviews: result.rows,
        pagination: {
          total: (countResult.rows[0] as any)?.total || 0,
          limit,
          offset,
        },
      });
    } catch (err) {
      console.error('[admin/locations/:id/reviews] Error:', err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/locations/:id - Approve/reject location
export const updateLocationHandler: Handler = {
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

      const locationId = event.pathParameters?.id;
      if (!locationId) {
        return badRequest('Location ID required');
      }

      let body: { action: string; reason?: string };
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { action, reason } = body;
      if (!['approve', 'reject'].includes(action)) {
        return badRequest('Invalid action. Use: approve, reject');
      }

      const db = await getDb();

      const updated = await db
        .updateTable('location_addresses')
        .set({
          status: action === 'approve' ? 'approved' : 'rejected',
          approved_by: action === 'approve' ? userId : null,
          approved_at: action === 'approve' ? new Date() : null,
          rejection_reason: action === 'reject' ? reason : null,
          updated_at: new Date(),
        })
        .where('id', '=', locationId)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return notFound('Location not found');
      }

      return success({ 
        message: `Location ${action}d successfully`,
        location: updated,
      });
    } catch (err) {
      console.error('[admin/locations/:id] Error:', err);
      return error((err as Error).message);
    }
  },
};
