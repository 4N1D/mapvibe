import { useState } from "react";
import { Button, Input } from "@mapvibe/ui-components";
import { useAuth } from "@/contexts/AuthContext";

interface ConfirmFormProps {
  email: string;
  onSuccess: () => void;
  onBack: () => void;
}

export const ConfirmForm = ({ email, onSuccess, onBack }: ConfirmFormProps) => {
  const { confirmSignUp } = useAuth();
  const [confirmationCode, setConfirmationCode] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      await confirmSignUp(email, confirmationCode);
      setSuccess("Xác nhận thành công! Bạn có thể đăng nhập ngay bây giờ.");
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: any) {
      setError(err.message || "Mã xác nhận không đúng");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Chúng tôi đã gửi mã xác nhận đến email <span className="font-semibold">{email}</span>. Vui
        lòng kiểm tra hộp thư (kể cả spam).
      </p>

      {success && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-600">{success}</div>
      )}

      {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <Input
          label="Mã xác nhận"
          type="text"
          placeholder="123456"
          value={confirmationCode}
          onChange={(e) => setConfirmationCode(e.target.value)}
          required
          maxLength={6}
        />

        <Button
          type="submit"
          variant="login"
          className="w-full"
          disabled={loading}
        >
          {loading ? "Đang xác nhận..." : "Xác nhận"}
        </Button>
      </form>

      <p className="text-center text-sm text-gray-600">
        Chưa nhận được mã?{" "}
        <button
          type="button"
          onClick={() => {
            // TODO: Resend code
            alert("Tính năng gửi lại mã đang được phát triển");
          }}
          className="font-medium text-primary-600 hover:underline"
        >
          Gửi lại
        </button>
      </p>

      <p className="text-center text-sm text-gray-600">
        <button
          type="button"
          onClick={onBack}
          className="font-medium text-primary-600 hover:underline"
        >
          ← Quay lại đăng nhập
        </button>
      </p>
    </div>
  );
};
