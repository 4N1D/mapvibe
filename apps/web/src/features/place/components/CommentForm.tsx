import { useState } from "react";
import { X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface CommentFormProps {
  onSubmit: (content: string) => void;
  replyingTo?: { id: string; name: string } | null;
  onCancelReply?: () => void;
  loading?: boolean;
}

export function CommentForm({ onSubmit, replyingTo, onCancelReply, loading }: CommentFormProps) {
  const { user, isAuthenticated } = useAuth();
  const [content, setContent] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || loading) return;

    onSubmit(content.trim());
    setContent("");
  };

  if (!isAuthenticated) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center">
        <p className="text-gray-500">
          Vui lòng{" "}
          <a
            href="/login"
            className="text-primary-500 font-medium hover:underline"
          >
            đăng nhập
          </a>{" "}
          để bình luận
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-lg border border-gray-200 bg-white p-4"
    >
      {replyingTo && (
        <div className="mb-3 flex items-center gap-2 text-sm text-gray-500">
          <span>
            Đang trả lời <span className="font-semibold text-primary-500">@{replyingTo.name}</span>
          </span>
          <button
            type="button"
            onClick={onCancelReply}
            className="rounded-full p-0.5 hover:bg-gray-200"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="flex gap-3">
        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-gray-200">
          {user?.avatar ? (
            <img
              src={user.avatar}
              alt={user.name || "Avatar"}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-gray-300 text-sm font-medium text-gray-600">
              {user?.name?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <input
          type="text"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            replyingTo ? `Trả lời @${replyingTo.name}...` : "Viết bình luận của bạn tại đây..."
          }
          className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          disabled={loading}
        />

        <button
          type="submit"
          disabled={!content.trim() || loading}
          className="rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 lg:px-6"
        >
          {loading ? "..." : "Gửi"}
        </button>
      </div>
    </form>
  );
}
