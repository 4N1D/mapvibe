import crypto from 'crypto';
import type { APIGatewayEvent, APIGatewayResponse, Handler } from '../../types';
import { getDb } from '../../services/db';
import { success, notFound, badRequest, error } from '../../middlewares/response';
import { recalculateRestaurantRatings } from '../../utils/rating';

interface CreateReviewBody {
  author_id: string;
  text: string;
  photos?: string[];
  rating_service: number;
  rating_location: number;
  rating_price: number;
  rating_quality: number;
  rating_ambiance: number;
  rating_overall: number;
}

// GET /restaurants/:slug/reviews - Fetch reviews list
export const listHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      const params = event.queryStringParameters || {};
      const limit = Math.min(parseInt(params.limit || '20'), 100);
      const offset = parseInt(params.offset || '0');
      const sortBy = params.sort_by || 'created_at';
      const sortOrder = params.sort_order === 'asc' ? 'asc' : 'desc';

      // Build query
      let query = db
        .selectFrom('restaurant_reviews')
        .innerJoin('users', 'users.id', 'restaurant_reviews.author_id')
        .select([
          'restaurant_reviews.id',
          'restaurant_reviews.text',
          'restaurant_reviews.photos',
          'restaurant_reviews.rating_service',
          'restaurant_reviews.rating_location',
          'restaurant_reviews.rating_price',
          'restaurant_reviews.rating_quality',
          'restaurant_reviews.rating_ambiance',
          'restaurant_reviews.rating_overall',
          'restaurant_reviews.upvote_count',
          'restaurant_reviews.comment_count',
          'restaurant_reviews.created_at',
          'users.id as author_id',
          'users.display_name as author_name',
          'users.avatar as author_avatar',
        ])
        .where('restaurant_reviews.restaurant_id', '=', restaurant.id);

      // Apply sorting
      if (sortBy === 'upvote_count') {
        query = query.orderBy('restaurant_reviews.upvote_count', sortOrder);
      } else {
        query = query.orderBy('restaurant_reviews.created_at', sortOrder);
      }

      const reviews = await query.limit(limit).offset(offset).execute();

      // Get total count
      const countResult = await db
        .selectFrom('restaurant_reviews')
        .select((eb) => eb.fn.count('id').as('total'))
        .where('restaurant_id', '=', restaurant.id)
        .executeTakeFirst();

      return success({
        restaurant_id: restaurant.id,
        reviews,
        pagination: {
          limit,
          offset,
          total: Number(countResult?.total || 0),
        },
      });
    } catch (err) {
      console.error('[restaurants/reviews/list] Error:', err);
      return error((err as Error).message);
    }
  },
};

// POST /restaurants/:slug/reviews - Create review
export const createHandler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();
      const slug = event.pathParameters?.slug;

      if (!slug) {
        return badRequest('Restaurant slug is required');
      }

      // Get restaurant by slug
      const restaurant = await db
        .selectFrom('restaurants')
        .select(['id'])
        .where('slug', '=', slug)
        .executeTakeFirst();

      if (!restaurant) {
        return notFound('Restaurant not found');
      }

      let body: CreateReviewBody;
      try {
        body = JSON.parse(event.body || '{}');
      } catch {
        return badRequest('Invalid JSON body');
      }

      const {
        author_id,
        text,
        photos = [],
        rating_service,
        rating_location,
        rating_price,
        rating_quality,
        rating_ambiance,
        rating_overall,
      } = body;

      // Validate required fields
      if (!author_id) {
        return badRequest('author_id is required');
      }

      if (!text || text.trim().length === 0) {
        return badRequest('text is required');
      }

      // Validate ratings (1-10 scale)
      const ratings = [rating_service, rating_location, rating_price, rating_quality, rating_ambiance, rating_overall];
      for (const rating of ratings) {
        if (typeof rating !== 'number' || rating < 1 || rating > 10) {
          return badRequest('All ratings must be numbers between 1 and 10');
        }
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

      // Check if user already has a review for this restaurant
      const existingReview = await db
        .selectFrom('restaurant_reviews')
        .select('id')
        .where('restaurant_id', '=', restaurant.id)
        .where('author_id', '=', author_id)
        .executeTakeFirst();

      if (existingReview) {
        return badRequest('User has already reviewed this restaurant');
      }

      // Create review and increment restaurant.review_count
      const result = await db.transaction().execute(async (trx) => {
        const [review] = await trx
          .insertInto('restaurant_reviews')
          .values({
            id: crypto.randomUUID(),
            restaurant_id: restaurant.id,
            author_id,
            text,
            photos: JSON.stringify(photos),
            rating_service,
            rating_location,
            rating_price,
            rating_quality,
            rating_ambiance,
            rating_overall,
            upvote_count: 0,
            comment_count: 0,
          })
          .returningAll()
          .execute();

        // Increment review_count on restaurant
        await trx
          .updateTable('restaurants')
          .set((eb) => ({
            review_count: eb('review_count', '+', 1),
            updated_at: new Date(),
          }))
          .where('id', '=', restaurant.id)
          .execute();

        return review;
      });

      // Trigger background rating recalculation
      // This runs async and updates the restaurant's average ratings
      recalculateRestaurantRatings(restaurant.id).catch((err) => {
        console.error('[restaurants/reviews/create] Rating recalculation error:', err);
      });

      return success({ review: result }, 201);
    } catch (err) {
      console.error('[restaurants/reviews/create] Error:', err);
      return error((err as Error).message);
    }
  },
};
