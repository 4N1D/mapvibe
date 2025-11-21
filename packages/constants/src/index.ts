// Shared constants for MapVibe

// ============================================
// Districts in Ho Chi Minh City
// ============================================
export const DISTRICTS = [
  "Quận 1",
  "Quận 2",
  "Quận 3",
  "Quận 4",
  "Quận 5",
  "Quận 6",
  "Quận 7",
  "Quận 8",
  "Quận 9",
  "Quận 10",
  "Quận 11",
  "Quận 12",
  "Bình Thạnh",
  "Gò Vấp",
  "Phú Nhuận",
  "Tân Bình",
  "Tân Phú",
  "Thủ Đức",
  "Bình Tân",
  "Củ Chi",
  "Hóc Môn",
  "Nhà Bè",
  "Cần Giờ",
] as const;

export type District = (typeof DISTRICTS)[number];

// ============================================
// Rating System (for approved restaurants)
// ============================================
export const MIN_RATING = 1;
export const MAX_RATING = 10;

export const RATING_ASPECTS = [
  "service", // Phục vụ
  "location", // Vị trí
  "price", // Giá cả
  "quality", // Chất lượng
  "ambiance", // Không gian
] as const;

export type RatingAspect = (typeof RATING_ASPECTS)[number];

// ============================================
// Review System
// ============================================
export const MIN_REVIEW_LENGTH = 100; // characters
export const MAX_PHOTOS_PER_REVIEW = 10;

// Voting period for pending locations
export const VOTING_PERIOD_DAYS = 14;
export const UPVOTE_THRESHOLD = 0.7; // 70% upvote rate for approval

// Vote limits
export const MAX_VOTES_PER_USER_PER_DAY = 30;

// ============================================
// Features (Services/Amenities) - FIXED LIST
// ============================================
// These are fixed features that AI can detect/assign
export const FEATURES = [
  "wifi", // Wifi quán
  "outdoor_seating", // Chỗ ngồi ngoài trời
  "parking", // Chỗ đỗ xe
  "air_conditioning", // Điều hòa
  "vegetarian_menu", // Thực đơn chay
  "delivery", // Giao hàng
  "reservation", // Đặt chỗ
  "music", // Có nhạc
  "outdoor_view", // Tầm nhìn đẹp
  "romantic", // Không gian lãng mạn
  "private_room", // Phòng riêng
  "kids_friendly", // Thân thiện với trẻ em
  "pet_friendly", // Thân thiện với thú cưng
  "fast_service", // Phục vụ nhanh
  "professional_staff", // Nhân viên chuyên nghiệp
] as const;

export type Feature = (typeof FEATURES)[number];

// ============================================
// CUISINE STYLES/TYPES - FROM DATABASE (DYNAMIC)
// ============================================
// NOTE: Cuisine styles are AI-generated and stored in database
// Examples from UI:
// - 'Buffet nướng bằng chuyên' (Buffet with specialized grilling)
// - 'Lẩu đa dạng nước dùng' (Hotpot with diverse broths)
// - 'Chế biến theo yêu cầu' (Custom preparation)
// - 'Ẩm thực Nhật Bản' (Japanese cuisine)
// - 'Nước chấm đa dạng' (Diverse dipping sauces)
//
// These are dynamic and stored in: restaurants.cuisine_types (JSON array)
// AI detects from: restaurant name + reviews + description
// Not a fixed list - comes from DB and AI analysis
export type CuisineStyle = string; // Dynamic from DB

// ============================================
// Photo Types
// ============================================
export const PHOTO_TYPES = [
  "general", // Tất cả
  "space", // Không gian
  "food", // Món ăn
  "menu", // Menu (OCR required)
  "video", // Video
] as const;

export type PhotoType = (typeof PHOTO_TYPES)[number];

// ============================================
// Vote Types
// ============================================
export const VOTE_TYPES = ["upvote", "downvote"] as const;
export type VoteType = (typeof VOTE_TYPES)[number];

// ============================================
// Search
// ============================================
export const SEARCH_RADIUS_KM = 5; // Default search radius
export const MAX_SEARCH_RESULTS = 50;

// ============================================
// Fuzzy Matching Thresholds
// ============================================
export const DUPLICATE_THRESHOLD_BLOCK = 0.95; // >= 95%: Block submission
export const DUPLICATE_THRESHOLD_SUGGEST_STRONG = 0.85; // 85-95%: Strong warning
export const DUPLICATE_THRESHOLD_SUGGEST_WEAK = 0.7; // 70-85%: Weak warning
