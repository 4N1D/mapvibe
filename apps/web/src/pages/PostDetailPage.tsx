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
  Star,
  MessageCircle,
  Share2,
  Image as ImageIcon,
} from "lucide-react";
import {
  CommentsTab,
  PhotosTab,
  MenuTab,
  DirectionSidebar,
  ServicesList,
  CuisineType,
  Cuisine,
  ReportModal,
} from "@/features/place";
import { Flag } from "lucide-react";
import { apiClient } from "@/lib/axios";
import { useAuth } from "@/contexts/AuthContext";
import { motion } from "motion/react";
import toast from "react-hot-toast";
import { stripHtml } from "@/utils/text";
import { MapVibeLoader } from "@/components/common/MapVibeLoader";

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
  restaurant_id?: string;
  text: string;
  features?: string[];
  photos?: ReviewPhoto[] | { general?: ReviewPhoto[]; food?: ReviewPhoto[]; menu?: ReviewPhoto[] };
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  created_at: string;
  updated_at?: string;
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
  restaurant_slug?: string;
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
  restaurantSlug?: string;
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
  lat?: number | null;
  lng?: number | null;
  features?: string[];
  cuisineTypes?: Cuisine[];
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

// Helper function to fix CDN URL (replace wrong domain with correct one)
const fixCdnUrl = (url: string): string => {
  const correctCdnDomain =
    import.meta.env.VITE_CLOUDFRONT_URL || "https://dxuh8yivsgocq.cloudfront.net";
  // Replace any cloudfront domain with the correct one
  return url.replace(/https:\/\/d[a-z0-9]+\.cloudfront\.net/i, correctCdnDomain);
};

// Helper function to generate slug from location name or use id
const generateSlug = (locationName?: string, id?: string): string => {
  if (locationName) {
    return (
      locationName
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") ||
      id ||
      ""
    );
  }
  return id || "";
};

// Helper function to extract images from photos
const extractImages = (
  photos?: ReviewPhoto[] | { general?: ReviewPhoto[]; food?: ReviewPhoto[]; menu?: ReviewPhoto[] }
): string[] => {
  if (!photos) {
    console.log("[extractImages] No photos provided");
    return [];
  }

  // If photos is an array
  if (Array.isArray(photos)) {
    const urls = photos.map((photo) => fixCdnUrl(photo.url)).filter(Boolean);
    console.log(`[extractImages] Extracted ${urls.length} images from array:`, urls);
    return urls;
  }

  // If photos is an object with general, food, menu
  const allPhotos: ReviewPhoto[] = [
    ...(photos.general || []),
    ...(photos.food || []),
    ...(photos.menu || []),
  ];
  const urls = allPhotos.map((photo) => fixCdnUrl(photo.url)).filter(Boolean);
  console.log(`[extractImages] Extracted ${urls.length} images from object:`, urls);
  return urls;
};

// Helper function to extract categories from cuisine types
const extractCategories = (
  cuisineTypes?: string[] | Array<{ name: string; description?: string }> | null
): string[] => {
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

// Helper function to extract cuisine types
const extractCuisineTypes = (
  cuisineTypes?: string[] | Array<{ name: string; description?: string }> | null
): Cuisine[] => {
  if (!cuisineTypes) return [];

  if (Array.isArray(cuisineTypes)) {
    if (cuisineTypes.length === 0) return [];

    // Check if first item is string or object
    if (typeof cuisineTypes[0] === "string") {
      return (cuisineTypes as string[]).map((name) => ({ name, description: "" }));
    } else {
      return (cuisineTypes as Array<{ name: string; description?: string }>).map((item) => ({
        name: item.name,
        description: item.description || "",
      }));
    }
  }

  return [];
};

// Map API review to PostDetail
const mapReviewToPostDetail = (review: ReviewFromAPI): PostDetail => {
  const slug = generateSlug(review.location_name, review.id);
  const images = extractImages(review.photos);
  const categories = extractCategories(review.location_cuisine_types);
  const cuisineTypes = extractCuisineTypes(review.location_cuisine_types);

  console.log("[mapReviewToPostDetail] Review photos:", review.photos);
  console.log("[mapReviewToPostDetail] Extracted images:", images);

  // Determine if location is open (simplified - you might want to add actual logic)
  const isOpen = true; // TODO: Add logic to check if location is currently open based on opening_hours

  return {
    id: review.id,
    slug,
    restaurantId: review.location_restaurant_id
      ? parseInt(review.location_restaurant_id.replace("R_", ""), 16) || 0
      : 0,
    restaurantSlug: review.restaurant_slug,
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
    images: images.length > 0 ? images : [],
    lat: review.location_geo_lat ?? undefined,
    lng: review.location_geo_lng ?? undefined,
    features: review.features || [],
    cuisineTypes,
  };
};

// Map feature IDs to display labels - Đồng bộ với 18 tiện ích từ UI
const mapFeatureToLabel = (featureId: string): string => {
  const featureMap: Record<string, string> = {
    // Tiện ích cơ bản
    wifi: "Có wifi",
    delivery: "Có giao hàng",
    air_con: "Có máy lạnh và điều hòa",
    air_conditioning: "Có máy lạnh và điều hòa", // API có thể trả về air_conditioning
    takeaway: "Cho mua về",
    parking: "Có chỗ đậu xe",

    // Thanh toán và dịch vụ
    card_payment: "Trả bằng thẻ",
    car_parking: "Có chỗ đậu ôtô",
    reservation: "Nên đặt trước",
    outdoor_seating: "Có bàn ngoài trời",
    private_room: "Có phòng riêng",

    // Tiện ích đặc biệt
    kids_play_area: "Có chỗ chơi cho trẻ em",
    free_motorbike_parking: "Giữ xe máy miễn phí",
    tipping: "Tip cho nhân viên",
    smoking_area: "Có khu vực hút thuốc",
    membership_card: "Có thẻ thành viên",

    // Dịch vụ bổ sung
    vat_invoice: "Có xuất hóa đơn đỏ",
    heater: "Có lò sưởi",
    wheelchair_accessible: "Có hỗ trợ người khuyết tật",
    football_streaming: "Có chiếu bóng đá",
  };
  return featureMap[featureId] || featureId;
};

export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { user, isAuthenticated } = useAuth();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string>("gioi-thieu");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageError, setImageError] = useState(false);

  // Report states
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  // Vote states
  const [localUpvotes, setLocalUpvotes] = useState(0);
  const [localDownvotes, setLocalDownvotes] = useState(0);
  const [voteStatus, setVoteStatus] = useState<"upvoted" | "downvoted" | null>(null);
  const [voteAnimation, setVoteAnimation] = useState<"upvote" | "downvote" | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isVoting, setIsVoting] = useState(false);

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
            behavior: "smooth",
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

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1. Logic to fetch post details (Direct + Fallback)
        const fetchPostDetail = async (): Promise<PostDetail> => {
          let fetchedPost: PostDetail | null = null;

          // Attempt 1: Review by ID/Slug
          try {
            console.log(`[PostDetailPage] Attempting to fetch review with ID/slug: ${slug}`);
            const detailResponse = await apiClient.get<{ review: ReviewFromAPI }>(
              `/reviews/${slug}`
            );
            if (detailResponse.data?.review) {
              fetchedPost = mapReviewToPostDetail(detailResponse.data.review);
            }
          } catch (detailError: any) {
            // If direct fetch fails, check if we should fallback
            console.log(
              "[PostDetailPage] Direct fetch failed:",
              detailError.response?.status,
              detailError.message
            );
            if (detailError.response?.status !== 404 && slug.startsWith("RP_")) {
              throw detailError;
            }
          }

          if (fetchedPost) return fetchedPost;

          // Attempt 2: Fallback to listing
          console.log("[PostDetailPage] Falling back to reviews list search");
          const response = await apiClient.get<ReviewsResponse>("/reviews", {
            params: { limit: 100, offset: 0 },
          });
          const reviews = response.data?.reviews || [];
          const foundReview = reviews.find((review) => {
            const reviewSlug = generateSlug(review.location_name, review.id);
            return reviewSlug === slug || review.id === slug;
          });

          if (foundReview) {
            return mapReviewToPostDetail(foundReview);
          }

          throw new Error("Không tìm thấy bài review");
        };

        // 2. Logic to fetch User ID & Votes (Parallel)
        const fetchUserAndVotes = async () => {
          if (!isAuthenticated) return { userId: null, votes: [] };

          const userPromise = !userId
            ? apiClient
                .get<{ user: { id: string } }>("/users/me")
                .then((res) => res.data.user.id)
                .catch((err) => {
                  console.error("[PostDetailPage] Failed to get user profile:", err);
                  return user?.sub || null;
                })
            : Promise.resolve(userId);

          const votesPromise = apiClient
            .get<{
              votes: Array<{
                review_post_id: string;
                vote_type: "upvote" | "downvote";
                created_at: string;
              }>;
            }>(`/users/me/votes?t=${new Date().getTime()}`) // Cache busting
            .then((res) => res.data.votes)
            .catch((err) => {
              console.error("[PostDetailPage] Failed to fetch vote history:", err);
              return [];
            });

          const [fetchedUserId, fetchedVotes] = await Promise.all([userPromise, votesPromise]);
          return { userId: fetchedUserId, votes: fetchedVotes };
        };

        // Execute both major tasks in parallel
        const [postResult, userResult] = await Promise.all([
          fetchPostDetail(),
          fetchUserAndVotes(),
        ]);

        // Update State
        if (postResult) {
          setPost(postResult);
          setLocalUpvotes(postResult.stats.likes);
          setLocalDownvotes(postResult.stats.dislikes);
          setImageError(false);

          if (userResult.userId) {
            setUserId(userResult.userId);
          }

          if (userResult.votes.length > 0) {
            // Robust ID comparison
            const vote = userResult.votes.find(
              (v) => String(v.review_post_id) === String(postResult.id)
            );
            setVoteStatus(vote ? (vote.vote_type === "upvote" ? "upvoted" : "downvoted") : null);
          } else {
            setVoteStatus(null);
          }
        }
      } catch (err: any) {
        console.error("[PostDetailPage] Failed to fetch data:", err);
        const errorMessage =
          err.response?.data?.message || err.message || "Không thể tải bài review";
        setError(errorMessage);
        setVoteStatus(null);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [slug, isAuthenticated]);

  // Reset image error khi post thay đổi
  useEffect(() => {
    setImageError(false);
  }, [post?.id]);

  const handleVote = async (voteType: "upvote" | "downvote") => {
    if (!isAuthenticated || !user || !post) {
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
        console.error("[PostDetailPage] Failed to get user profile:", err);
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

      // Update post stats
      setPost({
        ...post,
        stats: {
          ...post.stats,
          likes: actualUpvotes,
          dislikes: actualDownvotes,
        },
      });
    } catch (err) {
      console.error("[PostDetailPage] Failed to vote:", err);

      // Rollback optimistic update on error
      setLocalUpvotes(previousUpvotes);
      setLocalDownvotes(previousDownvotes);
      setVoteStatus(previousStatus);

      const error = err as { response?: { data?: { message?: string } }; message?: string };
      toast.error(
        error.response?.data?.message || error.message || "Không thể vote. Vui lòng thử lại."
      );
    } finally {
      setIsVoting(false);
    }
  };

  const handleShare = async () => {
    if (!post) return;

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

  const handleReport = async (reason: string, details?: string) => {
    if (!post || !isAuthenticated) {
      toast.error("Vui lòng đăng nhập để báo cáo");
      return;
    }

    try {
      setReportLoading(true);
      await apiClient.post("/reviews/report", {
        review_post_id: post.id,
        reason,
        details,
      });
      toast.success("Đã gửi báo cáo. Cảm ơn bạn!");
      setIsReportModalOpen(false);
    } catch (err) {
      console.error("Failed to report:", err);
      toast.error("Không thể gửi báo cáo. Vui lòng thử lại.");
    } finally {
      setReportLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <MapVibeLoader
          size="lg"
          text="Đang tải bài viết..."
        />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">{error || "Không tìm thấy bài đăng"}</p>
        <Link
          to="/nearby"
          className="text-primary-500 hover:underline"
        >
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
                <div className="mb-3 flex items-start justify-between gap-4">
                  <h1 className="text-2xl font-bold leading-tight text-gray-900 md:text-4xl">
                    {post.title}
                  </h1>
                  {/* Report Button */}
                  <button
                    onClick={() => {
                      if (!isAuthenticated) {
                        toast.error("Vui lòng đăng nhập để báo cáo");
                        return;
                      }
                      setIsReportModalOpen(true);
                    }}
                    className="shrink-0 rounded-full p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-500"
                    title="Báo cáo bài viết"
                  >
                    <Flag className="h-5 w-5" />
                  </button>
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
                onClick={() => {
                  if (post.phone && post.phone !== "Chưa có số điện thoại") {
                    const phoneNumber = post.phone.replace(/[^\d+]/g, "");
                    window.location.href = `tel:${phoneNumber}`;
                  } else {
                    toast.error("Địa điểm này chưa có số điện thoại");
                  }
                }}
                title={post.phone}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500"
              >
                <PhoneCall className="h-4 w-4" />
                Gọi điện thoại
              </button>
              <button
                onClick={() => {
                  setActiveTab("gioi-thieu");
                  setTimeout(() => {
                    const voteSection = document.getElementById("vote-section");
                    if (voteSection) {
                      const headerOffset = 80;
                      const elementPosition = voteSection.getBoundingClientRect().top;
                      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
                      window.scrollTo({
                        top: offsetPosition,
                        behavior: "smooth",
                      });
                    } else {
                      document
                        .getElementById("tab-content")
                        ?.scrollIntoView({ behavior: "smooth" });
                    }
                  }, 100);
                }}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500"
              >
                <Star className="h-4 w-4" />
                Đánh giá bài viết
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
              <button
                onClick={handleShare}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 hover:text-primary-500"
              >
                <Share2 className="h-4 w-4" />
                Chia sẻ
              </button>
            </div>
          </div>
        </section>
      </div>

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onSubmit={handleReport}
        authorName={post.author}
        loading={reportLoading}
      />

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
                  ? "border-b-2 border-primary-500 text-primary-500"
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
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            <main className="space-y-6 lg:col-span-2">
              {/* Services/Features Panel - Above introduction */}
              {post.features && post.features.length > 0 && (
                <ServicesList services={post.features.map(mapFeatureToLabel)} />
              )}

              {/* Cuisine Types Panel - Display location services */}
              {post.cuisineTypes && post.cuisineTypes.length > 0 && (
                <CuisineType cuisineTypes={post.cuisineTypes} />
              )}

              {/* Introduction Panel */}
              <div className="rounded-xl bg-white p-6 shadow-sm">
                {/* Author Section - Above title */}
                <div className="mb-4 flex items-center gap-3 border-b border-gray-100 pb-4">
                  {post.authorAvatar ? (
                    <img
                      src={post.authorAvatar}
                      alt={post.author}
                      className="h-10 w-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700">
                      {post.author.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-900">{post.author}</span>
                      {post.approved ? (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-semibold text-green-700 ring-1 ring-green-200">
                          Đã kiểm duyệt
                        </span>
                      ) : (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-[11px] font-semibold text-yellow-800 ring-1 ring-yellow-200">
                          Đang chờ duyệt
                        </span>
                      )}
                    </div>
                    <span className="text-sm text-gray-500">{post.timeAgo}</span>
                  </div>
                </div>

                {/* Title - Below author, above content */}
                <h3 className="mb-4 text-lg font-semibold text-gray-900">Giới thiệu</h3>

                {/* Content */}
                <div
                  className="prose prose-sm prose-headings:text-gray-900 prose-a:text-primary-600 prose-a:no-underline hover:prose-a:underline max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: post.description }}
                />

                {/* Action Buttons - Below content */}
                <div
                  id="vote-section"
                  className="mt-6 flex items-center gap-2 border-t border-gray-100 pt-4"
                >
                  <motion.button
                    onClick={() => handleVote("upvote")}
                    disabled={!isAuthenticated || isVoting}
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
                    disabled={!isAuthenticated || isVoting}
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
                  <button
                    onClick={() => {
                      setActiveTab("binh-luan");
                      setTimeout(() => {
                        document
                          .getElementById("tab-content")
                          ?.scrollIntoView({ behavior: "smooth" });
                      }, 100);
                    }}
                    className="flex h-[28px] items-center justify-center gap-1 rounded-full bg-gray-100 px-2 text-gray-700 transition hover:bg-gray-200"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {post.stats.comments}
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex h-[28px] items-center justify-center gap-1 rounded-full bg-gray-100 px-2 text-gray-700 transition hover:bg-gray-200"
                    title="Chia sẻ"
                  >
                    <Share2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </main>

            <aside className="hidden lg:block">
              <DirectionSidebar address={post.address} />
            </aside>

            <div className="block lg:hidden">
              <DirectionSidebar address={post.address} />
            </div>
          </div>
        )}

        {activeTab === "binh-luan" && <CommentsTab reviewId={post.id} />}

        {activeTab === "anh" && (
          <div className="rounded-lg bg-white p-6 shadow-sm">
            {post.images && post.images.length > 0 ? (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {post.images.map((imageUrl, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square cursor-pointer overflow-hidden rounded-lg bg-gray-100"
                  >
                    <img
                      src={imageUrl}
                      alt={`Ảnh ${index + 1} của ${post.title}`}
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-110"
                      loading="lazy"
                      onError={(e) => {
                        console.error(
                          `[PostDetailPage] Failed to load image ${index + 1}:`,
                          imageUrl
                        );
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-8 text-center text-gray-500">Chưa có ảnh nào.</p>
            )}
          </div>
        )}

        {activeTab === "thuc-don" &&
          (post.restaurantSlug ? (
            <MenuTab slug={post.restaurantSlug} />
          ) : (
            <div className="rounded-lg bg-white p-8 text-center shadow-sm">
              <ImageIcon className="mx-auto h-12 w-12 text-gray-300" />
              <p className="mt-4 text-gray-500">Chưa có thực đơn cho địa điểm này.</p>
            </div>
          ))}
      </section>
    </div>
  );
}
