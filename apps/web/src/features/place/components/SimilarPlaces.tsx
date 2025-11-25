import { MapPin, ChevronRight, ChevronLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef } from "react";

interface Place {
  slug: string;
  name: string;
  address: string;
  rating: number;
  image?: string;
  priceRange: string;
  hours?: string;
}

interface SimilarPlacesProps {
  places: Place[];
}

export function SimilarPlaces({ places }: SimilarPlacesProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300; // Adjust scroll amount as needed
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  return (
    <div className="mb-8">
      <div className="mb-6 flex items-center justify-between">
        <h3 className="text-2xl font-bold text-gray-900">Khám phá những địa điểm tương tự</h3>
        <div className="flex gap-2">
          <button
            onClick={() => scroll("left")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:bg-gray-50 hover:shadow-md"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5 text-gray-600" />
          </button>
          <button
            onClick={() => scroll("right")}
            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white shadow-sm transition hover:bg-gray-50 hover:shadow-md"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5 text-gray-600" />
          </button>
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="scrollbar-hidden -mx-4 flex gap-6 overflow-x-auto px-4 pb-4 sm:mx-0 sm:px-0"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {places.map((place) => (
          <Link
            key={place.slug}
            to={`/place/${place.slug}`}
            className="group block w-[280px] min-w-[280px] flex-none overflow-hidden rounded-xl border border-gray-100 bg-white shadow-sm transition-all hover:shadow-md sm:w-[320px]"
            style={{ scrollSnapAlign: "start" }}
          >
            {/* Image */}
            <div className="relative aspect-[4/3] overflow-hidden bg-gray-100">
              {place.image ? (
                <img
                  src={place.image}
                  alt={place.name}
                  className="h-full w-full object-cover transition duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-gray-400">
                  <MapPin className="h-12 w-12" />
                </div>
              )}
            </div>

            {/* Content */}
            <div className="p-4">
              <h4 className="mb-2 text-lg font-bold text-gray-900 group-hover:text-[#085B96]">
                {place.name}
              </h4>
              <p className="mb-3 line-clamp-2 text-sm text-gray-500">{place.address}</p>

              <div className="space-y-1">
                <p className="text-sm font-medium text-green-600">{place.priceRange}</p>
                {place.hours && <p className="text-sm font-medium text-red-500">{place.hours}</p>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
