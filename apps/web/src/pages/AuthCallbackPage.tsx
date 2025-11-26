import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";

export const AuthCallbackPage = () => {
  const navigate = useNavigate();
  const { refreshAuth } = useAuth();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        const errorParam = params.get("error");

        if (errorParam) {
          throw new Error(errorParam);
        }

        if (!code) {
          throw new Error("Authorization code not found");
        }

        console.log("✅ OAuth callback success, code:", code);

        console.log("🔄 Refreshing auth state...");
        await refreshAuth();
        console.log("✅ Auth state refreshed");

        setSuccess(true);

        setTimeout(() => {
          navigate("/");
        }, 1000);
      } catch (err: any) {
        console.error("❌ OAuth callback error:", err);
        setError(err.message || "Đăng nhập thất bại");
        setTimeout(() => navigate("/"), 3000);
      }
    };

    handleCallback();
  }, [navigate, refreshAuth]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="rounded-lg bg-red-50 p-6 text-center">
          <h2 className="mb-2 text-xl font-bold text-red-600">Đăng nhập thất bại</h2>
          <p className="text-red-600">{error}</p>
          <p className="mt-4 text-sm text-gray-600">Đang chuyển về trang chủ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-gray-300 border-t-primary-600" />
        <p className="text-gray-600">
          {success ? "Đăng nhập thành công!" : "Đang xử lý đăng nhập..."}
        </p>
      </div>
    </div>
  );
};
