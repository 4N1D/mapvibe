import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RestaurantPhoto, RestaurantPhotosResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";

interface MenuTabProps {
  restaurantId: string;
  slug?: string;
}

const fetchMenuPhotos = async (slug: string, page: number) => {
  const response = await apiClient.get<RestaurantPhotosResponse>(
    `/restaurants/${slug}/menu?page=${page}&limit=12`
  );
  return response.data;
};

export function MenuTab({ restaurantId, slug }: MenuTabProps) {
  const [localPhotos, setLocalPhotos] = useState<RestaurantPhoto[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { data } = useQuery({
    queryKey: ["menu-photos", slug],
    queryFn: () => fetchMenuPhotos(slug!, 1),
    placeholderData: (prev) => prev,
    enabled: !!slug,
  });

  const photos = localPhotos.length > 0 ? localPhotos : data?.photos || [];

  if (data && localPhotos.length === 0 && hasMore !== data.page < data.total_pages) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    if (!slug) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchMenuPhotos(slug, nextPage);
      const currentPhotos = localPhotos.length > 0 ? localPhotos : data?.photos || [];
      setLocalPhotos([...currentPhotos, ...response.photos]);
      setHasMore(response.page < response.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more menu photos:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
      {photos.length === 0 ? (
        <p className="py-8 text-center text-gray-500">Chưa có ảnh thực đơn nào.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {photos.map((photo) => (
            <div
              key={photo.id}
              className="group"
            >
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
