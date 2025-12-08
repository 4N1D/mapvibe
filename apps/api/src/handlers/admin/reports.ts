import { sql } from "kysely";
import { getDb } from "@/services/db";
import { getUserIdFromEvent } from "@/utils/auth";
import { success, badRequest, notFound, error, unauthorized } from "@/middlewares/response";
import { Handler, APIGatewayResponse, APIGatewayEvent } from "@/types";

// GET /admin/reports - List all reports
export const listReportsHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");
      const status = params.status; // pending, reviewing, resolved, dismissed
      const targetType = params.target_type; // comment, review, user, photo
      const reason = params.reason; // spam, inappropriate, harassment, misinformation, other

      let whereClause = sql`WHERE 1=1`;

      if (status) {
        whereClause = sql`${whereClause} AND r.status = ${status}`;
      }
      if (targetType) {
        whereClause = sql`${whereClause} AND r.target_type = ${targetType}`;
      }
      if (reason) {
        whereClause = sql`${whereClause} AND r.reason = ${reason}`;
      }

      const reports = await sql`
        SELECT 
          r.id,
          r.reporter_id,
          ru.display_name as reporter_name,
          ru.email as reporter_email,
          r.target_type,
          r.target_id,
          r.reason,
          r.details,
          r.status,
          r.admin_notes,
          r.created_at,
          r.reviewed_at,
          r.reviewed_by,
          rev_user.display_name as reviewed_by_name,
          -- Target content preview
          CASE 
            WHEN r.target_type = 'comment' THEN (
              SELECT json_build_object(
                'text', c.text,
                'author_id', c.author_id,
                'author_name', cu.display_name,
                'created_at', c.created_at,
                'type', 'comment'
              )
              FROM comments c
              LEFT JOIN users cu ON c.author_id = cu.id
              WHERE c.id = r.target_id
            )
            WHEN r.target_type = 'review' THEN (
              -- Try review_posts first, then restaurant_reviews
              COALESCE(
                (
                  SELECT json_build_object(
                    'text', rp.text,
                    'author_id', rp.author_id,
                    'author_name', rpu.display_name,
                    'created_at', rp.created_at,
                    'type', 'review_post'
                  )
                  FROM review_posts rp
                  LEFT JOIN users rpu ON rp.author_id = rpu.id
                  WHERE rp.id = r.target_id
                ),
                (
                  SELECT json_build_object(
                    'text', rr.text,
                    'author_id', rr.author_id,
                    'author_name', rru.display_name,
                    'created_at', rr.created_at,
                    'rating_overall', rr.rating_overall,
                    'type', 'restaurant_review'
                  )
                  FROM restaurant_reviews rr
                  LEFT JOIN users rru ON rr.author_id = rru.id
                  WHERE rr.id = r.target_id
                )
              )
            )
            ELSE NULL
          END as target_content
        FROM reports r
        LEFT JOIN users ru ON r.reporter_id = ru.id
        LEFT JOIN users rev_user ON r.reviewed_by = rev_user.id
        ${whereClause}
        ORDER BY 
          CASE r.status 
            WHEN 'pending' THEN 0 
            WHEN 'reviewing' THEN 1 
            ELSE 2 
          END,
          r.created_at DESC
        LIMIT ${limit}
        OFFSET ${offset}
      `.execute(db);

      // Get total count
      const countResult = await sql`
        SELECT COUNT(*) as total
        FROM reports r
        ${whereClause}
      `.execute(db);

      // Get counts by status
      const statusCounts = await sql`
        SELECT 
          status,
          COUNT(*) as count
        FROM reports
        GROUP BY status
      `.execute(db);

      const statusCountMap: Record<string, number> = {};
      for (const row of statusCounts.rows as { status: string; count: string }[]) {
        statusCountMap[row.status] = parseInt(row.count);
      }

      return success({
        reports: reports.rows,
        pagination: {
          total: parseInt(String((countResult.rows[0] as { total: string }).total)),
          limit,
          offset,
        },
        counts: {
          pending: statusCountMap.pending || 0,
          reviewing: statusCountMap.reviewing || 0,
          resolved: statusCountMap.resolved || 0,
          dismissed: statusCountMap.dismissed || 0,
        },
      });
    } catch (err) {
      console.error("[admin/reports/list] Error:", err);
      return error((err as Error).message);
    }
  },
};

// PATCH /admin/reports/:id - Update report status
export const updateReportHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const adminUserId = getUserIdFromEvent(event);
      const reportId = event.pathParameters?.id;

      if (!adminUserId) {
        return unauthorized("Authentication required");
      }

      if (!reportId) {
        return badRequest("Report ID is required");
      }

      let body: {
        status?: string;
        admin_notes?: string;
        action?: "hide_content" | "delete_content" | "ban_user";
      };
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { status, admin_notes, action } = body;

      // Verify report exists
      const report = await db
        .selectFrom("reports")
        .select(["id", "target_type", "target_id", "status"])
        .where("id", "=", parseInt(reportId))
        .executeTakeFirst();

      if (!report) {
        return notFound("Report not found");
      }

      // Update report
      const updateData: Record<string, unknown> = {
        reviewed_by: adminUserId,
        reviewed_at: new Date(),
      };

      if (status && ["pending", "reviewing", "resolved", "dismissed"].includes(status)) {
        updateData.status = status;
      }

      if (admin_notes !== undefined) {
        updateData.admin_notes = admin_notes;
      }

      await db
        .updateTable("reports")
        .set(updateData)
        .where("id", "=", parseInt(reportId))
        .execute();

      // Perform action on target content
      if (action && status === "resolved") {
        if (action === "hide_content") {
          if (report.target_type === "comment") {
            await db
              .updateTable("comments")
              .set({ status: "hidden" })
              .where("id", "=", report.target_id)
              .execute();
          } else if (report.target_type === "review") {
            // Try review_posts first, then restaurant_reviews
            const rpResult = await db
              .updateTable("review_posts")
              .set({ status: "hidden" })
              .where("id", "=", report.target_id)
              .executeTakeFirst();
            
            if (!rpResult.numUpdatedRows || rpResult.numUpdatedRows === BigInt(0)) {
              await sql`
                UPDATE restaurant_reviews 
                SET updated_at = NOW() 
                WHERE id = ${report.target_id}
              `.execute(db);
            }
          }
        } else if (action === "delete_content") {
          if (report.target_type === "comment") {
            await db
              .updateTable("comments")
              .set({ status: "deleted" })
              .where("id", "=", report.target_id)
              .execute();
          } else if (report.target_type === "review") {
            // Try review_posts first
            const rpResult = await db
              .updateTable("review_posts")
              .set({ status: "deleted" })
              .where("id", "=", report.target_id)
              .executeTakeFirst();
            
            // If not found in review_posts, delete from restaurant_reviews
            if (!rpResult.numUpdatedRows || rpResult.numUpdatedRows === BigInt(0)) {
              await db
                .deleteFrom("restaurant_reviews")
                .where("id", "=", report.target_id)
                .execute();
            }
          }
        } else if (action === "ban_user") {
          // Get the author of the content
          let authorId: string | null = null;
          if (report.target_type === "comment") {
            const comment = await db
              .selectFrom("comments")
              .select(["author_id"])
              .where("id", "=", report.target_id)
              .executeTakeFirst();
            authorId = comment?.author_id || null;
          } else if (report.target_type === "review") {
            // Try review_posts first
            let review = await db
              .selectFrom("review_posts")
              .select(["author_id"])
              .where("id", "=", report.target_id)
              .executeTakeFirst();
            
            // If not found, try restaurant_reviews
            if (!review) {
              review = await db
                .selectFrom("restaurant_reviews")
                .select(["author_id"])
                .where("id", "=", report.target_id)
                .executeTakeFirst();
            }
            authorId = review?.author_id || null;
          }

          if (authorId) {
            await db
              .updateTable("users")
              .set({ account_status: "banned" })
              .where("id", "=", authorId)
              .execute();
          }
        }
      }

      return success({
        success: true,
        message: "Report updated successfully",
      });
    } catch (err) {
      console.error("[admin/reports/update] Error:", err);
      return error((err as Error).message);
    }
  },
};

// GET /admin/reports/:id - Get single report detail
export const getReportHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const reportId = event.pathParameters?.id;

      if (!reportId) {
        return badRequest("Report ID is required");
      }

      const report = await sql`
        SELECT 
          r.*,
          ru.display_name as reporter_name,
          ru.email as reporter_email,
          rev_user.display_name as reviewed_by_name
        FROM reports r
        LEFT JOIN users ru ON r.reporter_id = ru.id
        LEFT JOIN users rev_user ON r.reviewed_by = rev_user.id
        WHERE r.id = ${parseInt(reportId)}
      `.execute(db);

      if (report.rows.length === 0) {
        return notFound("Report not found");
      }

      const reportData = report.rows[0] as {
        target_type: string;
        target_id: string;
        [key: string]: unknown;
      };

      // Get target content
      let targetContent = null;
      if (reportData.target_type === "comment") {
        const result = await sql`
          SELECT c.*, u.display_name as author_name, u.avatar as author_avatar, 'comment' as content_type
          FROM comments c
          LEFT JOIN users u ON c.author_id = u.id
          WHERE c.id = ${reportData.target_id}
        `.execute(db);
        targetContent = result.rows[0] || null;
      } else if (reportData.target_type === "review") {
        // Try review_posts first
        let result = await sql`
          SELECT rp.*, u.display_name as author_name, u.avatar as author_avatar, 'review_post' as content_type
          FROM review_posts rp
          LEFT JOIN users u ON rp.author_id = u.id
          WHERE rp.id = ${reportData.target_id}
        `.execute(db);
        targetContent = result.rows[0] || null;
        
        // If not found, try restaurant_reviews
        if (!targetContent) {
          result = await sql`
            SELECT rr.*, u.display_name as author_name, u.avatar as author_avatar, 'restaurant_review' as content_type
            FROM restaurant_reviews rr
            LEFT JOIN users u ON rr.author_id = u.id
            WHERE rr.id = ${reportData.target_id}
          `.execute(db);
          targetContent = result.rows[0] || null;
        }
      }

      // Get other reports for same target
      const relatedReports = await sql`
        SELECT r.id, r.reason, r.status, r.created_at, u.display_name as reporter_name
        FROM reports r
        LEFT JOIN users u ON r.reporter_id = u.id
        WHERE r.target_type = ${reportData.target_type}
          AND r.target_id = ${reportData.target_id}
          AND r.id != ${parseInt(reportId)}
        ORDER BY r.created_at DESC
        LIMIT 10
      `.execute(db);

      return success({
        report: reportData,
        target_content: targetContent,
        related_reports: relatedReports.rows,
      });
    } catch (err) {
      console.error("[admin/reports/get] Error:", err);
      return error((err as Error).message);
    }
  },
};
