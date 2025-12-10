export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  display_name?: string;
  avatar?: string;
  background?: string;
  background_image?: string;
  bio?: string;
  reputation: number;
  roles: string[];
  account_status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  date_of_birth?: string;
  gender?: string;
}

export interface UserStats {
  review_count: number;
  review_post_count: number;
  restaurant_review_count: number;
  photo_count: number;
  comment_count: number;
  saved_count: number;
}

export interface PhotoItem {
  id: string;
  url: string;
  created_at: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

export interface PhotoGroup {
  date: string;
  items: PhotoItem[];
}

export interface UserReview {
  id: string;
  type: "review_post" | "restaurant_review";
  text: string;
  photos?: string[];
  features?: string[];
  upvote_count: number;
  downvote_count: number;
  comment_count: number;
  share_count: number;
  view_count: number;
  restaurant_id?: string;
  restaurant_name?: string;
  restaurant_slug?: string;
  location_address_id?: string;
  rating_overall?: number;
  rating_price?: number;
  rating_quality?: number;
  rating_ambiance?: number;
  created_at: string;
}

export interface SavedRestaurant {
  restaurant_id: string;
  name: string;
  slug: string;
  address?: string;
  ward?: string;
  rating_overall?: number;
  review_count?: number;
  price_min?: number;
  price_max?: number;
  saved_at: string;
  cover_url?: string;
}

export interface UpdateProfileData {
  display_name?: string;
  bio?: string;
  phone?: string;
  gender?: string;
}

export type ProfileMenuItem = "thong-tin" | "anh" | "bai-viet-dang" | "bai-viet-luu";
