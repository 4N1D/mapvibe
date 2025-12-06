import { useState, useEffect } from "react";
import { Comment, CommentsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { CommentForm } from "../CommentForm";
import { CommentItem } from "../CommentItem";

interface CommentsTabProps {
  restaurantId: number;
}

export function CommentsTab({ restaurantId }: CommentsTabProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; rootParentId: string } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<CommentsResponse>(
          `/comments/${restaurantId}?page=1&limit=10`
        );
        setComments(response.data.comments);
        setHasMore(response.data.page < response.data.total_pages);
        setPage(1);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [restaurantId]);

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await apiClient.get<CommentsResponse>(
        `/comments/${restaurantId}?page=${nextPage}&limit=10`
      );
      setComments((prev) => [...prev, ...response.data.comments]);
      setHasMore(response.data.page < response.data.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more comments:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (content: string) => {
    try {
      setSubmitting(true);
      const payload = {
        restaurant_id: restaurantId,
        content,
        parent_id: replyingTo?.id || null,
      };

      const response = await apiClient.post<Comment>("/comments", payload);

      if (replyingTo) {
        const newReply = {
          ...response.data,
          reply_to_name: replyingTo.name,
          parent_id: replyingTo.rootParentId,
        };
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === replyingTo.rootParentId
              ? { ...comment, replies: [...(comment.replies || []), newReply] }
              : comment
          )
        );
        setReplyingTo(null);
      } else {
        setComments((prev) => [response.data, ...prev]);
      }
    } catch (error) {
      console.error("Failed to post comment:", error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReply = (commentId: string, authorName: string, rootParentId: string) => {
    setReplyingTo({ id: commentId, name: authorName, rootParentId });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      {!replyingTo && (
        <div className="mb-6">
          <CommentForm
            onSubmit={handleSubmit}
            loading={submitting}
          />
        </div>
      )}

      <div className="divide-y divide-gray-100">
        {comments.length === 0 ? (
          <p className="py-8 text-center text-gray-500">
            Chưa có bình luận nào. Hãy là người đầu tiên!
          </p>
        ) : (
          comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              onReply={handleReply}
              onSubmitReply={handleSubmit}
              onCancelReply={() => setReplyingTo(null)}
              replyingToId={replyingTo?.id}
              submitting={submitting}
              formatTime={formatRelativeTime}
            />
          ))
        )}
      </div>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loadingMore}
          className="mt-6 w-full py-3 text-center text-sm text-gray-500 hover:text-primary-500 disabled:opacity-50"
        >
          {loadingMore ? "Đang tải..." : "Nhấn để xem thêm bình luận..."}
        </button>
      )}
    </div>
  );
}