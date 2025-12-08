import { getDb } from "@/services/db";
import { getUserIdFromEvent, getClientIp } from "@/utils/auth";
import { success, badRequest, error } from "@/middlewares/response";
import { Handler, APIGatewayResponse, APIGatewayEvent } from "@/types";

interface LogActivityBody {
  activity_type: string;
  target_type?: string;
  target_id?: string;
  metadata?: Record<string, unknown>;
  page_url?: string;
  referrer?: string;
  session_id?: string;
}

const VALID_ACTIVITY_TYPES = [
  "login",
  "logout",
  "register",
  "view_place",
  "view_review",
  "view_profile",
  "search",
  "search_nearby",
  "create_review",
  "edit_review",
  "delete_review",
  "create_comment",
  "edit_comment",
  "delete_comment",
  "like",
  "unlike",
  "report",
  "share",
  "upload_photo",
  "delete_photo",
  "follow",
  "unfollow",
  "update_profile",
  "update_avatar",
  "page_view",
  "other",
];

// POST /activities - Log user activity
export const logActivityHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      let body: LogActivityBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const { activity_type, target_type, target_id, metadata, page_url, referrer, session_id } =
        body;

      if (!activity_type || !VALID_ACTIVITY_TYPES.includes(activity_type)) {
        return badRequest(`Invalid activity_type. Valid types: ${VALID_ACTIVITY_TYPES.join(", ")}`);
      }

      const ipAddress = getClientIp(event);
      const userAgent = event.headers?.["User-Agent"] || event.headers?.["user-agent"] || null;

      await db
        .insertInto("user_activities")
        .values({
          user_id: userId || null,
          session_id: session_id || null,
          activity_type: activity_type as (typeof VALID_ACTIVITY_TYPES)[number],
          target_type: target_type || null,
          target_id: target_id || null,
          metadata: metadata ? JSON.stringify(metadata) : "{}",
          ip_address: ipAddress,
          user_agent: userAgent,
          referrer: referrer || null,
          page_url: page_url || null,
        })
        .execute();

      return success({ success: true });
    } catch (err) {
      console.error("[activities/log] Error:", err);
      return error((err as Error).message);
    }
  },
};

// POST /activities/batch - Log multiple activities at once
export const batchLogActivityHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const userId = getUserIdFromEvent(event);

      let body: { activities: LogActivityBody[] };
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      if (!body.activities || !Array.isArray(body.activities) || body.activities.length === 0) {
        return badRequest("activities array is required");
      }

      if (body.activities.length > 50) {
        return badRequest("Maximum 50 activities per batch");
      }

      const ipAddress = getClientIp(event);
      const userAgent = event.headers?.["User-Agent"] || event.headers?.["user-agent"] || null;

      const validActivities = body.activities.filter(
        (a) => a.activity_type && VALID_ACTIVITY_TYPES.includes(a.activity_type)
      );

      if (validActivities.length > 0) {
        await db
          .insertInto("user_activities")
          .values(
            validActivities.map((activity) => ({
              user_id: userId || null,
              session_id: activity.session_id || null,
              activity_type: activity.activity_type as (typeof VALID_ACTIVITY_TYPES)[number],
              target_type: activity.target_type || null,
              target_id: activity.target_id || null,
              metadata: activity.metadata ? JSON.stringify(activity.metadata) : "{}",
              ip_address: ipAddress,
              user_agent: userAgent,
              referrer: activity.referrer || null,
              page_url: activity.page_url || null,
            }))
          )
          .execute();
      }

      return success({
        success: true,
        logged: validActivities.length,
        skipped: body.activities.length - validActivities.length,
      });
    } catch (err) {
      console.error("[activities/batch] Error:", err);
      return error((err as Error).message);
    }
  },
};

export { logActivityHandler as logHandler, batchLogActivityHandler as batchHandler };
