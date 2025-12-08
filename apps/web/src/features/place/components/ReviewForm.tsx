import { useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import toast from "react-hot-toast";

interface ReviewFormProps {
  onSubmit: (data: {
    content: string;
    ratings: Record<string, number>;
    photos: File[];
  }) => void;
  loading?: boolean;
}

const RATING_CRITERIA = [
  { id: "quality", label: "Chất lượng" },
  { id: "service", label: "Dịch vụ" },
  { id: "location", label: "Vị trí" },
  { id: "price", label: "Giá cả" },
  { id: "ambiance", label: "Không gian" },
];

function RatingSlider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 text-xs text-gray-600">{label}</span>
      <input
        type="range"
        min="0"
        max="10"
        step="0.5"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-gray-200 accent-primary-500"
      />
      <span className="w-8 text-right text-xs font-medium text-gray-700">
        {value > 0 ? value.toFixed(1) : "-"}
      </span>
    </div>
  );
}

export function ReviewForm({ onSubmit, loading }: ReviewFormProps) {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState("");
  const [ratings, setRatings] = useState<Record<string, number>>({
    quality: 0,
    service: 0,
    location: 0,
    price: 0,
    ambiance: 0,
  });
  const [photos, setPhotos] = useState<File[]>([]);
  const [photosPreviews, setPhotosPreviews] = useState<string[]>([]);

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length + photos.length > 5) {
      toast.error("Tối đa 5 ảnh");
      return;
    }

    setPhotos((prev) => [...prev, ...files]);

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotosPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotosPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    const hasRating = Object.values(ratings).some((r) => r > 0);
    if (!hasRating) {
      toast.error("Vui lòng đánh giá ít nhất 1 tiêu chí");
      return;
    }

    onSubmit({ content: content.trim(), ratings, photos });
    setContent("");
    setRatings({ quality: 0, service: 0, location: 0, price: 0, ambiance: 0 });
    setPhotos([]);
    setPhotosPreviews([]);
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-gray-500">
          Vui lòng{" "}
          <a href="/login" className="text-primary-500 font-medium hover:underline">
            đăng nhập
          </a>{" "}
          để viết nhận xét
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
        <div className="flex-1">
          <div className="mb-3 flex gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
              <div className="flex h-full w-full items-center justify-center bg-gray-300 text-sm font-medium text-gray-600">
                {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
              </div>
            </div>
            <input
              type="text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Viết nhận xét của bạn tại đây..."
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={!content.trim() || loading}
              className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 lg:px-6"
            >
              {loading ? "..." : "Nhận xét"}
            </button>
          </div>

          <div className="ml-13">
            <label className="inline-flex cursor-pointer items-center gap-1 text-sm text-gray-500 hover:text-primary-500">
              <ImagePlus className="h-4 w-4" />
              <span>Tải hình ảnh lên</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="hidden"
                disabled={loading || photos.length >= 5}
              />
            </label>

            {photosPreviews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {photosPreviews.map((src, index) => (
                  <div key={index} className="group relative h-16 w-16">
                    <img
                      src={src}
                      alt={`Preview ${index + 1}`}
                      className="h-full w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removePhoto(index)}
                      className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="lg:w-64">
          <p className="mb-2 text-sm font-medium text-gray-700">Đánh giá</p>
          <div className="space-y-2">
            {RATING_CRITERIA.map((criteria) => (
              <RatingSlider
                key={criteria.id}
                label={criteria.label}
                value={ratings[criteria.id]}
                onChange={(v) => setRatings((prev) => ({ ...prev, [criteria.id]: v }))}
              />
            ))}
          </div>
        </div>
      </div>
    </form>
  );
}
