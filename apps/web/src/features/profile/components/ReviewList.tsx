import { FileText } from "lucide-react";
import { Link } from "react-router-dom";
import type { UserReview } from "../types";
import { formatDateDisplay } from "../utils";

interface ReviewListProps {
  reviews: UserReview[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function ReviewList({ reviews, loading, error, hasMore, onLoadMore }: ReviewListProps) {
  if (loading && reviews.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>;
  }

  if (reviews.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <FileText className="h-10 w-10 text-gray-400" />
        <p className="mt-3 text-gray-600">Chưa có bài viết nào</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {reviews.map((review) => (
          <ReviewCard
            key={review.id}
            review={review}
          />
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={onLoadMore}
            disabled={loading}
            className="rounded-lg bg-gray-100 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-50"
          >
            {loading ? "Đang tải..." : "Xem thêm"}
          </button>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ review }: { review: UserReview }) {
  const coverPhoto = review.photos?.[0];
  const linkTo = review.restaurant_slug
    ? `/place/${review.restaurant_slug}`
    : `/review/${review.id}`;

  return (
    <Link
      to={linkTo}
      className="group block overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Cover Image */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
        {coverPhoto ? (
          <img
            src={coverPhoto}
            alt={review.restaurant_name || "Review"}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <FileText className="h-12 w-12 text-gray-300" />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-1 truncate font-semibold text-gray-900">
          {review.restaurant_name || "Bài viết"}
        </h3>
        <p className="mb-3 line-clamp-2 text-sm text-gray-600">{review.text}</p>

        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{formatDateDisplay(review.created_at)}</span>
          <div className="flex items-center gap-3">
            {review.rating_overall && (
              <span className="font-medium text-yellow-600">
                ★ {review.rating_overall.toFixed(1)}
              </span>
            )}
            <span>{review.upvote_count} thích</span>
            <span>{review.comment_count} bình luận</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
