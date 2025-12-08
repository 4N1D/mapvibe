import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { Breadcrumbs, SkeletonLocationCard } from '../components/ui';
import { useConfirm } from '../hooks/useConfirm';

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

type SortOption = 'newest' | 'oldest' | 'most_reviews' | 'name_asc';
type FilterOption = 'all' | 'today' | 'week' | 'month';

export default function PendingLocationsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<PendingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<SortOption>('newest');
  const [filterBy, setFilterBy] = useState<FilterOption>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadPendingLocations();
  }, []);

  const loadPendingLocations = async () => {
    try {
      const response = await apiClient.get('/admin/locations/pending');
      setLocations(response.data.locations || []);
    } catch (error) {
      console.error('Failed to load pending locations:', error);
      toast.error('Không thể tải danh sách chờ duyệt');
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
      result = result.filter(loc => 
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
    if (filterBy !== 'all') {
      result = result.filter(loc => {
        const created = new Date(loc.created_at);
        const diffDays = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
        
        switch (filterBy) {
          case 'today': return diffDays < 1;
          case 'week': return diffDays < 7;
          case 'month': return diffDays < 30;
          default: return true;
        }
      });
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'oldest':
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'most_reviews':
          return (b.review_count || 0) - (a.review_count || 0);
        case 'name_asc':
          return (a.restaurant_name || '').localeCompare(b.restaurant_name || '');
        case 'newest':
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

    return result;
  }, [locations, searchQuery, filterBy, sortBy]);

  // Stats
  const stats = useMemo(() => {
    const now = new Date();
    const todayCount = locations.filter(loc => {
      const diff = Math.floor((now.getTime() - new Date(loc.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return diff < 1;
    }).length;
    
    const weekCount = locations.filter(loc => {
      const diff = Math.floor((now.getTime() - new Date(loc.created_at).getTime()) / (1000 * 60 * 60 * 24));
      return diff < 7;
    }).length;

    const totalReviews = locations.reduce((sum, loc) => sum + (loc.review_count || 0), 0);

    return { total: locations.length, today: todayCount, week: weekCount, totalReviews };
  }, [locations]);

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast.error('Vui lòng chọn ít nhất một địa điểm');
      return;
    }

    const confirmed = await confirm({
      title: `${action === 'approve' ? 'Duyệt' : 'Từ chối'} ${selectedIds.size} địa điểm?`,
      message: `Bạn có chắc muốn ${action === 'approve' ? 'duyệt' : 'từ chối'} ${selectedIds.size} địa điểm đã chọn?`,
      confirmText: action === 'approve' ? 'Duyệt tất cả' : 'Từ chối tất cả',
      variant: action === 'approve' ? 'info' : 'danger',
    });

    if (!confirmed) return;

    const toastId = toast.loading(`Đang xử lý ${selectedIds.size} địa điểm...`);
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiClient.patch(`/admin/locations/${id}`, { action })
        )
      );
      toast.success(`Đã ${action === 'approve' ? 'duyệt' : 'từ chối'} ${selectedIds.size} địa điểm`, { id: toastId });
      setSelectedIds(new Set());
      loadPendingLocations();
    } catch (error) {
      toast.error(`Không thể ${action === 'approve' ? 'duyệt' : 'từ chối'} một số địa điểm`, { id: toastId });
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
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
      setSelectedIds(new Set(filteredAndSortedLocations.map(l => l.id)));
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
    setSearchQuery('');
    setFilterBy('all');
    setSortBy('newest');
  };

  const hasActiveFilters = searchQuery || filterBy !== 'all' || sortBy !== 'newest';

  return (
    <div className="space-y-4 md:space-y-6">
      <ConfirmDialog />
      
      {/* Mobile-friendly Breadcrumbs */}
      <div className="hidden sm:block">
        <Breadcrumbs items={[
          { label: 'Tổng quan', href: '/' },
          { label: 'Chờ duyệt' },
        ]} />
      </div>

      {/* Stats Cards - Scrollable on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-4 scrollbar-hidden">
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
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        {/* Search Bar */}
        <div className={`relative transition-all ${isSearchFocused ? 'ring-2 ring-primary-500 rounded-lg' : ''}`}>
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <SearchIcon className={`w-5 h-5 ${isSearchFocused ? 'text-primary-500' : 'text-gray-400'}`} />
          </div>
          <input
            type="text"
            placeholder="Tìm theo tên, địa chỉ, phường, hoặc người gửi..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => setIsSearchFocused(false)}
            className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg text-sm placeholder-gray-400 focus:outline-none focus:border-primary-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center"
            >
              <XIcon className="w-5 h-5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Filters Row */}
        <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-2 flex-1 overflow-x-auto pb-2 sm:pb-0">
            <span className="text-sm text-gray-500 whitespace-nowrap">Lọc:</span>
            <FilterButton 
              active={filterBy === 'all'} 
              onClick={() => setFilterBy('all')}
            >
              Tất cả
            </FilterButton>
            <FilterButton 
              active={filterBy === 'today'} 
              onClick={() => setFilterBy('today')}
              badge={stats.today > 0 ? stats.today : undefined}
            >
              Hôm nay
            </FilterButton>
            <FilterButton 
              active={filterBy === 'week'} 
              onClick={() => setFilterBy('week')}
            >
              Tuần này
            </FilterButton>
            <FilterButton 
              active={filterBy === 'month'} 
              onClick={() => setFilterBy('month')}
            >
              Tháng này
            </FilterButton>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sắp xếp:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
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
          <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              Hiển thị <strong>{filteredAndSortedLocations.length}</strong> / {locations.length} địa điểm
            </span>
            <button
              onClick={clearFilters}
              className="text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              Xóa bộ lọc
            </button>
          </div>
        )}
      </div>

      {/* Bulk Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-0 z-10 bg-primary-50 border border-primary-200 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={selectedIds.size === filteredAndSortedLocations.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-primary-600 rounded border-gray-300"
            />
            <span className="text-sm font-medium text-primary-900">
              Đã chọn {selectedIds.size} địa điểm
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleBulkAction('approve')}
              className="flex-1 sm:flex-none px-4 py-2 bg-secondary-600 text-white rounded-lg text-sm font-medium hover:bg-secondary-700 transition-colors flex items-center justify-center gap-2"
            >
              <CheckIcon className="w-4 h-4" />
              Duyệt tất cả
            </button>
            <button
              onClick={() => handleBulkAction('reject')}
              className="flex-1 sm:flex-none px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
            >
              <XIcon className="w-4 h-4" />
              Từ chối tất cả
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="px-4 py-2 border border-gray-300 bg-white text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Hủy
            </button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLocationCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && locations.length === 0 && (
        <EmptyState type="no-data" />
      )}

      {/* No Search Results */}
      {!loading && locations.length > 0 && filteredAndSortedLocations.length === 0 && (
        <EmptyState type="no-results" onClear={clearFilters} />
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
                className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-500">Chọn tất cả ({filteredAndSortedLocations.length})</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
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

function StatCard({ label, value, icon, color }: { 
  label: string; 
  value: number; 
  icon: React.ReactNode;
  color: 'primary' | 'secondary' | 'accent' | 'gray';
}) {
  const colors = {
    primary: 'bg-primary-50 text-primary-600 border-primary-100',
    secondary: 'bg-secondary-50 text-secondary-600 border-secondary-100',
    accent: 'bg-accent-50 text-accent-600 border-accent-100',
    gray: 'bg-gray-50 text-gray-600 border-gray-100',
  };

  return (
    <div className={`flex-shrink-0 w-36 md:w-auto p-4 rounded-xl border ${colors[color]}`}>
      <div className="flex items-center gap-3">
        <div className="p-2 bg-white rounded-lg shadow-sm">{icon}</div>
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
  badge 
}: { 
  children: React.ReactNode; 
  active: boolean; 
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
        active 
          ? 'bg-primary-500 text-white' 
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
      {badge !== undefined && (
        <span className={`px-1.5 py-0.5 rounded-full text-xs ${
          active ? 'bg-white/20 text-white' : 'bg-primary-100 text-primary-600'
        }`}>
          {badge}
        </span>
      )}
    </button>
  );
}

function EmptyState({ type, onClear }: { type: 'no-data' | 'no-results'; onClear?: () => void }) {
  if (type === 'no-results') {
    return (
      <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="w-16 h-16 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <SearchIcon className="w-8 h-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900">Không tìm thấy kết quả</h3>
        <p className="mt-2 text-sm text-gray-500">Thử điều chỉnh tìm kiếm hoặc bộ lọc</p>
        {onClear && (
          <button
            onClick={onClear}
            className="mt-4 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm font-medium hover:bg-primary-600 transition-colors"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="w-16 h-16 mx-auto bg-secondary-100 rounded-full flex items-center justify-center mb-4">
        <CheckIcon className="w-8 h-8 text-secondary-600" />
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
    const parts = text.split(new RegExp(`(${searchQuery})`, 'gi'));
    return parts.map((part, i) => 
      part.toLowerCase() === searchQuery.toLowerCase() 
        ? <mark key={i} className="bg-yellow-200 rounded px-0.5">{part}</mark>
        : part
    );
  };

  const timeAgo = formatTimeAgo(location.created_at);
  const isNew = timeAgo.includes('phút trước') || timeAgo.includes('giờ trước');

  return (
    <div
      className={`group bg-white rounded-xl shadow-sm hover:shadow-md transition-all border-2 ${
        selected ? 'border-primary-500 ring-2 ring-primary-100' : 'border-transparent hover:border-gray-200'
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
            className="mt-1 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500 cursor-pointer"
          />
          <div className="flex-1 min-w-0 cursor-pointer" onClick={onClick}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-base font-semibold text-gray-900 line-clamp-1 group-hover:text-primary-600 transition-colors">
                {highlightText(location.restaurant_name || 'Chưa có tên')}
              </h3>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {isNew && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-accent-100 text-accent-700">
                    Mới
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                  {location.review_count || 0} bài viết
                </span>
              </div>
            </div>
            
            {/* Address */}
            <p className="text-sm text-gray-500 mt-1.5 line-clamp-2">
              <span className="inline-flex items-center gap-1">
                <LocationIcon className="w-3.5 h-3.5 flex-shrink-0" />
                {highlightText(location.full_address || `${location.street_address}, ${location.ward}, ${location.city}`)}
              </span>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between" onClick={onClick}>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <ClockIcon className="w-3.5 h-3.5" />
              {timeAgo}
            </span>
            {location.submitted_by_name && (
              <span className="flex items-center gap-1">
                <UserIcon className="w-3.5 h-3.5" />
                {highlightText(location.submitted_by_name)}
              </span>
            )}
          </div>
          <button className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            Xem chi tiết
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Icons
const SearchIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
  </svg>
);

const XIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

const CheckIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const ClockIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
);

const TodayIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const WeekIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
  </svg>
);

const ReviewIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
  </svg>
);

const LocationIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
);

const UserIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChevronRightIcon = ({ className = "w-5 h-5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
  </svg>
);
