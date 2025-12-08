import { useState, useEffect } from "react";
import { Input, Button } from "@mapvibe/ui-components";
import { Loader2, Eye, EyeOff } from "lucide-react";
import { changePassword } from "@/lib/cognito";
import { apiClient } from "@/lib/axios";
import type { UserProfile, UpdateProfileData } from "../types";

interface PasswordInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  show: boolean;
  onToggleShow: () => void;
}

function PasswordInput({ label, value, onChange, placeholder, show, onToggleShow }: PasswordInputProps) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 pr-10 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="button"
          onClick={onToggleShow}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

interface ProfileFormProps {
  profile: UserProfile;
  onSave: (data: UpdateProfileData) => Promise<boolean>;
  saving: boolean;
  onToast?: (message: string, type: "success" | "error") => void;
  isOAuthUser?: boolean;
}

export function ProfileForm({ profile, onSave, saving, onToast, isOAuthUser }: ProfileFormProps) {
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    bio: "",
    phone: "",
    gender: "Khác",
  });

  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: "",
  });

  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });

  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        email: profile.email || "",
        bio: profile.bio || "",
        phone: profile.phone || "",
        gender: profile.gender || "Khác",
      });
    }
  }, [profile]);

  const handleSubmit = async () => {
    const updateData: UpdateProfileData = {};
    
    if (formData.display_name !== profile.display_name) {
      updateData.display_name = formData.display_name;
    }
    if (formData.bio !== profile.bio) {
      updateData.bio = formData.bio;
    }
    if (formData.phone !== profile.phone) {
      updateData.phone = formData.phone;
    }
    if (formData.gender !== profile.gender) {
      updateData.gender = formData.gender;
    }

    if (Object.keys(updateData).length === 0) {
      return;
    }

    await onSave(updateData);
  };

  const handleChangePassword = async () => {
    setPasswordError(null);

    // Validation for regular users (need current password)
    if (!isOAuthUser && !passwordData.current_password) {
      setPasswordError("Vui lòng nhập mật khẩu hiện tại");
      return;
    }

    if (!passwordData.new_password) {
      setPasswordError("Vui lòng nhập mật khẩu mới");
      return;
    }

    if (passwordData.new_password.length < 8) {
      setPasswordError("Mật khẩu mới phải có ít nhất 8 ký tự");
      return;
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(passwordData.new_password);
    const hasLowerCase = /[a-z]/.test(passwordData.new_password);
    const hasNumber = /[0-9]/.test(passwordData.new_password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      setPasswordError("Mật khẩu phải có chữ hoa, chữ thường và số");
      return;
    }

    if (passwordData.new_password !== passwordData.confirm_password) {
      setPasswordError("Mật khẩu xác nhận không khớp");
      return;
    }

    if (!isOAuthUser && passwordData.current_password === passwordData.new_password) {
      setPasswordError("Mật khẩu mới phải khác mật khẩu hiện tại");
      return;
    }

    try {
      setChangingPassword(true);

      if (isOAuthUser) {
        // OAuth user: Call API to set password (no current password needed)
        await apiClient.post("/users/me/set-password", {
          password: passwordData.new_password,
        });
        onToast?.("Tạo mật khẩu thành công! Giờ bạn có thể đăng nhập bằng email và mật khẩu.", "success");
      } else {
        // Regular user: Change password via Cognito
        await changePassword(passwordData.current_password, passwordData.new_password);
        onToast?.("Đổi mật khẩu thành công!", "success");
      }
      
      // Clear form on success
      setPasswordData({
        current_password: "",
        new_password: "",
        confirm_password: "",
      });
    } catch (err) {
      const error = err as { message?: string; name?: string; response?: { data?: { error?: string } } };
      
      // Handle API errors for OAuth users
      if (isOAuthUser) {
        const apiError = error.response?.data?.error || error.message;
        setPasswordError(apiError || "Có lỗi xảy ra khi tạo mật khẩu");
        return;
      }

      // Handle specific Cognito errors for regular users
      if (error.name === "NotAuthorizedException") {
        if (error.message?.includes("Incorrect username or password")) {
          setPasswordError("Mật khẩu hiện tại không đúng");
        } else {
          setPasswordError("Mật khẩu hiện tại không đúng");
        }
      } else if (error.name === "InvalidPasswordException") {
        setPasswordError("Mật khẩu mới không đủ mạnh. Cần có chữ hoa, chữ thường, số và ký tự đặc biệt");
      } else if (error.name === "LimitExceededException") {
        setPasswordError("Bạn đã thử quá nhiều lần. Vui lòng thử lại sau");
      } else {
        setPasswordError(error.message || "Có lỗi xảy ra khi đổi mật khẩu");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Profile Information Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Thông tin cá nhân</h3>
        <div className="grid gap-6 md:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-6">
            <Input
              label="Bio"
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              placeholder="Giới thiệu ngắn gọn về bạn"
            />
            <Input
              label="Tên hiển thị"
              value={formData.display_name}
              onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
              placeholder="Nhập tên hiển thị"
            />
            <Input
              label="Email"
              type="email"
              value={formData.email}
              disabled
              placeholder="Nhập email"
            />
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            <Input
              label="Số điện thoại"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              placeholder="Nhập số điện thoại (VD: 0912345678)"
            />
            <div className="space-y-2">
              <label className="block text-sm font-medium text-gray-700">Giới tính</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>
        </div>

        {/* Save Profile Button */}
        <div className="mt-6 flex justify-end">
          <Button
            onClick={handleSubmit}
            disabled={saving}
            className="bg-primary-500 text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang lưu...
              </span>
            ) : (
              "Lưu thông tin"
            )}
          </Button>
        </div>
      </div>

      {/* Divider */}
      <hr className="border-gray-200" />

      {/* Change Password Section */}
      <div>
        <h3 className="mb-4 text-lg font-semibold text-gray-900">
          {isOAuthUser ? "Tạo mật khẩu" : "Đổi mật khẩu"}
        </h3>
        {isOAuthUser && (
          <p className="mb-4 text-sm text-gray-600">
            Bạn đăng ký bằng Google. Tạo mật khẩu để có thể đăng nhập bằng email và mật khẩu.
          </p>
        )}
        <div className="max-w-md space-y-4">
          {!isOAuthUser && (
            <PasswordInput
              label="Mật khẩu hiện tại"
              value={passwordData.current_password}
              onChange={(value) => setPasswordData({ ...passwordData, current_password: value })}
              placeholder="Nhập mật khẩu hiện tại"
              show={showPasswords.current}
              onToggleShow={() => setShowPasswords({ ...showPasswords, current: !showPasswords.current })}
            />
          )}
          <PasswordInput
            label={isOAuthUser ? "Mật khẩu" : "Mật khẩu mới"}
            value={passwordData.new_password}
            onChange={(value) => setPasswordData({ ...passwordData, new_password: value })}
            placeholder="Nhập mật khẩu (ít nhất 8 ký tự, có chữ hoa, chữ thường, số)"
            show={showPasswords.new}
            onToggleShow={() => setShowPasswords({ ...showPasswords, new: !showPasswords.new })}
          />
          <PasswordInput
            label="Xác nhận mật khẩu"
            value={passwordData.confirm_password}
            onChange={(value) => setPasswordData({ ...passwordData, confirm_password: value })}
            placeholder="Nhập lại mật khẩu"
            show={showPasswords.confirm}
            onToggleShow={() => setShowPasswords({ ...showPasswords, confirm: !showPasswords.confirm })}
          />

          {passwordError && (
            <p className="text-sm text-red-600">{passwordError}</p>
          )}

          <div className="flex justify-end">
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || (!isOAuthUser && !passwordData.current_password) || !passwordData.new_password}
              className="bg-gray-800 text-white hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {changingPassword ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {isOAuthUser ? "Đang tạo..." : "Đang đổi..."}
                </span>
              ) : (
                isOAuthUser ? "Tạo mật khẩu" : "Đổi mật khẩu"
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
