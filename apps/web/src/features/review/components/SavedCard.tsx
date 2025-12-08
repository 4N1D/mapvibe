import { Card, CardContent } from "@mapvibe/ui-components";
import { Bookmark, Heart, MessageCircle } from "lucide-react";

export interface SavedCardData {
  id: string;
  title: string;
  description?: string;
  cover_url?: string;
  created_at: string;
  author_name?: string;
  comments?: number;
  likes?: number;
  bookmarked?: boolean;
  onToggleBookmark?: () => void;
  showBookmark?: boolean;
}

interface SavedCardProps {
  data: SavedCardData;
  formatDate?: (date: string) => string;
}

export function SavedCard({ data, formatDate }: SavedCardProps) {
  if (!data) return null;

  return (
    <Card className="group cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg">
      {/* Image */}
      <div className="group relative h-48 bg-gray-200">
        {data.cover_url ? (
          <img
            src={data.cover_url}
            alt={data.title}
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

        {/* Author on hover (top-left) */}
        {data.author_name && (
          <div className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1 text-xs font-semibold text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            {data.author_name}
          </div>
        )}

        {/* Bookmark toggle (top-right) */}
        {data.showBookmark !== false && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onToggleBookmark?.();
            }}
            className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white opacity-0 transition-all duration-200 hover:bg-black/70 focus:outline-none focus:ring-2 focus:ring-white group-hover:opacity-100"
            aria-label={data.bookmarked ? "Bỏ lưu" : "Lưu bài viết"}
          >
            <Bookmark
              className={`h-5 w-5 transition-colors duration-200 ${
                data.bookmarked ? "fill-yellow-300 text-yellow-300" : "text-white"
              }`}
            />
          </button>
        )}
      </div>

      <CardContent className="space-y-3 p-4">
        <h3 className="line-clamp-1 text-base font-semibold text-gray-900">{data.title}</h3>
        {data.description && (
          <p className="line-clamp-2 text-sm text-gray-600">{data.description}</p>
        )}

        <div className="flex items-center justify-between border-t border-gray-100 pt-2 text-xs text-gray-500">
          <span>{formatDate ? formatDate(data.created_at) : data.created_at}</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs">
              <Heart className="h-3 w-3" />
              {data.likes ?? 0}
            </span>
            <span className="flex items-center gap-1 text-xs">
              <MessageCircle className="h-3 w-3" />
              {data.comments ?? 0}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
