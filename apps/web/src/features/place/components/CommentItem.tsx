import { useState } from "react";
import { Heart, MessageCircle, Flag } from "lucide-react";
import { Comment } from "@mapvibe/types";
import { apiClient } from "@/lib/axios";
import { CommentForm } from "./CommentForm";
import { ReportModal } from "./ReportModal";
import toast from "react-hot-toast";

interface CommentItemProps {
  comment: Comment;
  onReply: (commentId: string, authorName: string, rootParentId: string) => void;
  onSubmitReply?: (content: string) => void;
  onCancelReply?: () => void;
  replyingToId?: string | null;
  submitting?: boolean;
  formatTime: (date: string) => string;
  depth?: number;
  rootParentId?: string;
}

export function CommentItem({
  comment,
  onReply,
  onSubmitReply,
  onCancelReply,
  replyingToId,
  submitting,
  formatTime,
  depth = 0,
  rootParentId,
}: CommentItemProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const handleLike = async () => {
    // Optimistic update
    const wasLiked = liked;
    const prevCount = likeCount;
    setLiked(!wasLiked);
    setLikeCount(wasLiked ? prevCount - 1 : prevCount + 1);

    try {
      const response = await apiClient.post<{ liked: boolean; like_count: number }>(
        `/reviews/comments/${comment.id}/like`
      );
      
      // Update with actual response from server
      setLiked(response.data.liked);
      setLikeCount(response.data.like_count);
    } catch (error) {
      // Rollback on error
      setLiked(wasLiked);
      setLikeCount(prevCount);
      console.error("Failed to like comment:", error);
      toast.error("Không thể like comment. Vui lòng thử lại.");
    }
  };

  const handleReport = async (reason: string, details?: string) => {
    try {
      setReportLoading(true);
      // TODO: Call API to submit report
      console.log("Report submitted:", { commentId: comment.id, reason, details });
      toast.success("Đã gửi báo cáo. Cảm ơn bạn đã phản hồi!");
    } catch (error) {
      console.error("Failed to submit report:", error);
      toast.error("Không thể gửi báo cáo. Vui lòng thử lại.");
    } finally {
      setReportLoading(false);
    }
  };

  return (
    <div className={`${depth > 0 ? "ml-12 border-l-2 border-gray-100 pl-4" : ""}`}>
      <div className="flex gap-3 py-4">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {comment.author_avatar ? (
            <img
              src={comment.author_avatar}
              alt={comment.author_name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-300 text-sm font-medium text-gray-600">
              {(comment.author_name || "U").charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="mb-1">
            <span className="font-semibold text-gray-900">{comment.author_name || "Người dùng"}</span>
            <span className="ml-2 text-sm text-gray-400">{formatTime(comment.created_at)}</span>
          </div>

          <p className="mb-2 text-gray-700">
            {comment.reply_to_name && (
              <span className="text-primary-500 mr-1 font-semibold">@{comment.reply_to_name}</span>
            )}
            {comment.content}
          </p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <button
              onClick={handleLike}
              className={`flex items-center gap-1 transition hover:text-red-500 ${liked ? "text-red-500" : ""}`}
            >
              <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />
              <span>{likeCount}</span>
            </button>

            <button
              onClick={() => onReply(comment.id, comment.author_name || "Người dùng", rootParentId || comment.id)}
              className="hover:text-primary-500 flex items-center gap-1 transition"
            >
              <MessageCircle className="h-4 w-4" />
              <span>{depth === 0 ? comment.replies?.length || 0 : ""}</span>
            </button>

            <button
              onClick={() => setIsReportModalOpen(true)}
              className="flex items-center gap-1 transition hover:text-orange-500"
            >
              <Flag className="h-4 w-4" />
              <span>Báo cáo</span>
            </button>
          </div>

          <ReportModal
            isOpen={isReportModalOpen}
            onClose={() => setIsReportModalOpen(false)}
            onSubmit={handleReport}
            authorName={comment.author_name}
            loading={reportLoading}
          />

          {replyingToId === comment.id && onSubmitReply && onCancelReply && (
            <div className="mt-3">
              <CommentForm
                onSubmit={onSubmitReply}
                replyingTo={{ id: comment.id, name: comment.author_name || "Người dùng" }}
                onCancelReply={onCancelReply}
                loading={submitting}
              />
            </div>
          )}
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              onSubmitReply={onSubmitReply}
              onCancelReply={onCancelReply}
              replyingToId={replyingToId}
              submitting={submitting}
              formatTime={formatTime}
              depth={depth + 1}
              rootParentId={rootParentId || comment.id}
            />
          ))}
        </div>
      )}
    </div>
  );
}
