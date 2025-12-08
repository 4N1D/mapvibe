import { useState } from "react";
import { X } from "lucide-react";
import toast from "react-hot-toast";
import { LoginForm } from "./LoginForm";
import { SignUpForm } from "./SignUpForm";
import { ConfirmForm } from "./ConfirmForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ModalMode = "login" | "signup" | "confirm" | "forgot";

export const LoginModal = ({ isOpen, onClose }: LoginModalProps) => {
  const [mode, setMode] = useState<ModalMode>("login");
  const [email, setEmail] = useState("");

  if (!isOpen) return null;

  const handleClose = () => {
    onClose();
    // Reset state after a short delay to avoid UI flickering while closing
    setTimeout(() => {
      setMode("login");
      setEmail("");
    }, 300);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="animate-in fade-in zoom-in fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl duration-200">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute right-4 top-4 rounded-lg p-1 hover:bg-gray-100"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Title */}
        <h2 className="mb-6 text-center text-2xl font-bold">
          {mode === "login" && "Đăng nhập"}
          {mode === "signup" && "Đăng ký"}
          {mode === "confirm" && "Xác nhận Email"}
          {mode === "forgot" && "Quên mật khẩu"}
        </h2>

        {/* Forms */}
        {mode === "login" && (
          <>
            <LoginForm
              onSuccess={handleClose}
              onForgotPassword={() => setMode("forgot")}
            />
            <p className="mt-6 text-center text-sm text-gray-600">
              Chưa có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setMode("signup")}
                className="font-medium text-primary-600 hover:underline"
              >
                Đăng ký ngay
              </button>
            </p>
          </>
        )}

        {mode === "signup" && (
          <>
            <SignUpForm
              onSuccess={(email) => {
                setEmail(email);
                setMode("confirm");
              }}
            />
            <p className="mt-6 text-center text-sm text-gray-600">
              Đã có tài khoản?{" "}
              <button
                type="button"
                onClick={() => setMode("login")}
                className="font-medium text-primary-600 hover:underline"
              >
                Đăng nhập
              </button>
            </p>
          </>
        )}

        {mode === "confirm" && (
          <ConfirmForm
            email={email}
            onSuccess={() => setMode("login")}
            onBack={() => setMode("login")}
          />
        )}

        {mode === "forgot" && (
          <ForgotPasswordForm
            onSuccess={() => {
              toast.success("Đặt lại mật khẩu thành công! Vui lòng đăng nhập.");
              setMode("login");
            }}
            onBack={() => setMode("login")}
          />
        )}
      </div>
    </>
  );
};
