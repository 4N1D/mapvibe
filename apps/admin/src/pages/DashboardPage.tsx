import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../lib/api';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => adminApi.getStats(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading statistics. Please try again.
      </div>
    );
  }

  const stats = data?.data?.stats || {};
  const activity = data?.data?.recent_activity || {};

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h1>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total Users"
          value={stats.total_users || 0}
          subtitle={`+${activity.new_users_7d || 0} this week`}
          color="blue"
        />
        <StatCard
          title="Total Places"
          value={stats.total_places || 0}
          color="green"
        />
        <StatCard
          title="Total Reviews"
          value={stats.total_reviews || 0}
          subtitle={`+${activity.new_reviews_7d || 0} this week`}
          color="purple"
        />
        <StatCard
          title="Pending Locations"
          value={stats.pending_locations || 0}
          subtitle="Needs review"
          color="orange"
        />
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity (7 days)</h2>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{activity.new_users_7d || 0}</p>
            <p className="text-sm text-gray-600">New Users</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">{activity.new_reviews_7d || 0}</p>
            <p className="text-sm text-gray-600">New Reviews</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{activity.new_photos_7d || 0}</p>
            <p className="text-sm text-gray-600">New Photos</p>
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
  color,
}: {
  title: string;
  value: number;
  subtitle?: string;
  color: 'blue' | 'green' | 'purple' | 'orange';
}) {
  const colorClasses = {
    blue: 'bg-blue-500',
    green: 'bg-green-500',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center">
        <div className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center`}>
          <span className="text-white text-xl font-bold">{value > 999 ? '999+' : ''}</span>
        </div>
        <div className="ml-4">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          {subtitle && <p className="text-xs text-gray-400">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}
