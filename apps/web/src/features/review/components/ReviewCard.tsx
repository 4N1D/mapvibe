import React from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@mapvibe/ui-components";
import { Heart, MessageCircle, Share2, MapPin, Clock, DollarSign } from "lucide-react";
import { HotReview } from "@mapvibe/types";
import { Skeleton, SkeletonText, SkeletonCircle } from "@mapvibe/ui-components";
import toast from "react-hot-toast";

function formatPriceRange(priceMin?: number | null, priceMax?: number | null): string | null {
  if (!priceMin && !priceMax) return null;
  if (priceMin && priceMax) {
    return `${priceMin.toLocaleString("vi-VN")}đ - ${priceMax.toLocaleString("vi-VN")}đ`;
  }
  if (priceMin) return `Từ ${priceMin.toLocaleString("vi-VN")}đ`;
  if (priceMax) return `Đến ${priceMax.toLocaleString("vi-VN")}đ`;
  return null;
}

function formatOpeningHours(openingHours?: string | null): string | null {
  if (!openingHours) return null;
  try {
    const hours = typeof openingHours === "string" ? JSON.parse(openingHours) : openingHours;
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    return hours[today] || null;
  } catch {
    return typeof openingHours === "string" ? openingHours : null;
  }
}

interface ReviewCardProps {
  data?: HotReview;
  loading?: boolean;
  tags?: string[];
  formatTime?: (date: string) => string;
}

export function ReviewCard({ data, loading, tags: _tags = [], formatTime }: ReviewCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    if (data) {
      navigate(`/post/${data.id}`);
    }
  };

  if (loading) {
    return (
      <Card className="flex h-full flex-col overflow-hidden">
        {/* Image skeleton */}
        <Skeleton className="h-48 w-full rounded-none" />

        <CardContent className="flex flex-1 flex-col p-4">
          {/* Text skeleton */}
          <SkeletonText lines={3} />

          {/* Author skeleton */}
          <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-2">
            <div className="flex items-center gap-2">
              <SkeletonCircle size={24} />
              <div className="space-y-1">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-4 w-8" />
              <Skeleton className="h-4 w-8" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/review/${data.id}`;
    const shareText = `${data.text.substring(0, 100)}...`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Review từ ${data.author_name || data.author_id}`,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log("Share cancelled or failed:", err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        toast.success("Đã sao chép link vào clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
        toast.error("Không thể chia sẻ. Vui lòng thử lại.");
      }
    }
  };

  return (
    <Card
      className="flex h-full cursor-pointer flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
      onClick={handleCardClick}
    >
      {/* Image */}
      <div className="relative h-48 bg-gray-200">
        {data.photos.length > 0 ? (
          <img
            src={data.photos[0].url}
            alt={data.photos[0].caption || "Review photo"}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-400">
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}

        {/* Tag */}
        {data.tag && data.tag !== "normal" && (
          <div className="absolute left-2 top-2">
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                data.tag === "hot"
                  ? "bg-red-500 text-white"
                  : data.tag === "trending"
                    ? "bg-orange-500 text-white"
                    : "bg-blue-500 text-white"
              }`}
            >
              {data.tag === "hot" ? "🔥 Hot" : data.tag === "trending" ? "📈 Trending" : "✨ New"}
            </span>
          </div>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-4">
        {/* Restaurant info - always show */}
        <div className="mb-3 rounded-lg bg-gradient-to-r from-slate-50 to-gray-50 p-3 ring-1 ring-gray-100">
          <h3 className="font-bold text-gray-900 line-clamp-1">
            {data.restaurant_name || "Địa điểm chưa xác định"}
          </h3>
          {data.restaurant_address && (
            <div className="mt-2 flex items-start gap-2 rounded-md bg-white/70 px-2.5 py-1.5">
              <MapPin className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-500" />
              <p className="text-xs leading-relaxed text-gray-600 line-clamp-2">
                {data.restaurant_address}
              </p>
            </div>
          )}
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {formatPriceRange(data.price_min, data.price_max) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 shadow-sm">
                <DollarSign className="h-3.5 w-3.5" />
                {formatPriceRange(data.price_min, data.price_max)}
              </span>
            )}
            {formatOpeningHours(data.opening_hours) && (
              <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700 shadow-sm">
                <Clock className="h-3.5 w-3.5" />
                {formatOpeningHours(data.opening_hours)}
              </span>
            )}
          </div>
        </div>

        {/* Review content - secondary */}
        <p className="line-clamp-2 text-sm text-gray-600">{data.text}</p>

        {/* Reviewer info */}
        <div className="mt-auto flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2">
            {data.author_avatar ? (
              <img
                src={data.author_avatar}
                alt={data.author_name || "Avatar"}
                className="h-6 w-6 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300">
                <span className="text-xs font-medium text-gray-600">
                  {(data.author_name || data.author_id).charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="text-xs font-medium text-gray-900">
                {data.author_name || data.author_id}
              </p>
              <p className="text-xs text-gray-500">
                {formatTime ? formatTime(data.created_at) : data.created_at}
              </p>
            </div>
          </div>

          {/* Engagement */}
          <div className="flex items-center gap-3 text-gray-500">
            <span className="flex items-center gap-1 text-xs">
              <Heart className="h-3 w-3" />
              {data.upvote_count}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle className="h-3 w-3" />
              {data.comment_count}
            </span>
            <button
              onClick={handleShare}
              className="flex items-center gap-1 rounded-full p-1 text-xs transition hover:bg-gray-100"
              title="Chia sẻ"
            >
              <Share2 className="h-3 w-3" />
              {data.share_count || 0}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
