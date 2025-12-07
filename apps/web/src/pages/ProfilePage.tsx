import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { apiClient } from "@/lib/axios";
import {
  User,
  Mail,
  Image as ImageIcon,
  FileText,
  Bookmark,
  Camera,
  Upload,
} from "lucide-react";
import { SavedCard } from "@/features/review/components/SavedCard";
import { Button, Input } from "@mapvibe/ui-components";

interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  display_name?: string;
  avatar?: string;
  background_image?: string;
  bio?: string;
  reputation: number;
  roles: string[];
  account_status: string;
  email_verified: boolean;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  date_of_birth?: string;
  gender?: string;
}

interface PhotoItem {
  id: string;
  url: string;
  created_at: string;
  thumbnail_url?: string;
  width?: number;
  height?: number;
}

interface PhotoGroup {
  date: string;
  items: PhotoItem[];
}

interface PostItem {
  id: string;
  title: string;
  description: string;
  cover_url?: string;
  created_at: string;
  comments?: number;
  likes?: number;
  bookmarked?: boolean;
}

type MenuItem = "thong-tin" | "anh" | "bai-viet-dang" | "bai-viet-luu";

export function ProfilePage() {
  const navigate = useNavigate();
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMenu, setActiveMenu] = useState<MenuItem>("thong-tin");
  const [formData, setFormData] = useState({
    display_name: "",
    email: "",
    bio: "",
    gender: "Khác",
    new_password: "",
    confirm_password: "",
  });
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
  const [isUploadingBackground, setIsUploadingBackground] = useState(false);
  const backgroundInputRef = useRef<HTMLInputElement>(null);
  const [isBackgroundHover, setIsBackgroundHover] = useState(false);
  const [photos, setPhotos] = useState<PhotoGroup[]>([]);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [photosError, setPhotosError] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [savedPosts, setSavedPosts] = useState<PostItem[]>([]);
  const [savedPostsLoading, setSavedPostsLoading] = useState(false);
  const [savedPostsError, setSavedPostsError] = useState<string | null>(null);

  // Helper to check mock mode
  const isMockModeEnabled = (): boolean => {
    return (
      import.meta.env.VITE_USE_MOCK_AUTH === "true" ||
      localStorage.getItem("mock_auth_enabled") === "true"
    );
  };

  useEffect(() => {
    // Redirect nếu chưa đăng nhập
    if (!authLoading && !isAuthenticated) {
      navigate("/");
      return;
    }

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, authLoading, navigate]);

  useEffect(() => {
    if (profile) {
      setFormData({
        display_name: profile.display_name || "",
        email: profile.email || "",
        bio: profile.bio || "",
        gender: profile.gender || "Khác",
        new_password: "",
        confirm_password: "",
      });
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchPhotos();
      fetchPosts();
      fetchSavedPosts();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      // Always fetch from real API for user profile
      const response = await apiClient.get<{ user: UserProfile }>("/users/me");
      setProfile(response.data.user);
    } catch (err: any) {
      console.error("[Profile] Failed to fetch profile:", err);

      // In mock mode, fallback to mock data if API fails
      if (isMockModeEnabled()) {
        setProfile(MOCK_PROFILE);
        return;
      }

      setError(
        err.response?.data?.message ||
          err.message ||
          "Không thể tải thông tin profile"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatDateDisplay = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("vi-VN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch (e) {
      return dateString;
    }
  };

  const buildPhotoGroups = (items: PhotoItem[]): PhotoGroup[] => {
    const groups: Record<string, PhotoItem[]> = {};
    items.forEach((item) => {
      const key = new Date(item.created_at || new Date()).toISOString().split("T")[0];
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    return Object.entries(groups)
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([date, items]) => ({
        date,
        items,
      }));
  };

  const fetchPhotos = async () => {
    try {
      setPhotosLoading(true);
      setPhotosError(null);

      // Mock data for photos
      if (isMockModeEnabled()) {
        const mockItems: PhotoItem[] = [
          {
            id: "p1",
            url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-15T10:00:00Z",
          },
          {
            id: "p2",
            url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-15T11:00:00Z",
          },
          {
            id: "p3",
            url: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-15T12:00:00Z",
          },
          {
            id: "p4",
            url: "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-14T08:00:00Z",
          },
          {
            id: "p5",
            url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-14T09:00:00Z",
          },
          {
            id: "p6",
            url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-09-14T10:00:00Z",
          },
        ];
        setPhotos(buildPhotoGroups(mockItems));
        return;
      }

      const response = await apiClient.get<{ photos: PhotoItem[] }>("/photos/me");
      const items = response.data?.photos || [];
      setPhotos(buildPhotoGroups(items));
    } catch (err: any) {
      console.error("[Profile] Failed to fetch photos:", err);
      setPhotosError(
        err?.response?.data?.message ||
          err?.message ||
          "Không thể tải danh sách ảnh"
      );
    } finally {
      setPhotosLoading(false);
    }
  };

  const fetchPosts = async () => {
    try {
      setPostsLoading(true);
      setPostsError(null);

      if (isMockModeEnabled()) {
        const mockPosts: PostItem[] = [
          {
            id: "post-1",
            title: "Quán nướng Hoàng Cấm",
            description: "Đây là mô tả và review chi tiết về quán nướng Hoàng Cấm ...",
            cover_url:
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-02-11T08:00:00Z",
            comments: 503,
            likes: 234,
            dislikes: 12,
          },
          {
            id: "post-2",
            title: "Quán lẩu Hoàng Gia",
            description: "Đây là mô tả và review chi tiết về quán lẩu Hoàng Gia ...",
            cover_url:
              "https://images.unsplash.com/photo-1521017432531-fbd92d768814?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-02-13T09:30:00Z",
            comments: 520,
            likes: 240,
            dislikes: 10,
          },
          {
            id: "post-3",
            title: "Cà phê Góc Phố",
            description: "Không gian ấm cúng, đồ uống ngon, giá hợp lý ...",
            cover_url:
              "https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-02-13T11:00:00Z",
            comments: 210,
            likes: 180,
            dislikes: 8,
          },
          {
            id: "post-4",
            title: "Bánh mì Sài Gòn",
            description: "Ổ bánh mì ngon, đậm đà, nhiều topping ...",
            cover_url:
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80&sat=-30",
            created_at: "2025-02-12T07:45:00Z",
            comments: 150,
            likes: 130,
            dislikes: 6,
          },
          {
            id: "post-5",
            title: "Bún chả Hà Nội",
            description: "Hương vị truyền thống, chả nướng thơm, nước chấm vừa miệng ...",
            cover_url:
              "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-02-11T10:15:00Z",
            comments: 190,
            likes: 150,
            dislikes: 5,
          },
        ];
        setPosts(mockPosts);
        return;
      }

      const response = await apiClient.get<{ posts: PostItem[] }>("/posts/me");
      const items = response.data?.posts || [];
      setPosts(items);
    } catch (err: any) {
      console.error("[Profile] Failed to fetch posts:", err);
      setPostsError(
        err?.response?.data?.message || err?.message || "Không thể tải danh sách bài viết"
      );
    } finally {
      setPostsLoading(false);
    }
  };

  const fetchSavedPosts = async () => {
    try {
      setSavedPostsLoading(true);
      setSavedPostsError(null);

      if (isMockModeEnabled()) {
        const mockSaved: PostItem[] = [
          {
            id: "saved-1",
            title: "Bánh mì pate chả",
            description: "Ổ bánh mì giòn, pate béo, chả thơm, rau tươi",
            cover_url:
              "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=1200&q=80",
            created_at: "2025-02-10T09:00:00Z",
            comments: 120,
            likes: 340,
            bookmarked: true,
            author_name: "Hoàng Minh",
          },
          {
            id: "saved-2",
            title: "Cơm tấm sườn bì chả",
            description: "Sườn nướng đậm vị, bì thơm, mỡ hành béo",
            cover_url:
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80&sat=-20",
            created_at: "2025-02-09T08:30:00Z",
            comments: 98,
            likes: 280,
            bookmarked: true,
            author_name: "Lan Anh",
          },
          {
            id: "saved-3",
            title: "Mì quảng tôm thịt",
            description: "Nước dùng đậm đà, tôm tươi, lạc rang bùi",
            cover_url:
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80&hue=20",
            created_at: "2025-02-08T07:45:00Z",
            comments: 76,
            likes: 210,
            bookmarked: true,
            author_name: "Quốc Bảo",
          },
          {
            id: "saved-4",
            title: "Trà sữa trân châu",
            description: "Sữa thơm, trân châu dẻo, ít ngọt, topping đa dạng",
            cover_url:
              "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80&sat=10&exp=-1",
            created_at: "2025-02-07T10:15:00Z",
            comments: 64,
            likes: 190,
            bookmarked: true,
            author_name: "Kim Ngân",
          },
        ];
        setSavedPosts(mockSaved);
        return;
      }

      const response = await apiClient.get<{ posts: PostItem[] }>("/posts/saved");
      setSavedPosts(
        (response.data?.posts || []).map((p) => ({
          ...p,
          bookmarked: p.bookmarked ?? true,
        }))
      );
    } catch (err: any) {
      console.error("[Profile] Failed to fetch saved posts:", err);
      setSavedPostsError(
        err?.response?.data?.message || err?.message || "Không thể tải bài viết đã lưu"
      );
    } finally {
      setSavedPostsLoading(false);
    }
  };

  const toSavedCardData = (post: PostItem) => ({
    id: post.id,
    title: post.title,
    description: post.description,
    cover_url: post.cover_url,
    created_at: post.created_at,
    author_name: profile?.display_name || profile?.email || "User",
    // Nếu mock có author riêng thì ưu tiên, fallback profile
    author_name: post.author_name || profile?.display_name || profile?.email || "User",
    comments: post.comments,
    likes: post.likes,
    bookmarked: post.bookmarked ?? false,
  });

  const handleSave = async () => {
    try {
      // TODO: Implement save functionality
      console.log("Saving profile:", formData);
      // await apiClient.put("/users/me", formData);
      alert("Đã lưu thay đổi thành công!");
    } catch (err: any) {
      console.error("[Profile] Failed to save:", err);
      alert("Lỗi khi lưu thay đổi");
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Kích thước ảnh không được vượt quá 5MB");
      return;
    }

    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAvatarPreview(reader.result as string);
    };
    reader.readAsDataURL(file);

    // Upload avatar
    try {
      setIsUploadingAvatar(true);
      
      // Get upload URL
      const uploadResponse = await apiClient.post("/photos/upload-url", {
        photo_type: "user_avatar",
        content_type: file.type,
        file_size: file.size,
      });

      const { upload_url, cdn_url } = uploadResponse.data;

      // Upload to S3
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // Update user profile with new avatar URL
      await apiClient.put("/users/me", {
        avatar: cdn_url,
      });

      // Update local profile
      if (profile) {
        setProfile({ ...profile, avatar: cdn_url });
      }

      alert("Đã cập nhật ảnh đại diện thành công!");
    } catch (err: any) {
      console.error("[Profile] Failed to upload avatar:", err);
      alert("Lỗi khi tải lên ảnh đại diện");
      setAvatarPreview(null);
    } finally {
      setIsUploadingAvatar(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleBackgroundClick = () => {
    console.log("[Profile] Background click - opening file picker");
    backgroundInputRef.current?.click();
  };

  const handleBackgroundChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (max 10MB for background)
    if (file.size > 10 * 1024 * 1024) {
      alert("Kích thước ảnh không được vượt quá 10MB");
      return;
    }

    // Create preview FIRST - this will show immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      const previewUrl = reader.result as string;
      setBackgroundPreview(previewUrl);
      console.log("[Profile] Background preview set:", previewUrl);
    };
    reader.readAsDataURL(file);

    // Upload background
    try {
      setIsUploadingBackground(true);
      
      // Wait a bit for preview to show
      await new Promise((resolve) => setTimeout(resolve, 100));
      
      // Get upload URL
      const uploadResponse = await apiClient.post("/photos/upload-url", {
        photo_type: "user_background",
        content_type: file.type,
        file_size: file.size,
      });

      const { upload_url, cdn_url } = uploadResponse.data;

      // Upload to S3
      await fetch(upload_url, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      // Update user profile with new background URL
      await apiClient.put("/users/me", {
        background_image: cdn_url,
      });

      // Update local profile and keep preview
      if (profile) {
        setProfile({ ...profile, background_image: cdn_url } as UserProfile);
      }
      
      // Keep preview even after upload
      setBackgroundPreview(cdn_url);

      alert("Đã cập nhật ảnh nền thành công!");
    } catch (err: any) {
      console.error("[Profile] Failed to upload background:", err);
      alert("Lỗi khi tải lên ảnh nền: " + (err.message || "Vui lòng thử lại"));
      // Don't clear preview on error, let user see what they selected
    } finally {
      setIsUploadingBackground(false);
      // Reset file input
      if (backgroundInputRef.current) {
        backgroundInputRef.current.value = "";
      }
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
      </div>
    );
  }

  if (error && !isMockModeEnabled()) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg bg-red-50 p-4 text-center">
          <p className="text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

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

  const menuItems = [
    {
      id: "thong-tin" as MenuItem,
      label: "Thông tin cá nhân",
      icon: User,
      section: "Cá nhân",
    },
    {
      id: "anh" as MenuItem,
      label: "Ảnh",
      icon: ImageIcon,
      section: "Cá nhân",
    },
    {
      id: "bai-viet-dang" as MenuItem,
      label: "Bài viết đã đăng",
      icon: FileText,
      section: "Quản lý",
    },
    {
      id: "bai-viet-luu" as MenuItem,
      label: "Bài viết đã lưu",
      icon: Bookmark,
      section: "Quản lý",
    },
  ];

  const renderContent = () => {
    switch (activeMenu) {
      case "thong-tin":
        return (
          <div className="space-y-6">
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
                  onChange={(e) =>
                    setFormData({ ...formData, display_name: e.target.value })
                  }
                  placeholder="Nhập tên hiển thị"
                />
                <Input
                  label="Email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  placeholder="Nhập email"
                />
              </div>

              {/* Right Column */}
              <div className="space-y-6">
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
                <Input
                  label="Mật khẩu mới"
                  type="password"
                  value={formData.new_password}
                  onChange={(e) =>
                    setFormData({ ...formData, new_password: e.target.value })
                  }
                  placeholder="Nhập mật khẩu mới"
                />
                <Input
                  label="Nhập lại mật khẩu"
                  type="password"
                  value={formData.confirm_password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      confirm_password: e.target.value,
                    })
                  }
                  placeholder="Nhập lại mật khẩu"
                />
              </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                className="bg-gray-200 text-gray-900 hover:bg-gray-300"
              >
                Lưu thay đổi
              </Button>
            </div>
          </div>
        );

      case "anh":
        return (
          <div className="space-y-6">
            {photosLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
              </div>
            ) : photosError ? (
              <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">
                {photosError}
              </div>
            ) : photos.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <ImageIcon className="h-10 w-10 text-gray-400" />
                <p className="mt-3 text-gray-600">Chưa có ảnh nào</p>
              </div>
            ) : (
              photos.map((group) => (
                <div key={group.date} className="rounded-lg bg-gray-50 p-4 ring-1 ring-gray-200">
                  <p className="mb-4 text-sm font-semibold text-gray-800">
                    {formatDateDisplay(group.date)}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {group.items.map((photo) => (
                      <div
                        key={photo.id}
                        className="overflow-hidden rounded-lg bg-gray-200 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                      >
                        <div className="aspect-[4/3] w-full overflow-hidden bg-gray-200">
                          <img
                            src={photo.url || photo.thumbnail_url || ""}
                            alt="Ảnh của bạn"
                            className="h-full w-full object-cover"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        );

      case "bai-viet-dang":
        return (
          <div className="space-y-6">
            {postsLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
              </div>
            ) : postsError ? (
              <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">
                {postsError}
              </div>
            ) : posts.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <FileText className="h-10 w-10 text-gray-400" />
                <p className="mt-3 text-gray-600">Chưa có bài viết nào</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {posts.map((post) => (
                  <SavedCard
                    key={post.id}
                    data={{ ...toSavedCardData(post), showBookmark: false, bookmarked: false }}
                    formatDate={formatDateDisplay}
                  />
                ))}
              </div>
            )}
          </div>
        );

      case "bai-viet-luu":
        return (
          <div className="space-y-6">
            {savedPostsLoading ? (
              <div className="flex min-h-[300px] items-center justify-center">
                <div className="border-primary-500 h-8 w-8 animate-spin rounded-full border-4 border-t-transparent"></div>
              </div>
            ) : savedPostsError ? (
              <div className="rounded-lg bg-red-50 p-4 text-center text-red-600">
                {savedPostsError}
              </div>
            ) : savedPosts.length === 0 ? (
              <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-6 text-center">
                <Bookmark className="h-10 w-10 text-gray-400" />
                <p className="mt-3 text-gray-600">Chưa có bài viết nào được lưu</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {savedPosts.map((post) => (
                  <SavedCard
                    key={post.id}
                    data={{
                      ...toSavedCardData(post),
                      showBookmark: true,
                      onToggleBookmark: () => {
                        setSavedPosts((prev) =>
                          prev.map((p) =>
                            p.id === post.id ? { ...p, bookmarked: !p.bookmarked } : p
                          )
                        );
                      },
                    }}
                    formatDate={formatDateDisplay}
                  />
                ))}
              </div>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* Mock Mode Banner */}
      {isMockModeEnabled() && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-2">
          <div className="mx-auto max-w-7xl">
            <p className="text-sm text-yellow-800">
              🧪 <strong>Mock Mode:</strong> Đang sử dụng dữ liệu giả để test.
            </p>
          </div>
        </div>
      )}

      <div className="min-h-screen bg-gray-50">
        {/* Profile Banner Background */}
        <div
          className="group/banner relative cursor-pointer bg-gray-800 bg-cover bg-center transition-all duration-300"
          style={{
            backgroundImage: backgroundPreview
              ? `url(${backgroundPreview})`
              : profile?.background_image
              ? `url(${profile.background_image})`
              : undefined,
            minHeight: "200px",
          }}
          onClick={handleBackgroundClick}
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
                  <span className="text-sm font-medium text-white leading-tight">
                    Đang tải...
                  </span>
                </>
              ) : (
                <>
                  <Camera className="h-8 w-8 flex-shrink-0 text-white" />
                  <span className="text-sm font-medium text-white leading-tight">
                    Thay đổi ảnh nền
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Hidden File Input for Background */}
          <input
            ref={backgroundInputRef}
            type="file"
            accept="image/*"
            onChange={handleBackgroundChange}
            className="hidden"
          />

          {/* Profile Content - Avatar and Stats overlapping banner */}
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
                {/* Avatar with Hover Effect */}
                <div className="group/avatar relative">
                  <div
                    onClick={handleAvatarClick}
                    className="relative cursor-pointer transition-transform duration-200 hover:scale-105"
                  >
                    {/* Avatar Image or Placeholder */}
                    {avatarPreview || profile.avatar ? (
                      <img
                        src={avatarPreview || profile.avatar}
                        alt={profile.display_name || profile.email}
                        className="h-24 w-24 rounded-full bg-gray-300 object-cover ring-4 ring-white"
                      />
                    ) : (
                      <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gray-300 text-2xl font-bold text-gray-600 ring-4 ring-white">
                        {getInitials(profile.display_name, profile.email)}
                      </div>
                    )}

                    {/* Hover Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/60 opacity-0 transition-opacity duration-200 group-hover/avatar:opacity-100">
                      <div className="flex flex-col items-center justify-center gap-2.5 px-3 text-center">
                        {isUploadingAvatar ? (
                          <>
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            <span className="text-xs font-medium text-white leading-tight">
                              Đang tải...
                            </span>
                          </>
                        ) : (
                          <>
                            <Camera className="h-6 w-6 flex-shrink-0 text-white" />
                            <span className="text-xs font-medium text-white leading-tight max-w-[80px]">
                              Thay đổi ảnh đại diện
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Hidden File Input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarChange}
                    className="hidden"
                  />
                </div>

                {/* Name */}
                <h1 className="text-2xl font-semibold text-white">
                  {profile.display_name || profile.email.split("@")[0]}
                </h1>
              </div>

              {/* Right Section: Stats */}
              <div className="flex items-center gap-6">
                {/* Nhận xét (Comments) */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold text-white">0</span>
                  <span className="text-sm text-gray-300">Nhận xét</span>
                </div>

                {/* Divider */}
                <div className="h-12 w-px bg-white/20"></div>

                {/* Ảnh (Photos) */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold text-white">0</span>
                  <span className="text-sm text-gray-300">Ảnh</span>
                </div>

                {/* Divider */}
                <div className="h-12 w-px bg-white/20"></div>

                {/* Bài đăng (Posts) */}
                <div className="flex flex-col items-center">
                  <span className="text-2xl font-semibold text-white">0</span>
                  <span className="text-sm text-gray-300">Bài đăng</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Below Banner */}
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* Left Sidebar - Navigation */}
            <div className="lg:col-span-3">
              <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
                {/* Cá nhân Section */}
                <div className="mb-6">
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Cá nhân
                  </h3>
                  <nav className="space-y-1">
                    {menuItems
                      .filter((item) => item.section === "Cá nhân")
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = activeMenu === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveMenu(item.id)}
                            className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-gray-50 text-gray-900"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-primary-500"></div>
                            )}
                            <Icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </nav>
                </div>

                {/* Quản lý Section */}
                <div>
                  <h3 className="mb-3 text-sm font-semibold text-gray-900">
                    Quản lý
                  </h3>
                  <nav className="space-y-1">
                    {menuItems
                      .filter((item) => item.section === "Quản lý")
                      .map((item) => {
                        const Icon = item.icon;
                        const isActive = activeMenu === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setActiveMenu(item.id)}
                            className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                              isActive
                                ? "bg-gray-50 text-gray-900"
                                : "text-gray-600 hover:bg-gray-50"
                            }`}
                          >
                            {isActive && (
                              <div className="absolute left-0 top-0 bottom-0 w-1 rounded-r bg-primary-500"></div>
                            )}
                            <Icon className="h-5 w-5" />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                  </nav>
                </div>
              </div>
            </div>

            {/* Right Content Area */}
            <div className="lg:col-span-9">
              <div className="rounded-lg bg-white p-6 shadow-sm ring-1 ring-gray-200">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
