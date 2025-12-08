import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../lib/api';
import { Breadcrumbs } from '../components/ui';

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  login: 'Đăng nhập',
  logout: 'Đăng xuất',
  register: 'Đăng ký',
  view_place: 'Xem địa điểm',
  view_review: 'Xem bài viết',
  view_profile: 'Xem hồ sơ',
  search: 'Tìm kiếm',
  search_nearby: 'Tìm gần đây',
  create_review: 'Tạo bài viết',
  edit_review: 'Sửa bài viết',
  delete_review: 'Xóa bài viết',
  create_comment: 'Bình luận',
  edit_comment: 'Sửa bình luận',
  delete_comment: 'Xóa bình luận',
  like: 'Thích',
  unlike: 'Bỏ thích',
  report: 'Báo cáo',
  share: 'Chia sẻ',
  upload_photo: 'Tải ảnh',
  delete_photo: 'Xóa ảnh',
  follow: 'Theo dõi',
  unfollow: 'Bỏ theo dõi',
  update_profile: 'Cập nhật hồ sơ',
  update_avatar: 'Đổi avatar',
  page_view: 'Xem trang',
  other: 'Khác',
};

export default function AnalyticsPage() {
  const [days, setDays] = useState(7);
  const [activityFilter, setActivityFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');

  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-activity-stats', days],
    queryFn: () => adminApi.getActivityStats({ days }),
  });

  const { data: activitiesData, isLoading: activitiesLoading } = useQuery({
    queryKey: ['admin-activities', activityFilter, userFilter],
    queryFn: () => adminApi.getActivities({
      activity_type: activityFilter || undefined,
      user_id: userFilter || undefined,
      limit: 50,
    }),
  });

  const stats = statsData?.data || {};
  const activities = activitiesData?.data?.activities || [];

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[
        { label: 'Tổng quan', href: '/' },
        { label: 'Phân tích' },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Phân tích hoạt động</h1>
          <p className="text-sm text-gray-500 mt-1">
            Theo dõi hoạt động người dùng trên hệ thống
          </p>
        </div>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
        >
          <option value={7}>7 ngày qua</option>
          <option value={14}>14 ngày qua</option>
          <option value={30}>30 ngày qua</option>
        </select>
      </div>

      {/* Summary Stats */}
      {statsLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-6 animate-pulse">
              <div className="h-8 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Đang online ({stats.online_users?.length || 0})
        </h2>
        {stats.online_users?.length > 0 ? (
          <div className="flex flex-wrap gap-3">
            {stats.online_users.map((user: any) => (
              <div
                key={user.user_id}
                className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-full"
              >
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                {user.avatar ? (
                  <img src={user.avatar} alt="" className="w-6 h-6 rounded-full" />
                ) : (
                  <div className="w-6 h-6 bg-gray-300 rounded-full flex items-center justify-center text-xs">
                    {user.display_name?.[0]?.toUpperCase() || '?'}
                  </div>
                )}
                <span className="text-sm font-medium text-gray-700">
                  {user.display_name || 'Ẩn danh'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Không có ai online</p>
        )}
      </div>

      {/* Activity by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Hoạt động theo loại</h2>
          {stats.by_type?.length > 0 ? (
            <div className="space-y-3">
              {stats.by_type.slice(0, 10).map((item: any) => (
                <div key={item.activity_type} className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {ACTIVITY_TYPE_LABELS[item.activity_type] || item.activity_type}
                      </span>
                      <span className="text-sm text-gray-500">{item.count}</span>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary-500 rounded-full"
                        style={{ width: `${Math.min((item.count / (stats.by_type[0]?.count || 1)) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Chưa có dữ liệu</p>
          )}
        </div>

        {/* Top Users */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Top người dùng hoạt động</h2>
          {stats.top_users?.length > 0 ? (
            <div className="space-y-3">
              {stats.top_users.map((user: any, index: number) => (
                <div key={user.user_id} className="flex items-center gap-3">
                  <span className={`w-6 h-6 flex items-center justify-center rounded-full text-sm font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-200 text-gray-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>
                    {index + 1}
                  </span>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" className="w-8 h-8 rounded-full" />
                  ) : (
                    <div className="w-8 h-8 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                      {user.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{user.display_name || 'Ẩn danh'}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                  </div>
                  <span className="text-sm font-medium text-gray-700">{user.activity_count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Chưa có dữ liệu</p>
          )}
        </div>
      </div>

      {/* Activity by Day Chart */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Hoạt động theo ngày</h2>
        {stats.by_day?.length > 0 ? (
          <div className="space-y-2">
            {stats.by_day.slice(0, 7).reverse().map((day: any) => (
              <div key={day.date} className="flex items-center gap-4">
                <span className="w-24 text-sm text-gray-600">
                  {new Date(day.date).toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                </span>
                <div className="flex-1 h-6 bg-gray-100 rounded overflow-hidden flex items-center">
                  <div
                    className="h-full bg-primary-500 rounded"
                    style={{ width: `${Math.min((day.total_activities / Math.max(...stats.by_day.map((d: any) => d.total_activities))) * 100, 100)}%` }}
                  />
                  <span className="ml-2 text-sm text-gray-600">{day.total_activities}</span>
                </div>
                <span className="text-sm text-gray-500">{day.unique_users} users</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">Chưa có dữ liệu</p>
        )}
      </div>

      {/* Recent Activities */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Hoạt động gần đây</h2>
          <div className="flex gap-2">
            <select
              value={activityFilter}
              onChange={(e) => setActivityFilter(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">Tất cả loại</option>
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        
        {activitiesLoading ? (
          <div className="p-6 space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 bg-gray-200 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-1/3 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
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
              <div key={activity.id} className="px-6 py-4 hover:bg-gray-50">
                <div className="flex items-center gap-4">
                  {activity.user_avatar ? (
                    <img src={activity.user_avatar} alt="" className="w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                      {activity.user_name?.[0]?.toUpperCase() || '?'}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">{activity.user_name || 'Ẩn danh'}</span>
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
                      <p className="text-sm text-gray-500 truncate">{activity.page_url}</p>
                    )}
                  </div>
                  <span className="text-sm text-gray-400">
                    {new Date(activity.created_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
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
  color: 'blue' | 'green' | 'purple';
}) {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-lg ${colorClasses[color]} flex items-center justify-center`}>
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
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function SessionIcon() {
  return (
    <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
