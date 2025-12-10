import { useState, useEffect, useCallback } from "react";
import { apiClient } from "@/lib/axios";
import type { UserProfile, UpdateProfileData } from "../types";

interface UseProfileReturn {
  profile: UserProfile | null;
  loading: boolean;
  error: string | null;
  updateProfile: (data: UpdateProfileData) => Promise<boolean>;
  updating: boolean;
  refetch: () => Promise<void>;
  setAvatarUrl: (url: string) => void;
  setBackgroundUrl: (url: string) => void;
}

export function useProfile(): UseProfileReturn {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiClient.get<{ user: UserProfile }>("/users/me");
      setProfile(response.data.user);
    } catch (err) {
      console.error("[useProfile] Failed to fetch:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || "Không thể tải thông tin profile");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (data: UpdateProfileData): Promise<boolean> => {
    try {
      setUpdating(true);
      const response = await apiClient.put<{ user: UserProfile }>("/users/me", data);
      setProfile(response.data.user);
      return true;
    } catch (err) {
      console.error("[useProfile] Failed to update:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(
        error.response?.data?.message || error.message || "Không thể cập nhật profile"
      );
    } finally {
      setUpdating(false);
    }
  }, []);

  // Update avatar URL directly without refetching (for smooth UX)
  const setAvatarUrl = useCallback((url: string) => {
    setProfile((prev) => (prev ? { ...prev, avatar: url } : null));
  }, []);

  // Update background URL directly without refetching (for smooth UX)
  const setBackgroundUrl = useCallback((url: string) => {
    setProfile((prev) => (prev ? { ...prev, background: url } : null));
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    error,
    updateProfile,
    updating,
    refetch: fetchProfile,
    setAvatarUrl,
    setBackgroundUrl,
  };
}
