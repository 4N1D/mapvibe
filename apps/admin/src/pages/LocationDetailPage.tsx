import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { apiClient } from '../lib/api';
import { Breadcrumbs, Skeleton } from '../components/ui';
import { useConfirm } from '../hooks/useConfirm';

interface ReviewPost {
  id: string;
  author_name: string;
  author_avatar?: string;
  text: string;
  features?: Record<string, unknown>;
  photos?: string[];
  upvote_count: number;
  downvote_count: number;
  created_at: string;
}

interface LocationData {
  id: string;
  restaurant_name: string;
  full_address: string;
  street_address: string;
  ward: string;
  city: string;
  geo_lat?: number;
  geo_lng?: number;
  submitted_by_name?: string;
  submitted_by_email?: string;
  created_at: string;
}

interface CuisineType {
  name: string;
  description: string;
}

interface AggregateResult {
  location_address_id: string;
  restaurant_id: string | null;
  source_type: 'pending' | 'approved';
  reviews_used: string[];
  comments_used: string[];
  result: {
    name_vi?: string;
    slug?: string;
    address?: string;
    ward?: string;
    phone?: string;
    website?: string;
    geo_lat?: number;
    geo_lng?: number;
    business_type?: string;
    cuisine_types?: CuisineType[];
    price_min?: number;
    price_max?: number;
    opening_hours?: string;
    description?: string;
    features?: string[];
  };
}

type TabType = 'posts' | 'info';

export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ReviewPost | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('posts');
  const [aggregateResult, setAggregateResult] = useState<AggregateResult | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const [formData, setFormData] = useState({
    name_vi: '',
    cuisine_types: [] as CuisineType[],
    price_min: '',
    price_max: '',
    opening_hours: '',
    features: [] as string[],
    description: '',
  });

  useEffect(() => {
    loadLocationData();
  }, [id]);

  const loadLocationData = async () => {
    try {
      const [locationRes, postsRes] = await Promise.all([
        apiClient.get(`/admin/locations/${id}`),
        apiClient.get(`/admin/locations/${id}/reviews`),
      ]);
      
      const loc = locationRes.data.location || locationRes.data;
      setLocation(loc);
      
      // Sort posts by upvote_count DESC (matching API logic)
      const sortedPosts = (postsRes.data.reviews || []).sort(
        (a: ReviewPost, b: ReviewPost) => (b.upvote_count || 0) - (a.upvote_count || 0)
      );
      setPosts(sortedPosts);
      
      setFormData(prev => ({
        ...prev,
        name_vi: loc.restaurant_name || '',
      }));
      
      if (sortedPosts.length > 0) {
        setSelectedPost(sortedPosts[0]);
      }
    } catch (error) {
      console.error('Failed to load location:', error);
      toast.error('Failed to load location details');
    } finally {
      setLoading(false);
    }
  };

  const handleAIAggregate = async () => {
    if (posts.length === 0) {
      toast.error('No posts to aggregate');
      return;
    }
    
    setIsAggregating(true);
    try {
      const response = await apiClient.post('/reviews/aggregate-pending', {
        location_address_id: id,
      });
      
      const data: AggregateResult = response.data;
      setAggregateResult(data);
      
      const result = data.result;
      setFormData({
        name_vi: result.name_vi || formData.name_vi,
        cuisine_types: result.cuisine_types || [],
        price_min: result.price_min?.toString() || '',
        price_max: result.price_max?.toString() || '',
        opening_hours: result.opening_hours || '',
        features: result.features || [],
        description: result.description || '',
      });
      
      toast.success(`AI tổng hợp từ ${data.reviews_used.length} posts thành công!`);
      setActiveTab('info');
    } catch (error: any) {
      toast.error('Failed to aggregate: ' + (error.response?.data?.error || 'Unknown error'));
    } finally {
      setIsAggregating(false);
    }
  };

  const handleApprove = async () => {
    if (!formData.name_vi.trim()) {
      toast.error('Restaurant name is required');
      setActiveTab('info');
      return;
    }
    
    const confirmed = await confirm({
      title: 'Approve Location',
      message: `Create restaurant "${formData.name_vi}"?`,
      confirmText: 'Approve',
      variant: 'info',
    });
    
    if (!confirmed) return;
    
    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/locations/${id}`, {
        action: 'approve',
        ...formData,
        price_min: formData.price_min ? parseInt(formData.price_min) : null,
        price_max: formData.price_max ? parseInt(formData.price_max) : null,
      });
      toast.success('Location approved! Restaurant created.');
      navigate('/locations/pending');
    } catch (error: any) {
      toast.error('Failed to approve: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const confirmed = await confirm({
      title: 'Reject Location',
      message: 'Reject this location submission?',
      confirmText: 'Reject',
      variant: 'danger',
    });
    
    if (!confirmed) return;
    
    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/locations/${id}`, { action: 'reject' });
      toast.success('Location rejected');
      navigate('/locations/pending');
    } catch (error: any) {
      toast.error('Failed to reject: ' + (error.response?.data?.message || 'Unknown error'));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setFormData(prev => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter(f => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Check if a post was used in aggregation
  const isPostUsedInAggregate = (postId: string) => {
    return aggregateResult?.reviews_used.includes(postId) || false;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <div className="grid grid-cols-12 gap-6">
          <div className="col-span-4 space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <div className="col-span-8">
            <Skeleton className="h-[500px] w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="text-center py-16">
        <div className="w-20 h-20 mx-auto bg-gray-100 rounded-full flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Location not found</h3>
        <button 
          onClick={() => navigate('/locations/pending')}
          className="mt-4 text-primary-600 hover:text-primary-700 font-medium"
        >
          ← Back to pending locations
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      
      <Breadcrumbs items={[
        { label: 'Dashboard', href: '/' },
        { label: 'Pending Locations', href: '/locations/pending' },
        { label: location.restaurant_name || 'Review' },
      ]} />

      {/* Header Card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold text-gray-900">
                {location.restaurant_name || 'Unnamed Location'}
              </h1>
              <span className="px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-sm font-medium">
                Pending
              </span>
            </div>
            <p className="text-gray-600 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {location.full_address || `${location.street_address}, ${location.ward}, ${location.city}`}
            </p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {location.submitted_by_name || 'Unknown user'}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {formatDate(location.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                </svg>
                {posts.length} post{posts.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAIAggregate}
              disabled={isAggregating || posts.length === 0}
              className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 font-medium transition-all disabled:opacity-50 flex items-center gap-2 shadow-sm"
            >
              {isAggregating ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  AI Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI Aggregate
                </>
              )}
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className="px-5 py-2.5 border-2 border-red-200 text-red-600 rounded-lg hover:bg-red-50 font-medium transition-colors disabled:opacity-50"
            >
              Reject
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Processing...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Approve
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-12 gap-6">
        {/* Left: Posts List - Sorted by Upvotes */}
        <div className="col-span-4 space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider">
              User Posts ({posts.length})
            </h3>
            <span className="text-xs text-gray-400">Sorted by upvotes</span>
          </div>
          
          {posts.length === 0 ? (
            <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
              <svg className="w-10 h-10 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              <p className="text-sm text-gray-500">No posts yet</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {posts.map((post, index) => (
                <button
                  key={post.id}
                  onClick={() => {
                    setSelectedPost(post);
                    setActiveTab('posts');
                  }}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all relative ${
                    selectedPost?.id === post.id && activeTab === 'posts'
                      ? 'border-primary-500 bg-primary-50'
                      : isPostUsedInAggregate(post.id)
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  {/* Rank Badge */}
                  {index < 3 && (
                    <div className={`absolute -top-2 -left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-yellow-400 text-yellow-900' :
                      index === 1 ? 'bg-gray-300 text-gray-700' :
                      'bg-amber-600 text-white'
                    }`}>
                      {index + 1}
                    </div>
                  )}
                  
                  {/* Used in AI badge */}
                  {isPostUsedInAggregate(post.id) && (
                    <div className="absolute -top-2 -right-2 px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                      AI
                    </div>
                  )}
                  
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                      {post.author_name?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm truncate">
                        {post.author_name || 'Anonymous'}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5 text-green-600 font-medium">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                          </svg>
                          {post.upvote_count || 0}
                        </span>
                        <span>•</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                    {post.photos && post.photos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        {post.photos.length}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-2">{post.text}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="col-span-8">
          {/* Tab Headers */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveTab('posts')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === 'posts'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Post Detail
              </button>
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  activeTab === 'info'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Restaurant Info
                {aggregateResult && (
                  <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded">
                    AI
                  </span>
                )}
              </button>
            </div>
            
            {/* Aggregate Stats */}
            {aggregateResult && activeTab === 'info' && (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <span className="px-2 py-1 bg-purple-50 text-purple-700 rounded">
                  {aggregateResult.reviews_used.length} posts used
                </span>
                <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded">
                  {aggregateResult.comments_used.length} comments
                </span>
              </div>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === 'posts' ? (
            selectedPost ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                        {selectedPost.author_name?.[0]?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-lg">
                          {selectedPost.author_name || 'Anonymous User'}
                        </h3>
                        <p className="text-sm text-gray-500">{formatDate(selectedPost.created_at)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                        </svg>
                        {selectedPost.upvote_count || 0}
                      </span>
                      {isPostUsedInAggregate(selectedPost.id) && (
                        <span className="px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                          Used by AI
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap">
                    {selectedPost.text}
                  </p>

                  {selectedPost.features && Object.keys(selectedPost.features).length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Features mentioned</h4>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(selectedPost.features).map(([key, value]) => (
                          value && (
                            <span key={key} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm">
                              {key.replace(/_/g, ' ')}
                            </span>
                          )
                        ))}
                      </div>
                    </div>
                  )}

                  {selectedPost.photos && selectedPost.photos.length > 0 && (
                    <div className="mt-6">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">
                        Photos ({selectedPost.photos.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {selectedPost.photos.map((photo, i) => (
                          <a
                            key={i}
                            href={photo}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="aspect-square rounded-lg overflow-hidden bg-gray-100 hover:opacity-90 transition-opacity"
                          >
                            <img src={photo} alt="" className="w-full h-full object-cover" />
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 p-12 text-center">
                <svg className="w-12 h-12 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
                </svg>
                <p className="mt-4 text-gray-500">Select a post to view details</p>
              </div>
            )
          ) : (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Restaurant Information</h3>
                  <p className="text-sm text-gray-500">
                    {aggregateResult ? 'Generated by AI - review and edit before approving' : 'Fill in details before approving'}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Restaurant Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name_vi}
                    onChange={(e) => setFormData({ ...formData, name_vi: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="E.g., Pho Thin"
                  />
                </div>

                {/* Cuisine Types - New format with name/description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Cuisine Types
                    {formData.cuisine_types.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400">({formData.cuisine_types.length} items)</span>
                    )}
                  </label>
                  {formData.cuisine_types.length > 0 ? (
                    <div className="space-y-2">
                      {formData.cuisine_types.map((cuisine, idx) => (
                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-medium text-gray-900">{cuisine.name}</span>
                              {cuisine.description && (
                                <p className="text-sm text-gray-600 mt-1">{cuisine.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() => setFormData(prev => ({
                                ...prev,
                                cuisine_types: prev.cuisine_types.filter((_, i) => i !== idx)
                              }))}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 italic">No cuisine types. Click AI Aggregate to generate.</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Min Price (VND)</label>
                    <input
                      type="number"
                      value={formData.price_min}
                      onChange={(e) => setFormData({ ...formData, price_min: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="30000"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Max Price (VND)</label>
                    <input
                      type="number"
                      value={formData.price_max}
                      onChange={(e) => setFormData({ ...formData, price_max: e.target.value })}
                      className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="70000"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Opening Hours</label>
                  <input
                    type="text"
                    value={formData.opening_hours}
                    onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="07:00 - 22:00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Features</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['wifi', 'parking', 'air_con', 'credit_card', 'delivery', 'outdoor'].map((feature) => (
                      <label
                        key={feature}
                        className={`flex items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                          formData.features.includes(feature)
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.features.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                          className="sr-only"
                        />
                        <span className="text-sm text-gray-700 capitalize">{feature.replace('_', ' ')}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 resize-none"
                    placeholder="Restaurant description..."
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
