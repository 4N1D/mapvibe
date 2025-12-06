import { useEffect } from "react";
import { motion, useScroll, useTransform } from "motion/react";
import { ChevronsDownIcon } from "lucide-react";
import { HeroSearch, SearchConversation, useSearchChat } from "@/features/search";
import { FeaturedReviews } from "@/features/review";

export function HomePage() {
  const { messages, isLoading, sendMessage, clearMessages } = useSearchChat();
  const { scrollY } = useScroll();

  const hasConversation = messages.length > 0;

  const overlayY = useTransform(scrollY, [0, 500], [0, 150]);
  const contentY = useTransform(scrollY, [0, 500], [0, 250]);
  const contentOpacity = useTransform(scrollY, [0, 400], [1, 0]);
  const scrollIndicatorOpacity = useTransform(scrollY, [0, 200], [1, 0]);

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
      <section
        className={`relative flex w-full flex-col items-center justify-center bg-cover bg-center transition-[height] duration-500 ${
          hasConversation ? "h-[50vh]" : "h-[calc(100vh-64px)]"
        } bg-scroll md:bg-fixed`}
        style={{
          backgroundImage: "url('/images/hero-bg.avif')",
        }}
      >
        <motion.div
          className="absolute inset-0 bg-black/30"
          style={{
            y: hasConversation ? 0 : overlayY,
            opacity: hasConversation ? 0.5 : 1,
          }}
        />

        <motion.div
          className="z-10"
          style={{
            y: hasConversation ? 0 : contentY,
            opacity: hasConversation ? 1 : contentOpacity,
          }}
        >
          <HeroSearch onSearch={handleSearch} />
        </motion.div>

        {!hasConversation && (
          <motion.div
            className="absolute bottom-8 left-0 right-0 z-10 flex animate-bounce justify-center"
            style={{ opacity: scrollIndicatorOpacity }}
          >
            <ChevronsDownIcon className="h-10 w-10 text-white/70 drop-shadow-lg" />
          </motion.div>
        )}
      </section>

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

      {!hasConversation && (
        <section className="relative z-10">
          <FeaturedReviews />
        </section>
      )}
    </div>
  );
}
