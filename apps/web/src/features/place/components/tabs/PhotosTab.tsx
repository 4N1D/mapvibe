import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RestaurantPhoto, RestaurantPhotosResponse, PhotoCategory } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";

interface PhotosTabProps {
  restaurantId: string;
  slug?: string;
  showFilters?: boolean;
}

type DisplayCategory = Exclude<PhotoCategory, "menu">;

const CATEGORY_LABELS: Record<DisplayCategory, string> = {
  all: "Tất cả",
  food: "Thức ăn",
  view: "Không gian",
  comment: "Bình luận",
};

const fetchPhotos = async (slug: string, category: string, page: number) => {
  const response = await apiClient.get<RestaurantPhotosResponse>(
    `/restaurants/${slug}/photos?page=${page}&limit=15&category=${category}`
  );
  return response.data;
};

export function PhotosTab({ restaurantId, slug, showFilters = true }: PhotosTabProps) {
  const [category, setCategory] = useState<DisplayCategory>("all");
  const [allPhotos, setAllPhotos] = useState<RestaurantPhoto[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const { data, isFetching } = useQuery({
    queryKey: ["photos", slug, category],
    queryFn: () => fetchPhotos(slug!, category, 1),
    placeholderData: (prev) => prev,
    enabled: !!slug,
    select: (data) => {
      if (showFilters) {
        const { menu: _, ...counts } = data.category_counts;
        return { ...data, category_counts: counts };
      }
      return data;
    },
  });

  const photos = page === 1 ? data?.photos || [] : allPhotos;
  const categoryCounts = data?.category_counts || { all: 0, food: 0, view: 0, comment: 0 };

  if (data && page === 1 && hasMore !== data.page < data.total_pages) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    if (!slug) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchPhotos(slug, category, nextPage);
      setAllPhotos(
        page === 1
          ? [...(data?.photos || []), ...response.photos]
          : [...allPhotos, ...response.photos]
      );
      setHasMore(response.page < response.total_pages);
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
      setPage(1);
      setAllPhotos([]);
    }
  };

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_LABELS) as Array<keyof typeof CATEGORY_LABELS>).map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              disabled={isFetching}
              className={`rounded-full border px-4 py-1.5 text-sm transition ${
                category === cat
                  ? "border-primary-500 bg-primary-50 text-primary-600"
                  : "border-gray-300 bg-white text-gray-600 hover:border-gray-400"
              } disabled:opacity-50`}
            >
              {CATEGORY_LABELS[cat]} ({categoryCounts[cat]})
            </button>
          ))}
        </div>
      )}

      <div
        className={`relative rounded-lg bg-white p-4 shadow-sm transition-opacity ${isFetching ? "opacity-60" : ""}`}
      >
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
