import { Card, CardContent } from "@mapvibe/ui-components";
import { Heart, MessageCircle, TrendingUp } from "lucide-react";

// Mock data - trending reviews
const mockReviews = [
  {
    id: 1,
    restaurantName: "Lẩu Manumon",
    reviewerName: "Minh Nguyen",
    reviewerAvatar: "",
    content:
      "Đồ ăn siêu ngon, nước lẩu đậm đà. Nhân viên phục vụ nhiệt tình. Không gian rộng rãi, sạch sẽ. Giá cả hợp lý so với chất lượng...",
    image: "/images/reviews/placeholder.jpg",
    likes: 234,
    comments: 45,
    tags: ["trending", "hot"],
    createdAt: "2 giờ trước",
  },
  {
    id: 2,
    restaurantName: "Kichi Kichi Lê Văn Việt",
    reviewerName: "Thu Trang",
    reviewerAvatar: "",
    content:
      "Buffet lẩu băng chuyền với hơn 100 món. Thịt bò Mỹ mềm, ngọt. Hải sản tươi sống. Tráng miệng đa dạng...",
    image: "/images/reviews/placeholder.jpg",
    likes: 189,
    comments: 32,
    tags: ["new"],
    createdAt: "5 giờ trước",
  },
  {
    id: 3,
    restaurantName: "Cơm tấm Phúc Lộc Thọ",
    reviewerName: "Hoang Anh",
    reviewerAvatar: "",
    content:
      "Sườn nướng than hồng, thơm lừng. Bì giòn, chả trứng béo ngậy. Nước mắm pha chuẩn vị Sài Gòn. Giá sinh viên...",
    image: "/images/reviews/placeholder.jpg",
    likes: 156,
    comments: 28,
    tags: ["trending"],
    createdAt: "1 ngày trước",
  },
  {
    id: 4,
    restaurantName: "Phở Hùng Vương",
    reviewerName: "Lan Pham",
    reviewerAvatar: "",
    content:
      "Nước phở trong, ngọt xương. Bánh phở mềm vừa. Thịt bò tái chín đầy đủ. Quán đông nhưng phục vụ nhanh...",
    image: "/images/reviews/placeholder.jpg",
    likes: 312,
    comments: 67,
    tags: ["hot", "trending"],
    createdAt: "3 giờ trước",
  },
  {
    id: 5,
    restaurantName: "Bánh mì Huỳnh Hoa",
    reviewerName: "Duc Tran",
    reviewerAvatar: "",
    content:
      "Bánh mì ngon nhất Sài Gòn! Nhân đầy ụ, pate thơm béo. Xá xíu mềm ngọt. Đáng để xếp hàng 30 phút...",
    image: "/images/reviews/placeholder.jpg",
    likes: 445,
    comments: 89,
    tags: ["hot"],
    createdAt: "6 giờ trước",
  },
  {
    id: 6,
    restaurantName: "Bún bò Huế O Xuân",
    reviewerName: "Mai Le",
    reviewerAvatar: "",
    content:
      "Nước bún đỏ au, cay nồng đúng vị Huế. Giò heo to, mềm. Chả cua thơm. Rau sống tươi, đầy đủ...",
    image: "/images/reviews/placeholder.jpg",
    likes: 198,
    comments: 41,
    tags: ["new", "trending"],
    createdAt: "8 giờ trước",
  },
];

export function FeaturedReviews() {
  return (
    <div className="bg-gray-50 py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8 flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary-500" />
          <h2 className="text-3xl font-bold text-gray-900">Review nổi bật</h2>
        </div>
        <p className="mb-8 text-gray-600">Những bài đánh giá đang được quan tâm nhiều nhất</p>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {mockReviews.map((review) => (
            <Card
              key={review.id}
              className="cursor-pointer overflow-hidden transition-all hover:-translate-y-1 hover:shadow-lg"
            >
              {/* Image */}
              <div className="relative h-48 bg-gray-200">
                <div className="flex h-full w-full items-center justify-center text-gray-400">
                  <svg
                    className="h-12 w-12"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1}
                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </div>

                {/* Tags */}
                <div className="absolute left-2 top-2 flex gap-1">
                  {review.tags.map((tag) => (
                    <span
                      key={tag}
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        tag === "hot"
                          ? "bg-red-500 text-white"
                          : tag === "trending"
                            ? "bg-orange-500 text-white"
                            : "bg-blue-500 text-white"
                      }`}
                    >
                      {tag === "hot" ? "🔥 Hot" : tag === "trending" ? "📈 Trending" : "✨ New"}
                    </span>
                  ))}
                </div>
              </div>

              <CardContent className="space-y-3 p-4">
                {/* Restaurant name */}
                <h3 className="font-semibold text-gray-900">{review.restaurantName}</h3>

                {/* Review content */}
                <p className="line-clamp-3 text-sm text-gray-600">{review.content}</p>

                {/* Reviewer info */}
                <div className="flex items-center justify-between border-t border-gray-100 pt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300">
                      <span className="text-xs font-medium text-gray-600">
                        {review.reviewerName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900">{review.reviewerName}</p>
                      <p className="text-xs text-gray-500">{review.createdAt}</p>
                    </div>
                  </div>

                  {/* Engagement */}
                  <div className="flex items-center gap-3 text-gray-500">
                    <span className="flex items-center gap-1 text-xs">
                      <Heart className="h-3 w-3" />
                      {review.likes}
                    </span>
                    <span className="flex items-center gap-1 text-xs">
                      <MessageCircle className="h-3 w-3" />
                      {review.comments}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
