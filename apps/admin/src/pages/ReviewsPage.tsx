import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { adminApi } from '../lib/api';
import { Breadcrumbs, SkeletonCard } from '../components/ui';
import { useConfirm } from '../hooks/useConfirm';

type FilterType = 'all' | 'reported' | 'hidden';

export default function ReviewsPage() {
  const [filter, setFilter] = useState<FilterType>('all');
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();
  const { confirm, ConfirmDialog } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', filter, page],
    queryFn: () => adminApi.getReviews({ 
      status: filter === 'all' ? undefined : filter, 
      offset: page * 20, 
      limit: 20 
    }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => 
      adminApi.updateReview(id, action),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      const actionText = variables.action === 'delete' ? 'xóa' : variables.action === 'hide' ? 'ẩn' : 'hiện';
      toast.success(`Đã ${actionText} bài viết`);
    },
    onError: () => {
      toast.error('Lỗi khi cập nhật bài viết');
    },
  });

  const actionLabels: Record<string, string> = {
    delete: 'Xóa',
    hide: 'Ẩn',
    unhide: 'Hiện',
  };

  const handleAction = async (id: string, action: string, requireConfirm = false) => {
    if (requireConfirm) {
      const confirmed = await confirm({
        title: `${actionLabels[action] || action} bài viết`,
        message: `Bạn có chắc muốn ${actionLabels[action]?.toLowerCase() || action} bài viết này?`,
        confirmText: actionLabels[action] || action,
        variant: action === 'delete' ? 'danger' : 'warning',
      });
      if (!confirmed) return;
    }
    updateMutation.mutate({ id, action });
  };

  const reviews = data?.data?.reviews || [];
  const pagination = data?.data?.pagination || { total: 0 };

  const filterCounts = {
    all: pagination.total,
    reported: reviews.filter((r: Record<string, unknown>) => (r.report_count as number) > 0).length,
    hidden: reviews.filter((r: Record<string, unknown>) => r.status === 'hidden').length,
  };

  return (
    <div className="space-y-6">
      <ConfirmDialog />
      
      <Breadcrumbs items={[
        { label: 'Tổng quan', href: '/' },
        { label: 'Bài viết' },
      ]} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bài viết</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý và kiểm duyệt bài viết của người dùng
          </p>
        </div>
        
        {/* Filter Tabs */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['all', 'reported', 'hidden'] as const).map((f) => {
            const labels = { all: 'Tất cả', reported: 'Bị báo cáo', hidden: 'Đã ẩn' };
            return (
              <button
                key={f}
                onClick={() => {
                  setFilter(f);
                  setPage(0);
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === f
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {labels[f]}
                {f === 'reported' && filterCounts.reported > 0 && (
                  <span className="ml-2 px-1.5 py-0.5 text-xs bg-red-100 text-red-700 rounded-full">
                    {filterCounts.reported}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!isLoading && reviews.length === 0 && (
        <div className="text-center py-16 bg-white rounded-lg shadow">
          <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">Không tìm thấy bài viết</h3>
          <p className="mt-2 text-sm text-gray-500">
            {filter === 'reported' 
              ? 'Hiện không có bài viết bị báo cáo.' 
              : filter === 'hidden' 
                ? 'Không có bài viết bị ẩn.'
                : 'Không có bài viết để hiển thị.'}
          </p>
        </div>
      )}

      {/* Reviews List */}
      {!isLoading && reviews.length > 0 && (
        <div className="space-y-4">
          {reviews.map((review: Record<string, unknown>) => (
            <ReviewCard
              key={review.id as string}
              review={review}
              onAction={(action, confirm) => handleAction(review.id as string, action, confirm)}
              isUpdating={updateMutation.isPending}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {!isLoading && pagination.total > 20 && (
        <div className="flex items-center justify-between bg-white rounded-lg shadow px-6 py-4">
          <p className="text-sm text-gray-700">
            Hiển thị <span className="font-medium">{page * 20 + 1}</span> đến{' '}
            <span className="font-medium">{Math.min((page + 1) * 20, pagination.total)}</span> trong{' '}
            <span className="font-medium">{pagination.total}</span> bài viết
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trước
            </button>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={(page + 1) * 20 >= pagination.total}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Sau
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ReviewCard({ 
  review, 
  onAction,
  isUpdating,
}: { 
  review: Record<string, unknown>;
  onAction: (action: string, confirm?: boolean) => void;
  isUpdating: boolean;
}) {
  const reportCount = review.report_count as number || 0;
  const status = review.status as string || 'active';
  const photos = review.photos as string[] || [];
  const authorName = (review.author_name as string) || 'Ẩn danh';
  const authorAvatar = review.author_avatar as string | undefined;

  return (
    <div className="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            {authorAvatar ? (
              <img 
                src={authorAvatar} 
                alt={authorName}
                className="w-10 h-10 rounded-full object-cover"
              />
            ) : (
              <div className="w-10 h-10 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center text-white font-medium">
                {authorName[0]?.toUpperCase() || 'U'}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-900">{authorName}</span>
                <span className="text-sm text-gray-500">{review.author_email as string}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                {reportCount > 0 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                    </svg>
                    {reportCount} báo cáo
                  </span>
                )}
                <StatusBadge status={status} />
              </div>
            </div>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-2">
            {status !== 'approved' && status !== 'active' && (
              <ActionButton
                onClick={() => onAction('approve')}
                disabled={isUpdating}
                variant="success"
              >
                Duyệt
              </ActionButton>
            )}
            {status !== 'hidden' && (
              <ActionButton
                onClick={() => onAction('hide', true)}
                disabled={isUpdating}
                variant="warning"
              >
                Ẩn
              </ActionButton>
            )}
            {status === 'hidden' && (
              <ActionButton
                onClick={() => onAction('restore')}
                disabled={isUpdating}
                variant="info"
              >
                Khôi phục
              </ActionButton>
            )}
            <ActionButton
              onClick={() => onAction('delete', true)}
              disabled={isUpdating}
              variant="danger"
            >
              Xóa
            </ActionButton>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4">
          <p className="text-gray-700 whitespace-pre-wrap">{review.text as string}</p>
        </div>

        {/* Photos */}
        {photos.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
            {photos.slice(0, 4).map((photo, i) => (
              <img
                key={i}
                src={photo}
                alt=""
                className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
              />
            ))}
            {photos.length > 4 && (
              <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <span className="text-sm text-gray-500">+{photos.length - 4}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {review.place_name as string || 'Không rõ'}
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
              </svg>
              {review.upvote_count as number || 0} thích
            </span>
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              {review.comment_count as number || 0} bình luận
            </span>
          </div>
          <span>
            {new Date(review.created_at as string).toLocaleDateString('vi-VN', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: 'success' | 'warning' | 'danger' | 'info';
}) {
  const styles = {
    success: 'bg-green-100 text-green-700 hover:bg-green-200',
    warning: 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200',
    danger: 'bg-red-100 text-red-700 hover:bg-red-200',
    info: 'bg-blue-100 text-blue-700 hover:bg-blue-200',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50 ${styles[variant]}`}
    >
      {children}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    hidden: 'bg-yellow-100 text-yellow-800',
    deleted: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${styles[status] || styles.active}`}>
      {status}
    </span>
  );
}
