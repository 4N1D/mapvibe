import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import type { UserReview } from "../types";

interface UseUserReviewsReturn {
  reviews: UserReview[];
  total: number;
  loading: boolean;
  error: string | null;
  loadMore: () => Promise<void>;
  hasMore: boolean;
  refetch: () => Promise<void>;
}

const LIMIT = 20;

export function useUserReviews(): UseUserReviewsReturn {
  const [reviews, setReviews] = useState<UserReview[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  const fetchReviews = useCallback(
    async (reset = false) => {
      try {
        setLoading(true);
        setError(null);

        const currentOffset = reset ? 0 : offset;
        interface ApiReview extends Omit<UserReview, 'photos'> {
          photos?: Array<{ url: string }> | string[];
        }
        const response = await apiClient.get<{
          reviews: ApiReview[];
          total: number;
          limit: number;
          offset: number;
        }>("/users/me/reviews", {
          params: { limit: LIMIT, offset: currentOffset },
        });

        // Map photos from [{url: "..."}] to ["..."]
        const newReviews: UserReview[] = (response.data?.reviews || []).map((r) => ({
          ...r,
          photos: r.photos?.map((p) => (typeof p === 'string' ? p : p.url)) || [],
        }));

        if (reset) {
          setReviews(newReviews);
          setOffset(LIMIT);
        } else {
          setReviews((prev) => [...prev, ...newReviews]);
          setOffset((prev) => prev + LIMIT);
        }

        setTotal(response.data?.total || 0);
      } catch (err) {
        console.error("[useUserReviews] Failed to fetch:", err);
        const error = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          error.response?.data?.message || error.message || "Không thể tải danh sách bài viết"
        );
      } finally {
        setLoading(false);
      }
    },
    [offset]
  );

  const loadMore = useCallback(async () => {
    if (!loading && reviews.length < total) {
      await fetchReviews(false);
    }
  }, [loading, reviews.length, total, fetchReviews]);

  const refetch = useCallback(async () => {
    setOffset(0);
    await fetchReviews(true);
  }, []);

  useEffect(() => {
    fetchReviews(true);
  }, []);

  return {
    reviews,
    total,
    loading,
    error,
    loadMore,
    hasMore: reviews.length < total,
    refetch,
  };
}
