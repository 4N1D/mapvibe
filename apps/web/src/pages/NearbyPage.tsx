import { useMemo, useState, useEffect, useLayoutEffect } from "react";
import { Link } from "react-router-dom";
import { apiClient } from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "motion/react";
import toast, { Toaster } from "react-hot-toast";
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

// Strip HTML tags for plain text display
const stripHtml = (html: string): string => {
  const tmp = document.createElement("div");
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || "";
};

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
  authorAvatar?: string | null;
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
  features?: string[]; // Feature IDs from API
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
    authorAvatar: review.author_avatar || undefined,
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
    features: review.features || [],
  };
};

// List of all 18 services with their feature IDs - Đồng bộ với 18 tiện ích
const ALL_SERVICES = [
  { id: "wifi", label: "Có wifi" },
  { id: "card_payment", label: "Trả bằng thẻ" },
  { id: "private_room", label: "Có phòng riêng" },
  { id: "smoking_area", label: "Có khu vực hút thuốc" },
  { id: "wheelchair_accessible", label: "Có hỗ trợ người khuyết tật" },
  { id: "delivery", label: "Có giao hàng" },
  { id: "car_parking", label: "Có chỗ đậu ôtô" },
  { id: "kids_play_area", label: "Có chỗ chơi cho trẻ em" },
  { id: "membership_card", label: "Có thẻ thành viên" },
  { id: "football_streaming", label: "Có chiếu bóng đá" },
  { id: "air_conditioning", label: "Có máy lạnh và điều hòa" },
  { id: "air_con", label: "Có máy lạnh và điều hòa" },
  { id: "reservation", label: "Nên đặt trước" },
  { id: "free_motorbike_parking", label: "Giữ xe máy miễn phí" },
  { id: "vat_invoice", label: "Có xuất hóa đơn đỏ" },
  { id: "takeaway", label: "Cho mua về" },
  { id: "outdoor_seating", label: "Có bàn ngoài trời" },
  { id: "tipping", label: "Tip cho nhân viên" },
  { id: "heater", label: "Có lò sưởi" },
];

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
  initialVoteStatus?: "upvoted" | "downvoted" | null;
}

function PostCard({ post, onVoteUpdate, initialVoteStatus }: PostCardProps) {
  const { user, isAuthenticated } = useAuth();
  const [localUpvotes, setLocalUpvotes] = useState(post.stats.upvotes);
  const [localDownvotes, setLocalDownvotes] = useState(post.stats.downvotes);
  const [_isVoting, setIsVoting] = useState(false);
  const [voteStatus, setVoteStatus] = useState<"upvoted" | "downvoted" | null>(
    initialVoteStatus ?? null
  );
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

  // Update vote status when initialVoteStatus prop changes
  useEffect(() => {
    if (initialVoteStatus !== undefined) {
      setVoteStatus(initialVoteStatus);
    } else if (!isAuthenticated) {
      setVoteStatus(null);
    }
  }, [initialVoteStatus, isAuthenticated]);

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!isAuthenticated || !user) {
      toast.error("Vui lòng đăng nhập để vote");
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
        toast.error("Không thể tải thông tin người dùng. Vui lòng thử lại sau.");
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
      let newVoteStatus: "upvoted" | "downvoted" | null = null;
      if (action === "removed") {
        newVoteStatus = null;
      } else if (action === "created" || action === "switched") {
        newVoteStatus = vote_type === "upvote" ? "upvoted" : "downvoted";
      }
      setVoteStatus(newVoteStatus);

      // Notify parent to update voteStatusMap if needed
      // (This will be handled by the parent component if needed)

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
      toast.error(
        error.response?.data?.message || error.message || "Không thể vote. Vui lòng thử lại."
      );

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
    const plainDescription = stripHtml(post.description);
    const shareText = `${post.title} - ${plainDescription.substring(0, 100)}...`;

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
        toast.success("Đã sao chép link vào clipboard!");
      } catch (err) {
        console.error("Failed to copy:", err);
        toast.error("Không thể chia sẻ. Vui lòng thử lại.");
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
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">
                  Đã kiểm duyệt
                </span>
              ) : (
                <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 ring-1 ring-yellow-200">
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

        <p className="mt-3 line-clamp-3 text-sm text-gray-700">{stripHtml(post.description)}</p>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <Link
            to={`/post/${post.id}`}
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
              className={`flex h-[28px] items-center justify-center gap-1 rounded-full px-2 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                voteStatus === "upvoted"
                  ? "bg-green-100 text-green-700 hover:bg-green-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={
                !isAuthenticated
                  ? "Vui lòng đăng nhập để vote"
                  : voteStatus === "upvoted"
                    ? "Bỏ upvote"
                    : "Upvote"
              }
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
              className={`flex min-h-[28px] items-center justify-center gap-1 rounded-full px-2 py-1 transition disabled:cursor-not-allowed disabled:opacity-50 ${
                voteStatus === "downvoted"
                  ? "bg-red-100 text-red-700 hover:bg-red-200"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
              title={
                !isAuthenticated
                  ? "Vui lòng đăng nhập để vote"
                  : voteStatus === "downvoted"
                    ? "Bỏ downvote"
                    : "Downvote"
              }
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
              to={`/post/${post.id}#comments`}
              onClick={() => {
                // Lưu scroll position và post ID trước khi navigate
                sessionStorage.setItem("nearbyScrollPosition", window.scrollY.toString());
                sessionStorage.setItem("nearbyPostId", post.id);
              }}
              className="flex h-[28px] items-center justify-center gap-1 rounded-full bg-gray-100 px-2 text-gray-700 transition hover:bg-gray-200"
            >
              <MessageCircle className="h-4 w-4" />
              {post.stats.comments}
            </Link>
            <button
              onClick={handleShare}
              className="flex h-[28px] items-center justify-center gap-1 rounded-full bg-gray-100 px-2 text-gray-700 transition hover:bg-gray-200"
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

interface FilterState {
  trends: {
    hot: boolean;
    newest: boolean;
    oldest: boolean;
  };
  categories: string[];
  services: string[];
  status: string[];
  priceRange: {
    min: string;
    max: string;
  };
}

export function NearbyPage() {
  const { isAuthenticated } = useAuth();
  const [allPosts, setAllPosts] = useState<PostItem[]>([]); // Store all fetched posts
  const [posts, setPosts] = useState<PostItem[]>([]); // Filtered posts to display
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteStatusMap, setVoteStatusMap] = useState<
    Record<string, "upvoted" | "downvoted" | null>
  >({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Filter states - draft (đang chỉnh sửa) và applied (đã áp dụng)
  const [draftFilters, setDraftFilters] = useState<FilterState>({
    trends: {
      hot: false,
      newest: false,
      oldest: false,
    },
    categories: [],
    services: [],
    status: [],
    priceRange: {
      min: "",
      max: "",
    },
  });
  
  const [appliedFilters, setAppliedFilters] = useState<FilterState>({
    trends: {
      hot: false,
      newest: false,
      oldest: false,
    },
    categories: [],
    services: [],
    status: [],
    priceRange: {
      min: "",
      max: "",
    },
  });

  // Fetch reviews and vote history in parallel
  useEffect(() => {
    const fetchData = async () => {
      // Fetch reviews and votes in parallel for better performance
      await Promise.all([fetchReviews(), isAuthenticated ? fetchVoteHistory() : Promise.resolve()]);
    };
    fetchData();
  }, [isAuthenticated]);

  const fetchVoteHistory = async () => {
    if (!isAuthenticated) return;

    try {
      const response = await apiClient.get<{
        votes: Array<{
          review_post_id: string;
          vote_type: "upvote" | "downvote";
          created_at: string;
        }>;
      }>("/users/me/votes");

      // Create a map from review_post_id to vote status
      const map: Record<string, "upvoted" | "downvoted" | null> = {};
      response.data.votes.forEach((vote) => {
        map[vote.review_post_id] = vote.vote_type === "upvote" ? "upvoted" : "downvoted";
      });
      setVoteStatusMap(map);
    } catch (err) {
      console.error("[NearbyPage] Failed to fetch vote history:", err);
      // If error, keep empty map (all votes will be null)
    }
  };

  // Khôi phục scroll position khi quay lại từ trang chi tiết
  useLayoutEffect(() => {
    const savedScrollPosition = sessionStorage.getItem("nearbyScrollPosition");
    const savedPostId = sessionStorage.getItem("nearbyPostId");
    const returningFromPostDetail = sessionStorage.getItem("returningFromPostDetail");

    // Chỉ khôi phục nếu thực sự quay lại từ PostDetailPage
    if (
      savedScrollPosition &&
      savedPostId &&
      returningFromPostDetail === "true" &&
      !loading &&
      posts.length > 0
    ) {
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

    if (
      savedScrollPosition &&
      savedPostId &&
      returningFromPostDetail === "true" &&
      !loading &&
      posts.length > 0
    ) {
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

  const fetchReviews = async (currentOffset: number = 0, append: boolean = false) => {
    try {
      if (!append) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }
      setError(null);

      // Call real API endpoint (no mock data)
      const response = await apiClient.get<ReviewsResponse>("/reviews", {
        params: {
          limit: 20,
          offset: currentOffset,
        },
      });

      const reviews = response.data?.reviews || [];
      const mappedPosts = reviews.map(mapReviewToPostItem);

      // Check if there are more posts to load
      // If we got fewer reviews than the limit, or if reviews array is empty, there are no more posts
      const hasMoreData = reviews.length > 0 && reviews.length >= (response.data?.limit || 20);

      if (append) {
        setAllPosts((prevPosts) => {
          const newPosts = [...prevPosts, ...mappedPosts];
          setHasMore(hasMoreData);
          setOffset(newPosts.length);
          return newPosts;
        });
      } else {
        setAllPosts(mappedPosts);
        setHasMore(hasMoreData);
        setOffset(mappedPosts.length);
      }

      return mappedPosts;
    } catch (err) {
      console.error("[NearbyPage] Failed to fetch reviews:", err);
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      setError(error.response?.data?.message || error.message || "Không thể tải danh sách review");
      if (!append) {
        setAllPosts([]);
      }
      return [];
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  // Filter posts based on filter criteria
  const applyFilters = (postsToFilter: PostItem[]): PostItem[] => {
    let filtered = [...postsToFilter];

    // Filter by trends
    if (appliedFilters.trends.hot) {
      // Sort by upvotes + downvotes (total engagement)
      filtered = filtered.sort((a, b) => {
        const aEngagement = a.stats.upvotes + a.stats.downvotes;
        const bEngagement = b.stats.upvotes + b.stats.downvotes;
        return bEngagement - aEngagement;
      });
    } else if (appliedFilters.trends.newest) {
      // Sort by time (newest first - already sorted by API)
      // No need to sort again as API already returns newest first
    } else if (appliedFilters.trends.oldest) {
      filtered = filtered.reverse();
    }

    // Filter by status
    if (appliedFilters.status.length > 0) {
      filtered = filtered.filter((post) => {
        if (appliedFilters.status.includes("Đã kiểm duyệt")) {
          return post.approved;
        }
        if (appliedFilters.status.includes("Chưa kiểm duyệt")) {
          return !post.approved;
        }
        return true;
      });
    }

    // Filter by services
    if (appliedFilters.services.length > 0) {
      filtered = filtered.filter((post) => {
        const postFeatures = post.features || [];
        if (postFeatures.length === 0) return false;
        
        // Check if post has at least one of the selected services
        return appliedFilters.services.some((serviceId) => {
          // Handle both air_conditioning and air_con
          if (serviceId === "air_conditioning" || serviceId === "air_con") {
            return postFeatures.includes("air_conditioning") || postFeatures.includes("air_con");
          }
          return postFeatures.includes(serviceId);
        });
      });
    }

    // Filter by price range
    if (appliedFilters.priceRange.min || appliedFilters.priceRange.max) {
      filtered = filtered.filter((post) => {
        // Extract price from priceRange string (e.g., "120,000 - 250,000 VNĐ")
        const priceMatch = post.priceRange.match(/(\d+(?:,\d+)*)/g);
        if (!priceMatch || priceMatch.length === 0) return false;

        const minPrice = priceMatch[0]?.replace(/,/g, "") || "0";
        const maxPrice = priceMatch[1]?.replace(/,/g, "") || minPrice;
        
        const filterMin = appliedFilters.priceRange.min ? parseInt(appliedFilters.priceRange.min.replace(/,/g, "")) : 0;
        const filterMax = appliedFilters.priceRange.max ? parseInt(appliedFilters.priceRange.max.replace(/,/g, "")) : Infinity;
        
        return parseInt(minPrice) <= filterMax && parseInt(maxPrice) >= filterMin;
      });
    }

    return filtered;
  };

  // Apply filters whenever allPosts or appliedFilters change
  useEffect(() => {
    const filtered = applyFilters(allPosts);
    setPosts(filtered);
  }, [allPosts, appliedFilters]);

  // Handler to apply filters
  const handleApplyFilters = () => {
    setAppliedFilters({ ...draftFilters });
  };

  // Handler to reset filters
  const handleResetFilters = () => {
    const emptyFilters: FilterState = {
      trends: {
        hot: false,
        newest: false,
        oldest: false,
      },
      categories: [],
      services: [],
      status: [],
      priceRange: {
        min: "",
        max: "",
      },
    };
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
  };

  const handleLoadMore = () => {
    if (!loadingMore && hasMore) {
      fetchReviews(offset, true);
    }
  };

  return (
    <>
      <Toaster position="top-center" />
      <div className="bg-gray-100 pb-12">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 pt-8 sm:px-6 lg:flex-row lg:items-start lg:gap-8 lg:px-8">
        {/* Sidebar filters */}
        <aside className="relative flex h-fit flex-col w-full rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-20 lg:w-64 lg:max-h-[calc(100vh-6rem)]">
          <div className="mb-4 flex items-center justify-between shrink-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-gray-900">
              <span className="flex h-5 w-5 items-center justify-center rounded border border-gray-300 text-sm">
                <SlidersHorizontal className="h-4 w-4 text-gray-700" />
              </span>
              Bộ lọc địa điểm
            </h2>
            {(draftFilters.trends.hot || draftFilters.trends.newest || draftFilters.trends.oldest || 
              draftFilters.categories.length > 0 || draftFilters.services.length > 0 || 
              draftFilters.status.length > 0 || draftFilters.priceRange.min || draftFilters.priceRange.max) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-primary-500 hover:text-primary-600"
              >
                Reset
              </button>
            )}
          </div>
          <div className="flex-1 space-y-4 text-sm text-gray-700 overflow-y-auto">
            <div>
              <p className="mb-2 font-semibold">Xu hướng</p>
              <div className="space-y-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftFilters.trends.hot}
                    onChange={(e) => {
                      setDraftFilters((prev) => ({
                        ...prev,
                        trends: {
                          ...prev.trends,
                          hot: e.target.checked,
                          newest: e.target.checked ? false : prev.trends.newest,
                          oldest: e.target.checked ? false : prev.trends.oldest,
                        },
                      }));
                    }}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Đang hot</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftFilters.trends.newest}
                    onChange={(e) => {
                      setDraftFilters((prev) => ({
                        ...prev,
                        trends: {
                          ...prev.trends,
                          newest: e.target.checked,
                          hot: e.target.checked ? false : prev.trends.hot,
                          oldest: e.target.checked ? false : prev.trends.oldest,
                        },
                      }));
                    }}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Mới nhất</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draftFilters.trends.oldest}
                    onChange={(e) => {
                      setDraftFilters((prev) => ({
                        ...prev,
                        trends: {
                          ...prev.trends,
                          oldest: e.target.checked,
                          hot: e.target.checked ? false : prev.trends.hot,
                          newest: e.target.checked ? false : prev.trends.newest,
                        },
                      }));
                    }}
                    className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                  />
                  <span>Cũ nhất</span>
                </label>
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo trạng thái</p>
              <div className="space-y-1">
                {["Đã kiểm duyệt", "Chưa kiểm duyệt"].map((item) => (
                  <label key={item} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftFilters.status.includes(item)}
                      onChange={(e) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          status: e.target.checked
                            ? [...prev.status, item]
                            : prev.status.filter((s) => s !== item),
                        }));
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span>{item}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 font-semibold">Theo dịch vụ</p>
              <div className="space-y-1">
                {ALL_SERVICES.filter((service) => {
                  // Remove duplicate air_con if air_conditioning exists
                  if (service.id === "air_con") {
                    return !ALL_SERVICES.some((s) => s.id === "air_conditioning");
                  }
                  return true;
                }).map((service) => (
                  <label key={service.id} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draftFilters.services.includes(service.id)}
                      onChange={(e) => {
                        setDraftFilters((prev) => ({
                          ...prev,
                          services: e.target.checked
                            ? [...prev.services, service.id]
                            : prev.services.filter((s) => s !== service.id),
                        }));
                      }}
                      className="rounded border-gray-300 text-primary-500 focus:ring-primary-500"
                    />
                    <span className="text-sm">{service.label}</span>
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
                  value={draftFilters.priceRange.min}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, min: e.target.value },
                    }));
                  }}
                  className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
                <input
                  type="text"
                  placeholder="Đến"
                  value={draftFilters.priceRange.max}
                  onChange={(e) => {
                    setDraftFilters((prev) => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, max: e.target.value },
                    }));
                  }}
                  className="w-1/2 rounded border border-gray-300 px-2 py-1 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
          {/* Sticky buttons at bottom */}
          <div className="sticky bottom-0 bg-white pt-4 mt-4 border-t border-gray-100 shrink-0">
            <div className="flex gap-2">
              <button
                onClick={handleApplyFilters}
                className="flex-1 rounded bg-primary-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-600"
              >
                Áp dụng
              </button>
              <button
                onClick={handleResetFilters}
                className="rounded border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Reset
              </button>
            </div>
          </div>
        </aside>

          {/* Main content */}
          <main className="flex-1 space-y-6">
            {loading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
              </div>
            ) : error ? (
              <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">{error}</div>
            ) : posts.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <p className="text-gray-600">Chưa có review nào</p>
              </div>
            ) : (
              <>
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    initialVoteStatus={voteStatusMap[post.id] ?? null}
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
                ))}
                {hasMore && (
                  <div className="flex justify-center py-6">
                    <button
                      onClick={handleLoadMore}
                      disabled={loadingMore}
                      className="rounded-lg bg-primary-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {loadingMore ? "Đang tải..." : "Xem thêm bài review"}
                    </button>
                  </div>
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </>
  );
}
