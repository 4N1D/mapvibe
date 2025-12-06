import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Clock,
  MapPin,
  MessageCircle,
  Phone,
  DollarSign,
  ThumbsUp,
  ThumbsDown,
  SlidersHorizontal,
} from "lucide-react";

interface GalleryItem {
  url: string;
}

interface PostItem {
  id: string;
  slug: string;
  author: string;
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
  };
  images: GalleryItem[];
}

const mockPosts: PostItem[] = [
  {
    id: "p1",
    slug: "kichi-kichi",
    author: "Đỗ Trung Quân",
    userRank: "Hạng bạc",
    timeAgo: "32 phút trước",
    approved: false,
    title: "Kichi Kichi",
    address: "Tầng 4 Vincom Plaza Lê Văn Việt, 50 Lê Văn Việt, Hiệp Phú, Quận 9, TP.HCM",
    phone: "0123456789",
    priceRange: "150.000 - 300.000 vnđ",
    hours: "Đang mở cửa • 11:00 AM - 10:00 PM",
    description:
      "Không gian quán kiểu ấm cúng, đồ ăn bớt mặn, bàn ghế sạch sẽ và nhân viên rất nhiệt tình. Tuy nhiên, đồ ăn hơi mặn, hoặc do tôi ăn nhạt ...",
    stats: {
      comments: 503,
      upvotes: 234,
      downvotes: 12,
    },
    images: [
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&sat=-30" },
      { url: "https://images.unsplash.com/photo-1481391300270-4cbf0b8672e7?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&hue=20" },
    ],
  },
  {
    id: "p2",
    slug: "nijyu-maru",
    author: "Lê Văn Long",
    userRank: "Hạng vàng",
    timeAgo: "4 giờ trước",
    approved: true,
    title: "Nijyu Maru",
    address: "50 Lê Văn Việt, Hiệp Phú, Thủ Đức, Hồ Chí Minh",
    phone: "0123456789",
    priceRange: "150.000 - 300.000 vnđ",
    hours: "Đang mở cửa • 11:00 AM - 10:00 PM",
    description:
      "Không gian quán kiểu ấm cúng, đồ ăn bớt mặn, bàn ghế sạch sẽ và nhân viên rất nhiệt tình. Tuy nhiên, đồ ăn hơi mặn, hoặc do tôi ăn nhạt ...",
    stats: {
      comments: 503,
      upvotes: 210,
      downvotes: 9,
    },
    images: [
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&sat=-10" },
      { url: "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&blur=0" },
    ],
  },
  {
    id: "p3",
    slug: "lau-manwah",
    author: "Đỗ Thị Lan",
    userRank: "Hạng đồng",
    timeAgo: "7 giờ trước",
    approved: true,
    title: "Lẩu Manwah",
    address: "Tầng 4 Vincom Plaza Lê Văn Việt, Hiệp Phú, Quận 9, TP.HCM",
    phone: "0123456789",
    priceRange: "150.000 - 300.000 vnđ",
    hours: "Đang mở cửa • 11:00 AM - 10:00 PM",
    description:
      "Không gian quán kiểu ấm cúng, đồ ăn bớt mặn, bàn ghế sạch sẽ và nhân viên rất nhiệt tình. Tuy nhiên, đồ ăn hơi mặn, hoặc do tôi ăn nhạt ...",
    stats: {
      comments: 503,
      upvotes: 198,
      downvotes: 7,
    },
    images: [
      { url: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=900&q=80&sat=10" },
      { url: "https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1604908177796-253a53a590de?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1544145945-f90425340c7b?auto=format&fit=crop&w=900&q=80" },
      { url: "https://images.unsplash.com/photo-1476224203421-9ac39bcb3327?auto=format&fit=crop&w=900&q=80" },
    ],
  },
];

function Gallery({ items }: { items: GalleryItem[] }) {
  const display = useMemo(() => items.slice(0, 5), [items]);
  const extra = items.length - display.length;
  return (
    <div className="grid h-full w-full grid-cols-5 grid-rows-2 gap-1 sm:gap-2">
      {/* Main image spans 2 rows, 3 cols */}
      <div className="relative col-span-3 row-span-2 overflow-hidden rounded-lg">
        <img
          src={display[0]?.url}
          alt=""
          className="h-full w-full object-cover"
        />
      </div>
      {/* Top right images */}
      {display[1] && (
        <div className="overflow-hidden rounded-lg">
          <img src={display[1].url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      {display[2] && (
        <div className="overflow-hidden rounded-lg">
          <img src={display[2].url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      {/* Bottom right images */}
      {display[3] && (
        <div className="relative overflow-hidden rounded-lg">
          <img src={display[3].url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      {display[4] && (
        <div className="relative overflow-hidden rounded-lg">
          <img src={display[4].url} alt="" className="h-full w-full object-cover" />
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

function PostCard({ post }: { post: PostItem }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-200 font-semibold text-gray-700">
            {post.author.charAt(0).toUpperCase()}
          </div>
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
            <span>{post.hours}</span>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-xl bg-gray-100">
          <Gallery items={post.images} />
        </div>

        <p className="mt-3 text-sm text-gray-700">{post.description}</p>

        <div className="mt-3 flex items-center justify-between text-xs text-gray-600">
          <Link to={`/post/${post.slug}`} className="text-red-600 hover:underline">
            Xem chi tiết
          </Link>
          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 transition hover:bg-gray-200">
              <ThumbsUp className="h-4 w-4" />
              {post.stats.upvotes}
            </button>
            <button className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 transition hover:bg-gray-200">
              <ThumbsDown className="h-4 w-4" />
              {post.stats.downvotes}
            </button>
            <button className="flex items-center gap-1 rounded-full bg-gray-100 px-2 py-1 text-gray-700 transition hover:bg-gray-200">
              <MessageCircle className="h-4 w-4" />
              {post.stats.comments}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function NearbyPage() {
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
          {mockPosts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </main>
      </div>
    </div>
  );
}

