import { useState, useEffect } from "react";
import { RestaurantPhoto, RestaurantPhotosResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";

interface MenuTabProps {
  restaurantId: number;
}

export function MenuTab({ restaurantId }: MenuTabProps) {
  const [photos, setPhotos] = useState<RestaurantPhoto[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchMenuPhotos = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<RestaurantPhotosResponse>(
          `/photos/restaurant/${restaurantId}?page=1&limit=12&category=menu`
        );
        setPhotos(response.data.photos);
        setHasMore(response.data.page < response.data.total_pages);
        setPage(1);
      } catch (error) {
        console.error("Failed to fetch menu photos:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchMenuPhotos();
  }, [restaurantId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await apiClient.get<RestaurantPhotosResponse>(
        `/photos/restaurant/${restaurantId}?page=${nextPage}&limit=12&category=menu`
      );
      setPhotos((prev) => [...prev, ...response.data.photos]);
      setHasMore(response.data.page < response.data.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more menu photos:", error);
    } finally {
      setLoadingMore(false);
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
    <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
      {photos.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Chưa có ảnh thực đơn nào.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <div key={photo.id} className="group">
              <div className="relative aspect-[3/4] cursor-pointer overflow-hidden rounded-lg bg-gray-100">
                <img
                  src={photo.thumbnail_url || photo.url}
                  alt={photo.caption || "Thực đơn"}
                  className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
              </div>
              {photo.caption && (
                <p className="mt-2 text-sm font-medium text-gray-700">{photo.caption}</p>
              )}
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
          {loadingMore ? "Đang tải..." : "Nhấn để xem thêm thực đơn..."}
        </button>
      )}
    </div>
  );
}
