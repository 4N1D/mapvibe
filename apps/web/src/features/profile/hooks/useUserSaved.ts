import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import type { SavedRestaurant } from "../types";

interface UseUserSavedReturn {
  saved: SavedRestaurant[];
  total: number;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

const LIMIT = 20;

export function useUserSaved(): UseUserSavedReturn {
  const [saved, setSaved] = useState<SavedRestaurant[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchSaved = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;
        const response = await apiClient.get<{
          saved: SavedRestaurant[];
          total: number;
          limit: number;
          offset: number;
        }>("/users/me/saved", {
          params: { limit: LIMIT, offset: currentOffset },
        });

        const newSaved = response.data?.saved || [];

        if (reset) {
          setSaved(newSaved);
          setOffset(LIMIT);
        } else {
          setSaved((prev) => [...prev, ...newSaved]);
          setOffset((prev) => prev + LIMIT);
        }

        setTotal(response.data?.total || 0);
      } catch (err) {
        console.error("[useUserSaved] Failed to fetch:", err);
        const error = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          error.response?.data?.message || error.message || "Không thể tải danh sách đã lưu"
        );
      } finally {
        setLoading(false);
      }
    },
    [offset]
  );

  const loadMore = useCallback(async () => {
    if (!loading && saved.length < total) {
      await fetchSaved(false);
    }
  }, [loading, saved.length, total, fetchSaved]);

  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchSaved(true);
  }, []);

  useEffect(() => {
    fetchSaved(true);
  }, []);

  return {
    saved,
    total,
    loading,
    error,
    loadMore,
    hasMore: saved.length < total,
    refetch,
  };
}
