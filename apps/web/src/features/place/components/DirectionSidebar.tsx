import { Copy, Share2, MapPin } from "lucide-react";
import { useState } from "react";

interface DirectionSidebarProps {
  address: string;
}

export function DirectionSidebar({ address }: DirectionSidebarProps) {
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

  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;

  return (
    <div className="sticky top-4 rounded-lg bg-white p-6 shadow-sm">
      <h3 className="mb-4 font-semibold text-gray-900">Map</h3>

      {/* Map placeholder - Click to open Google Maps */}
      <a
        href={googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-4 flex h-48 w-full items-center justify-center rounded-lg bg-gradient-to-br from-primary-50 to-primary-100 transition hover:from-primary-100 hover:to-primary-200"
      >
        <div className="text-center">
          <MapPin className="mx-auto h-10 w-10 text-primary-500" />
          <p className="mt-2 text-sm font-medium text-primary-600">Xem trên Google Maps</p>
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
