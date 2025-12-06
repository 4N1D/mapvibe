import {
  MapPin,
  DollarSign,
  Clock,
  Share2,
  Bookmark,
  PhoneCall,
  MessageSquare,
} from "lucide-react";

interface DetailedRating {
  label: string;
  score: number;
}

interface RestaurantInfoProps {
  name: string;
  address: string;
  phone: string;
  priceRange: string;
  hours: string;
  rating: number;
  reviewCount?: number;
  isOpen?: boolean;
  categories?: string[];
  detailedRatings?: DetailedRating[];
  breadcrumbs?: string[];
  onCommentClick?: () => void;
}

export function RestaurantInfo({
  name,
  address,
  phone,
  priceRange,
  hours,
  rating,
  reviewCount = 0,
  isOpen = true,
  categories = ["Café/Dessert", "Đài Loan", "Sinh viên", "Cặp đôi"],
  detailedRatings = [
    { label: "Vị trí", score: 7.7 },
    { label: "Không gian", score: 7.4 },
    { label: "Chất lượng", score: 7.4 },
    { label: "Phục vụ", score: 7.2 },
    { label: "Giá cả", score: 6.8 },
  ],
  breadcrumbs = ["Hà Nội", "Quận Ba Đình", "Khu vực Công viên Thủ Lệ"], // Added as per instruction
  onCommentClick,
}: RestaurantInfoProps) {
  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Breadcrumbs */}
        <div className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-400">
          {breadcrumbs.join(" / ")}
        </div>

        <div className="flex flex-col gap-4">
          {/* Header: Title & Ratings */}
          <div className="flex items-start justify-between gap-4">
            {/* Left: Title & Categories */}
            <div>
              <div className="mb-3 flex items-center gap-3">
                <span className="rounded bg-red-500 px-2 py-0.5 text-xs font-bold text-white shadow-sm">
                  Yêu thích
                </span>
                <h1 className="text-2xl font-bold leading-tight text-gray-900 md:text-4xl">
                  {name}
                </h1>
              </div>

              <div className="mb-5 text-sm font-medium text-gray-500">{categories.join(" • ")}</div>
            </div>

            {/* Right: Ratings (Compact) - Now inside Main Info */}
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500 text-lg font-bold text-white shadow-md ring-4 ring-emerald-50">
                  {rating}
                </div>
                <div className="hidden flex-col items-start sm:flex">
                  <span className="text-xs font-semibold uppercase text-emerald-600">
                    {rating >= 9.0
                      ? "Xuất sắc"
                      : rating >= 8.0
                        ? "Tuyệt vời"
                        : rating >= 7.0
                          ? "Rất ngon"
                          : "Hương vị tốt"}
                  </span>
                  <span className="text-xs text-gray-500">{reviewCount} đánh giá</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2.5 text-sm">
            <div className="hover:text-primary-500 flex items-start gap-3 text-gray-700 transition-colors">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-gray-400" />
              <span className="line-clamp-2">{address}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex items-center gap-2">
                <span className={isOpen ? "font-bold text-green-600" : "font-bold text-red-600"}>
                  {isOpen ? "Đang mở cửa" : "Đã đóng cửa"}
                </span>
                <span className="text-gray-300">|</span>
                <span>{hours}</span>
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <DollarSign className="h-4 w-4 shrink-0 text-gray-400" />
              <span className="font-medium">{priceRange}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-700 hover:text-primary-600">
              <PhoneCall className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{phone}</span>
            </div>
          </div>
        </div>

        {/* Detailed Ratings Grid */}
        <div className="mt-6 grid grid-cols-5 gap-2 border-t border-gray-100 pt-4">
          {detailedRatings.map((r) => (
            <div
              key={r.label}
              className="flex flex-col items-center gap-1"
            >
              <span className="text-sm font-bold text-emerald-600">{r.score}</span>
              <span className="text-[10px] uppercase tracking-wider text-gray-400">{r.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="mt-6 flex gap-3 border-t border-gray-100 pt-4">
        <button
          title={phone}
          className="hover:text-primary-500 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:flex-1"
        >
          <PhoneCall className="h-4 w-4" />
          Gọi điện thoại
        </button>
        <button className="hover:text-primary-500 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:flex-1">
          <Bookmark className="h-4 w-4" />
          Lưu vào Bộ sưu tập
        </button>
        <button
          onClick={onCommentClick}
          className="hover:text-primary-500 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:flex-1"
        >
          <MessageSquare className="h-4 w-4" />
          Bình luận
        </button>
        <button className="hover:text-primary-500 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 lg:flex-1">
          <Share2 className="h-4 w-4" />
          Chia sẻ
        </button>
      </div>
    </div>
  );
}
