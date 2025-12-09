import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { getPresignedUploadUrl, generatePhotoKey } from "../../services/s3";
import { success, badRequest, unauthorized, error } from "../../middlewares/response";
import { getUserIdFromEvent } from "@/utils/auth";

type PhotoType = "food" | "view" | "menu" | "review" | "user_avatar" | "user_background";

interface GetUploadUrlBody {
  photo_type: PhotoType;
  content_type: string;
  file_size?: number;
  restaurant_id?: string;
  location_address_id?: string;
  review_post_id?: string;
  menu_name?: string;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);
      if (!userId) {
        return unauthorized("Authentication required");
      }

      const db = await getDb();

      let body: GetUploadUrlBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const {
        photo_type,
        content_type,
        file_size,
        restaurant_id,
        location_address_id,
        review_post_id,
        menu_name,
      } = body;

      if (!userId) {
        return badRequest("user_id is required");
      }

      if (!photo_type) {
        return badRequest("photo_type is required");
      }

      if (!content_type || !ALLOWED_CONTENT_TYPES[content_type]) {
        return badRequest(
          `Invalid content_type. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(", ")}`
        );
      }

      if (typeof file_size === "number") {
        if (file_size < 0) {
          return badRequest("file_size must be a positive number");
        }

        if (file_size > MAX_FILE_SIZE) {
          return badRequest(`File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
      }

      // Verify user exists
      const user = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", userId)
        .executeTakeFirst();

      if (!user) {
        return badRequest("Invalid user_id: user does not exist");
      }

      // Generate S3 key
      const extension = ALLOWED_CONTENT_TYPES[content_type];
      const s3Key = generatePhotoKey(userId, photo_type, extension);

      // Get presigned URL (5 minutes expiry)
      const presignedResult = await getPresignedUploadUrl(s3Key, content_type, 300);

      // Create pending photo record in database
      const photoId = crypto.randomUUID();
      await db
        .insertInto("photos")
        .values({
          id: photoId,
          location_address_id: location_address_id ?? null,
          restaurant_id: restaurant_id ?? null,
          review_post_id: review_post_id ?? null,
          uploaded_by: userId,
          photo_type,
          menu_name: photo_type === "menu" ? (menu_name ?? null) : null,
          s3_url: presignedResult.cdnUrl,
          s3_thumbnail_url: null,
          s3_medium_url: null,
          s3_large_url: null,
          is_safe: true,
          is_blurry: false,
          display_order: 0,
          view_count: 0,
        })
        .execute();

      return success({
        photo_id: photoId,
        upload_url: presignedResult.uploadUrl,
        cdn_url: presignedResult.cdnUrl,
        s3_key: presignedResult.s3Key,
        expires_in: presignedResult.expiresIn,
        content_type,
      });
    } catch (err) {
      console.error("[photos/get-upload-url] Error:", err);
      return error((err as Error).message);
    }
  },
};
