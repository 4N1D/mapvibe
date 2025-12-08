import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Camera, CheckCircle2 } from "lucide-react";
import type { UserProfile, UserStats } from "../types";

interface ProfileBannerProps {
  profile: UserProfile;
  stats: UserStats | null;
  avatarPreview: string | null;
  backgroundPreview: string | null;
  isUploadingAvatar: boolean;
  isUploadingBackground: boolean;
  onAvatarClick: () => void;
  onBackgroundClick: () => void;
  avatarSuccessAnimation: boolean;
}

export function ProfileBanner({
  profile,
  stats,
  avatarPreview,
  backgroundPreview,
  isUploadingAvatar,
  isUploadingBackground,
  onAvatarClick,
  onBackgroundClick,
  avatarSuccessAnimation,
}: ProfileBannerProps) {
  const [isBackgroundHover, setIsBackgroundHover] = useState(false);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2);
    }
    if (email) {
      return email[0].toUpperCase();
    }
    return "U";
  };

  const backgroundUrl = backgroundPreview || profile?.background || profile?.background_image;

  return (
    <div
      className="group/banner relative cursor-pointer bg-gray-800 bg-cover bg-center transition-all duration-300"
      style={{
        backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : undefined,
        minHeight: "200px",
      }}
      onClick={onBackgroundClick}
      onMouseEnter={() => setIsBackgroundHover(true)}
      onMouseLeave={() => setIsBackgroundHover(false)}
    >
      {/* Background Overlay on Hover */}
      <div
        className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40 transition-opacity duration-200 ${
          isBackgroundHover ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex flex-col items-center justify-center gap-2.5 px-4 text-center">
          {isUploadingBackground ? (
            <>
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
              <span className="text-sm font-medium leading-tight text-white">Đang tải...</span>
            </>
          ) : (
            <>
              <Camera className="h-8 w-8 flex-shrink-0 text-white" />
              <span className="text-sm font-medium leading-tight text-white">Thay đổi ảnh nền</span>
            </>
          )}
        </div>
      </div>

      {/* Profile Content */}
      <div className="relative mx-auto flex min-h-[260px] max-w-7xl items-center justify-between px-4 py-10 sm:px-6 lg:px-8">
        <div
          className="flex w-full items-center justify-between gap-6"
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={(e) => {
            e.stopPropagation();
            setIsBackgroundHover(false);
          }}
          onMouseLeave={(e) => {
            e.stopPropagation();
            setIsBackgroundHover(true);
          }}
        >
          {/* Left Section: Avatar and Name */}
          <div className="flex items-center gap-5 md:gap-6">
            <AvatarSection
              profile={profile}
              avatarPreview={avatarPreview}
              isUploadingAvatar={isUploadingAvatar}
              onAvatarClick={onAvatarClick}
              avatarSuccessAnimation={avatarSuccessAnimation}
              getInitials={getInitials}
            />
            <h1 className="text-2xl font-semibold text-white">
              {profile.display_name || profile.email.split("@")[0]}
            </h1>
          </div>

          {/* Right Section: Stats */}
          <StatsSection stats={stats} />
        </div>
      </div>
    </div>
  );
}

interface AvatarSectionProps {
  profile: UserProfile;
  avatarPreview: string | null;
  isUploadingAvatar: boolean;
  onAvatarClick: () => void;
  avatarSuccessAnimation: boolean;
  getInitials: (name?: string, email?: string) => string;
}

function AvatarSection({
  profile,
  avatarPreview,
  isUploadingAvatar,
  onAvatarClick,
  avatarSuccessAnimation,
  getInitials,
}: AvatarSectionProps) {
  return (
    <div className="group/avatar relative">
      <div
        onClick={onAvatarClick}
        className="relative cursor-pointer transition-transform duration-200 hover:scale-105"
      >
        {avatarPreview || profile.avatar ? (
          <motion.img
            src={avatarPreview || profile.avatar}
            alt={profile.display_name || profile.email}
            className="h-24 w-24 rounded-full bg-gray-300 object-cover ring-4 ring-white"
            animate={avatarSuccessAnimation ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 0.5 }}
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-300 text-2xl font-bold text-gray-600 ring-4 ring-white">
            {getInitials(profile.display_name, profile.email)}
          </div>
        )}

        {/* Success Animation Overlay */}
        <AnimatePresence>
          {avatarSuccessAnimation && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-green-500/80 backdrop-blur-sm"
            >
              <CheckCircle2 className="h-10 w-10 text-white" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hover Overlay */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100">
          <div className="flex flex-col items-center justify-center gap-2.5 px-3 text-center">
            {isUploadingAvatar ? (
              <>
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                <span className="text-xs font-medium leading-tight text-white">Đang tải...</span>
              </>
            ) : (
              <>
                <Camera className="h-6 w-6 flex-shrink-0 text-white" />
                <span className="max-w-[80px] text-xs font-medium leading-tight text-white">
                  Thay đổi ảnh đại diện
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface StatsSectionProps {
  stats: UserStats | null;
}

function StatsSection({ stats }: StatsSectionProps) {
  return (
    <div className="flex items-center gap-6">
      <StatItem label="Nhận xét" value={stats?.comment_count ?? 0} />
      <div className="h-12 w-px bg-white/20"></div>
      <StatItem label="Ảnh" value={stats?.photo_count ?? 0} />
      <div className="h-12 w-px bg-white/20"></div>
      <StatItem label="Bài đăng" value={stats?.review_count ?? 0} />
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-2xl font-semibold text-white">{value}</span>
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  );
}
