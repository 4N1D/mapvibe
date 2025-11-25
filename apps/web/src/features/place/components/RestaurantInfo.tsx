import {
  MapPin,
  DollarSign,
  Clock,
  Share2,
  Camera,
  MessageSquare,
  Bookmark,
  PhoneCall,
  Info,
  CheckCircle2,
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
}: RestaurantInfoProps) {
  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">
        {/* Left Column: Main Info */}
        <div className="flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-600">
              Yêu thích
            </span>
            <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{name}</h1>
          </div>

          <div className="mb-4 text-sm text-gray-500">{categories.join(" - ")}</div>

          <div className="space-y-3 text-sm">
            <div className="flex items-center gap-3 text-gray-700">
              <MapPin className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{address}</span>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <Clock className="h-4 w-4 shrink-0 text-gray-400" />
              <div className="flex items-center gap-2">
                <span className={isOpen ? "font-medium text-green-600" : "text-red-600"}>
                  {isOpen ? "Đang mở cửa" : "Đã đóng cửa"}
                </span>
                <span className="text-gray-400">|</span>
                <span>{hours}</span>
                <Info className="h-3 w-3 text-gray-400" />
              </div>
            </div>

            <div className="flex items-center gap-3 text-gray-700">
              <DollarSign className="h-4 w-4 shrink-0 text-gray-400" />
              <span>{priceRange}</span>
            </div>
          </div>
        </div>

        {/* Right Column: Ratings */}
        <div className="flex flex-col gap-6 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
          <div className="flex items-start gap-8">
            {/* Overall Rating */}
            <div className="flex flex-col items-center justify-center gap-1">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-2xl font-bold text-white shadow-lg">
                {rating}
              </div>
              <div className="text-xs text-gray-500">Tổng quát</div>
            </div>

            {/* Detailed Ratings */}
            <div className="grid grid-cols-3 gap-x-6 gap-y-2 text-center md:grid-cols-5 lg:grid-cols-5">
              {detailedRatings.map((r) => (
                <div
                  key={r.label}
                  className="flex flex-col items-center"
                >
                  <span className="text-lg font-semibold text-green-600">{r.score}</span>
                  <span className="text-xs text-gray-400">{r.label}</span>
                </div>
              ))}
              <div className="flex flex-col items-center">
                <span className="text-lg font-semibold text-gray-700">{reviewCount}</span>
                <span className="text-xs text-gray-400">Bình luận</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 text-sm text-gray-500">
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <span>Xác thực bởi MapVibe</span>
          </div>
        </div>
      </div>

      <hr className="my-6 border-gray-100" />

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:flex lg:justify-between">
        <button
          title={phone}
          className="hover:text-primary flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <PhoneCall className="h-4 w-4" />
          Gọi điện thoại
        </button>
        <button className="hover:text-primary flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          <Bookmark className="h-4 w-4" />
          Lưu vào Bộ sưu tập
        </button>
        <button className="hover:text-primary flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          <MessageSquare className="h-4 w-4" />
          Bình luận
        </button>
        <button className="hover:text-primary flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
          <Camera className="h-4 w-4" />
          Thêm ảnh
        </button>
        <button className="hover:text-primary col-span-2 flex items-center justify-center gap-2 rounded-lg border border-gray-200 px-3 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 md:col-span-4 lg:col-span-1 lg:flex-1">
          <Share2 className="h-4 w-4" />
          Chia sẻ
        </button>
      </div>
    </div>
  );
}
