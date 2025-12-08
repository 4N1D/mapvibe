import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, error } from "../../middlewares/response";
import { sql } from "kysely";

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || "20"), 100);
      const offset = parseInt(params.offset || "0");
      const restaurantId = params.restaurant_id;

      let query;
      if (restaurantId) {
        query = sql`
          SELECT
            rp.id,
            rp.author_id,
            u.display_name as author_name,
            u.avatar as author_avatar,
            rp.location_address_id,
            rp.text,
            rp.features,
            rp.photos,
            rp.upvote_count,
            rp.downvote_count,
            rp.comment_count,
            rp.share_count,
            rp.view_count,
            rp.created_at,
            la.restaurant_name as location_name,
            la.street_address as location_street_address,
            la.ward as location_ward,
            la.city as location_city,
            la.full_address as location_full_address,
            la.geo_lat as location_geo_lat,
            la.geo_lng as location_geo_lng,
            la.cuisine_types as location_cuisine_types,
            la.price_min as location_price_min,
            la.price_max as location_price_max,
            la.phone as location_phone,
            la.opening_hours as location_opening_hours,
            la.restaurant_id as location_restaurant_id,
            la.review_count as location_review_count,
            la.avg_upvote_rate as location_avg_upvote_rate,
            la.status as location_status
          FROM review_posts rp
          LEFT JOIN users u ON u.id = rp.author_id
          LEFT JOIN location_addresses la ON la.id = rp.location_address_id
          WHERE rp.restaurant_id = ${restaurantId}
          ORDER BY rp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      } else {
        query = sql`
          SELECT
            rp.id,
            rp.author_id,
            u.display_name as author_name,
            u.avatar as author_avatar,
            rp.location_address_id,
            rp.text,
            rp.features,
            rp.photos,
            rp.upvote_count,
            rp.downvote_count,
            rp.comment_count,
            rp.share_count,
            rp.view_count,
            rp.created_at,
            la.restaurant_name as location_name,
            la.street_address as location_street_address,
            la.ward as location_ward,
            la.city as location_city,
            la.full_address as location_full_address,
            la.geo_lat as location_geo_lat,
            la.geo_lng as location_geo_lng,
            la.cuisine_types as location_cuisine_types,
            la.price_min as location_price_min,
            la.price_max as location_price_max,
            la.phone as location_phone,
            la.opening_hours as location_opening_hours,
            la.restaurant_id as location_restaurant_id,
            la.review_count as location_review_count,
            la.avg_upvote_rate as location_avg_upvote_rate,
            la.status as location_status
          FROM review_posts rp
          LEFT JOIN users u ON u.id = rp.author_id
          LEFT JOIN location_addresses la ON la.id = rp.location_address_id
          ORDER BY rp.created_at DESC
          LIMIT ${limit}
          OFFSET ${offset}
        `;
      }

      const result = await query.execute(db);

      return success({
        count: result.rows.length,
        limit,
        offset,
        reviews: result.rows,
      });
    } catch (err) {
      console.error("[reviews/list] Error:", err);
      return error((err as Error).message);
    }
  },
};
