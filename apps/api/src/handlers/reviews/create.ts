import crypto from "crypto";
import type { APIGatewayEvent, APIGatewayResponse, Handler } from "../../types";
import { getDb } from "../../services/db";
import { success, badRequest, error } from "../../middlewares/response";

interface Photo {
  url: string;
  caption?: string;
}

interface CreateReviewBody {
  author_id: string;
  location_address_id?: string;
  restaurant_id?: string;
  text: string;
  features?: string[];
  photos?: Photo[];
}

export const handler: Handler = {
  async handle(event: APIGatewayEvent): Promise<APIGatewayResponse> {
    try {
      const db = await getDb();

      // Parse body
      let body: CreateReviewBody;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return badRequest("Invalid JSON body");
      }

      const {
        author_id,
        location_address_id,
        restaurant_id,
        text,
        features = [],
        photos = [],
      } = body;

      // Validate required fields
      if (!author_id) {
        return badRequest("author_id is required");
      }

      if (!location_address_id && !restaurant_id) {
        return badRequest("Either location_address_id or restaurant_id is required");
      }

      if (!text) {
        return badRequest("text is required");
      }

      if (text.length < 100) {
        return badRequest("Review text must be at least 100 characters");
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

      // Verify restaurant exists if provided
      if (restaurant_id) {
        const restaurant = await db
          .selectFrom("restaurants")
          .select("id")
          .where("id", "=", restaurant_id)
          .executeTakeFirst();

        if (!restaurant) {
          return badRequest("Invalid restaurant_id: restaurant does not exist");
        }
      }

      // Verify location_address exists if provided
      if (location_address_id) {
        const location = await db
          .selectFrom("location_addresses")
          .select("id")
          .where("id", "=", location_address_id)
          .executeTakeFirst();

        if (!location) {
          return badRequest("Invalid location_address_id: location does not exist");
        }
      }

      // Check if user already has a review for this place (restaurant or location)
      let existingReviewQuery = db
        .selectFrom("review_posts")
        .selectAll()
        .where("author_id", "=", author_id);

      if (restaurant_id) {
        existingReviewQuery = existingReviewQuery.where("restaurant_id", "=", restaurant_id);
      } else if (location_address_id) {
        existingReviewQuery = existingReviewQuery.where(
          "location_address_id",
          "=",
          location_address_id
        );
      }

      const existingReview = await existingReviewQuery.executeTakeFirst();

      if (existingReview) {
        // Update existing review instead of creating a new one
        const [updatedReview] = await db
          .updateTable("review_posts")
          .set({
            text,
            features,
            photos: JSON.stringify(photos),
            updated_at: new Date(),
          })
          .where("id", "=", existingReview.id)
          .returningAll()
          .execute();

        return success({ review: updatedReview, updated: true }, 200);
      }

      // Create new review post (first review for this place)
      const [review] = await db
        .insertInto("review_posts")
        .values({
          id: crypto.randomUUID(),
          author_id,
          location_address_id: location_address_id ?? null,
          restaurant_id: restaurant_id ?? null,
          text,
          features,
          photos: JSON.stringify(photos),
          upvote_count: 0,
          downvote_count: 0,
          view_count: 0,
          comment_count: 0,
          share_count: 0,
          status: "published",
        })
        .returningAll()
        .execute();

      return success({ review, updated: false }, 201);
    } catch (err) {
      console.error("[reviews/create] Error:", err);
      return error((err as Error).message);
    }
  },
};
