import { useState, useEffect } from "react";
import { RestaurantReview, RestaurantReviewsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { ReviewForm } from "../ReviewForm";
import { ReviewItem } from "../ReviewItem";

interface ReviewsTabProps {
  restaurantId: number;
}

export function ReviewsTab({ restaurantId }: ReviewsTabProps) {
  const [reviews, setReviews] = useState<RestaurantReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchReviews = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<RestaurantReviewsResponse>(
          `/reviews/restaurant/${restaurantId}?page=1&limit=10`
        );
        setReviews(response.data.reviews);
        setHasMore(response.data.page < response.data.total_pages);
        setPage(1);
      } catch (error) {
        console.error("Failed to fetch reviews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchReviews();
  }, [restaurantId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await apiClient.get<RestaurantReviewsResponse>(
        `/reviews/restaurant/${restaurantId}?page=${nextPage}&limit=10`
      );
      setReviews((prev) => [...prev, ...response.data.reviews]);
      setHasMore(response.data.page < response.data.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more reviews:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (data: {
    content: string;
    ratings: Record<string, number>;
    photos: File[];
  }) => {
    try {
      setSubmitting(true);

      const ratingValues = Object.values(data.ratings).filter((r) => r > 0);
      const overallRating =
        ratingValues.length > 0
          ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          : 0;

      const payload = {
        restaurant_id: restaurantId,
        content: data.content,
        ratings: data.ratings,
        overall_rating: overallRating,
        // TODO: Upload photos first, then include URLs
      };

      const response = await apiClient.post<RestaurantReview>("/reviews", payload);
      setReviews((prev) => [response.data, ...prev]);
    } catch (error) {
      console.error("Failed to submit review:", error);
      alert("Không thể gửi nhận xét. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ReviewForm onSubmit={handleSubmit} loading={submitting} />

      <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Chưa có nhận xét nào. Hãy là người đầu tiên!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewItem key={review.id} review={review} formatTime={formatRelativeTime} />
          ))
        )}

        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="mt-6 w-full py-3 text-center text-sm text-gray-500 hover:text-primary-500 disabled:opacity-50"
          >
            {loadingMore ? "Đang tải..." : "Nhấn để xem thêm nhận xét..."}
          </button>
        )}
      </div>
    </div>
  );
}
