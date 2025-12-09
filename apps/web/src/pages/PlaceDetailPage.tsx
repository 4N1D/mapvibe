import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "@/lib/axios";
import { ArrowLeft } from "lucide-react";
import {
  CommentsTab,
  ImageGalleryPreview,
  IntroductionTab,
  MenuTab,
  PhotosTab,
  RestaurantInfo,
  ReviewsTab,
} from "@/features/place";
import { MapVibeLoader } from "@/components/common/MapVibeLoader";

// Helper function to fix CDN URL (replace wrong domain with correct one)
const fixCdnUrl = (url: string): string => {
  const correctCdnDomain = import.meta.env.VITE_CLOUDFRONT_URL || "https://dxuh8yivsgocq.cloudfront.net";
  return url.replace(/https:\/\/d[a-z0-9]+\.cloudfront\.net/i, correctCdnDomain);
};

// Fix all CDN URLs in an array
const fixCdnUrls = (urls?: string[]): string[] => {
  if (!urls) return [];
  return urls.map(fixCdnUrl);
};

interface CuisineType {
  name: string;
  description?: string;
}

interface RestaurantData {
  id: string;
  name: string;
  slug: string;
  address: string;
  ward?: string;
  phone?: string;
  opening_hours?: string;
  geo_lat?: number;
  geo_lng?: number;
  rating_overall?: number;
  rating_price?: number;
  rating_ambiance?: number;
  rating_quality?: number;
  rating_service?: number;
  rating_location?: number;
  review_count?: number;
  features?: string[];
  cuisine_types?: CuisineType[] | string;
  price_min?: number;
  price_max?: number;
  description?: string;
  images?: string[];
}

export function PlaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<RestaurantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("gioi-thieu");

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<RestaurantData>(`/restaurants/${slug}/info`);
        setRestaurant(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchRestaurant();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <MapVibeLoader size="lg" text="Đang tải thông tin địa điểm..." />
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">{"Không tìm thấy quán"}</p>
        <Link
          to="/"
          className="text-primary-500 hover:underline"
        >
          ← Quay về trang chủ
        </Link>
      </div>
    );
  }

  // Parse cuisine_types from API (can be JSON string or array)
  const parseCuisineTypes = (): CuisineType[] => {
    if (!restaurant?.cuisine_types) return [];
    if (typeof restaurant.cuisine_types === "string") {
      try {
        return JSON.parse(restaurant.cuisine_types);
      } catch {
        return [];
      }
    }
    return restaurant.cuisine_types;
  };

  // Format price range
  const formatPriceRange = (): string => {
    if (!restaurant?.price_min && !restaurant?.price_max) return "Chưa có thông tin";
    const min = restaurant.price_min
      ? `${restaurant.price_min.toLocaleString("vi-VN")} vnđ`
      : "";
    const max = restaurant.price_max
      ? `${restaurant.price_max.toLocaleString("vi-VN")} vnđ`
      : "";
    if (min && max) return `${min} - ${max}`;
    return min || max;
  };

  // Parse features from API (can be JSON string, array, or PostgreSQL array format)
  const parseFeatures = (): string[] => {
    if (!restaurant?.features) return [];
    if (Array.isArray(restaurant.features)) return restaurant.features;
    if (typeof restaurant.features === "string") {
      try {
        return JSON.parse(restaurant.features);
      } catch {
        return [];
      }
    }
    return [];
  };

  // Map features to display names
  const featureLabels: Record<string, string> = {
    wifi: "Wifi miễn phí",
    parking: "Giữ xe miễn phí",
    air_con: "Máy lạnh",
    credit_card: "Thanh toán thẻ",
    delivery: "Giao hàng",
    outdoor: "Chỗ ngồi ngoài trời",
  };

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "gioi-thieu":
        return (
          <IntroductionTab
            services={parseFeatures().map((f) => featureLabels[f] || f)}
            cuisineTypes={parseCuisineTypes()}
            similarPlaces={[]}
            address={restaurant?.address || ""}
            lat={restaurant?.geo_lat}
            lng={restaurant?.geo_lng}
          />
        );

      case "binh-luan":
        return <CommentsTab restaurantId={restaurant.id} slug={slug} />;

      case "nhan-xet":
        return <ReviewsTab restaurantId={restaurant.id} slug={slug} />;

      case "anh":
        return <PhotosTab slug={slug} />;

      case "thuc-don":
        return <MenuTab slug={slug} />;

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back button */}
      <Link
        to="/"
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-primary-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      {/* Main Content Area: Hero Image & Info */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Hero Image - Left on Desktop (5 cols) */}
        <section className="lg:order-1 lg:col-span-5">
          <div className="h-full overflow-hidden rounded-xl shadow-sm">
            <img
              src={fixCdnUrls(restaurant.images)?.[0]}
              alt={restaurant.name}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        </section>

        {/* Restaurant Info - Right on Desktop (7 cols) */}
        <section className="lg:order-2 lg:col-span-7">
          <RestaurantInfo
            name={restaurant.name}
            slug={slug}
            restaurantId={restaurant.id}
            address={restaurant.address}
            phone={restaurant.phone}
            priceRange={formatPriceRange()}
            hours={restaurant.opening_hours}
            rating={restaurant.rating_overall}
            reviewCount={restaurant.review_count}
            categories={parseCuisineTypes().map((c) => c.name)}
            detailedRatings={[
              { label: "Vị trí", score: restaurant.rating_location || 0 },
              { label: "Không gian", score: restaurant.rating_ambiance || 0 },
              { label: "Chất lượng", score: restaurant.rating_quality || 0 },
              { label: "Phục vụ", score: restaurant.rating_service || 0 },
              { label: "Giá cả", score: restaurant.rating_price || 0 },
            ]}
            onCommentClick={() => {
              setActiveTab("binh-luan");
              setTimeout(() => {
                document.getElementById("tab-content")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
          />
        </section>
      </div>

      <section className="mb-8">
        <h2 className="mb-4 text-lg font-bold text-gray-900">Preview</h2>
        <ImageGalleryPreview
          images={fixCdnUrls(restaurant.images)}
          restaurantName={restaurant.name}
          onViewMore={() => {
            setActiveTab("anh");
            setTimeout(() => {
              document.getElementById("tab-content")?.scrollIntoView({ behavior: "smooth" });
            }, 100);
          }}
        />
      </section>

      {/* Tab Navigation */}
      <section className="mb-6">
        <div className="flex gap-8 border-b">
          {[
            { id: "gioi-thieu", label: "Giới thiệu" },
            { id: "binh-luan", label: "Bình luận" },
            { id: "nhan-xet", label: "Nhận xét" },
            { id: "anh", label: "Ảnh" },
            { id: "thuc-don", label: "Thực đơn" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-b-2 border-primary-500 text-primary-500"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      <section id="tab-content">{renderTabContent()}</section>
    </div>
  );
}
