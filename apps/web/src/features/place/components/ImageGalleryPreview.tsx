import { useMediaQuery } from "react-responsive";

interface ImageGalleryPreviewProps {
  images?: string[];
  restaurantName?: string;
  onViewMore?: () => void;
}

export function ImageGalleryPreview({ images, restaurantName, onViewMore }: ImageGalleryPreviewProps) {
  const isDesktop = useMediaQuery({ minWidth: 1024 });
  const transformClass = "transition-transform duration-300 hover:scale-110";
  if (!images?.length) return null;

  // Mobile: 1 ảnh
  if (!isDesktop) {
    return (
      <div className="h-48 overflow-hidden rounded-lg">
        <img
          src={images[0]}
          alt={restaurantName}
          className={`${transformClass} h-full w-full object-cover`}
        />
      </div>
    );
  }

  // Desktop: 3 cột
  return (
    <div className="grid h-80 grid-cols-7 grid-rows-2 gap-2">
      {/* Cột 1: Ảnh lớn - chiếm 2 cột, 2 hàng */}
      <div className="col-span-5 row-span-2 overflow-hidden rounded-lg">
        <img
          src={images[0]}
          alt={restaurantName}
          className={`${transformClass} object-cover" h-full w-full`}
        />
      </div>

      {/* Cột 2: Ảnh 2 (trên) */}
      <div className="overflow-hidden rounded-lg">
        <img
          src={images[1]}
          alt=""
          className={`${transformClass} h-full w-full object-cover`}
        />
      </div>

      {/* Cột 3: Ảnh 4 + Xem thêm - chiếm 2 hàng */}
      <div className="relative row-span-2 overflow-hidden rounded-lg">
        <img
          src={images[3]}
          alt=""
          className={`${transformClass} h-full w-full object-cover blur-sm`}
        />
        <button
          onClick={onViewMore}
          className="absolute inset-0 flex items-center justify-center bg-black/40 text-sm font-medium text-white transition-colors hover:bg-black/50"
        >
          Xem thêm
        </button>
      </div>

      {/* Cột 2: Ảnh 3 (dưới) */}
      <div className="overflow-hidden rounded-lg">
        <img
          src={images[2]}
          alt=""
          className={`${transformClass} object-cover" h-full w-full`}
        />
      </div>
    </div>
  );
}
