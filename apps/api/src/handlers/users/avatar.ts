import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { getPresignedUploadUrl } from '../../services/s3';
import { success, badRequest, unauthorized, notFound, error } from '../../middlewares/response';
import { getUserIdFromEvent } from '@/utils/auth';

const ALLOWED_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

interface GetAvatarUploadUrlBody {
  content_type: string;
  file_size?: number;
}

function generateAvatarKey(userId: string, extension: string): string {
  const timestamp = Date.now();
  return `avatars/${userId}/${timestamp}.${extension}`;
}

// POST /users/me/avatar - Get presigned URL for avatar upload
export const getUploadUrlHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      let body: GetAvatarUploadUrlBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { content_type, file_size } = body;

      if (!content_type || !ALLOWED_CONTENT_TYPES[content_type]) {
        return badRequest(
          `Invalid content_type. Allowed: ${Object.keys(ALLOWED_CONTENT_TYPES).join(', ')}`
        );
      }

      if (typeof file_size === 'number') {
        if (file_size < 0) {
          return badRequest('file_size must be a positive number');
        }
        if (file_size > MAX_FILE_SIZE) {
          return badRequest(`File too large. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
        }
      }

      const db = await getDb();

      // Verify user exists
      const user = await db
        .selectFrom('users')
        .select(['id', 'avatar'])
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return notFound('User not found');
      }

      // Generate S3 key for avatar
      const extension = ALLOWED_CONTENT_TYPES[content_type];
      const s3Key = generateAvatarKey(userId, extension);

      // Get presigned URL (5 minutes expiry)
      const presignedResult = await getPresignedUploadUrl(s3Key, content_type, 300);

      // Pre-save CDN URL to user table so it's available after S3 upload
      await db
        .updateTable('users')
        .set({
          avatar: presignedResult.cdnUrl,
          updated_at: new Date(),
        })
        .where('id', '=', userId)
        .execute();

      return success({
        upload_url: presignedResult.uploadUrl,
        cdn_url: presignedResult.cdnUrl,
        s3_key: presignedResult.s3Key,
        expires_in: presignedResult.expiresIn,
        content_type,
      });
    } catch (err) {
      console.error('[users/me/avatar] getUploadUrl Error:', err);
      return error((err as Error).message);
    }
  },
};

// PUT /users/me/avatar - Update avatar URL after successful upload
export const updateAvatarHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      let body: { avatar_url: string };
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { avatar_url } = body;

      if (!avatar_url) {
        return badRequest('avatar_url is required');
      }

      // Basic URL validation
      try {
        new URL(avatar_url);
      } catch {
        return badRequest('Invalid avatar_url format');
      }

      const db = await getDb();

      const updatedUser = await db
        .updateTable('users')
        .set({
          avatar: avatar_url,
          updated_at: new Date(),
        })
        .where('id', '=', userId)
        .returning(['id', 'avatar', 'updated_at'])
        .executeTakeFirst();

      if (!updatedUser) {
        return notFound('User not found');
      }

      return success({
        message: 'Avatar updated successfully',
        avatar: updatedUser.avatar,
      });
    } catch (err) {
      console.error('[users/me/avatar] updateAvatar Error:', err);
      return error((err as Error).message);
    }
  },
};
