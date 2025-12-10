import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error, unauthorized } from "../../middlewares/response";
import { getUserIdFromEvent } from "../../utils/auth";

type ReportReason = "spam" | "inappropriate" | "harassment" | "misinformation" | "other";

interface ReportBody {
  review_post_id: string;
  reason: ReportReason;
  details?: string;
}

// POST /reviews/report - Report a review post
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized("Authentication required");
      }

      let body: ReportBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { review_post_id, reason, details } = body;

      if (!review_post_id) {
        return badRequest("review_post_id is required");
      }

      const validReasons: ReportReason[] = ["spam", "inappropriate", "harassment", "misinformation", "other"];
      if (!reason || !validReasons.includes(reason)) {
        return badRequest(
          "Valid reason is required: spam, inappropriate, harassment, misinformation, or other"
        );
      }

      // Verify review post exists
      const reviewPost = await db
        .selectFrom("review_posts")
        .select(["id"])
        .where("id", "=", review_post_id)
        .executeTakeFirst();

      if (!reviewPost) {
        return notFound("Review post not found");
      }

      // Check if user already reported this review post
      const existingReport = await db
        .selectFrom("reports")
        .select(["id"])
        .where("target_type", "=", "review_post")
        .where("target_id", "=", review_post_id)
        .where("reporter_id", "=", userId)
        .executeTakeFirst();

      if (existingReport) {
        return badRequest("Bạn đã báo cáo bài viết này rồi");
      }

      // Create report
      await db
        .insertInto("reports")
        .values({
          reporter_id: userId,
          target_type: "review_post",
          target_id: review_post_id,
          reason,
          details: details ?? null,
          status: "pending",
        })
        .execute();

      return success({
        success: true,
        message: "Báo cáo đã được ghi nhận",
      });
    } catch (err) {
      console.error("[reviews/report] Error:", err);
      return error((err as Error).message);
    }
  },
};
