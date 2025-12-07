import { useMemo, useState, useEffect, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "motion/react";
import {
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  SlidersHorizontal,
  Share2,
  Image as ImageIcon,
} from "lucide-react";

interface GalleryItem {
  url: string;
  caption?: string;
}

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
  photos?: ReviewPhoto[];
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
  location_cuisine_types?: string[] | null;
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

interface PostItem {
  id: string;
  slug: string;
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
  description: string;
  stats: {
    comments: number;
    upvotes: number;
    downvotes: number;
    shares?: number;
  };
  images: GalleryItem[];
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

// Map API review to PostItem
const mapReviewToPostItem = (review: ReviewFromAPI): PostItem => {
  // Generate slug from location name or use id
  const slug = review.location_name
    ? review.location_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || review.id
    : review.id;

  return {
    id: review.id,
    slug,
    author: review.author_name,
    authorAvatar: review.author_avatar,
    userRank: "Hạng đồng", // Not used anymore but kept for compatibility
    timeAgo: formatTimeAgo(review.created_at),
    approved: review.location_status === "approved",
    title: review.location_name || "Địa điểm chưa có tên",
    address: review.location_full_address || review.location_street_address || "Chưa có địa chỉ",
    phone: review.location_phone || "Chưa có số điện thoại",
    priceRange: formatPriceRange(review.location_price_min, review.location_price_max),
    hours: formatOpeningHours(review.location_opening_hours),
    description: review.text,
    stats: {
      comments: review.comment_count,
      upvotes: review.upvote_count,
      downvotes: review.downvote_count,
      shares: review.share_count,
    },
    images: Array.isArray(review.photos) 
      ? review.photos.map((photo) => ({ url: photo.url, caption: photo.caption }))
      : [],
  };
};

function Gallery({ items }: { items: GalleryItem[] }) {
  const display = useMemo(() => items.slice(0, 5), [items]);
  const extra = items.length - display.length;
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // Placeholder component
  const PlaceholderPanel = () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-100">
      <div className="flex flex-col items-center gap-2 text-gray-400">
        <ImageIcon className="h-6 w-6" />
        <span className="text-xs">Chưa có ảnh</span>
      </div>
    </div>
  );

  const handleImageError = (index: number) => {
    setImageErrors((prev) => new Set(prev).add(index));
  };

  // Nếu không có ảnh nào, hiển thị tất cả placeholder với cùng cấu trúc
  if (display.length === 0) {
    return (
      <div className="grid h-full w-full grid-cols-5 grid-rows-2 gap-1 sm:gap-2">
        {/* Main placeholder spans 2 rows, 3 cols */}
        <div className="relative col-span-3 row-span-2 overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
        {/* Top right placeholders */}
        <div className="overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
        <div className="overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
        {/* Bottom right placeholders */}
        <div className="relative overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
        <div className="relative overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-full w-full grid-cols-5 grid-rows-2 gap-1 sm:gap-2">
      {/* Main image spans 2 rows, 3 cols */}
      <div className="relative col-span-3 row-span-2 overflow-hidden rounded-lg">
        {display[0] && !imageErrors.has(0) ? (
          <img
            src={display[0].url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => handleImageError(0)}
          />
        ) : (
          <PlaceholderPanel />
        )}
      </div>
      {/* Top right images */}
      {display[1] && !imageErrors.has(1) ? (
        <div className="overflow-hidden rounded-lg">
          <img
            src={display[1].url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => handleImageError(1)}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
      )}
      {display[2] && !imageErrors.has(2) ? (
        <div className="overflow-hidden rounded-lg">
          <img
            src={display[2].url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => handleImageError(2)}
          />
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
      )}
      {/* Bottom right images */}
      {display[3] && !imageErrors.has(3) ? (
        <div className="relative overflow-hidden rounded-lg">
          <img
            src={display[3].url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => handleImageError(3)}
          />
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg">
          <PlaceholderPanel />
        </div>
      )}
      {display[4] && !imageErrors.has(4) ? (
        <div className="relative overflow-hidden rounded-lg">
          <img
            src={display[4].url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => handleImageError(4)}
          />
          {extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
              +{extra}
            </div>
          )}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-lg">
          <PlaceholderPanel />
          {extra > 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-lg font-semibold text-white">
              +{extra}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface PostCardProps {
  post: PostItem;
  onVoteUpdate?: (postId: string, upvotes: number, downvotes: number) => void;
}

function PostCard({ post, onVoteUpdate }: PostCardProps) {
  const { user, isAuthenticated } = useAuth();
  const [localUpvotes, setLocalUpvotes] = useState(post.stats.upvotes);
  const [localDownvotes, setLocalDownvotes] = useState(post.stats.downvotes);
  const [isVoting, setIsVoting] = useState(false);
  const [voteStatus, setVoteStatus] = useState<"upvoted" | "downvoted" | null>(null);
  const [voteAnimation, setVoteAnimation] = useState<"upvote" | "downvote" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Fetch user_id once when component mounts
  useEffect(() => {
    if (isAuthenticated && user && !userId) {
      const fetchUserId = async () => {
        try {
          const profileResponse = await apiClient.get<{ user: { id: string } }>("/users/me");
          setUserId(profileResponse.data.user.id);
        } catch (err) {
          console.error("[PostCard] Failed to get user profile:", err);
          // Fallback to using sub
          setUserId(user.sub);
        }
      };
      fetchUserId();
    }
  }, [isAuthenticated, user, userId]);

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!isAuthenticated || !user) {
      alert("Vui lòng đăng nhập để vote");
      return;
    }

    // If userId is not loaded yet, try to get it first
    let currentUserId = userId;
    if (!currentUserId) {
      try {
        const profileResponse = await apiClient.get<{ user: { id: string } }>("/users/me");
        currentUserId = profileResponse.data.user.id;
        setUserId(currentUserId);
      } catch (err) {
        console.error("[PostCard] Failed to get user profile:", err);
        alert("Không thể tải thông tin người dùng. Vui lòng thử lại sau.");
        return;
      }
    }

    // Optimistic update - update UI immediately
    const previousStatus = voteStatus;
    const previousUpvotes = localUpvotes;
    const previousDownvotes = localDownvotes;

    // Calculate optimistic counts based on current status
    let newUpvotes = previousUpvotes;
    let newDownvotes = previousDownvotes;
    let newStatus: "upvoted" | "downvoted" | null = null;

    if (previousStatus === "upvoted" && voteType === "upvote") {
      // Toggle off upvote
      newStatus = null;
      newUpvotes = Math.max(0, previousUpvotes - 1);
    } else if (previousStatus === "downvoted" && voteType === "downvote") {
      // Toggle off downvote
      newStatus = null;
      newDownvotes = Math.max(0, previousDownvotes - 1);
    } else if (previousStatus === null) {
      // New vote
      newStatus = voteType === "upvote" ? "upvoted" : "downvoted";
      if (voteType === "upvote") {
        newUpvotes = previousUpvotes + 1;
      } else {
        newDownvotes = previousDownvotes + 1;
      }
    } else {
      // Switch vote (from upvote to downvote or vice versa)
      newStatus = voteType === "upvote" ? "upvoted" : "downvoted";
      if (voteType === "upvote") {
        // Switching from downvote to upvote
        newUpvotes = previousUpvotes + 1;
        newDownvotes = Math.max(0, previousDownvotes - 1);
      } else {
        // Switching from upvote to downvote
        newUpvotes = Math.max(0, previousUpvotes - 1);
        newDownvotes = previousDownvotes + 1;
      }
    }

    // Update UI immediately (optimistic update)
    setLocalUpvotes(newUpvotes);
    setLocalDownvotes(newDownvotes);
    setVoteStatus(newStatus);
    setVoteAnimation(voteType);
    setTimeout(() => setVoteAnimation(null), 600);

    // Notify parent immediately
    if (onVoteUpdate) {
      onVoteUpdate(post.id, newUpvotes, newDownvotes);
    }

    try {
      setIsVoting(true);

      // Call vote API in background
      const response = await apiClient.post<{
        review_post: {
          upvote_count: number;
          downvote_count: number;
        };
        vote: {
          action: "created" | "removed" | "switched";
          vote_type: "upvote" | "downvote" | null;
        };
      }>("/reviews/vote", {
        user_id: currentUserId,
        review_post_id: post.id,
        vote_type: voteType,
      });

      // Update with actual counts from server (in case of race conditions)
      const actualUpvotes = response.data.review_post.upvote_count;
      const actualDownvotes = response.data.review_post.downvote_count;
      
      setLocalUpvotes(actualUpvotes);
      setLocalDownvotes(actualDownvotes);

      // Update vote status based on actual action
      const { action, vote_type } = response.data.vote;
      if (action === "removed") {
        setVoteStatus(null);
      } else if (action === "created" || action === "switched") {
        setVoteStatus(vote_type === "upvote" ? "upvoted" : "downvoted");
      }

      // Notify parent with actual counts
      if (onVoteUpdate) {
        onVoteUpdate(post.id, actualUpvotes, actualDownvotes);
      }
    } catch (err) {
      console.error("[PostCard] Failed to vote:", err);
      
      // Rollback optimistic update on error
      setLocalUpvotes(previousUpvotes);
      setLocalDownvotes(previousDownvotes);
      setVoteStatus(previousStatus);
      
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      alert(error.response?.data?.message || error.message || "Không thể vote. Vui lòng thử lại.");
      
      // Notify parent to rollback
      if (onVoteUpdate) {
        onVoteUpdate(post.id, previousUpvotes, previousDownvotes);
      }
    } finally {
      setIsVoting(false);
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/post/${post.slug}`;
    const shareText = `${post.title} - ${post.description.substring(0, 100)}...`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: post.title,
          text: shareText,
          url: shareUrl,
        });
      } catch (err) {
        // User cancelled or error occurred
        console.log("Share cancelled or failed:", err);
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareUrl);
        alert("Đã sao chép link vào clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
        alert("Không thể chia sẻ. Vui lòng thử lại.");
      }
    }
  };

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
      data-post-id={post.id}
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          {post.authorAvatar ? (
            <img
              src={post.authorAvatar}
              alt={post.author}
              className="h-9 w-9 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700">
              {post.author.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <div className="text-sm font-semibold text-gray-900">{post.author}</div>
              {post.approved ? (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 ring-1 ring-green-200 text-[11px] font-semibold">
                  Đã kiểm duyệt
                </span>
              ) : (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-yellow-800 ring-1 ring-yellow-200 text-[11px] font-semibold">
                  Chưa kiểm duyệt
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">{post.timeAgo}</div>
          </div>
        </div>

        <h3 className="mt-3 text-lg font-semibold text-gray-900">{post.title}</h3>

        <div className="mt-2 space-y-1 text-sm text-gray-700">
          <div className="flex items-center gap-2 text-gray-700">
            <MapPin className="h-4 w-4 text-gray-400" />
            <span>{post.address}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Phone className="h-4 w-4 text-gray-400" />
            <span>{post.phone}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span>{post.priceRange}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-700">
            <Clock className="h-4 w-4 text-gray-400" />
            <span>Giờ mở cửa | {post.hours}</span>
          </div>
        </div>

        <div className="mt-3 h-64 overflow-hidden rounded-xl bg-gray-100 sm:h-80">
          <Gallery items={post.images} />
        </div>

        <p className="mt-3 text-sm text-gray-700">{post.description}</p>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <Link
            to={`/post/${post.slug}`}
            onClick={() => {
              // Lưu scroll position và post ID trước khi navigate
              sessionStorage.setItem("nearbyScrollPosition", window.scrollY.toString());
              sessionStorage.setItem("nearbyPostId", post.id);
            }}
            className="text-red-600 hover:underline"
          >
            Xem chi tiết
          </Link>
          <div className="flex items-center gap-3">
            <motion.button
              onClick={() => handleVote("upvote")}
              disabled={!isAuthenticated}
              className={`flex items-center gap-1 rounded-full px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                voteStatus === "upvoted"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={!isAuthenticated ? "Vui lòng đăng nhập để vote" : voteStatus === "upvoted" ? "Bỏ upvote" : "Upvote"}
              whileTap={{ scale: 0.95 }}
              animate={
                voteAnimation === "upvote"
                  ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, 10, -10, 0],
                    }
                  : {}
              }
              transition={{ duration: 0.3 }}
            >
              <ThumbsUp
                className={`h-4 w-4 transition-colors ${
                  voteStatus === "upvoted" ? "fill-green-600 text-green-600" : ""
                }`}
              />
              {localUpvotes}
            </motion.button>
            <motion.button
              onClick={() => handleVote("downvote")}
              disabled={!isAuthenticated}
              className={`flex items-center gap-1 rounded-full px-2 py-1 transition disabled:opacity-50 disabled:cursor-not-allowed ${
                voteStatus === "downvoted"
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={!isAuthenticated ? "Vui lòng đăng nhập để vote" : voteStatus === "downvoted" ? "Bỏ downvote" : "Downvote"}
              whileTap={{ scale: 0.95 }}
              animate={
                voteAnimation === "downvote"
                  ? {
                      scale: [1, 1.2, 1],
                      rotate: [0, -10, 10, 0],
                    }
                  : {}
              }
              transition={{ duration: 0.3 }}
            >
              <ThumbsDown
                className={`h-4 w-4 transition-colors ${
                  voteStatus === "downvoted" ? "fill-red-600 text-red-600" : ""
                }`}
              />
              {localDownvotes}
            </motion.button>
            <Link
              to={`/post/${post.slug}#comments`}
              onClick={() => {
                // Lưu scroll position và post ID trước khi navigate
                sessionStorage.setItem("nearbyScrollPosition", window.scrollY.toString());
                sessionStorage.setItem("nearbyPostId", post.id);
              }}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 transition hover:bg-gray-200"
            >
              <MessageCircle className="h-4 w-4" />
              {post.stats.comments}
            </Link>
            <button
              onClick={handleShare}
              className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 transition hover:bg-gray-200"
              title="Chia sẻ"
            >
              <Share2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NearbyPage() {
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchReviews();
  }, []);

  // Khôi phục scroll position khi quay lại từ trang chi tiết
  useLayoutEffect(() => {
    const savedScrollPosition = sessionStorage.getItem("nearbyScrollPosition");
    const savedPostId = sessionStorage.getItem("nearbyPostId");
    const returningFromPostDetail = sessionStorage.getItem("returningFromPostDetail");

    // Chỉ khôi phục nếu thực sự quay lại từ PostDetailPage
    if (savedScrollPosition && savedPostId && returningFromPostDetail === "true" && !loading && posts.length > 0) {
      const scrollPosition = parseInt(savedScrollPosition, 10);
      
      // Scroll ngay trong layout effect
      window.scrollTo(0, scrollPosition);
    }
  }, [loading, posts]);

  // Scroll lại sau khi ScrollRestoration đã chạy
  useEffect(() => {
    const savedScrollPosition = sessionStorage.getItem("nearbyScrollPosition");
    const savedPostId = sessionStorage.getItem("nearbyPostId");
    const returningFromPostDetail = sessionStorage.getItem("returningFromPostDetail");

    if (savedScrollPosition && savedPostId && returningFromPostDetail === "true" && !loading && posts.length > 0) {
      const scrollPosition = parseInt(savedScrollPosition, 10);
      
      // Scroll lại sau khi ScrollRestoration đã chạy (thường chạy sau useEffect)
      const timeoutId = setTimeout(() => {
        window.scrollTo({
          top: scrollPosition,
          behavior: "auto",
        });
        
        // Scroll lại một lần nữa để chắc chắn
        setTimeout(() => {
          window.scrollTo({
            top: scrollPosition,
            behavior: "auto",
          });
          
          // Xóa saved data sau khi đã khôi phục
          sessionStorage.removeItem("nearbyScrollPosition");
          sessionStorage.removeItem("nearbyPostId");
          sessionStorage.removeItem("returningFromPostDetail");
        }, 50);
      }, 200);

      return () => clearTimeout(timeoutId);
    } else if (returningFromPostDetail === "true") {
      // Nếu có flag nhưng không có saved data, xóa flag
      sessionStorage.removeItem("returningFromPostDetail");
    }
  }, [loading, posts]);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      setError(null);

      // Call real API endpoint (no mock data)
      const response = await apiClient.get<ReviewsResponse>("/reviews", {
        params: {
          limit: 20,
          offset: 0,
        },
      });

      const reviews = response.data?.reviews || [];
      const mappedPosts = reviews.map(mapReviewToPostItem);
      setPosts(mappedPosts);
    } catch (err) {
      console.error("[NearbyPage] Failed to fetch reviews:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(
        error.response?.data?.message || error.message || "Không thể tải danh sách review"
      );
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-100 pb-12">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:px-8">
        {/* Sidebar filters */}
        <aside className="w-full rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:w-64">
          <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-gray-900">
            <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 text-sm">
              <SlidersHorizontal className="h-4 w-4 text-gray-700" />
            </span>
            Bộ lọc địa điểm
          </h2>
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <p className="mb-2 font-semibold">Xu hướng</p>
              <div className="space-y-1">
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> Đang hot
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> Mới nhất
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" /> Cũ nhất
                </label>
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo danh mục</p>
              <div className="space-y-1">
                {["Lẩu", "Nướng", "Buffet", "Mì/miến", "Ăn nhẹ"].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" /> {item}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo dịch vụ</p>
              <div className="space-y-1">
                {["Wifi free", "Giữ xe free", "Quẹt thẻ", "Cho nhóm", "Tiệm"].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" /> {item}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo trạng thái</p>
              <div className="space-y-1">
                {["Đã kiểm duyệt", "Chưa kiểm duyệt"].map((item) => (
                  <label key={item} className="flex items-center gap-2">
                    <input type="checkbox" /> {item}
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo khoảng giá</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Từ"
                  className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <input
                  type="text"
                  placeholder="Đến"
                  className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm"
                />
              </div>
              <button className="mt-3 w-full rounded bg-primary-500 px-3 py-2 text-sm font-semibold text-white hover:bg-primary-600">
                Áp dụng
              </button>
            </div>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 space-y-6">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
            </div>
          ) : error ? (
            <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">
              {error}
            </div>
          ) : posts.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
              <p className="text-gray-600">Chưa có review nào</p>
            </div>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                onVoteUpdate={(postId, upvotes, downvotes) => {
                  setPosts((prevPosts) =>
                    prevPosts.map((p) =>
                      p.id === postId
                        ? {
                            ...p,
                            stats: {
                              ...p.stats,
                              upvotes,
                              downvotes,
                            },
                          }
                        : p
                    )
                  );
                }}
              />
            ))
          )}
        </main>
      </div>
    </div>
  );
}

