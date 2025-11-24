import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Restaurant } from "@mapvibe/types";
import { ArrowLeft } from "lucide-react";
import { ImageGalleryPreview } from "@/features/place";

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
        const response = await axios.get(`/api/place/${slug}`);
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
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">{error || "Không tìm thấy quán"}</p>
        <Link
          to="/"
          className="text-primary hover:underline"
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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <main className="space-y-6 lg:col-span-2">
              {/* TODO: Dịch vụ */}
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold">Dịch vụ</h3>
                <p className="text-gray-500">TODO: ServicesList</p>
              </div>
              {/* TODO: Loại hình ẩm thực */}
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold">Loại hình ẩm thực</h3>
                <p className="text-gray-500">TODO: CuisineType</p>
              </div>
              {/* TODO: Địa điểm tương tự */}
              <div className="rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold">Những địa điểm tương tự</h3>
                <p className="text-gray-500">TODO: SimilarPlaces</p>
              </div>
            </main>
            <aside>
              <div className="sticky top-4 rounded-lg bg-white p-6 shadow-sm">
                <h3 className="mb-4 font-semibold">Direction</h3>
                <div className="mb-4 h-48 rounded-lg bg-gray-200"></div>
                <p className="mb-4 text-sm text-gray-600">{restaurant.address}</p>
                <div className="flex gap-2">
                  <button className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                    Copy
                  </button>
                  <button className="flex-1 rounded-lg border px-4 py-2 text-sm hover:bg-gray-50">
                    Share
                  </button>
                </div>
              </div>
            </aside>
          </div>
        );

      case "binh-luan":
        return (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-gray-500">TODO: CommentsTab</p>
          </div>
        );

      case "nhan-xet":
        return (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-gray-500">TODO: ReviewsTab</p>
          </div>
        );

      case "anh":
        return (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-gray-500">TODO: PhotosTab</p>
          </div>
        );

      case "thuc-don":
        return (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            <p className="text-gray-500">TODO: MenuTab</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back button */}
      <Link
        to="/"
        className="hover:text-primary mb-4 inline-flex items-center gap-2 text-gray-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      {/* Restaurant Info */}
      <section className="mb-6">
        {/* TODO: RestaurantInfo component */}
        <h1 className="text-2xl font-bold">{restaurant.name}</h1>
        <p className="text-gray-600">{restaurant.address}</p>
      </section>

      {/* Image Gallery Preview */}
      <section className="mb-6">
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
                  ? "border-primary text-primary border-b-2"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      <section>{renderTabContent()}</section>
    </div>
  );
}
