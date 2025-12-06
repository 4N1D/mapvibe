import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { HotReview, HotReviewsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { ReviewCard } from "./ReviewCard";

function getReviewTags(score: string, upvoteCount: number): string[] {
  const tags: string[] = [];
  const scoreNum = parseFloat(score);

  if (scoreNum > 0.05) tags.push("trending");
  if (upvoteCount > 0) tags.push("hot");

  return tags.length > 0 ? tags : ["new"];
}

export function FeaturedReviews() {
  const [reviews, setReviews] = useState<HotReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchHotReviews = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<HotReviewsResponse>("/reviews/hot");
        setReviews(response.data.reviews);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Không thể tải reviews");
      } finally {
        setLoading(false);
      }
    };

    fetchHotReviews();
  }, []);

  if (loading) {
    return (
      <div className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-primary-500" />
            <h2 className="text-3xl font-bold text-gray-900">Review nổi bật</h2>
          </div>
          <p className="mb-8 text-gray-600">Những bài đánh giá đang được quan tâm nhiều nhất</p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <ReviewCard key={i} loading />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-red-500">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary-500" />
          <h2 className="text-3xl font-bold text-gray-900">Review nổi bật</h2>
        </div>
        <p className="mb-8 text-gray-600">Những bài đánh giá đang được quan tâm nhiều nhất</p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              data={review}
              tags={getReviewTags(review.score, review.upvote_count)}
              formatTime={formatRelativeTime}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
