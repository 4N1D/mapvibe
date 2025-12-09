import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Comment, CommentsResponse } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { formatRelativeTime } from "@/utils/date";
import { CommentForm } from "../CommentForm";
import { CommentItem } from "../CommentItem";
import { useAuth } from "@/contexts/AuthContext";

interface CommentsTabProps {
  restaurantId?: string;
  slug?: string;
  reviewId?: string;
}

const fetchComments = async (slug?: string, reviewId?: string, page: number = 1) => {
  if (reviewId) {
    // Fetch comments for a specific review post
    const response = await apiClient.get<CommentsResponse>(
      `/reviews/${reviewId}/comments?page=${page}&limit=10`
    );
    return response.data;
  } else if (slug) {
    // Fetch comments for a restaurant
    const response = await apiClient.get<CommentsResponse>(
      `/restaurants/${slug}/comments?page=${page}&limit=10`
    );
    return response.data;
  }
  throw new Error("Either slug or reviewId must be provided");
};

interface LikedCommentsResponse {
  review_id: string;
  liked_comment_ids: string[];
}

export function CommentsTab({ restaurantId, slug, reviewId }: CommentsTabProps) {
  const { user, isAuthenticated } = useAuth();
  const [localComments, setLocalComments] = useState<Comment[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{
    id: string;
    name: string;
    rootParentId: string;
  } | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  const queryKey = reviewId
    ? ["comments", "review", reviewId]
    : ["comments", "restaurant", slug];

  const { data } = useQuery({
    queryKey,
    queryFn: () => fetchComments(slug, reviewId, 1),
    placeholderData: (prev) => prev,
    enabled: !!(slug || reviewId),
  });

  const comments = localComments.length > 0 ? localComments : data?.comments || [];

  if (data && localComments.length === 0 && hasMore !== data.page < data.total_pages) {
    setHasMore(data.page < data.total_pages);
  }

  const loadMore = async () => {
    try {
      setLoadingMore(true);
      const nextPage = page + 1;
      const response = await fetchComments(slug, reviewId, nextPage);
      const currentComments = localComments.length > 0 ? localComments : data?.comments || [];
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
      let endpoint: string;
      let payload: any;

      if (reviewId) {
        // For review post comments
        endpoint = "/reviews/comment";
        payload = {
          author_id: user.sub,
          text: content,
          review_post_id: reviewId,
          parent_comment_id: replyingTo?.id || null,
        };
      } else if (slug) {
        // For restaurant comments - API expects slug and content
        endpoint = "/restaurants/comments";
        payload = {
          slug,
          content,
          parent_id: replyingTo?.id || null,
        };
      } else {
        throw new Error("Missing slug or reviewId");
      }

      const response = await apiClient.post<{ comment: any }>(endpoint, payload);

      // Extract comment from response (API returns { comment: ... })
      // Map text to content to match Comment interface
      const rawComment = response.data.comment || response.data;

      // Get user info from auth context to populate author_name and author_avatar
      // since API might not return these fields (API only returns comment record without user join)
      const newComment: Comment = {
        ...rawComment,
        content: rawComment.text || rawComment.content,
        author_name: rawComment.author_name || user?.name || user?.email || "Người dùng",
        author_avatar: rawComment.author_avatar || user?.avatar || undefined,
        review_post_id: reviewId || rawComment.review_post_id,
        restaurant_id: restaurantId?.toString() || rawComment.restaurant_id,
      };

      const currentComments = localComments.length > 0 ? localComments : data?.comments || [];

      if (replyingTo) {
        // When replying, parent_id should be the ID of the comment being replied to directly
        // API response already has parent_comment_id, but we need to set parent_id for UI consistency
        const newReply: Comment = {
          ...newComment,
          reply_to_name: replyingTo.name,
          parent_id: replyingTo.id, // Direct parent (the comment being replied to)
        };

        // Find the root parent comment (top-level) and add the reply to its replies array
        // All replies are grouped under the top-level comment for display
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

  // Extract liked comment IDs from restaurant comments response (user_has_liked field)
  useEffect(() => {
    if (!reviewId && data?.comments && isAuthenticated) {
      const extractLikedIds = (comments: Comment[]): string[] => {
        const likedIds: string[] = [];
        for (const comment of comments) {
          if ((comment as any).user_has_liked) {
            likedIds.push(comment.id);
          }
          if (comment.replies) {
            likedIds.push(...extractLikedIds(comment.replies));
          }
        }
        return likedIds;
      };
      const likedIds = extractLikedIds(data.comments);
      setLikedCommentIds(new Set(likedIds));
    }
  }, [data?.comments, reviewId, isAuthenticated]);

  // Fetch liked comments when reviewId is available and user is authenticated
  useEffect(() => {
    const fetchLikedComments = async () => {
      if (!reviewId) {
        // For restaurant comments, liked status comes from API response (user_has_liked)
        return;
      }

      if (!isAuthenticated) {
        // Reset liked comments if not authenticated
        setLikedCommentIds(new Set());
        return;
      }

      try {
        console.log(`[CommentsTab] Fetching liked comments for review: ${reviewId}`);
        const response = await apiClient.get<LikedCommentsResponse>(
          `/reviews/${reviewId}/liked-comments`
        );
        
        console.log("[CommentsTab] API Response:", response.data);
        
        // Always update likedCommentIds, even if array is empty
        if (response.data && Array.isArray(response.data.liked_comment_ids)) {
          const likedIds = response.data.liked_comment_ids;
          console.log(`[CommentsTab] Setting ${likedIds.length} liked comment IDs:`, likedIds);
          setLikedCommentIds(new Set(likedIds));
        } else {
          // If response format is unexpected, reset to empty
          console.warn("[CommentsTab] Unexpected response format:", response.data);
          setLikedCommentIds(new Set());
        }
      } catch (error: any) {
        // Log error for debugging
        console.error("[CommentsTab] Failed to fetch liked comments:", error);
        if (error.response) {
          console.error("[CommentsTab] Error response:", error.response.status, error.response.data);
        }
        // Reset to empty set on error
        setLikedCommentIds(new Set());
      }
    };

    fetchLikedComments();
  }, [reviewId, isAuthenticated]);

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
              initialLiked={likedCommentIds.has(comment.id)}
              isLiked={(commentId) => likedCommentIds.has(commentId)}
              onLikeChange={(commentId, liked) => {
                setLikedCommentIds((prev) => {
                  const newSet = new Set(prev);
                  if (liked) {
                    newSet.add(commentId);
                  } else {
                    newSet.delete(commentId);
                  }
                  return newSet;
                });
              }}
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
