import { useEffect, useState } from "react";
import { ChevronsDownIcon } from "lucide-react";
import { HeroSearch, SearchConversation, useSearchChat } from "@/features/search";
import { FeaturedReviews } from "@/features/review";

export function HomePage() {
  const [scrollY, setScrollY] = useState(0);
  const { messages, isLoading, sendMessage, clearMessages } = useSearchChat();

  const hasConversation = messages.length > 0;

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Scroll to conversation CHỈ khi bắt đầu conversation (message đầu tiên)
  useEffect(() => {
    if (messages.length === 1) {
      const conversationElement = document.getElementById("conversation-section");
      if (conversationElement) {
        setTimeout(() => {
          conversationElement.scrollIntoView({ behavior: "smooth" });
        }, 300);
      }
    }
  }, [messages.length]);

  const handleSearch = (query: string) => {
    sendMessage(query);
  };

  return (
    <div className="relative">
      {/* Hero Section với Parallax */}
      <section
        className={`relative flex w-full flex-col items-center justify-center bg-cover bg-center transition-all duration-500 ${
          hasConversation ? "h-[50vh] bg-fixed" : "h-[calc(100vh-64px)] bg-fixed"
        }`}
        style={{
          backgroundImage: "url('/images/hero-bg.avif')",
        }}
      >
        {/* Parallax overlay */}
        <div
          className="absolute inset-0 bg-black/30 transition-opacity duration-500"
          style={{
            transform: hasConversation ? "none" : `translateY(${scrollY * 0.3}px)`,
            opacity: hasConversation ? 0.5 : 1,
          }}
        />

        {/* Content */}
        <div
          className="transition-all duration-500"
          style={{
            transform: hasConversation ? "none" : `translateY(${scrollY * 0.5}px)`,
            opacity: hasConversation ? 1 : Math.max(0, 1 - scrollY / 600),
          }}
        >
          <HeroSearch onSearch={handleSearch} />
        </div>

        {/* Scroll indicator - chỉ hiện khi chưa search */}
        {!hasConversation && (
          <div
            className="absolute bottom-8 left-0 right-0 z-10 flex animate-bounce justify-center"
            style={{
              opacity: Math.max(0, 1 - scrollY / 200),
            }}
          >
            <ChevronsDownIcon className="h-10 w-10 text-white/70 drop-shadow-lg" />
          </div>
        )}
      </section>

      {/* Conversation Section - hiện khi có messages */}
      {hasConversation && (
        <section
          id="conversation-section"
          className="relative z-10 min-h-screen bg-white"
        >
          <SearchConversation
            messages={messages}
            isLoading={isLoading}
            onSendMessage={sendMessage}
            onReset={clearMessages}
          />
        </section>
      )}

      {/* Featured Reviews - chỉ hiện khi chưa search */}
      {!hasConversation && (
        <section className="relative z-10">
          <FeaturedReviews />
        </section>
      )}
    </div>
  );
}
