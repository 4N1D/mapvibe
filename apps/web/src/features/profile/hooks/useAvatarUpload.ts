import { useState, useRef, useCallback } from "react";
import { apiClient } from "@/lib/axios";

interface UploadResponse {
  upload_url: string;
  cdn_url: string;
  s3_key: string;
  expires_in: number;
  content_type: string;
}

interface UseAvatarUploadReturn {
  preview: string | null;
  uploading: boolean;
  uploadAvatar: (file: File) => Promise<string>;
  clearPreview: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
}

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export function useAvatarUpload(onSuccess?: (cdnUrl: string) => void): UseAvatarUploadReturn {
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const triggerFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const clearPreview = useCallback(() => {
    setPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const uploadAvatar = useCallback(async (file: File): Promise<string> => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Vui lòng chọn file ảnh");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Kích thước ảnh không được vượt quá 5MB");
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploading(true);

      // Get presigned URL
      const uploadResponse = await apiClient.post<UploadResponse>("/users/me/avatar", {
        content_type: file.type,
      });

      const { upload_url, cdn_url } = uploadResponse.data;

      // Upload to S3
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });

      clearPreview();
      onSuccess?.(cdn_url);
      return cdn_url;
    } catch (err) {
      clearPreview();
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(error.response?.data?.message || error.message || "Lỗi khi tải lên ảnh đại diện");
    } finally {
      setUploading(false);
    }
  }, [clearPreview, onSuccess]);

  return {
    preview,
    uploading,
    uploadAvatar,
    clearPreview,
    fileInputRef,
    triggerFileSelect,
  };
}
