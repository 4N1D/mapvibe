import React from "react";
import { cn } from "../utils";

export interface RatingProps {
  value: number;
  maxRating?: number;
  onChange?: (value: number) => void;
  readOnly?: boolean;
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const Rating = React.forwardRef<HTMLDivElement, RatingProps>(
  (
    {
      value,
      maxRating = 5,
      onChange,
      readOnly = false,
      className,
      size = "md",
    },
    ref
  ) => {
    const [hoverValue, setHoverValue] = React.useState<number | null>(null);

    const handleClick = (rating: number) => {
      if (!readOnly && onChange) {
        onChange(rating);
      }
    };

    const sizeValues = {
      sm: 16,
      md: 24,
      lg: 32,
    };

    return (
      <div ref={ref} className={cn("flex gap-1", className)}>
        {Array.from({ length: maxRating }, (_, index) => {
          const rating = index + 1;
          const isFilled = rating <= (hoverValue ?? value);

          return (
            <button
              key={rating}
              type="button"
              onClick={() => handleClick(rating)}
              onMouseEnter={() => !readOnly && setHoverValue(rating)}
              onMouseLeave={() => !readOnly && setHoverValue(null)}
              disabled={readOnly}
              className={cn(
                "transition-colors",
                !readOnly && "cursor-pointer hover:scale-110",
                readOnly && "cursor-default"
              )}
              aria-label={`Rate ${rating} out of ${maxRating}`}
            >
              <svg
                className="transition-colors"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                width={sizeValues[size]}
                height={sizeValues[size]}
                fill={isFilled ? "#fbbf24" : "#e5e7eb"}
                stroke={isFilled ? "#fbbf24" : "#d1d5db"}
                strokeWidth="1"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204
  3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0
  01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
                />
              </svg>
            </button>
          );
        })}
      </div>
    );
  }
);

Rating.displayName = "Rating";
