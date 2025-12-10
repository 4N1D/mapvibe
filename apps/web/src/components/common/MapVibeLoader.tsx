import { motion } from "motion/react";

interface MapVibeLoaderProps {
  size?: "sm" | "md" | "lg";
  text?: string;
  showBrand?: boolean;
}

export function MapVibeLoader({ size = "md", text, showBrand = false }: MapVibeLoaderProps) {
  const sizeConfig = {
    sm: {
      container: "h-16 w-16",
      center: "h-10 w-10",
      centerIcon: "h-5 w-5",
      pinSize: "h-2.5 w-2.5",
      dots: "h-1.5 w-1.5",
      text: "text-xs",
      brand: "text-base",
    },
    md: {
      container: "h-24 w-24",
      center: "h-14 w-14",
      centerIcon: "h-7 w-7",
      pinSize: "h-3 w-3",
      dots: "h-2 w-2",
      text: "text-sm",
      brand: "text-xl",
    },
    lg: {
      container: "h-32 w-32",
      center: "h-20 w-20",
      centerIcon: "h-10 w-10",
      pinSize: "h-4 w-4",
      dots: "h-2 w-2",
      text: "text-base",
      brand: "text-2xl",
    },
  };

  const config = sizeConfig[size];

  return (
    <div className="text-center">
      {/* Animated Icon */}
      <div className="relative mb-6 flex items-center justify-center">
        {/* Rotating location pins */}
        <motion.div
          className={`absolute ${config.container}`}
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
        >
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <motion.div
              key={i}
              className="absolute left-1/2 top-0 -ml-1.5 text-primary-400"
              style={{ transform: `rotate(${deg}deg) translateY(-8px)` }}
              animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.2,
              }}
            >
              <svg className={config.pinSize} fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
              </svg>
            </motion.div>
          ))}
        </motion.div>

        {/* Center utensils icon with bounce */}
        <motion.div
          className={`relative z-10 flex ${config.center} items-center justify-center rounded-full bg-white shadow-lg`}
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        >
          <motion.svg
            className={`${config.centerIcon} text-primary-500`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Fork */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 3v4m0 0v10a2 2 0 002 2h0a2 2 0 002-2v-4M7 7h4m-4 0H5m6 0v3a2 2 0 01-2 2H7"
            />
            {/* Knife */}
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M17 3v18m0-18c1.5 0 3 1.5 3 4s-1.5 4-3 4"
            />
          </motion.svg>
        </motion.div>
      </div>

      {/* Brand name (optional) */}
      {showBrand && (
        <motion.h1
          className={`mb-3 font-bold text-primary-600 ${config.brand}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          MapVibe
        </motion.h1>
      )}

      {/* Status text */}
      {text && (
        <motion.p
          className={`text-gray-600 ${config.text}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {text}
        </motion.p>
      )}

      {/* Loading dots */}
      <div className="mt-3 flex justify-center gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className={`rounded-full bg-primary-400 ${config.dots}`}
            animate={{ y: [0, -6, 0] }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.15,
            }}
          />
        ))}
      </div>
    </div>
  );
}
