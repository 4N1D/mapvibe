/**
 * Format a number to Vietnamese currency string (e.g. 100.000đ)
 */
export function formatCurrency(amount: number): string {
  return amount.toLocaleString("vi-VN") + "đ";
}

/**
 * Format price range (e.g. 100.000đ - 200.000đ)
 */
export function formatPriceRange(min?: number | null, max?: number | null): string {
  if (!min && !max) return "Chưa có thông tin";
  
  if (min && max) {
    return `${min.toLocaleString("vi-VN")}đ - ${max.toLocaleString("vi-VN")}đ`;
  }
  
  if (min) return `Từ ${min.toLocaleString("vi-VN")}đ`;
  if (max) return `Đến ${max.toLocaleString("vi-VN")}đ`;
  
  return "Chưa có thông tin";
}

/**
 * Format opening hours to show today's hours
 */
export function formatOpeningHours(openingHours?: string | Record<string, string> | null): string {
  if (!openingHours) return "Chưa có thông tin";
  
  try {
    const hours = typeof openingHours === "string" ? JSON.parse(openingHours) : openingHours;
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const today = days[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1];
    return hours[today] || "Đang cập nhật";
  } catch {
    return typeof openingHours === "string" ? openingHours : "Đang cập nhật";
  }
}
