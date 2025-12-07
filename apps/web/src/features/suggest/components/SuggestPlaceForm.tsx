import { useState, useRef } from "react";
import { Input, Button } from "@mapvibe/ui-components";
import { X, Upload, Loader2 } from "lucide-react";
import toast, { Toaster } from "react-hot-toast";
import {
  FEATURES,
  PHOTO_TYPES,
  type SuggestPlaceFormData,
  type PhotoUploadItem,
  type PhotoType,
} from "../types";
import { useVietnamAddress } from "../hooks/useVietnamAddress";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/axios";

const MIN_REVIEW_LENGTH = 50;

const initialFormData: SuggestPlaceFormData = {
  name: "",
  phone: "",
  priceMin: 0,
  priceMax: 0,
  openTime: "",
  closeTime: "",
  city: "",
  ward: "",
  streetAddress: "",
  features: [],
  photos: [],
  review: "",
};

export function SuggestPlaceForm() {
  const { user } = useAuth();
  const [formData, setFormData] = useState<SuggestPlaceFormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRefs = useRef<Record<PhotoType, HTMLInputElement | null>>({
    food: null,
    view: null,
    menu: null,
    other: null,
  });

  const {
    provinces,
    wards,
    selectedProvince,
    selectProvince,
    loading: addressLoading,
  } = useVietnamAddress();

  const handleInputChange = (field: keyof SuggestPlaceFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleFeatureToggle = (featureId: string) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.includes(featureId)
        ? prev.features.filter((id) => id !== featureId)
        : [...prev.features, featureId],
    }));
  };

  const handleProvinceChange = (code: string) => {
    const province = provinces.find((p) => p.code === code);
    selectProvince(code);
    setFormData((prev) => ({
      ...prev,
      city: province?.name || "",
      ward: "",
    }));
  };

  const handleWardChange = (code: string) => {
    const ward = wards.find((w) => w.code === code);
    setFormData((prev) => ({
      ...prev,
      ward: ward?.name || "",
    }));
  };

  const handlePhotoUpload = (type: PhotoType, files: FileList | null) => {
    if (!files) return;

    const newPhotos: PhotoUploadItem[] = Array.from(files).map((file) => ({
      id: `${type}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
      preview: URL.createObjectURL(file),
      type,
    }));

    setFormData((prev) => ({
      ...prev,
      photos: [...prev.photos, ...newPhotos],
    }));
  };

  const handleRemovePhoto = (photoId: string) => {
    setFormData((prev) => {
      const photo = prev.photos.find((p) => p.id === photoId);
      if (photo) {
        URL.revokeObjectURL(photo.preview);
      }
      return {
        ...prev,
        photos: prev.photos.filter((p) => p.id !== photoId),
      };
    });
  };

  const getPhotosByType = (type: PhotoType) => {
    return formData.photos.filter((p) => p.type === type);
  };

  const uploadPhotoToS3 = async (
    photo: PhotoUploadItem
  ): Promise<{ photo_id: string; url: string; caption: string }> => {
    const uploadResponse = await apiClient.post<{
      photo_id: string;
      upload_url: string;
      cdn_url: string;
    }>("/photos/upload-url", {
      photo_type: photo.type,
      content_type: photo.file.type,
      file_size: photo.file.size,
    });

    const { photo_id, upload_url, cdn_url } = uploadResponse.data;

    await fetch(upload_url, {
      method: "PUT",
      body: photo.file,
      headers: { "Content-Type": photo.file.type },
    });

    return { photo_id, url: cdn_url, caption: "" };
  };

  const deleteUploadedPhotos = async (photoIds: string[]) => {
    await Promise.allSettled(
      photoIds.map((id) => apiClient.delete(`/photos/${id}`))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!user) {
      toast.error("Vui lòng đăng nhập để gửi địa điểm");
      return;
    }

    if (!formData.name.trim()) {
      toast.error("Vui lòng nhập tên địa điểm");
      return;
    }

    if (!formData.streetAddress.trim()) {
      toast.error("Vui lòng nhập địa chỉ");
      return;
    }

    if (formData.review.length < MIN_REVIEW_LENGTH) {
      toast.error(`Đánh giá phải có ít nhất ${MIN_REVIEW_LENGTH} ký tự`);
      return;
    }

    setSubmitting(true);
    const uploadedPhotoIds: string[] = [];

    try {
      // Upload all photos to S3 and track photo_ids
      const uploadedPhotos: { url: string; caption: string }[] = [];

      for (const photo of formData.photos) {
        const result = await uploadPhotoToS3(photo);
        uploadedPhotoIds.push(result.photo_id);
        uploadedPhotos.push({ url: result.url, caption: result.caption });
      }

      // Call API
      await apiClient.post("/reviews/submit-new-place", {
        author_id: user.sub,
        restaurant_name: formData.name,
        street_address: formData.streetAddress,
        ward: formData.ward,
        city: formData.city,
        text: formData.review,
        features: formData.features,
        photos: uploadedPhotos,
      });

      // Cleanup photo previews
      formData.photos.forEach((photo) => URL.revokeObjectURL(photo.preview));

      setSubmitSuccess(true);
      setFormData(initialFormData);
      toast.success("Gửi địa điểm thành công! Chúng tôi sẽ xem xét và phê duyệt sớm nhất.");
    } catch (error) {
      console.error("Submit failed:", error);

      // Cleanup uploaded photos on error
      if (uploadedPhotoIds.length > 0) {
        toast.loading("Đang dọn dẹp ảnh đã tải lên...", { id: "cleanup" });
        await deleteUploadedPhotos(uploadedPhotoIds);
        toast.dismiss("cleanup");
      }

      const err = error as { response?: { data?: { message?: string; error?: string } }; message?: string };
      const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message || "Có lỗi xảy ra, vui lòng thử lại";
      toast.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <>
        <Toaster position="top-center" />
        <div className="mx-auto max-w-4xl p-6 text-center">
          <div className="rounded-lg bg-green-50 p-8">
            <h2 className="text-xl font-bold text-green-800">Gửi địa điểm thành công!</h2>
            <p className="mt-2 text-green-600">Cảm ơn bạn đã chia sẻ địa điểm. Chúng tôi sẽ xem xét và phê duyệt sớm nhất.</p>
            <Button
              type="button"
              onClick={() => setSubmitSuccess(false)}
              className="mt-4 rounded-full bg-primary-500 px-8 py-2 text-white hover:bg-primary-600"
            >
              Gửi địa điểm khác
            </Button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Toaster position="top-center" />
      <form onSubmit={handleSubmit} className="mx-auto max-w-4xl space-y-6 p-6">
        <h1 className="text-center text-2xl font-bold uppercase tracking-wide">
          Hãy chia sẻ địa điểm yêu thích của bạn cùng với chúng tôi
        </h1>

        <Input
        label="Tên địa điểm"
        placeholder="Nhập tên quán ăn/uống tại đây ..."
        value={formData.name}
        onChange={(e) => handleInputChange("name", e.target.value)}
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Input
          label="Số điện thoại"
          placeholder="Nhập số điện thoại..."
          value={formData.phone}
          onChange={(e) => handleInputChange("phone", e.target.value)}
        />

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Khoảng giá</label>
          <div className="flex items-center gap-2">
            <Input
              placeholder="100.000"
              type="number"
              value={formData.priceMin || ""}
              onChange={(e) => handleInputChange("priceMin", Number(e.target.value))}
            />
            <span>-</span>
            <Input
              placeholder="300.000"
              type="number"
              value={formData.priceMax || ""}
              onChange={(e) => handleInputChange("priceMax", Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Giờ mở cửa</label>
          <div className="flex items-center gap-2">
            <Input
              type="time"
              value={formData.openTime}
              onChange={(e) => handleInputChange("openTime", e.target.value)}
            />
            <span>-</span>
            <Input
              type="time"
              value={formData.closeTime}
              onChange={(e) => handleInputChange("closeTime", e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Tỉnh/Thành phố</label>
          <select
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20"
            value={selectedProvince}
            onChange={(e) => handleProvinceChange(e.target.value)}
          >
            <option value="">Chọn tỉnh/thành phố</option>
            {provinces.map((province) => (
              <option key={province.code} value={province.code}>
                {province.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-gray-700">Phường/Xã</label>
          <select
            className="h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 disabled:bg-gray-100"
            value={wards.find((w) => w.name === formData.ward)?.code || ""}
            onChange={(e) => handleWardChange(e.target.value)}
            disabled={!selectedProvince || addressLoading}
          >
            <option value="">Chọn phường/xã</option>
            {wards.map((ward) => (
              <option key={ward.code} value={ward.code}>
                {ward.name}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Số nhà, đường"
          placeholder="Nhập số nhà, tên đường..."
          value={formData.streetAddress}
          onChange={(e) => handleInputChange("streetAddress", e.target.value)}
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-gray-700">Tiện ích</label>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 md:grid-cols-3 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <label key={feature.id} className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                checked={formData.features.includes(feature.id)}
                onChange={() => handleFeatureToggle(feature.id)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <span className="text-sm text-gray-700">{feature.label}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <label className="mb-4 block text-sm font-medium text-gray-700">Hình ảnh</label>
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {PHOTO_TYPES.map((photoType) => (
            <div key={photoType.id}>
              <label className="mb-2 block text-sm font-medium text-gray-600">
                {photoType.label}
              </label>
              <input
                ref={(el) => {
                  fileInputRefs.current[photoType.id] = el;
                }}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => handlePhotoUpload(photoType.id, e.target.files)}
              />
              <div
                onClick={() => fileInputRefs.current[photoType.id]?.click()}
                className="flex h-28 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-colors hover:border-primary-400 hover:bg-primary-50"
              >
                <Upload className="mb-1 h-6 w-6 text-gray-400" />
                <span className="text-xs text-gray-400">Tải ảnh lên</span>
              </div>
              {getPhotosByType(photoType.id).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {getPhotosByType(photoType.id).map((photo) => (
                    <div key={photo.id} className="group relative">
                      <img
                        src={photo.preview}
                        alt=""
                        className="h-16 w-16 rounded-md object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemovePhoto(photo.id)}
                        className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-sm font-medium text-gray-700">Đánh giá</label>
            <span className={`text-xs ${formData.review.length < MIN_REVIEW_LENGTH ? "text-red-500" : "text-gray-500"}`}>
              {formData.review.length}/{MIN_REVIEW_LENGTH} ký tự tối thiểu
            </span>
          </div>
          <textarea
            className={`min-h-32 w-full rounded-lg border bg-white px-3 py-2 text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 ${
              formData.review.length > 0 && formData.review.length < MIN_REVIEW_LENGTH
                ? "border-red-300 focus:border-red-500"
                : "border-gray-300 focus:border-primary-500"
            }`}
            placeholder="Hãy chia sẻ đánh giá của bạn tại đây (tối thiểu 50 ký tự)..."
            value={formData.review}
            onChange={(e) => handleInputChange("review", e.target.value)}
          />
        </div>

        <div className="flex justify-center">
          <Button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-primary-500 px-12 py-3 text-white hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Đang gửi...
              </span>
            ) : (
              "Đăng"
            )}
          </Button>
        </div>
      </form>
    </>
  );
}
