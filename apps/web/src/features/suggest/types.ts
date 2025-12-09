export interface SuggestPlaceFormData {
  name: string;
  phone: string;
  priceMin: number;
  priceMax: number;
  openTime: string;
  closeTime: string;
  city: string;
  ward: string;
  streetAddress: string;
  features: string[];
  photos: PhotoUploadItem[];
  review: string;
  selectedLocationId?: string;
}

export interface LocationSuggestion {
  id: string;
  name: string;
  address: string;
  status: string;
  source: "location_address" | "restaurant";
  price_min?: number | null;
  price_max?: number | null;
  phone?: string | null;
  opening_hours?: Record<string, string> | null;
  features?: string[] | null;
}

export type PhotoType = "food" | "view" | "menu" | "review";

export interface PhotoUploadItem {
  id: string;
  file: File;
  preview: string;
  type: PhotoType;
  menuName?: string;
}

export const PHOTO_TYPES: { id: PhotoType; label: string }[] = [
  { id: "food", label: "Món ăn" },
  { id: "view", label: "Không gian" },
  { id: "menu", label: "Menu" },
  { id: "review", label: "Nhận xét" },
];

export interface Province {
  code: string;
  name: string;
}

export interface Ward {
  code: string;
  name: string;
  provinceCode: string;
}

export const FEATURES = [
  { id: "wifi", label: "Có wifi" },
  { id: "delivery", label: "Có giao hàng" },
  { id: "air_conditioning", label: "Có máy lạnh & điều hòa" },
  { id: "takeaway", label: "Cho mua về" },
  { id: "card_payment", label: "Trả bằng thẻ" },
  { id: "car_parking", label: "Có chỗ đậu ôtô" },
  { id: "reservation", label: "Nên đặt trước" },
  { id: "outdoor_seating", label: "Có bàn ngoài trời" },
  { id: "private_room", label: "Có phòng riêng" },
  { id: "kids_play_area", label: "Có chỗ chơi cho trẻ em" },
  { id: "free_motorbike_parking", label: "Giữ xe máy miễn phí" },
  { id: "tipping", label: "Tip cho nhân viên" },
  { id: "smoking_area", label: "Có khu vực hút thuốc" },
  { id: "membership_card", label: "Có thẻ thành viên" },
  { id: "vat_invoice", label: "Có xuất hóa đơn đỏ" },
  { id: "heater", label: "Có lò sưởi" },
  { id: "wheelchair_accessible", label: "Có hỗ trợ người khuyết tật" },
  { id: "football_streaming", label: "Có chiếu bóng đá" },
] as const;
