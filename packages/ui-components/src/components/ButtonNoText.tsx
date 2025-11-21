import React from "react";
import { cn } from "../utils";
import { ArrowUp } from "lucide-react";

export interface SendButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: "sm" | "md" | "lg";
}

export const SendButton = React.forwardRef<HTMLButtonElement, SendButtonProps>(
  ({ className, size = "md", disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-full transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "disabled:pointer-events-none",

          // Colors
          disabled
            ? "bg-gray-300 text-gray-500"
            : "bg-black text-white hover:bg-gray-800 focus-visible:ring-gray-600",

          // Sizes
          size === "sm" && "h-8 w-8",
          size === "md" && "h-10 w-10",
          size === "lg" && "h-12 w-12",

          className
        )}
        {...props}
      >
        <ArrowUp
          className={cn(
            size === "sm" && "h-4 w-4",
            size === "md" && "h-5 w-5",
            size === "lg" && "h-6 w-6"
          )}
        />
      </button>
    );
  }
);

SendButton.displayName = "SendButton";
