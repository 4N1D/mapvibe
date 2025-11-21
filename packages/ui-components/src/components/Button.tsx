import React from "react";
import { cn } from "../utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "login" | "secondary" | "danger" | "ghost";
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-2xl font-medium transition-colors",
          "focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none",
          "w-fit disabled:pointer-events-none disabled:opacity-50",

          // Variants
          variant === "login" &&
            "focus-visible:ring-primary-500 border-2 border-transparent text-black hover:border-black hover:bg-gray-100 focus-visible:ring-2 focus-visible:ring-offset-2",
          variant === "secondary" &&
            "bg-gray-200 text-gray-900 hover:bg-gray-300 focus-visible:ring-gray-400",
          variant === "danger" &&
            "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600",
          variant === "ghost" && "text-black hover:bg-gray-100 focus-visible:ring-gray-400",

          // Sizes
          size === "sm" && "h-9 px-3 text-sm",
          size === "md" && "h-10 px-4 text-base",
          size === "lg" && "h-11 px-6 text-lg",

          className
        )}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
