import { useState } from "react";
import { Button, Input } from "@mapvibe/ui-components";
import { ArrowLeft, Eye, EyeOff } from "lucide-react";
import toast from "react-hot-toast";
import { forgotPassword, confirmForgotPassword } from "@/lib/cognito";

interface ForgotPasswordFormProps {
  onSuccess: () => void;
  onBack: () => void;
}

type Step = "email" | "reset";

export const ForgotPasswordForm = ({ onSuccess, onBack }: ForgotPasswordFormProps) => {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [deliveryInfo, setDeliveryInfo] = useState<string>("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      console.log("[ForgotPassword] Sending code to:", email);
      const result = await forgotPassword(email);
      console.log("[ForgotPassword] Result:", result);

      // Extract delivery info if available
      if (result.codeDeliveryDetails) {
        const details = result.codeDeliveryDetails as {
          destination?: string;
          deliveryMedium?: string;
          attributeName?: string;
        };
        if (details.destination) {
          setDeliveryInfo(details.destination);
        }
      }
      setStep("reset");
    } catch (err: unknown) {
      console.error("[ForgotPassword] Error:", err);
      const error = err as { message?: string; name?: string };
      if (error.name === "UserNotFoundException") {
        setError("Email không tồn tại trong hệ thống");
      } else if (error.name === "LimitExceededException") {
        setError(
          "Bạn đã yêu cầu quá nhiều lần. Vui lòng kiểm tra email (kể cả Spam/Junk) hoặc đợi 15-30 phút rồi thử lại."
        );
      } else if (error.name === "InvalidParameterException") {
        setError("Email chưa được xác thực. Vui lòng đăng ký lại hoặc liên hệ hỗ trợ.");
      } else {
        setError(error.message || "Có lỗi xảy ra. Vui lòng thử lại");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (newPassword.length < 8) {
      setError("Mật khẩu phải có ít nhất 8 ký tự");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp");
      return;
    }

    setLoading(true);

    try {
      await confirmForgotPassword(email, code, newPassword);
      onSuccess();
    } catch (err: unknown) {
      const error = err as { message?: string; name?: string };
      if (error.name === "CodeMismatchException") {
        setError("Mã xác nhận không đúng");
      } else if (error.name === "ExpiredCodeException") {
        setError("Mã xác nhận đã hết hạn. Vui lòng yêu cầu mã mới");
      } else if (error.name === "InvalidPasswordException") {
        setError("Mật khẩu không đủ mạnh. Cần có chữ hoa, chữ thường và số");
      } else if (error.name === "LimitExceededException") {
        setError("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau");
      } else {
        setError(error.message || "Có lỗi xảy ra. Vui lòng thử lại");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setError(""); // Clear any previous error
      toast.success("Đã gửi lại mã xác nhận về email của bạn");
    } catch (err: unknown) {
      const error = err as { message?: string };
      setError(error.message || "Không thể gửi lại mã. Vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  if (step === "email") {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="h-4 w-4" />
          Quay lại đăng nhập
        </button>

        <div className="space-y-2 text-sm text-gray-600">
          <p>Nhập email của bạn và chúng tôi sẽ gửi mã xác nhận để đặt lại mật khẩu.</p>
          <p className="rounded bg-yellow-50 p-2 text-xs text-yellow-700">
            <strong>Lưu ý:</strong> Email có thể vào thư mục Spam/Junk. Vui lòng kiểm tra trước khi
            nhấn gửi lại.
          </p>
        </div>

        {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <form
          onSubmit={handleSendCode}
          className="space-y-4"
        >
          <Input
            label="Email"
            type="email"
            placeholder="example@gmail.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <Button
            type="submit"
            variant="login"
            className="w-full"
            disabled={loading || !email}
          >
            {loading ? "Đang gửi..." : "Gửi mã xác nhận"}
          </Button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={() => setStep("email")}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="h-4 w-4" />
        Quay lại
      </button>

      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
        <p>
          Mã xác nhận đã được gửi đến <span className="font-medium">{deliveryInfo || email}</span>
        </p>
        <p className="mt-1 text-xs text-blue-600">
          Lưu ý: Email có thể mất 1-2 phút để đến. Vui lòng kiểm tra cả thư mục Spam/Junk.
        </p>
      </div>

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <form
        onSubmit={handleResetPassword}
        className="space-y-4"
      >
        <Input
          label="Mã xác nhận"
          type="text"
          placeholder="Nhập mã 6 số"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          required
        />

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Mật khẩu mới</label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Ít nhất 8 ký tự"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium text-gray-700">Xác nhận mật khẩu</label>
          <div className="relative">
            <input
              type={showConfirmPassword ? "text" : "password"}
              placeholder="Nhập lại mật khẩu"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          variant="login"
          className="w-full"
          disabled={loading || !code || !newPassword || !confirmPassword}
        >
          {loading ? "Đang xử lý..." : "Đặt lại mật khẩu"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Không nhận được mã?{" "}
        <button
          type="button"
          onClick={handleResendCode}
          disabled={loading}
          className="font-medium text-primary-600 hover:underline disabled:opacity-50"
        >
          Gửi lại
        </button>
      </p>
    </div>
  );
};
