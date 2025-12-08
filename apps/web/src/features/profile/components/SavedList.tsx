import { Bookmark } from "lucide-react";
import { Link } from "react-router-dom";
import type { SavedRestaurant } from "../types";
import { formatDateDisplay, formatPrice } from "../utils";

interface SavedListProps {
  saved: SavedRestaurant[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function SavedList({ saved, loading, error, hasMore, onLoadMore }: SavedListProps) {
  if (loading && saved.length === 0) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>
    );
  }

  if (saved.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
        <Bookmark className="h-10 w-10 text-gray-400" />
        <p className="mt-3 text-gray-600">Chưa có địa điểm nào được lưu</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {saved.map((item) => (
          <SavedCard key={item.restaurant_id} item={item} />
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

function SavedCard({ item }: { item: SavedRestaurant }) {
  return (
    <Link
      to={`/place/${item.slug}`}
      className="group block overflow-hidden rounded-lg bg-white shadow-sm ring-1 ring-gray-200 transition hover:-translate-y-0.5 hover:shadow-md"
    >
      {/* Cover Image */}
      <div className="aspect-[16/9] w-full overflow-hidden bg-gray-100">
        {item.cover_url ? (
          <img
            src={item.cover_url}
            alt={item.name}
            className="h-full w-full object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary-100 to-primary-200">
            <span className="text-4xl font-bold text-primary-400">
              {item.name.charAt(0).toUpperCase()}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="mb-1 truncate font-semibold text-gray-900">{item.name}</h3>
        
        {item.address && (
          <p className="mb-2 truncate text-sm text-gray-500">
            {item.address}{item.ward ? `, ${item.ward}` : ""}
          </p>
        )}
        
        {/* Meta */}
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-2">
            {item.rating_overall && (
              <span className="font-medium text-yellow-600">
                ★ {item.rating_overall.toFixed(1)}
              </span>
            )}
            {item.review_count !== undefined && (
              <span>({item.review_count} đánh giá)</span>
            )}
          </div>
          
          {(item.price_min || item.price_max) && (
            <span className="text-gray-600">
              {formatPrice(item.price_min, item.price_max)}
            </span>
          )}
        </div>

        {/* Saved date */}
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-400">
          <Bookmark className="h-3 w-3" />
          <span>Đã lưu {formatDateDisplay(item.saved_at)}</span>
        </div>
      </div>
    </Link>
  );
}
