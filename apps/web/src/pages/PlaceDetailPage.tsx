import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import axios from "axios";
import { Rating } from "@mapvibe/ui-components";
import { Restaurant } from "@mapvibe/types";
import { MapPin, Phone, Clock, DollarSign, ArrowLeft, Star } from "lucide-react";

export function PlaceDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRestaurant = async () => {
      try {
        setLoading(true);
        const response = await axios.get(`/api/place/${slug}`);
        setRestaurant(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    };

    if (slug) {
      fetchRestaurant();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !restaurant) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4">
        <p className="text-lg text-gray-600">{error || "Restaurant not found"}</p>
        <Link
          to="/"
          className="text-primary hover:underline"
        >
          ← Quay về trang chủ
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Back button */}
      <Link
        to="/"
        className="hover:text-primary mb-6 inline-flex items-center gap-2 text-gray-600"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">{restaurant.name}</h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <Rating
              value={restaurant.rating}
              readOnly
              size="sm"
            />
            <span className="text-sm text-gray-600">({restaurant.rating})</span>
          </div>
        </div>
      </div>

      {/* Image gallery */}
      {restaurant.images && (
        <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          {restaurant.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`${restaurant.name} - ${idx + 1}`}
              className="h-48 w-full rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {/* Info cards */}
      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Details */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Thông tin</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-gray-600">
              <MapPin className="text-primary h-5 w-5" />
              <span>{restaurant.address}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Phone className="text-primary h-5 w-5" />
              <span>{restaurant.phone}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <Clock className="text-primary h-5 w-5" />
              <span>{restaurant.hours}</span>
            </div>
            <div className="flex items-center gap-3 text-gray-600">
              <DollarSign className="text-primary h-5 w-5" />
              <span>{restaurant.priceRange}</span>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Mô tả</h2>
          <p className="text-gray-600">{restaurant.description}</p>
        </div>
      </div>

      {/* Reviews */}
      {restaurant.reviews && restaurant.reviews.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Đánh giá</h2>
          <div className="space-y-4">
            {restaurant.reviews.map((review) => (
              <div
                key={review.id}
                className="border-b border-gray-100 pb-4 last:border-0"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-medium">{review.author}</span>
                  <div className="flex items-center gap-1">
                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-sm">{review.rating}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600">{review.text}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {new Date(review.date).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
