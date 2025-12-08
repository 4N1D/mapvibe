import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { adminApi } from "../lib/api";
import { SkeletonStats } from "../components/ui";

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-stats"],
    queryFn: () => adminApi.getStats(),
  });

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
        Lỗi khi tải thống kê. Vui lòng thử lại.
      </div>
    );
  }

  const stats = data?.data?.stats || {};
  const activity = data?.data?.recent_activity || {};

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tổng quan</h1>
          <p className="mt-1 text-sm text-gray-500">Thống kê tổng quan hệ thống MapVibe</p>
        </div>
        <div className="flex gap-3">
          <Link
            to="/locations/pending"
            className="inline-flex items-center rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-700"
          >
            <svg
              className="mr-2 h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
              />
            </svg>
            Duyệt bài
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Người dùng"
            value={stats.total_users || 0}
            subtitle={`+${activity.new_users_7d || 0} tuần này`}
            icon={<UsersIcon />}
            color="blue"
            href="/users"
          />
          <StatCard
            title="Địa điểm"
            value={stats.total_places || 0}
            icon={<PlacesIcon />}
            color="green"
            href="/places"
          />
          <StatCard
            title="Bài viết"
            value={stats.total_reviews || 0}
            subtitle={`+${activity.new_reviews_7d || 0} tuần này`}
            icon={<ReviewsIcon />}
            color="purple"
            href="/reviews"
          />
          <StatCard
            title="Chờ duyệt"
            value={stats.pending_locations || 0}
            subtitle="Cần xem xét"
            icon={<PendingIcon />}
            color="orange"
            href="/locations/pending"
            highlight={stats.pending_locations > 0}
          />
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-lg bg-white p-6 shadow lg:col-span-2">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Hoạt động 7 ngày qua</h2>
          <div className="grid grid-cols-3 gap-4">
            <ActivityCard
              value={activity.new_users_7d || 0}
              label="Người dùng mới"
              color="blue"
              trend={activity.new_users_7d > 0 ? "up" : "neutral"}
            />
            <ActivityCard
              value={activity.new_reviews_7d || 0}
              label="Bài viết mới"
              color="purple"
              trend={activity.new_reviews_7d > 0 ? "up" : "neutral"}
            />
            <ActivityCard
              value={activity.new_photos_7d || 0}
              label="Ảnh mới"
              color="green"
              trend={activity.new_photos_7d > 0 ? "up" : "neutral"}
            />
          </div>
        </div>

        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">Thao tác nhanh</h2>
          <div className="space-y-3">
            <QuickAction
              href="/locations/pending"
              icon={<CheckIcon />}
              label="Duyệt địa điểm chờ"
              count={stats.pending_locations}
            />
            <QuickAction
              href="/reviews?status=reported"
              icon={<FlagIcon />}
              label="Xem bài viết bị báo cáo"
            />
            <QuickAction
              href="/places"
              icon={<SearchIcon />}
              label="Tìm kiếm địa điểm"
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  href,
  highlight,
}: {
  title: string;
  value: number;
  subtitle?: string;
  icon: React.ReactNode;
  color: "blue" | "green" | "purple" | "orange";
  href?: string;
  highlight?: boolean;
}) {
  const colorClasses = {
    blue: "bg-blue-500 text-blue-600 bg-blue-50",
    green: "bg-green-500 text-green-600 bg-green-50",
    purple: "bg-purple-500 text-purple-600 bg-purple-50",
    orange: "bg-orange-500 text-orange-600 bg-orange-50",
  };

  const content = (
    <div
      className={`rounded-lg bg-white p-6 shadow transition-shadow hover:shadow-md ${highlight ? "ring-2 ring-orange-400" : ""}`}
    >
      <div className="flex items-center justify-between">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-lg ${colorClasses[color].split(" ")[2]}`}
        >
          <span className={colorClasses[color].split(" ")[1]}>{icon}</span>
        </div>
        {highlight && (
          <span className="flex h-3 w-3">
            <span className="absolute inline-flex h-3 w-3 animate-ping rounded-full bg-orange-400 opacity-75"></span>
            <span className="relative inline-flex h-3 w-3 rounded-full bg-orange-500"></span>
          </span>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-gray-500">{title}</p>
        <p className="mt-1 text-3xl font-bold text-gray-900">{value.toLocaleString()}</p>
        {subtitle && <p className="mt-1 text-xs text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );

  return href ? <Link to={href}>{content}</Link> : content;
}

function ActivityCard({
  value,
  label,
  color,
  trend,
}: {
  value: number;
  label: string;
  color: "blue" | "purple" | "green";
  trend: "up" | "down" | "neutral";
}) {
  const bgColors = {
    blue: "bg-blue-50",
    purple: "bg-purple-50",
    green: "bg-green-50",
  };
  const textColors = {
    blue: "text-blue-600",
    purple: "text-purple-600",
    green: "text-green-600",
  };

  return (
    <div className={`p-4 text-center ${bgColors[color]} rounded-lg`}>
      <div className="flex items-center justify-center gap-1">
        <p className={`text-3xl font-bold ${textColors[color]}`}>{value}</p>
        {trend === "up" && (
          <svg
            className="h-4 w-4 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 10l7-7m0 0l7 7m-7-7v18"
            />
          </svg>
        )}
      </div>
      <p className="mt-1 text-sm text-gray-600">{label}</p>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  label,
  count,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  return (
    <Link
      to={href}
      className="group flex items-center justify-between rounded-lg border border-gray-200 p-3 transition-colors hover:border-primary-300 hover:bg-primary-50"
    >
      <div className="flex items-center gap-3">
        <span className="text-gray-400 group-hover:text-primary-500">{icon}</span>
        <span className="text-sm font-medium text-gray-700 group-hover:text-primary-700">
          {label}
        </span>
      </div>
      {count !== undefined && count > 0 && (
        <span className="rounded-full bg-orange-100 px-2 py-1 text-xs font-medium text-orange-700">
          {count}
        </span>
      )}
    </Link>
  );
}

// Icons
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

function PlacesIcon() {
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
        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
      />
    </svg>
  );
}

function ReviewsIcon() {
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
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
}

function PendingIcon() {
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
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
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
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function FlagIcon() {
  return (
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
        d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
      />
    </svg>
  );
}

function SearchIcon() {
  return (
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
        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
      />
    </svg>
  );
}
