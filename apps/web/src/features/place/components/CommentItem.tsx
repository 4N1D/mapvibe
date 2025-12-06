import { useState } from "react";
import { Heart, MessageCircle, Flag } from "lucide-react";
import { Comment } from "@mapvibe/types";

interface CommentItemProps {
  comment: Comment;
  onReply: (parentId: string, authorName: string) => void;
  formatTime: (date: string) => string;
  depth?: number;
}

export function CommentItem({ comment, onReply, formatTime, depth = 0 }: CommentItemProps) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(comment.like_count);

  const handleLike = () => {
    setLiked(!liked);
    setLikeCount(liked ? likeCount - 1 : likeCount + 1);
  };

  const maxDepth = 1;

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
              {comment.author_name.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1">
          <div className="mb-1">
            <span className="font-semibold text-gray-900">{comment.author_name}</span>
            <span className="ml-2 text-sm text-gray-400">{formatTime(comment.created_at)}</span>
          </div>

          <p className="mb-2 text-gray-700">
            {comment.reply_to_name && (
              <span className="text-primary mr-1 font-semibold">@{comment.reply_to_name}</span>
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

            {depth < maxDepth && (
              <button
                onClick={() => onReply(comment.id, comment.author_name)}
                className="hover:text-primary flex items-center gap-1 transition"
              >
                <MessageCircle className="h-4 w-4" />
                <span>{comment.replies?.length || 0}</span>
              </button>
            )}

            <button className="flex items-center gap-1 transition hover:text-orange-500">
              <Flag className="h-4 w-4" />
              <span>Báo cáo</span>
            </button>
          </div>
        </div>
      </div>

      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.map((reply) => (
            <CommentItem
              key={reply.id}
              comment={reply}
              onReply={onReply}
              formatTime={formatTime}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
