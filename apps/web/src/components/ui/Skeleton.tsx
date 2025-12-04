interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

export function Skeleton({ className = "", style }: SkeletonProps) {
  return (
    <div
      className={`animate-pulse rounded-md bg-gray-200 ${className}`}
      style={style}
    />
  );
}

interface SkeletonTextProps {
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}

export function SkeletonText({
  lines = 1,
  className = "",
  lastLineWidth = "w-3/4",
}: SkeletonTextProps) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={`h-4 ${i === lines - 1 && lines > 1 ? lastLineWidth : "w-full"}`}
        />
      ))}
    </div>
  );
}

interface SkeletonCircleProps {
  size?: number;
  className?: string;
}

export function SkeletonCircle({ size = 40, className = "" }: SkeletonCircleProps) {
  return (
    <Skeleton
      className={`rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}
