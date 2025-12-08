import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../lib/api";
import { Breadcrumbs } from "../components/ui";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  login: "Đăng nhập",
  logout: "Đăng xuất",
  register: "Đăng ký",
  view_place: "Xem địa điểm",
  view_review: "Xem bài viết",
  view_profile: "Xem hồ sơ",
  search: "Tìm kiếm",
  search_nearby: "Tìm gần đây",
  create_review: "Tạo bài viết",
  edit_review: "Sửa bài viết",
  delete_review: "Xóa bài viết",
  create_comment: "Bình luận",
  edit_comment: "Sửa bình luận",
  delete_comment: "Xóa bình luận",
  like: "Thích",
  unlike: "Bỏ thích",
  report: "Báo cáo",
  share: "Chia sẻ",
  upload_photo: "Tải ảnh",
  delete_photo: "Xóa ảnh",
  follow: "Theo dõi",
  unfollow: "Bỏ theo dõi",
  update_profile: "Cập nhật hồ sơ",
  update_avatar: "Đổi avatar",
  page_view: "Xem trang",
  other: "Khác",
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [activityFilter, setActivityFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ["admin-activity-stats", days],
    queryFn: () => adminApi.getActivityStats({ days }),
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ["admin-activities", activityFilter, userFilter],
    queryFn: () =>
      adminApi.getActivities({
        activity_type: activityFilter || undefined,
        user_id: userFilter || undefined,
        limit: 50,
      }),
  });

  const stats = statsData?.data || {};
  const activities = activitiesData?.data?.activities || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Tổng quan", href: "/" }, { label: "Phân tích" }]} />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích hoạt động</h1>
          <p className="mt-1 text-sm text-gray-500">Theo dõi hoạt động người dùng trên hệ thống</p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm"
        >
          <option value={7}>7 ngày qua</option>
          <option value={14}>14 ngày qua</option>
          <option value={30}>30 ngày qua</option>
        </select>
      </div>

      {/* Summary Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="animate-pulse rounded-lg bg-white p-6 shadow"
            >
              <div className="mb-2 h-8 w-1/2 rounded bg-gray-200"></div>
              <div className="h-4 w-1/3 rounded bg-gray-200"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <StatsCard
            title="Hoạt động hôm nay"
            value={stats.summary?.total_activities_today || 0}
            icon={<ActivityIcon />}
            color="blue"
          />
          <StatsCard
            title="Người dùng hoạt động"
            value={stats.summary?.unique_users_today || 0}
            icon={<UsersIcon />}
            color="green"
          />
          <StatsCard
            title="Phiên truy cập"
            value={stats.summary?.sessions_today || 0}
            icon={<SessionIcon />}
            color="purple"
          />
        </div>
      )}

      {/* Online Users */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Đang online ({stats.online_users?.length || 0})
        </h2>
        {stats.online_users?.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {stats.online_users.map((user: any) => (
              <div
                key={user.user_id}
                className="flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-2"
              >
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500"></div>
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt=""
                    className="h-6 w-6 rounded-full"
                  />
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-300 text-xs">
                    {user.display_name?.[0]?.toUpperCase() || "?"}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">
                  {user.display_name || "Ẩn danh"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Không có ai online</p>
        )}
      </div>

      {/* Activity by Type */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Hoạt động theo loại</h2>
          {stats.by_type?.length > 0 ? (
            <div className="space-y-3">
              {stats.by_type.slice(0, 10).map((item: any) => (
                <div
                  key={item.activity_type}
                  className="flex items-center gap-3"
                >
                  <div className="flex-1">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {ACTIVITY_TYPE_LABELS[item.activity_type] || item.activity_type}
                      </span>
                      <span className="text-sm text-gray-500">{item.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                      <div
                        className="h-full rounded-full bg-primary-500"
                        style={{
                          width: `${Math.min((item.count / (stats.by_type[0]?.count || 1)) * 100, 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Top Users */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Top người dùng hoạt động</h2>
          {stats.top_users?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_users.map((user: any, index: number) => (
                <div
                  key={user.user_id}
                  className="flex items-center gap-3"
                >
                  <span
                    className={`flex h-6 w-6 items-center justify-center rounded-full text-sm font-bold ${
                      index === 0
                        ? "bg-yellow-100 text-yellow-700"
                        : index === 1
                          ? "bg-gray-200 text-gray-700"
                          : index === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {index + 1}
                  </span>
                  {user.avatar ? (
                    <img
                      src={user.avatar}
                      alt=""
                      className="h-8 w-8 rounded-full"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-medium text-white">
                      {user.display_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-gray-900">
                      {user.display_name || "Ẩn danh"}
                    </p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user.activity_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">Chưa có dữ liệu</p>
          )}
        </div>
      </div>

      {/* Activity by Day Chart */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h2 className="mb-4 text-lg font-semibold text-gray-900">Hoạt động theo ngày</h2>
        {stats.by_day?.length > 0 ? (
          <div className="space-y-2">
            {stats.by_day
              .slice(0, 7)
              .reverse()
              .map((day: any) => (
                <div
                  key={day.date}
                  className="flex items-center gap-4"
                >
                  <span className="w-24 text-sm text-gray-600">
                    {new Date(day.date).toLocaleDateString("vi-VN", {
                      weekday: "short",
                      day: "2-digit",
                      month: "2-digit",
                    })}
                  </span>
                  <div className="flex h-6 flex-1 items-center overflow-hidden rounded bg-gray-100">
                    <div
                      className="h-full rounded bg-primary-500"
                      style={{
                        width: `${Math.min((day.total_activities / Math.max(...stats.by_day.map((d: any) => d.total_activities))) * 100, 100)}%`,
                      }}
                    />
                    <span className="ml-2 text-sm text-gray-600">{day.total_activities}</span>
                  </div>
                  <span className="text-sm text-gray-500">{day.unique_users} users</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-sm text-gray-500">Chưa có dữ liệu</p>
        )}
      </div>

      {/* Recent Activities */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h2>
          <div className="flex gap-2">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            >
              <option value="">Tất cả loại</option>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                <option
                  key={key}
                  value={key}
                >
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {activitiesLoading ? (
          <div className="space-y-4 p-6">
            {[...Array(5)].map((_, i) => (
              <div
                key={i}
                className="flex animate-pulse items-center gap-4"
              >
                <div className="h-10 w-10 rounded-full bg-gray-200"></div>
                <div className="flex-1">
                  <div className="mb-2 h-4 w-1/3 rounded bg-gray-200"></div>
                  <div className="h-3 w-1/2 rounded bg-gray-200"></div>
                </div>
              </div>
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-500">Chưa có hoạt động nào</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {activities.map((activity: any) => (
              <div
                key={activity.id}
                className="px-6 py-4 hover:bg-gray-50"
              >
                <div className="flex items-center gap-4">
                  {activity.user_avatar ? (
                    <img
                      src={activity.user_avatar}
                      alt=""
                      className="h-10 w-10 rounded-full"
                    />
                  ) : (
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary-400 to-primary-600 font-medium text-white">
                      {activity.user_name?.[0]?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {activity.user_name || "Ẩn danh"}
                      </span>
                      {activity.user_email && (
                        <>
                          <span className="text-gray-400">•</span>
                          <span className="text-sm text-gray-500">{activity.user_email}</span>
                        </>
                      )}
                      <span className="text-gray-400">•</span>
                      <span className="text-sm text-gray-600">
                        {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
                      </span>
                    </div>
                    {activity.page_url && (
                      <p className="truncate text-sm text-gray-500">{activity.page_url}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(activity.created_at).toLocaleTimeString("vi-VN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatsCard({
  title,
  value,
  icon,
  color,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <div className="flex items-center gap-4">
        <div
          className={`h-12 w-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}
        >
          {icon}
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-sm text-gray-500">{title}</p>
        </div>
      </div>
    </div>
  );
}

function ActivityIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 10V3L4 14h7v7l9-11h-7z"
      />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
      />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg
      className="h-6 w-6"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
      />
    </svg>
  );
}
