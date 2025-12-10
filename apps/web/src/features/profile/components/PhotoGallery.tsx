import { Image as ImageIcon } from "lucide-react";
import type { PhotoGroup } from "../types";
import { formatDateDisplay } from "../utils";
import { MapVibeLoader } from "@/components/common/MapVibeLoader";

interface PhotoGalleryProps {
  photos: PhotoGroup[];
  loading: boolean;
  error: string | null;
}

export function PhotoGallery({ photos, loading, error }: PhotoGalleryProps) {
  if (loading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <MapVibeLoader size="md" text="Đang tải ảnh..." />
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>;
  }

  if (photos.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <ImageIcon className="h-10 w-10 text-gray-400" />
        <p className="mt-3 text-gray-600">Chưa có ảnh nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {photos.map((group) => (
        <div
          key={group.date}
          className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200"
        >
          <p className="mb-4 text-sm font-semibold text-gray-800">
            {formatDateDisplay(group.date)}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {group.items.map((photo) => (
              <div
                key={photo.id}
                className="overflow-hidden rounded-lg bg-gray-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="aspect-[4/3] w-full overflow-hidden bg-gray-200">
                  <img
                    src={photo.url || photo.thumbnail_url || ""}
                    alt="Ảnh của bạn"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
