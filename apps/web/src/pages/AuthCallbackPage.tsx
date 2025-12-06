import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "motion/react";
import { useAuth } from "@/contexts/AuthContext";

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("Đang xử lý đăng nhập...");
  const { isAuthenticated } = useAuth();
  const hasRedirected = useRef(false);

  // Handle OAuth error from URL params
  useEffect(() => {
    const error = searchParams.get("error");
    const errorDescription = searchParams.get("error_description");

    if (error && !hasRedirected.current) {
      hasRedirected.current = true;
      console.error("[Callback] OAuth error:", error, errorDescription);
      setStatus(`Đăng nhập thất bại: ${errorDescription || error}`);
      setTimeout(() => navigate("/", { replace: true }), 2000);
    }
  }, [searchParams, navigate]);

  // Redirect ngay khi authenticated (không cần chờ loading)
  useEffect(() => {
    if (hasRedirected.current) return;

    if (isAuthenticated) {
      hasRedirected.current = true;
      setStatus("Đăng nhập thành công!");
      setTimeout(() => navigate("/", { replace: true }), 500);
    }
  }, [isAuthenticated, navigate]);

  // Fallback timeout: nếu sau 10s vẫn chưa authenticated, redirect về home
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hasRedirected.current) {
        hasRedirected.current = true;
        console.log("[Callback] Timeout reached, redirecting to home");
        navigate("/", { replace: true });
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 to-amber-100">
      <div className="text-center">
        {/* Animated Food Icon */}
        <div className="relative mb-8 flex items-center justify-center">
          {/* Rotating location pins */}
          <motion.div
            className="absolute h-32 w-32"
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          >
            {[0, 60, 120, 180, 240, 300].map((deg, i) => (
              <motion.div
                key={i}
                className="absolute left-1/2 top-0 -ml-2 text-orange-400"
                style={{ transform: `rotate(${deg}deg) translateY(-8px)` }}
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  delay: i * 0.2,
                }}
              >
                <svg
                  className="h-4 w-4"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38
     0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"
                  />
                </svg>
              </motion.div>
            ))}
          </motion.div>

          {/* Center utensils icon with bounce */}
          <motion.div
            className="relative z-10 flex h-20 w-20 items-center justify-center rounded-full bg-white shadow-lg"
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.svg
              className="h-10 w-10 text-orange-500"
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

        {/* Brand name */}
        <motion.h1
          className="mb-4 text-2xl font-bold text-orange-600"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          MapVibe
        </motion.h1>

        {/* Status text with fade */}
        <motion.p
          key={status}
          className="text-gray-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {status}
        </motion.p>

        {/* Loading dots */}
        <div className="mt-4 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-orange-400"
              animate={{ y: [0, -8, 0] }}
              transition={{
                duration: 0.6,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};
