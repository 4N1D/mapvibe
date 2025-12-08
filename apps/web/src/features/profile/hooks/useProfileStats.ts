import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import type { UserStats } from "../types";

interface UseProfileStatsReturn {
  stats: UserStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const DEFAULT_STATS: UserStats = {
  review_count: 0,
  review_post_count: 0,
  restaurant_review_count: 0,
  photo_count: 0,
  comment_count: 0,
  saved_count: 0,
};

export function useProfileStats(): UseProfileStatsReturn {
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<UserStats>("/users/me/stats");
      setStats(response.data);
    } catch (err) {
      console.error("[useProfileStats] Failed to fetch:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || "Không thể tải thống kê");
      setStats(DEFAULT_STATS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    loading,
    error,
    refetch: fetchStats,
  };
}
