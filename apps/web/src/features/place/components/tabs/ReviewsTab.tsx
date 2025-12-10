import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RestaurantReview, RestaurantReviewsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { ReviewForm } from "../ReviewForm";
import { ReviewItem } from "../ReviewItem";
import toast from "react-hot-toast";

interface ReviewsTabProps {
  restaurantId: string;
  slug?: string;
}

interface ReviewsApiResponse {
  restaurant_id: string;
  reviews: Array<{
    id: string;
    text: string;
    photos?: string;
    rating_service: number;
    rating_location: number;
    rating_price: number;
    rating_quality: number;
    rating_ambiance: number;
    rating_overall: number;
    upvote_count: number;
    comment_count: number;
    created_at: string;
    author_id: string;
    author_name: string;
    author_avatar?: string;
    user_has_liked?: boolean;
  }>;
  pagination: { limit: number; offset: number; total: number };
}

const fetchReviews = async (slug: string, page: number) => {
  const offset = (page - 1) * 10;
  const response = await apiClient.get<ReviewsApiResponse>(
    `/restaurants/${slug}/reviews?limit=10&offset=${offset}`
  );
  
  const data = response.data;
  const reviews = (data.reviews || []).map(r => ({
    id: r.id,
    author_id: r.author_id,
    author_name: r.author_name,
    author_avatar: r.author_avatar,
    restaurant_id: data.restaurant_id,
    content: r.text,
    ratings: {
      quality: r.rating_quality,
      service: r.rating_service,
      location: r.rating_location,
      price: r.rating_price,
      ambiance: r.rating_ambiance,
    },
    overall_rating: r.rating_overall,
    photos: r.photos ? (typeof r.photos === 'string' ? JSON.parse(r.photos) : r.photos) : [],
    like_count: r.upvote_count,
    comment_count: r.comment_count,
    created_at: r.created_at,
    user_has_liked: r.user_has_liked || false,
  }));
  
  return {
    reviews,
    page,
    total_pages: Math.ceil((data.pagination?.total || reviews.length) / 10),
  };
};

export function ReviewsTab({ restaurantId, slug }: ReviewsTabProps) {
  const [localReviews, setLocalReviews] = useState<RestaurantReview[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const { data } = useQuery({
    queryKey: ["reviews", slug],
    queryFn: () => fetchReviews(slug!, 1),
    placeholderData: (prev) => prev,
    enabled: !!slug,
  });

  const reviews = localReviews.length > 0 ? localReviews : data?.reviews || [];

  if (data && localReviews.length === 0 && hasMore !== data.page < data.total_pages) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    if (!slug) return;
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchReviews(slug, nextPage);
      const currentReviews = localReviews.length > 0 ? localReviews : data?.reviews || [];
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

      // Calculate overall rating
      const ratingValues = Object.values(submitData.ratings).filter((r) => r > 0);
      const overallRating =
        ratingValues.length > 0 ? ratingValues.reduce((a, b) => a + b, 0) / ratingValues.length : 5;

      // Get user ID from profile
      const profileRes = await apiClient.get<{ user: { id: string } }>("/users/me");
      const authorId = profileRes.data.user.id;

      // Upload photos first
      const photoUrls: string[] = [];
      for (const photo of submitData.photos) {
        try {
          // Get presigned upload URL
          const uploadRes = await apiClient.post<{
            upload_url: string;
            cdn_url: string;
          }>("/photos/upload-url", {
            photo_type: "food",
            content_type: photo.type,
            file_size: photo.size,
            restaurant_id: restaurantId,
          });

          // Upload to S3 directly
          await fetch(uploadRes.data.upload_url, {
            method: "PUT",
            body: photo,
            headers: { "Content-Type": photo.type },
          });

          photoUrls.push(uploadRes.data.cdn_url);
        } catch (err) {
          console.error("Failed to upload photo:", err);
        }
      }

      // API expects individual rating fields, not a ratings object
      const payload = {
        author_id: authorId,
        text: submitData.content,
        photos: photoUrls,
        rating_quality: submitData.ratings.quality || 5,
        rating_service: submitData.ratings.service || 5,
        rating_location: submitData.ratings.location || 5,
        rating_price: submitData.ratings.price || 5,
        rating_ambiance: submitData.ratings.ambiance || 5,
        rating_overall: overallRating || 5,
      };

      const response = await apiClient.post<{ review: any }>(`/restaurants/${slug}/reviews`, payload);
      
      // Transform response to match expected format
      const newReview = {
        id: response.data.review.id,
        author_id: authorId,
        author_name: "Bạn",
        content: submitData.content,
        ratings: submitData.ratings,
        overall_rating: overallRating,
        photos: photoUrls,
        like_count: 0,
        comment_count: 0,
        created_at: new Date().toISOString(),
      };
      
      const currentReviews = localReviews.length > 0 ? localReviews : data?.reviews || [];
      setLocalReviews([newReview as any, ...currentReviews]);
      toast.success("Đã gửi nhận xét thành công!");
    } catch (error: any) {
      console.error("Failed to submit review:", error);
      const message = error.response?.data?.error || "Không thể gửi nhận xét. Vui lòng thử lại.";
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <ReviewForm
        onSubmit={handleSubmit}
        loading={submitting}
      />

      <div className="rounded-lg bg-white p-4 shadow-sm sm:p-6">
        {reviews.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Chưa có nhận xét nào. Hãy là người đầu tiên!
          </p>
        ) : (
          reviews.map((review) => (
            <ReviewItem
              key={review.id}
              review={review}
              formatTime={formatRelativeTime}
            />
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
