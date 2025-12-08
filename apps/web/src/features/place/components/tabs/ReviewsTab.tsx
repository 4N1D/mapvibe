import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RestaurantReview, RestaurantReviewsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { ReviewForm } from "../ReviewForm";
import { ReviewItem } from "../ReviewItem";
import toast from "react-hot-toast";

interface ReviewsTabProps {
  restaurantId: number;
}

const fetchReviews = async (restaurantId: number, page: number) => {
  const response = await apiClient.get<RestaurantReviewsResponse>(
    `/reviews/restaurant/${restaurantId}?page=${page}&limit=10`
  );
  return response.data;
};

export function ReviewsTab({ restaurantId }: ReviewsTabProps) {
  const [localReviews, setLocalReviews] = useState<RestaurantReview[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { data } = useQuery({
    queryKey: ["reviews", restaurantId],
    queryFn: () => fetchReviews(restaurantId, 1),
    placeholderData: (prev) => prev,
  });

  const reviews = localReviews.length > 0 ? localReviews : (data?.reviews || []);

  if (data && localReviews.length === 0 && hasMore !== (data.page < data.total_pages)) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchReviews(restaurantId, nextPage);
      const currentReviews = localReviews.length > 0 ? localReviews : (data?.reviews || []);
      setLocalReviews([...currentReviews, ...response.reviews]);
      setHasMore(response.page < response.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more reviews:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (submitData: {
    content: string;
    ratings: Record<string, number>;
    photos: File[];
  }) => {
    try {
      setSubmitting(true);

      const ratingValues = Object.values(submitData.ratings).filter((r) => r > 0);
      const overallRating =
        ratingValues.length > 0
          ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length
          : 0;

      const payload = {
        restaurant_id: restaurantId,
        content: submitData.content,
        ratings: submitData.ratings,
        overall_rating: overallRating,
      };

      const response = await apiClient.post<RestaurantReview>("/reviews", payload);
      const currentReviews = localReviews.length > 0 ? localReviews : (data?.reviews || []);
      setLocalReviews([response.data, ...currentReviews]);
    } catch (error) {
      console.error("Failed to submit review:", error);
      toast.error("Không thể gửi nhận xét. Vui lòng thử lại.");
    } finally {
      setSubmitting(false);
    }
  };

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
