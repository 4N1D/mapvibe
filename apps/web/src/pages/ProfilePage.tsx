import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useProfile,
  useProfileStats,
  useUserPhotos,
  useUserReviews,
  useUserSaved,
  useAvatarUpload,
  useBackgroundUpload,
  ProfileBanner,
  ProfileForm,
  PhotoGallery,
  ReviewList,
  SavedList,
  ProfileSidebar,
  Toast,
  type ToastData,
  type ProfileMenuItem,
} from "@/features/profile";

export function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading, updateUserAvatar, user } = useAuth();

  // Profile hooks
  const {
    profile,
    loading: profileLoading,
    updateProfile,
    updating,
    setAvatarUrl,
    setBackgroundUrl,
  } = useProfile();
  const { stats } = useProfileStats();
  const { photos, loading: photosLoading, error: photosError } = useUserPhotos();
  const {
    reviews,
    loading: reviewsLoading,
    error: reviewsError,
    hasMore: hasMoreReviews,
    loadMore: loadMoreReviews,
  } = useUserReviews();
  const {
    saved,
    loading: savedLoading,
    error: savedError,
    hasMore: hasMoreSaved,
    loadMore: loadMoreSaved,
  } = useUserSaved();

  // UI state
  const [activeMenu, setActiveMenu] = useState<ProfileMenuItem>("thong-tin");
  const [toast, setToast] = useState<ToastData | null>(null);
  const [avatarSuccessAnimation, setAvatarSuccessAnimation] = useState(false);

  // Avatar upload
  const {
    preview: avatarPreview,
    uploading: isUploadingAvatar,
    uploadAvatar,
    fileInputRef: avatarInputRef,
    triggerFileSelect: triggerAvatarSelect,
  } = useAvatarUpload((cdnUrl) => {
    // Update profile avatar directly without refetching (smooth UX)
    setAvatarUrl(cdnUrl);
    // Also update AuthContext so Header shows new avatar immediately
    updateUserAvatar(cdnUrl);
    setAvatarSuccessAnimation(true);
    setTimeout(() => setAvatarSuccessAnimation(false), 2000);
    showToast("Đã cập nhật ảnh đại diện thành công!", "success");
  });

  // Background upload
  const {
    preview: backgroundPreview,
    uploading: isUploadingBackground,
    uploadBackground,
    fileInputRef: backgroundInputRef,
    triggerFileSelect: triggerBackgroundSelect,
  } = useBackgroundUpload((cdnUrl) => {
    // Update profile background directly without refetching (smooth UX)
    setBackgroundUrl(cdnUrl);
    showToast("Đã cập nhật ảnh nền thành công!", "success");
  });

  // Toast helper
  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Handle avatar file change
  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadAvatar(file);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  // Handle background file change
  const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      await uploadBackground(file);
    } catch (err) {
      showToast((err as Error).message, "error");
    }
  };

  // Handle save profile
  const handleSaveProfile = async (data: Parameters<typeof updateProfile>[0]) => {
    try {
      await updateProfile(data);
      showToast("Đã lưu thay đổi thành công!", "success");
      return true;
    } catch (err) {
      showToast((err as Error).message, "error");
      return false;
    }
  };

  // Loading state
  if (authLoading || profileLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent"></div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  // Render content based on active menu
  const renderContent = () => {
    switch (activeMenu) {
      case "thong-tin":
        return (
          <ProfileForm
            profile={profile}
            onSave={handleSaveProfile}
            saving={updating}
            onToast={showToast}
            isOAuthUser={user?.isOAuthUser}
          />
        );

      case "anh":
        return (
          <PhotoGallery
            photos={photos}
            loading={photosLoading}
            error={photosError}
          />
        );

      case "bai-viet-dang":
        return (
          <ReviewList
            reviews={reviews}
            loading={reviewsLoading}
            error={reviewsError}
            hasMore={hasMoreReviews}
            onLoadMore={loadMoreReviews}
          />
        );

      case "bai-viet-luu":
        return (
          <SavedList
            saved={saved}
            loading={savedLoading}
            error={savedError}
            hasMore={hasMoreSaved}
            onLoadMore={loadMoreSaved}
          />
        );

      default:
        return null;
    }
  };

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        {/* Profile Banner */}
        <ProfileBanner
          profile={profile}
          stats={stats}
          avatarPreview={avatarPreview}
          backgroundPreview={backgroundPreview}
          isUploadingAvatar={isUploadingAvatar}
          isUploadingBackground={isUploadingBackground}
          onAvatarClick={triggerAvatarSelect}
          onBackgroundClick={triggerBackgroundSelect}
          avatarSuccessAnimation={avatarSuccessAnimation}
        />

        {/* Hidden File Inputs */}
        <input
          ref={avatarInputRef}
          type="file"
          accept="image/*"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={handleBackgroundChange}
          className="hidden"
        />

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Sidebar */}
            <div className="lg:col-span-3">
              <ProfileSidebar
                activeMenu={activeMenu}
                onMenuChange={setActiveMenu}
              />
            </div>

            {/* Content Area */}
            <div className="lg:col-span-9">
              <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      <Toast
        toast={toast}
        onClose={() => setToast(null)}
      />
    </>
  );
}
