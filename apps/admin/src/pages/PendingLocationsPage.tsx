import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiClient } from "../lib/api";
import { Breadcrumbs, SkeletonLocationCard } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";

interface PendingLocation {
  id: string;
  restaurant_name: string;
  full_address: string;
  street_address: string;
  ward: string;
  city: string;
  review_count: number;
  created_at: string;
  submitted_by_name?: string;
}

type SortOption = "newest" | "oldest" | "most_reviews" | "name_asc";
type FilterOption = "all" | "today" | "week" | "month";

export default function PendingLocationsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<PendingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [filterBy, setFilterBy] = useState<FilterOption>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadPendingLocations();
  }, []);

  const loadPendingLocations = async () => {
    try {
      const response = await apiClient.get("/admin/locations/pending");
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error("Failed to load pending locations:", error);
      toast.error("Không thể tải danh sách chờ duyệt");
    } finally {
      setLoading(false);
    }
  };

  // Filter and sort locations
  const filteredAndSortedLocations = useMemo(() => {
    let result = [...locations];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (loc) =>
          loc.restaurant_name?.toLowerCase().includes(query) ||
          loc.full_address?.toLowerCase().includes(query) ||
          loc.street_address?.toLowerCase().includes(query) ||
          loc.ward?.toLowerCase().includes(query) ||
          loc.city?.toLowerCase().includes(query) ||
          loc.submitted_by_name?.toLowerCase().includes(query)
      );
    }

    // Date filter
    const now = new Date();
    if (filterBy !== "all") {
      result = result.filter((loc) => {
        const created = new Date(loc.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));

        switch (filterBy) {
          case "today":
            return diffDays < 1;
          case "week":
            return diffDays < 7;
          case "month":
            return diffDays < 30;
          default:
            return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case "oldest":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "most_reviews":
          return (b.review_count || 0) - (a.review_count || 0);
        case "name_asc":
          return (a.restaurant_name || "").localeCompare(b.restaurant_name || "");
        case "newest":
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [locations, searchQuery, filterBy, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayCount = locations.filter((loc) => {
      const diff = Math.floor(
        (now.getTime() - new Date(loc.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return diff < 1;
    }).length;

    const weekCount = locations.filter((loc) => {
      const diff = Math.floor(
        (now.getTime() - new Date(loc.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      return diff < 7;
    }).length;

    const totalReviews = locations.reduce((sum, loc) => sum + (loc.review_count || 0), 0);

    return { total: locations.length, today: todayCount, week: weekCount, totalReviews };
  }, [locations]);

  const handleBulkAction = async (action: "approve" | "reject") => {
    if (selectedIds.size === 0) {
      toast.error("Vui lòng chọn ít nhất một địa điểm");
      return;
    }

    const confirmed = await confirm({
      title: `${action === "approve" ? "Duyệt" : "Từ chối"} ${selectedIds.size} địa điểm?`,
      message: `Bạn có chắc muốn ${action === "approve" ? "duyệt" : "từ chối"} ${selectedIds.size} địa điểm đã chọn?`,
      confirmText: action === "approve" ? "Duyệt tất cả" : "Từ chối tất cả",
      variant: action === "approve" ? "info" : "danger",
    });

    if (!confirmed) return;

    const toastId = toast.loading(`Đang xử lý ${selectedIds.size} địa điểm...`);

    try {
      await Promise.all(
        Array.from(selectedIds).map((id) => apiClient.patch(`/admin/locations/${id}`, { action }))
      );
      toast.success(
        `Đã ${action === "approve" ? "duyệt" : "từ chối"} ${selectedIds.size} địa điểm`,
        { id: toastId }
      );
      setSelectedIds(new Set());
      loadPendingLocations();
    } catch (error) {
      toast.error(`Không thể ${action === "approve" ? "duyệt" : "từ chối"} một số địa điểm`, {
        id: toastId,
      });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredAndSortedLocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredAndSortedLocations.map((l) => l.id)));
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 7) return `${diffDays} ngày trước`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} tuần trước`;
    return `${Math.floor(diffDays / 30)} tháng trước`;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterBy("all");
    setSortBy("newest");
  };

  const hasActiveFilters = searchQuery || filterBy !== "all" || sortBy !== "newest";

  return (
    <div className="space-y-4 md:space-y-6">
      <ConfirmDialog />

      {/* Mobile-friendly Breadcrumbs */}
      <div className="hidden sm:block">
        <Breadcrumbs items={[{ label: "Tổng quan", href: "/" }, { label: "Chờ duyệt" }]} />
      </div>

      {/* Stats Cards - Scrollable on mobile */}
      <div className="scrollbar-hidden -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-4 md:px-0">
        <StatCard
          label="Tổng chờ duyệt"
          value={stats.total}
          icon={<ClockIcon />}
          color="primary"
        />
        <StatCard
          label="Hôm nay"
          value={stats.today}
          icon={<TodayIcon />}
          color="accent"
        />
        <StatCard
          label="Tuần này"
          value={stats.week}
          icon={<WeekIcon />}
          color="secondary"
        />
        <StatCard
          label="Tổng bài viết"
          value={stats.totalReviews}
          icon={<ReviewIcon />}
          color="gray"
        />
      </div>

      {/* Search & Filters */}
      <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        {/* Search Bar */}
        <div
          className={`relative transition-all ${isSearchFocused ? "rounded-lg ring-2 ring-primary-500" : ""}`}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon
              className={`h-5 w-5 ${isSearchFocused ? "text-primary-500" : "text-gray-400"}`}
            />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên, địa chỉ, phường, hoặc người gửi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="block w-full rounded-lg border border-gray-300 py-3 pl-10 pr-10 text-sm placeholder-gray-400 focus:border-primary-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute inset-y-0 right-0 flex items-center pr-3"
            >
              <XIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-1 items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
            <span className="whitespace-nowrap text-sm text-gray-500">Lọc:</span>
            <FilterButton
              active={filterBy === "all"}
              onClick={() => setFilterBy("all")}
            >
              Tất cả
            </FilterButton>
            <FilterButton
              active={filterBy === "today"}
              onClick={() => setFilterBy("today")}
              badge={stats.today > 0 ? stats.today : undefined}
            >
              Hôm nay
            </FilterButton>
            <FilterButton
              active={filterBy === "week"}
              onClick={() => setFilterBy("week")}
            >
              Tuần này
            </FilterButton>
            <FilterButton
              active={filterBy === "month"}
              onClick={() => setFilterBy("month")}
            >
              Tháng này
            </FilterButton>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-primary-500"
            >
              <option value="newest">Mới nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="most_reviews">Nhiều bài viết nhất</option>
              <option value="name_asc">Tên A-Z</option>
            </select>
          </div>
        </div>

        {/* Active Filters Summary */}
        {hasActiveFilters && (
          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
            <span className="text-sm text-gray-600">
              Hiển thị <strong>{filteredAndSortedLocations.length}</strong> / {locations.length} địa
              điểm
            </span>
            <button
              onClick={clearFilters}
              className="text-sm font-medium text-primary-600 hover:text-primary-700"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 flex flex-col justify-between gap-3 rounded-xl border border-primary-200 bg-primary-50 p-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredAndSortedLocations.length}
              onChange={toggleSelectAll}
              className="h-4 w-4 rounded border-gray-300 text-primary-600"
            />
            <span className="text-sm font-medium text-primary-900">
              Đã chọn {selectedIds.size} địa điểm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction("approve")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-secondary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-secondary-700 sm:flex-none"
            >
              <CheckIcon className="h-4 w-4" />
              Duyệt tất cả
            </button>
            <button
              onClick={() => handleBulkAction("reject")}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-700 sm:flex-none"
            >
              <XIcon className="h-4 w-4" />
              Từ chối tất cả
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLocationCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && locations.length === 0 && <EmptyState type="no-data" />}

      {/* No Search Results */}
      {!loading && locations.length > 0 && filteredAndSortedLocations.length === 0 && (
        <EmptyState
          type="no-results"
          onClear={clearFilters}
        />
      )}

      {/* Location Grid */}
      {!loading && filteredAndSortedLocations.length > 0 && (
        <>
          {/* Select All - Only show when not already in bulk mode */}
          {selectedIds.size === 0 && (
            <div className="flex items-center gap-2 px-1">
              <input
                type="checkbox"
                checked={false}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-500">
                Chọn tất cả ({filteredAndSortedLocations.length})
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredAndSortedLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                selected={selectedIds.has(location.id)}
                onSelect={() => toggleSelect(location.id)}
                onClick={() => navigate(`/locations/${location.id}`)}
                formatTimeAgo={formatTimeAgo}
                searchQuery={searchQuery}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// Components

function StatCard({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: "primary" | "secondary" | "accent" | "gray";
}) {
  const colors = {
    primary: "bg-primary-50 text-primary-600 border-primary-100",
    secondary: "bg-secondary-50 text-secondary-600 border-secondary-100",
    accent: "bg-accent-50 text-accent-600 border-accent-100",
    gray: "bg-gray-50 text-gray-600 border-gray-100",
  };

  return (
    <div className={`w-36 flex-shrink-0 rounded-xl border p-4 md:w-auto ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-white p-2 shadow-sm">{icon}</div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs opacity-80">{label}</p>
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
  badge,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
      }`}
    >
      {children}
      {badge !== undefined && (
        <span
          className={`rounded-full px-1.5 py-0.5 text-xs ${
            active ? "bg-white/20 text-white" : "bg-primary-100 text-primary-600"
          }`}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({ type, onClear }: { type: "no-data" | "no-results"; onClear?: () => void }) {
  if (type === "no-results") {
    return (
      <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
          <SearchIcon className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Không tìm thấy kết quả</h3>
        <p className="mt-2 text-sm text-gray-500">Thử điều chỉnh tìm kiếm hoặc bộ lọc</p>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-4 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white py-12 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-secondary-100">
        <CheckIcon className="h-8 w-8 text-secondary-600" />
      </div>
      <h3 className="text-lg font-medium text-gray-900">Đã xử lý hết!</h3>
      <p className="mt-2 text-sm text-gray-500">Không có địa điểm nào cần duyệt.</p>
    </div>
  );
}

function LocationCard({
  location,
  selected,
  onSelect,
  onClick,
  formatTimeAgo,
  searchQuery,
}: {
  location: PendingLocation;
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
  formatTimeAgo: (date: string) => string;
  searchQuery: string;
}) {
  const highlightText = (text: string) => {
    if (!searchQuery.trim() || !text) return text;
    const parts = text.split(new RegExp(`(${searchQuery})`, "gi"));
    return parts.map((part, i) =>
      part.toLowerCase() === searchQuery.toLowerCase() ? (
        <mark
          key={i}
          className="rounded bg-yellow-200 px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const timeAgo = formatTimeAgo(location.created_at);
  const isNew = timeAgo.includes("phút trước") || timeAgo.includes("giờ trước");

  return (
    <div
      className={`group rounded-xl border-2 bg-white shadow-sm transition-all hover:shadow-md ${
        selected
          ? "border-primary-500 ring-2 ring-primary-100"
          : "border-transparent hover:border-gray-200"
      }`}
    >
      <div className="p-4 md:p-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 h-4 w-4 cursor-pointer rounded border-gray-300 text-primary-600 focus:ring-primary-500"
          />
          <div
            className="min-w-0 flex-1 cursor-pointer"
            onClick={onClick}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="line-clamp-1 text-base font-semibold text-gray-900 transition-colors group-hover:text-primary-600">
                {highlightText(location.restaurant_name || "Chưa có tên")}
              </h3>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                {isNew && (
                  <span className="rounded-full bg-accent-100 px-2 py-0.5 text-xs font-medium text-accent-700">
                    Mới
                  </span>
                )}
                <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                  {location.review_count || 0} bài viết
                </span>
              </div>
            </div>

            {/* Address */}
            <p className="mt-1.5 line-clamp-2 text-sm text-gray-500">
              <span className="inline-flex items-center gap-1">
                <LocationIcon className="h-3.5 w-3.5 flex-shrink-0" />
                {highlightText(
                  location.full_address ||
                    `${location.street_address}, ${location.ward}, ${location.city}`
                )}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div
          className="mt-4 flex items-center justify-between border-t border-gray-100 pt-3"
          onClick={onClick}
        >
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              {timeAgo}
            </span>
            {location.submitted_by_name && (
              <span className="flex items-center gap-1">
                <UserIcon className="h-3.5 w-3.5" />
                {highlightText(location.submitted_by_name)}
              </span>
            )}
          </div>
          <button className="flex items-center gap-1 text-sm font-medium text-primary-600 opacity-0 transition-opacity hover:text-primary-700 group-hover:opacity-100">
            Xem chi tiết
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const XIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M6 18L18 6M6 6l12 12"
    />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const ClockIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TodayIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

const WeekIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
    />
  </svg>
);

const ReviewIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
    />
  </svg>
);

const LocationIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const UserIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

const ChevronRightIcon = ({ className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5l7 7-7 7"
    />
  </svg>
);
