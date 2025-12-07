import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  ArrowLeft,
  ThumbsUp,
  ThumbsDown,
  MapPin,
  PhoneCall,
  DollarSign,
  Clock,
  Bookmark,
  MessageCircle,
  Share2,
  Image as ImageIcon,
} from "lucide-react";
import { CommentsTab, PhotosTab, MenuTab } from "@/features/place";
import { apiClient } from "@/lib/axios";

interface ReviewPhoto {
  url: string;
  caption?: string;
}

interface ReviewFromAPI {
  id: string;
  author_id: string;
  author_name: string;
  author_avatar?: string | null;
  location_address_id?: string;
  text: string;
  features?: string[];
  photos?: ReviewPhoto[] | { general?: ReviewPhoto[]; food?: ReviewPhoto[]; menu?: ReviewPhoto[] };
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  created_at: string;
  location_name?: string;
  location_street_address?: string;
  location_ward?: string;
  location_city?: string;
  location_full_address?: string;
  location_geo_lat?: number | null;
  location_geo_lng?: number | null;
  location_cuisine_types?: string[] | Array<{ name: string; description?: string }> | null;
  location_price_min?: number | null;
  location_price_max?: number | null;
  location_phone?: string | null;
  location_opening_hours?: Record<string, string> | null;
  location_restaurant_id?: string | null;
  location_review_count?: number;
  location_avg_upvote_rate?: number | null;
  location_status?: string;
}

interface ReviewsResponse {
  count: number;
  limit: number;
  offset: number;
  reviews: ReviewFromAPI[];
}

interface PostDetail {
  id: string;
  slug: string;
  restaurantId: number;
  author: string;
  authorAvatar?: string;
  userRank: "Hạng đồng" | "Hạng bạc" | "Hạng vàng" | "Hạng kim cương" | "Hạng bạch kim";
  timeAgo: string;
  approved: boolean;
  title: string;
  address: string;
  phone: string;
  priceRange: string;
  hours: string;
  isOpen: boolean;
  categories: string[];
  description: string;
  stats: {
    likes: number;
    dislikes: number;
    comments: number;
  };
  images: string[];
}

// Helper function to format time ago
const formatTimeAgo = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return "Vừa xong";
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return `${diffInMinutes} phút trước`;
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return `${diffInHours} giờ trước`;
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return `${diffInDays} ngày trước`;
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  if (diffInWeeks < 4) {
    return `${diffInWeeks} tuần trước`;
  }

  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) {
    return `${diffInMonths} tháng trước`;
  }

  const diffInYears = Math.floor(diffInDays / 365);
  return `${diffInYears} năm trước`;
};

// Helper function to format price range
const formatPriceRange = (min?: number | null, max?: number | null): string => {
  if (!min && !max) return "Chưa có thông tin";
  if (!min) return `Dưới ${max?.toLocaleString("vi-VN")} VNĐ`;
  if (!max) return `Từ ${min.toLocaleString("vi-VN")} VNĐ`;
  return `${min.toLocaleString("vi-VN")} - ${max.toLocaleString("vi-VN")} VNĐ`;
};

// Helper function to format opening hours
const formatOpeningHours = (hours?: Record<string, string> | null): string => {
  if (!hours) return "Chưa có thông tin";
  
  // Get all unique hour ranges
  const hourRanges = Object.values(hours).filter(Boolean);
  if (hourRanges.length === 0) return "Chưa có thông tin";
  
  // Count frequency of each hour range
  const hourCount: Record<string, number> = {};
  hourRanges.forEach((range) => {
    hourCount[range] = (hourCount[range] || 0) + 1;
  });
  
  // Find the most common hour range
  let mostCommonRange = "";
  let maxCount = 0;
  Object.entries(hourCount).forEach(([range, count]) => {
    if (count > maxCount) {
      maxCount = count;
      mostCommonRange = range;
    }
  });
  
  // If all days have the same hours, show just the hours
  if (maxCount === hourRanges.length) {
    return mostCommonRange;
  }
  
  // If most days have the same hours, show it with note
  const totalDays = Object.keys(hours).length;
  if (maxCount >= totalDays * 0.7) {
    // If 70% or more days have the same hours, show it
    return mostCommonRange;
  }
  
  // Otherwise, show the most common range with a note
  return mostCommonRange || hourRanges[0];
};

// Helper function to generate slug from location name or use id
const generateSlug = (locationName?: string, id?: string): string => {
  if (locationName) {
    return locationName
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || id || "";
  }
  return id || "";
};

// Helper function to extract images from photos
const extractImages = (photos?: ReviewPhoto[] | { general?: ReviewPhoto[]; food?: ReviewPhoto[]; menu?: ReviewPhoto[] }): string[] => {
  if (!photos) return [];
  
  // If photos is an array
  if (Array.isArray(photos)) {
    return photos.map((photo) => photo.url);
  }
  
  // If photos is an object with general, food, menu
  const allPhotos: ReviewPhoto[] = [
    ...(photos.general || []),
    ...(photos.food || []),
    ...(photos.menu || []),
  ];
  return allPhotos.map((photo) => photo.url);
};

// Helper function to extract categories from cuisine types
const extractCategories = (cuisineTypes?: string[] | Array<{ name: string; description?: string }> | null): string[] => {
  if (!cuisineTypes) return [];
  
  if (Array.isArray(cuisineTypes)) {
    if (cuisineTypes.length === 0) return [];
    
    // Check if first item is string or object
    if (typeof cuisineTypes[0] === "string") {
      return cuisineTypes as string[];
    } else {
      return (cuisineTypes as Array<{ name: string }>).map((item) => item.name);
    }
  }
  
  return [];
};

// Map API review to PostDetail
const mapReviewToPostDetail = (review: ReviewFromAPI): PostDetail => {
  const slug = generateSlug(review.location_name, review.id);
  const images = extractImages(review.photos);
  const categories = extractCategories(review.location_cuisine_types);
  
  // Determine if location is open (simplified - you might want to add actual logic)
  const isOpen = true; // TODO: Add logic to check if location is currently open based on opening_hours
  
  return {
    id: review.id,
    slug,
    restaurantId: review.location_restaurant_id ? parseInt(review.location_restaurant_id.replace("R_", ""), 16) || 0 : 0,
    author: review.author_name,
    authorAvatar: review.author_avatar || undefined,
    userRank: "Hạng đồng", // Default rank
    timeAgo: formatTimeAgo(review.created_at),
    approved: review.location_status === "approved",
    title: review.location_name || "Địa điểm chưa có tên",
    address: review.location_full_address || review.location_street_address || "Chưa có địa chỉ",
    phone: review.location_phone || "Chưa có số điện thoại",
    priceRange: formatPriceRange(review.location_price_min, review.location_price_max),
    hours: formatOpeningHours(review.location_opening_hours),
    isOpen,
    categories,
    description: review.text,
    stats: {
      likes: review.upvote_count,
      dislikes: review.downvote_count,
      comments: review.comment_count,
    },
    images: images.length > 0 ? images : [
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    ],
  };
};

export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string>("binh-luan");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Check if URL has #comments hash to auto-scroll to comments
  useEffect(() => {
    if (window.location.hash === "#comments" && !loading && post) {
      setActiveTab("binh-luan");
      // Scroll to comments section after a delay to ensure DOM is ready
      const scrollToComments = () => {
        const tabContent = document.getElementById("tab-content");
        if (tabContent) {
          // Calculate offset to account for sticky header
          const headerOffset = 80;
          const elementPosition = tabContent.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: "smooth"
          });
        }
      };
      
      // Try multiple times to ensure DOM is ready
      setTimeout(scrollToComments, 300);
      setTimeout(scrollToComments, 600);
      setTimeout(scrollToComments, 1000);
    }
  }, [loading, post]);

  useEffect(() => {
    if (!slug) {
      setLoading(false);
      return;
    }

    const fetchPost = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch reviews from API
        const response = await apiClient.get<ReviewsResponse>("/reviews", {
          params: {
            limit: 100, // Fetch more to increase chance of finding the review
            offset: 0,
          },
        });

        const reviews = response.data?.reviews || [];
        
        // Find review by slug or ID
        const foundReview = reviews.find((review) => {
          const reviewSlug = generateSlug(review.location_name, review.id);
          return reviewSlug === slug || review.id === slug;
        });

        if (foundReview) {
          const mappedPost = mapReviewToPostDetail(foundReview);
          setPost(mappedPost);
          setImageError(false); // Reset image error state khi load bài review mới
        } else {
          setError("Không tìm thấy bài review");
        }
      } catch (err) {
        console.error("[PostDetailPage] Failed to fetch review:", err);
        const error = err as { response?: { data?: { message?: string } }; message?: string };
        setError(
          error.response?.data?.message || error.message || "Không thể tải bài review"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [slug]);

  // Reset image error khi post thay đổi
  useEffect(() => {
    setImageError(false);
  }, [post?.id]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">{error || "Không tìm thấy bài đăng"}</p>
        <Link to="/nearby" className="text-primary-500 hover:underline">
          ← Quay về danh sách
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* Back button */}
      <Link
        to="/nearby"
        onClick={() => {
          // Đánh dấu rằng đang quay lại từ PostDetailPage
          sessionStorage.setItem("returningFromPostDetail", "true");
        }}
        className="mb-4 inline-flex items-center gap-2 text-gray-600 hover:text-primary-500"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      {/* Main Content Area: Gallery & Info */}
      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Gallery - Left on Desktop (5 cols) */}
        <section className="lg:order-1 lg:col-span-5">
          <div className="h-full overflow-hidden rounded-xl shadow-sm">
            <div className="h-96 w-full">
              {post.images.length > 0 && post.images[0] && !imageError ? (
                <img
                  src={post.images[0]}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                  onError={() => setImageError(true)}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-gray-100">
                  <div className="flex flex-col items-center gap-3 text-gray-400">
                    <ImageIcon className="h-12 w-12" />
                    <span className="text-sm font-medium">Chưa có ảnh</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Post Info - Right on Desktop (7 cols) */}
        <section className="lg:order-2 lg:col-span-7">
          <div className="flex h-full flex-col justify-between">
            <div>
              {/* Title & Categories */}
              <div className="mb-4">
                <div className="mb-3">
                  <h1 className="text-2xl font-bold leading-tight text-gray-900 md:text-4xl">
                    {post.title}
                  </h1>
                </div>
                <div className="mb-5 text-sm font-medium text-gray-500">
                  {post.categories.join(" • ")}
                </div>
              </div>

              {/* Details */}
              <div className="space-y-2.5 text-sm">
                <div className="flex items-start gap-3 text-gray-700 transition-colors hover:text-primary-500">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
                  <span className="line-clamp-2">{post.address}</span>
                </div>

                <div className="flex items-center gap-3 text-gray-700">
                  <Clock className="h-4 w-4 shrink-0 text-gray-400" />
                  <div className="flex items-center gap-2">
                    <span>Giờ mở cửa | {post.hours}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-gray-700">
                  <DollarSign className="h-4 w-4 shrink-0 text-gray-400" />
                  <span className="font-medium">{post.priceRange}</span>
                </div>

                <div className="flex items-center gap-3 text-gray-700 hover:text-primary-600">
                  <PhoneCall className="h-4 w-4 shrink-0 text-gray-400" />
                  <span>{post.phone}</span>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex gap-3 border-t border-gray-100 pt-4">
              <button
                title={post.phone}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500"
              >
                <PhoneCall className="h-4 w-4" />
                Gọi điện thoại
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500">
                <Bookmark className="h-4 w-4" />
                Lưu vào Bộ sưu tập
              </button>
              <button
                onClick={() => {
                  setActiveTab("binh-luan");
                  setTimeout(() => {
                    document.getElementById("tab-content")?.scrollIntoView({ behavior: "smooth" });
                  }, 100);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500"
              >
                <MessageCircle className="h-4 w-4" />
                Bình luận
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500">
                <Share2 className="h-4 w-4" />
                Chia sẻ
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Author Header */}
      <div className="mb-6 flex items-center justify-between rounded-xl bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.author}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700">
              {post.author.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-gray-900">{post.author}</span>
              {post.approved ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">
                  NHÀ HÀNG MỚI
                </span>
              ) : (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 ring-1 ring-yellow-200">
                  Chưa kiểm duyệt
                </span>
              )}
            </div>
            <span className="text-sm text-gray-500">{post.timeAgo}</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1 text-gray-600 hover:text-primary-500">
            <ThumbsUp className="h-5 w-5" />
            <span className="font-semibold">{post.stats.likes}</span>
          </button>
          <button className="flex items-center gap-1 text-gray-600 hover:text-red-500">
            <ThumbsDown className="h-5 w-5" />
            <span className="font-semibold">{post.stats.dislikes}</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("binh-luan");
              setTimeout(() => {
                document.getElementById("tab-content")?.scrollIntoView({ behavior: "smooth" });
              }, 100);
            }}
            className="flex items-center gap-1 text-gray-600 hover:text-primary-500"
          >
            <MessageCircle className="h-5 w-5" />
            <span className="font-semibold">{post.stats.comments}</span>
          </button>
        </div>
      </div>

      {/* Tab Navigation */}
      <section className="mb-6">
        <div className="flex gap-8 border-b">
          {[
            { id: "gioi-thieu", label: "Giới thiệu" },
            { id: "binh-luan", label: "Bình luận" },
            { id: "anh", label: "Ảnh" },
            { id: "thuc-don", label: "Thực đơn" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium ${
                activeTab === tab.id
                  ? "border-primary-500 text-primary-500 border-b-2"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </section>

      {/* Tab Content */}
      <section id="tab-content">
        {activeTab === "gioi-thieu" && (
          <div className="rounded-xl bg-white p-6 shadow-sm">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">Giới thiệu</h3>
            <div 
              className="prose prose-sm max-w-none text-gray-700 prose-headings:text-gray-900 prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.description }}
            />
          </div>
        )}

        {activeTab === "binh-luan" && <CommentsTab restaurantId={post.restaurantId} slug={post.slug} />}

        {activeTab === "anh" && <PhotosTab restaurantId={post.restaurantId} showFilters={false} />}

        {activeTab === "thuc-don" && <MenuTab restaurantId={post.restaurantId} />}
      </section>
    </div>
  );
}

