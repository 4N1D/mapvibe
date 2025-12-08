import { useState } from "react";
import {
  MapPin,
  DollarSign,
  Clock,
  Share2,
  Bookmark,
  BookmarkCheck,
  PhoneCall,
  MessageSquare,
} from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/axios";

interface DetailedRating {
  label: string;
  score: number;
}

interface RestaurantInfoProps {
  name: string;
  slug?: string;
  restaurantId?: string;
  address: string;
  phone?: string;
  priceRange?: string;
  hours?: string;
  rating?: number;
  reviewCount?: number;
  isOpen?: boolean;
  categories?: string[];
  detailedRatings?: DetailedRating[];
  breadcrumbs?: string[];
  onCommentClick?: () => void;
}

export function RestaurantInfo({
  name,
  slug,
  restaurantId,
  address,
  phone,
  priceRange,
  hours,
  rating = 0,
  reviewCount = 0,
  isOpen = true,
  categories = [],
  detailedRatings = [],
  breadcrumbs = [],
  onCommentClick,
}: RestaurantInfoProps) {
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleCall = () => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    } else {
      toast.error("Chưa có số điện thoại");
    }
  };

  const handleSave = async () => {
    if (!restaurantId) {
      toast.error("Không thể lưu");
      return;
    }

    setIsSaving(true);
    try {
      await apiClient.post(`/restaurants/${restaurantId}/save`);
      setIsSaved(!isSaved);
      toast.success(isSaved ? "Đã bỏ lưu" : "Đã lưu vào bộ sưu tập");
    } catch {
      toast.error("Vui lòng đăng nhập để lưu");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async () => {
    const url = window.location.href;
    const title = `${name} - MapVibe`;

    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // User cancelled or error
      }
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Đã sao chép link");
    }
  };

  const getRatingLabel = (r: number) => {
    if (r >= 9.0) return "Xuất sắc";
    if (r >= 8.0) return "Tuyệt vời";
    if (r >= 7.0) return "Rất ngon";
    if (r >= 5.0) return "Hương vị tốt";
    return "Chưa đánh giá";
  };

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Breadcrumbs */}
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          {breadcrumbs.join(" / ")}
        </div>

        <div className="flex flex-col gap-4">
          {/* Header: Title & Ratings */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Title & Categories */}
            <div className="flex-1">
              <h1 className="mb-3 text-2xl font-bold leading-tight text-gray-900 md:text-4xl">
                {name}
              </h1>
              {categories.length > 0 && (
                <div className="mb-5 text-sm font-medium text-gray-500">
                  {categories.join(" • ")}
                </div>
              )}
            </div>

            {/* Right: Ratings (Compact) */}
            <div className="flex shrink-0 items-center gap-3">
              <div className="flex aspect-square h-14 w-14 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white shadow-md ring-4 ring-emerald-50">
                {Number(rating || 0).toFixed(1)}
              </div>
              <div className="hidden flex-col items-start sm:flex">
                <span className="text-sm font-semibold uppercase text-emerald-600">
                  {getRatingLabel(Number(rating || 0))}
                </span>
                <span className="text-xs text-gray-500">{reviewCount} đánh giá</span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5 text-sm">
            <div className="flex items-start gap-3 text-gray-700 transition-colors hover:text-primary-500">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <span className="line-clamp-2">{address}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex items-center gap-2">
                <span className={isOpen ? "font-bold text-green-600" : "font-bold text-red-600"}>
                  {isOpen ? "Đang mở cửa" : "Đã đóng cửa"}
                </span>
                <span className="text-gray-300">|</span>
                <span>{hours}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <DollarSign className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="font-medium">{priceRange}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-700 hover:text-primary-600">
              <PhoneCall className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{phone}</span>
            </div>
          </div>
        </div>

        {/* Detailed Ratings Grid */}
        <div className="mt-6 grid grid-cols-5 gap-2 border-t border-gray-100 pt-4">
          {detailedRatings.map((r) => (
            <div
              key={r.label}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-sm font-bold text-emerald-600">{r.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3 border-t border-gray-100 pt-4">
        <button
          onClick={handleCall}
          title={phone || "Chưa có số điện thoại"}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500 lg:flex-1"
        >
          <PhoneCall className="h-4 w-4" />
          <span className="hidden sm:inline">Gọi điện thoại</span>
        </button>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition lg:flex-1 ${
            isSaved
              ? "border-primary-500 bg-primary-50 text-primary-600"
              : "border-gray-200 text-gray-700 hover:bg-gray-50 hover:text-primary-500"
          } disabled:opacity-50`}
        >
          {isSaved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          <span className="hidden sm:inline">{isSaved ? "Đã lưu" : "Lưu"}</span>
        </button>
        <button
          onClick={onCommentClick}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500 lg:flex-1"
        >
          <MessageSquare className="h-4 w-4" />
          <span className="hidden sm:inline">Bình luận</span>
        </button>
        <button
          onClick={handleShare}
          className="flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500 lg:flex-1"
        >
          <Share2 className="h-4 w-4" />
          <span className="hidden sm:inline">Chia sẻ</span>
        </button>
      </div>
    </div>
  );
}
