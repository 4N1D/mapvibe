import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '../lib/api';

export default function ReviewsPage() {
  const [filter, setFilter] = useState<'all' | 'reported' | 'hidden'>('all');
  const [page, setPage] = useState(0);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['admin-reviews', filter, page],
    queryFn: () => adminApi.getReviews({ status: filter === 'all' ? undefined : filter, offset: page * 20, limit: 20 }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: string }) => adminApi.updateReview(id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
    },
  });

  const reviews = data?.data?.reviews || [];
  const pagination = data?.data?.pagination || { total: 0 };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <div className="flex gap-2">
          {(['all', 'reported', 'hidden'] as const).map((f) => (
            <button
              key={f}
              onClick={() => {
                setFilter(f);
                setPage(0);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                filter === f
                  ? 'bg-primary-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review: Record<string, unknown>) => (
              <div key={review.id as string} className="bg-white rounded-lg shadow p-6">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-medium text-gray-900">{review.author_name as string}</span>
                      <span className="text-sm text-gray-500">{review.author_email as string}</span>
                      {(review.report_count as number) > 0 && (
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          {review.report_count} reports
                        </span>
                      )}
                      <StatusBadge status={(review.status as string) || 'active'} />
                    </div>
                    <p className="text-gray-600 mb-2">{review.text as string}</p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>Place: {review.place_name as string || 'Unknown'}</span>
                      <span>Upvotes: {review.upvote_count as number || 0}</span>
                      <span>Comments: {review.comment_count as number || 0}</span>
                      <span>
                        {new Date(review.created_at as string).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 ml-4">
                    {review.status !== 'approved' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: review.id as string, action: 'approve' })}
                        className="px-3 py-1 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200"
                      >
                        Approve
                      </button>
                    )}
                    {review.status !== 'hidden' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: review.id as string, action: 'hide' })}
                        className="px-3 py-1 text-sm bg-yellow-100 text-yellow-700 rounded-lg hover:bg-yellow-200"
                      >
                        Hide
                      </button>
                    )}
                    {review.status === 'hidden' && (
                      <button
                        onClick={() => updateMutation.mutate({ id: review.id as string, action: 'restore' })}
                        className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
                      >
                        Restore
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this review?')) {
                          updateMutation.mutate({ id: review.id as string, action: 'delete' });
                        }
                      }}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-gray-700">
              Showing {page * 20 + 1} to {Math.min((page + 1) * 20, pagination.total)} of {pagination.total} results
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={(page + 1) * 20 >= pagination.total}
                className="px-4 py-2 border border-gray-300 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    approved: 'bg-green-100 text-green-800',
    hidden: 'bg-yellow-100 text-yellow-800',
    deleted: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[status] || colors.active}`}>
      {status}
    </span>
  );
}
