import { Card, CardContent } from "@mapvibe/ui-components";
import { Heart, MessageCircle } from "lucide-react";
import { HotReview } from "@mapvibe/types";
import { Skeleton, SkeletonText, SkeletonCircle } from "@mapvibe/ui-components";

interface ReviewCardProps {
  data?: HotReview;
  loading?: boolean;
  tags?: string[];
  formatTime?: (date: string) => string;
}

export function ReviewCard({ data, loading, tags = [], formatTime }: ReviewCardProps) {
  if (loading) {
    return (
      <Card className="overflow-hidden">
        {/* Image skeleton */}
        <Skeleton className="h-48 w-full rounded-none" />

        <CardContent className="space-y-3 p-4">
          {/* Tags skeleton */}
          <div className="flex gap-1">
            <Skeleton className="h-5 w-12" />
            <Skeleton className="h-5 w-16" />
          </div>

          {/* Text skeleton */}
          <SkeletonText lines={3} />

          {/* Author skeleton */}
          <div className="flex items-center justify-between border-t border-gray-100 pt-2">
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

  return (
    <Card className="cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
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

        {/* Tags */}
        <div className="absolute left-2 top-2 flex gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                tag === "hot"
                  ? "bg-red-500 text-white"
                  : tag === "trending"
                    ? "bg-orange-500 text-white"
                    : "bg-blue-500 text-white"
              }`}
            >
              {tag === "hot" ? "🔥 Hot" : tag === "trending" ? "📈 Trending" : "✨ New"}
            </span>
          ))}
        </div>
      </div>

      <CardContent className="space-y-3 p-4">
        {/* Tag */}
        {data.tag && (
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
              data.tag === "hot"
                ? "bg-red-100 text-red-600"
                : data.tag === "new"
                  ? "bg-blue-100 text-blue-600"
                  : "bg-gray-100 text-gray-600"
            }`}
          >
            {data.tag}
          </span>
        )}

        {/* Review content */}
        <p className="line-clamp-3 text-sm text-gray-600">{data.text}</p>

        {/* Reviewer info */}
        <div className="flex items-center justify-between border-t border-gray-100 pt-2">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300">
              <span className="text-xs font-medium text-gray-600">
                {(data.author_name || data.author_id).charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-900">{data.author_name || data.author_id}</p>
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
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
