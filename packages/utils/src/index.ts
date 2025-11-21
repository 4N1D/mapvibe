// Shared utility functions for MapVibe

/**
 * Calculate distance between two points using Haversine formula
 * @param lat1 - Latitude of point 1
 * @param lng1 - Longitude of point 1
 * @param lat2 - Latitude of point 2
 * @param lng2 - Longitude of point 2
 * @returns Distance in kilometers
 */
export function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format Vietnamese currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
}

/**
 * Normalize Vietnamese text for fuzzy matching
 * Removes diacritics and converts to lowercase
 */
export function normalizeVietnamese(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d")
    .replace(/\s+/g, "");
}

/**
 * Validate rating value (1-10 scale)
 */
export function isValidRating(rating: number): boolean {
  return rating >= 1 && rating <= 10 && Number.isInteger(rating);
}

/**
 * Calculate average rating from 5 aspects
 */
export function calculateAverageRating(ratings: {
  service: number;
  location: number;
  price: number;
  quality: number;
  ambiance: number;
}): number {
  const sum =
    ratings.service + ratings.location + ratings.price + ratings.quality + ratings.ambiance;
  return Math.round((sum / 5) * 10) / 10; // Round to 1 decimal
}
