import { useEffect, useRef, useState } from "react";
import { SendButton } from "@mapvibe/ui-components";
import { Search } from "lucide-react";

interface HeroSearchProps {
  onSearch?: (query: string) => void;
}

export function HeroSearch({ onSearch }: HeroSearchProps) {
  const [searchValue, setSearchValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      const currentHeight = textarea.offsetHeight;
      textarea.style.height = "auto";
      const newHeight = textarea.scrollHeight;
      textarea.style.height = `${currentHeight}px`;
      textarea.offsetHeight;
      textarea.style.height = `${newHeight}px`;
    }
  };

  useEffect(() => {
    adjustHeight();
  }, [searchValue]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (searchValue.trim()) {
        onSearch?.(searchValue);
        setSearchValue("");
      }
    }
  };

  const handleSubmit = () => {
    if (searchValue.trim()) {
      onSearch?.(searchValue);
      setSearchValue("");
    }
  };

  return (
    <div className="z-10 w-full max-w-2xl px-4">
      <h1 className="mb-8 text-center text-4xl font-bold text-white drop-shadow-md">
        Bạn muốn ăn gì hôm nay?
      </h1>

      <div className="relative flex w-full flex-col rounded-3xl border border-white/20 bg-white shadow-2xl transition-all focus-within:border-white/40 focus-within:ring-2 focus-within:ring-white/20 dark:bg-gray-800">
        <textarea
          ref={textareaRef}
          rows={1}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Tìm địa điểm ăn uống, món ngon..."
          className="scrollbar-hide max-h-[200px] min-h-[52px] w-full resize-none overflow-y-auto rounded-3xl bg-transparent py-3.5 pl-4 pr-14 text-base text-gray-800 placeholder-gray-400 outline-none transition-all duration-75 dark:text-white"
          style={{
            scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}
        />

        <div className="absolute bottom-0 right-2 top-0 flex items-center">
          <SendButton onClick={handleSubmit} />
        </div>
      </div>

      <div className="mt-4 flex justify-center gap-2 text-xs text-white/80">
        <Search size={14} />
        <span>Nhấn Enter để tìm kiếm</span>
      </div>

      <style>{`
        .scrollbar-hide::-webkit-scrollbar {
            display: none;
        }
      `}</style>
    </div>
  );
}
