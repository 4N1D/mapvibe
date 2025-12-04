import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, error } from '../../middlewares/response';
import { sql } from 'kysely';

const EXPIRY_DAYS = 14;

interface CleanupResult {
  location_address_id: string;
  restaurant_name: string | null;
  reviews_deleted: number;
  photos_deleted: number;
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Find all pending locations older than EXPIRY_DAYS
      const expiredLocations = await sql`
        SELECT 
          id,
          restaurant_name,
          created_at
        FROM location_addresses
        WHERE status = 'pending'
          AND created_at < NOW() - INTERVAL '${sql.raw(String(EXPIRY_DAYS))} days'
      `.execute(db);

      if (expiredLocations.rows.length === 0) {
        return success({
          message: 'No expired pending locations found',
          cleaned_up: 0,
          results: [],
        });
      }

      const cleanupResults: CleanupResult[] = [];

      for (const location of expiredLocations.rows as any[]) {
        const locationId = location.id;

        await db.transaction().execute(async (trx) => {
          // Get review IDs for this location (to clean up photos)
          const reviews = await sql`
            SELECT id FROM review_posts
            WHERE location_address_id = ${locationId}
          `.execute(trx);

          const reviewIds = (reviews.rows as any[]).map(r => r.id);
          let photosDeleted = 0;

          // Delete photos linked only to these reviews
          if (reviewIds.length > 0) {
            const photoDeleteResult = await sql`
              DELETE FROM photos
              WHERE review_post_id = ANY(${reviewIds}::varchar[])
              RETURNING id
            `.execute(trx);
            photosDeleted = photoDeleteResult.rows.length;
          }

          // Delete review posts for this location
          const reviewDeleteResult = await sql`
            DELETE FROM review_posts
            WHERE location_address_id = ${locationId}
            RETURNING id
          `.execute(trx);

          // Delete the location_address record
          await sql`
            DELETE FROM location_addresses
            WHERE id = ${locationId}
          `.execute(trx);

          cleanupResults.push({
            location_address_id: locationId,
            restaurant_name: location.restaurant_name,
            reviews_deleted: reviewDeleteResult.rows.length,
            photos_deleted: photosDeleted,
          });
        });
      }

      const totalReviewsDeleted = cleanupResults.reduce((sum, r) => sum + r.reviews_deleted, 0);
      const totalPhotosDeleted = cleanupResults.reduce((sum, r) => sum + r.photos_deleted, 0);

      return success({
        message: `Cleaned up ${cleanupResults.length} expired pending locations`,
        cleaned_up: cleanupResults.length,
        total_reviews_deleted: totalReviewsDeleted,
        total_photos_deleted: totalPhotosDeleted,
        expiry_days: EXPIRY_DAYS,
        results: cleanupResults,
      });
    } catch (err) {
      console.error('[reviews/cleanup-expired] Error:', err);
      return error((err as Error).message);
    }
  },
};
