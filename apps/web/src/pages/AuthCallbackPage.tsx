import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * OAuth Callback Page
 *
 * Amplify automatically handles OAuth callback and exchanges code for tokens.
 * This page shows a loading state and redirects to home after 3 seconds.
 */
export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    // Countdown
    const timer = setInterval(() => {
      setCountdown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    // Redirect after 3 seconds
    const redirectTimer = setTimeout(() => {
      navigate("/");
    }, 3000);

    return () => {
      clearInterval(timer);
      clearTimeout(redirectTimer);
    };
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="mx-auto mb-6 h-16 w-16 animate-spin rounded-full border-4 border-gray-300 border-t-primary-600" />
        <h2 className="mb-2 text-xl font-semibold text-gray-800">
          Đang xử lý đăng nhập...
        </h2>
        <p className="text-sm text-gray-600">
          Vui lòng đợi trong giây lát
        </p>
        <p className="mt-4 text-xs text-gray-500">
          Chuyển về trang chủ sau {countdown}s
        </p>
      </div>
    </div>
  );
};
