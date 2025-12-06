import { useState } from "react";
import { Heart, MessageCircle, Flag, Star } from "lucide-react";
import { RestaurantReview } from "@mapvibe/types";
import { ReportModal } from "./ReportModal";

interface ReviewItemProps {
  review: RestaurantReview;
  formatTime: (date: string) => string;
}

export function ReviewItem({ review, formatTime }: ReviewItemProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(review.like_count);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const handleReport = async (reason: string, details?: string) => {
    console.log("Report submitted:", { reviewId: review.id, reason, details });
    alert("Đã gửi báo cáo. Cảm ơn bạn đã phản hồi!");
  };

  return (
    <div className="border-b border-gray-100 py-4 last:border-0">
      <div className="mb-3 flex items-start gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {review.author_avatar ? (
            <img
              src={review.author_avatar}
              alt={review.author_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-300 text-sm font-medium text-gray-600">
              {review.author_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900">{review.author_name}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <span>{formatTime(review.created_at)}</span>
            <span className="flex items-center gap-0.5 font-medium text-yellow-500">
              {review.overall_rating.toFixed(1)}
              <Star className="h-3.5 w-3.5 fill-current" />
            </span>
          </div>
        </div>
      </div>

      <p className="mb-3 text-gray-700">{review.content}</p>

      {review.photos.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {review.photos.slice(0, 5).map((photo, index) => (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-lg bg-gray-100"
            >
              <img
                src={photo.url}
                alt={photo.caption || `Ảnh ${index + 1}`}
                className="h-full w-full object-cover transition hover:scale-105"
              />
              {index === 4 && review.photos.length > 5 && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-bold text-white">
                  +{review.photos.length - 5}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4 text-sm text-gray-500">
        <button
          onClick={handleLike}
          className={`flex items-center gap-1 transition hover:text-red-500 ${liked ? "text-red-500" : ""}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
          <span>{likeCount}</span>
        </button>

        <button className="flex items-center gap-1 transition hover:text-primary-500">
          <MessageCircle className="h-4 w-4" />
          <span>{review.comment_count}</span>
        </button>

        <button
          onClick={() => setIsReportModalOpen(true)}
          className="flex items-center gap-1 transition hover:text-orange-500"
        >
          <Flag className="h-4 w-4" />
          <span>Báo cáo</span>
        </button>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReport}
        authorName={review.author_name}
      />
    </div>
  );
}
