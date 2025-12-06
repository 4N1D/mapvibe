import { useState, useEffect } from "react";
import { Comment, CommentsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { CommentForm } from "../CommentForm";
import { CommentItem } from "../CommentItem";

interface CommentsTabProps {
  restaurantId: number;
}

export function CommentsTab({ restaurantId }: CommentsTabProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string } | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchComments = async () => {
      try {
        setLoading(true);
        const response = await apiClient.get<CommentsResponse>(
          `/comments/${restaurantId}?page=${page}&limit=10`
        );
        setComments(response.data.comments);
        setTotalPages(response.data.total_pages);
      } catch (error) {
        console.error("Failed to fetch comments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchComments();
  }, [restaurantId, page]);

  const formatTime = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffHours / 24);

    if (diffHours < 1) return "Vừa xong";
    if (diffHours < 24) return `${diffHours} giờ trước`;
    if (diffDays < 30) return `${diffDays} ngày trước`;
    return date.toLocaleDateString("vi-VN");
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
        setComments((prev) =>
          prev.map((comment) =>
            comment.id === replyingTo.id
              ? { ...comment, replies: [...(comment.replies || []), response.data] }
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

  const handleReply = (parentId: string, authorName: string) => {
    setReplyingTo({ id: parentId, name: authorName });
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-white p-6 shadow-sm">
      <div className="mb-6">
        <CommentForm
          onSubmit={handleSubmit}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          loading={submitting}
        />
      </div>

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
              formatTime={formatTime}
            />
          ))
        )}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          >
            Trước
          </button>
          <span className="flex items-center px-4 text-sm text-gray-600">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="rounded-lg border px-4 py-2 text-sm disabled:opacity-50"
          >
            Sau
          </button>
        </div>
      )}
    </div>
  );
}