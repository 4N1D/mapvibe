import { useEffect, useRef, useState } from "react";
import { SendButton } from "@mapvibe/ui-components";
import { ChatMessage, Message } from "./ChatMessage";
import { Loader2, RotateCcw } from "lucide-react";

interface SearchConversationProps {
  messages: Message[];
  isLoading: boolean;
  onSendMessage: (message: string) => void;
  onReset: () => void;
}

export function SearchConversation({
  messages,
  isLoading,
  onSendMessage,
  onReset,
}: SearchConversationProps) {
  const [inputValue, setInputValue] = useState("");
  const lastMessageRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto scroll đến message mới nhất (câu hỏi user vừa gửi)
  useEffect(() => {
    // Chỉ scroll khi có từ message thứ 2 trở đi
    if (messages.length <= 1) return;

    // Delay để đảm bảo content đã render xong
    const timer = setTimeout(() => {
      if (lastMessageRef.current) {
        const elementPosition = lastMessageRef.current.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - 50;

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth",
        });
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [messages.length]);

  // Auto resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputValue]);

  const handleSubmit = () => {
    if (inputValue.trim() && !isLoading) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Messages */}
      <div className="mb-6 space-y-6">
        {messages.map((message, index) => (
          <div
            key={message.id}
            ref={index === messages.length - 1 ? lastMessageRef : null}
          >
            <ChatMessage message={message} />
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex gap-3">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gray-800">
              <Loader2 className="h-4 w-4 animate-spin text-white" />
            </div>
            <div className="flex items-center">
              <div className="inline-block rounded-2xl bg-gray-100 px-4 py-3">
                <p className="text-sm text-gray-500">Đang tìm kiếm...</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Follow-up input */}
      <div className="sticky bottom-4">
        <div className="relative flex w-full flex-col rounded-2xl border border-gray-200 bg-white shadow-lg">
          <textarea
            ref={textareaRef}
            rows={1}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Hỏi thêm về kết quả, hoặc tìm kiếm khác..."
            disabled={isLoading}
            className="scrollbar-hide max-h-[120px] min-h-[48px] w-full resize-none overflow-y-auto rounded-2xl bg-transparent py-3 pl-12 pr-12 text-sm text-gray-800 placeholder-gray-400 outline-none disabled:opacity-50"
            style={{
              scrollbarWidth: "none",
              msOverflowStyle: "none",
            }}
          />

          {/* Reset button */}
          <div className="absolute bottom-0 left-2 top-0 flex items-center">
            <button
              onClick={onReset}
              disabled={isLoading}
              className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
              title="Tìm kiếm mới"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>

          <div className="absolute bottom-0 right-2 top-0 flex items-center">
            <SendButton
              size="sm"
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isLoading}
            />
          </div>
        </div>

        <p className="mt-2 text-center text-xs text-gray-400">Shift + Enter để xuống dòng</p>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
