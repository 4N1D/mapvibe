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
    rating: faker.number.float({ min: 3.5, max: 5, fractionDigits: 1 }),
    reviews: faker.number.int({ min: 10, max: 500 }),
    image: `https://images.unsplash.com/photo-${1478749286911 + i}`,
    description: faker.lorem.paragraph(),
    phone: faker.phone.number(),
    matchReason: "Phù hợp tiêu chí",
  }));
};

const allRestaurants = generateRestaurants(6);

// MSW Handlers
export const handlers = [
  // Search API
  http.post("*/api/search", async ({ request }) => {
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
];
