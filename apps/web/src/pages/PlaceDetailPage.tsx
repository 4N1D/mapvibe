import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { apiClient } from "@/lib/axios";
import { Restaurant } from "@mapvibe/types";
import { ArrowLeft } from "lucide-react";
import { CommentsTab, ImageGalleryPreview, IntroductionTab, MenuTab, PhotosTab, RestaurantInfo, ReviewsTab } from "@/features/place";

export function PlaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("gioi-thieu");

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<Restaurant>(`/places/${slug}`);
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
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
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

  // Render tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case "gioi-thieu":
        return (
          <IntroductionTab
            services={[
              "Giữ xe miễn phí",
              "Wifi miễn phí",
              "Cho phép mang theo thú cưng",
              "Tiệc ngoài trời",
              "Acoustic hàng tuần",
              "Mang đi",
            ]}
            cuisineTypes={[
              {
                name: "Buffet Lẩu Băng Chuyền",
                description: "Bao gồm các loại hải sản, thịt, rau củ và nấm.",
              },
              {
                name: "Lẩu Đa Dạng Nước Dùng",
                description:
                  "Các lựa chọn nước lẩu như lẩu thảo mộc, lẩu kim chi, lẩu miso và nhiều loại khác.",
              },
              {
                name: "Chế Biến Theo Yêu Cầu",
                description: "Thực khách có thể tự tay chế biến món ăn theo sở thích cá nhân.",
              },
              {
                name: "Ẩm Thực Nhật Bản",
                description:
                  "Không chỉ có lẩu, nhà hàng còn phục vụ nhiều món ăn theo phong cách Nhật Bản.",
              },
              {
                name: "Nước Chấm Đa Dạng",
                description:
                  "Không chỉ có lẩu, nhà hàng còn phục vụ nhiều món ăn theo phong cách Nhật Bản.",
              },
            ]}
            similarPlaces={[
              // TODO: Fetch from API
              {
                slug: "lau-manwah",
                name: "Lẩu Manwah",
                address:
                  "Tầng 4 Vincom Plaza Lê Văn Việt, 50 Lê Văn Việt, Hiệp Phú, Quận 9, TP. HCM",
                rating: 4.5,
                priceRange: "200.000 vnđ - 350.000 vnđ",
                hours: "11:00 AM - 10:00 PM",
                image:
                  "https://images.unsplash.com/photo-1541544744-378ca6f0407a?auto=format&fit=crop&q=80&w=600",
              },
              {
                slug: "song-doi-quan-lau-oc",
                name: "Song đôi quán Lẩu ốc",
                address: "196 Đường Lê Văn Việt, Phường Tăng Nhơn Phú B, Quận 9",
                rating: 4.2,
                priceRange: "150.000 vnđ - 300.000 vnđ",
                hours: "6:00 AM - 10:00 PM",
                image:
                  "https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&q=80&w=600",
              },
              {
                slug: "nijyu-maru",
                name: "Nijyu Maru",
                address: "196 Đường Lê Văn Việt, Phường Tăng Nhơn Phú B, Quận 9",
                rating: 4.0,
                priceRange: "150.000 vnđ - 300.000 vnđ",
                hours: "6:00 AM - 10:00 PM",
                image:
                  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=600",
              },
              {
                slug: "nijyu-maru",
                name: "Nijyu Maru",
                address: "196 Đường Lê Văn Việt, Phường Tăng Nhơn Phú B, Quận 9",
                rating: 4.0,
                priceRange: "150.000 vnđ - 300.000 vnđ",
                hours: "6:00 AM - 10:00 PM",
                image:
                  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=600",
              },
              {
                slug: "nijyu-maru",
                name: "Nijyu Maru",
                address: "196 Đường Lê Văn Việt, Phường Tăng Nhơn Phú B, Quận 9",
                rating: 4.0,
                priceRange: "150.000 vnđ - 300.000 vnđ",
                hours: "6:00 AM - 10:00 PM",
                image:
                  "https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&q=80&w=600",
              },
            ]}
            address={restaurant.address}
          />
        );

      case "binh-luan":
        return <CommentsTab restaurantId={restaurant.id} />

      case "nhan-xet":
        return <ReviewsTab restaurantId={restaurant.id} />;

      case "anh":
        return <PhotosTab restaurantId={restaurant.id} />;

      case "thuc-don":
        return <MenuTab restaurantId={restaurant.id} />;

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back button */}
      <Link
        to="/"
        className="hover:text-primary-500 mb-4 inline-flex items-center gap-2 text-gray-600"
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
              src={restaurant.images?.[0]}
              alt={restaurant.name}
              className="h-full w-full object-cover transition-transform duration-500 hover:scale-105"
            />
          </div>
        </section>

        {/* Restaurant Info - Right on Desktop (7 cols) */}
        <section className="lg:order-2 lg:col-span-7">
          <RestaurantInfo
            name={restaurant.name}
            address={restaurant.address}
            phone={restaurant.phone}
            priceRange={restaurant.priceRange}
            hours={restaurant.hours}
            rating={restaurant.rating}
            categories={["Café/Dessert", "Đài Loan", "Sinh viên", "Cặp đôi"]}
            detailedRatings={[
              { label: "Vị trí", score: 7.7 },
              { label: "Không gian", score: 7.4 },
              { label: "Chất lượng", score: 7.4 },
              { label: "Phục vụ", score: 7.2 },
              { label: "Giá cả", score: 6.8 },
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
          images={restaurant.images}
          restaurantName={restaurant.name}
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
                  ? "border-primary-500 text-primary-500 border-b-2"
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
