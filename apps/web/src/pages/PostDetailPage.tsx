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
} from "lucide-react";
import { CommentsTab, PhotosTab, MenuTab } from "@/features/place";

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

// Mock data
const mockPost: PostDetail = {
  id: "p1",
  slug: "kichi-kichi",
  restaurantId: 1, // Temporary mock ID for API calls
  author: "Đỗ Trung Quân",
  userRank: "Hạng bạc",
  timeAgo: "2 giờ trước",
  approved: false,
  title: "Kichi Kichi",
  address: "Tầng 4 Vincom Plaza Lê Văn Việt, 50 Lê Văn Việt, Hiệp Phú, Quận 9, TP. HCM",
  phone: "0123456789",
  priceRange: "150.000 vnđ - 300.000 vnđ",
  hours: "11:00 AM - 10:00 PM",
  isOpen: true,
  categories: ["Lẩu", "Buffet", "Nhật Bản", "Gia đình"],
  description:
    "Tôi thấy đồ ăn ở đây tuy ngon nhưng rất đỗ ăn, nhân viên có thái độ lồi lõm khi khách muốn ăn quýt.",
  stats: {
    likes: 1200,
    dislikes: 503,
    comments: 324,
  },
  images: [
    "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&q=80",
    "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=800&q=80",
  ],
};

export function PostDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [activeTab, setActiveTab] = useState<string>("binh-luan");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      if (slug === mockPost.slug) {
        setPost(mockPost);
      }
      setLoading(false);
    }, 300);
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">Không tìm thấy bài đăng</p>
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
            <div className="flex h-96 gap-2">
              {/* Main image - Left 60% */}
              <div className="w-[60%] overflow-hidden rounded-lg">
                <img
                  src={post.images[0]}
                  alt={post.title}
                  className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                />
              </div>

              {/* Grid 2x2 - Right 40% */}
              <div className="grid w-[40%] grid-cols-2 grid-rows-2 gap-2">
                {post.images.slice(1, 5).map((img, idx) => (
                  <div
                    key={idx}
                    className={`overflow-hidden rounded-lg ${idx === 3 ? "relative" : ""}`}
                  >
                    <img
                      src={img}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                    />
                    {idx === 3 && (
                      <button className="absolute inset-0 flex items-center justify-center bg-black/50 text-sm font-medium text-white transition-colors hover:bg-black/60">
                        Xem thêm
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Post Info - Right on Desktop (7 cols) */}
        <section className="lg:order-2 lg:col-span-7">
          <div className="flex h-full flex-col justify-between">
            <div>
              {/* Title & Categories */}
              <div className="mb-4">
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                    Yêu thích
                  </span>
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
                    <span
                      className={
                        post.isOpen ? "font-bold text-green-600" : "font-bold text-red-600"
                      }
                    >
                      {post.isOpen ? "Đang mở cửa" : "Đã đóng cửa"}
                    </span>
                    <span className="text-gray-300">|</span>
                    <span>{post.hours}</span>
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
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700">
            {post.author.charAt(0).toUpperCase()}
          </div>
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
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ${
                  post.userRank === "Hạng đồng"
                    ? "bg-orange-100 text-orange-700 ring-orange-200"
                    : post.userRank === "Hạng bạc"
                      ? "bg-gray-200 text-gray-700 ring-gray-300"
                      : post.userRank === "Hạng vàng"
                        ? "bg-yellow-100 text-yellow-700 ring-yellow-200"
                        : post.userRank === "Hạng kim cương"
                          ? "bg-blue-100 text-blue-700 ring-blue-200"
                          : "bg-purple-100 text-purple-700 ring-purple-200"
                }`}
              >
                {post.userRank}
              </span>
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
            <p className="text-gray-700">{post.description}</p>
          </div>
        )}

        {activeTab === "binh-luan" && <CommentsTab restaurantId={post.restaurantId} />}

        {activeTab === "anh" && <PhotosTab restaurantId={post.restaurantId} />}

        {activeTab === "thuc-don" && <MenuTab restaurantId={post.restaurantId} />}
      </section>
    </div>
  );
}

