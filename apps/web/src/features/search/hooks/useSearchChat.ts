import { useState, useCallback } from "react";
import { Message, Restaurant } from "../components/ChatMessage";

// Mock RAG responses
const mockRAGResponses: Record<string, { message: string; restaurants: Restaurant[] }> = {
  default: {
    message: "Tôi tìm thấy một số địa điểm phù hợp với yêu cầu của bạn. Dưới đây là các gợi ý:",
    restaurants: [
      {
        id: 1,
        name: "Lẩu Manumon",
        address: "Tầng 2, Vincom Plaza, Lê Văn Việt, Q9",
        priceRange: "200.000đ - 300.000đ",
        hours: "11:00 AM - 10:00 PM",
        matchReason: "Phù hợp với tiêu chí của bạn",
      },
      {
        id: 2,
        name: "Kichi Kichi",
        address: "196 Đường Lê Văn Việt, Q9",
        priceRange: "150.000đ - 250.000đ",
        hours: "6:00 AM - 10:00 PM",
        matchReason: "Buffet đa dạng món",
      },
      {
        id: 3,
        name: "Nijyu Maru",
        address: "195 Đường Lê Văn Việt, Q9",
        priceRange: "100.000đ - 200.000đ",
        hours: "6:00 AM - 10:00 PM",
        matchReason: "Giá cả phải chăng",
      },
    ],
  },
  lau: {
    message:
      "Tôi tìm thấy 5 quán lẩu ngon ở khu vực bạn quan tâm. Các quán này đều có đánh giá cao và phù hợp với nhiều đối tượng:",
    restaurants: [
      {
        id: 1,
        name: "Lẩu Manumon",
        address: "Tầng 2, Vincom Plaza, Lê Văn Việt, Q9",
        priceRange: "200.000đ - 300.000đ",
        hours: "11:00 AM - 10:00 PM",
        matchReason: "Nước lẩu đậm đà, nhiều vị lựa chọn",
      },
      {
        id: 2,
        name: "Kichi Kichi Lê Văn Việt",
        address: "196 Đường Lê Văn Việt, Q9",
        priceRange: "159.000đ - 219.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Buffet lẩu băng chuyền 100+ món",
      },
      {
        id: 3,
        name: "Lẩu Đông Hương 5",
        address: "148 Đường Lê Văn Việt, Q9",
        priceRange: "150.000đ - 350.000đ",
        hours: "10:00 AM - 11:00 PM",
        matchReason: "Lẩu dê nổi tiếng",
      },
      {
        id: 4,
        name: "Hutong - Lẩu Hồng Kông",
        address: "Vincom Plaza Q9",
        priceRange: "200.000đ - 400.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Lẩu Hồng Kông authentic",
      },
      {
        id: 5,
        name: "Lẩu gà lá é",
        address: "200 Lê Văn Việt, Q9",
        priceRange: "100.000đ - 200.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Lẩu gà đặc sản Đà Lạt",
      },
    ],
  },
  buffet: {
    message: "Trong các quán tôi đề xuất, có 2 quán có buffet:",
    restaurants: [
      {
        id: 2,
        name: "Kichi Kichi Lê Văn Việt",
        address: "196 Đường Lê Văn Việt, Q9",
        priceRange: "159.000đ - 219.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Buffet lẩu băng chuyền với 100+ món",
      },
      {
        id: 4,
        name: "Hutong - Hotpot Paradise",
        address: "Vincom Plaza Q9",
        priceRange: "239.000đ - 339.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Buffet lẩu Hồng Kông cao cấp",
      },
    ],
  },
  re: {
    message: "Nếu bạn muốn tìm quán giá rẻ, đây là những lựa chọn dưới 150.000đ/người:",
    restaurants: [
      {
        id: 5,
        name: "Lẩu gà lá é",
        address: "200 Lê Văn Việt, Q9",
        priceRange: "100.000đ - 150.000đ",
        hours: "10:00 AM - 10:00 PM",
        matchReason: "Giá sinh viên, set 2 người chỉ 200k",
      },
      {
        id: 3,
        name: "Lẩu Đông Hương 5",
        address: "148 Đường Lê Văn Việt, Q9",
        priceRange: "80.000đ - 150.000đ",
        hours: "10:00 AM - 11:00 PM",
        matchReason: "Lẩu dê bình dân, đông khách",
      },
    ],
  },
};

export function useSearchChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Build accumulated context from all user messages
  const buildSearchContext = useCallback((currentMessages: Message[], newContent: string) => {
    const previousQueries = currentMessages.filter((m) => m.role === "user").map((m) => m.content);

    return [...previousQueries, newContent].join(" | ");
  }, []);

  const sendMessage = useCallback(
    async (content: string) => {
      // Add user message
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content,
        timestamp: new Date(),
      };

      // Build accumulated search context
      const searchContext = buildSearchContext(messages, content);
      console.log("Search context:", searchContext); // For debugging

      setMessages((prev) => [...prev, userMessage]);

      // Simulate API call
      setIsLoading(true);

      // Fake delay for realistic feel
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

      // Get mock response based on accumulated context keywords
      const lowerContext = searchContext.toLowerCase();
      let response = mockRAGResponses.default;

      // Check accumulated context for better results
      if (lowerContext.includes("lẩu") || lowerContext.includes("lau")) {
        response = mockRAGResponses.lau;
      }
      if (lowerContext.includes("buffet")) {
        response = mockRAGResponses.buffet;
      }
      if (
        lowerContext.includes("rẻ") ||
        lowerContext.includes("re") ||
        lowerContext.includes("giá")
      ) {
        response = mockRAGResponses.re;
      }

      // // THAY ĐỔI: Gọi API thật thay vì mock
      // const response = await fetch('/api/search', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ query: searchContext })  // Gửi context tích lũy
      // });
      // const data = await response.json();

      // const aiMessage: Message = {
      //   id: `ai-${Date.now()}`,
      //   role: "assistant",
      //   content: data.message,
      //   restaurants: data.restaurants,
      //   timestamp: new Date(),
      // };

      // Add AI response
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: response.message,
        restaurants: response.restaurants,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiMessage]);

      setIsLoading(false);
    },
    [messages, buildSearchContext]
  );

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return {
    messages,
    isLoading,
    sendMessage,
    clearMessages,
  };
}
