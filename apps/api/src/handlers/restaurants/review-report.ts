import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, notFound, badRequest, error, unauthorized } from "../../middlewares/response";
import { getUserIdFromEvent } from "../../utils/auth";

type ReportReason = "spam" | "inappropriate" | "harassment" | "misinformation" | "other";

interface ReportBody {
  reason: ReportReason;
  details?: string;
}

// POST /restaurants/reviews/:reviewId/report - Report a restaurant review
export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);
      const reviewId = event.pathParameters?.reviewId;

      if (!userId) {
        return unauthorized("Authentication required");
      }

      if (!reviewId) {
        return badRequest("Review ID is required");
      }

      let body: ReportBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { reason, details } = body;

      if (!reason) {
        return badRequest("reason is required");
      }

      const validReasons: ReportReason[] = ["spam", "inappropriate", "harassment", "misinformation", "other"];
      if (!validReasons.includes(reason)) {
        return badRequest(`reason must be one of: ${validReasons.join(", ")}`);
      }

      // Verify review exists
      const review = await db
        .selectFrom("restaurant_reviews")
        .select(["id"])
        .where("id", "=", reviewId)
        .executeTakeFirst();

      if (!review) {
        return notFound("Review not found");
      }

      // Check if user already reported this review
      const existingReport = await db
        .selectFrom("reports")
        .select(["id"])
        .where("target_type", "=", "review")
        .where("target_id", "=", reviewId)
        .where("reporter_id", "=", userId)
        .executeTakeFirst();

      if (existingReport) {
        return badRequest("You have already reported this review");
      }

      // Create report
      await db
        .insertInto("reports")
        .values({
          reporter_id: userId,
          target_type: "review",
          target_id: reviewId,
          reason,
          details: details || null,
        })
        .execute();

      return success({
        message: "Report submitted successfully",
      });
    } catch (err) {
      console.error("[restaurants/review-report] Error:", err);
      return error((err as Error).message);
    }
  },
};
