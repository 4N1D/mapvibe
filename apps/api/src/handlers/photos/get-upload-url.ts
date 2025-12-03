import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { getPresignedUploadUrl, generatePhotoKey } from "../../services/s3";
import { success, badRequest, error } from "../../middlewares/response";

type PhotoType = "food" | "interior" | "exterior" | "menu" | "other";

interface GetUploadUrlBody {
  user_id: string;
  photo_type: PhotoType;
  content_type: string;
  restaurant_id?: string;
  location_address_id?: string;
  review_post_id?: string;
}

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: GetUploadUrlBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const {
        user_id,
        photo_type,
        content_type,
        restaurant_id,
        location_address_id,
        review_post_id,
      } = body;

      if (!user_id) {
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

      // Verify user exists
      const user = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", user_id)
        .executeTakeFirst();

      if (!user) {
        return badRequest("Invalid user_id: user does not exist");
      }

      // Generate S3 key
      const extension = ALLOWED_CONTENT_TYPES[content_type];
      const s3Key = generatePhotoKey(user_id, photo_type, extension);

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
          uploaded_by: user_id,
          photo_type,
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
