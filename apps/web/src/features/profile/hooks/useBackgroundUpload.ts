import { useState, useRef, useCallback } from "react";
import { apiClient } from "@/lib/axios";

interface UploadResponse {
  upload_url: string;
  cdn_url: string;
  s3_key: string;
  expires_in: number;
  content_type: string;
}

interface UseBackgroundUploadReturn {
  preview: string | null;
  uploading: boolean;
  uploadBackground: (file: File) => Promise<string>;
  clearPreview: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function useBackgroundUpload(onSuccess?: (cdnUrl: string) => void): UseBackgroundUploadReturn {
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

  const uploadBackground = useCallback(async (file: File): Promise<string> => {
    if (!file.type.startsWith("image/")) {
      throw new Error("Vui lòng chọn file ảnh");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new Error("Kích thước ảnh không được vượt quá 10MB");
    }

    // Create preview first
    const reader = new FileReader();
    reader.onloadend = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    try {
      setUploading(true);

      // Small delay for preview to show
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Get presigned URL
      const uploadResponse = await apiClient.post<UploadResponse>("/users/me/background", {
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
      // Don't clear preview on error so user can see what they selected
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      throw new Error(error.response?.data?.message || error.message || "Lỗi khi tải lên ảnh nền");
    } finally {
      setUploading(false);
    }
  }, [clearPreview, onSuccess]);

  return {
    preview,
    uploading,
    uploadBackground,
    clearPreview,
    fileInputRef,
    triggerFileSelect,
  };
}
