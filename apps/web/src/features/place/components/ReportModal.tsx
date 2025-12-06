import { useState } from "react";
import { X } from "lucide-react";

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (reason: string, details?: string) => void;
  authorName: string;
  loading?: boolean;
}

const REPORT_REASONS = [
  { id: "spam", label: "Spam hoặc quảng cáo" },
  { id: "inappropriate", label: "Nội dung không phù hợp" },
  { id: "harassment", label: "Quấy rối hoặc bắt nạt" },
  { id: "misinformation", label: "Thông tin sai lệch" },
  { id: "other", label: "Lý do khác" },
];

export function ReportModal({
  isOpen,
  onClose,
  onSubmit,
  authorName: _authorName,
  loading,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [details, setDetails] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setSelectedReason("");
      setDetails("");
    }, 300);
  };

  const handleSubmit = () => {
    if (!selectedReason) return;
    onSubmit(selectedReason, details || undefined);
    handleClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        <h2 className="mb-6 text-center text-xl font-bold">Báo cáo bình luận</h2>

        <div className="mb-4 space-y-2">
          <p className="text-sm font-medium text-gray-700">Chọn lý do báo cáo:</p>
          {REPORT_REASONS.map((reason) => (
            <label
              key={reason.id}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition ${
                selectedReason === reason.id
                  ? "border-primary-500 bg-primary-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <input
                type="radio"
                name="report-reason"
                value={reason.id}
                checked={selectedReason === reason.id}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="h-4 w-4 accent-primary-500"
              />
              <span className="text-sm text-gray-700">{reason.label}</span>
            </label>
          ))}
        </div>

        {selectedReason && (
          <div className="mb-4">
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Chi tiết (không bắt buộc)
            </label>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Mô tả thêm về vấn đề..."
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Hủy
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedReason || loading}
            className="flex-1 rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Đang gửi..." : "Gửi báo cáo"}
          </button>
        </div>
      </div>
    </>
  );
}
