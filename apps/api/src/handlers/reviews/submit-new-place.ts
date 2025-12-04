import crypto from 'crypto';
import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, badRequest, error } from '../../middlewares/response';
import { sql } from 'kysely';

interface Photo {
  url: string;
  caption?: string;
}

interface SubmitNewPlaceBody {
  author_id: string;
  restaurant_name: string;
  street_address: string;
  ward?: string;
  district: string;
  city?: string;
  geo_lat: number;
  geo_lng: number;
  text: string;
  features?: string[];
  photos?: Photo[];
}

interface DuplicateCandidate {
  id: string;
  restaurant_name: string | null;
  street_address: string;
  district: string;
  geo_lat: number | null;
  geo_lng: number | null;
  similarity_score: number;
  distance_meters: number | null;
  source: 'location_addresses' | 'restaurants';
}

const DUPLICATE_THRESHOLD = 0.7;
const PROXIMITY_METERS = 100;

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: SubmitNewPlaceBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const {
        author_id,
        restaurant_name,
        street_address,
        ward,
        district,
        city = 'TP. Hồ Chí Minh',
        geo_lat,
        geo_lng,
        text,
        features = [],
        photos = [],
      } = body;

      // Validate required fields
      if (!author_id) {
        return badRequest('author_id is required');
      }
      if (!restaurant_name) {
        return badRequest('restaurant_name is required');
      }
      if (!street_address) {
        return badRequest('street_address is required');
      }
      if (!district) {
        return badRequest('district is required');
      }
      if (geo_lat == null || geo_lng == null) {
        return badRequest('geo_lat and geo_lng are required');
      }
      if (!text) {
        return badRequest('text is required');
      }
      if (text.length < 100) {
        return badRequest('Review text must be at least 100 characters');
      }

      // Verify author exists
      const author = await db
        .selectFrom('users')
        .select('id')
        .where('id', '=', author_id)
        .executeTakeFirst();

      if (!author) {
        return badRequest('Invalid author_id: user does not exist');
      }

      // Phase 1: Duplicate Check using fuzzy name matching (pg_trgm) and geospatial proximity (ST_DWithin)
      const duplicates: DuplicateCandidate[] = [];

      // Check location_addresses table
      const locationDuplicates = await sql<DuplicateCandidate>`
        SELECT 
          id,
          restaurant_name,
          street_address,
          district,
          geo_lat,
          geo_lng,
          similarity(COALESCE(restaurant_name, ''), ${restaurant_name}) as similarity_score,
          CASE 
            WHEN location IS NOT NULL THEN
              ST_Distance(
                location::geography,
                ST_SetSRID(ST_MakePoint(${geo_lng}, ${geo_lat}), 4326)::geography
              )
            ELSE NULL
          END as distance_meters,
          'location_addresses'::text as source
        FROM location_addresses
        WHERE status IN ('pending', 'approved')
          AND (
            similarity(COALESCE(restaurant_name, ''), ${restaurant_name}) > ${DUPLICATE_THRESHOLD}
            OR (
              location IS NOT NULL 
              AND ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(${geo_lng}, ${geo_lat}), 4326)::geography,
                ${PROXIMITY_METERS}
              )
            )
          )
        ORDER BY similarity_score DESC
        LIMIT 5
      `.execute(db);

      duplicates.push(...(locationDuplicates.rows as DuplicateCandidate[]));

      // Check restaurants table
      const restaurantDuplicates = await sql<DuplicateCandidate>`
        SELECT 
          id,
          name_vi as restaurant_name,
          address as street_address,
          district,
          geo_lat,
          geo_lng,
          similarity(name_vi, ${restaurant_name}) as similarity_score,
          CASE 
            WHEN location IS NOT NULL THEN
              ST_Distance(
                location::geography,
                ST_SetSRID(ST_MakePoint(${geo_lng}, ${geo_lat}), 4326)::geography
              )
            ELSE NULL
          END as distance_meters,
          'restaurants'::text as source
        FROM restaurants
        WHERE status = 'approved'
          AND (
            similarity(name_vi, ${restaurant_name}) > ${DUPLICATE_THRESHOLD}
            OR (
              location IS NOT NULL 
              AND ST_DWithin(
                location::geography,
                ST_SetSRID(ST_MakePoint(${geo_lng}, ${geo_lat}), 4326)::geography,
                ${PROXIMITY_METERS}
              )
            )
          )
        ORDER BY similarity_score DESC
        LIMIT 5
      `.execute(db);

      duplicates.push(...(restaurantDuplicates.rows as DuplicateCandidate[]));

      // If duplicates found with score > 0.7, return error with potential duplicates
      const highScoreDuplicates = duplicates.filter(d => 
        d.similarity_score > DUPLICATE_THRESHOLD || 
        (d.distance_meters != null && d.distance_meters < PROXIMITY_METERS)
      );

      if (highScoreDuplicates.length > 0) {
        return {
          statusCode: 400,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            error: 'Potential duplicate location found',
            code: 'DUPLICATE_LOCATION',
            message: 'This location may already exist. Please select an existing place or confirm creation of a new entry.',
            potential_duplicates: highScoreDuplicates.map(d => ({
              id: d.id,
              name: d.restaurant_name,
              address: d.street_address,
              district: d.district,
              similarity_score: Number(d.similarity_score).toFixed(2),
              distance_meters: d.distance_meters ? Math.round(d.distance_meters) : null,
              source: d.source,
            })),
          }),
        };
      }

      // Phase 2: Create pending records in a transaction
      const locationAddressId = crypto.randomUUID();
      const reviewPostId = crypto.randomUUID();

      await db.transaction().execute(async (trx) => {
        // Insert into location_addresses with status = 'pending'
        await sql`
          INSERT INTO location_addresses (
            id,
            restaurant_name,
            street_address,
            ward,
            district,
            city,
            full_address,
            geo_lat,
            geo_lng,
            location,
            status,
            review_count,
            created_by_user_id,
            created_at,
            updated_at
          ) VALUES (
            ${locationAddressId},
            ${restaurant_name},
            ${street_address},
            ${ward || null},
            ${district},
            ${city},
            ${`${street_address}, ${ward ? ward + ', ' : ''}${district}, ${city}`},
            ${geo_lat},
            ${geo_lng},
            ST_SetSRID(ST_MakePoint(${geo_lng}, ${geo_lat}), 4326),
            'pending',
            1,
            ${author_id},
            NOW(),
            NOW()
          )
        `.execute(trx);

        // Insert into review_posts with status = 'pending', restaurant_id = NULL
        await sql`
          INSERT INTO review_posts (
            id,
            author_id,
            location_address_id,
            restaurant_id,
            text,
            features,
            photos,
            upvote_count,
            downvote_count,
            upvote_rate,
            status,
            view_count,
            comment_count,
            share_count,
            created_at,
            updated_at
          ) VALUES (
            ${reviewPostId},
            ${author_id},
            ${locationAddressId},
            NULL,
            ${text},
            ${sql`ARRAY[${sql.join(features.map(f => sql`${f}`), sql`, `)}]::varchar[]`},
            ${JSON.stringify(photos)}::json,
            0,
            0,
            0.00,
            'published',
            0,
            0,
            0,
            NOW(),
            NOW()
          )
        `.execute(trx);
      });

      return success({
        message: 'New place and review submitted successfully. Pending moderation.',
        location_address: {
          id: locationAddressId,
          restaurant_name,
          street_address,
          district,
          city,
          status: 'pending',
        },
        review_post: {
          id: reviewPostId,
          status: 'pending',
        },
        moderation_info: {
          waiting_period_days: 14,
          note: 'The location will be reviewed and approved within 14 days.',
        },
      }, 201);
    } catch (err) {
      console.error('[reviews/submit-new-place] Error:', err);
      return error((err as Error).message);
    }
  },
};
