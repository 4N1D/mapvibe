import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";
import { sql } from "kysely";
import { CLOUDFRONT_DOMAIN, S3_PHOTOS_BUCKET } from "../../services/s3";

interface Photo {
  url: string;
  caption?: string;
  id?: string;
}

interface OpeningHours {
  monday?: string;
  tuesday?: string;
  wednesday?: string;
  thursday?: string;
  friday?: string;
  saturday?: string;
  sunday?: string;
}

interface SubmitNewPlaceBody {
  author_id: string;
  restaurant_name: string;
  street_address: string;
  ward?: string;
  city?: string;
  text: string;
  features?: string[];
  photos?: Photo[];
  photo_ids?: string[];
  cuisine_types?: string[];
  price_min?: number;
  price_max?: number;
  phone: string;
  opening_hours: OpeningHours;
}

interface DuplicateCandidate {
  id: string;
  restaurant_name: string | null;
  street_address: string;
  geo_lat: number | null;
  geo_lng: number | null;
  similarity_score: number;
  distance_meters: number | null;
  source: "location_addresses" | "restaurants";
}

const DUPLICATE_THRESHOLD = 0.7;

// Extract house number from street address (e.g., "123 Nguyen Hue" -> "123", "12A/3 Le Loi" -> "12A/3")
const extractHouseNumber = (address: string): string | null => {
  const match = address.trim().match(/^[\d]+[A-Za-z]?(\/[\d]+[A-Za-z]?)*/);
  return match ? match[0] : null;
};

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      let body: SubmitNewPlaceBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const {
        author_id,
        restaurant_name,
        street_address,
        ward,
        city = "TP. Hồ Chí Minh",
        text,
        features = [],
        photos = [],
        photo_ids = [],
        cuisine_types,
        price_min,
        price_max,
        phone,
        opening_hours,
      } = body;

      // Validate required fields
      if (!author_id) {
        return badRequest("author_id is required");
      }
      if (!restaurant_name) {
        return badRequest("restaurant_name is required");
      }
      if (!street_address) {
        return badRequest("street_address is required");
      }
      if (!text) {
        return badRequest("text is required");
      }
      if (text.length < 300) {
        return badRequest("Review text must be at least 300 characters");
      }
      if (!phone) {
        return badRequest("phone is required");
      }
      if (!opening_hours) {
        return badRequest("opening_hours is required");
      }

      // Verify author exists
      const author = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", author_id)
        .executeTakeFirst();

      if (!author) {
        return badRequest("Invalid author_id: user does not exist");
      }

      // Normalize address for exact match comparison
      const normalizedStreetAddress = street_address.toLowerCase().replace(/\s+/g, " ").trim();

      // Phase 1: Duplicate Check using fuzzy name matching (pg_trgm)
      const duplicates: DuplicateCandidate[] = [];

      // Check location_addresses table - fuzzy name/address matching only
      const inputHouseNumber = extractHouseNumber(street_address);
      const locationDuplicates = await sql<DuplicateCandidate>`
        SELECT 
          id,
          restaurant_name,
          street_address,
          geo_lat,
          geo_lng,
          similarity(COALESCE(restaurant_name, ''), ${restaurant_name}) as similarity_score,
          NULL::float as distance_meters,
          'location_addresses'::text as source
        FROM location_addresses
        WHERE status IN ('pending', 'approved')
          AND (
            -- Exact address match (normalized)
            LOWER(REGEXP_REPLACE(street_address, '\s+', ' ', 'g')) = ${normalizedStreetAddress}
            OR
            -- Fuzzy match conditions
            (
              (
                ${inputHouseNumber}::text IS NULL 
                OR (regexp_match(street_address, '^[0-9]+[A-Za-z]?(/[0-9]+[A-Za-z]?)*'))[1] = ${inputHouseNumber}
              )
              AND (
                similarity(COALESCE(restaurant_name, ''), ${restaurant_name}) > ${DUPLICATE_THRESHOLD}
                OR similarity(street_address, ${street_address}) > ${DUPLICATE_THRESHOLD}
              )
            )
          )
        ORDER BY similarity_score DESC
        LIMIT 5
      `.execute(db);

      duplicates.push(...(locationDuplicates.rows as DuplicateCandidate[]));

      // Check restaurants table - fuzzy name/address matching only
      const restaurantDuplicates = await sql<DuplicateCandidate>`
        SELECT 
          id,
          name_vi as restaurant_name,
          address as street_address,
          geo_lat,
          geo_lng,
          similarity(name_vi, ${restaurant_name}) as similarity_score,
          NULL::float as distance_meters,
          'restaurants'::text as source
        FROM restaurants
        WHERE status = 'approved'
          AND (
            -- Exact address match (normalized)
            LOWER(REGEXP_REPLACE(address, '\s+', ' ', 'g')) = ${normalizedStreetAddress}
            OR
            -- Fuzzy match conditions
            (
              (
                ${inputHouseNumber}::text IS NULL 
                OR (regexp_match(address, '^[0-9]+[A-Za-z]?(/[0-9]+[A-Za-z]?)*'))[1] = ${inputHouseNumber}
              )
              AND (
                similarity(name_vi, ${restaurant_name}) > ${DUPLICATE_THRESHOLD}
                OR similarity(address, ${street_address}) > ${DUPLICATE_THRESHOLD}
              )
            )
          )
        ORDER BY similarity_score DESC
        LIMIT 5
      `.execute(db);

      duplicates.push(...(restaurantDuplicates.rows as DuplicateCandidate[]));

      // If any duplicates found (exact match, high similarity, or proximity), return error
      // The SQL query already filters for matching records, so all results are potential duplicates
      if (duplicates.length > 0) {
        return {
          statusCode: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            error: "Potential duplicate location found",
            code: "DUPLICATE_LOCATION",
            message:
              "This location may already exist. Please select an existing place or confirm creation of a new entry.",
            potential_duplicates: duplicates.map((d) => ({
              id: d.id,
              name: d.restaurant_name,
              address: d.street_address,
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

      // Resolve photo IDs - either from photo_ids array or by looking up URLs
      const resolvedPhotoIds: string[] = [...photo_ids];
      const newPhotoRecords: Array<{
        id: string;
        url: string;
        caption?: string;
      }> = [];

      // If photos with URLs are provided (not photo_ids), try to find existing records or create new ones
      if (photos.length > 0 && photo_ids.length === 0) {
        for (const photo of photos) {
          // If photo already has an id, use it
          if (photo.id) {
            resolvedPhotoIds.push(photo.id);
            continue;
          }

          // Try to find existing photo by URL (check both s3_url patterns)
          const existingPhoto = await db
            .selectFrom("photos")
            .select(["id"])
            .where((eb) =>
              eb.or([
                eb("s3_url", "=", photo.url),
                eb("s3_thumbnail_url", "=", photo.url),
              ])
            )
            .executeTakeFirst();

          if (existingPhoto) {
            resolvedPhotoIds.push(existingPhoto.id);
          } else {
            // Create new photo record for this URL
            const photoId = crypto.randomUUID();
            newPhotoRecords.push({
              id: photoId,
              url: photo.url,
              caption: photo.caption,
            });
            resolvedPhotoIds.push(photoId);
          }
        }
      }

      await db.transaction().execute(async (trx) => {
        // Build full address string
        const fullAddress = [street_address, ward, city].filter(Boolean).join(", ");

        // Insert into location_addresses with status = 'pending'
        await sql`
          INSERT INTO location_addresses (
            id,
            restaurant_name,
            street_address,
            ward,
            city,
            full_address,
            status,
            review_count,
            created_by_user_id,
            cuisine_types,
            price_min,
            price_max,
            phone,
            opening_hours,
            created_at,
            updated_at
          ) VALUES (
            ${locationAddressId},
            ${restaurant_name},
            ${street_address},
            ${ward || null},
            ${city},
            ${fullAddress},
            'pending',
            1,
            ${author_id},
            ${cuisine_types ? JSON.stringify(cuisine_types) : null}::json,
            ${price_min || null},
            ${price_max || null},
            ${phone},
            ${JSON.stringify(opening_hours)}::json,
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
            ${sql`ARRAY[${sql.join(
              features.map((f) => sql`${f}`),
              sql`, `
            )}]::varchar[]`},
            ${JSON.stringify(resolvedPhotoIds)}::json,
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

        // Create new photo records in the photos table
        for (const photoRecord of newPhotoRecords) {
          // Determine if the URL is already a CDN URL or needs to be stored as-is
          let s3Url = photoRecord.url;
          
          // If not already a CDN URL, construct one (assuming the URL contains the S3 key)
          if (!photoRecord.url.includes(CLOUDFRONT_DOMAIN) && !photoRecord.url.includes(S3_PHOTOS_BUCKET)) {
            // Keep the original URL as s3_url for now
            s3Url = photoRecord.url;
          }

          await trx
            .insertInto("photos")
            .values({
              id: photoRecord.id,
              location_address_id: locationAddressId,
              restaurant_id: null,
              review_post_id: reviewPostId,
              uploaded_by: author_id,
              photo_type: "review",
              menu_name: null,
              s3_url: s3Url,
              s3_thumbnail_url: null,
              s3_medium_url: null,
              s3_large_url: null,
              is_safe: true,
              is_blurry: false,
              display_order: 0,
              view_count: 0,
            })
            .execute();
        }

        // Update existing photos to link them to the review_post_id and location_address_id
        if (resolvedPhotoIds.length > 0) {
          await trx
            .updateTable("photos")
            .set({
              review_post_id: reviewPostId,
              location_address_id: locationAddressId,
            })
            .where("id", "in", resolvedPhotoIds)
            .execute();
        }
      });

      return success(
        {
          message: "New place and review submitted successfully. Pending moderation.",
          location_address: {
            id: locationAddressId,
            restaurant_name,
            street_address,
            city,
            status: "pending",
          },
          review_post: {
            id: reviewPostId,
            status: "pending",
            photo_ids: resolvedPhotoIds,
          },
          moderation_info: {
            waiting_period_days: 14,
            note: "The location will be reviewed and approved within 14 days.",
          },
        },
        201
      );
    } catch (err) {
      console.error("[reviews/submit-new-place] Error:", err);
      return error((err as Error).message);
    }
  },
};
