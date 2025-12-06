import { motion } from "motion/react";
import { TrendingUp } from "lucide-react";
import { ReactNode } from "react";

interface MapVibeLoaderProps {
  /** Text hiển thị dưới loader */
  text?: string;
  /** Icon ở giữa (default: TrendingUp) */
  centerIcon?: ReactNode;
  /** Size: sm (section), md (default), lg (full page) */
  size?: "sm" | "md" | "lg";
}

const sizeConfig = {
  sm: {
    container: "py-8",
    orbit: "h-16 w-16",
    center: "h-10 w-10",
    centerIcon: "h-5 w-5",
    pin: "h-2.5 w-2.5",
    dots: "h-1.5 w-1.5",
    text: "text-xs",
  },
  md: {
    container: "py-12",
    orbit: "h-20 w-20",
    center: "h-12 w-12",
    centerIcon: "h-6 w-6",
    pin: "h-3 w-3",
    dots: "h-2 w-2",
    text: "text-sm",
  },
  lg: {
    container: "py-16 min-h-[50vh]",
    orbit: "h-32 w-32",
    center: "h-20 w-20",
    centerIcon: "h-10 w-10",
    pin: "h-4 w-4",
    dots: "h-2.5 w-2.5",
    text: "text-base",
  },
};

export function MapVibeLoader({
  text = "Đang tải...",
  centerIcon,
  size = "md",
}: MapVibeLoaderProps) {
  const config = sizeConfig[size];

  return (
    <div className={`flex flex-col items-center justify-center ${config.container}`}>
      <div className="relative mb-6 flex items-center justify-center">
        <motion.div
          className={`absolute ${config.orbit}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          {[0, 72, 144, 216, 288].map((deg, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-0 -ml-1.5 text-orange-400"
              style={{ transform: `rotate(${deg}deg) translateY(-4px)` }}
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.2 }}
            >
              <svg className={config.pin} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          className={`relative z-10 flex items-center justify-center rounded-full bg-white shadow-md ${config.center}`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          {centerIcon || <TrendingUp className={`text-orange-500 ${config.centerIcon}`} />}
        </motion.div>
      </div>

      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`rounded-full bg-orange-400 ${config.dots}`}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 0.5, repeat: Infinity, delay: i * 0.12 }}
          />
        ))}
      </div>

      {text && <p className={`mt-3 text-gray-500 ${config.text}`}>{text}</p>}
    </div>
  );
}

export type { MapVibeLoaderProps };
