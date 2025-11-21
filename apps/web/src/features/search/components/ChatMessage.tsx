import { Bot, User } from "lucide-react";
import { Card, CardContent } from "@mapvibe/ui-components";

export interface Restaurant {
  id: number;
  name: string;
  address: string;
  priceRange: string;
  hours: string;
  image?: string;
  matchReason?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  restaurants?: Restaurant[];
  timestamp: Date;
}

interface ChatMessageProps {
  message: Message;
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${
          isUser ? "bg-primary-500" : "bg-gray-800"
        }`}
      >
        {isUser ? <User className="h-4 w-4 text-white" /> : <Bot className="h-4 w-4 text-white" />}
      </div>

      {/* Content */}
      <div className={`flex-1 ${isUser ? "text-right" : "text-left"}`}>
        <div
          className={`inline-block rounded-2xl px-4 py-3 ${
            isUser ? "bg-primary-500 text-white" : "bg-gray-100 text-gray-900"
          }`}
        >
          <p className="whitespace-pre-wrap text-sm">{message.content}</p>
        </div>

        {/* Restaurant Results */}
        {message.restaurants && message.restaurants.length > 0 && (
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {message.restaurants.map((restaurant) => (
              <Card
                key={restaurant.id}
                className="cursor-pointer text-left transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                {/* Image placeholder */}
                <div className="h-32 overflow-hidden rounded-t-lg bg-gray-200">
                  <div className="flex h-full w-full items-center justify-center text-gray-400">
                    <svg
                      className="h-8 w-8"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1}
                        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                  </div>
                </div>

                <CardContent className="space-y-1 p-3">
                  <h4 className="text-sm font-semibold text-gray-900">{restaurant.name}</h4>
                  <p className="line-clamp-1 text-xs text-gray-600">{restaurant.address}</p>
                  <p className="text-xs font-medium text-accent-500">{restaurant.priceRange}</p>
                  <p className="text-xs text-secondary-600">{restaurant.hours}</p>
                  {restaurant.matchReason && (
                    <p className="mt-2 text-xs italic text-primary-600">
                      "{restaurant.matchReason}"
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <p className="mt-1 text-xs text-gray-400">
          {message.timestamp.toLocaleTimeString("vi-VN", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </div>
    </div>
  );
}
