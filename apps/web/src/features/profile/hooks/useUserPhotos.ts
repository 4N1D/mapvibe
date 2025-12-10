import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import type { PhotoItem, PhotoGroup } from "../types";

interface UseUserPhotosReturn {
  photos: PhotoGroup[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

function buildPhotoGroups(items: PhotoItem[]): PhotoGroup[] {
  const groups: Record<string, PhotoItem[]> = {};

  items.forEach((item) => {
    const key = new Date(item.created_at || new Date()).toISOString().split("T")[0];
    if (!groups[key]) groups[key] = [];
    groups[key].push(item);
  });

  return Object.entries(groups)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .map(([date, items]) => ({ date, items }));
}

export function useUserPhotos(): UseUserPhotosReturn {
  const [photos, setPhotos] = useState<PhotoGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPhotos = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ photos: PhotoItem[] }>("/users/me/photos");
      const items = response.data?.photos || [];
      setPhotos(buildPhotoGroups(items));
    } catch (err) {
      console.error("[useUserPhotos] Failed to fetch:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || "Không thể tải danh sách ảnh");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPhotos();
  }, [fetchPhotos]);

  return {
    photos,
    loading,
    error,
    refetch: fetchPhotos,
  };
}
