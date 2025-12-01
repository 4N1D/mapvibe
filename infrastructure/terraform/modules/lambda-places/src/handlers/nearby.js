const { getDb } = require('../services/db');
const { success, badRequest } = require('../middlewares/response');
const { sql } = require('kysely');

async function handle(event) {
  const db = await getDb();
  
  // Parse query parameters
  const params = event.queryStringParameters || {};
  const lat = parseFloat(params.lat);
  const lng = parseFloat(params.lng);
  const radius = Math.min(parseFloat(params.radius) || 5, 50); // km, max 50km
  const limit = Math.min(parseInt(params.limit) || 20, 100);
  
  if (!lat || !lng || isNaN(lat) || isNaN(lng)) {
    return badRequest('Valid lat and lng are required');
  }
  
  // PostGIS distance query
  const places = await sql`
    SELECT 
      id,
      name_vi,
      slug,
      address,
      district,
      geo_lat,
      geo_lng,
      cuisine_types,
      price_min,
      price_max,
      rating_overall,
      review_count,
      ST_Distance(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      ) / 1000 as distance_km
    FROM restaurants
    WHERE status = 'approved'
      AND location IS NOT NULL
      AND ST_DWithin(
        location::geography,
        ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography,
        ${radius * 1000}
      )
    ORDER BY distance_km ASC
    LIMIT ${limit}
  `.execute(db);
  
  return success({
    center: { lat, lng },
    radius_km: radius,
    places: places.rows,
    count: places.rows.length,
  });
}

module.exports = { handle };
