import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../lib/api";
import { Breadcrumbs } from "../components/ui";
import { useConfirm } from "../hooks/useConfirm";
import toast from "react-hot-toast";

type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";
type TargetType = "comment" | "review" | "review_post" | "user" | "photo";
type ReportReason = "spam" | "inappropriate" | "harassment" | "misinformation" | "other";

const STATUS_LABELS: Record<ReportStatus, string> = {
  pending: "Chờ xử lý",
  reviewing: "Đang xem xét",
  resolved: "Đã xử lý",
  dismissed: "Bỏ qua",
};

const STATUS_COLORS: Record<ReportStatus, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  reviewing: "bg-blue-100 text-blue-800",
  resolved: "bg-green-100 text-green-800",
  dismissed: "bg-gray-100 text-gray-800",
};

const TARGET_LABELS: Record<TargetType, string> = {
  comment: "Bình luận",
  review: "Nhận xét địa điểm",
  review_post: "Bài viết review",
  user: "Người dùng",
  photo: "Ảnh",
};

const TARGET_COLORS: Record<TargetType, string> = {
  comment: "bg-blue-100 text-blue-700",
  review: "bg-purple-100 text-purple-700",
  review_post: "bg-orange-100 text-orange-700",
  user: "bg-gray-100 text-gray-700",
  photo: "bg-green-100 text-green-700",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  comment: "Bình luận",
  review_post: "Bài viết review",
  restaurant_review: "Nhận xét địa điểm",
};

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam/Quảng cáo",
  inappropriate: "Không phù hợp",
  harassment: "Quấy rối",
  misinformation: "Thông tin sai",
  other: "Khác",
};

export default function ReportsPage() {
  const [statusFilter, setStatusFilter] = useState<ReportStatus | "">("pending");
  const [typeFilter, setTypeFilter] = useState<TargetType | "">("");
  const [selectedReport, setSelectedReport] = useState<any>(null);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["admin-reports", statusFilter, typeFilter],
    queryFn: () =>
      adminApi.getReports({
        status: statusFilter || undefined,
        target_type: typeFilter || undefined,
        limit: 50,
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => adminApi.updateReport(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-reports"] });
      toast.success("Đã cập nhật báo cáo");
      setSelectedReport(null);
    },
    onError: () => {
      toast.error("Lỗi khi cập nhật báo cáo");
    },
  });

  const handleDismiss = async (report: any) => {
    const confirmed = await confirm({
      title: "Bỏ qua báo cáo",
      message: "Bạn có chắc muốn bỏ qua báo cáo này? Nội dung sẽ không bị ảnh hưởng.",
      confirmText: "Bỏ qua",
      variant: "warning",
    });
    if (confirmed) {
      updateMutation.mutate({ id: report.id, data: { status: "dismissed" } });
    }
  };

  const handleResolve = async (report: any, action: string) => {
    const actionLabels: Record<string, string> = {
      hide_content: "ẩn nội dung",
      delete_content: "xóa nội dung",
      ban_user: "cấm người dùng",
    };

    const confirmed = await confirm({
      title: "Xử lý báo cáo",
      message: `Bạn có chắc muốn ${actionLabels[action] || "xử lý"}? Hành động này không thể hoàn tác.`,
      confirmText: "Xử lý",
      variant: "danger",
    });

    if (confirmed) {
      updateMutation.mutate({
        id: report.id,
        data: { status: "resolved", action },
      });
    }
  };

  const reports = data?.data?.reports || [];
  const counts = data?.data?.counts || { pending: 0, reviewing: 0, resolved: 0, dismissed: 0 };

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      <Breadcrumbs items={[{ label: "Tổng quan", href: "/" }, { label: "Báo cáo" }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Báo cáo vi phạm</h1>
          <p className="mt-1 text-sm text-gray-500">Quản lý các báo cáo từ người dùng</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatsCard
          label="Chờ xử lý"
          value={counts.pending}
          color="yellow"
          active={statusFilter === "pending"}
          onClick={() => setStatusFilter("pending")}
        />
        <StatsCard
          label="Đang xem xét"
          value={counts.reviewing}
          color="blue"
          active={statusFilter === "reviewing"}
          onClick={() => setStatusFilter("reviewing")}
        />
        <StatsCard
          label="Đã xử lý"
          value={counts.resolved}
          color="green"
          active={statusFilter === "resolved"}
          onClick={() => setStatusFilter("resolved")}
        />
        <StatsCard
          label="Đã bỏ qua"
          value={counts.dismissed}
          color="gray"
          active={statusFilter === "dismissed"}
          onClick={() => setStatusFilter("dismissed")}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as ReportStatus | "")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả trạng thái</option>
          {Object.entries(STATUS_LABELS).map(([key, label]) => (
            <option
              key={key}
              value={key}
            >
              {label}
            </option>
          ))}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TargetType | "")}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500"
        >
          <option value="">Tất cả loại</option>
          {Object.entries(TARGET_LABELS).map(([key, label]) => (
            <option
              key={key}
              value={key}
            >
              {label}
            </option>
          ))}
        </select>

        {(statusFilter || typeFilter) && (
          <button
            onClick={() => {
              setStatusFilter("");
              setTypeFilter("");
            }}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Xóa bộ lọc
          </button>
        )}
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-white p-6 shadow"
            >
              <div className="mb-4 h-4 w-1/4 rounded bg-gray-200"></div>
              <div className="h-3 w-3/4 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-lg bg-white p-12 text-center shadow">
          <svg
            className="mx-auto mb-4 h-12 w-12 text-gray-300"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <p className="text-gray-500">Không có báo cáo nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report: any) => (
            <ReportCard
              key={report.id}
              report={report}
              onDismiss={() => handleDismiss(report)}
              onResolve={(action) => handleResolve(report, action)}
              onView={() => setSelectedReport(report)}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <ReportDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onDismiss={() => handleDismiss(selectedReport)}
          onResolve={(action) => handleResolve(selectedReport, action)}
          isUpdating={updateMutation.isPending}
        />
      )}
    </div>
  );
}

function StatsCard({
  label,
  value,
  color,
  active,
  onClick,
}: {
  label: string;
  value: number;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const colorClasses: Record<string, string> = {
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    blue: "bg-blue-50 border-blue-200 text-blue-700",
    green: "bg-green-50 border-green-200 text-green-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };

  return (
    <button
      onClick={onClick}
      className={`rounded-lg border-2 p-4 text-left transition-all ${
        active
          ? colorClasses[color] + " ring- ring-2 ring-offset-2" + color + "-500"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
    >
      <p className={`text-2xl font-bold ${active ? "" : "text-gray-900"}`}>{value}</p>
      <p className={`text-sm ${active ? "" : "text-gray-500"}`}>{label}</p>
    </button>
  );
}

function ReportCard({
  report,
  onDismiss,
  onResolve,
  onView,
  isUpdating,
}: {
  report: any;
  onDismiss: () => void;
  onResolve: (action: string) => void;
  onView: () => void;
  isUpdating: boolean;
}) {
  const targetContent = report.target_content;

  return (
    <div className="rounded-lg bg-white shadow transition-shadow hover:shadow-md">
      <div className="p-6">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_COLORS[report.status as ReportStatus]}`}
            >
              {STATUS_LABELS[report.status as ReportStatus]}
            </span>
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${TARGET_COLORS[report.target_type as TargetType] || "bg-gray-100 text-gray-700"}`}>
              {TARGET_LABELS[report.target_type as TargetType] || report.target_type}
            </span>
            <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700">
              {REASON_LABELS[report.reason as ReportReason]}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {new Date(report.created_at).toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>

        {/* Reporter Info */}
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-600">
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
          <span>
            Báo cáo bởi: <strong>{report.reporter_name || "Ẩn danh"}</strong>
          </span>
        </div>

        {/* Target Content Preview */}
        {targetContent ? (
          <div className="mb-4 rounded-lg bg-gray-50 p-4">
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <span>Nội dung bị báo cáo:</span>
              <span className="font-medium text-gray-700">
                {targetContent.author_name || "Ẩn danh"}
              </span>
              {targetContent.type && (
                <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                  {CONTENT_TYPE_LABELS[targetContent.type] || targetContent.type}
                </span>
              )}
              {targetContent.rating_overall && (
                <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                  ⭐ {targetContent.rating_overall}
                </span>
              )}
            </div>
            <p className="line-clamp-2 text-gray-700">{targetContent.text}</p>
          </div>
        ) : (
          <div className="mb-4 rounded-lg bg-yellow-50 p-4">
            <p className="text-sm text-yellow-700">
              Không thể tải nội dung bị báo cáo. Nội dung có thể đã bị xóa hoặc ID không hợp lệ.
            </p>
            <p className="mt-1 text-xs text-yellow-600">
              Target ID: {report.target_id} | Type: {report.target_type}
            </p>
          </div>
        )}

        {/* Details */}
        {report.details && (
          <div className="mb-4">
            <p className="mb-1 text-sm text-gray-500">Chi tiết báo cáo:</p>
            <p className="text-gray-700">{report.details}</p>
          </div>
        )}

        {/* Actions */}
        {report.status === "pending" && (
          <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
            <button
              onClick={onView}
              className="rounded-lg bg-gray-100 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-200"
            >
              Xem chi tiết
            </button>
            <button
              onClick={onDismiss}
              disabled={isUpdating}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Bỏ qua
            </button>
            <button
              onClick={() => onResolve("hide_content")}
              disabled={isUpdating}
              className="rounded-lg bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
            >
              Ẩn nội dung
            </button>
            <button
              onClick={() => onResolve("delete_content")}
              disabled={isUpdating}
              className="rounded-lg bg-red-100 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-200 disabled:opacity-50"
            >
              Xóa nội dung
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportDetailModal({
  report,
  onClose,
  onDismiss,
  onResolve,
  isUpdating,
}: {
  report: any;
  onClose: () => void;
  onDismiss: () => void;
  onResolve: (action: string) => void;
  isUpdating: boolean;
}) {
  const targetContent = report.target_content;

  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/50"
        onClick={onClose}
      />
      <div className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Chi tiết báo cáo</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-gray-100"
          >
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Status & Type */}
          <div className="flex flex-wrap gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${STATUS_COLORS[report.status as ReportStatus]}`}
            >
              {STATUS_LABELS[report.status as ReportStatus]}
            </span>
            <span className={`rounded-full px-3 py-1 text-sm font-medium ${TARGET_COLORS[report.target_type as TargetType] || "bg-gray-100 text-gray-700"}`}>
              {TARGET_LABELS[report.target_type as TargetType] || report.target_type}
            </span>
            <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-700">
              {REASON_LABELS[report.reason as ReportReason]}
            </span>
          </div>

          {/* Reporter */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">Người báo cáo</h3>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 font-medium text-white">
                {report.reporter_name?.[0]?.toUpperCase() || "?"}
              </div>
              <div>
                <p className="font-medium text-gray-900">{report.reporter_name || "Ẩn danh"}</p>
                <p className="text-sm text-gray-500">{report.reporter_email}</p>
              </div>
            </div>
          </div>

          {/* Target Content */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">Nội dung bị báo cáo</h3>
            {targetContent ? (
              <div className="rounded-lg bg-gray-50 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm text-gray-500">Tác giả:</span>
                  <span className="font-medium text-gray-700">
                    {targetContent.author_name || "Ẩn danh"}
                  </span>
                  {targetContent.type && (
                    <span className="rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">
                      {CONTENT_TYPE_LABELS[targetContent.type] || targetContent.type}
                    </span>
                  )}
                  {targetContent.rating_overall && (
                    <span className="rounded bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                      ⭐ {Number(targetContent.rating_overall).toFixed(1)}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-gray-800">{targetContent.text}</p>
                <p className="mt-2 text-xs text-gray-400">
                  {new Date(targetContent.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ) : (
              <div className="rounded-lg bg-yellow-50 p-4">
                <p className="text-sm text-yellow-700">
                  Không thể tải nội dung bị báo cáo. Nội dung có thể đã bị xóa hoặc ID không hợp lệ.
                </p>
                <p className="mt-1 text-xs text-yellow-600">
                  Target ID: {report.target_id} | Type: {report.target_type}
                </p>
              </div>
            )}
          </div>

          {/* Details */}
          {report.details && (
            <div>
              <h3 className="mb-2 text-sm font-medium text-gray-500">Chi tiết báo cáo</h3>
              <p className="rounded-lg bg-gray-50 p-4 text-gray-700">{report.details}</p>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="mb-2 text-sm font-medium text-gray-500">Thời gian</h3>
            <div className="space-y-2 text-sm">
              <p className="text-gray-600">
                <span className="text-gray-500">Tạo lúc:</span>{" "}
                {new Date(report.created_at).toLocaleString("vi-VN")}
              </p>
              {report.reviewed_at && (
                <p className="text-gray-600">
                  <span className="text-gray-500">Xử lý lúc:</span>{" "}
                  {new Date(report.reviewed_at).toLocaleString("vi-VN")}
                  {report.reviewed_by_name && ` bởi ${report.reviewed_by_name}`}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        {report.status === "pending" && (
          <div className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">
            <button
              onClick={onDismiss}
              disabled={isUpdating}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Bỏ qua
            </button>
            <button
              onClick={() => onResolve("hide_content")}
              disabled={isUpdating}
              className="rounded-lg bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700 hover:bg-yellow-200 disabled:opacity-50"
            >
              Ẩn nội dung
            </button>
            <button
              onClick={() => onResolve("delete_content")}
              disabled={isUpdating}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Xóa nội dung
            </button>
          </div>
        )}
      </div>
    </>
  );
}
