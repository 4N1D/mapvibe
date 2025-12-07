import { useState, useEffect } from 'react';
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

export default function PendingLocationsPage() {
  const navigate = useNavigate();
  const [locations, setLocations] = useState<PendingLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'date' | 'reviews'>('date');
  const { confirm, ConfirmDialog } = useConfirm();

  useEffect(() => {
    loadPendingLocations();
  }, []);

  const loadPendingLocations = async () => {
    try {
      const response = await apiClient.get('/admin/locations/pending');
      setLocations(response.data.locations || []);
    } catch (error: any) {
      console.error('Failed to load pending locations:', error);
      toast.error('Failed to load pending locations');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkAction = async (action: 'approve' | 'reject') => {
    if (selectedIds.size === 0) {
      toast.error('Please select at least one location');
      return;
    }

    const confirmed = await confirm({
      title: `${action === 'approve' ? 'Approve' : 'Reject'} ${selectedIds.size} locations?`,
      message: `Are you sure you want to ${action} ${selectedIds.size} selected location(s)?`,
      confirmText: action === 'approve' ? 'Approve All' : 'Reject All',
      variant: action === 'approve' ? 'info' : 'warning',
    });

    if (!confirmed) return;

    const toastId = toast.loading(`Processing ${selectedIds.size} locations...`);
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiClient.patch(`/admin/locations/${id}`, { action })
        )
      );
      toast.success(`Successfully ${action}d ${selectedIds.size} locations`, { id: toastId });
      setSelectedIds(new Set());
      loadPendingLocations();
    } catch (error) {
      toast.error(`Failed to ${action} some locations`, { id: toastId });
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
    if (selectedIds.size === locations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(locations.map(l => l.id)));
    }
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffHours < 1) return 'Just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
    return `${Math.floor(diffDays / 30)}mo ago`;
  };

  const sortedLocations = [...locations].sort((a, b) => {
    if (sortBy === 'reviews') {
      return (b.review_count || 0) - (a.review_count || 0);
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Pending Locations' },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">
            Pending Locations
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {locations.length} location{locations.length !== 1 ? 's' : ''} awaiting review
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Sort */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'reviews')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          >
            <option value="date">Newest First</option>
            <option value="reviews">Most Reviews</option>
          </select>

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">{selectedIds.size} selected</span>
              <button
                onClick={() => handleBulkAction('approve')}
                className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700 transition-colors"
              >
                Approve All
              </button>
              <button
                onClick={() => handleBulkAction('reject')}
                className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
              >
                Reject All
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonLocationCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && locations.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <div className="w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900">All caught up!</h3>
          <p className="mt-2 text-sm text-gray-500">No pending locations to review.</p>
        </div>
      )}

      {/* Location Grid */}
      {!loading && locations.length > 0 && (
        <>
          {/* Select All */}
          <div className="flex items-center gap-2 px-2">
            <input
              type="checkbox"
              checked={selectedIds.size === locations.length}
              onChange={toggleSelectAll}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-600">Select all</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedLocations.map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                selected={selectedIds.has(location.id)}
                onSelect={() => toggleSelect(location.id)}
                onClick={() => navigate(`/locations/${location.id}`)}
                formatTimeAgo={formatTimeAgo}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function LocationCard({
  location,
  selected,
  onSelect,
  onClick,
  formatTimeAgo,
}: {
  location: PendingLocation;
  selected: boolean;
  onSelect: () => void;
  onClick: () => void;
  formatTimeAgo: (date: string) => string;
}) {
  return (
    <div
      className={`bg-white rounded-lg shadow hover:shadow-md transition-all cursor-pointer border-2 ${
        selected ? 'border-primary-500 ring-2 ring-primary-200' : 'border-transparent'
      }`}
    >
      <div className="p-6">
        {/* Header with checkbox */}
        <div className="flex items-start gap-3">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => {
              e.stopPropagation();
              onSelect();
            }}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
          />
          <div className="flex-1 min-w-0" onClick={onClick}>
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {location.restaurant_name || 'Unknown Place'}
              </h3>
              <span className="flex-shrink-0 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                {location.review_count || 0} reviews
              </span>
            </div>
            <p className="text-sm text-gray-600 mt-1 line-clamp-2">
              {location.full_address || `${location.street_address}, ${location.ward}, ${location.city}`}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between" onClick={onClick}>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTimeAgo(location.created_at)}
          </div>
          <button className="text-primary-600 hover:text-primary-700 font-medium text-sm flex items-center gap-1">
            Review
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
