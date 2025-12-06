import { http, HttpResponse, passthrough } from "msw";
import { faker } from "@faker-js/faker";

const USE_MOCK_SEARCH = import.meta.env.VITE_USE_MOCK_SEARCH === "true";

// Generate mock restaurants
const generateRestaurants = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    slug: faker.helpers.slugify(faker.company.name()).toLowerCase(),
    name: faker.company.name(),
    address: faker.location.streetAddress(),
    priceRange: `${faker.number.int({ min: 20, max: 50 })}k - ${faker.number.int({
      min: 100,
      max: 200,
    })}k`,
    hours: "8:00 - 22:00",
    rating: faker.number.float({ min: 0, max: 10, fractionDigits: 1 }),
    reviews: faker.number.int({ min: 10, max: 500 }),
    image: `https://images.unsplash.com/photo-${1478749286911 + i}`,
    description: faker.lorem.paragraph(),
    phone: faker.phone.number(),
    matchReason: "Phù hợp tiêu chí",
  }));
};

const allRestaurants = generateRestaurants(6);

// Generate mock comments
const generateComments = (count: number, withReplies = true) => {
  return Array.from({ length: count }, (_, i) => {
    const hasReplies = withReplies && Math.random() > 0.5;
    return {
      id: `comment-${i + 1}`,
      author_id: `user-${i + 1}`,
      author_name: faker.person.fullName(),
      author_avatar: null,
      restaurant_id: "1",
      content: faker.lorem.sentences({ min: 1, max: 3 }),
      like_count: faker.number.int({ min: 0, max: 50 }),
      created_at: faker.date.recent({ days: 14 }).toISOString(),
      replies: hasReplies
        ? Array.from({ length: faker.number.int({ min: 1, max: 3 }) }, (_, j) => ({
            id: `comment-${i + 1}-reply-${j + 1}`,
            author_id: `user-reply-${j + 1}`,
            author_name: faker.person.fullName(),
            author_avatar: null,
            restaurant_id: "1",
            content: faker.lorem.sentences({ min: 1, max: 2 }),
            like_count: faker.number.int({ min: 0, max: 20 }),
            created_at: faker.date.recent({ days: 7 }).toISOString(),
            parent_id: `comment-${i + 1}`,
            reply_to_name: faker.person.firstName(),
          }))
        : [],
    };
  });
};

// Store comments in memory for POST simulation
const commentsStore = { data: generateComments(8) };

// Generate mock restaurant reviews
const generateRestaurantReviews = (count: number) => {
  return Array.from({ length: count }, (_, i) => ({
    id: `review-${i + 1}`,
    author_id: `user-${i + 1}`,
    author_name: faker.person.fullName(),
    author_avatar: null,
    restaurant_id: 1,
    content: faker.lorem.sentences({ min: 2, max: 5 }),
    ratings: {
      quality: faker.number.int({ min: 5, max: 10 }),
      service: faker.number.int({ min: 5, max: 10 }),
      location: faker.number.int({ min: 5, max: 10 }),
      price: faker.number.int({ min: 5, max: 10 }),
      ambiance: faker.number.int({ min: 5, max: 10 }),
    },
    overall_rating: faker.number.float({ min: 5, max: 10, fractionDigits: 1 }),
    photos: faker.datatype.boolean()
      ? Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, (_, j) => ({
          url: `https://images.unsplash.com/photo-${1546069901 + i * 1000 + j * 100}-ba9599a7e63c?w=400`,
          caption: faker.lorem.sentence(),
        }))
      : [],
    like_count: faker.number.int({ min: 0, max: 100 }),
    comment_count: faker.number.int({ min: 0, max: 20 }),
    created_at: faker.date.recent({ days: 30 }).toISOString(),
  }));
};

// Store restaurant reviews
const reviewsStore = { data: generateRestaurantReviews(12) };

// Generate mock hot reviews
const generateHotReviews = (count: number) => {
  const tags: Array<"hot" | "new" | "normal" | "trending"> = ["hot", "trending", "new", "normal"];
  return Array.from({ length: count }, (_, i) => ({
    id: `review-${i + 1}`,
    author_id: `user-${i + 1}`,
    author_name: faker.person.fullName(),
    restaurant_id: `${i + 1}`,
    text: faker.lorem.sentences({ min: 2, max: 4 }),
    photos: [
      {
        url: `https://images.unsplash.com/photo-${1546069901 + i * 1000}-ba9599a7e63c?w=400`,
        caption: faker.lorem.sentence(),
      },
    ],
    upvote_count: faker.number.int({ min: 5, max: 150 }),
    downvote_count: faker.number.int({ min: 0, max: 10 }),
    comment_count: faker.number.int({ min: 0, max: 30 }),
    share_count: faker.number.int({ min: 0, max: 20 }),
    view_count: faker.number.int({ min: 50, max: 500 }),
    created_at: faker.date.recent({ days: 7 }).toISOString(),
    score: faker.number.float({ min: 0.01, max: 0.1, fractionDigits: 3 }).toString(),
    tag: tags[i % tags.length],
  }));
};

// MSW Handlers
export const handlers = [
  // Search API
  http.post("*/search", async ({ request }) => {
    // Nếu không dùng mock → cho real API xử lý
    if (!USE_MOCK_SEARCH) {
      return passthrough();
    }

    const body = (await request.json()) as any;
    const results = allRestaurants.slice(0, 10);

    return HttpResponse.json({
      message: "Kết quả tìm kiếm (MOCK)",
      current_context: body.query,
      restaurants: results,
    });
  }),

  // Get single restaurant by slug
  http.get("/api/place/:slug", ({ params }) => {
    const { slug } = params;
    const restaurant = allRestaurants.find((r) => r.slug === slug);

    if (!restaurant) {
      return HttpResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    return HttpResponse.json({
      ...restaurant,
      images: [
        "https://images.unsplash.com/photo-1567521464027-f127ff144326",
        "https://images.unsplash.com/photo-1546069901-ba9599a7e63c",
        "https://images.unsplash.com/photo-1504674900969-f59bef43f58e",
      ],
      reviews: [
        {
          id: 1,
          author: faker.person.fullName(),
          rating: 5,
          text: faker.lorem.paragraph(),
          date: faker.date.past(),
        },
        {
          id: 2,
          author: faker.person.fullName(),
          rating: 4,
          text: faker.lorem.paragraph(),
          date: faker.date.past(),
        },
      ],
    });
  }),

  // Get all restaurants (cho Featured/Explore tabs)
  http.get("/api/place", () => {
    return HttpResponse.json({
      restaurants: allRestaurants.slice(0, 12),
    });
  }),

  // Hot reviews API
  http.get("*/reviews/hot", () => {
    const reviews = generateHotReviews(6);
    return HttpResponse.json({
      restaurant_id: null,
      count: reviews.length,
      reviews,
    });
  }),

  // Restaurant Reviews API - GET
  http.get("*/reviews/restaurant/:restaurantId", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedReviews = reviewsStore.data.slice(start, end);

    return HttpResponse.json({
      restaurant_id: 1,
      total: reviewsStore.data.length,
      page,
      limit,
      total_pages: Math.ceil(reviewsStore.data.length / limit),
      reviews: paginatedReviews,
    });
  }),

  // Restaurant Reviews API - POST
  http.post("*/reviews", async ({ request }) => {
    const body = (await request.json()) as {
      restaurant_id: number;
      content: string;
      ratings: Record<string, number>;
      overall_rating: number;
    };

    const newReview = {
      id: `review-${Date.now()}`,
      author_id: "current-user",
      author_name: "Bạn",
      author_avatar: null,
      restaurant_id: body.restaurant_id,
      content: body.content,
      ratings: body.ratings,
      overall_rating: body.overall_rating,
      photos: [],
      like_count: 0,
      comment_count: 0,
      created_at: new Date().toISOString(),
    };

    reviewsStore.data.unshift(newReview);
    return HttpResponse.json(newReview);
  }),

  // Comments API - GET
  http.get("*/comments/:restaurantId", ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "10");

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedComments = commentsStore.data.slice(start, end);

    return HttpResponse.json({
      restaurant_id: "1",
      total: commentsStore.data.length,
      page,
      limit,
      total_pages: Math.ceil(commentsStore.data.length / limit),
      comments: paginatedComments,
    });
  }),

  // Comments API - POST
  http.post("*/comments", async ({ request }) => {
    const body = (await request.json()) as {
      restaurant_id: string;
      content: string;
      parent_id?: string | null;
    };

    const newComment = {
      id: `comment-${Date.now()}`,
      author_id: "current-user",
      author_name: "Bạn",
      author_avatar: null,
      restaurant_id: body.restaurant_id,
      content: body.content,
      like_count: 0,
      created_at: new Date().toISOString(),
      replies: [],
      parent_id: body.parent_id || undefined,
    };

    if (body.parent_id) {
      // Add as reply
      const parentComment = commentsStore.data.find((c) => c.id === body.parent_id);
      if (parentComment) {
        parentComment.replies.push({
          id: newComment.id,
          author_id: newComment.author_id,
          author_name: newComment.author_name,
          author_avatar: null,
          restaurant_id: newComment.restaurant_id,
          content: newComment.content,
          like_count: 0,
          created_at: newComment.created_at,
          parent_id: body.parent_id,
          reply_to_name: parentComment.author_name,
        });
      }
    } else {
      // Add as new comment
      commentsStore.data.unshift(newComment);
    }

    return HttpResponse.json(newComment);
  }),
];
