import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { MapVibeLoader } from "@/components/common/MapVibeLoader";

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
      <MapVibeLoader size="lg" text={status} showBrand />
    </div>
  );
};
