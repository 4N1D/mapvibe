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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB for background images

interface GetBackgroundUploadUrlBody {
  content_type: string;
  file_size?: number;
}

function generateBackgroundKey(userId: string, extension: string): string {
  const timestamp = Date.now();
  return `backgrounds/${userId}/${timestamp}.${extension}`;
}

// POST /users/me/background - Get presigned URL for background upload and save CDN URL to database
export const getBackgroundUploadUrlHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      let body: GetBackgroundUploadUrlBody;
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

      const user = await db
        .selectFrom('users')
        .select(['id', 'background'])
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return notFound('User not found');
      }

      const extension = ALLOWED_CONTENT_TYPES[content_type];
      const s3Key = generateBackgroundKey(userId, extension);

      const presignedResult = await getPresignedUploadUrl(s3Key, content_type, 300);

      // Pre-save CDN URL to user table so it's available after S3 upload
      await db
        .updateTable('users')
        .set({
          background: presignedResult.cdnUrl,
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
      console.error('[users/me/background] getUploadUrl Error:', err);
      return error((err as Error).message);
    }
  },
};

// PUT /users/me/background - Update background URL after successful upload
export const updateBackgroundHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const userId = getUserIdFromEvent(event);

      if (!userId) {
        return unauthorized('Authentication required');
      }

      let body: { background_url: string };
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const { background_url } = body;

      if (!background_url) {
        return badRequest('background_url is required');
      }

      try {
        new URL(background_url);
      } catch {
        return badRequest('Invalid background_url format');
      }

      const db = await getDb();

      const updatedUser = await db
        .updateTable('users')
        .set({
          background: background_url,
          updated_at: new Date(),
        })
        .where('id', '=', userId)
        .returning(['id', 'background', 'updated_at'])
        .executeTakeFirst();

      if (!updatedUser) {
        return notFound('User not found');
      }

      return success({
        message: 'Background updated successfully',
        background: updatedUser.background,
      });
    } catch (err) {
      console.error('[users/me/background] updateBackground Error:', err);
      return error((err as Error).message);
    }
  },
};
