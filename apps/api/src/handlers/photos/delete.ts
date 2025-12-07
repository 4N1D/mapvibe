import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { deleteFromS3 } from "../../services/s3";
import { success, badRequest, notFound, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent, isUserAdmin } from "@/utils/auth";

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const photoId = event.pathParameters?.id;
      if (!photoId) {
        return badRequest("Photo ID is required");
      }

      const db = await getDb();

      const photo = await db
        .selectFrom("photos")
        .select(["id", "s3_url", "uploaded_by"])
        .where("id", "=", photoId)
        .executeTakeFirst();

      if (!photo) {
        return notFound("Photo not found");
      }

      const isOwner = photo.uploaded_by === userId;
      const isAdmin = await isUserAdmin(userId);
      
      if (!isOwner && !isAdmin) {
        return unauthorized("You can only delete your own photos");
      }

      const s3Key = extractS3KeyFromUrl(photo.s3_url);

      if (s3Key) {
        await deleteFromS3(s3Key);
      }

      await db
        .deleteFrom("photos")
        .where("id", "=", photoId)
        .execute();

      return success({ message: "Photo deleted successfully" });
    } catch (err) {
      console.error("[photos/delete] Error:", err);
      return error((err as Error).message);
    }
  },
};

function extractS3KeyFromUrl(url: string): string | null {
  try {
    // URL format: https://cdn.mapvibe.site/photos/user_id/type/filename.jpg
    // or https://s3.amazonaws.com/bucket/key
    const urlObj = new URL(url);
    const path = urlObj.pathname;
    return path.startsWith("/") ? path.slice(1) : path;
  } catch {
    return null;
  }
}
