import { createContext, useContext, useState, useCallback, useRef, ReactNode } from "react";
import { Message } from "../components/ChatMessage";
import apiClient, { createCancelToken, retryRequest } from "@/lib/axios";
import axios from "axios";


// Generate unique session ID
const generateSessionId = () => `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

interface SearchContextType {
  messages: Message[];
  isLoading: boolean;
  sendMessage: (content: string) => Promise<void>;
  clearMessages: () => void;
}

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const sessionIdRef = useRef<string>(generateSessionId());
  const cancelTokenRef = useRef<{ cancel: () => void } | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Determine if this is a new topic (first message in conversation)
      const isNewTopic = messages.length === 0;

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel();
      }

      const { signal, cancel } = createCancelToken();
      cancelTokenRef.current = { cancel };

      try {
        const { data } = await retryRequest(
          () =>
            apiClient.post(
              "/search",
              {
                session_id: sessionIdRef.current,
                query: content,
                is_new_topic: isNewTopic,
              },
              { signal, timeout: 40000 }
            ),
          3,
          10000
        );

        // Add AI response
        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: data.answer || "Đã tìm thấy kết quả cho bạn:",
          restaurants: data.restaurants || [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        if (axios.isCancel(error)) {
          console.log("Request cancelled");
          return;
        }

        console.error("Search API error", error);

        const aiMessage: Message = {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: "Xin lỗi, không thể tìm thấy quán theo yêu cầu của bạn. Vui lòng thử lại sau.",
          restaurants: [],
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, aiMessage]);
      }

      setIsLoading(false);
    },
    [messages]
  );

  const clearMessages = useCallback(() => {
    if (cancelTokenRef.current) {
      cancelTokenRef.current.cancel();
    }

    setMessages([]);
    sessionIdRef.current = generateSessionId(); // New session on reset
  }, []);

  return (
    <SearchContext.Provider value={{ messages, isLoading, sendMessage, clearMessages }}>
      {children}
    </SearchContext.Provider>
  );
}

export function useSearchContext() {
  const context = useContext(SearchContext);
  if (context === undefined) {
    throw new Error("useSearchContext must be used within a SearchProvider");
  }
  return context;
}
