import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Comment, CommentsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { CommentForm } from "../CommentForm";
import { CommentItem } from "../CommentItem";
import { useAuth } from "@/contexts/AuthContext";

interface CommentsTabProps {
  restaurantId?: number;
  reviewId?: string;
}

const fetchComments = async (restaurantId?: number, reviewId?: string, page: number = 1) => {
  if (reviewId) {
    // Fetch comments for a specific review post
    const response = await apiClient.get<CommentsResponse>(
      `/reviews/${reviewId}/comments?page=${page}&limit=10`
    );
    return response.data;
  } else if (restaurantId) {
    // Fetch comments for a restaurant
    const response = await apiClient.get<CommentsResponse>(
      `/comments/${restaurantId}?page=${page}&limit=10`
    );
    return response.data;
  }
  throw new Error("Either restaurantId or reviewId must be provided");
};

export function CommentsTab({ restaurantId, reviewId }: CommentsTabProps) {
  const { user } = useAuth();
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; name: string; rootParentId: string } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const queryKey = reviewId ? ["comments", "review", reviewId] : ["comments", "restaurant", restaurantId];

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchComments(restaurantId, reviewId, 1),
    placeholderData: (prev) => prev,
    enabled: !!(restaurantId || reviewId),
  });

  const comments = localComments.length > 0 ? localComments : (data?.comments || []);

  if (data && localComments.length === 0 && hasMore !== (data.page < data.total_pages)) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchComments(restaurantId, reviewId, nextPage);
      const currentComments = localComments.length > 0 ? localComments : (data?.comments || []);
      setLocalComments([...currentComments, ...response.comments]);
      setHasMore(response.page < response.total_pages);
      setPage(nextPage);
    } catch (error) {
      console.error("Failed to load more comments:", error);
    } finally {
      setLoadingMore(false);
    }
  };

  const handleSubmit = async (content: string) => {
    if (!user?.sub) {
      alert("Vui lòng đăng nhập để bình luận");
      return;
    }

    try {
      setSubmitting(true);
      const payload: any = {
        author_id: user.sub,
        text: content,
        parent_comment_id: replyingTo?.id || null,
      };

      if (reviewId) {
        payload.review_post_id = reviewId;
      } else if (restaurantId) {
        payload.restaurant_id = restaurantId;
      }

      const endpoint = reviewId ? "/reviews/comment" : "/comments";
      const response = await apiClient.post<{ comment: any }>(endpoint, payload);
      
      // Extract comment from response (API returns { comment: ... })
      // Map text to content to match Comment interface
      const rawComment = response.data.comment || response.data;
      const newComment: Comment = {
        ...rawComment,
        content: rawComment.text || rawComment.content,
        review_post_id: reviewId || rawComment.review_post_id,
        restaurant_id: restaurantId?.toString() || rawComment.restaurant_id,
      };

      const currentComments = localComments.length > 0 ? localComments : (data?.comments || []);
      
      if (replyingTo) {
        const newReply = {
          ...newComment,
          reply_to_name: replyingTo.name,
          parent_id: replyingTo.rootParentId,
        };
        setLocalComments(
          currentComments.map((comment: Comment) =>
            comment.id === replyingTo.rootParentId
              ? { ...comment, replies: [...(comment.replies || []), newReply] }
              : comment
          )
        );
        setReplyingTo(null);
      } else {
        setLocalComments([newComment, ...currentComments]);
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