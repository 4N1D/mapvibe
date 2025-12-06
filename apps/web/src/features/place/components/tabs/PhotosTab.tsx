import { useState, useEffect } from "react";
import { RestaurantPhoto, RestaurantPhotosResponse, PhotoCategory } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";

interface PhotosTabProps {
  restaurantId: number;
}

type DisplayCategory = Exclude<PhotoCategory, "menu">;

const CATEGORY_LABELS: Record<DisplayCategory, string> = {
  all: "Tất cả",
  food: "Thức ăn",
  view: "Không gian",
  comment: "Bình luận",
};

export function PhotosTab({ restaurantId }: PhotosTabProps) {
  const [photos, setPhotos] = useState<RestaurantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [category, setCategory] = useState<DisplayCategory>("all");
  const [categoryCounts, setCategoryCounts] = useState<Record<DisplayCategory, number>>({
    all: 0,
    food: 0,
    view: 0,
    comment: 0,
  });

  useEffect(() => {
    const fetchPhotos = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<RestaurantPhotosResponse>(
          `/photos/restaurant/${restaurantId}?page=1&limit=15&category=${category}`
        );
        setPhotos(response.data.photos);
        const { menu: _, ...counts } = response.data.category_counts;
        setCategoryCounts(counts);
        setHasMore(response.data.page < response.data.total_pages);
        setPage(1);
      } catch (error) {
        console.error("Failed to fetch photos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPhotos();
  }, [restaurantId, category]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await apiClient.get<RestaurantPhotosResponse>(
        `/photos/restaurant/${restaurantId}?page=${nextPage}&limit=15&category=${category}`
      );
      setPhotos((prev) => [...prev, ...response.data.photos]);
      setHasMore(response.data.page < response.data.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more photos:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleCategoryChange = (newCategory: DisplayCategory) => {
    if (newCategory !== category) {
      setCategory(newCategory);
      setPhotos([]);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
          <button
            key={cat}
            onClick={() => handleCategoryChange(cat)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              category === cat
                ? "border-primary-500 bg-primary-50 text-primary-600"
                : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
            }`}
          >
            {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      <div className="rounded-lg bg-white p-4 shadow-sm">
        {photos.length === 0 ? (
          <p className="py-8 text-center text-gray-500">Chưa có ảnh nào trong danh mục này.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100"
              >
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.caption || "Ảnh nhà hàng"}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
              </div>
            ))}
          </div>
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-6 w-full py-3 text-center text-sm text-gray-500 hover:text-primary-500 disabled:opacity-50"
          >
            {loadingMore ? "Đang tải..." : "Nhấn để xem thêm ảnh..."}
          </button>
        )}
      </div>
    </div>
  );
}
