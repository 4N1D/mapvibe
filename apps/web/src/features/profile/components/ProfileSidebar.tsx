import { User, Image as ImageIcon, FileText, Bookmark } from "lucide-react";
import type { ProfileMenuItem } from "../types";

interface ProfileSidebarProps {
  activeMenu: ProfileMenuItem;
  onMenuChange: (menu: ProfileMenuItem) => void;
}

const menuItems = [
  {
    id: "thong-tin" as ProfileMenuItem,
    label: "Thông tin cá nhân",
    icon: User,
    section: "Cá nhân",
  },
  {
    id: "anh" as ProfileMenuItem,
    label: "Ảnh",
    icon: ImageIcon,
    section: "Cá nhân",
  },
  {
    id: "bai-viet-dang" as ProfileMenuItem,
    label: "Bài viết đã đăng",
    icon: FileText,
    section: "Quản lý",
  },
  {
    id: "bai-viet-luu" as ProfileMenuItem,
    label: "Bài viết đã lưu",
    icon: Bookmark,
    section: "Quản lý",
  },
];

export function ProfileSidebar({ activeMenu, onMenuChange }: ProfileSidebarProps) {
  return (
    <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-gray-200">
      {/* Cá nhân Section */}
      <div className="mb-6">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Cá nhân</h3>
        <nav className="space-y-1">
          {menuItems
            .filter((item) => item.section === "Cá nhân")
            .map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                isActive={activeMenu === item.id}
                onClick={() => onMenuChange(item.id)}
              />
            ))}
        </nav>
      </div>

      {/* Quản lý Section */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Quản lý</h3>
        <nav className="space-y-1">
          {menuItems
            .filter((item) => item.section === "Quản lý")
            .map((item) => (
              <MenuItem
                key={item.id}
                item={item}
                isActive={activeMenu === item.id}
                onClick={() => onMenuChange(item.id)}
              />
            ))}
        </nav>
      </div>
    </div>
  );
}

interface MenuItemProps {
  item: (typeof menuItems)[0];
  isActive: boolean;
  onClick: () => void;
}

function MenuItem({ item, isActive, onClick }: MenuItemProps) {
  const Icon = item.icon;

  return (
    <button
      onClick={onClick}
      className={`relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors ${
        isActive ? "bg-gray-50 text-gray-900" : "text-gray-600 hover:bg-gray-50"
      }`}
    >
      {isActive && (
        <div className="absolute bottom-0 left-0 top-0 w-1 rounded-r bg-primary-500"></div>
      )}
      <Icon className="h-5 w-5" />
      <span>{item.label}</span>
    </button>
  );
}
