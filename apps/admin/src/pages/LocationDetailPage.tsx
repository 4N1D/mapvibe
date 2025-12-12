import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { apiClient } from "../lib/api";
import { Breadcrumbs, Skeleton } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";
import { getFeatureLabel, ALL_FEATURES } from "../utils/format";

const fixCdnUrl = (url: string): string => {
  const correctCdnDomain =
    import.meta.env.VITE_CLOUDFRONT_URL || "https://dxuh8yivsgocq.cloudfront.net";
  return url.replace(/https:\/\/d[a-z0-9]+\.cloudfront\.net/i, correctCdnDomain);
};

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
  source_type: "pending" | "approved";
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

type TabType = "posts" | "info";

export default function LocationDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<LocationData | null>(null);
  const [posts, setPosts] = useState<ReviewPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isAggregating, setIsAggregating] = useState(false);
  const [selectedPost, setSelectedPost] = useState<ReviewPost | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("posts");
  const [aggregateResult, setAggregateResult] = useState<AggregateResult | null>(null);
  const { confirm, ConfirmDialog } = useConfirm();

  const [formData, setFormData] = useState({
    name_vi: "",
    cuisine_types: [] as CuisineType[],
    price_min: "",
    price_max: "",
    phone: "",
    opening_hours: "",
    features: [] as string[],
    description: "",
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

      console.log("Posts API response:", postsRes.data.reviews);

      const loc = locationRes.data.location || locationRes.data;
      setLocation(loc);

      // Sort posts by upvote_count DESC (matching API logic)
      const sortedPosts = (postsRes.data.reviews || []).sort(
        (a: ReviewPost, b: ReviewPost) => (b.upvote_count || 0) - (a.upvote_count || 0)
      );
      setPosts(sortedPosts);

      setFormData((prev) => ({
        ...prev,
        name_vi: loc.restaurant_name || "",
      }));

      if (sortedPosts.length > 0) {
        setSelectedPost(sortedPosts[0]);
      }
    } catch (error) {
      console.error("Failed to load location:", error);
      toast.error("Failed to load location details");
    } finally {
      setLoading(false);
    }
  };

  const handleAIAggregate = async () => {
    if (posts.length === 0) {
      toast.error("Không có bài viết để tổng hợp");
      return;
    }

    setIsAggregating(true);
    try {
      // Use Lambda Function URL directly to bypass API Gateway 30s timeout
      const AGGREGATE_LAMBDA_URL = "https://bjukpevd6hzhpyzjaca4juknf40xqait.lambda-url.us-east-1.on.aws/";
      const session = await import("aws-amplify/auth").then(m => m.fetchAuthSession());
      const token = session.tokens?.idToken?.toString();
      
      const response = await fetch(AGGREGATE_LAMBDA_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ location_address_id: id }),
      }).then(res => res.json().then(data => ({ data })));

      console.log("Raw response:", response);
      console.log("Response status:", response.status);
      console.log("Response headers:", response.headers);
      console.log("Response data:", response.data);
      console.log("Response data type:", typeof response.data);
      console.log("Response data keys:", response.data ? Object.keys(response.data) : "null");

      // Validate response structure
      if (!response.data) {
        throw new Error("Response data is empty");
      }

      // Handle case where response.data might be a string
      let data: AggregateResult;
      try {
        if (typeof response.data === "string") {
          console.log("Parsing string response data...");
          data = JSON.parse(response.data);
        } else if (response.data && typeof response.data === "object") {
          console.log("Using object response data directly");
          data = response.data;
        } else {
          throw new Error(`Unexpected response data type: ${typeof response.data}`);
        }

        // Validate data structure
        if (!data || typeof data !== "object") {
          throw new Error("Parsed data is not an object");
        }
        
        if (!data.result || typeof data.result !== "object") {
          console.warn("⚠️ Missing or invalid 'result' field in response");
          console.warn("Data structure:", data);
          throw new Error("Response missing 'result' field");
        }

        console.log("✅ Parsed data successfully:", data);
        console.log("Result:", data.result);
        console.log("Result keys:", Object.keys(data.result));

      } catch (parseError: any) {
        console.error("❌ Failed to parse response data:", parseError);
        console.error("Raw response.data:", response.data);
        throw new Error(`Failed to parse response: ${parseError.message}`);
      }

      setAggregateResult(data);

      const result = data.result;
      
      // Debug: log all fields
      console.log("=== AI Result Fields ===");
      console.log("name_vi:", result.name_vi);
      console.log("cuisine_types:", result.cuisine_types);
      console.log("price_min:", result.price_min, "type:", typeof result.price_min);
      console.log("price_max:", result.price_max, "type:", typeof result.price_max);
      console.log("phone:", result.phone);
      console.log("opening_hours:", result.opening_hours);
      console.log("features:", result.features);
      console.log("description:", result.description);
      console.log("========================");

      const newFormData = {
        name_vi: result.name_vi || formData.name_vi,
        cuisine_types: result.cuisine_types || [],
        price_min: result.price_min != null ? String(result.price_min) : "",
        price_max: result.price_max != null ? String(result.price_max) : "",
        phone: result.phone || "",
        opening_hours: result.opening_hours || "",
        features: result.features || [],
        description: result.description || "",
      };
      
      console.log("New form data:", newFormData);
      setFormData(newFormData);

      toast.success(`AI đã tổng hợp từ ${data.reviews_used.length} bài viết!`);
      setActiveTab("info");
    } catch (error: any) {
      console.error("AI Aggregate error:", error);
      console.error("Error response:", error.response);
      console.error("Error response data:", error.response?.data);
      console.error("Error response status:", error.response?.status);
      console.error("Error message:", error.message);
      
      let errorMsg = "Lỗi không xác định";
      if (error.response?.data) {
        // Handle case where data might be a string
        const errorData = typeof error.response.data === "string" 
          ? JSON.parse(error.response.data) 
          : error.response.data;
        
        if (errorData?.error) {
          errorMsg = errorData.error;
        } else if (errorData?.message) {
          errorMsg = errorData.message;
        } else if (typeof error.response.data === "string") {
          errorMsg = error.response.data;
        }
      } else if (error.message) {
        errorMsg = error.message;
      }
      
      // Also check if response was successful but data format is wrong
      if (error.response?.status === 200 && error.response?.data) {
        console.warn("⚠️ Got 200 status but error in catch block - checking data format");
        console.warn("Response data type:", typeof error.response.data);
        console.warn("Response data:", error.response.data);
        
        // Try to parse if it's a string
        try {
          const parsedData = typeof error.response.data === "string" 
            ? JSON.parse(error.response.data) 
            : error.response.data;
          
          if (parsedData && parsedData.result) {
            console.log("✅ Found valid data in error response, using it");
            const data: AggregateResult = parsedData;
            setAggregateResult(data);
            
            const result = data.result;
            const newFormData = {
              name_vi: result.name_vi || formData.name_vi,
              cuisine_types: result.cuisine_types || [],
              price_min: result.price_min != null ? String(result.price_min) : "",
              price_max: result.price_max != null ? String(result.price_max) : "",
              phone: result.phone || "",
              opening_hours: result.opening_hours || "",
              features: result.features || [],
              description: result.description || "",
            };
            
            setFormData(newFormData);
            toast.success(`AI đã tổng hợp từ ${data.reviews_used.length} bài viết!`);
            setActiveTab("info");
            return; // Exit early if we successfully parsed the data
          }
        } catch (parseError) {
          console.error("Failed to parse response data:", parseError);
        }
      }
      
      if (error.response?.data?.error) {
        errorMsg = error.response.data.error;
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      } else if (error.code === "ECONNABORTED") {
        errorMsg = "Timeout - AI đang xử lý quá lâu, vui lòng thử lại";
      } else if (error.message) {
        errorMsg = error.message;
      }
      toast.error("Lỗi tổng hợp: " + errorMsg);
    } finally {
      setIsAggregating(false);
    }
  };

  const handleApprove = async () => {
    if (!formData.name_vi.trim()) {
      toast.error("Tên nhà hàng là bắt buộc");
      setActiveTab("info");
      return;
    }

    const confirmed = await confirm({
      title: "Duyệt địa điểm",
      message: `Tạo nhà hàng "${formData.name_vi}"?`,
      confirmText: "Duyệt",
      variant: "info",
    });

    if (!confirmed) return;

    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/locations/${id}`, {
        action: "approve",
        ...formData,
        price_min: formData.price_min ? parseInt(formData.price_min) : null,
        price_max: formData.price_max ? parseInt(formData.price_max) : null,
      });
      toast.success("Đã duyệt! Nhà hàng đã được tạo.");
      navigate("/locations/pending");
    } catch (error: any) {
      toast.error("Lỗi duyệt: " + (error.response?.data?.message || "Lỗi không xác định"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    const confirmed = await confirm({
      title: "Từ chối địa điểm",
      message: "Từ chối địa điểm này?",
      confirmText: "Từ chối",
      variant: "danger",
    });

    if (!confirmed) return;

    setSubmitting(true);
    try {
      await apiClient.patch(`/admin/locations/${id}`, { action: "reject" });
      toast.success("Đã từ chối địa điểm");
      navigate("/locations/pending");
    } catch (error: any) {
      toast.error("Lỗi từ chối: " + (error.response?.data?.message || "Lỗi không xác định"));
    } finally {
      setSubmitting(false);
    }
  };

  const toggleFeature = (feature: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(feature)
        ? prev.features.filter((f) => f !== feature)
        : [...prev.features, feature],
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
            {[0, 1, 2].map((i) => (
              <Skeleton
                key={i}
                className="h-24 w-full rounded-xl"
              />
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
      <div className="py-16 text-center">
        <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gray-100">
          <svg
            className="h-10 w-10 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900">Không tìm thấy địa điểm</h3>
        <button
          onClick={() => navigate("/locations/pending")}
          className="mt-4 font-medium text-primary-600 hover:text-primary-700"
        >
          ← Quay lại danh sách chờ duyệt
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      <Breadcrumbs
        items={[
          { label: "Tổng quan", href: "/" },
          { label: "Chờ duyệt", href: "/locations/pending" },
          { label: location.restaurant_name || "Chi tiết" },
        ]}
      />

      {/* Header Card */}
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-2 flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                {location.restaurant_name || "Chưa có tên"}
              </h1>
              <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700">
                Chờ duyệt
              </span>
            </div>
            <p className="flex items-center gap-2 text-gray-600">
              <svg
                className="h-4 w-4"
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
              </svg>
              {location.full_address ||
                `${location.street_address}, ${location.ward}, ${location.city}`}
            </p>
            <div className="mt-3 flex items-center gap-4 text-sm text-gray-500">
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
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
                {location.submitted_by_name || "Không rõ"}
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
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
                {formatDate(location.created_at)}
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="h-4 w-4"
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
                {posts.length} bài viết
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleAIAggregate}
              disabled={isAggregating || posts.length === 0}
              className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-2.5 font-medium text-white shadow-sm transition-all hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50"
            >
              {isAggregating ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 10V3L4 14h7v7l9-11h-7z"
                    />
                  </svg>
                  AI Tổng hợp
                </>
              )}
            </button>
            <button
              onClick={handleReject}
              disabled={submitting}
              className="rounded-lg border-2 border-red-200 px-5 py-2.5 font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50"
            >
              Từ chối
            </button>
            <button
              onClick={handleApprove}
              disabled={submitting}
              className="flex items-center gap-2 rounded-lg bg-green-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <svg
                    className="h-4 w-4 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  Đang xử lý...
                </>
              ) : (
                <>
                  <svg
                    className="h-4 w-4"
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
                  Duyệt
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-gray-500">
              Bài viết ({posts.length})
            </h3>
            <span className="text-xs text-gray-400">Theo lượt thích</span>
          </div>

          {posts.length === 0 ? (
            <div className="rounded-xl border border-gray-200 bg-white p-8 text-center">
              <svg
                className="mx-auto mb-2 h-10 w-10 text-gray-300"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                />
              </svg>
              <p className="text-sm text-gray-500">Chưa có bài viết</p>
            </div>
          ) : (
            <div className="max-h-[600px] space-y-2 overflow-y-auto pr-2">
              {posts.map((post, index) => (
                <button
                  key={post.id}
                  onClick={() => {
                    setSelectedPost(post);
                    setActiveTab("posts");
                  }}
                  className={`w-full rounded-xl border-2 p-4 text-left transition-all ${
                    selectedPost?.id === post.id && activeTab === "posts"
                      ? "border-primary-500 bg-primary-50"
                      : isPostUsedInAggregate(post.id)
                        ? "border-purple-300 bg-purple-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                  }`}
                >
                  <div className="mb-2 flex items-center gap-3">
                    {/* Rank Badge - inside the card */}
                    {index < 3 ? (
                      <div
                        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                          index === 0
                            ? "bg-yellow-400 text-yellow-900"
                            : index === 1
                              ? "bg-gray-300 text-gray-700"
                              : "bg-amber-600 text-white"
                        }`}
                      >
                        #{index + 1}
                      </div>
                    ) : (
                      <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-medium text-white">
                        {post.author_name?.[0]?.toUpperCase() || "U"}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {post.author_name || "Ẩn danh"}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5 font-medium text-green-600">
                          <svg
                            className="h-3 w-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {post.upvote_count || 0}
                        </span>
                        <span>•</span>
                        <span>{formatDate(post.created_at)}</span>
                      </div>
                    </div>
                    {post.photos && post.photos.length > 0 && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <svg
                          className="h-3.5 w-3.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {post.photos.length}
                      </span>
                    )}
                    {/* AI Used badge */}
                    {isPostUsedInAggregate(post.id) && (
                      <span className="rounded-full bg-purple-600 px-2 py-0.5 text-xs font-medium text-white">
                        AI
                      </span>
                    )}
                  </div>
                  <div
                    className="line-clamp-2 text-sm text-gray-600"
                    dangerouslySetInnerHTML={{ __html: post.text }}
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Tabs */}
        <div className="col-span-8">
          {/* Tab Headers */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
              <button
                onClick={() => setActiveTab("posts")}
                className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "posts"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Chi tiết bài viết
              </button>
              <button
                onClick={() => setActiveTab("info")}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === "info"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                Thông tin địa điểm
                {aggregateResult && (
                  <span className="rounded bg-purple-100 px-1.5 py-0.5 text-xs text-purple-700">
                    AI
                  </span>
                )}
              </button>
            </div>

            {/* Aggregate Stats */}
            {aggregateResult && activeTab === "info" && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="rounded bg-purple-50 px-2 py-1 text-purple-700">
                  {aggregateResult.reviews_used.length} bài viết
                </span>
                <span className="rounded bg-gray-100 px-2 py-1 text-gray-600">
                  {aggregateResult.comments_used.length} bình luận
                </span>
              </div>
            )}
          </div>

          {/* Tab Content */}
          {activeTab === "posts" ? (
            selectedPost ? (
              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="border-b border-gray-100 p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-lg font-bold text-white">
                        {selectedPost.author_name?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {selectedPost.author_name || "Ẩn danh"}
                        </h3>
                        <p className="text-sm text-gray-500">
                          {formatDate(selectedPost.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1 rounded-full bg-green-100 px-3 py-1.5 text-sm font-medium text-green-700">
                        <svg
                          className="h-4 w-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {selectedPost.upvote_count || 0}
                      </span>
                      {isPostUsedInAggregate(selectedPost.id) && (
                        <span className="rounded-full bg-purple-100 px-3 py-1.5 text-sm font-medium text-purple-700">
                          AI sử dụng
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-6">
                  <div>
                    <p className="font-bold">Giới thiệu</p>
                    <div
                      className="text-base leading-relaxed text-gray-800 [&>p:last-child]:mb-0 [&>p]:mb-2"
                      dangerouslySetInnerHTML={{ __html: selectedPost.text }}
                    />
                  </div>

                  {selectedPost.features &&
                    (Array.isArray(selectedPost.features)
                      ? selectedPost.features.length > 0
                      : Object.keys(selectedPost.features).length > 0) && (
                      <div className="mt-4">
                        <h4 className="mb-2 font-bold text-gray-700">Tiện ích</h4>
                        <div className="flex flex-wrap gap-2">
                          {ALL_FEATURES.filter((feature) => {
                            if (Array.isArray(selectedPost.features)) {
                              return selectedPost.features.includes(feature);
                            }
                            return selectedPost.features?.[feature];
                          }).map((feature) => (
                            <span
                              key={feature}
                              className="rounded-full bg-blue-100 px-3 py-1 text-sm text-blue-700"
                            >
                              {getFeatureLabel(feature)}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                  {selectedPost.photos && selectedPost.photos.length > 0 && (
                    <div className="mt-6">
                      <h4 className="mb-3 text-sm font-bold text-gray-700">
                        Ảnh ({selectedPost.photos.length})
                      </h4>
                      <div className="grid grid-cols-3 gap-3">
                        {selectedPost.photos.map((photo, i) => {
                          const fixedUrl = fixCdnUrl(photo);
                          return (
                            <a
                              key={i}
                              href={fixedUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="aspect-square overflow-hidden rounded-lg bg-gray-100 transition-opacity hover:opacity-90"
                            >
                              <img
                                src={fixedUrl}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1}
                    d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5"
                  />
                </svg>
                <p className="mt-4 text-gray-500">Chọn một bài viết để xem chi tiết</p>
              </div>
            )
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Thông tin nhà hàng</h3>
                  <p className="text-sm text-gray-500">
                    {aggregateResult
                      ? "AI đã tổng hợp - kiểm tra và chỉnh sửa trước khi duyệt"
                      : "Điền thông tin trước khi duyệt"}
                  </p>
                </div>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    Tên nhà hàng <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name_vi}
                    onChange={(e) => setFormData({ ...formData, name_vi: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-transparent focus:ring-2 focus:ring-primary-500"
                    placeholder="VD: Phở Thìn"
                  />
                </div>

                {/* Cuisine Types - New format with name/description */}
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Loại ẩm thực
                    {formData.cuisine_types.length > 0 && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({formData.cuisine_types.length} loại)
                      </span>
                    )}
                  </label>
                  {formData.cuisine_types.length > 0 ? (
                    <div className="space-y-2">
                      {formData.cuisine_types.map((cuisine, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="font-medium text-gray-900">{cuisine.name}</span>
                              {cuisine.description && (
                                <p className="mt-1 text-sm text-gray-600">{cuisine.description}</p>
                              )}
                            </div>
                            <button
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  cuisine_types: prev.cuisine_types.filter((_, i) => i !== idx),
                                }))
                              }
                              className="text-gray-400 hover:text-red-500"
                            >
                              <svg
                                className="h-4 w-4"
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
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm italic text-gray-400">
                      Chưa có loại ẩm thực. Nhấn AI Tổng hợp để tạo.
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Giá thấp nhất (VND)
                    </label>
                    <input
                      type="number"
                      value={formData.price_min}
                      onChange={(e) => setFormData({ ...formData, price_min: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      placeholder="30000"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                      Giá cao nhất (VND)
                    </label>
                    <input
                      type="number"
                      value={formData.price_max}
                      onChange={(e) => setFormData({ ...formData, price_max: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      placeholder="70000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Số điện thoại</label>
                    <input
                      type="text"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      placeholder="0901234567"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Giờ mở cửa</label>
                    <input
                      type="text"
                      value={formData.opening_hours}
                      onChange={(e) => setFormData({ ...formData, opening_hours: e.target.value })}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                      placeholder="07:00 - 22:00"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">Tiện ích</label>
                  <div className="grid grid-cols-3 gap-2">
                    {ALL_FEATURES.map((feature) => (
                      <label
                        key={feature}
                        className={`flex cursor-pointer items-center gap-2 rounded-lg border-2 p-3 transition-colors ${
                          formData.features.includes(feature)
                            ? "border-primary-500 bg-primary-50"
                            : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={formData.features.includes(feature)}
                          onChange={() => toggleFeature(feature)}
                          className="sr-only"
                        />
                        <span className="text-sm capitalize text-gray-700">
                          {getFeatureLabel(feature)}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Mô tả</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={4}
                    className="w-full resize-none rounded-lg border border-gray-300 px-4 py-2.5 focus:ring-2 focus:ring-primary-500"
                    placeholder="Mô tả nhà hàng..."
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
