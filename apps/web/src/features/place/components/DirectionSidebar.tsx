import { Copy, Share2 } from "lucide-react";
import { useState } from "react";

interface DirectionSidebarProps {
  address: string;
  lat?: number;
  lng?: number;
}

export function DirectionSidebar({ address, lat, lng }: DirectionSidebarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Địa chỉ nhà hàng",
        text: address,
      });
    }
  };

  const mapUrl =
    lat && lng
      ? `https://www.google.com/maps?q=${lat},${lng}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="sticky top-4 rounded-lg bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">Direction</h3>

      {/* Map placeholder hoặc embedded map */}
      <a
        href={mapUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-4 block overflow-hidden rounded-lg bg-gray-200 hover:opacity-90"
      >
        <div className="flex h-48 items-center justify-center text-gray-400">
          <div className="text-center">
            <svg
              className="mx-auto mb-2 h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0    
   13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
              />
            </svg>
            <span className="text-sm">Click để mở Google Maps</span>
          </div>
        </div>
      </a>

      {/* Address */}
      <p className="mb-4 text-sm text-gray-600">{address}</p>

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleCopy}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Copy className="mx-auto h-4 w-4" />
          <span className="mt-1 block text-xs">{copied ? "Đã copy" : "Copy"}</span>
        </button>
        <button
          onClick={handleShare}
          className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
        >
          <Share2 className="mx-auto h-4 w-4" />
          <span className="mt-1 block text-xs">Share</span>
        </button>
      </div>
    </div>
  );
}
