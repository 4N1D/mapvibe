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

      // Determine if this is a new topic:
      // - true: first message in conversation or after reset (to start new context)
      // - false: continuing conversation (to preserve context)
      const isNewTopic = messages.length === 0;

      setMessages((prev) => [...prev, userMessage]);
      setIsLoading(true);

      if (cancelTokenRef.current) {
        cancelTokenRef.current.cancel();
      }

      const { signal, cancel } = createCancelToken();
      cancelTokenRef.current = { cancel };

      try {
        // Call real API endpoint (no mock search)
        const { data } = await retryRequest(
          () =>
            apiClient.post(
              "/search",
              {
                session_id: sessionIdRef.current,
                query: content,
                is_new_topic: isNewTopic,
              },
              { signal, timeout: 20000 }
            ),
          3,
          3000
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
          content: "Xin lỗi, hiện tại tôi không tìm thấy địa điểm mà bạn yêu cầu.",
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

    // Reset messages and generate new session ID
    // Next message will have is_new_topic = true (new conversation)
    setMessages([]);
    sessionIdRef.current = generateSessionId();
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
